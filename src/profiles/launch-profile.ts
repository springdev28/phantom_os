import type { ApplicationPackage, CompatibilityPlan, LaunchProfile, RequiredFile, RuntimeDescriptor, RuntimeId } from '../domain/contracts';
import { PathIndex, safePath } from '../packages/paths';
import { DEFAULT_DOS_SETTINGS } from '../runtime/dos/config';

export const PROFILE_MAX_BYTES = 2 * 1024 * 1024;
export class ProfileError extends Error {
  constructor(message: string) { super(message); this.name = 'ProfileError'; }
}
const fail = (message: string): never => { throw new ProfileError(message); };
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('The profile must use the documented JSON object schema.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))
    || Object.keys(record).some(key => !keys.includes(key))) return fail('The profile contains missing or unknown fields. Only launch settings and relative file references are allowed.');
  return record;
}
function path(value: unknown, root = false): string {
  if (root && value === '.') return '.';
  if (typeof value !== 'string') return fail('Use a relative package path in the profile.');
  try { if (safePath(value) === value) return value; } catch { /* Replace untrusted details with fixed guidance. */ }
  return fail('A profile path is unsafe. Use normalized relative paths without traversal, drive letters or reserved names.');
}
function pin(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)) return value;
  return fail('Runtime versions and build IDs must be short identifiers, not URLs or commands.');
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max) return value;
  return fail('Profile limits must be whole numbers: 16–512 MiB memory and 1–30 minutes per session.');
}
const folded = (value: string) => value.normalize('NFKC').toUpperCase().toLowerCase();
function array(value: unknown, max: number): unknown[] {
  if (Array.isArray(value) && value.length <= max) return value;
  return fail('The profile exceeds the allowed number of mounts or file references.');
}

/** Exact, closed schema: no binary payload, report, script, runtime URL, args or verification assertions. */
export function validateLaunchProfile(value: unknown): LaunchProfile {
  const hasDos = Boolean(value && typeof value === 'object' && Object.hasOwn(value, 'dos'));
  const p = object(value, ['schemaVersion', 'runtimeId', 'runtimeVersion', 'runtimeBuildId', 'selectionMode', 'entrypoint', 'cwd', 'mounts', 'controls', 'requiredFiles', 'diskEnvironment', 'limits', ...(hasDos ? ['dos'] : [])]);
  if (p.schemaVersion !== 1) return fail('This launch profile version is not supported. Use schemaVersion 1.');
  if (p.runtimeId !== null && p.runtimeId !== 'js-dos' && p.runtimeId !== 'boxedwine') return fail('The profile names an unknown runtime.');
  if (p.selectionMode !== 'automatic' && p.selectionMode !== 'override') return fail('Choose automatic selection or an explicit runtime override.');
  const runtimeId = p.runtimeId as RuntimeId | null, runtimeVersion = pin(p.runtimeVersion), runtimeBuildId = pin(p.runtimeBuildId);
  if ((runtimeVersion === null) !== (runtimeBuildId === null) || (runtimeId === null && (runtimeVersion !== null || p.selectionMode === 'override'))) return fail('Runtime ID, version and build pins are inconsistent. Use null pins for an unresolved draft.');
  const destinations: string[] = [];
  const mounts = array(p.mounts, 8).map(value => {
    const m = object(value, ['packagePath', 'guestPath', 'readOnly']);
    if (typeof m.guestPath !== 'string' || !/^[C-F]:\//.test(m.guestPath) || typeof m.readOnly !== 'boolean') return fail('Mounts require a C:/–F:/ guest path and an explicit readOnly flag.');
    const suffix = m.guestPath.slice(3);
    if (suffix) path(suffix);
    const destination = folded(m.guestPath.replace(/\/$/, ''));
    if (destinations.some(other => destination === other || destination.startsWith(`${other}/`) || other.startsWith(`${destination}/`))) return fail('Guest mount destinations overlap. Choose separate guest paths.');
    destinations.push(destination);
    return { packagePath: path(m.packagePath, true), guestPath: m.guestPath, readOnly: m.readOnly };
  });
  if (!mounts.length) return fail('Include at least one mount for the selected package.');
  const paths = new PathIndex();
  const requiredFiles = array(p.requiredFiles, 2048).map(value => {
    const f = object(value, ['path', 'kind']);
    const filePath = path(f.path);
    try { paths.add(filePath); }
    catch { return fail('Required file paths collide or exceed the package path budget. Use one normalized, consistent reference for each file.'); }
    if (!['library', 'data', 'configuration', 'package-member'].includes(String(f.kind))) return fail('A required file has an unknown resource kind.');
    return { path: filePath, kind: f.kind as RequiredFile['kind'] };
  });
  const c = object(p.controls, ['keyboard', 'mouse', 'audio']), l = object(p.limits, ['guestMemoryMiB', 'maxSessionMs']);
  if (c.keyboard !== 'us' || !['off', 'absolute', 'captured'].includes(String(c.mouse)) || typeof c.audio !== 'boolean') return fail('Choose a US keyboard, a supported mouse mode and an audio boolean.');
  let dos: LaunchProfile['dos'];
  if (hasDos) {
    const d = object(p.dos, ['cycles', 'core', 'machine', 'xms', 'ems']);
    if (!Number.isSafeInteger(d.cycles) || Number(d.cycles) < 300 || Number(d.cycles) > 30000
      || !['auto', 'normal', 'simple'].includes(String(d.core)) || !['svga_s3', 'vgaonly', 'ega'].includes(String(d.machine))
      || typeof d.xms !== 'boolean' || typeof d.ems !== 'boolean') return fail('DOS settings require 300–30000 fixed cycles, a supported core/machine and boolean XMS/EMS switches.');
    dos = { cycles: Number(d.cycles), core: d.core as NonNullable<LaunchProfile['dos']>['core'], machine: d.machine as NonNullable<LaunchProfile['dos']>['machine'], xms: d.xms, ems: d.ems };
  }
  return {
    schemaVersion: 1, runtimeId, runtimeVersion, runtimeBuildId, selectionMode: p.selectionMode,
    entrypoint: p.entrypoint === null ? null : path(p.entrypoint), cwd: path(p.cwd, true), mounts,
    controls: { keyboard: 'us', mouse: c.mouse as LaunchProfile['controls']['mouse'], audio: c.audio },
    requiredFiles, diskEnvironment: pin(p.diskEnvironment),
    limits: { guestMemoryMiB: integer(l.guestMemoryMiB, 16, 512), maxSessionMs: integer(l.maxSessionMs, 60_000, 1_800_000) },
    ...(dos ? { dos } : {}),
  };
}

export function parseLaunchProfile(json: string): LaunchProfile {
  if (new TextEncoder().encode(json).length > PROFILE_MAX_BYTES) return fail('This profile exceeds the 2 MiB JSON limit.');
  let value: unknown;
  try { value = JSON.parse(json); } catch { return fail('This file is not valid JSON. Export a PHANTOM launch profile and try again.'); }
  return validateLaunchProfile(value);
}
export function serializeLaunchProfile(profile: LaunchProfile): string {
  const json = JSON.stringify(validateLaunchProfile(profile), null, 2);
  if (new TextEncoder().encode(json).length > PROFILE_MAX_BYTES) return fail('The profile exceeds the 2 MiB export limit. Reduce its file references.');
  return json;
}
export async function readLaunchProfile(file: Blob): Promise<LaunchProfile> {
  if (file.size > PROFILE_MAX_BYTES) return fail('This profile exceeds the 2 MiB JSON limit.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const json = await Promise.race([file.text(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ProfileError('Reading the profile timed out. Select it again.')), 5000);
    })]);
    return parseLaunchProfile(json);
  } catch (error) { throw error instanceof ProfileError ? error : new ProfileError('The profile could not be read. Select it again.'); }
  finally { clearTimeout(timer); }
}

export function createLaunchProfile(pkg: ApplicationPackage, plan: CompatibilityPlan, runtime?: RuntimeDescriptor): LaunchProfile {
  return {
    schemaVersion: 1, runtimeId: plan.selection.mode === 'override' ? plan.selection.runtimeId : plan.runtimeId ?? null, runtimeVersion: runtime?.version ?? null,
    runtimeBuildId: runtime?.buildId ?? null, selectionMode: plan.selection.mode,
    entrypoint: pkg.entrypoint ?? (pkg.files.length === 1 ? pkg.files[0]?.path ?? null : null), cwd: '.',
    mounts: [{ packagePath: '.', guestPath: 'C:/', readOnly: runtime?.id !== 'js-dos' }],
    controls: { keyboard: 'us', mouse: 'off', audio: false },
    requiredFiles: pkg.files.map(file => {
      const kind = pkg.resources.find(resource => resource.path === file.path)?.kind;
      return { path: file.path, kind: kind === 'library' || kind === 'data' || kind === 'configuration' ? kind : 'package-member' };
    }),
    diskEnvironment: null, limits: { guestMemoryMiB: 64, maxSessionMs: 1_800_000 },
    ...(runtime?.id === 'js-dos' ? { dos: DEFAULT_DOS_SETTINGS } : {}),
  };
}
