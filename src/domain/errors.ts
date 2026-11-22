const messages = {
  DEMO_FAILED: 'The supplied demo could not be downloaded or verified. Retry with this site available, or open your own local software.',
  EMPTY_FILE: 'This file is empty. Choose a file with content to continue.',
  FILE_TOO_LARGE: 'This file exceeds the 64 MiB limit. Choose a smaller file.',
  ONE_FILE_ONLY: 'Choose one file for this action.',
  INVALID_PATH: 'An unsafe file name or path was rejected. Use relative paths without traversal, drive letters, reserved names or ambiguous separators.',
  PATH_COLLISION: 'Two paths collide, or a file conflicts with a folder. Rename the conflicting entries locally and try again.',
  PACKAGE_LIMIT: 'The package exceeds a limit: 2,048 entries, 128 MiB total, 64 MiB per file, or bounded path metadata. Choose a smaller package.',
  EMPTY_PACKAGE: 'No files were found. Select a folder containing files or a non-empty archive.',
  ZIP_INVALID: 'This ZIP is corrupt or inconsistent. Its headers, sizes, paths or checksums do not agree. No partial package was imported.',
  ZIP_UNSUPPORTED: 'This ZIP uses an unsupported feature. Use a single-volume ZIP with stored or Deflate entries; encryption, ZIP64, links and special files are not accepted.',
  ZIP_ENCODING: 'A ZIP path uses an unsupported or conflicting encoding. Re-create the ZIP with UTF-8 filenames.',
  ZIP_RATIO: 'This ZIP exceeds the 100:1 expansion limit. Extract it locally and select the folder instead.',
  IMPORT_TIMEOUT: 'Package processing exceeded its time limit and was stopped. Select a smaller package and retry.',
  WORKER_UNAVAILABLE: 'The local ZIP worker could not start. Reload the app or extract the archive locally and choose its folder.',
  READ_FAILED: 'The file could not be read. It may have moved or become unavailable. Select it again.',
  READ_TIMEOUT: 'Local file analysis took too long. Select the file again to retry.',
  INVALID_RANGE: 'The requested file range is outside the local read limit.',
  RUNTIME_UNAVAILABLE: 'This runtime is not installed. Execution is not available in this preview.',
  RUNTIME_MISMATCH: 'The runtime did not match the registered build. It has not been started.',
  WINDOWS_UNVERIFIED: 'Windows execution has not been verified. Boxedwine is disabled pending an audited Wine filesystem and a real Windows application input/stop test. Inspect the file or export its profile instead.',
  WINDOWS_SETTINGS: 'This Boxedwine trial requires a selected x86 PE32 application, safe relative paths, one writable temporary D:/ mount, a 512 MiB memory limit and disabled audio. Windows execution remains disabled.',
  STORAGE_UNAVAILABLE: 'Browser storage is unavailable here. Continue temporarily and export your files. OPFS, Web Locks and a secure local/HTTPS origin are required.',
  STORAGE_DENIED: 'The browser denied access to local workspace storage. Check site storage settings or continue temporarily and export your files.',
  STORAGE_QUOTA: 'There is not enough browser storage for this save. The previous saved workspace is retained. Export a backup or free site storage and retry.',
  STORAGE_CORRUPT: 'The saved workspace is incomplete or failed its manifest/file integrity checks. It was not restored. Re-select the originals or delete this browser copy.',
  STORAGE_MISSING: 'No saved workspace was found. It may have been deleted or evicted. Select the original files or use an exported backup.',
  STORAGE_LIMIT: 'This workspace exceeds its limits: 128 MiB saved data, 64 MiB per application file, 32 MiB of working files, or 2,048 paths per group.',
  STORAGE_FAILED: 'The browser could not finish the workspace operation. Current in-memory files remain available for export. Refresh storage status and retry.',
  STORAGE_RUNTIME: 'The saved profile does not match the installed runtime assets. Export a backup, re-select its files and review/reset the launch profile before running.',
  TRANSFER_SETTINGS: 'Use one new DOS 8.3 document name at the root of C:, at most 8 MiB. Existing names are not overwritten; rename a local copy and try again.',
  TRANSFER_FAILED: 'The guest file transfer failed or the session stopped. Check the guest file list before retrying. No original file was changed.',
  DOS_SETTINGS: 'The DOS configuration is not supported. Review DOS 8.3 paths, package size and the writable temporary C:/ mount in Compatibility.',
  RUNTIME_FAILED: 'The DOS worker stopped after a failure. Review the package/settings and relaunch. Guest networking is unavailable; originals are unchanged.',
  RUNTIME_TIMEOUT: 'The DOS worker exceeded its startup or operation limit. It was stopped. Retry with a smaller package or lower CPU cycles.',
  RUNTIME_ASSETS: 'The audited DOS assets could not be loaded or verified. Restore the app assets or reconnect to load them, then retry.',
  UNEXPECTED: 'Something interrupted this step. Clear the selection and try again.',
} as const;

export type ErrorCode = keyof typeof messages;
export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(messages[code]);
    this.name = 'AppError';
    this.code = code;
  }
}
/** Never expose an arbitrary thrown message: it may contain file data or paths. */
export function safeError(error: unknown): AppError {
  return error instanceof AppError ? new AppError(error.code) : new AppError('UNEXPECTED');
}
