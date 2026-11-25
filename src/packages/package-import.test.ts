import { describe, expect, it, vi } from 'vitest';
import { extractZip } from './zip';
import { chooseEntrypoint, virtualPackage } from './virtual-package';
import { selectLocalFiles } from '../intake/local-file';
import { selectionInspector } from '../inspection/selection-inspector';
import { describePackage } from './package-analysis';
import { PathIndex, safePath } from './paths';
import { PACKAGE_LIMITS } from './limits';
import { dosPackageFiles, mixedPackageFiles, packageZip, textBytes, packageFixtures } from '../../tests/fixtures/package-fixtures';
import { mzFixture, zipFixture } from '../../tests/fixtures/probe-fixtures';

const signal = () => new AbortController().signal;
const unpack = (bytes: Uint8Array<ArrayBuffer>) => extractZip(new Blob([bytes]), signal());
const entry = (path: string) => ({ path, bytes: textBytes('retained') });
function unicodePathExtra(zipName: string, unicodeName: string, crcXor = 0): Uint8Array {
  const name = textBytes(zipName), utf8 = textBytes(unicodeName);
  let crc = 0xffffffff;
  for (const byte of name) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  crc = ((crc ^ 0xffffffff) ^ crcXor) >>> 0;
  const extra = new Uint8Array(9 + utf8.length), view = new DataView(extra.buffer);
  view.setUint16(0, 0x7075, true); view.setUint16(2, 5 + utf8.length, true);
  extra[4] = 1; view.setUint32(5, crc, true); extra.set(utf8, 9);
  return extra;
}
async function imported(bytes: Uint8Array<ArrayBuffer>) {
  const pkg = virtualPackage(await unpack(bytes), 'zip', 'test.zip');
  return describePackage(pkg, await selectionInspector.inspect(pkg, signal()));
}

describe('normalized ZIP and folder packages', () => {
  it('preserves every DOS companion byte, empty file and directory for an adapter', async () => {
    const pkg = await imported(packageZip(dosPackageFiles));
    expect(pkg.candidates.map(candidate => candidate.path)).toEqual(['APP/MAIN.EXE']);
    expect(pkg.entrypoint).toBeUndefined();
    expect(pkg.directories).toEqual(['APP', 'APP/DATA', 'APP/empty']);
    for (const original of dosPackageFiles.filter(file => !file.path.endsWith('/'))) {
      const retained = pkg.files.find(file => file.path === original.path)!;
      expect(await retained.read(0, retained.size, signal())).toEqual(original.bytes);
    }
    const chosen = chooseEntrypoint(pkg, 'APP/MAIN.EXE');
    expect(chosen.files).toBe(pkg.files);
    expect(chosen.directories).toBe(pkg.directories);
    expect(chosen.files.find(file => file.path.endsWith('AUTORUN.BAT'))).toBeDefined();
    expect(chosen.resources.find(file => file.kind === 'configuration')?.path).toBe('APP/APP.INI');
  });
  it('requires explicit choice for mixed candidates and does not choose a DLL or first EXE', async () => {
    const pkg = await imported(packageZip([...mixedPackageFiles].reverse()));
    expect(pkg.entrypoint).toBeUndefined();
    expect(pkg.candidates.map(candidate => candidate.path)).toEqual(['APP/MAIN.EXE', 'APP/TOOLS/SETUP.EXE']);
    expect(pkg.candidates[1]?.caution).toContain('installer');
    expect(pkg.resources.find(resource => resource.path.endsWith('.DLL'))?.kind).toBe('library');
    expect(() => chooseEntrypoint(pkg, '../../escape')).toThrow('unsafe');
  });
  it('keeps folder root, subpaths and empty resources without copying selected files', async () => {
    const files = dosPackageFiles.filter(item => !item.path.endsWith('/')).map(item => {
      const file = new File([new Uint8Array(item.bytes)], item.path.split('/').at(-1)!);
      Object.defineProperty(file, 'webkitRelativePath', { value: `Selected/${item.path}` });
      return file;
    });
    const pkg = selectLocalFiles(files, 'folder');
    expect(pkg.origin).toBe('folder');
    expect(pkg.files.map(file => file.path)).toContain('Selected/APP/DATA/LEVEL.DAT');
    expect(await pkg.files.find(file => file.path.endsWith('MAIN.EXE'))!.read(0, 2, signal())).toEqual(new Uint8Array([77, 90]));
    expect(describePackage(pkg, await selectionInspector.inspect(pkg, signal())).warnings.join()).toContain('Empty folders');
  });
  it('accepts multiple explicitly selected files and retains a disk as one opaque artifact', async () => {
    const files = selectLocalFiles([new File(['1'], 'one.dat'), new File(['2'], 'two.dat')]);
    expect(files.files).toHaveLength(2);
    const disk = await imported(packageFixtures.find(item => item.id === 'disk-package')!.bytes);
    expect(disk.files).toHaveLength(1);
    expect(disk.candidates).toHaveLength(0);
    expect(disk.resources[0]?.kind).toBe('disk-image');
  });
  it('never expands nested archives or executes imported scripts/configuration', async () => {
    const pkg = await imported(packageZip([{ path: 'embedded.zip', bytes: packageZip(dosPackageFiles) },
      { path: 'autorun.js', bytes: textBytes('globalThis.SCRIPT_RAN = true; fetch("https://invalid.example");') }]));
    expect(pkg.files.map(file => file.path)).toEqual(['autorun.js', 'embedded.zip']);
    expect(pkg.candidates).toHaveLength(0);
    expect(pkg.warnings.join()).toContain('Nested archives remain opaque');
    expect('SCRIPT_RAN' in globalThis).toBe(false);
  });
  it('rejects empty, directory-only and corrupt archives without returning a partial package', async () => {
    await expect(unpack(packageZip([]))).rejects.toMatchObject({ code: 'EMPTY_PACKAGE' });
    await expect(unpack(packageZip([{ path: 'empty/', bytes: new Uint8Array(), method: 0 }]))).rejects.toMatchObject({ code: 'EMPTY_PACKAGE' });
    await expect(unpack(packageZip(dosPackageFiles).slice(0, -1))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    await expect(unpack(textBytes('not a zip'))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('validates CRC and actual size for stored and Deflate entries', async () => {
    for (const method of [0, 8]) {
      await expect(unpack(packageZip([{ ...entry('bad.dat'), method, crc: 1 }]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    }
    await expect(unpack(packageZip([{ ...entry('bad.dat'), declaredSize: 1 }]))).rejects.toMatchObject({ code: 'PACKAGE_LIMIT' });
    await expect(unpack(packageZip([{ ...entry('bad.dat'), declaredSize: 20 }]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('rejects an empty or truncated Deflate stream even for an empty file', async () => {
    const bytes = packageZip([{ path: 'empty', bytes: new Uint8Array(), method: 0 }]);
    const data = new DataView(bytes.buffer), start = data.getUint32(bytes.length - 6, true);
    data.setUint16(8, 8, true); data.setUint16(start + 10, 8, true);
    await expect(unpack(bytes)).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    const corrupt = packageZip([{ ...entry('broken'), method: 8 }]);
    corrupt[30 + 'broken'.length] = 0xff;
    await expect(unpack(corrupt)).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('checks local/central name agreement and data descriptors', async () => {
    await expect(unpack(packageZip([{ ...entry('safe.txt'), localPath: '../a.txt' }]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    const bytes = packageZip([{ ...entry('safe.txt'), descriptor: true }]);
    const marker = Buffer.from(bytes).indexOf(Buffer.from([0x50, 0x4b, 7, 8]));
    bytes[marker + 4] = bytes[marker + 4]! ^ 1;
    await expect(unpack(bytes)).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('rejects encryption, symlinks, devices, unsupported compression and ZIP64', async () => {
    for (const change of [{ flags: 1 }, { method: 12 }, { attributes: 0xa1ff0000 }, { attributes: 0x21ff0000 },
      { extra: new Uint8Array([1, 0, 0, 0]) }]) {
      await expect(unpack(packageZip([{ ...entry('unsafe'), ...change }]))).rejects.toMatchObject({ code: 'ZIP_UNSUPPORTED' });
    }
    const zip64 = packageZip([entry('safe')]); new DataView(zip64.buffer).setUint16(zip64.length - 12, 0xffff, true);
    await expect(unpack(zip64)).rejects.toMatchObject({ code: 'ZIP_UNSUPPORTED' });
  });
  it('rejects overlapping local records and hidden prefix bytes', async () => {
    const bytes = packageZip([entry('one'), entry('two')]);
    const end = new DataView(bytes.buffer), start = end.getUint32(bytes.length - 6, true);
    end.setUint32(start + 49 + 42, 0, true);
    await expect(unpack(bytes)).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    await expect(unpack(new Uint8Array([1, ...packageZip([entry('safe')])]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('bounds entry count, declared sizes, actual output and compression ratio', async () => {
    await expect(unpack(packageZip(Array.from({ length: PACKAGE_LIMITS.entries + 1 }, (_, i) => entry(`f${i}`)))))
      .rejects.toMatchObject({ code: 'PACKAGE_LIMIT' });
    await expect(unpack(packageZip([{ ...entry('huge'), declaredSize: PACKAGE_LIMITS.fileBytes + 1 }])))
      .rejects.toMatchObject({ code: 'PACKAGE_LIMIT' });
    await expect(unpack(packageZip([{ path: 'bomb', bytes: new Uint8Array(1024 * 1024) }])))
      .rejects.toMatchObject({ code: 'ZIP_RATIO' });
    // A lying size field passes preflight but the streamed output limit still stops expansion.
    await expect(unpack(packageZip([{ path: 'lie', bytes: new Uint8Array(1024 * 1024), declaredSize: 1 }])))
      .rejects.toMatchObject({ code: 'PACKAGE_LIMIT' });
  });
  it('rejects oversized selections before reading and keeps folder roots consistent', () => {
    const file = new File(['x'], 'huge'); Object.defineProperty(file, 'size', { value: PACKAGE_LIMITS.fileBytes + 1 });
    const spy = vi.spyOn(file, 'slice');
    expect(() => selectLocalFiles([file])).toThrow('64 MiB'); expect(spy).not.toHaveBeenCalled();
    expect(() => selectLocalFiles([new File(['x'], 'missing-relative-path')], 'folder')).toThrow('unsafe');
  });
  it('enforces the total package size before allocating declared output', async () => {
    const files = ['a', 'b', 'c'].map(name => {
      const file = new File(['x'], name); Object.defineProperty(file, 'size', { value: 48 * 1024 * 1024 }); return file;
    });
    expect(() => selectLocalFiles(files)).toThrow('128 MiB');
    const bytes = packageZip(['a', 'b', 'c'].map(path => ({ ...entry(path), declaredSize: 48 * 1024 * 1024 })));
    const data = new DataView(bytes.buffer), start = data.getUint32(bytes.length - 6, true);
    for (let i = 0; i < 3; i++) data.setUint32(start + i * 47 + 20, 48 * 1024 * 1024, true);
    await expect(unpack(bytes)).rejects.toMatchObject({ code: 'PACKAGE_LIMIT' });
  });
  it('caps cumulative header reads across a package and keeps unexamined files intact', async () => {
    const pkg = selectLocalFiles(Array.from({ length: 140 }, (_, i) => new File([zipFixture(), new Uint8Array(65536)], `file-${i}.bin`)));
    let actual = 0;
    const observed = { ...pkg, files: pkg.files.map(file => ({ ...file, async read(offset: number, length: number, readSignal: AbortSignal) {
      actual += length; return file.read(offset, length, readSignal);
    } })) };
    const results = await selectionInspector.inspect(observed, signal());
    expect(actual).toBeLessThanOrEqual(PACKAGE_LIMITS.probeBytes);
    expect([...results.values()].some(result => result.warnings.some(warning => warning.code === 'PACKAGE_PROBE_LIMIT'))).toBe(true);
    expect(describePackage(observed, results).files).toHaveLength(140);
  });
  it('aborts between bounded reads and before publishing output', async () => {
    const controller = new AbortController();
    await expect(extractZip(new Blob([packageZip(dosPackageFiles)]), controller.signal, () => controller.abort()))
      .rejects.toThrow();
  });
  it('bounds reads to 64 KiB, keeps UTF-8 paths and rejects undecodable legacy names', async () => {
    const blob = new Blob([packageZip([entry('資料/é.txt')])]);
    const slice = vi.spyOn(blob, 'slice');
    expect((await extractZip(blob, signal())).files[0]?.path).toBe('資料/é.txt');
    expect(slice.mock.calls.every(([start = 0, end = 0]) => end - start <= 65536)).toBe(true);
    await expect(unpack(packageZip([{ ...entry('é.txt'), flags: 0 }]))).rejects.toMatchObject({ code: 'ZIP_ENCODING' });
  });
  it('keeps a misleading exe as data and a raw COM as an explicitly ambiguous candidate', async () => {
    const pkg = await imported(packageZip([entry('false.exe'), { path: 'raw.com', bytes: new Uint8Array([1, 2, 3]) }]));
    expect(pkg.candidates.map(candidate => candidate.path)).toEqual(['raw.com']);
    expect(pkg.candidates[0]?.reason).toContain('no confirming signature');
  });
});

describe('ZIP-slip and path collisions', () => {
  it.each(['../outside', 'safe/../../outside', '/absolute', 'C:/drive', 'C:drive', '\\\\server\\file',
    'a\\..\\b', 'a//b', './file', 'a/./b', 'a\0b', 'a/CON.txt', 'a/NUL', 'dir./file', 'a /file',
    'dir/file:stream', 'a/../b', '．．/outside'])('rejects %s before any VFS is returned', async path => {
    await expect(unpack(packageZip([{ path, bytes: mzFixture() }]))).rejects.toMatchObject({ code: 'INVALID_PATH' });
  });
  it.each([['app.exe', 'APP.EXE'], ['A/one', 'a/two'], ['é', 'e\u0301'], ['a', 'a/b'], ['a/b', 'a'], ['a', 'a']])('rejects aliases and file/directory conflicts: %j', async (a, b) => {
      await expect(unpack(packageZip([entry(a), entry(b)]))).rejects.toMatchObject({ code: 'PATH_COLLISION' });
    });
  it('bounds depth and treats object-property names as ordinary Map keys', () => {
    expect(() => safePath('a/'.repeat(33) + 'b')).toThrow('unsafe');
    const paths = new PathIndex(); expect(paths.add('__proto__/constructor')).toBe('__proto__/constructor');
    expect(paths.directories()).toEqual(['__proto__']);
  });
  it.each(['file：stream', 'foo／bar', 'COM¹.TXT', 'a\u202eexe'])(
    'rejects a compatibility-normalized or bidi path that NFC would miss: %s', path => {
      expect(() => safePath(path)).toThrow('unsafe');
    },
  );
  it('rejects an Info-ZIP Unicode Path extra that disagrees with the ZIP name', async () => {
    await expect(unpack(packageZip([{ ...entry('SAFE.TXT'), extra: unicodePathExtra('SAFE.TXT', '../ESCAPE.TXT') }])))
      .rejects.toMatchObject({ code: 'ZIP_ENCODING' });
    await expect(unpack(packageZip([{ ...entry('SAFE.TXT'), extra: unicodePathExtra('SAFE.TXT', 'SAFE.TXT', 1) }])))
      .rejects.toMatchObject({ code: 'ZIP_ENCODING' });
  });
  it('accepts a matching Unicode Path extra and still rejects AES extra fields', async () => {
    expect((await unpack(packageZip([{ ...entry('SAFE.TXT'), extra: unicodePathExtra('SAFE.TXT', 'SAFE.TXT') }]))).files.map(file => file.path))
      .toEqual(['SAFE.TXT']);
    const aes = new Uint8Array([0x01, 0x99, 0, 0]);
    await expect(unpack(packageZip([{ ...entry('SAFE.TXT'), extra: aes }]))).rejects.toMatchObject({ code: 'ZIP_UNSUPPORTED' });
  });
  it.each([['000c', 0x000c], ['000d', 0x000d], ['756e', 0x756e]] as const)(
    'rejects Unix/OS extra field 0x%s before any payload is published',
    async (_label, id) => {
      const extra = new Uint8Array(4);
      new DataView(extra.buffer).setUint16(0, id, true);
      await expect(unpack(packageZip([{ ...entry('SAFE.TXT'), extra }]))).rejects.toMatchObject({ code: 'ZIP_UNSUPPORTED' });
    },
  );
  it('rejects a truncated extra field and a Unicode Path extra that is not version 1', async () => {
    const truncated = new Uint8Array([0x75, 0x70, 10, 0]);
    await expect(unpack(packageZip([{ ...entry('SAFE.TXT'), extra: truncated }]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    const version = unicodePathExtra('SAFE.TXT', 'SAFE.TXT');
    version[4] = 2;
    await expect(unpack(packageZip([{ ...entry('SAFE.TXT'), extra: version }]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('accepts a data descriptor without the optional signature and rejects a directory bit on a file', async () => {
    expect((await unpack(packageZip([{ ...entry('SAFE.TXT'), descriptor: true, descriptorSignature: false }]))).files.map(file => file.path))
      .toEqual(['SAFE.TXT']);
    await expect(unpack(packageZip([{ ...entry('FILE.TXT'), attributes: 0x10 }]))).rejects.toMatchObject({ code: 'ZIP_INVALID' });
    await expect(unpack(packageZip([{ path: 'DIR/', bytes: new Uint8Array(), method: 0, attributes: 0x81a40000 }])))
      .rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });
  it('keeps percent-encoded names literal and never treats them as traversal', async () => {
    expect(safePath('%2e%2e/outside')).toBe('%2e%2e/outside');
    expect(safePath('%2fetc%2fpasswd')).toBe('%2fetc%2fpasswd');
    expect((await unpack(packageZip([entry('%2e%2e/outside')]))).files.map(file => file.path)).toEqual(['%2e%2e/outside']);
  });
});
