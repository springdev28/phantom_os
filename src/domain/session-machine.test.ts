import { describe, expect, it } from 'vitest';
import type { ApplicationPackage, CompatibilityPlan } from './contracts';
import { initialSession, sessionReducer } from './session-machine';
import type { SessionState } from './session-machine';
import { compatibilityPlanner } from '../planner/compatibility-planner';

const pkg: ApplicationPackage = { schemaVersion: 1, id: 'test-package', label: 'test', origin: 'files',
  files: [], directories: [], totalBytes: 1, candidates: [], resources: [], warnings: [] };
const inspection = new Map();
const unsupported = compatibilityPlanner.plan(pkg, inspection, []);
function inspecting(): SessionState {
  return sessionReducer(sessionReducer(initialSession, { type: 'SELECT', pkg }), { type: 'INSPECT', jobId: 'job-1' });
}

describe('session lifecycle', () => {
  it('advances a real selection through inspection to unavailable, without a run state', () => {
    const state = sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan: unsupported });
    expect(state.status).toBe('unsupported');
    expect(sessionReducer(state, { type: 'PREPARE' })).toBe(state);
    expect(sessionReducer(state, { type: 'STARTED', sessionId: 'invented' })).toBe(state);
  });
  it('ignores stale completion and failure after replacing a file', () => {
    const state = sessionReducer(inspecting(), { type: 'SELECT', pkg: { ...pkg, id: 'replacement' } });
    expect(sessionReducer(state, { type: 'INSPECTED', jobId: 'job-1', inspection, plan: unsupported })).toBe(state);
    expect(sessionReducer(state, { type: 'FAIL', jobId: 'job-1', code: 'READ_FAILED' })).toBe(state);
  });
  it('cancels back to selected and cannot resurrect a cleared selection', () => {
    expect(sessionReducer(inspecting(), { type: 'CANCEL_INSPECTION' })).toEqual({ status: 'selected', pkg });
    const cleared = sessionReducer(inspecting(), { type: 'CLEAR' });
    expect(sessionReducer(cleared, { type: 'INSPECTED', jobId: 'job-1', inspection, plan: unsupported })).toEqual(initialSession);
  });
  it('does not trust a launch flag without a runtime build and entrypoint', () => {
    const plan: CompatibilityPlan = { ...unsupported, decision: 'candidate', canLaunch: true };
    expect(sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan }).status).toBe('unsupported');
  });
  it('requires a verification record for verified-compatible', () => {
    const plan: CompatibilityPlan = {
      ...unsupported, decision: 'verified-compatible', canLaunch: true, engineInstalled: true, issues: [],
      runtimeId: 'js-dos', runtimeBuildId: 'unit-test-only', entrypoint: 'test.com',
    };
    expect(sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan }).status).toBe('unsupported');
  });
  it('models future preparation, run, stop and restart using test-only eligibility', () => {
    const plan: CompatibilityPlan = {
      ...unsupported, decision: 'candidate', canLaunch: true, engineInstalled: true, issues: [],
      runtimeId: 'js-dos', runtimeBuildId: 'unit-test-only', entrypoint: 'test.com',
    };
    let state = sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan });
    expect(state.status).toBe('ready');
    state = sessionReducer(state, { type: 'PREPARE' });
    expect(state.status).toBe('preparing');
    state = sessionReducer(state, { type: 'STARTED', sessionId: 'test-only' });
    expect(state.status).toBe('running');
    state = sessionReducer(state, { type: 'STOP' });
    expect(state.status).toBe('stopped');
    expect(sessionReducer(state, { type: 'PREPARE' }).status).toBe('preparing');
  });
  it('keeps a selection recoverable on a read error', () => {
    expect(sessionReducer(inspecting(), { type: 'FAIL', jobId: 'job-1', code: 'READ_FAILED' }))
      .toEqual({ status: 'error', code: 'READ_FAILED', pkg });
  });
  it('ignores a stale replan for a replaced package and replans without losing file handles', () => {
    const reviewed = sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan: unsupported });
    expect(sessionReducer(reviewed, { type: 'REPLAN', packageId: 'old-package', plan: unsupported })).toBe(reviewed);
    const revised = sessionReducer(reviewed, { type: 'REPLAN', packageId: pkg.id, pkg: { ...pkg, entrypoint: 'chosen.exe' }, plan: { ...unsupported, entrypoint: 'chosen.exe' } });
    expect(revised.status).toBe('unsupported');
    if ('pkg' in revised && revised.pkg) expect(revised.pkg.files).toBe(pkg.files);
  });
  it('revokes launch eligibility when a profile change introduces a blocking requirement', () => {
    const eligible = { ...unsupported, decision: 'candidate' as const, canLaunch: true, engineInstalled: true, issues: [], runtimeId: 'js-dos' as const, runtimeBuildId: 'unit-test', entrypoint: 'chosen.exe' };
    const ready = sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan: eligible });
    expect(ready.status).toBe('ready');
    const revised = sessionReducer(ready, { type: 'REPLAN', packageId: pkg.id, plan: { ...eligible, decision: 'needs-files', canLaunch: false } });
    expect(revised.status).toBe('unsupported');
    expect(sessionReducer(revised, { type: 'PREPARE' })).toBe(revised);
  });
  it('treats an entrypoint choice as metadata, not launch authorization', () => {
    const withCandidates = { ...pkg, candidates: [
      { path: 'chosen.exe', format: 'dos-mz' as const, reason: 'unit', caution: 'unit' },
      { path: 'other.exe', format: 'dos-mz' as const, reason: 'unit', caution: 'unit' },
    ] };
    const eligible = { ...unsupported, decision: 'candidate' as const, canLaunch: true, engineInstalled: true, issues: [], runtimeId: 'js-dos' as const, runtimeBuildId: 'unit-test', entrypoint: 'chosen.exe' };
    const ready = sessionReducer(sessionReducer(sessionReducer(initialSession, { type: 'SELECT', pkg: withCandidates }), { type: 'INSPECT', jobId: 'job-1' }),
      { type: 'INSPECTED', jobId: 'job-1', inspection, plan: eligible });
    expect(ready.status).toBe('ready');
    expect(sessionReducer(ready, { type: 'CHOOSE_ENTRYPOINT', path: 'invented.exe' })).toBe(ready);
    const chosen = sessionReducer(ready, { type: 'CHOOSE_ENTRYPOINT', path: 'other.exe' });
    expect(chosen).toMatchObject({ status: 'unsupported', pkg: { entrypoint: 'other.exe' }, plan: { canLaunch: false, entrypoint: 'other.exe' } });
    expect(sessionReducer(chosen, { type: 'PREPARE' })).toBe(chosen);
    expect(sessionReducer(chosen, { type: 'REPLAN', packageId: pkg.id, plan: { ...eligible, entrypoint: 'other.exe' } }).status).toBe('ready');
  });
  it('keeps inspection on a runtime failure and ignores empty STARTED ids', () => {
    const eligible = { ...unsupported, decision: 'candidate' as const, canLaunch: true, engineInstalled: true, issues: [], runtimeId: 'js-dos' as const, runtimeBuildId: 'unit-test', entrypoint: 'chosen.exe' };
    const ready = sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan: eligible });
    const preparing = sessionReducer(ready, { type: 'PREPARE' });
    expect(sessionReducer(preparing, { type: 'STARTED', sessionId: '' })).toBe(preparing);
    const failed = sessionReducer(preparing, { type: 'RUNTIME_FAIL', code: 'RUNTIME_FAILED' });
    expect(failed).toMatchObject({ status: 'error', code: 'RUNTIME_FAILED', pkg, plan: eligible });
    if ('inspection' in failed) expect(failed.inspection).toBe(inspection);
    expect(sessionReducer(ready, { type: 'RUNTIME_FAIL', code: 'RUNTIME_FAILED' })).toBe(ready);
    expect(sessionReducer(inspecting(), { type: 'RUNTIME_FAIL', code: 'RUNTIME_FAILED' })).toEqual(inspecting());
    expect(sessionReducer(preparing, { type: 'STOP' }).status).toBe('stopped');
  });
  it('allows a still-eligible runtime failure to retry and ignores replan while preparing', () => {
    const eligible = { ...unsupported, decision: 'candidate' as const, canLaunch: true, engineInstalled: true, issues: [], runtimeId: 'js-dos' as const, runtimeBuildId: 'unit-test', entrypoint: 'chosen.exe' };
    const ready = sessionReducer(inspecting(), { type: 'INSPECTED', jobId: 'job-1', inspection, plan: eligible });
    const preparing = sessionReducer(ready, { type: 'PREPARE' });
    expect(sessionReducer(preparing, { type: 'REPLAN', packageId: pkg.id, plan: eligible })).toBe(preparing);
    const failed = sessionReducer(preparing, { type: 'RUNTIME_FAIL', code: 'RUNTIME_TIMEOUT' });
    expect(sessionReducer(failed, { type: 'PREPARE' }).status).toBe('preparing');
    const blocked = sessionReducer(failed, { type: 'REPLAN', packageId: pkg.id, plan: { ...eligible, canLaunch: false } });
    expect(sessionReducer(blocked, { type: 'PREPARE' })).toBe(blocked);
    expect(sessionReducer(sessionReducer(preparing, { type: 'STARTED', sessionId: 'live' }), { type: 'STARTED', sessionId: 'second' }))
      .toMatchObject({ status: 'running', sessionId: 'live' });
  });
  it('records a selection-time FAIL without a job and ignores a job-scoped FAIL while idle', () => {
    expect(sessionReducer(initialSession, { type: 'FAIL', code: 'INVALID_PATH' })).toEqual({ status: 'error', code: 'INVALID_PATH' });
    expect(sessionReducer(initialSession, { type: 'FAIL', jobId: 'job-1', code: 'INVALID_PATH' })).toBe(initialSession);
  });
});
