/** Original deterministic parser data. These are NOT runnable guest programs or OS images. */
import type { Format, ProbeResult } from '../../src/domain/contracts';

function writer(size: number) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  return { bytes,
    u8: (at: number, value: number) => view.setUint8(at, value),
    u16: (at: number, value: number, little = true) => view.setUint16(at, value, little),
    u32: (at: number, value: number, little = true) => view.setUint32(at, value, little),
    u64: (at: number, value: bigint, little = true) => view.setBigUint64(at, value, little),
    text: (at: number, value: string) => bytes.set(new TextEncoder().encode(value), at),
  };
}

export function mzFixture(): Uint8Array<ArrayBuffer> {
  const w = writer(1024);
  w.text(0, 'MZ'); w.u16(4, 2); w.u16(8, 2); w.u16(24, 28);
  return w.bytes;
}

export function peFixture(wide = false): Uint8Array<ArrayBuffer> {
  const w = writer(1024);
  w.text(0, 'MZ'); w.u16(2, 128); w.u16(4, 1); w.u16(8, 4); w.u16(24, 64); w.u32(60, 128);
  w.text(128, 'PE'); w.u16(132, wide ? 0x8664 : 0x14c); w.u16(134, 1);
  w.u16(148, wide ? 240 : 224); w.u16(150, 2);
  const opt = 152;
  w.u16(opt, wide ? 0x20b : 0x10b); w.u32(opt + 16, 0x1000);
  w.u32(opt + 32, 0x1000); w.u32(opt + 36, 512); w.u32(opt + 56, 0x2000); w.u32(opt + 60, 512);
  w.u16(opt + 68, wide ? 3 : 2); w.u32(opt + (wide ? 108 : 92), 16);
  const section = opt + (wide ? 240 : 224);
  w.text(section, '.text'); w.u32(section + 8, 16); w.u32(section + 12, 0x1000);
  w.u32(section + 16, 512); w.u32(section + 20, 512);
  // Zero-filled section: intentional parser fixture, not application instructions.
  return w.bytes;
}

export function neFixture(target = 2): Uint8Array<ArrayBuffer> {
  const w = writer(512);
  w.text(0, 'MZ'); w.u16(2, 64); w.u16(4, 1); w.u16(8, 4); w.u32(60, 64);
  w.text(64, 'NE'); w.u16(68, 72); w.u16(70, 1);
  w.u16(92, 1); w.u16(98, 64); w.u16(114, 4); w.u8(118, target);
  w.u16(128, 16); w.u16(130, 16);
  return w.bytes;
}

export function elfFixture(wide = false, little = true): Uint8Array<ArrayBuffer> {
  const w = writer(256);
  w.bytes.set([0x7f, 0x45, 0x4c, 0x46, wide ? 2 : 1, little ? 1 : 2, 1]);
  w.u16(16, 2, little); w.u16(18, wide ? (little ? 62 : 183) : 3, little); w.u32(20, 1, little);
  const headerSize = wide ? 64 : 52;
  if (wide) w.u64(32, 64n, little); else w.u32(28, 52, little);
  w.u16(wide ? 52 : 40, headerSize, little); w.u16(wide ? 54 : 42, wide ? 56 : 32, little); w.u16(wide ? 56 : 44, 1, little);
  w.u32(headerSize, 1, little);
  return w.bytes;
}

export function zipFixture(): Uint8Array<ArrayBuffer> {
  const name = new TextEncoder().encode('note.txt'), payload = new TextEncoder().encode('Original PHANTOM parser data.');
  const centralOffset = 30 + name.length + payload.length, centralSize = 46 + name.length;
  const w = writer(centralOffset + centralSize + 22);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  w.u32(0, 0x04034b50); w.u16(4, 20); w.u32(14, crc);
  w.u32(18, payload.length); w.u32(22, payload.length); w.u16(26, name.length);
  w.bytes.set(name, 30); w.bytes.set(payload, 30 + name.length);
  w.u32(centralOffset, 0x02014b50); w.u16(centralOffset + 4, 20); w.u16(centralOffset + 6, 20);
  w.u32(centralOffset + 16, crc); w.u32(centralOffset + 20, payload.length); w.u32(centralOffset + 24, payload.length);
  w.u16(centralOffset + 28, name.length); w.bytes.set(name, centralOffset + 46);
  const end = centralOffset + centralSize;
  w.u32(end, 0x06054b50); w.u16(end + 8, 1); w.u16(end + 10, 1);
  w.u32(end + 12, centralSize); w.u32(end + 16, centralOffset);
  return w.bytes;
}

export function isoFixture(): Uint8Array<ArrayBuffer> {
  const w = writer(34 * 2048), pvd = 16 * 2048;
  w.u8(pvd, 1); w.text(pvd + 1, 'CD001'); w.u8(pvd + 6, 1);
  w.u32(pvd + 80, 34); w.u32(pvd + 84, 34, false);
  w.u16(pvd + 128, 2048); w.u16(pvd + 130, 2048, false);
  w.u8(pvd + 156, 34); w.u32(pvd + 158, 20); w.u32(pvd + 162, 20, false);
  w.u32(pvd + 166, 2048); w.u32(pvd + 170, 2048, false);
  w.u8(pvd + 2048, 255); w.text(pvd + 2049, 'CD001'); w.u8(pvd + 2054, 1);
  return w.bytes;
}
export function mbrFixture(): Uint8Array<ArrayBuffer> {
  const w = writer(64 * 512);
  w.u8(446, 0x80); w.u8(450, 6); w.u32(454, 1); w.u32(458, 63); w.u16(510, 0xaa55);
  return w.bytes;
}
export function gptFixture(sectorSize = 512): Uint8Array<ArrayBuffer> {
  const w = writer(64 * sectorSize), at = sectorSize;
  w.u16(510, 0xaa55); w.u8(450, 0xee); w.u32(454, 1); w.u32(458, 63);
  w.text(at, 'EFI PART'); w.u32(at + 8, 0x10000); w.u32(at + 12, 92);
  w.u64(at + 24, 1n); w.u64(at + 32, 63n); w.u64(at + 40, 3n); w.u64(at + 48, 62n);
  w.u64(at + 72, 2n); w.u32(at + 80, 1); w.u32(at + 84, 128);
  // Deliberately no CRC or backup: only signature-candidate recognition is expected.
  return w.bytes;
}
export interface ParserFixture {
  readonly id: string;
  readonly name: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly format: Format;
  readonly validity: ProbeResult['validity'];
}
const corruptPe = peFixture();
new DataView(corruptPe.buffer).setUint32(60, 0xfffffff0, true);
const corruptElf = elfFixture(); corruptElf[4] = 3;
const boot = new Uint8Array(512); boot.set([0x55, 0xaa], 510);
export const parserFixtures: readonly ParserFixture[] = [
  { id: 'dos-mz', name: 'dos-header.bin', bytes: mzFixture(), format: 'dos-mz', validity: 'valid-header' },
  { id: 'pe32', name: 'pe32.data', bytes: peFixture(), format: 'pe32', validity: 'valid-header' },
  { id: 'pe32plus', name: 'pe64.data', bytes: peFixture(true), format: 'pe32+', validity: 'valid-header' },
  { id: 'ne-windows', name: 'ne-windows.bin', bytes: neFixture(), format: 'ne', validity: 'valid-header' },
  { id: 'ne-os2', name: 'ne-os2.exe', bytes: neFixture(1), format: 'ne', validity: 'valid-header' },
  { id: 'elf32', name: 'elf-renamed.exe', bytes: elfFixture(), format: 'elf', validity: 'valid-header' },
  { id: 'elf64-big', name: 'elf64-big.bin', bytes: elfFixture(true, false), format: 'elf', validity: 'valid-header' },
  { id: 'zip', name: 'container.docx', bytes: zipFixture(), format: 'zip', validity: 'valid-header' },
  { id: 'iso', name: 'volume.bin', bytes: isoFixture(), format: 'iso9660', validity: 'valid-header' },
  { id: 'mbr', name: 'disk.img', bytes: mbrFixture(), format: 'mbr-disk', validity: 'valid-header' },
  { id: 'gpt', name: 'gpt.img', bytes: gptFixture(), format: 'gpt-disk', validity: 'partial' },
  { id: 'gpt-4k', name: 'gpt-4k.img', bytes: gptFixture(4096), format: 'gpt-disk', validity: 'partial' },
  { id: 'boot-marker', name: 'boot.img', bytes: boot, format: 'disk-image-ambiguous', validity: 'unknown' },
  { id: 'raw-com', name: 'unproven.com', bytes: Uint8Array.of(1, 7, 19, 31, 43), format: 'dos-com-ambiguous', validity: 'unknown' },
  { id: 'misleading-exe', name: 'misleading.exe', bytes: new TextEncoder().encode('This is ordinary text, not an executable.'), format: 'unknown', validity: 'unknown' },
  { id: 'truncated-mz', name: 'short.exe', bytes: Uint8Array.of(0x4d, 0x5a, 0), format: 'dos-mz', validity: 'invalid' },
  { id: 'corrupt-pe-pointer', name: 'bad-pointer.exe', bytes: corruptPe, format: 'dos-mz', validity: 'invalid' },
  { id: 'corrupt-elf', name: 'bad-elf', bytes: corruptElf, format: 'elf', validity: 'invalid' },
  { id: 'truncated-zip', name: 'bad.zip', bytes: zipFixture().slice(0, 40), format: 'zip', validity: 'invalid' },
];
