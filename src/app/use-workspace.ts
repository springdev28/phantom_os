import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceManifest, WorkspaceRestore, WorkspaceSave } from '../domain/contracts';
import { safeError } from '../domain/errors';
import { localWorkspace } from '../workspace/opfs-workspace';
import { verifyWorkspaceRuntime } from '../workspace/launch';
import { runtimeRegistry } from '../runtime/registry';
import { downloadLocal } from './download';
import { logger } from './logger';

export function useWorkspace(onInitialProfile: (manifest: WorkspaceManifest) => void) {
  const [savedWorkspace, setSavedWorkspace] = useState<WorkspaceManifest | null>(null);
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState('Checking browser-local storage…');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<{ usage?: number; quota?: number }>({});
  const active = useRef<AbortController | null>(null), initialization = useRef<AbortController | null>(null);
  const refreshStorageUsage = useCallback(async () => { setStorageEstimate(await localWorkspace.estimate()); }, []);
  useEffect(() => {
    const controller = new AbortController(); initialization.current = controller;
    void (async () => {
      try {
        const manifest = await localWorkspace.readManifest(controller.signal); controller.signal.throwIfAborted();
        setSavedWorkspace(manifest);
        if (manifest) {
          verifyWorkspaceRuntime(manifest, runtimeRegistry.list()); onInitialProfile(manifest);
          setStorageMessage(manifest.application?.saved ? 'Saved workspace found. Profile validated; restore the saved files to continue. Nothing auto-runs.'
            : 'Saved profile restored. Original software was not saved. Select it again, then restore any saved working files. Nothing auto-runs.');
        } else setStorageMessage('Temporary mode. No saved workspace.');
      } catch (error) {
        if (controller.signal.aborted) return;
        const failure = safeError(error); setStorageMessage(failure.message);
        if (['STORAGE_UNAVAILABLE', 'STORAGE_DENIED'].includes(failure.code)) setStorageAvailable(false);
      }
      if (!controller.signal.aborted) await refreshStorageUsage();
    })();
    return () => { controller.abort(); active.current?.abort(); };
  }, [onInitialProfile, refreshStorageUsage]);

  async function action(work: (signal: AbortSignal) => Promise<string>) {
    if (active.current) return;
    initialization.current?.abort();
    const controller = new AbortController(); active.current = controller; setStorageBusy(true);
    setStorageMessage('Working locally…');
    try { const message = await work(controller.signal); controller.signal.throwIfAborted(); setStorageMessage(message); }
    catch (error) {
      if (!controller.signal.aborted) { const failure = safeError(error); setStorageMessage(failure.message); logger.record('app.error', failure.code); }
    } finally {
      if (active.current === controller) { active.current = null; setStorageBusy(false); }
      if (!controller.signal.aborted) await refreshStorageUsage();
    }
  }
  async function saveWorkspace(input: WorkspaceSave) {
    if (!storageEnabled) return;
    await action(async signal => {
      const manifest = await localWorkspace.save(input, signal); setSavedWorkspace(manifest);
      return 'Workspace saved in this browser origin. Only the checked file categories were copied. Export a backup for retention beyond this browser.';
    });
  }
  async function restoreWorkspace(apply: (restored: WorkspaceRestore, signal: AbortSignal) => Promise<void>) {
    await action(async signal => {
      const manifest = await localWorkspace.readManifest(signal);
      if (manifest) verifyWorkspaceRuntime(manifest, runtimeRegistry.list());
      const restored = await localWorkspace.restore(signal); verifyWorkspaceRuntime(restored.manifest, runtimeRegistry.list());
      await apply(restored, signal); setSavedWorkspace(restored.manifest);
      return restored.application ? 'Workspace restored and files re-inspected. Review compatibility and start explicitly. Working files are snapshots, not a running session.'
        : 'Profile and saved working files restored. Select the original application files if missing; software bytes were not saved.';
    });
  }
  async function exportBackup() {
    await action(async signal => { const artifact = await localWorkspace.exportBackup(signal); signal.throwIfAborted(); downloadLocal(artifact);
      return 'Backup exported to your downloads. It includes only previously saved bytes, a portable manifest, and launch-profile.json. Unsaved memory and live guest changes are excluded.'; });
  }
  async function deleteWorkspace() {
    await action(async signal => { await localWorkspace.remove(signal); setSavedWorkspace(null); setStorageEnabled(false);
      return 'Saved workspace deleted from this browser origin. Current temporary files, original files and downloaded exports are unchanged.'; });
  }
  function toggleStorage(value: boolean) {
    if (active.current) return;
    setStorageEnabled(value);
    setStorageMessage(value ? 'Manual saving enabled. Choose what to save, then select Save workspace.'
      : 'Temporary mode. No new writes. An existing saved copy remains until you delete it.');
  }
  return { savedWorkspace, storageEnabled, storageBusy, storageMessage, storageAvailable, storageEstimate,
    toggleStorage, saveWorkspace, restoreWorkspace, exportBackup, deleteWorkspace, refreshStorageUsage };
}
