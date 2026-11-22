import { describe, expect, it, vi } from 'vitest';
import { boundedResponse } from './bounded-response';
import { guestFileList, parseHostMessage } from '../runtime/dos/protocol';
import { applicationPolicy } from './policy';

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
  it.each([null, [], 'running', { type: ['running'] }, { type: new String('running') },
    { type: 'running', url: 'https://invalid.example' }, { type: 'eval', source: 'private' },
    { type: 'reply', id: Infinity, value: [] }, { type: 'input', focused: 'yes' },
    { type: 'metrics', frames: 1, audioSamples: 0, keyEvents: 0, mouseEvents: 0, audioPeak: NaN }].map(value => ({ value })))('rejects malformed guest protocol data: %j', ({ value }) => {
    expect(() => parseHostMessage(value)).toThrow('The DOS worker stopped after a failure');
  });
  it('accepts only the narrow runtime control and transfer envelopes', () => {
    expect(parseHostMessage({ type: 'running' })).toEqual({ type: 'running' });
    expect(parseHostMessage({ type: 'reply', id: 1, error: true })).toEqual({ type: 'reply', id: 1, error: true });
    expect(guestFileList([{ path: 'DATA/NOTE.TXT', size: 42 }])).toEqual([{ path: 'DATA/NOTE.TXT', size: 42 }]);
  });
  it.each([[null], [{ path: '../ESCAPE.TXT', size: 1 }], [{ path: 'NOTE.TXT', size: -1 }],
    [{ path: '<img onerror=alert(1)>', size: 1 }], [{ path: 'a.txt', size: 1 }, { path: 'A.TXT', size: 1 }],
    [{ path: 'a', size: 33554433 }]].map(value => ({ value })))('rejects unsafe guest file lists before display/export: %j', ({ value }) => {
    expect(() => guestFileList(value)).toThrow();
  });
  it('refuses a configurable URL or inline policy injected through hosting configuration', () => {
    expect(() => applicationPolicy("https://example.test; script-src *", 'runtimes/js-dos/host-0123456789abcdef.html')).toThrow();
    expect(() => applicationPolicy('https://example.test', 'https://evil.invalid/frame')).toThrow();
  });
});
