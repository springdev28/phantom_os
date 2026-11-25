import { describe, expect, it, vi } from 'vitest';
import { boundedResponse } from './bounded-response';
import { guestFileList, parseHostMessage } from '../runtime/dos/protocol';
import { applicationPolicy, productionHeaders } from './policy';
import { DOS_HOST_PATH } from '../runtime/dos/host-manifest';

describe('untrusted runtime and download boundaries', () => {
  it('stops a lengthless response at the actual byte limit and cancels its stream', async () => {
    const cancel = vi.fn(); let pulls = 0;
    const response = new Response(new ReadableStream({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(32)); }, cancel }));
    await expect(boundedResponse(response, 40, new AbortController().signal)).rejects.toThrow('Static asset limit');
    expect(cancel).toHaveBeenCalledOnce(); expect(pulls).toBeLessThanOrEqual(3);
  });
  it('rejects a dishonest Content-Length based on actual bytes', async () => {
    await expect(boundedResponse(new Response(new Uint8Array(64), { headers: { 'content-length': '1' } }), 32, new AbortController().signal)).rejects.toThrow();
  });
  it('returns exact bounded bytes and rejects an already aborted read', async () => {
    expect(new Uint8Array(await boundedResponse(new Response(new Uint8Array([1, 2, 3])), 3, new AbortController().signal))).toEqual(new Uint8Array([1, 2, 3]));
    const abort = new AbortController(); abort.abort();
    await expect(boundedResponse(new Response('private'), 32, abort.signal)).rejects.toThrow();
  });
  it('rejects HTTP errors, a missing body and an advertised oversize length without reading payload bytes', async () => {
    const cancel = vi.fn();
    const forbidden = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new TextEncoder().encode('PRIVATE')); }, cancel }), { status: 403 });
    await expect(boundedResponse(forbidden, 1024, new AbortController().signal)).rejects.toThrow('Static asset limit');
    expect(cancel).toHaveBeenCalledOnce();
    const oversize = vi.fn();
    await expect(boundedResponse(new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(64)); }, cancel: oversize }),
      { headers: { 'content-length': '100' } }), 40, new AbortController().signal)).rejects.toThrow('Static asset limit');
    expect(oversize).toHaveBeenCalledOnce();
    await expect(boundedResponse(new Response(null), 32, new AbortController().signal)).rejects.toThrow('Static asset limit');
    await expect(boundedResponse(new Response(new Uint8Array([1])), 0, new AbortController().signal)).rejects.toThrow('Static asset limit');
  });
  it('aborts a partially read stream without treating the cancel as a completed download', async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const response = new Response(new ReadableStream({
      pull(stream) {
        stream.enqueue(new Uint8Array([1, 2, 3]));
        controller.abort();
      },
      cancel,
    }));
    await expect(boundedResponse(response, 1024, controller.signal)).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([null, [], 'running', { type: ['running'] }, { type: new String('running') },
    { type: 'running', url: 'https://invalid.example' }, { type: 'eval', source: 'private' },
    { type: 'reply', id: Infinity, value: [] }, { type: 'reply', id: 0, value: [] },
    { type: 'input', focused: 'yes' }, { type: 'input', focused: true, extra: true },
    { type: 'connected', extra: true }, { type: 'reply', id: 1, error: true, value: [] },
    { type: 'metrics', frames: 1, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: NaN },
    { type: 'metrics', frames: 1.5, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: 0 },
    { type: 'metrics', frames: -1, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: 0 },
    { type: 'metrics', frames: 1, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: Infinity },
    { type: 'metrics', frames: 1, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: 0, extra: true }].map(value => ({ value })))('rejects malformed guest protocol data: %j', ({ value }) => {
    expect(() => parseHostMessage(value)).toThrow('The DOS worker stopped after a failure');
  });
  it('accepts only the narrow runtime control and transfer envelopes', () => {
    expect(parseHostMessage({ type: 'running' })).toEqual({ type: 'running' });
    expect(parseHostMessage({ type: 'reply', id: 1, error: true })).toEqual({ type: 'reply', id: 1, error: true });
    expect(guestFileList([{ path: 'DATA/NOTE.TXT', size: 42 }])).toEqual([{ path: 'DATA/NOTE.TXT', size: 42 }]);
  });
  it.each([[null], [{ path: '../ESCAPE.TXT', size: 1 }], [{ path: 'NOTE.TXT', size: -1 }],
    [{ path: '<img onerror=alert(1)>', size: 1 }], [{ path: 'a.txt', size: 1 }, { path: 'A.TXT', size: 1 }],
    [{ path: 'a', size: 33554433 }], [{ path: 'DATA/NOTE.TXT', size: 42, extra: true }],
    [{ path: 'A.DAT', size: 32 * 1024 * 1024 }, { path: 'B.DAT', size: 32 * 1024 * 1024 + 1 }],
    [{ path: 'CON.TXT', size: 1 }], [{ path: 'NOTE.TXT', size: 1.5 }]].map(value => ({ value })))('rejects unsafe guest file lists before display/export: %j', ({ value }) => {
    expect(() => guestFileList(value)).toThrow();
  });
  it('accepts an empty guest listing and rejects a reserved-device name before export', () => {
    expect(guestFileList([])).toEqual([]);
    expect(() => guestFileList([{ path: 'NUL', size: 0 }])).toThrow();
  });
  it('rejects an over-budget guest listing and a reply that smuggles extra fields', () => {
    expect(() => guestFileList(Array.from({ length: 2049 }, (_, i) => ({ path: `F${i}.DAT`, size: 0 })))).toThrow();
    expect(() => parseHostMessage({ type: 'reply', id: 1, value: [], extra: true })).toThrow();
    expect(() => parseHostMessage({ type: 'reply', id: 1, error: false, value: [] })).toThrow();
    expect(() => parseHostMessage({ type: 'metrics', frames: 1, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: -1 })).toThrow();
  });
  it('refuses a configurable URL or inline policy injected through hosting configuration', () => {
    expect(() => applicationPolicy("https://example.test; script-src *", 'runtimes/js-dos/host-0123456789abcdef.html')).toThrow();
    expect(() => applicationPolicy('https://example.test', 'https://evil.invalid/frame')).toThrow();
    expect(() => applicationPolicy('https://example.test/', DOS_HOST_PATH)).toThrow();
    expect(() => productionHeaders('javascript:alert(1)', DOS_HOST_PATH)).toThrow();
    expect(() => applicationPolicy('ftp://example.test', DOS_HOST_PATH)).toThrow();
    expect(() => applicationPolicy('data:text/html,alert(1)', DOS_HOST_PATH)).toThrow();
    expect(() => applicationPolicy('https://example.test:443', DOS_HOST_PATH)).toThrow();
    expect(() => applicationPolicy('https://example.test', 'runtimes/js-dos/host-0123456789ABCDEF.html')).toThrow();
    expect(() => applicationPolicy('https://example.test', `${DOS_HOST_PATH}/extra`)).toThrow();
  });
  it('denies framing on the app shell and withholds COOP from the hashed DOS host', () => {
    const origin = 'https://example.test';
    const page = productionHeaders(origin, DOS_HOST_PATH);
    expect(page['X-Frame-Options']).toBe('DENY');
    expect(page['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(page['Content-Security-Policy']).toContain(`frame-src ${origin}/${DOS_HOST_PATH}`);
    expect(page['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(page['Content-Security-Policy']).toContain(`${origin}/demos/MEM.EXE`);
    expect(page['Content-Security-Policy']).not.toContain('*');
    const frame = productionHeaders(origin, DOS_HOST_PATH, "default-src 'none'; script-src 'self'");
    expect(frame['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(frame['Cross-Origin-Opener-Policy']).toBeUndefined();
    expect(frame['Content-Security-Policy']).toBe("default-src 'none'; script-src 'self'; frame-ancestors 'self'");
    expect(frame['Permissions-Policy']).toBe(page['Permissions-Policy']);
  });
});
