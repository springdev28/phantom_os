import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { safeError } from '../domain/errors';

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
  it('replaces an arbitrary thrown message with a fixed safe explanation', () => {
    expect(safeError(new Error('private-file.exe: SECRET CONTENT')).message).not.toMatch(/private|SECRET/);
  });
});
