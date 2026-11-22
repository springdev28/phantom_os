import { Block, hexNumber, powerOfTwo, ProbeFault, Report, requireData } from './probe-core';

const PE_MACHINES: Readonly<Record<number, string>> = {
  0x14c: 'x86', 0x8664: 'x86-64', 0x1c0: 'ARM', 0x1c2: 'ARM Thumb',
  0x1c4: 'ARM Thumb-2', 0xaa64: 'ARM64', 0x200: 'Itanium',
  0x5032: 'RISC-V 32', 0x5064: 'RISC-V 64', 0x6264: 'LoongArch 64',
};
const PE_SUBSYSTEMS: Readonly<Record<number, string>> = {
  0: 'Unknown', 1: 'Native (driver or native process)', 2: 'Windows GUI', 3: 'Windows console',
  5: 'OS/2 console', 7: 'POSIX console', 8: 'Native Windows 9x driver', 9: 'Windows CE GUI',
  10: 'EFI application', 11: 'EFI boot-service driver', 12: 'EFI runtime driver', 13: 'EFI ROM',
  14: 'Xbox', 16: 'Windows boot application',
};

export async function probeMz(report: Report, head: Block): Promise<void> {
  const reader = report.reader;
  report.format = 'dos-mz';
  report.record('MZ signature', head, 0, 2, 'DOS MZ header; this can also be a stub for another executable format.');
  head.check(0, 28);
  const last = head.u16(2), pages = head.u16(4), relocations = head.u16(6);
  const headerSize = head.u16(8) * 16;
  const imageSize = (pages - 1) * 512 + (last || 512);
  report.record('DOS image length', head, 2, 4, `${pages} pages, ${last} bytes in the final page; declared DOS image ${imageSize} bytes.`);
  report.record('DOS header size', head, 8, 2, `${headerSize} bytes, in 16-byte paragraphs.`);
  requireData(pages > 0 && last < 512 && headerSize >= 28 && headerSize <= imageSize && imageSize <= reader.file.size,
    'MZ_SIZE', 'The MZ page count, header size or declared image length is inconsistent with this file.', 2);
  if (relocations > 0) {
    const start = head.u16(24);
    requireData(start >= 28 && start + relocations * 4 <= headerSize,
      'MZ_RELOCATIONS', 'The DOS relocation table does not fit inside its header.', 24);
  }
  // Old DOS headers may be only 28/32 bytes: offset 0x3c would then be program data.
  // Original MZ linkers can place relocation entries at 0x3c (e.g. FreeCOM).
  // Those bytes are not the later Windows e_lfanew extension. Never interpret
  // a relocation record as a pointer merely because the padded header is large.
  const relocationStart = head.u16(24);
  const relocationOverlapsPointer = relocations > 0 && relocationStart < 64 && relocationStart + relocations * 4 > 60;
  if (relocationOverlapsPointer) report.record('Legacy DOS relocation layout', head, 24, 2,
    'The relocation table covers offset 0x3c; these bytes are relocation records, not a declared secondary-header pointer.');
  if (headerSize >= 64 && !relocationOverlapsPointer) {
    const extended = head.bytes.length >= 64 ? head : await reader.range(0, 64);
    const next = extended.u32(60);
    report.record('Secondary-header pointer', extended, 60, 4, `File offset ${hexNumber(next)}; zero means none declared.`);
    if (next !== 0) {
      requireData(next >= 64, 'MZ_SECONDARY_OFFSET', 'The secondary-header pointer overlaps the DOS header.', 60);
      const signature = await reader.range(next, 4);
      if (signature.has(0, [0x50, 0x45, 0, 0])) { await probePe(report, next); return; }
      if (signature.has(0, [0x4e, 0x45])) { await probeNe(report, next); return; }
      report.record('Unrecognized secondary header', signature, 0, 4, 'This is not a PE or NE signature handled by this probe.');
      if (signature.has(0, [0x4c, 0x45]) || signature.has(0, [0x4c, 0x58])) {
        report.ambiguity.push('An LE/LX extended executable follows the DOS stub. Its target is not parsed.');
        throw new ProbeFault('EXTENDED_MZ', 'LE/LX headers are outside this probe. The DOS stub is not evidence of DOS application compatibility.', 'partial', next);
      }
      throw new ProbeFault('MZ_SECONDARY_SIGNATURE', 'The declared secondary header has an unrecognized signature; it may be corrupt or an unhandled MZ variant.', 'partial', next);
    }
  }
  report.architecture = 'x86 (DOS header; CPU generation unknown)';
  report.bitness = 16;
  report.endianness = 'little';
  report.kind = 'DOS image or stub';
  report.confidence = 'certain-format';
  report.validity = 'valid-header';
  report.ambiguity.push('An MZ header may wrap a DOS extender, overlay or another payload. DOS execution is not established.');
  if (imageSize < reader.file.size) report.warn('MZ_TRAILING_DATA', 'Bytes follow the declared DOS image. Overlay or embedded content was not inspected.', imageSize);
}

async function probePe(report: Report, start: number): Promise<void> {
  const reader = report.reader;
  const coff = await reader.range(start, 24);
  report.record('PE signature', coff, 0, 4, 'Portable Executable signature.');
  const machine = coff.u16(4), count = coff.u16(6), optionalSize = coff.u16(20), flags = coff.u16(22);
  report.record('COFF machine', coff, 4, 2, PE_MACHINES[machine] ?? `Unmapped machine ${hexNumber(machine)}.`);
  requireData(optionalSize >= 2, 'PE_OPTIONAL_SIZE', 'The PE image is missing its optional header.', start + 20);
  if (optionalSize > 4096) throw new ProbeFault('PE_HEADER_LIMIT', 'This unusually large PE optional header exceeds the probe policy.', 'partial', start + 20);
  const optional = await reader.range(start + 24, optionalSize);
  const magic = optional.u16(0);
  report.record('Optional-header magic', optional, 0, 2, magic === 0x10b ? 'PE32' : magic === 0x20b ? 'PE32+' : 'Not a PE32/PE32+ image header.');
  requireData(magic === 0x10b || magic === 0x20b, 'PE_MAGIC', 'The optional-header magic is not PE32 or PE32+.', start + 24);
  report.format = magic === 0x10b ? 'pe32' : 'pe32+';
  report.bitness = magic === 0x10b ? 32 : 64;
  report.endianness = 'little';
  report.architecture = PE_MACHINES[machine] ?? `Unmapped machine ${hexNumber(machine)}`;
  const baseSize = magic === 0x10b ? 96 : 112;
  optional.check(0, baseSize);
  requireData(count > 0 && count <= 96, 'PE_SECTIONS', 'The PE section count must be between 1 and 96 for this image probe.', start + 6);
  requireData((flags & 2) !== 0, 'PE_IMAGE_FLAG', 'The COFF header does not mark this as an executable image.', start + 22);
  requireData(!((machine === 0x14c || machine === 0x1c0 || machine === 0x1c4) && magic !== 0x10b)
    && !((machine === 0x8664 || machine === 0xaa64 || machine === 0x200) && magic !== 0x20b),
  'PE_MACHINE_KIND', 'The PE machine and optional-header kind contradict one another.', start + 4);
  const directories = optional.u32(baseSize - 4);
  requireData(directories <= Math.floor((optionalSize - baseSize) / 8), 'PE_DIRECTORIES',
    'The declared data-directory entries do not fit in the PE optional header.', optional.offset + baseSize - 4);
  const sectionAlignment = optional.u32(32), fileAlignment = optional.u32(36);
  const imageSize = optional.u32(56), headersSize = optional.u32(60);
  const tableStart = start + 24 + optionalSize;
  requireData(powerOfTwo(sectionAlignment) && powerOfTwo(fileAlignment)
    && (sectionAlignment < 4096 ? fileAlignment === sectionAlignment
      : fileAlignment >= 512 && fileAlignment <= 65536 && sectionAlignment >= fileAlignment),
  'PE_ALIGNMENT', 'The PE file/section alignment fields are inconsistent.', optional.offset + 32);
  requireData(headersSize >= tableStart + count * 40 && headersSize <= reader.file.size && headersSize % fileAlignment === 0
    && imageSize >= headersSize && imageSize % sectionAlignment === 0 && optional.u32(16) < imageSize,
  'PE_IMAGE_SIZE', 'The PE header/image sizes are inconsistent with its section table or alignment.', optional.offset + 56);
  const sections = await reader.range(tableStart, count * 40);
  for (let index = 0; index < count; index++) {
    const at = index * 40;
    const virtualSize = sections.u32(at + 8), address = sections.u32(at + 12);
    const rawSize = sections.u32(at + 16), rawOffset = sections.u32(at + 20);
    requireData(address % sectionAlignment === 0 && address + Math.max(virtualSize, rawSize) <= imageSize,
      'PE_SECTION_VIRTUAL_RANGE', 'A PE section extends outside the declared virtual image.', tableStart + at + 8);
    if (rawSize > 0) {
      requireData(rawOffset >= headersSize && rawOffset % fileAlignment === 0 && rawSize % fileAlignment === 0,
        'PE_SECTION_RAW_RANGE', 'A PE section has an invalid raw-file offset or size.', tableStart + at + 16);
      reader.checkRange(rawOffset, rawSize);
    }
  }
  const subsystem = optional.u16(68);
  report.subsystem = PE_SUBSYSTEMS[subsystem] ?? `Unmapped subsystem ${subsystem}`;
  report.kind = flags & 0x2000 ? 'DLL image' : 'Executable image';
  report.record('Section table', coff, 6, 2, `${count} section headers checked for bounded raw and virtual ranges.`);
  report.record('PE subsystem', optional, 68, 2, report.subsystem);
  report.record('Entry-point RVA', optional, 16, 4, `${hexNumber(optional.u32(16))}; code at this address has not been executed.`);
  report.record('Image characteristics', coff, 22, 2, report.kind);
  report.confidence = 'certain-format';
  report.validity = 'valid-header';
  report.ambiguity.push('PE kind, machine and subsystem are separate declarations; PE32 does not by itself mean a Windows desktop application.');
  report.warn('PE_SCOPE', 'Imports, resources, signatures, managed-code metadata and section contents were not validated. Header OS-version fields do not establish practical OS requirements.', undefined, 'info');
}

async function probeNe(report: Report, start: number): Promise<void> {
  const reader = report.reader;
  report.format = 'ne';
  const header = await reader.range(start, 64);
  report.record('NE signature', header, 0, 2, 'New Executable segmented header; target OS is a separate field.');
  const target = header.u8(54), segments = header.u16(28), shift = header.u16(50) || 9;
  const targets: Readonly<Record<number, string>> = { 1: 'OS/2', 2: 'Windows', 3: 'DOS 4.x', 4: 'Windows/386' };
  report.platform = targets[target] ? `${targets[target]} (declared NE target)` : `Unmapped NE target ${target}`;
  report.bitness = 16;
  report.endianness = 'little';
  report.kind = 'Segmented image';
  report.record('NE target OS', header, 54, 1, report.platform);
  report.record('NE segment count', header, 28, 2, `${segments} segment records.`);
  report.ambiguity.push('NE target metadata is not proof of Win16/OS/2 execution; CPU generation and dependencies remain unresolved.');
  requireData(shift <= 15, 'NE_ALIGNMENT', 'The NE segment alignment shift is outside this probe’s accepted range.', start + 50);
  for (const [offsetAt, length] of [[4, header.u16(6)], [34, segments * 8], [40, header.u16(30) * 2]] as const) {
    if (!length) continue;
    const relative = header.u16(offsetAt);
    requireData(relative >= 64, 'NE_TABLE_OFFSET', 'An NE table overlaps its fixed header.', start + offsetAt);
    reader.checkRange(start + relative, length);
  }
  if (header.u16(32)) reader.checkRange(header.u32(44), header.u16(32));
  if (segments > 256) throw new ProbeFault('NE_SEGMENT_LIMIT', 'More than 256 NE segments were declared. Segment contents remain unvalidated under the bounded probe policy.', 'partial', start + 28);
  if (segments) {
    const table = await reader.range(start + header.u16(34), segments * 8);
    for (let index = 0; index < segments; index++) {
      const sector = table.u16(index * 8), size = table.u16(index * 8 + 2) || 65536;
      if (sector) reader.checkRange(sector * 2 ** shift, size);
    }
  }
  report.confidence = 'probable';
  report.validity = 'valid-header';
  report.warn('NE_SCOPE', 'Only the fixed NE header and selected table/segment bounds were checked; resources, entry bundles and relocations were not decoded.', undefined, 'info');
}

export function probeElf(report: Report, head: Block): void {
  report.format = 'elf';
  report.record('ELF signature', head, 0, 4, 'Executable and Linkable Format; not specific to Linux.');
  head.check(0, 16);
  const cls = head.u8(4), data = head.u8(5);
  requireData((cls === 1 || cls === 2) && (data === 1 || data === 2) && head.u8(6) === 1,
    'ELF_IDENT', 'The ELF class, byte order or identification version is invalid.', 4);
  const little = data === 1, wide = cls === 2, size = wide ? 64 : 52;
  head.check(0, size);
  report.bitness = wide ? 64 : 32;
  report.endianness = little ? 'little' : 'big';
  const machine = head.u16(18, little), type = head.u16(16, little), abi = head.u8(7);
  const machines: Readonly<Record<number, string>> = { 3: 'x86', 8: 'MIPS', 20: 'PowerPC', 21: 'PowerPC64', 40: 'ARM', 62: 'x86-64', 183: 'ARM64', 243: 'RISC-V' };
  const kinds: Readonly<Record<number, string>> = { 0: 'Unspecified ELF type', 1: 'Relocatable object', 2: 'Executable image', 3: 'Shared object / position-independent image', 4: 'Core dump' };
  const abis: Readonly<Record<number, string>> = { 0: 'System V ABI (OS unspecified)', 3: 'GNU/Linux ABI declaration', 6: 'Solaris ABI declaration', 9: 'FreeBSD ABI declaration' };
  report.architecture = machines[machine] ?? `Unmapped machine ${machine}`;
  report.kind = kinds[type] ?? `OS/processor-specific or unassigned type ${hexNumber(type)}`;
  report.platform = abis[abi] ?? `Unmapped OS ABI ${abi}`;
  report.record('ELF class and byte order', head, 4, 2, `${report.bitness}-bit, ${report.endianness}-endian.`);
  report.record('ELF machine', head, 18, 2, report.architecture);
  report.record('ELF object type', head, 16, 2, report.kind);
  report.record('ELF OS ABI', head, 7, 1, report.platform);
  const sizeAt = wide ? 52 : 40;
  requireData(head.u32(20, little) === 1 && head.u16(sizeAt, little) === size,
    'ELF_HEADER_SIZE', 'The ELF version or fixed header size does not match its declared class.', sizeAt);
  const phCount = head.u16(sizeAt + 4, little), shCount = head.u16(sizeAt + 8, little);
  const phOffset = wide ? head.u64(32, little) : BigInt(head.u32(28, little));
  const shOffset = wide ? head.u64(40, little) : BigInt(head.u32(32, little));
  if (phCount === 0xffff || (shCount === 0 && shOffset !== 0n) || head.u16(sizeAt + 10, little) === 0xffff) {
    throw new ProbeFault('ELF_EXTENDED_COUNTS', 'ELF extended table numbering is recognized but not resolved by this header-only probe.', 'partial', sizeAt + 4);
  }
  for (const [offset, count, entrySize, requiredSize] of [
    [phOffset, phCount, head.u16(sizeAt + 2, little), wide ? 56 : 32],
    [shOffset, shCount, head.u16(sizeAt + 6, little), wide ? 64 : 40],
  ] as const) {
    if (!count) continue;
    requireData(entrySize === requiredSize && offset >= BigInt(size)
      && offset + BigInt(count) * BigInt(entrySize) <= BigInt(report.reader.file.size),
    'ELF_TABLE_RANGE', 'An ELF table has an invalid offset, entry size or count for this file.', sizeAt);
  }
  report.confidence = 'certain-format';
  report.validity = 'valid-header';
  report.ambiguity.push('ELF is used by multiple operating systems. The ABI field does not establish a usable kernel, interpreter or library environment.');
  report.warn('ELF_SCOPE', 'Program/section table contents, interpreter paths and dynamic dependencies were not decoded.', undefined, 'info');
}
