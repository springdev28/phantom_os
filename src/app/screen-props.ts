import type { SessionState } from '../domain/session-machine';
import type { InputKind } from '../intake/local-file';
import type { ImportProgress } from '../packages/zip';
import type { FileArtifact, GuestFile, LaunchProfile, RuntimeSelection, SessionEvent } from '../domain/contracts';
import type { useWorkspace } from './use-workspace';
import type { DemoId } from './demos';

export interface ScreenProps {
  readonly demoId: DemoId | null;
  readonly demoLoading: boolean;
  readonly demoMessage: string;
  loadDemo(id: DemoId): Promise<void>;
  readonly state: SessionState;
  readonly progress: ImportProgress | null;
  openFile(): void;
  openZip(): void;
  openFolder(): void;
  selectFiles(files: readonly File[], kind?: InputKind): void;
  checkSelection(): Promise<void>;
  cancelInspection(): void;
  clearSelection(): void;
  chooseEntrypoint(path: string): void;
  readonly draftProfile: LaunchProfile | null;
  readonly profileMessage: string;
  readonly profileLoading: boolean;
  readonly selection: RuntimeSelection;
  readonly dosComConfirmed: boolean;
  updateProfile(profile: LaunchProfile): void;
  resetProfile(): void;
  importProfile(file: File): Promise<void>;
  chooseRuntime(selection: RuntimeSelection): void;
  confirmDosCom(value: boolean): void;
  run(viewport: HTMLElement): Promise<void>;
  stopRuntime(): Promise<void>;
  readonly runtimeProgress: string;
  readonly runtimeMessage: string;
  readonly runtimeFocused: boolean;
  readonly runtimeRemaining: number | null;
  focusRuntime(): void;
  releaseRuntimeInput(): void;
  readonly runtimeMetrics: Extract<SessionEvent, { type: 'metrics' }> | null;
  readonly guestFiles: readonly GuestFile[];
  refreshGuestFiles(): Promise<void>;
  exportGuestFile(path: string): Promise<void>;
  readonly transferBusy: boolean;
  readonly workingFiles: readonly FileArtifact[];
  importDocument(file: File): Promise<void>;
  captureWorkingFile(path: string, entrypoint: string | null): Promise<void>;
  removeWorkingFile(path: string): void;
  readonly workspace: ReturnType<typeof useWorkspace>;
  saveCurrentWorkspace(saveSoftware: boolean, saveDocuments: boolean): Promise<void>;
  restoreSavedWorkspace(): Promise<void>;
}
export function selectedFile(state: SessionState) {
  if (!('pkg' in state) || !state.pkg) return undefined;
  return state.pkg.entrypoint ? state.pkg.files.find(file => file.path === state.pkg?.entrypoint)
    : state.pkg.files.length === 1 ? state.pkg.files[0] : undefined;
}
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
