import { extractZip } from './zip';
import { safeError } from '../domain/errors';
import type { ZipWorkerReply } from './zip-worker-client';

// One job per worker. The parent terminates this worker on success, error, cancel or timeout.
globalThis.onmessage = async (event: MessageEvent<Blob>) => {
  const send = (message: ZipWorkerReply) => globalThis.postMessage(message);
  try {
    const contents = await extractZip(event.data, new AbortController().signal,
      progress => send({ type: 'progress', progress }));
    send({ type: 'complete', contents });
  } catch (error) { send({ type: 'error', code: safeError(error).code }); }
};
