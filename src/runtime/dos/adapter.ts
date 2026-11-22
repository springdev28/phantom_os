import type { ApplicationPackage, ExportArtifact, LaunchProfile, PreparedSession, RuntimeAdapter, RuntimeProgress, RuntimeSession, SessionEvent } from '../../domain/contracts';
import { AppError } from '../../domain/errors';
import { validateLaunchProfile } from '../../profiles/launch-profile';
import { safePath } from '../../packages/paths';
import { DOS_ASSETS, dosDescriptor } from './descriptor';
import { createDosConfiguration } from './config';
import { DOS_KEYS } from './keys';
import type { HostStart } from './host';
import { DOS_HOST_PATH } from './host-manifest';
import { validateDocumentImport } from './transfers';
import { boundedResponse } from '../../security/bounded-response';
import { guestFileList, parseHostMessage } from './protocol';

const staged = new WeakMap<PreparedSession, HostStart>();
const assetCache = new Map<string, ArrayBuffer>(); // Audited engine bytes only; never user files.
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
async function assets(signal: AbortSignal, progress?: (value: RuntimeProgress) => void): Promise<Record<string, ArrayBuffer>> {
  let completed = 0;
  const update = () => progress?.({ phase: 'runtime-files', completed, total: Object.keys(DOS_ASSETS).length });
  update();
  try {
    const entries = await Promise.all(Object.entries(DOS_ASSETS).map(async ([name, hash]) => {
      const cached = assetCache.get(name); if (cached) { completed++; update(); return [name, cached.slice(0)] as const; }
      // Fixed, same-origin URLs only. Never computed from selected package metadata.
      const response = await fetch(`${import.meta.env.BASE_URL}runtimes/js-dos/8.5.3/${name}`, { signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
      const bytes = await boundedResponse(response, 2 * 1024 * 1024, signal);
      if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== hash) throw new AppError('RUNTIME_ASSETS');
      assetCache.set(name, bytes); completed++; update(); return [name, bytes.slice(0)] as const;
    }));
    return Object.fromEntries(entries);
  } catch { signal.throwIfAborted(); throw new AppError('RUNTIME_ASSETS'); }
}

async function prepare(pkg: ApplicationPackage, untrusted: LaunchProfile, signal: AbortSignal, progress?: (value: RuntimeProgress) => void): Promise<PreparedSession> {
  const profile = validateLaunchProfile(untrusted);
  if (profile.runtimeId !== dosDescriptor.id || profile.runtimeVersion !== dosDescriptor.version || profile.runtimeBuildId !== dosDescriptor.buildId
    || profile.limits.guestMemoryMiB > 64) throw new AppError('RUNTIME_MISMATCH');
  const config = createDosConfiguration(pkg, profile);
  const files: HostStart['files'] = [];
  progress?.({ phase: 'staging', completed: 0, total: pkg.files.length });
  // One bounded range at a time; no concatenated ZIP and no second archive extraction.
  for (const file of pkg.files) {
    signal.throwIfAborted(); const contents = new Uint8Array(file.size);
    for (let offset = 0; offset < file.size; offset += 65536) {
      signal.throwIfAborted(); const length = Math.min(65536, file.size - offset), part = await file.read(offset, length, signal);
      if (part.length !== length) throw new AppError('READ_FAILED'); contents.set(part, offset);
    }
    files.push({ path: `package/${file.path}`, contents });
    progress?.({ phase: 'staging', completed: files.length, total: pkg.files.length });
  }
  const downloaded = await assets(signal, progress); signal.throwIfAborted();
  const prepared: PreparedSession = { id: crypto.randomUUID(), async dispose() { staged.delete(prepared); files.length = 0; } };
  staged.set(prepared, { assets: downloaded, files, config, controls: profile.controls, keys: DOS_KEYS });
  return prepared;
}

async function launch(prepared: PreparedSession, viewport: HTMLElement, signal: AbortSignal): Promise<RuntimeSession> {
  const payload = staged.get(prepared); if (!payload) throw new AppError('RUNTIME_FAILED');
  signal.throwIfAborted();
  const frame = document.createElement('iframe'); frame.title = 'DOS program framebuffer';
  frame.className = 'dos-frame'; frame.setAttribute('sandbox', 'allow-scripts allow-pointer-lock');
  frame.setAttribute('allow', "autoplay; clipboard-read 'none'; clipboard-write 'none'; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'; usb 'none'; serial 'none'; hid 'none'; payment 'none'");
  frame.referrerPolicy = 'no-referrer';
  frame.src = `${import.meta.env.BASE_URL}${DOS_HOST_PATH}`;
  const channel = new MessageChannel(), port = channel.port1;
  const listeners = new Set<(event: SessionEvent) => void>();
  let ended = false, running = false, connected = false, loaded = false, serial = 0;
  let resolveStart: (value: RuntimeSession) => void, rejectStart: (error: Error) => void;
  let resolveStop: (() => void) | undefined;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const emit = (event: SessionEvent) => { for (const listener of listeners) listener(event); };
  function destroy() {
    if (ended) return; ended = true; clearTimeout(startTimer); signal.removeEventListener('abort', abort);
    port.close(); frame.remove(); staged.delete(prepared);
    for (const call of pending.values()) { clearTimeout(call.timer); call.reject(new AppError('RUNTIME_FAILED')); }
    pending.clear(); resolveStop?.();
  }
  function fail(code: 'RUNTIME_TIMEOUT' | 'RUNTIME_FAILED') {
    const error = new AppError(code); rejectStart(error); emit({ type: 'error', code, message: error.message, recoverable: true }); destroy();
  }
  const abort = () => { rejectStart(new AppError('RUNTIME_FAILED')); destroy(); };
  const request = (type: 'files' | 'read' | 'write', path?: string, bytes?: Uint8Array<ArrayBuffer>): Promise<unknown> => {
    if (ended || !running) return Promise.reject(new AppError('RUNTIME_FAILED'));
    if (pending.size >= 4) return Promise.reject(new AppError('TRANSFER_FAILED'));
    return new Promise((resolve, reject) => {
      const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new AppError('TRANSFER_FAILED')); }, 4000);
      pending.set(id, { resolve, reject, timer });
      try { port.postMessage({ type, id, ...(path ? { path } : {}), ...(bytes ? { bytes } : {}) }, bytes ? [bytes.buffer] : []); }
      catch { clearTimeout(timer); pending.delete(id); reject(new AppError('TRANSFER_FAILED')); }
    });
  };
  const session: RuntimeSession = {
    id: prepared.id,
    onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    focusInput() {
      if (running && !ended) {
        // A canvas can remain the child document's activeElement after the
        // iframe loses focus. Focus its browsing context before its canvas.
        frame.focus({ preventScroll: true });
        // Chrome applies cross-process browsing-context focus asynchronously.
        // Let the initiating button's blur finish before requesting child focus.
        requestAnimationFrame(() => { if (running && !ended) port.postMessage({ type: 'focus' }); });
      }
    },
    releaseInput() { if (running && !ended) port.postMessage({ type: 'release' }); },
    async importFiles(files, abortSignal) {
      abortSignal.throwIfAborted();
      const file = validateDocumentImport(files, await session.listFiles(abortSignal));
      const bytes = new Uint8Array(file.size);
      for (let offset = 0; offset < file.size; offset += 65536) {
        abortSignal.throwIfAborted(); const count = Math.min(65536, file.size - offset), part = await file.read(offset, count, abortSignal);
        if (part.length !== count) throw new AppError('READ_FAILED'); bytes.set(part, offset);
      }
      abortSignal.throwIfAborted(); await request('write', file.path, bytes); abortSignal.throwIfAborted();
    },
    async listFiles(abortSignal) {
      abortSignal.throwIfAborted(); const value = await request('files'); abortSignal.throwIfAborted();
      return guestFileList(value);
    },
    async exportFiles(paths, abortSignal) {
      if (paths.length > 1) throw new AppError('DOS_SETTINGS');
      const result: ExportArtifact[] = [];
      for (const path of paths) {
        abortSignal.throwIfAborted(); if (safePath(path) !== path) throw new AppError('INVALID_PATH');
        const bytes = await request('read', path); abortSignal.throwIfAborted();
        if (!(bytes instanceof Uint8Array) || bytes.length > 32 * 1024 * 1024) throw new AppError('RUNTIME_FAILED');
        result.push({ path, blob: new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }) });
      }
      return result;
    },
    async stop() {
      if (ended) return;
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => { destroy(); resolve(); }, 1500);
        resolveStop = () => { clearTimeout(timeout); resolve(); };
        port.postMessage({ type: 'stop' });
      });
      destroy(); emit({ type: 'state', state: 'stopped' });
    },
    async dispose() { await session.stop(); listeners.clear(); },
  };
  const started = new Promise<RuntimeSession>((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
  const startTimer = setTimeout(() => fail('RUNTIME_TIMEOUT'), 30000);
  signal.addEventListener('abort', abort, { once: true });
  port.onmessage = (event: MessageEvent<unknown>) => {
    if (ended) return;
    let data: ReturnType<typeof parseHostMessage>;
    try { data = parseHostMessage(event.data); } catch { fail('RUNTIME_FAILED'); return; }
    if (data.type === 'connected') {
      if (connected) { fail('RUNTIME_FAILED'); return; } connected = true;
      port.postMessage({ type: 'start', payload }, [...Object.values(payload.assets), ...payload.files.map(file => file.contents.buffer)]);
      staged.delete(prepared); payload.files.length = 0;
    } else if (data.type === 'running') { if (!connected || running) { fail('RUNTIME_FAILED'); return; } running = true; clearTimeout(startTimer); resolveStart(session); }
    else if (data.type === 'error') fail('RUNTIME_FAILED');
    else if (data.type === 'input') emit({ type: 'input', focused: data.focused });
    else if (data.type === 'stopped') { if (!running) rejectStart(new AppError('RUNTIME_FAILED')); destroy(); emit({ type: 'state', state: 'stopped' }); }
    else if (data.type === 'metrics') emit(data);
    else if (data.type === 'reply') {
      const call = pending.get(data.id); if (!call) return;
      clearTimeout(call.timer); pending.delete(data.id);
      if (data.error) call.reject(new AppError('TRANSFER_FAILED')); else call.resolve(data.value);
    }
  };
  port.onmessageerror = () => fail('RUNTIME_FAILED');
  port.start();
  frame.onload = () => {
    if (ended) return;
    if (loaded) { fail('RUNTIME_FAILED'); return; } loaded = true;
    frame.contentWindow?.postMessage('phantom-dos-connect', '*', [channel.port2]);
  };
  viewport.replaceChildren(frame);
  return started;
}

export const dosAdapter: RuntimeAdapter = {
  descriptor: dosDescriptor,
  probe(pkg, evidence) {
    const format = pkg.entrypoint ? evidence.get(pkg.entrypoint)?.format : undefined;
    return { candidate: format === 'dos-mz' || format === 'dos-com-ambiguous', requirements: dosDescriptor.requirements,
      reasons: ['The selected DOS path remains experimental until this exact program/configuration is observed.'] };
  }, prepare, launch,
};
