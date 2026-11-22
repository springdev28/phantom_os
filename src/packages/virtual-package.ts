import type { ApplicationPackage, FileArtifact } from '../domain/contracts';
import { AppError } from '../domain/errors';
import { PACKAGE_LIMITS } from './limits';
import { PathIndex } from './paths';

export interface PackageBlob { readonly path: string; readonly blob: Blob; readonly lastModified: number; }
export interface PackageContents { readonly files: readonly PackageBlob[]; readonly directories: readonly string[]; }

/** Each file is held once as an immutable Blob/selected File with bounded range access. */
export function blobArtifact(item: PackageBlob, source: FileArtifact['source']): FileArtifact {
  const blob = item.blob;
  return Object.freeze({
    id: crypto.randomUUID(), path: item.path, size: blob.size, lastModified: item.lastModified, source,
    async read(offset: number, length: number, signal: AbortSignal) {
      signal.throwIfAborted();
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0
        || length > 1024 * 1024 || offset > blob.size - length) throw new AppError('INVALID_RANGE');
      try {
        const data = await blob.slice(offset, offset + length).arrayBuffer();
        signal.throwIfAborted();
        return new Uint8Array(data);
      } catch {
        signal.throwIfAborted();
        throw new AppError('READ_FAILED');
      }
    },
  });
}

export function virtualPackage(contents: PackageContents, origin: ApplicationPackage['origin'], label: string): ApplicationPackage {
  if (!contents.files.length) throw new AppError('EMPTY_PACKAGE');
  if (contents.files.length + contents.directories.length > PACKAGE_LIMITS.entries) throw new AppError('PACKAGE_LIMIT');
  const index = new PathIndex();
  for (const directory of contents.directories) index.add(directory, true);
  let totalBytes = 0;
  const files = contents.files.map(item => {
    if (!Number.isSafeInteger(item.blob.size) || item.blob.size < 0 || item.blob.size > PACKAGE_LIMITS.fileBytes) throw new AppError('FILE_TOO_LARGE');
    totalBytes += item.blob.size;
    if (totalBytes > PACKAGE_LIMITS.totalBytes) throw new AppError('PACKAGE_LIMIT');
    return blobArtifact({ ...item, path: index.add(item.path) }, origin === 'zip' ? 'archive' : 'selection');
  });
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return Object.freeze({ schemaVersion: 1, id: crypto.randomUUID(), label, origin,
    files: Object.freeze(files), directories: Object.freeze(index.directories()), totalBytes,
    candidates: [], resources: [], warnings: [],
  });
}

export function chooseEntrypoint(pkg: ApplicationPackage, path: string): ApplicationPackage {
  if (!pkg.candidates.some(candidate => candidate.path === path)) throw new AppError('INVALID_PATH');
  return Object.freeze({ ...pkg, entrypoint: path });
}
