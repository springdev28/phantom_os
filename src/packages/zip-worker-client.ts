import { AppError } from '../domain/errors';
import type { ErrorCode } from '../domain/errors';
import type { ImportProgress } from './zip';
import type { PackageContents } from './virtual-package';
import { PACKAGE_LIMITS } from './limits';
import ZipWorker from './zip.worker?worker&inline';

export type ZipWorkerReply = { type: 'progress'; progress: ImportProgress }
  | { type: 'complete'; contents: PackageContents } | { type: 'error'; code: ErrorCode };

/** Production worker code is bundled with the app, so each new job works offline.
 * Development uses Vite's fixed worker URL. Neither path contains user input.
 */
export function importZipInWorker(blob: Blob, signal: AbortSignal,
  progress: (value: ImportProgress) => void): Promise<PackageContents> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new ZipWorker(); }
    catch { reject(new AppError('WORKER_UNAVAILABLE')); return; }
    const finish = () => { worker.terminate(); clearTimeout(timeout); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(signal.reason); };
    const timeout = setTimeout(() => { finish(); reject(new AppError('IMPORT_TIMEOUT')); }, PACKAGE_LIMITS.timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = event => { event.preventDefault(); finish(); reject(new AppError('WORKER_UNAVAILABLE')); };
    worker.onmessageerror = () => { finish(); reject(new AppError('ZIP_INVALID')); };
    worker.onmessage = (event: MessageEvent<ZipWorkerReply>) => {
      const message = event.data;
      if (message.type === 'progress') progress(message.progress);
      else { finish(); if (message.type === 'complete') resolve(message.contents); else reject(new AppError(message.code)); }
    };
    try { worker.postMessage(blob); } catch { finish(); reject(new AppError('WORKER_UNAVAILABLE')); }
  });
}
