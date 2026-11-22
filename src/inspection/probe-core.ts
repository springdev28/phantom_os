import type { FileArtifact, ProbeDiagnostic, ProbeEvidence, ProbeResult } from '../domain/contracts';
import { AppError } from '../domain/errors';

export const PROBE_LIMITS = Object.freeze({ bytes: 1024 * 1024, range: 64 * 1024, reads: 32, evidence: 64 });
export const NOT_INFERRED = Object.freeze([
  'Required OS version: not established by these header checks.',
  'Runtime libraries and companion files: not resolved or checked for availability.',
  'Valid guest environment: no operating system, loader or runtime has been exercised.',
  'DRM, licensing checks and copy protection: not determined.',
  'Successful application startup: not tested; no selected code was executed.',
]);

export class ProbeFault extends Error {
  constructor(readonly code: string, message: string, readonly validity: 'invalid' | 'partial', readonly offset?: number) {
    super(message);
  }
}
export function requireData(condition: boolean, code: string, message: string, offset?: number): asserts condition {
  if (!condition) throw new ProbeFault(code, message, 'invalid', offset);
}

/** A checked local range. Numeric access never relies on unchecked DataView reads. */
export class Block {
  readonly view: DataView;
  constructor(readonly bytes: Uint8Array, readonly offset: number) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  check(at: number, length: number): void {
    requireData(Number.isSafeInteger(at) && at >= 0 && length >= 0 && at <= this.bytes.length - length,
      'TRUNCATED_HEADER', 'The header ends before all required fields are present.', this.offset + at);
  }
  u8(at: number): number { this.check(at, 1); return this.view.getUint8(at); }
  u16(at: number, little = true): number { this.check(at, 2); return this.view.getUint16(at, little); }
  u32(at: number, little = true): number { this.check(at, 4); return this.view.getUint32(at, little); }
  u64(at: number, little = true): bigint { this.check(at, 8); return this.view.getBigUint64(at, little); }
  has(at: number, signature: readonly number[]): boolean {
    return at >= 0 && at <= this.bytes.length - signature.length
      && signature.every((byte, index) => this.bytes[at + index] === byte);
  }
}

export class BoundedReader {
  bytesRead = 0;
  operations = 0;
  readonly #cache: Block[] = [];
  constructor(readonly file: FileArtifact, readonly signal: AbortSignal) {}
  checkRange(offset: number, length: number): void {
    requireData(Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0
      && offset <= this.file.size - length, 'INVALID_OFFSET',
    'A declared header or data range extends outside the selected file.', offset);
  }
  async range(offset: number, length: number): Promise<Block> {
    this.signal.throwIfAborted();
    this.checkRange(offset, length);
    const cached = this.#cache.find(block => offset >= block.offset && offset + length <= block.offset + block.bytes.length);
    if (cached) return new Block(cached.bytes.subarray(offset - cached.offset, offset - cached.offset + length), offset);
    if (length > PROBE_LIMITS.bytes - this.bytesRead || this.operations + Math.ceil(length / PROBE_LIMITS.range) > PROBE_LIMITS.reads) {
      throw new ProbeFault('PROBE_LIMIT', 'Inspection stopped at its read budget. The remaining structure was not validated.', 'partial', offset);
    }
    const bytes = new Uint8Array(length);
    for (let at = 0; at < length; at += PROBE_LIMITS.range) {
      this.signal.throwIfAborted();
      const size = Math.min(PROBE_LIMITS.range, length - at);
      const part = await this.file.read(offset + at, size, this.signal);
      this.signal.throwIfAborted();
      if (part.length !== size) throw new AppError('READ_FAILED');
      bytes.set(part, at);
      this.bytesRead += size;
      this.operations++;
    }
    const block = new Block(bytes, offset);
    this.#cache.push(block);
    return block;
  }
}

export class Report {
  format: ProbeResult['format'] = 'unknown';
  confidence: ProbeResult['confidence'] = 'ambiguous';
  validity: ProbeResult['validity'] = 'unknown';
  architecture?: string;
  bitness?: 16 | 32 | 64;
  endianness?: 'little' | 'big';
  subsystem?: string;
  platform?: string;
  kind?: string;
  readonly evidence: ProbeEvidence[] = [];
  readonly warnings: ProbeDiagnostic[] = [];
  readonly ambiguity: string[] = [];
  constructor(readonly reader: BoundedReader) {}
  record(label: string, block: Block, at: number, length: number, interpretation: string): void {
    block.check(at, length);
    if (this.evidence.length >= PROBE_LIMITS.evidence) return;
    // Evidence fields are small, numeric/hex and rendered as text, never HTML.
    const shown = Math.min(length, 16);
    this.evidence.push({ label, offset: block.offset + at, length: shown,
      hex: [...block.bytes.subarray(at, at + shown)].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '), interpretation });
  }
  warn(code: string, message: string, offset?: number, severity: ProbeDiagnostic['severity'] = 'warning'): void {
    if (this.warnings.length < 32) this.warnings.push({ code, message, severity, ...(offset === undefined ? {} : { offset }) });
  }
  finish(): ProbeResult {
    return {
      scope: 'static-inspection', format: this.format, fileSize: this.reader.file.size,
      confidence: this.confidence, validity: this.validity, evidence: this.evidence,
      warnings: this.warnings, ambiguity: this.ambiguity,
      ...(this.architecture ? { architecture: this.architecture } : {}),
      ...(this.bitness ? { bitness: this.bitness } : {}),
      ...(this.endianness ? { endianness: this.endianness } : {}),
      ...(this.subsystem ? { subsystem: this.subsystem } : {}),
      ...(this.platform ? { platform: this.platform } : {}),
      ...(this.kind ? { kind: this.kind } : {}),
      localAccess: this.reader.operations ? 'readable' : 'not-checked',
      notInferred: NOT_INFERRED, executableCompatibility: 'not-assessed',
      readStats: { bytesRead: this.reader.bytesRead, operations: this.reader.operations,
        budgetBytes: PROBE_LIMITS.bytes, rangeLimitBytes: PROBE_LIMITS.range },
    };
  }
}
export const hexNumber = (value: number): string => `0x${value.toString(16).toUpperCase()}`;
export const powerOfTwo = (value: number): boolean => value > 0 && Number.isInteger(Math.log2(value));
