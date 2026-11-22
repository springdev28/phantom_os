import { describe, expect, it, vi } from 'vitest';
import type { ApplicationPackage, LaunchProfile, RuntimeDescriptor } from '../../domain/contracts';
import { boxedwineAdapter } from './adapter';
import { boxedwineDescriptor } from './descriptor';
import { createBoxedwineMountPlan } from './config';
import { createBoxedwineMemoryMount } from './bridge';
import { RuntimeRegistry, runtimeRegistry } from '../registry';
import { compatibilityPlanner } from '../../planner/compatibility-planner';
import { isRuntimeInstalled } from '../../domain/runtime-descriptor';
import { inspectedFixture, profileFixture } from '../../../tests/fixtures/planner-fixtures';
import { peFixture, neFixture, mzFixture } from '../../../tests/fixtures/probe-fixtures';

const profile = (entrypoint: string): LaunchProfile => ({ ...profileFixture(entrypoint), runtimeId: 'boxedwine',
  mounts: [{ packagePath: '.', guestPath: 'D:/', readOnly: false }], limits: { guestMemoryMiB: 512, maxSessionMs: 60_000 } });

describe('Boxedwine adoption gate (no Windows launch evidence)', () => {
  it('keeps the researched engine separate from an installed, verified Windows environment', async () => {
    expect(boxedwineDescriptor).toMatchObject({ maturity: 'experimental', available: false, assets: [] });
    expect(boxedwineDescriptor.version).toBeUndefined();
    expect(isRuntimeInstalled(boxedwineDescriptor)).toBe(false);
    const load = vi.fn(async () => boxedwineAdapter);
    const registry = new RuntimeRegistry([{ descriptor: boxedwineDescriptor, load }]);
    await expect(registry.load('boxedwine')).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
    expect(load).not.toHaveBeenCalled();
    expect(Object.isFrozen(registry.get('boxedwine')!.blockers![0])).toBe(true);
  });
  it('cannot be enabled merely by setting available and supplying fake installed pins', () => {
    const changed: RuntimeDescriptor = { ...boxedwineDescriptor, available: true, version: '25R1', buildId: 'unreviewed',
      assets: [{ id: 'unit-test-only', sha256: 'a'.repeat(64), installed: true }] };
    expect(isRuntimeInstalled(changed)).toBe(false);
    expect(() => new RuntimeRegistry([{ descriptor: changed, load: async () => boxedwineAdapter }])).toThrow('did not match');
  });
  it('direct prepare/launch fail before reading files, touching a viewport or starting any network request', async () => {
    const fixture = await inspectedFixture(peFixture(), 'PRIVATE.EXE');
    const read = vi.fn(() => { throw new Error('Must not read file bytes'); });
    const pkg = { ...fixture.pkg, files: fixture.pkg.files.map(file => ({ ...file, read })) };
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(boxedwineAdapter.prepare(pkg, profile('PRIVATE.EXE'), new AbortController().signal)).rejects.toMatchObject({ code: 'WINDOWS_UNVERIFIED' });
      await expect(boxedwineAdapter.launch({ id: 'forged', dispose: async () => {} }, {} as HTMLElement, new AbortController().signal)).rejects.toMatchObject({ code: 'WINDOWS_UNVERIFIED' });
      expect(read).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it.each([['PE32', peFixture()], ['NE', neFixture()]] as const)('keeps %s disabled after automatic selection, override and profile import', async (_name, bytes) => {
    const { pkg, inspection } = await inspectedFixture(bytes, 'RENAMED.COM');
    for (const selection of [{ mode: 'automatic' }, { mode: 'override', runtimeId: 'boxedwine' }] as const) {
      const plan = compatibilityPlanner.plan(pkg, inspection, runtimeRegistry.list(), { selection, profile: profile('RENAMED.COM') });
      expect(plan).toMatchObject({ runtimeId: 'boxedwine', decision: 'experimental', engineInstalled: false, canLaunch: false });
      expect(plan.issues.map(issue => issue.code)).toContain('WINDOWS_FILESYSTEM_AUDIT');
      expect(plan.issues.map(issue => issue.code)).toContain('WINDOWS_LAUNCH_UNVERIFIED');
      expect(plan.verificationRecordId).toBeUndefined();
    }
  });
  it('static probe accepts an x86 PE candidate but does not turn DOS, Win16 or PE64 into that candidate', async () => {
    for (const [bytes, candidate] of [[peFixture(), true], [peFixture(true), false], [mzFixture(), false], [neFixture(), false]] as const) {
      const { pkg, inspection } = await inspectedFixture(bytes, 'MISLEADING.EXE');
      expect(boxedwineAdapter.probe(pkg, inspection).candidate).toBe(candidate);
    }
  });
});

describe('25R1 package/configuration boundary; not launch acceptance', () => {
  it('preserves normalized file handles, directories and spaced paths in an argv array without shell syntax', async () => {
    const { pkg: original, inspection: originalInspection } = await inspectedFixture(peFixture(), 'MAIN.EXE');
    const file = { ...original.files[0]!, path: 'My App/MAIN.EXE' };
    const support = { ...file, path: 'My App/DATA.INI' };
    const pkg: ApplicationPackage = { ...original, files: [file, support], directories: ['My App', 'EMPTY'], totalBytes: file.size * 2, entrypoint: file.path };
    const inspection = new Map([[file.path, originalInspection.get('MAIN.EXE')!]]);
    const plan = createBoxedwineMountPlan(pkg, { ...profile(file.path), cwd: 'My App' }, inspection);
    expect(plan.files).toBe(pkg.files); expect(plan.directories).toEqual(['EMPTY', 'My App']);
    expect(plan.arguments).toEqual(['-root', '/root', '-zip', '/wine-system.zip', '-mount_drive', '/d_drive', 'd',
      '-w', '/home/username/.wine/dosdevices/d:/My App', '-nosound', '-resolution', '800x600', '/bin/wine', 'D:\\My App\\MAIN.EXE']);
    expect(plan.arguments).not.toContain('cmd');
  });
  it.each(['../MAIN.EXE', '/MAIN.EXE', 'C:/MAIN.EXE', 'a\\MAIN.EXE', 'a/../MAIN.EXE'])('rejects unsafe paths: %s', async path => {
    const { pkg, inspection } = await inspectedFixture(peFixture(), 'MAIN.EXE');
    const changed = { ...pkg, files: [{ ...pkg.files[0]!, path }] };
    expect(() => createBoxedwineMountPlan(changed, profile(path), new Map([[path, inspection.get('MAIN.EXE')!]]))).toThrow('Boxedwine trial');
  });
  it('rejects collisions, hidden over-budget size, unsupported controls, absent entrypoint, and arbitrary mounts', async () => {
    const { pkg, inspection } = await inspectedFixture(peFixture(), 'MAIN.EXE');
    const p = profile('MAIN.EXE');
    const variants: [ApplicationPackage, LaunchProfile][] = [
      [{ ...pkg, files: [pkg.files[0]!, { ...pkg.files[0]!, path: 'main.exe' }] }, p],
      [{ ...pkg, totalBytes: 0 }, p],
      [{ ...pkg, files: [{ ...pkg.files[0]!, size: 33 * 1024 * 1024 }] }, p],
      [pkg, { ...p, controls: { ...p.controls, audio: true } }],
      [pkg, { ...p, limits: { ...p.limits, guestMemoryMiB: 64 } }],
      [pkg, { ...p, entrypoint: null }],
      [pkg, { ...p, mounts: [{ packagePath: '.', guestPath: 'C:/', readOnly: false }] }],
    ];
    for (const [candidate, settings] of variants) expect(() => createBoxedwineMountPlan(candidate, settings, inspection)).toThrow('Boxedwine trial');
  });
  it('bounds the inner memory bridge before filesystem writes', () => {
    const fs = { mkdirTree: vi.fn(), writeFile: vi.fn(), readFile: vi.fn() };
    const mount = createBoxedwineMemoryMount(fs);
    mount.write('DATA/one.txt', Uint8Array.of(1)); mount.directory('EMPTY');
    expect(fs.writeFile).toHaveBeenCalledWith('/d_drive/DATA/one.txt', Uint8Array.of(1));
    expect(() => mount.write('../escape', Uint8Array.of(1))).toThrow('BOXEDWINE_PATH');
    expect(() => mount.write('DATA/ONE.TXT', Uint8Array.of(2))).toThrow('BOXEDWINE_LIMIT');
    expect(() => mount.write('BIG', new Uint8Array(32 * 1024 * 1024))).toThrow('BOXEDWINE_LIMIT');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });
});
