import { describe, expect, it, vi } from 'vitest';
import { compatibilityPlanner as planner } from './compatibility-planner';
import { inspectedFixture, profileFixture, unitRuntime, plannedRuntimes } from '../../tests/fixtures/planner-fixtures';
import { elfFixture, mzFixture, neFixture, parserFixtures, peFixture, isoFixture } from '../../tests/fixtures/probe-fixtures';
import { extractZip } from '../packages/zip';
import { mixedPackageFiles, packageZip } from '../../tests/fixtures/package-fixtures';
import { virtualPackage, chooseEntrypoint } from '../packages/virtual-package';
import { describePackage } from '../packages/package-analysis';
import { selectionInspector } from '../inspection/selection-inspector';
import type { LaunchProfile } from '../domain/contracts';

const runtimes = plannedRuntimes;
describe('deterministic compatibility planning (no guest execution)', () => {
  it.each([
    ['dos-mz', 'candidate', 'js-dos'], ['pe32', 'candidate', 'boxedwine'], ['ne-windows', 'experimental', 'boxedwine'],
    ['ne-os2', 'unsupported', undefined], ['pe32plus', 'unsupported', undefined], ['elf32', 'unsupported', undefined],
    ['iso', 'unsupported', undefined], ['gpt', 'unsupported', undefined], ['mbr', 'unsupported', undefined],
    ['raw-com', 'needs-files', 'js-dos'], ['misleading-exe', 'unsupported', undefined], ['corrupt-pe-pointer', 'invalid', undefined],
  ] as const)('%s → %s without promising execution', async (id, decision, runtimeId) => {
    const fixture = parserFixtures.find(item => item.id === id)!;
    const { pkg, inspection } = await inspectedFixture(fixture.bytes, fixture.name);
    const plan = planner.plan(pkg, inspection, runtimes);
    expect(plan).toMatchObject({ decision, canLaunch: false, engineInstalled: false });
    expect(plan.runtimeId).toBe(runtimeId);
    expect(plan.reasons.length).toBeGreaterThan(0);
    expect(plan.issues.every(issue => issue.action.length > 0)).toBe(true);
    expect(plan.verificationRecordId).toBeUndefined();
  });
  it('uses bytes ahead of wrong extensions and never accepts arbitrary EXE, MSI or Mac files', async () => {
    for (const [bytes, name, decision, id] of [
      [peFixture(), 'renamed.com', 'candidate', 'boxedwine'], [mzFixture(), 'DOS.data', 'candidate', 'js-dos'],
      [elfFixture(), 'win32.exe', 'unsupported', undefined], [new Uint8Array(100), 'installer.msi', 'unsupported', undefined],
      [Uint8Array.of(0xcf, 0xfa, 0xed, 0xfe, 0), 'Mac.app', 'unsupported', undefined],
    ] as const) {
      const { pkg, inspection } = await inspectedFixture(bytes, name);
      const plan = planner.plan(pkg, inspection, runtimes);
      expect(plan.decision).toBe(decision); expect(plan.runtimeId).toBe(id); expect(plan.canLaunch).toBe(false);
    }
  });
  it.each(['arm', 'efi', 'dll'])('rejects PE32 %s instead of falling back to its MZ stub', async variant => {
    const bytes = peFixture(), view = new DataView(bytes.buffer);
    if (variant === 'arm') view.setUint16(132, 0x1c0, true);
    if (variant === 'efi') view.setUint16(220, 10, true);
    if (variant === 'dll') view.setUint16(150, 0x2002, true);
    const { pkg, inspection } = await inspectedFixture(bytes, 'ambiguous.exe');
    expect(planner.plan(pkg, inspection, runtimes)).toMatchObject({ decision: 'unsupported', canLaunch: false });
  });
  it('keeps automatic selection separate from overrides, and an override cannot bypass format rules', async () => {
    const { pkg, inspection } = await inspectedFixture(mzFixture(), 'APP.EXE');
    expect(planner.plan(pkg, inspection, runtimes)).toMatchObject({ automaticRuntimeId: 'js-dos', selection: { mode: 'automatic' } });
    const override = planner.plan(pkg, inspection, runtimes, { selection: { mode: 'override', runtimeId: 'boxedwine' } });
    expect(override).toMatchObject({ decision: 'unsupported', automaticRuntimeId: 'js-dos', canLaunch: false });
    expect(override.issues.some(issue => issue.code === 'OVERRIDE_MISMATCH')).toBe(true);
    expect(planner.plan(pkg, inspection, runtimes, { selection: { mode: 'override', runtimeId: 'js-dos' } })).toMatchObject({ decision: 'candidate', canLaunch: false });
  });
  it('never chooses the first executable in an ambiguous archive and retains every companion', async () => {
    const contents = await extractZip(new Blob([packageZip(mixedPackageFiles)]), new AbortController().signal);
    const raw = virtualPackage(contents, 'zip', 'mixed.zip'), inspection = await selectionInspector.inspect(raw, new AbortController().signal);
    const pkg = describePackage(raw, inspection);
    expect(pkg.candidates).toHaveLength(2);
    const undecided = planner.plan(pkg, inspection, runtimes);
    expect(undecided).toMatchObject({ decision: 'needs-files', canLaunch: false });
    expect(undecided.runtimeId).toBeUndefined(); expect(undecided.entrypoint).toBeUndefined();
    const chosen = chooseEntrypoint(pkg, 'APP/TOOLS/SETUP.EXE');
    expect(planner.plan(chosen, inspection, runtimes)).toMatchObject({ runtimeId: 'boxedwine', decision: 'candidate' });
    expect(chosen.files).toBe(pkg.files); expect(chosen.files).toHaveLength(8);
  });
  it('a raw COM context confirmation changes eligibility checks, never evidence confidence', async () => {
    const { pkg, inspection } = await inspectedFixture(Uint8Array.of(1, 2, 3), 'APP.COM');
    expect(planner.plan(pkg, inspection, runtimes).decision).toBe('needs-files');
    expect(planner.plan(pkg, inspection, runtimes, { dosComConfirmed: true })).toMatchObject({ decision: 'candidate', canLaunch: false });
    expect(inspection.get('APP.COM')?.confidence).toBe('ambiguous');
  });
  it('reports missing declared dependencies from both package metadata and a profile', async () => {
    const { pkg, inspection } = await inspectedFixture(peFixture(), 'MAIN.EXE');
    const profile = { ...profileFixture('MAIN.EXE'), runtimeId: 'boxedwine' as const, requiredFiles: [{ path: 'lib/needed.dll', kind: 'library' as const }] };
    const plan = planner.plan({ ...pkg, requiredFiles: [{ path: 'data/game.dat', kind: 'data' }] }, inspection, runtimes, { profile });
    expect(plan).toMatchObject({ decision: 'needs-files', canLaunch: false });
    expect(plan.missingFiles.map(item => item.path)).toEqual(['data/game.dat', 'lib/needed.dll']);
    expect(plan.warnings.join(' ')).toContain('presence only');
  });
  it('does not guess dependencies when the headers do not declare any', async () => {
    const { pkg, inspection } = await inspectedFixture(peFixture(), 'MAIN.EXE');
    const plan = planner.plan(pkg, inspection, runtimes);
    expect(plan.missingFiles).toEqual([]);
    expect(plan.warnings.join(' ')).toContain('runtime libraries');
  });
  it.each(['entrypoint', 'cwd', 'mount', 'version', 'memory', 'unmounted'])('blocks %s profile mismatches', async variant => {
    const { pkg, inspection } = await inspectedFixture(mzFixture(), 'MAIN.EXE');
    let profile = profileFixture('MAIN.EXE');
    if (variant === 'entrypoint') profile = { ...profile, entrypoint: 'MISSING.EXE' };
    if (variant === 'cwd') profile = { ...profile, cwd: 'absent' };
    if (variant === 'mount') profile = { ...profile, mounts: [{ packagePath: 'absent', guestPath: 'C:/', readOnly: true }] };
    if (variant === 'unmounted') profile = { ...profile, mounts: [{ packagePath: 'other', guestPath: 'C:/', readOnly: true }] };
    if (variant === 'version') profile = { ...profile, runtimeVersion: 'old', runtimeBuildId: 'old' };
    if (variant === 'memory') profile = { ...profile, limits: { ...profile.limits, guestMemoryMiB: 128 } };
    expect(planner.plan(pkg, inspection, runtimes, { profile })).toMatchObject({ decision: 'needs-files', canLaunch: false });
  });
  it('does not promote runtime maturity, confidence or imported assertions into verified compatibility', async () => {
    const { pkg, inspection } = await inspectedFixture(mzFixture(), 'MAIN.EXE'), runtime = unitRuntime();
    const profile = { ...profileFixture('MAIN.EXE'), runtimeVersion: runtime.version!, runtimeBuildId: runtime.buildId! };
    expect(planner.plan(pkg, inspection, [runtime], { profile })).toMatchObject({ decision: 'candidate', engineInstalled: true, canLaunch: true });
    const forged = { ...profile, verificationRecordId: 'claimed-success' } as LaunchProfile;
    expect(planner.plan(pkg, inspection, [runtime], { profile: forged })).toMatchObject({ decision: 'invalid', canLaunch: false });
  });
  it('reports incomplete engine assets even when a descriptor claims available', async () => {
    const { pkg, inspection } = await inspectedFixture(mzFixture(), 'MAIN.EXE');
    const runtime = unitRuntime();
    const missing = { ...runtime, assets: runtime.assets.map(asset => ({ ...asset, installed: false })) };
    const plan = planner.plan(pkg, inspection, [missing]);
    expect(plan).toMatchObject({ engineInstalled: false, canLaunch: false, decision: 'needs-files' });
    expect(plan.issues.some(issue => issue.code === 'RUNTIME_ASSET_MISSING')).toBe(true);
  });
  it('requires an explicitly registered disk environment and never generalizes its format signature', async () => {
    const { pkg, inspection } = await inspectedFixture(isoFixture(), 'disk.iso');
    const runtime = { ...unitRuntime(), diskEnvironments: [{ id: 'unit-only-disk', label: 'Unit-only environment', formats: ['iso9660' as const], maturity: 'experimental' as const, requirements: ['A known licensed guest image.'] }] };
    expect(planner.plan(pkg, inspection, [runtime]).decision).toBe('unsupported');
    const profile = { ...profileFixture('disk.iso'), diskEnvironment: 'unit-only-disk', runtimeVersion: runtime.version!, runtimeBuildId: runtime.buildId! };
    expect(planner.plan(pkg, inspection, [runtime], { profile })).toMatchObject({ decision: 'experimental', canLaunch: true });
    expect(planner.plan(pkg, inspection, runtimes, { profile })).toMatchObject({ decision: 'unsupported', canLaunch: false });
  });
  it('has deterministic results with no file reads or lazy engine load', async () => {
    const { pkg, inspection } = await inspectedFixture(neFixture(), 'APP.EXE');
    const files = pkg.files.map(file => ({ ...file, read: vi.fn(file.read) })), input = { ...pkg, files };
    const first = planner.plan(input, inspection, runtimes);
    expect(planner.plan(input, inspection, [...runtimes].reverse())).toEqual(first);
    expect(files[0]!.read).not.toHaveBeenCalled();
  });
});
