import type { FileArtifact, GuestFile } from '../../domain/contracts';
import { AppError } from '../../domain/errors';
export const DOCUMENT_LIMIT = 8 * 1024 * 1024;
/** A deliberately narrow live-import surface: new root files, never overwrite. */
export function validateDocumentImport(files: readonly FileArtifact[], existing: readonly GuestFile[]): FileArtifact {
  const file = files[0];
  if (files.length !== 1 || !file || !/^[A-Za-z0-9_~!-]{1,8}(?:\.[A-Za-z0-9_~!-]{1,3})?$/.test(file.path)
    || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > DOCUMENT_LIMIT
    || existing.length >= 2048 || existing.reduce((sum, f) => sum + f.size, 0) + file.size > 32 * 1024 * 1024
    || existing.some(f => f.path.split('/')[0]?.toLowerCase() === file.path.toLowerCase())) throw new AppError('TRANSFER_SETTINGS');
  return file;
}
