import { describe, expect, it } from 'vitest';
import { captureLaunchIdentity, launchIdentityDigest, observedLaunchCatalogue } from './verification';
import type { ObservedLaunchEvidence } from './verification';
import { createCompatibilityPlanner, compatibilityPlanner } from './compatibility-planner';
import { inspectedFixture, profileFixture, unitRuntime } from '../../tests/fixtures/planner-fixtures';
import { mzFixture } from '../../tests/fixtures/probe-fixtures';
import { blobArtifact } from '../packages/virtual-package';
import type { VerificationIdentity } from '../domain/contracts';

const browser = { name: 'Unit-test browser', version: 'unit-only', platform: 'unit-only' };
async function setup() {
  const { pkg: base, inspection } = await inspectedFixture(mzFixture(), 'MAIN.EXE');
  const companion = blobArtifact({ path: 'DATA.DAT', blob: new Blob(['a']), lastModified: 0 }, 'fixture');
  const pkg = { ...base, files: [...base.files, companion], totalBytes: base.totalBytes + 1 };
  const runtime = unitRuntime(), profile = { ...profileFixture('MAIN.EXE'), runtimeVersion: runtime.version!, runtimeBuildId: runtime.buildId! };
  const identity = await captureLaunchIdentity(pkg, profile, runtime, browser, new AbortController().signal);
  // This test double exercises the matching gate ONLY. It is never shipped as observed evidence.
  const record: ObservedLaunchEvidence = { id: 'unit-test-only', identitySha256: launchIdentityDigest(identity)!, evidencePath: 'docs/evidence/unit-test-only.md',
    observed: { programOutput: 'passed', meaningfulInput: 'passed', stopAndRelaunch: 'passed', fileIO: 'passed', localOnlyNetwork: 'passed' } };
  return { pkg, inspection, runtime, profile, identity, record };
}
describe('observed evidence identity gate (unit doubles are not launch evidence)', () => {
  it('ships an empty catalogue and cannot verify a program from any confidence or injected receipt', async () => {
    const { pkg, inspection, runtime, profile, identity } = await setup();
    expect(observedLaunchCatalogue).toEqual([]);
    expect(compatibilityPlanner.plan(pkg, inspection, [runtime], { profile, identity }).decision).toBe('candidate');
  });
  it('requires an actual locally computed identity plus a reviewed matching record', async () => {
    const { pkg, inspection, runtime, profile, identity, record } = await setup();
    const planner = createCompatibilityPlanner([record]);
    expect(planner.plan(pkg, inspection, [runtime], { profile }).decision).toBe('candidate');
    expect(planner.plan(pkg, inspection, [runtime], { profile, identity: { sha256: record.identitySha256 } as unknown as VerificationIdentity }).decision).toBe('candidate');
    expect(planner.plan(pkg, inspection, [runtime], { profile, identity })).toMatchObject({ decision: 'verified-compatible', verificationRecordId: 'unit-test-only' });
  });
  it.each(['companion', 'path', 'directory', 'config', 'browser', 'asset', 'build'])('a changed %s cannot reuse a verified identity', async change => {
    const source = await setup();
    let { pkg, profile, runtime } = source;
    let scope = browser;
    if (change === 'companion') pkg = { ...pkg, files: [pkg.files[0]!, blobArtifact({ path: 'DATA.DAT', blob: new Blob(['b']), lastModified: 0 }, 'fixture')] };
    if (change === 'path') pkg = { ...pkg, files: [pkg.files[0]!, { ...pkg.files[1]!, path: 'RENAMED.DAT' }] };
    if (change === 'directory') pkg = { ...pkg, directories: ['new-directory'] };
    if (change === 'config') profile = { ...profile, limits: { ...profile.limits, maxSessionMs: 60_000 } };
    if (change === 'browser') scope = { ...browser, version: 'different' };
    if (change === 'asset') runtime = { ...runtime, assets: [{ ...runtime.assets[0]!, sha256: 'b'.repeat(64) }] };
    if (change === 'build') { runtime = { ...runtime, buildId: 'new-unit-build' }; profile = { ...profile, runtimeBuildId: runtime.buildId! }; }
    const identity = await captureLaunchIdentity(pkg, profile, runtime, scope, new AbortController().signal);
    expect(launchIdentityDigest(identity)).not.toBe(source.record.identitySha256);
    const planner = createCompatibilityPlanner([source.record]);
    expect(planner.plan(pkg, source.inspection, [runtime], { profile, identity }).decision).not.toBe('verified-compatible');
    if (change !== 'browser') expect(planner.plan(pkg, source.inspection, [runtime], { profile, identity: source.identity }).decision).not.toBe('verified-compatible');
  });
  it('missing observations, missing assets and changed profile settings all revoke verification', async () => {
    const { pkg, inspection, runtime, profile, identity, record } = await setup();
    const incomplete = { ...record, observed: { ...record.observed, meaningfulInput: 'not-tested' } } as unknown as ObservedLaunchEvidence;
    expect(createCompatibilityPlanner([incomplete]).plan(pkg, inspection, [runtime], { profile, identity }).decision).not.toBe('verified-compatible');
    const planner = createCompatibilityPlanner([record]);
    expect(planner.plan(pkg, inspection, [{ ...runtime, available: false }], { profile, identity }).decision).not.toBe('verified-compatible');
    expect(planner.plan(pkg, inspection, [runtime], { profile: { ...profile, requiredFiles: [{ path: 'MISSING.DLL', kind: 'library' }] }, identity }).decision).toBe('needs-files');
  });
  it('honors cancellation and never accepts incomplete content reads', async () => {
    const { pkg, profile, runtime } = await setup();
    const controller = new AbortController(); controller.abort();
    await expect(captureLaunchIdentity(pkg, profile, runtime, browser, controller.signal)).rejects.toThrow();
    const incomplete = { ...pkg, files: [{ ...pkg.files[0]!, read: async () => new Uint8Array() }] };
    await expect(captureLaunchIdentity(incomplete, profile, runtime, browser, new AbortController().signal)).rejects.toThrow('incomplete');
  });
});
