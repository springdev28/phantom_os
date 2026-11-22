import type { ErrorCode } from '../domain/errors';

const events = [
  'selection.accepted', 'selection.cleared', 'inspection.started',
  'inspection.completed', 'inspection.cancelled', 'app.error', 'render.error',
  'runtime.preparing', 'runtime.running', 'runtime.stopped',
] as const;
type EventName = typeof events[number];
export interface LogEntry {
  readonly event: EventName;
  readonly timestamp: number;
  readonly code?: ErrorCode;
}
const codes = new Set<ErrorCode>([
  'DEMO_FAILED',
  'EMPTY_FILE', 'FILE_TOO_LARGE', 'ONE_FILE_ONLY', 'INVALID_PATH', 'READ_FAILED',
  'READ_TIMEOUT', 'INVALID_RANGE', 'RUNTIME_UNAVAILABLE', 'RUNTIME_MISMATCH', 'UNEXPECTED',
  'PATH_COLLISION', 'PACKAGE_LIMIT', 'EMPTY_PACKAGE', 'ZIP_INVALID', 'ZIP_UNSUPPORTED',
  'ZIP_ENCODING', 'ZIP_RATIO', 'IMPORT_TIMEOUT', 'WORKER_UNAVAILABLE',
  'DOS_SETTINGS', 'RUNTIME_FAILED', 'RUNTIME_TIMEOUT', 'RUNTIME_ASSETS',
  'WINDOWS_UNVERIFIED', 'WINDOWS_SETTINGS',
  'STORAGE_UNAVAILABLE', 'STORAGE_DENIED', 'STORAGE_QUOTA', 'STORAGE_CORRUPT', 'STORAGE_MISSING',
  'STORAGE_LIMIT', 'STORAGE_FAILED', 'STORAGE_RUNTIME', 'TRANSFER_SETTINGS', 'TRANSFER_FAILED',
]);

/** Bounded, memory-only, allowlisted logging. No console, network, filenames or errors. */
export function createLogger(limit = 100) {
  const entries: LogEntry[] = [];
  return {
    record(event: EventName, code?: ErrorCode): void {
      if (!events.includes(event)) return;
      entries.push(Object.freeze({ event, timestamp: Date.now(), ...(code && codes.has(code) ? { code } : {}) }));
      if (entries.length > limit) entries.splice(0, entries.length - limit);
    },
    snapshot(): readonly LogEntry[] { return Object.freeze([...entries]); },
  };
}
export const logger = createLogger();
