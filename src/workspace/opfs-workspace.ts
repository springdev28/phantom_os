import { Zip, ZipPassThrough } from 'fflate';
import type { ExportArtifact, FileArtifact, LocalWorkspace, WorkspaceFile, WorkspaceManifest, WorkspaceRestore, WorkspaceSave } from '../domain/contracts';
import { AppError } from '../domain/errors';
import { blobArtifact, virtualPackage } from '../packages/virtual-package';
import { CHUNK_SIZE, MANIFEST_LIMIT, WORKSPACE_ROOT, createWorkspaceManifest, savedBytes, sha256, validateWorkspaceManifest } from './manifest';

/** Narrow browser API boundary, injectable only for deterministic unit fault tests. */
export interface StorageDirectory {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<StorageDirectory>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    getFile(): Promise<File>;
    createWritable(): Promise<Pick<FileSystemWritableFileStream, 'write' | 'close' | 'abort'>>;
  }>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
}
export interface StorageDriver {
  root(): Promise<StorageDirectory>;
  exclusive<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T>;
  estimate(): Promise<{ usage?: number; quota?: number }>;
}
const browserDriver: StorageDriver = {
  async root() {
    if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks?.request) throw new AppError('STORAGE_UNAVAILABLE');
    return await navigator.storage.getDirectory() as unknown as StorageDirectory;
  },
  async exclusive(signal, work) {
    if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks?.request) throw new AppError('STORAGE_UNAVAILABLE');
    return navigator.locks.request(WORKSPACE_ROOT, { mode: 'exclusive', signal }, work);
  },
  async estimate() { return navigator.storage?.estimate ? navigator.storage.estimate() : {}; },
};
const missing = (error: unknown) => error instanceof Error && error.name === 'NotFoundError';
function storageError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.name === 'QuotaExceededError') return new AppError('STORAGE_QUOTA');
  if (error instanceof Error && ['SecurityError', 'NotAllowedError'].includes(error.name)) return new AppError('STORAGE_DENIED');
  return new AppError('STORAGE_FAILED');
}
const fileName = (group: 'application' | 'documents', index: number) => `${group === 'application' ? 'a' : 'd'}-${index.toString().padStart(4, '0')}`;
const jsonBytes = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
async function readSmall(directory: StorageDirectory, path: string, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const file = await (await directory.getFileHandle(path)).getFile();
  if (file.size > max) throw new AppError('STORAGE_CORRUPT');
  return new Uint8Array(await file.arrayBuffer());
}
async function writeSmall(directory: StorageDirectory, name: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const stream = await (await directory.getFileHandle(name, { create: true })).createWritable();
  try { await stream.write(bytes); await stream.close(); }
  catch (error) { await stream.abort().catch(() => {}); throw error; }
}

/** One explicit, origin-local workspace. Generation commit preserves the prior
 * head until all selected bytes, hashes and manifest have finished writing.
 * Never accesses networking, IndexedDB, user-visible filesystem or runtime globals.
 */
export class OpfsWorkspace implements LocalWorkspace {
  readonly mode = 'persistent' as const;
  constructor(private readonly driver: StorageDriver = browserDriver) {}
  private async operation<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    try { signal.throwIfAborted(); return await this.driver.exclusive(signal, work); }
    catch (error) { signal.throwIfAborted(); throw storageError(error); }
  }
  private async current() {
    let directory: StorageDirectory;
    try { directory = await (await this.driver.root()).getDirectoryHandle(WORKSPACE_ROOT); }
    catch (error) { if (missing(error)) return null; throw error; }
    let bytes: Uint8Array<ArrayBuffer>;
    try { bytes = await readSmall(directory, 'head.json', 1024); }
    catch (error) { if (missing(error)) return null; throw error; }
    try {
      const head: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!head || typeof head !== 'object' || Array.isArray(head) || Object.keys(head).sort().join(',') !== 'revision,schemaVersion,sha256') throw new Error();
      const h = head as Record<string, unknown>;
      if (h.schemaVersion !== 1 || typeof h.revision !== 'string' || !/^[a-f0-9-]{36}$/.test(h.revision)
        || typeof h.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(h.sha256)) throw new Error();
      const revision = await directory.getDirectoryHandle(h.revision);
      const data = await readSmall(revision, 'manifest.json', MANIFEST_LIMIT);
      if (await sha256(data) !== h.sha256) throw new Error();
      const manifest = validateWorkspaceManifest(JSON.parse(new TextDecoder().decode(data)));
      return { directory, revision, manifest, id: h.revision };
    } catch { throw new AppError('STORAGE_CORRUPT'); }
  }
  readManifest(signal: AbortSignal): Promise<WorkspaceManifest | null> {
    return this.operation(signal, async () => (await this.current())?.manifest ?? null);
  }
  async estimate(): Promise<{ usage?: number; quota?: number }> {
    try { return await this.driver.estimate(); } catch { return {}; }
  }
  save(input: WorkspaceSave, signal: AbortSignal): Promise<WorkspaceManifest> {
    // Validate first: failed preflight must not create an OPFS directory.
    const draft = createWorkspaceManifest(input);
    return this.operation(signal, async () => {
      const estimated = await this.estimate();
      // A new complete generation plus a conservative manifest allowance must fit.
      if (estimated.quota !== undefined && estimated.usage !== undefined
        && estimated.quota - estimated.usage < savedBytes(draft) + MANIFEST_LIMIT) throw new AppError('STORAGE_QUOTA');
      const directory = await (await this.driver.root()).getDirectoryHandle(WORKSPACE_ROOT, { create: true });
      const id = crypto.randomUUID(), revision = await directory.getDirectoryHandle(id, { create: true });
      let committed = false;
      try {
        const writeGroup = async (files: readonly FileArtifact[], group: 'application' | 'documents'): Promise<WorkspaceFile[]> => {
          const result: WorkspaceFile[] = [];
          for (const [index, file] of files.entries()) {
            signal.throwIfAborted();
            const stream = await (await revision.getFileHandle(fileName(group, index), { create: true })).createWritable();
            const chunks: string[] = [];
            try {
              for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
                signal.throwIfAborted(); const count = Math.min(CHUNK_SIZE, file.size - offset);
                const bytes = new Uint8Array(await file.read(offset, count, signal));
                if (bytes.length !== count) throw new AppError('READ_FAILED');
                chunks.push(await sha256(bytes)); await stream.write(bytes);
              }
              signal.throwIfAborted(); await stream.close();
            } catch (error) { await stream.abort().catch(() => {}); throw error; }
            result.push({ path: file.path, size: file.size, lastModified: file.lastModified, chunks });
          }
          return result;
        };
        const application = draft.application?.saved && input.application
          ? { ...draft.application, files: await writeGroup(input.application.files, 'application') } : draft.application;
        const documents = input.saveDocuments ? await writeGroup(input.documents, 'documents') : [];
        const manifest = validateWorkspaceManifest({ ...draft, application, documents });
        const bytes = jsonBytes(manifest); if (bytes.length > MANIFEST_LIMIT) throw new AppError('STORAGE_LIMIT');
        await writeSmall(revision, 'manifest.json', bytes); signal.throwIfAborted();
        await writeSmall(directory, 'head.json', jsonBytes({ schemaVersion: 1, revision: id, sha256: await sha256(bytes) }));
        committed = true;
        // Old/interrupted generations are owned by this app. Cleanup cannot undo the new head.
        try {
          for await (const name of directory.keys()) if (name !== id && /^[a-f0-9-]{36}$/.test(name)) await directory.removeEntry(name, { recursive: true }).catch(() => {});
        } catch { /* Commit succeeded; a later save can retry cleanup. */ }
        return manifest;
      } finally {
        if (!committed) await directory.removeEntry(id, { recursive: true }).catch(() => {});
      }
    });
  }
  private async readStored(revision: StorageDirectory, reference: WorkspaceFile, name: string, signal: AbortSignal): Promise<Blob> {
    try {
      const file = await (await revision.getFileHandle(name)).getFile();
      if (file.size !== reference.size || !reference.chunks) throw new AppError('STORAGE_CORRUPT');
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      for (let offset = 0, index = 0; offset < file.size; offset += CHUNK_SIZE, index++) {
        signal.throwIfAborted(); const bytes = new Uint8Array(await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer());
        if (await sha256(bytes) !== reference.chunks[index]) throw new AppError('STORAGE_CORRUPT');
        chunks.push(bytes);
      }
      return new Blob(chunks);
    } catch { signal.throwIfAborted(); throw new AppError('STORAGE_CORRUPT'); }
  }
  restore(signal: AbortSignal): Promise<WorkspaceRestore> {
    return this.operation(signal, async () => {
      const current = await this.current(); if (!current) throw new AppError('STORAGE_MISSING');
      const { revision, manifest } = current;
      const readGroup = async (references: readonly WorkspaceFile[], group: 'application' | 'documents') => {
        const files = [];
        for (const [index, reference] of references.entries()) files.push({ path: reference.path, lastModified: reference.lastModified,
          blob: await this.readStored(revision, reference, fileName(group, index), signal) });
        return files;
      };
      const stored = manifest.application;
      const raw = stored?.saved ? virtualPackage({ files: await readGroup(stored.files, 'application'), directories: stored.directories }, stored.origin, stored.label) : null;
      const application = raw ? { ...raw, files: raw.files.map(file => ({ ...file, source: 'workspace' as const })) } : null;
      const documents = (await readGroup(manifest.documents, 'documents')).map(file => blobArtifact(file, 'workspace'));
      return { manifest, application, documents };
    });
  }
  exportBackup(signal: AbortSignal): Promise<ExportArtifact> {
    return this.operation(signal, async () => {
      const current = await this.current(); if (!current) throw new AppError('STORAGE_MISSING');
      const { revision, manifest } = current;
      const output: Uint8Array<ArrayBuffer>[] = [];
      let failure: Error | null = null;
      const zip = new Zip((error, data) => { if (error) failure = error; else output.push(new Uint8Array(data)); });
      const add = (path: string, bytes: Uint8Array<ArrayBuffer>) => { const entry = new ZipPassThrough(path); zip.add(entry); entry.push(bytes, true); };
      add('manifest.json', jsonBytes(manifest)); add('launch-profile.json', jsonBytes(manifest.profile));
      for (const group of ['application', 'documents'] as const) {
        const references = group === 'application' ? manifest.application?.saved ? manifest.application.files : [] : manifest.documents;
        for (const [index, reference] of references.entries()) {
          signal.throwIfAborted(); const blob = await this.readStored(revision, reference, fileName(group, index), signal);
          const entry = new ZipPassThrough(`${group}/${reference.path}`); zip.add(entry);
          if (!blob.size) entry.push(new Uint8Array(), true);
          for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
            signal.throwIfAborted(); entry.push(new Uint8Array(await blob.slice(offset, offset + CHUNK_SIZE).arrayBuffer()), offset + CHUNK_SIZE >= blob.size);
          }
        }
      }
      // Empty package directories are portable too; no implicit host folders are created.
      if (manifest.application?.saved) for (const directory of manifest.application.directories) add(`application/${directory}/`, new Uint8Array());
      zip.end(); if (failure) throw new AppError('STORAGE_FAILED');
      return { path: 'phantom-workspace-backup.zip', blob: new Blob(output, { type: 'application/zip' }) };
    });
  }
  remove(signal: AbortSignal): Promise<void> {
    return this.operation(signal, async () => {
      try { await (await this.driver.root()).removeEntry(WORKSPACE_ROOT, { recursive: true }); }
      catch (error) { if (!missing(error)) throw error; }
    });
  }
}
export const localWorkspace = new OpfsWorkspace();
