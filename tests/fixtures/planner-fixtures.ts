import type { LaunchProfile, RuntimeDescriptor } from '../../src/domain/contracts';
import { runtimeRegistry } from '../../src/runtime/registry';
import { selectLocalFile } from '../../src/intake/local-file';
import { selectionInspector } from '../../src/inspection/selection-inspector';
import { describePackage } from '../../src/packages/package-analysis';

export function profileFixture(entrypoint: string | null = 'APP/MAIN.EXE'): LaunchProfile {
  return { schemaVersion: 1, runtimeId: 'js-dos', runtimeVersion: null, runtimeBuildId: null, selectionMode: 'automatic',
    entrypoint, cwd: '.', mounts: [{ packagePath: '.', guestPath: 'C:/', readOnly: false }],
    controls: { keyboard: 'us', mouse: 'off', audio: false }, requiredFiles: [], diskEnvironment: null,
    limits: { guestMemoryMiB: 64, maxSessionMs: 1_800_000 } };
}
/** Absent-engine planning remains testable after the production DOS adapter ships. */
export const plannedRuntimes: readonly RuntimeDescriptor[] = runtimeRegistry.list().map(source => {
  const { version: _version, buildId: _build, ...rest } = source;
  void _version; void _build;
  return { ...rest, maturity: 'planned', available: false, assets: [], blockers: [], rules: rest.rules.map(rule => ({ ...rule, maturity: 'planned' })) };
});
/** Unit test descriptor only. No runtime code, observed launch or real installed asset. */
export function unitRuntime(id: 'js-dos' | 'boxedwine' = 'js-dos'): RuntimeDescriptor {
  const source = runtimeRegistry.get(id)!;
  return { ...source, blockers: [], available: true, version: 'unit-test-1', buildId: 'unit-test-build', maturity: 'verified',
    assets: [{ id: 'unit-test-asset', sha256: 'a'.repeat(64), installed: true }],
    rules: source.rules.map(rule => ({ ...rule, maturity: 'verified' })),
    capabilities: { ...source.capabilities, keyboard: true, fileImport: 'before-launch' } };
}
export async function inspectedFixture(bytes: Uint8Array<ArrayBuffer>, name: string, selected = true) {
  const raw = selectLocalFile([new File([bytes], name, { lastModified: 0 })]);
  const inspection = await selectionInspector.inspect(raw, new AbortController().signal);
  const described = describePackage(raw, inspection);
  const pkg = selected ? { ...described, entrypoint: name } : described;
  return { pkg, inspection };
}
