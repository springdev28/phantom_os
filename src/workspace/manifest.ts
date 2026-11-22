import type { WorkspaceFile, WorkspaceManifest, WorkspaceSave } from '../domain/contracts';
import { AppError } from '../domain/errors';
import { PathIndex, safePath } from '../packages/paths';
import { validateLaunchProfile } from '../profiles/launch-profile';

export const WORKSPACE_ROOT = 'phantom-workspace-v1';
export const CHUNK_SIZE = 1024 * 1024;
export const MANIFEST_LIMIT = 2 * CHUNK_SIZE;
export const WORKSPACE_LIMIT = 128 * CHUNK_SIZE;
const hash = /^[a-f0-9]{64}$/;
const bad = (): never => { throw new AppError('STORAGE_CORRUPT'); };
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad();
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || keys.some(key => !Object.hasOwn(item, key))) return bad();
  return item;
}
function entries(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 2048) return bad();
  return value;
}
function files(value: unknown, saved: boolean, directories: readonly string[] = []): WorkspaceFile[] {
  const index = new PathIndex(); for (const directory of directories) index.add(directory, true);
  return entries(value).map(item => {
    const f = object(item, ['path', 'size', 'lastModified', 'chunks']);
    if (typeof f.path !== 'string' || index.add(f.path) !== f.path || !Number.isSafeInteger(f.size) || Number(f.size) < 0 || Number(f.size) > 64 * CHUNK_SIZE
      || !Number.isSafeInteger(f.lastModified) || Number(f.lastModified) < 0 || Number(f.lastModified) > 8_640_000_000_000_000) return bad();
    if (saved ? !Array.isArray(f.chunks) || f.chunks.length !== Math.ceil(Number(f.size) / CHUNK_SIZE)
      || f.chunks.some(chunk => typeof chunk !== 'string' || !hash.test(chunk)) : f.chunks !== null) return bad();
    return { path: f.path, size: Number(f.size), lastModified: Number(f.lastModified), chunks: saved ? [...f.chunks as string[]] : null };
  });
}
/** Data validation and integrity are not an observed launch or a trust signature. */
export function validateWorkspaceManifest(value: unknown): WorkspaceManifest {
  try {
    const m = object(value, ['schemaVersion', 'savedAt', 'profile', 'runtimeAssets', 'application', 'documents']);
    if (m.schemaVersion !== 1 || typeof m.savedAt !== 'string' || m.savedAt.length > 30 || !Number.isFinite(Date.parse(m.savedAt))) return bad();
    const profile = validateLaunchProfile(m.profile);
    let application: WorkspaceManifest['application'] = null;
    if (m.application !== null) {
      const a = object(m.application, ['label', 'origin', 'directories', 'files', 'saved']);
      if (typeof a.label !== 'string' || a.label.length > 255 || !['files', 'folder', 'zip'].includes(String(a.origin)) || typeof a.saved !== 'boolean') return bad();
      const directories = entries(a.directories).map(path => {
        if (typeof path !== 'string' || safePath(path) !== path) return bad(); return path;
      });
      application = { label: a.label, origin: a.origin as 'files' | 'folder' | 'zip', directories, saved: a.saved, files: files(a.files, a.saved, directories) };
      if (!application.files.length || application.files.reduce((sum, f) => sum + f.size, 0) > WORKSPACE_LIMIT) return bad();
    }
    const documents = files(m.documents, true);
    if (documents.some(file => file.path.toLowerCase() === profile.entrypoint?.toLowerCase())) return bad();
    if (documents.reduce((sum, file) => sum + file.size, 0) > 32 * CHUNK_SIZE) return bad();
    const ids = new Set<string>();
    const runtimeAssets = entries(m.runtimeAssets).map(value => {
      const a = object(value, ['id', 'sha256']);
      if (typeof a.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,160}$/.test(a.id) || ids.has(a.id) || typeof a.sha256 !== 'string' || !hash.test(a.sha256)) return bad();
      ids.add(a.id); return { id: a.id, sha256: a.sha256 };
    });
    const result: WorkspaceManifest = { schemaVersion: 1, savedAt: m.savedAt, profile, runtimeAssets, application, documents };
    if (savedBytes(result) > WORKSPACE_LIMIT) return bad();
    return result;
  } catch { return bad(); }
}
export function savedBytes(manifest: WorkspaceManifest): number {
  return (manifest.application?.saved ? manifest.application.files.reduce((sum, file) => sum + file.size, 0) : 0)
    + manifest.documents.reduce((sum, file) => sum + file.size, 0);
}
export function createWorkspaceManifest(input: WorkspaceSave): WorkspaceManifest {
  const file = (f: { path: string; size: number; lastModified: number }, saved: boolean): WorkspaceFile => ({
    path: f.path, size: f.size, lastModified: f.lastModified, chunks: saved ? Array.from({ length: Math.ceil(f.size / CHUNK_SIZE) }, () => '0'.repeat(64)) : null,
  });
  // Preflight sizes before constructing a potentially unbounded hash array.
  const all = [...(input.application?.files ?? []), ...input.documents];
  if (all.length > 4096 || all.some(f => !Number.isSafeInteger(f.size) || f.size < 0 || f.size > 64 * CHUNK_SIZE)
    || (input.application?.totalBytes ?? 0) > WORKSPACE_LIMIT
    || input.documents.reduce((sum, f) => sum + f.size, 0) > 32 * CHUNK_SIZE) throw new AppError('STORAGE_LIMIT');
  const candidate = { schemaVersion: 1, savedAt: new Date().toISOString(), profile: input.profile, runtimeAssets: input.runtimeAssets,
    application: input.application ? { label: input.application.label, origin: input.application.origin, directories: input.application.directories,
      saved: input.saveSoftware, files: input.application.files.map(f => file(f, input.saveSoftware)) } : null,
    documents: input.saveDocuments ? input.documents.map(f => file(f, true)) : [],
  };
  if (savedBytes(candidate as WorkspaceManifest) > WORKSPACE_LIMIT) throw new AppError('STORAGE_LIMIT');
  return validateWorkspaceManifest(candidate);
}
export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
