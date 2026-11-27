import { describe, expect, it } from 'vitest';
import type { FileArtifact } from '../domain/contracts';
import { Block, BoundedReader, PROBE_LIMITS, Report } from './probe-core';
import { blobArtifact } from '../packages/virtual-package';

const signal = () => new AbortController().signal;
function artifact(bytes: Uint8Array<ArrayBuffer>, path = 'PROBE.BIN'): FileArtifact {
  return blobArtifact({ path, blob: new Blob([bytes]), lastModified: 0 }, 'selection');
}

describe('bounded inspection primitives', () => {
  it('rejects truncated numeric reads and out-of-range signatures without throwing DataView errors', () => {
    const block = new Block(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8), 100);
    expect(block.u8(0)).toBe(1);
    expect(block.u16(0)).toBe(0x0201);
    expect(block.u32(0)).toBe(0x04030201);
    expect(block.u64(0)).toBe(0x0807060504030201n);
    expect(block.u16(2, false)).toBe(0x0304);
    expect(() => block.u16(7)).toThrow(expect.objectContaining({ code: 'TRUNCATED_HEADER', offset: 107 }));
    expect(() => block.u32(5)).toThrow(expect.objectContaining({ code: 'TRUNCATED_HEADER' }));
    expect(() => block.u64(1)).toThrow(expect.objectContaining({ code: 'TRUNCATED_HEADER' }));
    expect(block.has(0, [1, 2, 3])).toBe(true);
    expect(block.has(6, [7, 8, 9])).toBe(false);
    expect(block.has(-1, [1])).toBe(false);
    expect(block.has(8, [0])).toBe(false);
  });
  it('reuses a cached range instead of issuing a second host read', async () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i;
    const inner = artifact(bytes);
    let reads = 0;
    const file: FileArtifact = { ...inner, async read(offset, length, abort) {
      reads++;
      return inner.read(offset, length, abort);
    } };
    const reader = new BoundedReader(file, signal());
    const first = await reader.range(0, 64);
    expect(first.u8(10)).toBe(10);
    const nested = await reader.range(8, 16);
    expect(nested.offset).toBe(8);
    expect([...nested.bytes]).toEqual([...first.bytes.subarray(8, 24)]);
    expect(reads).toBe(1);
    expect(reader.operations).toBe(1);
    expect(reader.bytesRead).toBe(64);
  });
  it('maps a short host read to READ_FAILED and an overflowed range to INVALID_OFFSET', async () => {
    const file = artifact(new Uint8Array(32));
    const short: FileArtifact = { ...file, async read() { return new Uint8Array(1); } };
    await expect(new BoundedReader(short, signal()).range(0, 8)).rejects.toMatchObject({ code: 'READ_FAILED' });
    const reader = new BoundedReader(file, signal());
    expect(() => reader.checkRange(16, 32)).toThrow(expect.objectContaining({ code: 'INVALID_OFFSET', offset: 16 }));
    expect(() => reader.checkRange(-1, 1)).toThrow(expect.objectContaining({ code: 'INVALID_OFFSET' }));
    await expect(reader.range(30, 8)).rejects.toMatchObject({ code: 'INVALID_OFFSET' });
  });
  it('stops a multi-chunk range on abort without counting a cancelled remainder', async () => {
    const controller = new AbortController();
    const file = artifact(new Uint8Array(PROBE_LIMITS.range * 2));
    let reads = 0;
    const observed: FileArtifact = { ...file, async read(offset, length, abort) {
      const part = await file.read(offset, length, abort);
      reads++;
      if (reads === 1) controller.abort();
      return part;
    } };
    await expect(new BoundedReader(observed, controller.signal).range(0, PROBE_LIMITS.range + 1)).rejects.toThrow();
    expect(reads).toBe(1);
  });
  it('caps published evidence and never records a truncated window', () => {
    const reader = new BoundedReader(artifact(new Uint8Array(32)), signal());
    const report = new Report(reader);
    const block = new Block(new Uint8Array(32), 0);
    for (let i = 0; i < PROBE_LIMITS.evidence + 8; i++) report.record('field', block, 0, 4, 'unit');
    expect(report.evidence).toHaveLength(PROBE_LIMITS.evidence);
    expect(report.evidence.every(item => item.length === 4 && item.hex.split(' ').length === 4)).toBe(true);
    expect(() => report.record('overflow', block, 30, 4, 'unit')).toThrow();
    const finished = report.finish();
    expect(finished.executableCompatibility).toBe('not-assessed');
    expect(finished.notInferred).toHaveLength(5);
    expect(finished.evidence).toHaveLength(PROBE_LIMITS.evidence);
  });
});
