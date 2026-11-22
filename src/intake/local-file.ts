import type { ApplicationPackage } from '../domain/contracts';
import { AppError } from '../domain/errors';
import { PACKAGE_LIMITS } from '../packages/limits';
import { virtualPackage } from '../packages/virtual-package';

export const MAX_FILE_BYTES = PACKAGE_LIMITS.fileBytes;
export const MAX_READ_BYTES = 1024 * 1024;
export type InputKind = 'files' | 'folder' | 'zip';

export function selectLocalFiles(files: readonly File[], kind: InputKind = 'files'): ApplicationPackage {
  if (!files.length) throw new AppError('EMPTY_PACKAGE');
  if (files.length > PACKAGE_LIMITS.entries) throw new AppError('PACKAGE_LIMIT');
  if (kind === 'zip' && files.length !== 1) throw new AppError('ONE_FILE_ONLY');
  if (kind !== 'folder' && files.length === 1 && files[0]?.size === 0) throw new AppError('EMPTY_FILE');
  const folderRoot = kind === 'folder' ? files[0]?.webkitRelativePath?.split('/')[0] : undefined;
  const entries = files.map(file => {
    const path = kind === 'folder' ? file.webkitRelativePath : file.name;
    // Keep the selected folder root and every relative segment.
    if (!path || (kind === 'folder' && (!path.includes('/') || path.split('/')[0] !== folderRoot))
      || (kind !== 'folder' && /[/\\]/.test(path))) throw new AppError('INVALID_PATH');
    return { path, blob: file, lastModified: file.lastModified };
  });
  return virtualPackage({ files: entries, directories: [] }, kind === 'folder' ? 'folder' : 'files',
    kind === 'folder' ? folderRoot! : files.length === 1 ? files[0]!.name : `${files.length} selected files`);
}

/** Retained for the bounded single-file analyzer API. */
export function selectLocalFile(files: readonly File[]): ApplicationPackage {
  if (files.length !== 1) throw new AppError('ONE_FILE_ONLY');
  return selectLocalFiles(files);
}
