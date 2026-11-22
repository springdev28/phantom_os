import { AppError } from '../domain/errors';

/** Audited public fixtures only. Never constructed from imported metadata. */
export const demos = {
  mem: { title: 'FreeDOS MEM', file: 'MEM.EXE', entrypoint: 'MEM.EXE', bytes: 15028,
    sha256: '6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4',
    description: 'A small DOS utility that shows memory usage.', command: 'MEM > MEMOUT.TXT', output: 'MEMOUT.TXT' },
  freecom: { title: 'FreeCOM', file: 'FREECOM.ZIP', entrypoint: 'APP/COMMAND.COM', bytes: 88187,
    sha256: 'fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e',
    description: 'A DOS command shell with its companion files.', command: 'ECHO HELLO FROM DOS>RESULT.TXT', output: 'RESULT.TXT' },
} as const;
export type DemoId = keyof typeof demos;
export async function readDemo(id: DemoId, signal: AbortSignal): Promise<File> {
  try {
    const demo = demos[id];
    const response = await fetch(`${import.meta.env.BASE_URL}demos/${demo.file}`, { signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > demo.bytes) throw new AppError('DEMO_FAILED');
    const reader = response.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
    try {
      while (true) {
        signal.throwIfAborted(); const { value, done } = await reader.read(); if (done) break;
        size += value.length; if (size > demo.bytes) throw new AppError('DEMO_FAILED'); chunks.push(new Uint8Array(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    const file = new File(chunks, demo.file, { lastModified: 0 });
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
    if (size !== demo.bytes || digest !== demo.sha256) throw new AppError('DEMO_FAILED');
    return file;
  } catch { signal.throwIfAborted(); throw new AppError('DEMO_FAILED'); }
}
