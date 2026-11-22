import { Block, powerOfTwo, ProbeFault, Report, requireData } from './probe-core';

export async function probeZip(report: Report, head: Block): Promise<void> {
  const reader = report.reader;
  report.format = 'zip';
  report.kind = 'ZIP-based container';
  report.record('ZIP record signature', head, 0, 4, 'A ZIP record marker, not an executable platform.');
  report.ambiguity.push('ZIP can contain software, documents or arbitrary data. Subtype and contained programs are not inferred from the filename.');
  report.warn('ZIP_SCOPE', 'No entries were extracted. Payloads, CRCs, every directory entry and nested content were not validated.', undefined, 'info');
  const local = head.has(0, [0x50, 0x4b, 3, 4]);
  let localEnd = 0, localZip64 = false;
  if (local) {
    head.check(0, 30);
    const flags = head.u16(6), method = head.u16(8), nameLength = head.u16(26), extraLength = head.u16(28);
    requireData(nameLength > 0, 'ZIP_NAME_LENGTH', 'The ZIP local record has no filename field.', 26);
    reader.checkRange(30, nameLength + extraLength);
    localEnd = 30 + nameLength + extraLength;
    localZip64 = head.u32(18) === 0xffffffff || head.u32(22) === 0xffffffff;
    if (!(flags & 8) && !localZip64) {
      reader.checkRange(localEnd, head.u32(18));
      localEnd += head.u32(18);
    }
    report.record('ZIP flags and method', head, 6, 4, `Flags ${flags}; compression method ${method}. No decompression is performed.`);
    if (flags & 1) report.warn('ZIP_ENCRYPTED', 'An encrypted ZIP entry is declared. Its content was not decrypted.', 6);
    if (flags & 8) report.warn('ZIP_DATA_DESCRIPTOR', 'A streamed data descriptor is declared; its contents were not checked.', 6);
  } else if (!head.has(0, [0x50, 0x4b, 5, 6])) {
    throw new ProbeFault('ZIP_FRAGMENT', 'A split/ZIP64/directory marker was found, but a complete ordinary ZIP cannot be established by this probe.', 'partial', 0);
  }
  const tailLength = Math.min(reader.file.size, 65535 + 22);
  const tail = await reader.range(reader.file.size - tailLength, tailLength);
  let end = -1;
  for (let at = tail.bytes.length - 22; at >= 0; at--) {
    if (tail.has(at, [0x50, 0x4b, 5, 6]) && at + 22 + tail.u16(at + 20) === tail.bytes.length) { end = at; break; }
  }
  requireData(end >= 0, 'ZIP_END_MISSING', 'The ZIP end record is missing or truncated. This may be an incomplete archive.', reader.file.size);
  report.record('ZIP end record', tail, end, 4, 'End-of-central-directory signature with a comment length that reaches the file end.');
  const disk = tail.u16(end + 4), centralDisk = tail.u16(end + 6), diskCount = tail.u16(end + 8), count = tail.u16(end + 10);
  const size = tail.u32(end + 12), offset = tail.u32(end + 16), endOffset = tail.offset + end;
  report.record('ZIP entry count', tail, end + 10, 2, `${count} entries declared; this is not an extracted listing.`);
  if (localZip64 || count === 0xffff || diskCount === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    throw new ProbeFault('ZIP64', 'ZIP64 metadata is present. Its extended directory is not resolved by this probe.', 'partial', endOffset);
  }
  if (disk !== 0 || centralDisk !== 0 || diskCount !== count) {
    throw new ProbeFault('ZIP_MULTIVOLUME', 'This ZIP declares multiple volumes. A complete single-file archive has not been established.', 'partial', endOffset);
  }
  requireData(offset + size <= endOffset, 'ZIP_DIRECTORY_RANGE', 'The ZIP central directory overlaps its end record or exceeds the file.', endOffset + 16);
  if (count === 0) {
    requireData(!local && size === 0 && offset === 0 && endOffset === 0, 'ZIP_EMPTY_CONFLICT', 'The ZIP claims to be empty but contains conflicting record metadata.', endOffset);
  } else {
    requireData(local && size >= count * 46 && offset >= localEnd, 'ZIP_DIRECTORY_SIZE', 'The ZIP directory overlaps the first local record or cannot hold its declared entries.', endOffset + 12);
    const central = await reader.range(offset, 46);
    requireData(central.has(0, [0x50, 0x4b, 1, 2]), 'ZIP_DIRECTORY_SIGNATURE', 'The first central-directory record has an invalid ZIP signature.', offset);
    requireData(46 + central.u16(28) + central.u16(30) + central.u16(32) <= size,
      'ZIP_DIRECTORY_RECORD', 'The first ZIP directory record extends beyond the declared directory.', offset + 28);
    const referredOffset = central.u32(42);
    requireData(referredOffset <= offset - 30, 'ZIP_LOCAL_REFERENCE', 'The first directory entry points outside the local-record area.', central.offset + 42);
    const referred = await reader.range(referredOffset, 30);
    requireData(referred.has(0, [0x50, 0x4b, 3, 4]) && referredOffset + 30 + referred.u16(26) + referred.u16(28) <= offset,
      'ZIP_LOCAL_REFERENCE', 'The first directory entry does not point to a bounded ZIP local header.', referredOffset);
    report.record('ZIP central-directory signature', central, 0, 4, 'The first directory record agrees with the end-record location.');
  }
  report.confidence = 'certain-format';
  report.validity = 'valid-header';
}

async function probeIso(report: Report): Promise<boolean> {
  const reader = report.reader;
  let seen = false;
  for (let index = 0; index < 16; index++) {
    const offset = (16 + index) * 2048;
    if (reader.file.size < offset + 7) {
      if (seen) throw new ProbeFault('ISO_TRUNCATED', 'The ISO volume-descriptor sequence ends before a primary descriptor is available.', 'invalid', offset);
      return false;
    }
    const block = await reader.range(offset, Math.min(2048, reader.file.size - offset));
    if (!block.has(1, [0x43, 0x44, 0x30, 0x30, 0x31])) {
      if (seen) throw new ProbeFault('ISO_DESCRIPTOR', 'An ISO descriptor has a missing CD001 identifier.', 'invalid', offset + 1);
      return false;
    }
    seen = true;
    report.format = 'iso9660';
    report.kind = 'ISO 9660 filesystem image';
    report.record('ISO volume descriptor', block, 0, 7, `Descriptor type ${block.u8(0)}, CD001 identifier, version ${block.u8(6)}.`);
    block.check(0, 2048);
    requireData(block.u8(6) === 1, 'ISO_VERSION', 'The ISO descriptor version is not the version handled by this probe.', offset + 6);
    if (block.u8(0) === 255) throw new ProbeFault('ISO_NO_PRIMARY', 'The descriptor terminator appears before a primary volume descriptor.', 'partial', offset);
    if (block.u8(0) !== 1) continue;
    const sectors = block.u32(80), blockSize = block.u16(128), volumeBytes = sectors * blockSize;
    requireData(sectors === block.u32(84, false) && blockSize === block.u16(130, false)
      && powerOfTwo(blockSize) && blockSize >= 512 && blockSize <= 32768
      && volumeBytes >= offset + 2048 && volumeBytes <= reader.file.size,
    'ISO_VOLUME_SIZE', 'The ISO volume size or duplicated byte-order fields are inconsistent with this file.', offset + 80);
    const extent = block.u32(158), rootSize = block.u32(166);
    requireData(block.u8(156) >= 34 && extent === block.u32(162, false) && rootSize === block.u32(170, false)
      && rootSize > 0 && extent * blockSize + rootSize <= volumeBytes,
    'ISO_ROOT_RANGE', 'The ISO root-directory record has inconsistent lengths or lies outside the declared volume.', offset + 156);
    report.record('ISO volume size', block, 80, 8, `${sectors} logical blocks; both byte-order copies agree.`);
    report.record('ISO logical block size', block, 128, 4, `${blockSize} bytes; both byte-order copies agree.`);
    report.confidence = 'certain-format';
    report.validity = 'valid-header';
    report.ambiguity.push('A recognized filesystem image does not prove bootability, OS identity or an executable entrypoint.');
    report.warn('ISO_SCOPE', 'Only selected volume-descriptor and root-record fields were checked. No directories were traversed or mounted.', undefined, 'info');
    return true;
  }
  throw new ProbeFault('ISO_DESCRIPTOR_LIMIT', 'No primary ISO descriptor was found within the 16-descriptor inspection limit.', 'partial');
}

export async function probeDisk(report: Report, head: Block): Promise<boolean> {
  if (await probeIso(report)) return true;
  const reader = report.reader;
  for (const sectorSize of [512, 4096]) {
    if (reader.file.size < sectorSize + 8) continue;
    const signature = await reader.range(sectorSize, 8);
    if (!signature.has(0, [0x45, 0x46, 0x49, 0x20, 0x50, 0x41, 0x52, 0x54])) continue;
    report.format = 'gpt-disk';
    report.kind = 'GPT disk-image candidate';
    report.record('GPT signature', signature, 0, 8, `EFI PART at LBA 1 under a ${sectorSize}-byte sector interpretation.`);
    const header = await reader.range(sectorSize, 92);
    const size = header.u32(12), sectors = BigInt(Math.floor(reader.file.size / sectorSize));
    requireData(size >= 92 && size <= sectorSize && header.u32(20) === 0 && header.u64(24) === 1n
      && header.u64(32) > 1n && header.u64(32) < sectors && header.u64(40) >= 2n
      && header.u64(40) <= header.u64(48) && header.u64(48) < header.u64(32),
    'GPT_HEADER', 'The GPT fixed-header size or LBA fields are inconsistent with this disk image.', sectorSize + 12);
    const count = header.u32(80), entrySize = header.u32(84), entriesLba = header.u64(72);
    requireData(count > 0 && entrySize >= 128 && entrySize % 128 === 0 && entriesLba >= 2n
      && entriesLba * BigInt(sectorSize) + BigInt(count) * BigInt(entrySize) <= header.u64(40) * BigInt(sectorSize),
    'GPT_TABLE_RANGE', 'The GPT partition array does not fit inside this image.', sectorSize + 72);
    report.record('GPT revision', header, 8, 4, `Revision ${header.u32(8)}; no revision-specific extensions are interpreted.`);
    report.record('GPT header length', header, 12, 4, `${size} bytes declared.`);
    report.confidence = 'probable';
    report.validity = 'partial';
    report.ambiguity.push('Sector geometry is inferred from signature placement, not supplied by a physical device.');
    report.warn('GPT_SCOPE', 'GPT CRCs, partition contents and the backup header were not checked. This is a disk signature candidate, not a validated disk or bootable OS.');
    return true;
  }
  if (!head.has(510, [0x55, 0xaa])) return false;
  report.format = 'disk-image-ambiguous';
  report.record('Boot-sector marker', head, 510, 2, '55 AA is shared by multiple boot-sector and partition layouts.');
  let partitions = 0, plausible = true;
  for (let index = 0; index < 4; index++) {
    const at = 446 + index * 16, type = head.u8(at + 4), start = head.u32(at + 8), count = head.u32(at + 12);
    if (type === 0 && start === 0 && count === 0) continue;
    partitions++;
    plausible &&= (head.u8(at) === 0 || head.u8(at) === 0x80) && type > 0 && start > 0 && count > 0
      && (start + count) * 512 <= reader.file.size;
    report.record(`Partition ${index + 1} range`, head, at + 8, 8, `Start LBA ${start}, ${count} sectors, type ${type}; interpreted using 512-byte sectors.`);
  }
  if (partitions > 0 && plausible) {
    report.format = 'mbr-disk';
    report.confidence = 'probable';
    report.validity = 'valid-header';
    report.kind = 'MBR disk-image candidate';
  }
  report.ambiguity.push('A boot marker and plausible partitions do not prove a filesystem, disk geometry or bootable program. Raw IMG has no universal signature.');
  report.warn('DISK_SCOPE', 'Only the boot marker and four primary MBR ranges were examined. FAT filesystems, extended partitions and boot code are not decoded.', undefined, 'info');
  return true;
}
