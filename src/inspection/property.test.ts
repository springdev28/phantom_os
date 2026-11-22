import { describe, expect, it } from 'vitest';
import { blobArtifact } from '../packages/virtual-package';
import { probeFile } from './selection-inspector';
import { PROBE_LIMITS } from './probe-core';
import { extractZip } from '../packages/zip';
import { PACKAGE_LIMITS } from '../packages/limits';
import { elfFixture, mzFixture, neFixture, peFixture } from '../../tests/fixtures/probe-fixtures';
import { packageZip } from '../../tests/fixtures/package-fixtures';

// Fixed seeds make failures replayable without adding a random-test dependency.
const seeds = [1, 0x12345678, 0xc0ffee, 0xffffffff];
const random = (initial: number) => { let state = initial; return () => state = (Math.imul(state, 1664525) + 1013904223) >>> 0; };
const signal = () => new AbortController().signal;
describe('seeded input invariants (not an exhaustive fuzzer)', () => {
  it.each(seeds)('header mutations/truncations never exceed reads, mutate input or claim execution; seed %i', async seed => {
    const next = random(seed), bases = [mzFixture(), peFixture(), peFixture(true), neFixture(), elfFixture(), elfFixture(true)];
    for (let i = 0; i < 128; i++) {
      const base = bases[next() % bases.length]!, bytes = base.slice(0, 1 + next() % base.length);
      for (let n = 0; n < 4; n++) bytes[next() % bytes.length] = next() & 255;
      const before = bytes.slice(), original = blobArtifact({ path: 'MISLEAD.EXE', blob: new Blob([bytes]), lastModified: 0 }, 'selection');
      let total = 0, reads = 0;
      const result = await probeFile({ ...original, async read(offset, length, abort) {
        expect(offset).toBeGreaterThanOrEqual(0); expect(length).toBeLessThanOrEqual(PROBE_LIMITS.range);
        expect(offset + length).toBeLessThanOrEqual(bytes.length); total += length; reads++;
        expect(total).toBeLessThanOrEqual(PROBE_LIMITS.bytes); expect(reads).toBeLessThanOrEqual(PROBE_LIMITS.reads);
        return original.read(offset, length, abort);
      } }, signal());
      expect(result.executableCompatibility).toBe('not-assessed'); expect(result.evidence.length).toBeLessThanOrEqual(64);
      expect(result.readStats.bytesRead).toBe(total); expect(bytes).toEqual(before);
    }
  });
  it.each(seeds)('stored/deflated packages retain every byte without exceeding aggregate bounds; seed %i', async seed => {
    const next = random(seed);
    for (let n = 0; n < 32; n++) {
      const input = Array.from({ length: 1 + next() % 8 }, (_, i) => ({ path: `D${n}/F${i}.DAT`, method: next() % 2 ? 8 : 0,
        bytes: Uint8Array.from({ length: next() % 1024 }, () => next() >>> 24) }));
      const result = await extractZip(new Blob([packageZip(input)]), signal());
      expect(result.files.length).toBe(input.length);
      let size = 0;
      for (const source of input) {
        const file = result.files.find(f => f.path === source.path)!; expect(file).toBeDefined();
        expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(source.bytes); size += file.blob.size;
      }
      expect(size).toBe(input.reduce((s, f) => s + f.bytes.length, 0)); expect(size).toBeLessThanOrEqual(PACKAGE_LIMITS.totalBytes);
    }
  });
  it.each(seeds)('unsafe paths and impossible ZIP sizes fail atomically; seed %i', async seed => {
    const next = random(seed);
    for (let n = 0; n < 32; n++) {
      const path = [`../${next()}`, `/D${next()}`, `C:/D${next()}`, `A/../../${next()}`][n % 4]!;
      await expect(extractZip(new Blob([packageZip([{ path, bytes: new Uint8Array([1]) }])]), signal())).rejects.toMatchObject({ code: 'INVALID_PATH' });
      const size = PACKAGE_LIMITS.fileBytes + 1 + next() % 1000000;
      await expect(extractZip(new Blob([packageZip([{ path: 'SAFE.DAT', bytes: new Uint8Array([1]), declaredSize: size }])]), signal())).rejects.toMatchObject({ code: 'PACKAGE_LIMIT' });
    }
  });
});
