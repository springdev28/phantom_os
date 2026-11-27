import { afterEach, describe, expect, it, vi } from 'vitest';
import { dosAdapter } from './adapter';
import { dosDescriptor } from './descriptor';
import { createLaunchProfile } from '../../profiles/launch-profile';
import { inspectedFixture } from '../../../tests/fixtures/planner-fixtures';
import { mzFixture, peFixture } from '../../../tests/fixtures/probe-fixtures';
import { compatibilityPlanner } from '../../planner/compatibility-planner';

afterEach(() => { vi.unstubAllGlobals(); });

function copyBytes(source: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes;
}
function reply(body: Uint8Array, headers: HeadersInit = {}, status = 200) {
  const bytes = copyBytes(body);
  return new Response(bytes, { status, headers: { 'content-length': String(bytes.byteLength), ...headers } });
}
async function input() {
  const { pkg, inspection } = await inspectedFixture(mzFixture(), 'MEM.EXE');
  const plan = compatibilityPlanner.plan(pkg, inspection, [dosDescriptor]);
  return { pkg, profile: createLaunchProfile(pkg, plan, dosDescriptor) };
}

describe('pinned DOS runtime asset staging (no guest execution)', () => {
  it('fetches only the audited engine files from same-origin, non-credentialed URLs', async () => {
    const { pkg, profile } = await input();
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
      expect(url).toMatch(new RegExp(`^${import.meta.env.BASE_URL}runtimes/js-dos/8\\.5\\.3/(emulators\\.js|wdosbox\\.js|wdosbox\\.wasm)$`));
      return reply(new Uint8Array(64));
    });
    vi.stubGlobal('fetch', fetch);
    await expect(dosAdapter.prepare(pkg, profile, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_ASSETS' });
    expect([...fetch.mock.calls.map(([url]) => url)].sort()).toEqual([
      `${import.meta.env.BASE_URL}runtimes/js-dos/8.5.3/emulators.js`,
      `${import.meta.env.BASE_URL}runtimes/js-dos/8.5.3/wdosbox.js`,
      `${import.meta.env.BASE_URL}runtimes/js-dos/8.5.3/wdosbox.wasm`,
    ]);
  });
  it.each([500, 404])('maps HTTP %s to RUNTIME_ASSETS without leaking response text', async status => {
    const { pkg, profile } = await input();
    vi.stubGlobal('fetch', vi.fn(async () => reply(new TextEncoder().encode('PRIVATE_ENGINE_PATH'), {}, status)));
    await expect(dosAdapter.prepare(pkg, profile, new AbortController().signal)).rejects.toMatchObject({
      code: 'RUNTIME_ASSETS', message: expect.not.stringMatching(/PRIVATE/),
    });
  });
  it('rejects a dishonest Content-Length without treating it as an installed engine', async () => {
    const { pkg, profile } = await input();
    vi.stubGlobal('fetch', vi.fn(async () => reply(new Uint8Array(64), { 'content-length': String(2 * 1024 * 1024 + 1) })));
    await expect(dosAdapter.prepare(pkg, profile, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_ASSETS' });
  });
  it('does not wrap an aborted prepare as RUNTIME_ASSETS', async () => {
    const { pkg, profile } = await input();
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn(async () => { throw controller.signal.reason; }));
    await expect(dosAdapter.prepare(pkg, profile, controller.signal)).rejects.toThrow(controller.signal.reason);
  });
  it('rejects a mismatched build or oversize guest memory before any fetch', async () => {
    const { pkg, profile } = await input();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(dosAdapter.prepare(pkg, { ...profile, runtimeBuildId: 'wrong-build' }, new AbortController().signal))
      .rejects.toMatchObject({ code: 'RUNTIME_MISMATCH' });
    await expect(dosAdapter.prepare(pkg, { ...profile, limits: { ...profile.limits, guestMemoryMiB: 128 } }, new AbortController().signal))
      .rejects.toMatchObject({ code: 'RUNTIME_MISMATCH' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('stops on a short bounded read and never concatenates package bytes into a second ZIP', async () => {
    const { pkg, profile } = await input();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const file = pkg.files[0]!;
    const lengths: number[] = [];
    const short = { ...pkg, files: [{ ...file, read: async () => new Uint8Array(1) }] };
    await expect(dosAdapter.prepare(short, profile, new AbortController().signal)).rejects.toMatchObject({ code: 'READ_FAILED' });
    expect(fetch).not.toHaveBeenCalled();
    const observed = { ...pkg, files: [{ ...file, size: 70_000, async read(_offset: number, length: number) {
      lengths.push(length); return new Uint8Array(length);
    } }] };
    vi.stubGlobal('fetch', vi.fn(async () => reply(new Uint8Array(64))));
    await expect(dosAdapter.prepare(observed, profile, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_ASSETS' });
    expect(lengths.every(length => length <= 65536)).toBe(true);
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBe(70_000);
  });
  it('treats only DOS MZ/COM headers as launch candidates and never PE or a missing entrypoint', async () => {
    const mz = await inspectedFixture(mzFixture(), 'MEM.EXE');
    expect(dosAdapter.probe(mz.pkg, mz.inspection)).toMatchObject({
      candidate: true,
      reasons: [expect.stringMatching(/experimental/)],
    });
    const pe = await inspectedFixture(peFixture(), 'WIN.EXE');
    expect(dosAdapter.probe(pe.pkg, pe.inspection).candidate).toBe(false);
    expect(dosAdapter.probe({ ...mz.pkg, entrypoint: '' }, mz.inspection).candidate).toBe(false);
    const com = await inspectedFixture(new Uint8Array(20), 'raw.com');
    expect(com.inspection.get('raw.com')).toMatchObject({ format: 'dos-com-ambiguous' });
    expect(dosAdapter.probe(com.pkg, com.inspection).candidate).toBe(true);
  });
});
