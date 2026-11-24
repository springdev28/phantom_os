import { describe, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import type { WorkspaceSave } from '../domain/contracts';
import { OpfsWorkspace } from './opfs-workspace';
import type { StorageDirectory, StorageDriver } from './opfs-workspace';
import { createWorkspaceManifest, validateWorkspaceManifest, WORKSPACE_ROOT, CHUNK_SIZE } from './manifest';
import { verifyWorkspaceRuntime, withWorkingFiles } from './launch';
import { dosDescriptor } from '../runtime/dos/descriptor';
import { inspectedFixture } from '../../tests/fixtures/planner-fixtures';
import { mzFixture } from '../../tests/fixtures/probe-fixtures';
import { createLaunchProfile } from '../profiles/launch-profile';
import { compatibilityPlanner } from '../planner/compatibility-planner';
import { blobArtifact } from '../packages/virtual-package';
import { validateDocumentImport } from '../runtime/dos/transfers';

// Unit-only fault injection. Browser acceptance uses native OPFS and real DOS.
class MemoryDirectory implements StorageDirectory {
  readonly dirs = new Map<string, MemoryDirectory>();
  readonly files = new Map<string, File>();
  constructor(readonly faults: { error?: string } = {}) {}
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (!this.dirs.has(name) && options?.create) this.dirs.set(name, new MemoryDirectory(this.faults));
    const dir = this.dirs.get(name); if (!dir) throw new DOMException('', 'NotFoundError'); return dir;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name)) { if (!options?.create) throw new DOMException('', 'NotFoundError'); this.files.set(name, new File([], name)); }
    return { getFile: async () => this.files.get(name)!, createWritable: async () => {
      const parts: BlobPart[] = [];
      return { write: async (part: FileSystemWriteChunkType) => {
        if (this.faults.error) throw new DOMException('private content must not escape', this.faults.error);
        parts.push(part as BlobPart);
      }, close: async () => { this.files.set(name, new File(parts, name)); }, abort: async () => {} };
    } };
  }
  async removeEntry(name: string) { if (!this.dirs.delete(name) && !this.files.delete(name)) throw new DOMException('', 'NotFoundError'); }
  async *keys() { yield* this.dirs.keys(); yield* this.files.keys(); }
}
function setup() {
  const root = new MemoryDirectory();
  let tail: Promise<unknown> = Promise.resolve();
  const driver: StorageDriver = { root: async () => root, estimate: async () => ({ usage: 0, quota: 1024 ** 3 }),
    exclusive: async (_signal, work) => { const result = tail.then(work); tail = result.catch(() => {}); return result; } };
  return { root, driver, storage: new OpfsWorkspace(driver) };
}
const signal = () => new AbortController().signal;
const document = (text = 'changed inside guest') => blobArtifact({ path: 'RESULT.TXT', blob: new Blob([text]), lastModified: 0 }, 'workspace');
async function input(): Promise<WorkspaceSave> {
  const { pkg, inspection } = await inspectedFixture(mzFixture(), 'TEST.EXE');
  const profile = createLaunchProfile(pkg, compatibilityPlanner.plan(pkg, inspection, [dosDescriptor]), dosDescriptor);
  return { profile, application: pkg, documents: [document()], saveSoftware: true, saveDocuments: true,
    runtimeAssets: dosDescriptor.assets.map(({ id, sha256 }) => ({ id, sha256 })) };
}
async function revision(root: MemoryDirectory) {
  const dir = await root.getDirectoryHandle(WORKSPACE_ROOT);
  const head = JSON.parse(await dir.files.get('head.json')!.text());
  return dir.getDirectoryHandle(head.revision as string);
}
describe('opt-in bounded OPFS workspace', () => {
  it('reading an absent workspace creates nothing', async () => {
    const { root, storage } = setup(); expect(await storage.readManifest(signal())).toBeNull(); expect(root.dirs.size).toBe(0);
    await expect(storage.restore(signal())).rejects.toMatchObject({ code: 'STORAGE_MISSING' });
  });
  it('profile-only never reads software or documents, even when selected', async () => {
    const { storage } = setup(), source = await input();
    const read = vi.fn().mockRejectedValue(new Error('must not read'));
    const manifest = await storage.save({ ...source, application: { ...source.application!, files: source.application!.files.map(f => ({ ...f, read })) },
      documents: [{ ...document(), read }], saveSoftware: false, saveDocuments: false }, signal());
    expect(read).not.toHaveBeenCalled(); expect(manifest.application?.files[0]?.chunks).toBeNull(); expect(manifest.documents).toEqual([]);
    expect((await storage.restore(signal())).application).toBeNull();
    const zip = unzipSync(new Uint8Array(await (await storage.exportBackup(signal())).blob.arrayBuffer()));
    expect(Object.keys(zip).sort()).toEqual(['launch-profile.json', 'manifest.json']);
    expect(JSON.parse(strFromU8(zip['launch-profile.json']!))).toEqual(source.profile);
  });
  it('round trips opted-in software and working-file bytes with bounded reads and portable backup', async () => {
    const { storage } = setup(), source = await input();
    const large = new Blob([new Uint8Array(CHUNK_SIZE + 7).fill(42)]);
    const original = blobArtifact({ path: 'RESULT.TXT', blob: large, lastModified: 0 }, 'workspace'), read = vi.fn(original.read), file = { ...original, read };
    const manifest = await storage.save({ ...source, documents: [file] }, signal());
    expect(read.mock.calls.every(([, length]) => length <= CHUNK_SIZE)).toBe(true); expect(manifest.documents[0]?.chunks).toHaveLength(2);
    const restored = await storage.restore(signal());
    expect(restored.application?.files[0]?.source).toBe('workspace');
    expect(await restored.documents[0]!.read(CHUNK_SIZE, 7, signal())).toEqual(new Uint8Array(7).fill(42));
    const zip = unzipSync(new Uint8Array(await (await storage.exportBackup(signal())).blob.arrayBuffer()));
    expect(zip['documents/RESULT.TXT']).toEqual(new Uint8Array(await large.arrayBuffer()));
    expect(zip['application/TEST.EXE']).toEqual(mzFixture());
  });
  it.each(['QuotaExceededError', 'NotAllowedError', 'UnknownError'])('failed replacement %s preserves the prior committed bytes', async fault => {
    const { root, storage } = setup(), source = await input(); const original = await storage.save(source, signal());
    root.faults.error = fault;
    await expect(storage.save({ ...source, documents: [document('replacement')] }, signal())).rejects.toMatchObject({ code: fault === 'QuotaExceededError' ? 'STORAGE_QUOTA' : fault === 'NotAllowedError' ? 'STORAGE_DENIED' : 'STORAGE_FAILED' });
    delete root.faults.error;
    expect(await storage.readManifest(signal())).toEqual(original);
    expect(new TextDecoder().decode(await (await storage.restore(signal())).documents[0]!.read(0, 20, signal()))).toBe('changed inside guest');
    expect((await root.getDirectoryHandle(WORKSPACE_ROOT)).dirs.size).toBe(1);
  });
  it('cancellation halfway through a write retains the old head and cleans the partial generation', async () => {
    const { root, storage } = setup(), source = await input(); const original = await storage.save(source, signal());
    const controller = new AbortController();
    const file = { ...document('new'), read: async () => { controller.abort(); return new TextEncoder().encode('new'); } };
    await expect(storage.save({ ...source, documents: [file] }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await storage.readManifest(signal())).toEqual(original); expect((await root.getDirectoryHandle(WORKSPACE_ROOT)).dirs.size).toBe(1);
  });
  it('quota preflight performs no writes; estimates may be unavailable', async () => {
    const { root, driver } = setup(), storage = new OpfsWorkspace({ ...driver, estimate: async () => ({ quota: 1, usage: 0 }) });
    await expect(storage.save(await input(), signal())).rejects.toMatchObject({ code: 'STORAGE_QUOTA' }); expect(root.dirs.size).toBe(0);
    const unavailable = new OpfsWorkspace({ ...driver, estimate: async () => { throw new Error(); } }); expect(await unavailable.estimate()).toEqual({});
  });
  it('tampered same-size working bytes fail hash verification on restore and backup', async () => {
    const { root, storage } = setup(); await storage.save(await input(), signal());
    const rev = await revision(root); rev.files.set('d-0000', new File(['tamper'.padEnd(20)], 'd-0000'));
    await expect(storage.restore(signal())).rejects.toMatchObject({ code: 'STORAGE_CORRUPT' });
    await expect(storage.exportBackup(signal())).rejects.toMatchObject({ code: 'STORAGE_CORRUPT' });
  });
  it('a corrupt manifest is rejected without applying its paths or runtime settings', async () => {
    const { root, storage } = setup(); await storage.save(await input(), signal());
    (await revision(root)).files.set('manifest.json', new File(['{}'], 'manifest.json'));
    await expect(storage.readManifest(signal())).rejects.toMatchObject({ code: 'STORAGE_CORRUPT' });
  });
  it('serialized saves commit whole generations and delete only the owned root', async () => {
    const { root, storage } = setup(), source = await input();
    await root.getDirectoryHandle('unrelated-origin-data', { create: true });
    await Promise.all([storage.save(source, signal()), storage.save({ ...source, documents: [document('latest')] }, signal())]);
    expect(new TextDecoder().decode(await (await storage.restore(signal())).documents[0]!.read(0, 6, signal()))).toBe('latest');
    await storage.remove(signal()); await storage.remove(signal());
    expect([...root.dirs.keys()]).toEqual(['unrelated-origin-data']);
  });
  it('saving profile-only over a full save removes previously retained files', async () => {
    const { root, storage } = setup(), source = await input(); await storage.save(source, signal());
    await storage.save({ ...source, saveSoftware: false, saveDocuments: false }, signal());
    expect([...(await revision(root)).files.keys()]).toEqual(['manifest.json']);
  });
});
describe('stored metadata is untrusted and never execution verification', () => {
  it.each(['../escape', '/absolute', 'C:/drive', 'folder/../../escape'])('rejects saved path %s', async path => {
    const m = createWorkspaceManifest(await input()); expect(() => validateWorkspaceManifest({ ...m, documents: [{ ...m.documents[0], path }] })).toThrow();
  });
  it('rejects forged launch claims, oversized entries, hash count mismatch and entrypoint overlays', async () => {
    const m = createWorkspaceManifest(await input());
    for (const patch of [{ verified: true }, { profile: { ...m.profile, verified: true } },
      { documents: [{ ...m.documents[0], size: 2 ** 40 }] }, { documents: [{ ...m.documents[0], chunks: [] }] },
      { documents: [{ ...m.documents[0], path: m.profile.entrypoint }] }]) expect(() => validateWorkspaceManifest({ ...m, ...patch })).toThrow();
    const invalid = await input(); expect(() => createWorkspaceManifest({ ...invalid, documents: [{ ...document(), size: 2 ** 40 }] })).toThrow();
    expect(() => validateWorkspaceManifest({ ...m, extra: true })).toThrow();
    expect(() => validateWorkspaceManifest({ ...m, runtimeAssets: [...m.runtimeAssets, m.runtimeAssets[0]!] })).toThrow();
    expect(() => validateWorkspaceManifest({ ...m, documents: [{ ...m.documents[0]!, lastModified: 9_000_000_000_000_000 }] })).toThrow();
  });
  it('changed runtime build or asset pins require explicit profile review, never silent migration', async () => {
    const m = createWorkspaceManifest(await input()); expect(() => verifyWorkspaceRuntime(m, [dosDescriptor])).not.toThrow();
    expect(() => verifyWorkspaceRuntime({ ...m, runtimeAssets: [] }, [dosDescriptor])).toThrow();
    expect(() => verifyWorkspaceRuntime({ ...m, profile: { ...m.profile, runtimeBuildId: 'old' } }, [dosDescriptor])).toThrow();
    const unnamed = { ...m.profile, runtimeId: null, runtimeVersion: null, runtimeBuildId: null };
    expect(() => verifyWorkspaceRuntime({ ...m, profile: unnamed }, [dosDescriptor])).toThrow();
    expect(() => verifyWorkspaceRuntime({ ...m, profile: unnamed, runtimeAssets: [] }, [dosDescriptor])).not.toThrow();
    expect(() => verifyWorkspaceRuntime({ ...m, runtimeAssets: m.runtimeAssets.map((asset, index) => index ? asset : { ...asset, sha256: 'b'.repeat(64) }) }, [dosDescriptor])).toThrow();
    expect(() => verifyWorkspaceRuntime({ ...m, runtimeAssets: [...m.runtimeAssets, { id: 'extra-pin', sha256: 'a'.repeat(64) }] }, [dosDescriptor])).toThrow();
    expect(() => verifyWorkspaceRuntime({ ...m, profile: { ...m.profile, runtimeId: 'boxedwine' } }, [dosDescriptor])).toThrow();
  });
  it('working snapshots overlay only launch copies and cannot replace the executable or collide with directories', async () => {
    const source = await input(), pkg = source.application!;
    const next = withWorkingFiles(pkg, source.documents, source.profile.entrypoint);
    expect(next.files.length).toBe(pkg.files.length + 1); expect(pkg.files).toHaveLength(1);
    expect(() => withWorkingFiles(pkg, [{ ...document(), path: source.profile.entrypoint! }], source.profile.entrypoint)).toThrow();
    expect(() => withWorkingFiles({ ...pkg, directories: ['RESULT.TXT'] }, source.documents, source.profile.entrypoint)).toThrow();
    expect(() => withWorkingFiles(pkg, [{ ...document(), size: 32 * 1024 * 1024 + 1 }], source.profile.entrypoint)).toThrow();
  });
  it('live imports reject collisions, traversal, long names, excessive sizes and multiple documents before byte reads', () => {
    const f = document(); expect(validateDocumentImport([f], [])).toBe(f);
    expect(() => validateDocumentImport([f], [{ path: 'result.txt', size: 0 }])).toThrow();
    expect(() => validateDocumentImport([f, f], [])).toThrow();
    for (const path of ['../RESULT.TXT', 'APP/RESULT.TXT', 'longname123.txt', 'FILE;A.TXT']) expect(() => validateDocumentImport([{ ...f, path }], [])).toThrow();
    expect(() => validateDocumentImport([{ ...f, size: 8 * CHUNK_SIZE + 1 }], [])).toThrow();
    expect(() => validateDocumentImport([{ ...f, size: 1.5 }], [])).toThrow();
    expect(() => validateDocumentImport([f], [{ path: 'OTHER.TXT', size: 32 * CHUNK_SIZE }])).toThrow();
    expect(() => validateDocumentImport([f], Array.from({ length: 2048 }, (_, i) => ({ path: `F${i}.TXT`, size: 0 })))).toThrow();
  });
});
