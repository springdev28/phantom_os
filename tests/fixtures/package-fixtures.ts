import { deflateRawSync } from 'node:zlib';
import { mzFixture, peFixture, zipFixture, isoFixture } from './probe-fixtures.ts';

export interface ZipFixtureEntry {
  path: string; bytes: Uint8Array; method?: number; flags?: number; attributes?: number;
  declaredSize?: number; crc?: number; localPath?: string; extra?: Uint8Array; descriptor?: boolean;
}
export const textBytes = (text: string) => new TextEncoder().encode(text);
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const concat = (parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));

/** Original deterministic ZIP writer; Node zlib produces independent Deflate test streams.
 * Allows deliberately malformed metadata. Nothing in these parser fixtures is executed.
 */
export function packageZip(entries: ZipFixtureEntry[]): Uint8Array<ArrayBuffer> {
  const locals: Uint8Array[] = [], central: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = textBytes(entry.path), localName = textBytes(entry.localPath ?? entry.path), extra = entry.extra ?? new Uint8Array();
    const method = entry.method ?? 8, compressed = method === 8 ? deflateRawSync(entry.bytes) : entry.bytes;
    const crc = entry.crc ?? crc32(entry.bytes), size = entry.declaredSize ?? entry.bytes.length;
    const flags = (entry.flags ?? 0x800) | (entry.descriptor ? 8 : 0);
    const local = new Uint8Array(30 + localName.length + extra.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, flags, true); l.setUint16(8, method, true);
    if (!entry.descriptor) { l.setUint32(14, crc, true); l.setUint32(18, compressed.length, true); l.setUint32(22, size, true); }
    l.setUint16(26, localName.length, true); l.setUint16(28, extra.length, true); local.set(localName, 30); local.set(extra, 30 + localName.length);
    const descriptor = new Uint8Array(entry.descriptor ? 16 : 0);
    if (entry.descriptor) {
      const d = new DataView(descriptor.buffer); d.setUint32(0, 0x08074b50, true); d.setUint32(4, crc, true); d.setUint32(8, compressed.length, true); d.setUint32(12, size, true);
    }
    const record = new Uint8Array(46 + name.length + extra.length), c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 0x314, true); c.setUint16(6, 20, true); c.setUint16(8, flags, true); c.setUint16(10, method, true);
    c.setUint32(16, crc, true); c.setUint32(20, compressed.length, true); c.setUint32(24, size, true);
    c.setUint16(28, name.length, true); c.setUint16(30, extra.length, true);
    c.setUint32(38, entry.attributes ?? (entry.path.endsWith('/') ? 0x41ed0010 : 0x81a40000), true);
    c.setUint32(42, localOffset, true); record.set(name, 46); record.set(extra, 46 + name.length);
    locals.push(local, compressed, descriptor); central.push(record); localOffset += local.length + compressed.length + descriptor.length;
  }
  const directory = concat(central), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, directory.length, true); e.setUint32(16, localOffset, true);
  return concat([...locals, directory, end]);
}

export const dosPackageFiles: ZipFixtureEntry[] = [
  { path: 'APP/', bytes: new Uint8Array(), method: 0 },
  { path: 'APP/empty/', bytes: new Uint8Array(), method: 0 },
  { path: 'APP/MAIN.EXE', bytes: mzFixture(), descriptor: true },
  { path: 'APP/DATA/LEVEL.DAT', bytes: Uint8Array.from({ length: 1024 }, (_, index) => index % 251) },
  { path: 'APP/APP.INI', bytes: textBytes('[app]\ndata=DATA/LEVEL.DAT\n'), method: 0 },
  { path: 'APP/README.TXT', bytes: textBytes('Original parser-only fixture. Not a working DOS application.') },
  { path: 'APP/EMPTY.DAT', bytes: new Uint8Array(), method: 0 },
  { path: 'APP/AUTORUN.BAT', bytes: textBytes('@echo off\nREM INSPECTION_MUST_NOT_EXECUTE_THIS_SCRIPT') },
];
export const mixedPackageFiles: ZipFixtureEntry[] = [
  ...dosPackageFiles,
  { path: 'APP/TOOLS/SETUP.EXE', bytes: peFixture(false) },
  { path: 'APP/REQUIRED.DLL', bytes: Uint8Array.from(peFixture(false)) },
];
export const packageFixtures = [
  { id: 'dos-package', name: 'dos-package.zip', bytes: packageZip(dosPackageFiles) },
  { id: 'mixed-package', name: 'mixed-package.zip', bytes: packageZip(mixedPackageFiles) },
  { id: 'empty-package', name: 'empty-package.zip', bytes: packageZip([]) },
  { id: 'corrupt-package', name: 'corrupt-package.zip', bytes: packageZip(dosPackageFiles).slice(0, -11) },
  { id: 'zip-slip', name: 'zip-slip.zip', bytes: packageZip([{ path: '../../escape.exe', bytes: mzFixture() }]) },
  { id: 'nested-package', name: 'nested-package.zip', bytes: packageZip([{ path: 'inner.zip', bytes: zipFixture(), method: 0 }]) },
  { id: 'disk-package', name: 'disk-package.zip', bytes: packageZip([{ path: 'disk.iso', bytes: isoFixture(), method: 0 }]) },
] as const;
