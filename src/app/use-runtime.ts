import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { ApplicationPackage, FileArtifact, GuestFile, LaunchProfile, PreparedSession, RuntimeSession, SessionEvent } from '../domain/contracts';
import type { SessionAction } from '../domain/session-machine';
import { AppError, safeError } from '../domain/errors';
import { runtimeRegistry } from '../runtime/registry';
import { logger } from './logger';
import { blobArtifact } from '../packages/virtual-package';
import { downloadLocal } from './download';
interface RuntimeJob { controller: AbortController; session?: RuntimeSession; prepared?: PreparedSession; timer?: ReturnType<typeof setTimeout>; countdown?: ReturnType<typeof setInterval>; stopping?: Promise<void>; }

export function useRuntime(dispatch: Dispatch<SessionAction>) {
  const job = useRef<RuntimeJob | null>(null);
  const [runtimeProgress, setRuntimeProgress] = useState('');
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const [runtimeFocused, setRuntimeFocused] = useState(false);
  const [runtimeRemaining, setRuntimeRemaining] = useState<number | null>(null);
  const [runtimeMetrics, setRuntimeMetrics] = useState<Extract<SessionEvent, { type: 'metrics' }> | null>(null);
  const [guestFiles, setGuestFiles] = useState<readonly GuestFile[]>([]);
  const [workingFiles, setWorkingFiles] = useState<readonly FileArtifact[]>([]);
  const [transferBusy, setTransferBusy] = useState(false);
  const transferring = useRef(false);
  const stopRuntime = useCallback(async () => {
    const current = job.current; if (!current) return;
    if (current.stopping) return current.stopping;
    clearTimeout(current.timer); clearInterval(current.countdown);
    current.stopping = (async () => {
      try { if (current.session) await current.session.stop(); else current.controller.abort(); } finally {
        current.controller.abort(); await current.prepared?.dispose();
        if (job.current === current) {
          job.current = null; dispatch({ type: 'STOP' }); setRuntimeProgress(''); setGuestFiles([]); setRuntimeFocused(false); setRuntimeRemaining(null); logger.record('runtime.stopped');
        }
      }
    })();
    return current.stopping;
  }, [dispatch]);
  useEffect(() => {
    // React unmount is not guaranteed on refresh or back/forward-cache entry.
    // Abort synchronously: the adapter removes its frame and workers immediately.
    const leave = () => { job.current?.controller.abort(); void stopRuntime(); };
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [stopRuntime]);
  useEffect(() => () => {
    const current = job.current; job.current = null; clearTimeout(current?.timer); clearInterval(current?.countdown);
    current?.controller.abort(); void current?.session?.dispose(); void current?.prepared?.dispose();
  }, []);
  async function startRuntime(pkg: ApplicationPackage, profile: LaunchProfile, viewport: HTMLElement) {
    if (job.current || !profile.runtimeId) return;
    const current: RuntimeJob = { controller: new AbortController() }; job.current = current;
    setRuntimeMessage(''); setRuntimeMetrics(null); setGuestFiles([]); setRuntimeProgress('Loading audited DOS assets and staging temporary files…');
    dispatch({ type: 'PREPARE' }); logger.record('runtime.preparing');
    const failure = (error: unknown) => {
      if (job.current !== current || current.stopping || current.controller.signal.aborted) return;
      const safe = safeError(error); job.current = null; clearTimeout(current.timer); clearInterval(current.countdown); current.controller.abort(); setRuntimeFocused(false); setRuntimeRemaining(null);
      void current.session?.dispose(); void current.prepared?.dispose();
      setRuntimeProgress(''); setRuntimeMessage(safe.message); dispatch({ type: 'RUNTIME_FAIL', code: safe.code }); logger.record('app.error', safe.code);
    };
    current.timer = setTimeout(() => failure(new AppError('RUNTIME_TIMEOUT')), 45000);
    try {
      const adapter = await runtimeRegistry.load(profile.runtimeId); current.controller.signal.throwIfAborted();
      current.prepared = await adapter.prepare(pkg, profile, current.controller.signal, progress => {
        if (job.current !== current || current.controller.signal.aborted) return;
        setRuntimeProgress(progress.phase === 'staging' ? `Preparing temporary files · ${progress.completed} / ${progress.total}`
          : `Loading DOS runtime · ${progress.completed} / ${progress.total} files verified. First launch downloads about 1.6 MiB from this site.`);
      });
      if (job.current !== current) { await current.prepared.dispose(); return; }
      setRuntimeProgress('Starting the DOSBox worker and waiting for its framebuffer…');
      current.session = await adapter.launch(current.prepared, viewport, current.controller.signal);
      if (job.current !== current) { await current.session.dispose(); return; }
      clearTimeout(current.timer); current.timer = setTimeout(() => { setRuntimeMessage('The session time limit was reached. The guest was stopped.'); void stopRuntime(); }, profile.limits.maxSessionMs);
      const deadline = Date.now() + profile.limits.maxSessionMs;
      setRuntimeRemaining(Math.ceil(profile.limits.maxSessionMs / 1000));
      current.countdown = setInterval(() => {
        setRuntimeRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        if (Date.now() >= deadline) { setRuntimeMessage('The session time limit was reached. The guest was stopped.'); void stopRuntime(); }
      }, 1000);
      current.session.onEvent(event => {
        if (job.current !== current) return;
        if (event.type === 'metrics') setRuntimeMetrics(event);
        else if (event.type === 'input') setRuntimeFocused(event.focused);
        else if (event.type === 'error') failure(new AppError('RUNTIME_FAILED'));
        else if (event.type === 'state' && event.state === 'stopped') void stopRuntime();
      });
      dispatch({ type: 'STARTED', sessionId: current.session.id }); setRuntimeProgress(''); logger.record('runtime.running');
    } catch (error) { failure(error); }
  }
  async function refreshGuestFiles() {
    const current = job.current; if (!current?.session) return;
    try { const files = await current.session.listFiles(current.controller.signal); if (job.current === current) setGuestFiles(files); }
    catch { if (job.current === current) setRuntimeMessage('The guest file list is unavailable. Retry while the session is running.'); }
  }
  async function exportGuestFile(path: string) {
    const current = job.current; if (!current?.session) return;
    try {
      const [artifact] = await current.session.exportFiles([path], current.controller.signal); if (!artifact || job.current !== current) return;
      downloadLocal(artifact);
      setRuntimeMessage('Guest file exported locally. Export other changes before stopping.');
    } catch { if (job.current === current) setRuntimeMessage('The guest file could not be exported. Refresh the file list and retry.'); }
  }
  async function transfer(work: (session: RuntimeSession, signal: AbortSignal) => Promise<void>) {
    const current = job.current; if (!current?.session || transferring.current) return;
    transferring.current = true; setTransferBusy(true);
    try { await work(current.session, current.controller.signal); }
    catch (error) { if (job.current === current) setRuntimeMessage(safeError(error).message); }
    finally { transferring.current = false; setTransferBusy(false); }
  }
  async function importDocument(file: File) {
    await transfer(async (session, signal) => {
      await session.importFiles([blobArtifact({ path: file.name, blob: file, lastModified: file.lastModified }, 'selection')], signal);
      signal.throwIfAborted(); await refreshGuestFiles();
      setRuntimeMessage('Document imported into temporary C:\\ at its original name. If DOS cached the directory, run RESCAN at a DOSBox prompt or refresh it in the program. Save and capture or export changes before stopping.');
    });
  }
  async function captureWorkingFile(path: string, entrypoint: string | null) {
    await transfer(async (session, signal) => {
      if (path.toLowerCase() === entrypoint?.toLowerCase()) throw new AppError('TRANSFER_SETTINGS');
      const [artifact] = await session.exportFiles([path], signal); signal.throwIfAborted();
      if (!artifact) throw new AppError('TRANSFER_FAILED');
      const next = [...workingFiles.filter(file => file.path.toLowerCase() !== path.toLowerCase()),
        blobArtifact({ ...artifact, lastModified: Date.now() }, 'workspace')];
      if (next.length > 2048 || next.reduce((sum, file) => sum + file.size, 0) > 32 * 1024 * 1024) throw new AppError('STORAGE_LIMIT');
      setWorkingFiles(next);
      setRuntimeMessage('Working copy captured in temporary memory. It will be included on relaunch. Save it explicitly in Workspace to keep it after reload; capture again after further guest edits.');
    });
  }
  function removeWorkingFile(path: string) { setWorkingFiles(files => files.filter(file => file.path !== path)); }
  function rejectLaunch(error: unknown) {
    const failure = safeError(error); setRuntimeMessage(failure.message);
    dispatch({ type: 'PREPARE' }); dispatch({ type: 'RUNTIME_FAIL', code: failure.code }); logger.record('app.error', failure.code);
  }
  const focusRuntime = useCallback(() => { setRuntimeFocused(false); job.current?.session?.focusInput(); }, []);
  const releaseRuntimeInput = useCallback(() => job.current?.session?.releaseInput(), []);
  return { startRuntime, stopRuntime, runtimeProgress, runtimeMessage, runtimeMetrics, runtimeFocused, runtimeRemaining, focusRuntime, releaseRuntimeInput, guestFiles, refreshGuestFiles, exportGuestFile,
    importDocument, captureWorkingFile, workingFiles, replaceWorkingFiles: setWorkingFiles, removeWorkingFile, transferBusy, rejectLaunch };
}
