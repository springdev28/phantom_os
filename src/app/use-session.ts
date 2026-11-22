import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppError, safeError } from '../domain/errors';
import { initialSession, sessionReducer } from '../domain/session-machine';
import { selectLocalFiles } from '../intake/local-file';
import type { InputKind } from '../intake/local-file';
import { selectionInspector } from '../inspection/selection-inspector';
import { compatibilityPlanner } from '../planner/compatibility-planner';
import type { LaunchProfile, PlanningRequest, RuntimeSelection, WorkspaceManifest } from '../domain/contracts';
import { createLaunchProfile, ProfileError, readLaunchProfile, validateLaunchProfile } from '../profiles/launch-profile';
import { runtimeRegistry } from '../runtime/registry';
import { logger } from './logger';
import { navigate } from './routes';
import { describePackage } from '../packages/package-analysis';
import { chooseEntrypoint as selectEntrypoint, virtualPackage } from '../packages/virtual-package';
import { importZipInWorker } from '../packages/zip-worker-client';
import type { ImportProgress } from '../packages/zip';
import { PACKAGE_LIMITS } from '../packages/limits';
import { useRuntime } from './use-runtime';
import { useWorkspace } from './use-workspace';
import { withWorkingFiles } from '../workspace/launch';
import { readDemo } from './demos';
import type { DemoId } from './demos';

export function useSession() {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  const runtime = useRuntime(dispatch);
  const [demoId, setDemoId] = useState<DemoId | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');
  const demoJob = useRef<AbortController | null>(null);
  const active = useRef<{ id: string; controller: AbortController } | null>(null);
  const original = useRef<{ file: File; forceZip: boolean } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [profile, setProfile] = useState<LaunchProfile | null>(null);
  const [selection, setSelection] = useState<RuntimeSelection>({ mode: 'automatic' });
  const [dosComConfirmed, setDosComConfirmed] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const profileJob = useRef(0);
  const planning = useRef<PlanningRequest>({});
  const latestState = useRef(state);
  useEffect(() => { latestState.current = state; }, [state]);
  useEffect(() => () => { active.current?.controller.abort(); demoJob.current?.abort(); profileJob.current++; }, []);

  const applyRequest = useCallback((request: PlanningRequest) => {
    planning.current = request;
    setProfile(request.profile ?? null); setSelection(request.selection ?? { mode: 'automatic' });
    setDosComConfirmed(request.dosComConfirmed ?? false);
    const current = latestState.current;
    if ('inspection' in current) dispatch({ type: 'REPLAN', packageId: current.pkg.id,
      plan: compatibilityPlanner.plan(current.pkg, current.inspection, runtimeRegistry.list(), request) });
  }, []);
  const restoreProfile = useCallback((manifest: WorkspaceManifest) => {
    const restored = manifest.profile;
    applyRequest({ profile: restored, selection: restored.selectionMode === 'override' && restored.runtimeId
      ? { mode: 'override', runtimeId: restored.runtimeId } : { mode: 'automatic' } });
    setProfileMessage('Stored profile schema and runtime pins validated. This does not verify application compatibility.');
  }, [applyRequest]);
  const onInitialProfile = useCallback((manifest: WorkspaceManifest) => {
    if (latestState.current.status === 'idle' && profileJob.current === 0) restoreProfile(manifest);
  }, [restoreProfile]);
  const workspace = useWorkspace(onInitialProfile);
  function updateProfile(next: LaunchProfile) {
    profileJob.current++;
    try { applyRequest({ ...planning.current, profile: validateLaunchProfile(next) }); setProfileMessage('Profile settings updated locally.'); }
    catch (error) { setProfileMessage(error instanceof ProfileError ? error.message : 'The profile settings could not be applied.'); }
  }
  function resetProfile() {
    profileJob.current++; setProfileLoading(false);
    applyRequest({ selection: { mode: 'automatic' } }); setProfileMessage('Profile cleared. Automatic selection restored.');
  }
  async function importProfile(file: File) {
    const job = ++profileJob.current; setProfileLoading(true); setProfileMessage('Reading profile locally…');
    try {
      const imported = await readLaunchProfile(file);
      if (job !== profileJob.current) return;
      applyRequest({ profile: imported, selection: imported.selectionMode === 'override' && imported.runtimeId
        ? { mode: 'override', runtimeId: imported.runtimeId } : { mode: 'automatic' } });
      setProfileMessage('Profile imported. Re-select the original files as needed. Imported settings do not establish compatibility.');
    } catch (error) {
      if (job === profileJob.current) setProfileMessage(error instanceof ProfileError ? error.message : 'The profile could not be imported.');
    } finally { if (job === profileJob.current) setProfileLoading(false); }
  }
  function chooseRuntime(next: RuntimeSelection) {
    const request = { ...planning.current, selection: next };
    if (request.profile) {
      const automatic = 'inspection' in state ? compatibilityPlanner.plan(state.pkg, state.inspection, runtimeRegistry.list()).automaticRuntimeId : undefined;
      const runtime = next.mode === 'override' ? runtimeRegistry.get(next.runtimeId) : automatic ? runtimeRegistry.get(automatic) : undefined;
      request.profile = { ...request.profile, selectionMode: next.mode, runtimeId: runtime?.id ?? null,
        runtimeVersion: runtime?.version ?? null, runtimeBuildId: runtime?.buildId ?? null };
    }
    applyRequest(request);
  }
  function confirmDosCom(value: boolean) { applyRequest({ ...planning.current, dosComConfirmed: value }); }

  function selectFiles(files: readonly File[], kind: InputKind = 'files') {
    if (workspace.storageBusy) return;
    demoJob.current?.abort(); demoJob.current = null; setDemoLoading(false); setDemoId(null); setDemoMessage('');
    profileJob.current++; runtime.replaceWorkingFiles([]);
    void runtime.stopRuntime();
    // COM intent belongs to one selection; it must not carry over to another raw binary.
    planning.current = { ...planning.current, dosComConfirmed: false };
    setDosComConfirmed(false);
    active.current?.controller.abort();
    active.current = null;
    original.current = null;
    setProgress(null);
    try {
      const pkg = selectLocalFiles(files, kind);
      if (files.length === 1 && files[0] && kind !== 'folder') original.current = { file: files[0], forceZip: kind === 'zip' || /\.zip$/i.test(files[0].name) };
      dispatch({ type: 'SELECT', pkg });
      logger.record('selection.accepted');
    } catch (error) {
      const failure = safeError(error);
      dispatch({ type: 'CLEAR' });
      dispatch({ type: 'FAIL', code: failure.code });
      logger.record('app.error', failure.code);
    }
    navigate('inspect');
  }

  function clearSelection() {
    if (workspace.storageBusy) return;
    runtime.replaceWorkingFiles([]);
    demoJob.current?.abort(); demoJob.current = null; setDemoLoading(false); setDemoId(null);
    void runtime.stopRuntime();
    active.current?.controller.abort();
    active.current = null;
    original.current = null;
    setProgress(null);
    dispatch({ type: 'CLEAR' });
    resetProfile();
    logger.record('selection.cleared');
  }

  function cancelInspection() {
    active.current?.controller.abort();
    active.current = null;
    setProgress(null);
    dispatch({ type: 'CANCEL_INSPECTION' });
    logger.record('inspection.cancelled');
  }

  async function checkSelection() {
    if (state.status !== 'selected' || active.current) return;
    const job = { id: crypto.randomUUID(), controller: new AbortController() };
    active.current = job;
    dispatch({ type: 'INSPECT', jobId: job.id });
    logger.record('inspection.started');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = async () => {
        let pkg = state.pkg;
        let inspection = await selectionInspector.inspect(pkg, job.controller.signal);
        if (original.current && (original.current.forceZip || [...inspection.values()].some(probe => probe.format === 'zip'))) {
          const source = original.current.file;
          setProgress({ phase: 'validating', completed: 0, total: 0 });
          const contents = await importZipInWorker(source, job.controller.signal, value => {
            if (active.current?.id === job.id) setProgress(value);
          });
          job.controller.signal.throwIfAborted();
          pkg = virtualPackage(contents, 'zip', source.name);
          inspection = await selectionInspector.inspect(pkg, job.controller.signal);
        }
        return { pkg: describePackage(pkg, inspection), inspection };
      };
      const { pkg, inspection } = await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            const failure = new AppError(state.pkg.files.length === 1 && !original.current?.forceZip ? 'READ_TIMEOUT' : 'IMPORT_TIMEOUT');
            job.controller.abort(failure);
            reject(failure);
          }, PACKAGE_LIMITS.timeoutMs);
        }),
      ]);
      if (active.current?.id !== job.id) return;
      const plan = compatibilityPlanner.plan(pkg, inspection, runtimeRegistry.list(), planning.current);
      dispatch({ type: 'INSPECTED', jobId: job.id, inspection, plan, pkg });
      // The completed package keeps only virtual files, not a second copy of the archive.
      original.current = null;
      logger.record('inspection.completed');
    } catch (error) {
      if (active.current?.id !== job.id) return;
      const failure = safeError(error);
      dispatch({ type: 'FAIL', code: failure.code, jobId: job.id });
      logger.record('app.error', failure.code);
    } finally {
      clearTimeout(timeout);
      if (active.current?.id === job.id) { active.current = null; setProgress(null); }
    }
  }

  function chooseEntrypoint(path: string) {
    if (!('inspection' in state) || !state.pkg.candidates.some(candidate => candidate.path === path)) return;
    const pkg = selectEntrypoint(state.pkg, path);
    const request = planning.current.profile ? { ...planning.current, profile: { ...planning.current.profile, entrypoint: path } } : planning.current;
    planning.current = request; setProfile(request.profile ?? null);
    dispatch({ type: 'REPLAN', packageId: pkg.id, pkg, plan: compatibilityPlanner.plan(pkg, state.inspection, runtimeRegistry.list(), request) });
  }
  const draftProfile = profile ?? ('plan' in state ? createLaunchProfile(state.pkg, state.plan,
    state.plan.runtimeId ? runtimeRegistry.get(state.plan.runtimeId) : undefined) : null);
  function run(viewport: HTMLElement) {
    if (!('plan' in state) || !state.plan.canLaunch || !draftProfile) return Promise.resolve();
    try { return runtime.startRuntime(withWorkingFiles(state.pkg, runtime.workingFiles, draftProfile.entrypoint), draftProfile, viewport); }
    catch (error) { runtime.rejectLaunch(error); return Promise.resolve(); }
  }
  async function saveCurrentWorkspace(saveSoftware: boolean, saveDocuments: boolean) {
    if (!draftProfile || ['running', 'preparing', 'inspecting'].includes(state.status)) return;
    const descriptor = draftProfile.runtimeId ? runtimeRegistry.get(draftProfile.runtimeId) : undefined;
    await workspace.saveWorkspace({ profile: draftProfile, application: 'pkg' in state ? state.pkg ?? null : null,
      documents: runtime.workingFiles, saveSoftware, saveDocuments,
      runtimeAssets: descriptor?.assets.map(({ id, sha256 }) => ({ id, sha256 })) ?? [] });
  }
  async function restoreSavedWorkspace() {
    if (['running', 'preparing', 'inspecting'].includes(state.status)) return;
    profileJob.current++;
    await workspace.restoreWorkspace(async (restored, signal) => {
      setDemoId(null);
      active.current?.controller.abort(); original.current = null;
      restoreProfile(restored.manifest); runtime.replaceWorkingFiles(restored.documents);
      if (restored.application) {
        const pkg = restored.application, id = crypto.randomUUID();
        dispatch({ type: 'SELECT', pkg }); dispatch({ type: 'INSPECT', jobId: id });
        try {
          const inspection = await selectionInspector.inspect(pkg, signal); signal.throwIfAborted();
          const analyzed = describePackage(pkg, inspection), entrypoint = restored.manifest.profile.entrypoint;
          // Restore the explicit saved choice only if re-inspection still identifies it.
          const described = entrypoint && analyzed.candidates.some(candidate => candidate.path === entrypoint)
            ? selectEntrypoint(analyzed, entrypoint) : analyzed;
          dispatch({ type: 'INSPECTED', jobId: id, inspection, pkg: described,
            plan: compatibilityPlanner.plan(described, inspection, runtimeRegistry.list(), planning.current) });
        } catch (error) { dispatch({ type: 'FAIL', code: safeError(error).code, jobId: id }); throw error; }
      }
    });
  }
  async function loadDemo(id: DemoId) {
    if (workspace.storageBusy) return;
    demoJob.current?.abort(); const controller = new AbortController(); demoJob.current = controller;
    setDemoLoading(true); setDemoMessage('Downloading the selected public demo from this site…');
    try {
      const file = await readDemo(id, controller.signal); controller.signal.throwIfAborted();
      selectFiles([file]); resetProfile(); setDemoId(id);
    } catch (error) { if (!controller.signal.aborted) setDemoMessage(safeError(error).message); }
    finally { if (demoJob.current === controller) { demoJob.current = null; setDemoLoading(false); } }
  }
  return { ...runtime, workspace, saveCurrentWorkspace, restoreSavedWorkspace, demoId, demoLoading, demoMessage, loadDemo, run, state, progress, selectFiles, clearSelection, cancelInspection, checkSelection, chooseEntrypoint,
    draftProfile, profileMessage, profileLoading, selection, dosComConfirmed, updateProfile, resetProfile, importProfile, chooseRuntime, confirmDosCom };
}
