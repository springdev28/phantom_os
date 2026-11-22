import { afterEach, describe, expect, it, vi } from 'vitest';
import { importZipInWorker } from './zip-worker-client';
import { PACKAGE_LIMITS } from './limits';

class TestWorker {
  static latest: TestWorker;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: ErrorEvent) => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor(readonly url: string | URL) { TestWorker.latest = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('ZIP worker lifecycle (unit doubles only)', () => {
  it('sends only a Blob through structured clone, forwards progress and terminates after success', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const blob = new Blob(['test']), progress = vi.fn();
    const task = importZipInWorker(blob, new AbortController().signal, progress), worker = TestWorker.latest;
    expect(String(worker.url)).toContain('zip.worker');
    expect(String(worker.url)).not.toContain('PRIVATE');
    expect(worker.postMessage).toHaveBeenCalledWith(blob);
    worker.onmessage?.({ data: { type: 'progress', progress: { phase: 'validating', completed: 1, total: 2 } } } as MessageEvent);
    expect(progress).toHaveBeenCalledOnce();
    worker.onmessage?.({ data: { type: 'complete', contents: { files: [], directories: [] } } } as MessageEvent);
    await expect(task).resolves.toEqual({ files: [], directories: [] });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('terminates on abort without publishing a partial result', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const controller = new AbortController(), task = importZipInWorker(new Blob(), controller.signal, vi.fn());
    const rejected = expect(task).rejects.toThrow();
    controller.abort(); await rejected;
    expect(TestWorker.latest.terminate).toHaveBeenCalledOnce();
  });
  it('enforces a wall-clock termination even if a decompressor never responds', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', TestWorker);
    const task = importZipInWorker(new Blob(), new AbortController().signal, vi.fn());
    const rejected = expect(task).rejects.toMatchObject({ code: 'IMPORT_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(PACKAGE_LIMITS.timeoutMs); await rejected;
    expect(TestWorker.latest.terminate).toHaveBeenCalledOnce();
  });
  it('sanitizes a worker startup failure and terminates failed jobs', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const task = importZipInWorker(new Blob(), new AbortController().signal, vi.fn());
    const event = { preventDefault: vi.fn(), message: 'PRIVATE_FILE_DATA' };
    TestWorker.latest.onerror?.(event as unknown as ErrorEvent);
    await expect(task).rejects.toMatchObject({ code: 'WORKER_UNAVAILABLE' });
    expect(TestWorker.latest.terminate).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});
