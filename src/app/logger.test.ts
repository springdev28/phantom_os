import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { AppError, safeError } from '../domain/errors';

describe('private diagnostics', () => {
  it('retains only bounded allowlisted events, not arbitrary payloads', () => {
    const logger = createLogger(2);
    logger.record('selection.accepted');
    logger.record('inspection.started');
    logger.record('inspection.completed');
    // Defend at runtime too, even if untyped code bypasses TypeScript.
    Reflect.apply(logger.record, logger, ['private-file.exe', 'SECRET CONTENT']);
    Reflect.apply(logger.record, logger, ['app.error', 'PRIVATE PATH']);
    const entries = logger.snapshot();
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ event: 'app.error', timestamp: expect.any(Number) });
    expect(JSON.stringify(entries)).not.toMatch(/private|SECRET|PRIVATE/);
  });
  it('drops unknown error codes instead of recording them as diagnostics', () => {
    const logger = createLogger();
    logger.record('app.error', 'ZIP_INVALID');
    Reflect.apply(logger.record, logger, ['app.error', 'not-a-code']);
    expect(logger.snapshot()).toEqual([
      { event: 'app.error', timestamp: expect.any(Number), code: 'ZIP_INVALID' },
      { event: 'app.error', timestamp: expect.any(Number) },
    ]);
  });
  it('replaces an arbitrary thrown message with a fixed safe explanation', () => {
    expect(safeError(new Error('private-file.exe: SECRET CONTENT')).message).not.toMatch(/private|SECRET/);
    expect(safeError('PRIVATE PATH')).toMatchObject({ code: 'UNEXPECTED', message: expect.not.stringMatching(/PRIVATE/) });
    const original = new AppError('ZIP_INVALID');
    const wrapped = safeError(original);
    expect(wrapped).toMatchObject({ code: 'ZIP_INVALID' });
    expect(wrapped).not.toBe(original);
    expect(wrapped.message).not.toMatch(/private|SECRET|PRIVATE/);
  });
});
