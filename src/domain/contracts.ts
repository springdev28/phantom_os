/** PHANTOM contracts, not emulator vendor APIs. None of these types imply support. */
export type CapabilityStatus = 'planned' | 'experimental' | 'verified' | 'unsupported';
export type RuntimeId = 'js-dos' | 'boxedwine';
export type Format = 'dos-com-ambiguous' | 'dos-mz' | 'ne' | 'pe32' | 'pe32+'
  | 'elf' | 'zip' | 'iso9660' | 'mbr-disk' | 'gpt-disk' | 'disk-image-ambiguous' | 'unknown';

export interface FileArtifact {
  readonly id: string;
  readonly path: string;
  readonly size: number;
  readonly lastModified: number;
  readonly source: 'selection' | 'archive' | 'workspace' | 'fixture';
  read(offset: number, length: number, signal: AbortSignal): Promise<Uint8Array>;
}
export type LocalFile = FileArtifact;

export interface ProbeEvidence {
  readonly offset: number;
  readonly length: number;
  readonly label: string;
  readonly hex: string;
  readonly interpretation: string;
}
export interface ProbeDiagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly offset?: number;
}
/** Header recognition only. No field in this result can grant execution support. */
export interface ProbeResult {
  readonly scope: 'static-inspection';
  readonly fileSize: number;
  readonly format: Format;
  readonly architecture?: string;
  readonly bitness?: 16 | 32 | 64;
  readonly endianness?: 'little' | 'big';
  readonly subsystem?: string;
  readonly platform?: string;
  readonly kind?: string;
  readonly confidence: 'certain-format' | 'probable' | 'ambiguous';
  readonly ambiguity: readonly string[];
  readonly evidence: readonly ProbeEvidence[];
  readonly warnings: readonly ProbeDiagnostic[];
  readonly validity: 'valid-header' | 'partial' | 'invalid' | 'unknown';
  readonly localAccess: 'readable' | 'not-checked';
  readonly notInferred: readonly string[];
  readonly executableCompatibility: 'not-assessed';
  readonly readStats: {
    readonly bytesRead: number;
    readonly operations: number;
    readonly budgetBytes: number;
    readonly rangeLimitBytes: number;
  };
}

export interface CandidateEntrypoint {
  readonly path: string;
  readonly reason: string;
  readonly format: Format;
  readonly caution: string;
}
export interface PackageResource {
  readonly path: string;
  readonly kind: 'library' | 'configuration' | 'data' | 'documentation' | 'script' | 'archive' | 'disk-image' | 'unclassified';
  readonly reason: string;
}
/** One immutable virtual filesystem shared by inspection and future adapters.
 * Paths are relative, validated and collision-free. No host paths or archive scripts.
 * Choosing an entrypoint changes metadata only; files and directories stay intact.
 */
export interface ApplicationPackage {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly label: string;
  readonly origin: 'files' | 'folder' | 'zip';
  readonly files: readonly FileArtifact[];
  readonly directories: readonly string[];
  readonly totalBytes: number;
  readonly candidates: readonly CandidateEntrypoint[];
  readonly resources: readonly PackageResource[];
  readonly warnings: readonly string[];
  readonly entrypoint?: string;
  /** Explicit requirements, not guessed from filenames or header confidence. */
  readonly requiredFiles?: readonly RequiredFile[];
}
export type Inspection = ReadonlyMap<string, ProbeResult>;
export interface PackageInspector {
  inspect(pkg: ApplicationPackage, signal: AbortSignal): Promise<Inspection>;
}

export interface RuntimeDescriptor {
  readonly id: RuntimeId;
  readonly name: string;
  readonly buildId?: string;
  readonly version?: string;
  readonly maturity: CapabilityStatus;
  readonly available: boolean;
  readonly formats: readonly Format[];
  readonly rules: readonly ExecutableCapability[];
  readonly diskEnvironments: readonly DiskEnvironmentCapability[];
  readonly assets: readonly RuntimeAsset[];
  readonly requirements: readonly string[];
  readonly maxGuestMemoryMiB: number;
  /** App-owned adoption blockers. Profiles and overrides cannot waive these. */
  readonly blockers?: readonly Pick<PlanIssue, 'code' | 'message' | 'action'>[];
  readonly capabilities: {
    readonly keyboard: boolean;
    readonly mouse: boolean;
    readonly audio: boolean;
    readonly fileImport: 'live' | 'before-launch' | 'none';
    readonly fileExport: 'live' | 'after-stop' | 'none';
    readonly guestNetworking: 'disabled';
  };
}

export interface ExecutableCapability {
  readonly id: 'dos-com' | 'dos-mz' | 'windows-ne' | 'windows-pe32';
  readonly format: 'dos-com-ambiguous' | 'dos-mz' | 'ne' | 'pe32';
  readonly maturity: CapabilityStatus;
  readonly justification: string;
  readonly requirements: readonly string[];
}
/** Explicit environment allow-list, not a promise that an arbitrary disk boots. */
export interface DiskEnvironmentCapability {
  readonly id: string;
  readonly label: string;
  readonly formats: readonly ('iso9660' | 'mbr-disk' | 'gpt-disk')[];
  readonly maturity: CapabilityStatus;
  readonly requirements: readonly string[];
}
export interface RuntimeAsset {
  readonly id: string;
  readonly sha256: string;
  readonly installed: boolean;
}
export type RuntimeSelection = { readonly mode: 'automatic' }
  | { readonly mode: 'override'; readonly runtimeId: RuntimeId };
export interface RequiredFile {
  readonly path: string;
  readonly kind: 'library' | 'data' | 'configuration' | 'package-member';
}
export interface PlanIssue {
  readonly code: string;
  readonly message: string;
  readonly action: string;
  readonly blocking: boolean;
  readonly path?: string;
}
/** Opaque, process-local identity; only the local fingerprint service creates one. */
declare const identityBrand: unique symbol;
export interface VerificationIdentity { readonly [identityBrand]: true; }
export interface PlanningRequest {
  readonly selection?: RuntimeSelection;
  readonly profile?: LaunchProfile;
  readonly dosComConfirmed?: boolean;
  readonly identity?: VerificationIdentity;
}

export interface CompatibilityPlan {
  readonly decision: 'verified-compatible' | 'candidate' | 'needs-files'
    | 'experimental' | 'unsupported' | 'invalid';
  readonly runtimeId?: RuntimeId;
  readonly runtimeBuildId?: string;
  readonly entrypoint?: string;
  readonly canLaunch: boolean;
  readonly selection: RuntimeSelection;
  readonly automaticRuntimeId?: RuntimeId;
  readonly engineInstalled: boolean;
  readonly issues: readonly PlanIssue[];
  readonly missingFiles: readonly RequiredFile[];
  readonly reasons: readonly string[];
  readonly requirements: readonly string[];
  readonly warnings: readonly string[];
  readonly verificationRecordId?: string;
}
export interface CompatibilityPlanner {
  plan(pkg: ApplicationPackage, evidence: Inspection,
    runtimes: readonly RuntimeDescriptor[], request?: PlanningRequest): CompatibilityPlan;
}

export interface DosSettings {
  readonly cycles: number;
  readonly core: 'auto' | 'normal' | 'simple';
  readonly machine: 'svga_s3' | 'vgaonly' | 'ega';
  readonly xms: boolean;
  readonly ems: boolean;
}
export interface LaunchProfile {
  readonly schemaVersion: 1;
  /** Null means an unresolved draft, never an invented version or executable. */
  readonly runtimeId: RuntimeId | null;
  readonly runtimeVersion: string | null;
  readonly runtimeBuildId: string | null;
  readonly selectionMode: RuntimeSelection['mode'];
  readonly entrypoint: string | null;
  readonly cwd: string;
  readonly mounts: readonly { packagePath: string; guestPath: string; readOnly: boolean }[];
  readonly controls: { readonly keyboard: 'us'; readonly mouse: 'off' | 'absolute' | 'captured'; readonly audio: boolean };
  readonly requiredFiles: readonly RequiredFile[];
  readonly diskEnvironment: string | null;
  readonly limits: { guestMemoryMiB: number; maxSessionMs: number };
  readonly dos?: DosSettings;
}
export interface ExportArtifact { readonly path: string; readonly blob: Blob; }
export interface GuestFile { readonly path: string; readonly size: number; }
export type SessionEvent =
  | { type: 'state'; state: 'preparing' | 'running' | 'stopped' }
  | { type: 'input'; focused: boolean }
  | { type: 'metrics'; frames: number; audioSamples: number; audioPeak: number; keyEvents: number; mouseEvents: number }
  | { type: 'error'; code: string; message: string; recoverable: boolean };
export interface PreparedSession {
  readonly id: string;
  dispose(): Promise<void>;
}
export interface RuntimeSession {
  readonly id: string;
  onEvent(listener: (event: SessionEvent) => void): () => void;
  focusInput(): void;
  releaseInput(): void;
  importFiles(files: readonly FileArtifact[], signal: AbortSignal): Promise<void>;
  listFiles(signal: AbortSignal): Promise<readonly GuestFile[]>;
  exportFiles(paths: readonly string[], signal: AbortSignal): Promise<readonly ExportArtifact[]>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
export interface RuntimeAdapter {
  readonly descriptor: RuntimeDescriptor;
  probe(pkg: ApplicationPackage, evidence: Inspection):
    { candidate: boolean; requirements: readonly string[]; reasons: readonly string[] };
  prepare(pkg: ApplicationPackage, profile: LaunchProfile, signal: AbortSignal, progress?: (value: RuntimeProgress) => void): Promise<PreparedSession>;
  launch(prepared: PreparedSession, viewport: HTMLElement, signal: AbortSignal): Promise<RuntimeSession>;
}
export interface RuntimeProgress { readonly phase: 'staging' | 'runtime-files'; readonly completed: number; readonly total: number; }
export interface SessionRecord {
  readonly id: string;
  readonly profile: LaunchProfile;
  readonly packageKey?: string;
  readonly updatedAt: string;
}
export interface LocalWorkspace {
  readonly mode: 'temporary' | 'persistent';
  readManifest(signal: AbortSignal): Promise<WorkspaceManifest | null>;
  save(input: WorkspaceSave, signal: AbortSignal): Promise<WorkspaceManifest>;
  restore(signal: AbortSignal): Promise<WorkspaceRestore>;
  exportBackup(signal: AbortSignal): Promise<ExportArtifact>;
  remove(signal: AbortSignal): Promise<void>;
  estimate(): Promise<{ usage?: number; quota?: number }>;
}
export interface WorkspaceFile {
  readonly path: string;
  readonly size: number;
  readonly lastModified: number;
  /** SHA-256 per 1 MiB chunk; null means references only, no bytes saved. */
  readonly chunks: readonly string[] | null;
}
export interface WorkspaceManifest {
  readonly schemaVersion: 1;
  readonly savedAt: string;
  readonly profile: LaunchProfile;
  readonly runtimeAssets: readonly { id: string; sha256: string }[];
  readonly application: null | {
    readonly label: string;
    readonly origin: ApplicationPackage['origin'];
    readonly directories: readonly string[];
    readonly files: readonly WorkspaceFile[];
    readonly saved: boolean;
  };
  readonly documents: readonly WorkspaceFile[];
}
export interface WorkspaceSave {
  readonly profile: LaunchProfile;
  readonly application: ApplicationPackage | null;
  readonly documents: readonly FileArtifact[];
  readonly saveSoftware: boolean;
  readonly saveDocuments: boolean;
  readonly runtimeAssets: readonly { id: string; sha256: string }[];
}
export interface WorkspaceRestore {
  readonly manifest: WorkspaceManifest;
  readonly application: ApplicationPackage | null;
  readonly documents: readonly FileArtifact[];
}
