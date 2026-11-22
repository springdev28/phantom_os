import { describe, expect, it } from 'vitest';
import type { FileArtifact } from '../domain/contracts';
import { selectLocalFile } from '../intake/local-file';
import { runtimeRegistry } from '../runtime/registry';
import { compatibilityPlanner } from '../planner/compatibility-planner';
import { probeFile, selectionInspector } from './selection-inspector';
import { BoundedReader, PROBE_LIMITS } from './probe-core';
import { elfFixture, gptFixture, isoFixture, mzFixture, neFixture, parserFixtures, peFixture, zipFixture } from '../../tests/fixtures/probe-fixtures';

function selected(bytes: Uint8Array<ArrayBuffer>, name = 'fixture.bin') {
  return selectLocalFile([new File([bytes], name, { lastModified: 0 })]);
}
async function inspect(bytes: Uint8Array<ArrayBuffer>, name = 'fixture.bin') {
  return probeFile(selected(bytes, name).files[0]!, new AbortController().signal);
}
function change(bytes: Uint8Array<ArrayBuffer>, offset: number, value: number, width: 2 | 4 = 4) {
  const view = new DataView(bytes.buffer);
  if (width === 2) view.setUint16(offset, value, true); else view.setUint32(offset, value, true);
  return bytes;
}

describe('bounded static format analysis', () => {
  it('recognizes legacy MZ relocation entries at 0x3c without inventing an extended header', async () => {
    const bytes = mzFixture(), view = new DataView(bytes.buffer);
    view.setUint16(8, 8, true); view.setUint16(6, 16, true); view.setUint16(24, 32, true); view.setUint32(60, 0x998, true);
    const result = await inspect(bytes, 'COMMAND.COM');
    expect(result).toMatchObject({ format: 'dos-mz', validity: 'valid-header', executableCompatibility: 'not-assessed' });
    expect(result.evidence.some(item => item.label === 'Legacy DOS relocation layout')).toBe(true);
  });
  it.each(parserFixtures)('$id returns an evidence-backed $format report', async fixture => {
    const result = await inspect(fixture.bytes, fixture.name);
    expect(result).toMatchObject({ format: fixture.format, validity: fixture.validity, fileSize: fixture.bytes.length,
      localAccess: 'readable', scope: 'static-inspection', executableCompatibility: 'not-assessed' });
    expect(result.evidence.length).toBeGreaterThan(0);
    for (const item of result.evidence) {
      const expected = [...fixture.bytes.slice(item.offset, item.offset + item.length)].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      expect(item.hex).toBe(expected);
      expect(item.offset + item.length).toBeLessThanOrEqual(fixture.bytes.length);
    }
    expect(result.notInferred).toHaveLength(5);
    expect(result.readStats.bytesRead).toBeLessThanOrEqual(PROBE_LIMITS.bytes);
    if (result.validity === 'invalid') expect(result.warnings.some(warning => warning.severity === 'error')).toBe(true);
    const pkg = selected(fixture.bytes, fixture.name);
    const plan = compatibilityPlanner.plan(pkg, new Map([[fixture.name, result]]), runtimeRegistry.list());
    expect(plan.canLaunch).toBe(false);
    expect(plan.decision).not.toBe('verified-compatible');
  });

  it('separates PE bitness, machine and subsystem, including EFI and non-x86', async () => {
    expect(await inspect(peFixture())).toMatchObject({ architecture: 'x86', bitness: 32, subsystem: 'Windows GUI' });
    expect(await inspect(peFixture(true))).toMatchObject({ architecture: 'x86-64', bitness: 64, subsystem: 'Windows console' });
    const arm = change(change(peFixture(true), 132, 0xaa64, 2), 152 + 68, 10, 2);
    expect(await inspect(arm)).toMatchObject({ format: 'pe32+', architecture: 'ARM64', subsystem: 'EFI application' });
  });
  it('distinguishes NE target declarations and ELF endian/class without inferring Linux', async () => {
    expect((await inspect(neFixture(1))).platform).toBe('OS/2 (declared NE target)');
    expect((await inspect(neFixture(2))).platform).toBe('Windows (declared NE target)');
    expect(await inspect(elfFixture(true, false))).toMatchObject({ architecture: 'ARM64', bitness: 64, endianness: 'big', platform: 'System V ABI (OS unspecified)' });
  });
  it('uses content ahead of extensions; raw COM and unmarked IMG remain ambiguous', async () => {
    expect((await inspect(peFixture(), 'text.com')).format).toBe('pe32');
    expect((await inspect(elfFixture(), 'windows.exe')).format).toBe('elf');
    expect(await inspect(new Uint8Array(20), 'data.com')).toMatchObject({ format: 'dos-com-ambiguous', confidence: 'ambiguous' });
    expect(await inspect(new Uint8Array(20), 'data.img')).toMatchObject({ format: 'disk-image-ambiguous', confidence: 'ambiguous' });
    expect((await inspect(new Uint8Array(65536), 'large.com')).format).toBe('unknown');
  });
  it.each([
    ['MZ sizes', change(mzFixture(), 8, 0xffff, 2)],
    ['PE optional header', change(peFixture(), 148, 2, 2)],
    ['PE optional magic', change(peFixture(), 152, 0, 2)],
    ['PE sections', change(peFixture(), 134, 97, 2)],
    ['PE contradictory machine', change(peFixture(), 132, 0x8664, 2)],
    ['PE directory count', change(peFixture(), 152 + 92, 0xffffffff)],
    ['PE entry-point RVA', change(peFixture(), 152 + 16, 0xffffffff)],
    ['PE raw section pointer', change(peFixture(), 152 + 224 + 20, 0xffffff00)],
    ['PE truncated section table', peFixture().slice(0, 380)],
    ['NE entry table', change(neFixture(), 68, 0xfffe, 2)],
    ['ELF huge table', change(elfFixture(), 28, 0xfffffff0)],
    ['ELF header size', change(elfFixture(), 40, 1, 2)],
    ['ISO inconsistent byte-order fields', change(isoFixture(), 32768 + 80, 100)],
    ['GPT overflowing partition count', change(gptFixture(), 512 + 80, 0xffffffff)],
  ])('reports malformed %s without an unhandled exception', async (_, bytes) => {
    const result = await inspect(bytes);
    expect(result.validity).toBe('invalid');
    expect(result.confidence).toBe('ambiguous');
    expect(result.warnings.some(warning => warning.severity === 'error' && warning.message.length > 20)).toBe(true);
  });
  it('does not round overflowing 64-bit ELF offsets into a valid range', async () => {
    const bytes = elfFixture(true);
    new DataView(bytes.buffer).setBigUint64(32, 0xffffffffffffffffn, true);
    expect((await inspect(bytes)).warnings.some(warning => warning.code === 'ELF_TABLE_RANGE')).toBe(true);
  });
  it('preserves extended-format uncertainty rather than pretending to parse it', async () => {
    const extended = change(elfFixture(), 44, 0xffff, 2);
    expect(await inspect(extended)).toMatchObject({ format: 'elf', validity: 'partial' });
    const zip = zipFixture(); change(zip, zip.length - 22 + 10, 0xffff, 2);
    expect(await inspect(zip)).toMatchObject({ format: 'zip', validity: 'partial' });
    const le = peFixture(); le.set([0x4c, 0x45], 128);
    expect(await inspect(le)).toMatchObject({ format: 'dos-mz', validity: 'partial' });
  });
  it('recognizes empty ZIPs and checks the maximum comment without extraction', async () => {
    const empty = new Uint8Array(22); empty.set([0x50, 0x4b, 5, 6]);
    expect(await inspect(empty)).toMatchObject({ format: 'zip', validity: 'valid-header' });
    const base = zipFixture(), commented = new Uint8Array(base.length + 65535);
    commented.set(base); change(commented, base.length - 2, 65535, 2);
    expect(await inspect(commented)).toMatchObject({ format: 'zip', validity: 'valid-header' });
    const encrypted = change(zipFixture(), 6, 1, 2);
    expect((await inspect(encrypted)).warnings.some(warning => warning.code === 'ZIP_ENCRYPTED')).toBe(true);
  });
  it('rejects ZIP directory pointers into payloads or outside local records', async () => {
    const overlap = zipFixture();
    change(overlap, overlap.length - 22 + 16, 31);
    expect((await inspect(overlap)).validity).toBe('invalid');
    const badReference = zipFixture(), view = new DataView(badReference.buffer);
    const directory = view.getUint32(badReference.length - 22 + 16, true);
    change(badReference, directory + 42, 0xfffffff0);
    expect((await inspect(badReference)).warnings.some(warning => warning.code === 'ZIP_LOCAL_REFERENCE')).toBe(true);
  });
  it('finds an ISO primary descriptor after a boot descriptor', async () => {
    const bytes = isoFixture(), pvd = bytes.slice(32768, 34816);
    bytes.set(pvd, 34816); bytes[32768] = 0;
    expect(await inspect(bytes)).toMatchObject({ format: 'iso9660', validity: 'valid-header' });
  });
  it('checks actual read bounds and never reads the full large input', async () => {
    const bytes = new Uint8Array(4 * 1024 * 1024); bytes.set(peFixture());
    const original = selected(bytes).files[0]!;
    const requests: { offset: number; length: number }[] = [];
    const file: FileArtifact = { ...original, async read(offset, length, signal) {
      requests.push({ offset, length }); return original.read(offset, length, signal);
    } };
    const result = await probeFile(file, new AbortController().signal);
    expect(result.format).toBe('pe32');
    expect(requests.every(request => request.length <= 65536 && request.offset >= 0 && request.offset + request.length <= bytes.length)).toBe(true);
    expect(requests.reduce((total, request) => total + request.length, 0)).toBe(result.readStats.bytesRead);
    expect(result.readStats.bytesRead).toBeLessThan(4096);
  });
  it('enforces cumulative bytes and operation budgets before an excess read', async () => {
    const file = selected(new Uint8Array(2 * 1024 * 1024)).files[0]!;
    const reader = new BoundedReader(file, new AbortController().signal);
    await reader.range(0, PROBE_LIMITS.bytes);
    await expect(reader.range(PROBE_LIMITS.bytes, 1)).rejects.toMatchObject({ code: 'PROBE_LIMIT', validity: 'partial' });
    const many = new BoundedReader(file, new AbortController().signal);
    for (let i = 0; i < 32; i++) await many.range(i * 2, 1);
    await expect(many.range(100, 1)).rejects.toMatchObject({ code: 'PROBE_LIMIT' });
    expect(many.operations).toBe(32);
  });
  it('does not publish after cancellation and surfaces file read failures safely', async () => {
    const file = selected(peFixture()).files[0]!, controller = new AbortController();
    const cancelled: FileArtifact = { ...file, async read(offset, size) { controller.abort(); return new Uint8Array(size + offset); } };
    await expect(probeFile(cancelled, controller.signal)).rejects.toThrow();
    const broken = new File([peFixture()], 'broken.exe');
    Object.defineProperty(broken, 'slice', { value: () => ({ arrayBuffer: async () => { throw new Error('PRIVATE FILE DETAILS'); } }) });
    await expect(selectionInspector.inspect(selectLocalFile([broken]), new AbortController().signal)).rejects.toThrow('The file could not be read');
  });
  it('handles a deterministic malformed-byte corpus with bounded reports', async () => {
    let seed = 0x12345678;
    for (let size = 1; size <= 256; size++) {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; bytes[i] = seed >>> 24; }
      if (size > 2 && size % 3 === 0) bytes.set([0x4d, 0x5a]);
      if (size > 4 && size % 5 === 0) bytes.set([0x7f, 0x45, 0x4c, 0x46]);
      const result = await inspect(bytes);
      expect(result.executableCompatibility).toBe('not-assessed');
      expect(result.evidence.length).toBeLessThanOrEqual(64);
      expect(result.readStats.bytesRead).toBeLessThanOrEqual(PROBE_LIMITS.bytes);
    }
  });
});
