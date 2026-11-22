import { Inflate } from 'fflate';
import { AppError } from '../domain/errors';
import { PACKAGE_LIMITS as limits } from './limits';
import { PathIndex } from './paths';
import { Crc32 } from './crc32';
import type { PackageBlob, PackageContents } from './virtual-package';

export interface ImportProgress { readonly phase: 'validating' | 'extracting'; readonly completed: number; readonly total: number; }
interface Entry {
  path: string; name: Uint8Array; directory: boolean; flags: number; method: number;
  crc: number; compressed: number; size: number; local: number; data: number; end: number;
}
const invalid = () => new AppError('ZIP_INVALID');
function check(condition: boolean): asserts condition { if (!condition) throw invalid(); }
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, i) => value === b[i]);

async function read(blob: Blob, offset: number, length: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  signal.throwIfAborted();
  check(Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0
    && length <= limits.zipDirectoryBytes && offset <= blob.size - length);
  const bytes = new Uint8Array(length);
  for (let at = 0; at < length; at += 65536) {
    const size = Math.min(65536, length - at);
    try {
      const part = await blob.slice(offset + at, offset + at + size).arrayBuffer();
      signal.throwIfAborted();
      check(part.byteLength === size);
      bytes.set(new Uint8Array(part), at);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof AppError) throw error;
      throw new AppError('READ_FAILED');
    }
  }
  return bytes;
}

function decodeName(bytes: Uint8Array, flags: number): string {
  // ASCII legacy names are lossless. Non-ASCII legacy encodings need explicit local conversion.
  if (!(flags & 0x800) && bytes.some(byte => byte > 127)) throw new AppError('ZIP_ENCODING');
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new AppError('ZIP_ENCODING'); }
}
function checkExtra(extra: Uint8Array, name: Uint8Array, decoded: string): void {
  const data = view(extra);
  for (let at = 0; at < extra.length;) {
    check(at + 4 <= extra.length);
    const id = data.getUint16(at, true), length = data.getUint16(at + 2, true);
    check(at + 4 + length <= extra.length);
    if ([0x0001, 0x9901, 0x000c, 0x000d, 0x756e].includes(id)) throw new AppError('ZIP_UNSUPPORTED');
    if (id === 0x7075) {
      check(length >= 5 && extra[at + 4] === 1);
      const crc = new Crc32(); crc.update(name);
      if (data.getUint32(at + 5, true) !== crc.value()
        || decodeName(extra.subarray(at + 9, at + 4 + length), 0x800) !== decoded) throw new AppError('ZIP_ENCODING');
    }
    at += 4 + length;
  }
}

/** Validate every central and local record before producing any decompressed bytes. */
async function directory(blob: Blob, signal: AbortSignal, progress: (value: ImportProgress) => void) {
  if (blob.size > limits.fileBytes) throw new AppError('FILE_TOO_LARGE');
  check(blob.size >= 22);
  const tail = await read(blob, Math.max(0, blob.size - 65557), Math.min(blob.size, 65557), signal), tailView = view(tail);
  let end = -1;
  for (let at = tail.length - 22; at >= 0; at--) {
    if (tailView.getUint32(at, true) === 0x06054b50 && at + 22 + tailView.getUint16(at + 20, true) === tail.length) { end = at; break; }
  }
  check(end >= 0);
  const count = tailView.getUint16(end + 10, true), length = tailView.getUint32(end + 12, true), start = tailView.getUint32(end + 16, true);
  if (count === 0xffff || length === 0xffffffff || start === 0xffffffff
    || tailView.getUint16(end + 4, true) !== 0 || tailView.getUint16(end + 6, true) !== 0
    || tailView.getUint16(end + 8, true) !== count) throw new AppError('ZIP_UNSUPPORTED');
  if (count > limits.entries || length > limits.zipDirectoryBytes) throw new AppError('PACKAGE_LIMIT');
  const endOffset = blob.size - tail.length + end;
  check(start + length === endOffset && length >= count * 46);
  if (!count) { check(length === 0 && start === 0); throw new AppError('EMPTY_PACKAGE'); }
  const central = await read(blob, start, length, signal), data = view(central);
  const entries: Entry[] = [], paths = new PathIndex();
  let at = 0, total = 0;
  for (let index = 0; index < count; index++) {
    signal.throwIfAborted();
    check(at + 46 <= length && data.getUint32(at, true) === 0x02014b50);
    const flags = data.getUint16(at + 8, true), method = data.getUint16(at + 10, true);
    const nameLength = data.getUint16(at + 28, true), extraLength = data.getUint16(at + 30, true), commentLength = data.getUint16(at + 32, true);
    if (data.getUint16(at + 6, true) > 20 || (flags & ~0x080e) || ![0, 8].includes(method)
      || data.getUint16(at + 34, true) !== 0) throw new AppError('ZIP_UNSUPPORTED');
    if (nameLength > limits.pathBytes || extraLength > limits.zipExtraBytes || commentLength > limits.zipExtraBytes) throw new AppError('PACKAGE_LIMIT');
    const next = at + 46 + nameLength + extraLength + commentLength;
    check(nameLength > 0 && next <= length);
    const name = central.slice(at + 46, at + 46 + nameLength), decoded = decodeName(name, flags);
    checkExtra(central.subarray(at + 46 + nameLength, at + 46 + nameLength + extraLength), name, decoded);
    const attributes = data.getUint32(at + 38, true), mode = (attributes >>> 16) & 0xf000;
    const isDirectory = decoded.endsWith('/');
    if (mode !== 0 && mode !== 0x8000 && mode !== 0x4000) throw new AppError('ZIP_UNSUPPORTED');
    check(!(mode === 0x4000 || (attributes & 0x10)) || isDirectory);
    check(!(isDirectory && mode === 0x8000));
    const path = paths.add(isDirectory ? decoded.slice(0, -1) : decoded, isDirectory);
    const compressed = data.getUint32(at + 20, true), size = data.getUint32(at + 24, true), local = data.getUint32(at + 42, true);
    if ([compressed, size, local].includes(0xffffffff)) throw new AppError('ZIP_UNSUPPORTED');
    if (size > limits.fileBytes || compressed > limits.fileBytes || (total += size) > limits.totalBytes) throw new AppError('PACKAGE_LIMIT');
    if (size > Math.max(1, compressed) * limits.expansionRatio) throw new AppError('ZIP_RATIO');
    check(!isDirectory || size === 0);
    check(method !== 0 || compressed === size);
    check(method !== 8 || compressed > 0);
    check(local + 30 <= start);
    entries.push({ path, name, directory: isDirectory, flags, method, crc: data.getUint32(at + 16, true), compressed, size, local, data: 0, end: 0 });
    at = next;
  }
  check(at === length);
  entries.sort((a, b) => a.local - b.local);
  let previousEnd = 0;
  for (const [index, entry] of entries.entries()) {
    check(entry.local === previousEnd); // No overlapping entries, prepended executable or hidden local records.
    const header = await read(blob, entry.local, 30, signal), local = view(header);
    check(local.getUint32(0, true) === 0x04034b50 && local.getUint16(6, true) === entry.flags && local.getUint16(8, true) === entry.method);
    if (local.getUint16(4, true) > 20) throw new AppError('ZIP_UNSUPPORTED');
    const nameLength = local.getUint16(26, true), extraLength = local.getUint16(28, true);
    check(nameLength === entry.name.length);
    if (extraLength > limits.zipExtraBytes) throw new AppError('PACKAGE_LIMIT');
    const fields = await read(blob, entry.local + 30, nameLength + extraLength, signal);
    check(equal(fields.subarray(0, nameLength), entry.name));
    checkExtra(fields.subarray(nameLength), entry.name, decodeName(entry.name, entry.flags));
    for (const [offset, expected] of [[14, entry.crc], [18, entry.compressed], [22, entry.size]] as const) {
      const actual = local.getUint32(offset, true);
      check(actual === expected || Boolean((entry.flags & 8) && actual === 0));
    }
    entry.data = entry.local + 30 + fields.length;
    entry.end = entry.data + entry.compressed;
    check(entry.end <= start);
    if (entry.flags & 8) {
      const prefix = view(await read(blob, entry.end, 4, signal));
      const signatureSize = prefix.getUint32(0, true) === 0x08074b50 ? 4 : 0;
      const descriptor = view(await read(blob, entry.end + signatureSize, 12, signal));
      check(descriptor.getUint32(0, true) === entry.crc && descriptor.getUint32(4, true) === entry.compressed && descriptor.getUint32(8, true) === entry.size);
      entry.end += signatureSize + 12;
    }
    check(entry.end <= start);
    previousEnd = entry.end;
    progress({ phase: 'validating', completed: index + 1, total: count });
  }
  check(previousEnd === start);
  return { entries, directories: paths.directories() };
}

/** Stored/Deflate ZIP only. No filesystem writes, recursive extraction, scripts or library workers. */
export async function extractZip(blob: Blob, signal: AbortSignal,
  progress: (value: ImportProgress) => void = () => {}): Promise<PackageContents> {
  const validated = await directory(blob, signal, progress);
  const files: PackageBlob[] = [];
  let total = 0;
  for (const [index, entry] of validated.entries.entries()) {
    signal.throwIfAborted();
    const crc = new Crc32(), parts: Blob[] = [];
    let actual = 0;
    const accept = (bytes: Uint8Array) => {
      actual += bytes.length; total += bytes.length;
      if (actual > entry.size || actual > limits.fileBytes || total > limits.totalBytes) throw new AppError('PACKAGE_LIMIT');
      if (actual > Math.max(1, entry.compressed) * limits.expansionRatio) throw new AppError('ZIP_RATIO');
      crc.update(bytes);
      // Freeze bounded output chunks as Blobs; do not concatenate the entire archive in RAM.
      if (bytes.length) parts.push(new Blob([bytes as Uint8Array<ArrayBuffer>]));
    };
    const inflater = entry.method === 8 ? new Inflate(accept) : undefined;
    try {
      for (let offset = 0; offset < entry.compressed; offset += limits.compressedChunkBytes) {
        signal.throwIfAborted();
        const size = Math.min(limits.compressedChunkBytes, entry.compressed - offset);
        const chunk = await read(blob, entry.data + offset, size, signal);
        if (inflater) inflater.push(chunk, offset + size === entry.compressed);
        else accept(chunk);
      }
      if (inflater && !entry.compressed) inflater.push(new Uint8Array(), true);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof AppError) throw error;
      throw invalid();
    }
    check(actual === entry.size && crc.value() === entry.crc);
    if (!entry.directory) files.push({ path: entry.path, blob: new Blob(parts), lastModified: 0 });
    progress({ phase: 'extracting', completed: index + 1, total: validated.entries.length });
  }
  signal.throwIfAborted();
  if (!files.length) throw new AppError('EMPTY_PACKAGE');
  return { files, directories: validated.directories };
}
