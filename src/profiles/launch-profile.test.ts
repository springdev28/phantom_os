import { describe, expect, it } from 'vitest';
import { createLaunchProfile, parseLaunchProfile, PROFILE_MAX_BYTES, readLaunchProfile, serializeLaunchProfile, validateLaunchProfile } from './launch-profile';
import { inspectedFixture, profileFixture } from '../../tests/fixtures/planner-fixtures';
import { mzFixture } from '../../tests/fixtures/probe-fixtures';
import { compatibilityPlanner } from '../planner/compatibility-planner';
import { runtimeRegistry } from '../runtime/registry';

describe('closed, bounded local launch profiles', () => {
  it('round-trips a draft without inventing a runtime version', () => {
    const profile = profileFixture();
    expect(parseLaunchProfile(serializeLaunchProfile(profile))).toEqual(profile);
    expect(profile.runtimeVersion).toBeNull();
  });
  it.each([
    { schemaVersion: 2 }, { runtimeId: 'v86' }, { runtimeVersion: 'https://remote/engine.js' },
    { runtimeVersion: '1', runtimeBuildId: null }, { runtimeId: null, selectionMode: 'override' },
    { entrypoint: '../../escape.exe' }, { entrypoint: '/Users/private/secret.exe' }, { cwd: 'C:\\files' },
    { bytes: 'personal documents' }, { verificationRecordId: 'verified' }, { args: ['exec-script'] },
    { runtimeUrl: 'https://remote/runtime.js' }, { settings: { autoexec: 'echo fake' } },
    { controls: { keyboard: 'us', mouse: 'off', audio: false, cloud: true } },
    { limits: { guestMemoryMiB: 4096, maxSessionMs: 1_800_000 } },
    { limits: { guestMemoryMiB: 64, maxSessionMs: Infinity } },
    { limits: { guestMemoryMiB: 64, maxSessionMs: 0 } },
    { requiredFiles: [{ path: 'a.dll', kind: 'script' }] },
    { requiredFiles: [{ path: 'LIB.DLL', kind: 'library' }, { path: 'lib.dll', kind: 'library' }] },
    { requiredFiles: [{ path: 'LIB/A.DLL', kind: 'library' }, { path: 'lib/B.DLL', kind: 'library' }] },
    { requiredFiles: [{ path: 'file', kind: 'data' }, { path: 'file/nested.dat', kind: 'data' }] },
    { mounts: [] }, { mounts: [{ packagePath: '.', guestPath: '/etc', readOnly: false }] },
    { mounts: [{ packagePath: '.', guestPath: 'C:/../outside', readOnly: true }] },
    { mounts: [{ packagePath: '.', guestPath: 'C:/', readOnly: true }, { packagePath: '.', guestPath: 'C:/inside', readOnly: true }] },
  ])('rejects unsafe, unknown or contradictory values: %j', patch => {
    expect(() => validateLaunchProfile({ ...profileFixture(), ...patch })).toThrow();
  });
  it('rejects arrays, malformed JSON, oversized JSON and prototype assertions with fixed human-readable errors', async () => {
    expect(() => parseLaunchProfile('[]')).toThrow('schema');
    expect(() => parseLaunchProfile('{private-text')).toThrow('not valid JSON');
    expect(() => parseLaunchProfile(' '.repeat(PROFILE_MAX_BYTES + 1))).toThrow('2 MiB');
    expect(() => parseLaunchProfile(serializeLaunchProfile(profileFixture()).replace('"schemaVersion": 1', '"__proto__": {}, "schemaVersion": 1'))).toThrow('unknown fields');
    const huge = new Blob([new Uint8Array(PROFILE_MAX_BYTES + 1)]);
    await expect(readLaunchProfile(huge)).rejects.toThrow('2 MiB');
  });
  it('exports references and requested settings without reading or embedding any selected file bytes', async () => {
    const { pkg, inspection } = await inspectedFixture(mzFixture(), 'APP.EXE');
    const runtime = runtimeRegistry.get('js-dos')!, plan = compatibilityPlanner.plan(pkg, inspection, runtimeRegistry.list());
    const profile = createLaunchProfile({ ...pkg, files: pkg.files.map(file => ({ ...file, read: () => { throw new Error('No reads allowed during export'); } })) }, plan, runtime);
    const json = serializeLaunchProfile(profile);
    expect(Object.keys(JSON.parse(json))).toEqual(['schemaVersion', 'runtimeId', 'runtimeVersion', 'runtimeBuildId', 'selectionMode', 'entrypoint', 'cwd', 'mounts', 'controls', 'requiredFiles', 'diskEnvironment', 'limits', 'dos']);
    expect(profile.requiredFiles).toEqual([{ path: 'APP.EXE', kind: 'package-member' }]);
    expect(json).not.toContain('base64'); expect(json).not.toContain('sha256');
    await expect(readLaunchProfile(new Blob([json]))).resolves.toEqual(profile);
  });
  it('keeps unsupported files exportable as unresolved drafts', async () => {
    const { pkg, inspection } = await inspectedFixture(new TextEncoder().encode('PRIVATE_CONTENT'), 'unrecognized.exe');
    const plan = compatibilityPlanner.plan(pkg, inspection, runtimeRegistry.list());
    const profile = createLaunchProfile(pkg, plan), json = serializeLaunchProfile(profile);
    expect(plan.decision).toBe('unsupported');
    expect(profile).toMatchObject({ runtimeId: null, runtimeVersion: null, runtimeBuildId: null, entrypoint: 'unrecognized.exe' });
    expect(json).not.toContain('PRIVATE_CONTENT');
    expect(parseLaunchProfile(json)).toEqual(profile);
    const overridden = compatibilityPlanner.plan(pkg, inspection, runtimeRegistry.list(), { selection: { mode: 'override', runtimeId: 'js-dos' } });
    expect(parseLaunchProfile(serializeLaunchProfile(createLaunchProfile(pkg, overridden)))).toMatchObject({ runtimeId: 'js-dos', selectionMode: 'override' });
  });
});
