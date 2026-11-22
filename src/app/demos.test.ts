import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { demos, readDemo } from './demos';

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
async function memBytes() {
  return copyBytes(await readFile('tests/fixtures/dos/MEM.EXE'));
}

describe('pinned public demo downloads', () => {
  it('accepts only the audited MEM fixture from a same-origin, non-credentialed fetch', async () => {
    const bytes = await memBytes();
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${import.meta.env.BASE_URL}demos/MEM.EXE`);
      expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
      return reply(bytes);
    });
    vi.stubGlobal('fetch', fetch);
    const file = await readDemo('mem', new AbortController().signal);
    expect(file).toMatchObject({ name: 'MEM.EXE', size: demos.mem.bytes, lastModified: 0 });
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('rejects serving the other audited fixture at the MEM URL', async () => {
    const swapped = new Uint8Array(await readFile('tests/fixtures/dos/FREECOM.ZIP'));
    vi.stubGlobal('fetch', vi.fn(async () => reply(swapped)));
    await expect(readDemo('mem', new AbortController().signal)).rejects.toMatchObject({ code: 'DEMO_FAILED' });
  });
  it('rejects a same-size substitution before any selection is published', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(new Uint8Array(demos.mem.bytes))));
    await expect(readDemo('mem', new AbortController().signal)).rejects.toMatchObject({ code: 'DEMO_FAILED' });
  });
  it('rejects a dishonest Content-Length without reading the stream', async () => {
    const bytes = await memBytes();
    const fetch = vi.fn(async () => reply(bytes, { 'content-length': String(demos.mem.bytes + 1) }));
    vi.stubGlobal('fetch', fetch);
    await expect(readDemo('mem', new AbortController().signal)).rejects.toMatchObject({ code: 'DEMO_FAILED' });
  });
  it('stops a lengthless stream once it exceeds the pinned size', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(4096)); },
      cancel,
    }))));
    await expect(readDemo('mem', new AbortController().signal)).rejects.toMatchObject({ code: 'DEMO_FAILED' });
    expect(cancel).toHaveBeenCalled();
  });
  it.each([500, 404])('maps HTTP %s to DEMO_FAILED without leaking response text', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(new TextEncoder().encode('PRIVATE_DEMO_PATH'), {}, status)));
    await expect(readDemo('mem', new AbortController().signal)).rejects.toMatchObject({
      code: 'DEMO_FAILED', message: expect.not.stringMatching(/PRIVATE/),
    });
  });
  it('does not wrap an aborted download as DEMO_FAILED', async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn(async () => { throw controller.signal.reason; }));
    await expect(readDemo('mem', controller.signal)).rejects.toThrow(controller.signal.reason);
  });
});
