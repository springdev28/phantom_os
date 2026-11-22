import type { ApplicationPackage, Inspection, LaunchProfile, ProbeResult } from '../../domain/contracts';
import { AppError } from '../../domain/errors';
import { PathIndex, safePath } from '../../packages/paths';
import { validateLaunchProfile } from '../../profiles/launch-profile';

export const BOXEDWINE_PACKAGE_LIMIT = 32 * 1024 * 1024;
export interface BoxedwineMountPlan {
  readonly arguments: readonly string[];
  readonly directories: readonly string[];
  /** Existing normalized handles, not a second archive extraction or copied package. */
  readonly files: ApplicationPackage['files'];
}
export function isBoxedwinePeCandidate(probe: ProbeResult): boolean {
  return probe.localAccess === 'readable' && probe.validity === 'valid-header' && probe.scope === 'static-inspection'
    && probe.format === 'pe32' && probe.architecture === 'x86' && probe.bitness === 32
    && probe.kind === 'Executable image' && ['Windows GUI', 'Windows console'].includes(probe.subsystem ?? '');
}

/** Reviewed 25R1 argv API, not shell text or URL parameters. Disabled in production.
 * D: is the selected package; Wine's own C: stays in its separately audited root.
 * This helper cannot download assets or start a guest.
 */
export function createBoxedwineMountPlan(pkg: ApplicationPackage, input: LaunchProfile, inspection: Inspection): BoxedwineMountPlan {
  try {
    const profile = validateLaunchProfile(input);
    const target = pkg.files.find(file => file.path === profile.entrypoint);
    const probe = target && inspection.get(target.path);
    if (profile.runtimeId !== 'boxedwine' || profile.dos || profile.diskEnvironment || !target || !probe
      || !isBoxedwinePeCandidate(probe) || probe.fileSize !== target.size || profile.controls.audio || profile.limits.guestMemoryMiB !== 512
      || profile.mounts.length !== 1 || profile.mounts[0]?.packagePath !== '.'
      || profile.mounts[0].guestPath !== 'D:/' || profile.mounts[0].readOnly
      || (profile.cwd !== '.' && !pkg.directories.includes(profile.cwd))) throw new AppError('WINDOWS_SETTINGS');
    const index = new PathIndex();
    for (const directory of pkg.directories) index.add(directory, true);
    let bytes = 0;
    for (const file of pkg.files) {
      index.add(file.path);
      if (!Number.isSafeInteger(file.size) || file.size < 0) throw new AppError('WINDOWS_SETTINGS');
      bytes += file.size;
    }
    if (bytes !== pkg.totalBytes || bytes > BOXEDWINE_PACKAGE_LIMIT) throw new AppError('WINDOWS_SETTINGS');
    const cwd = profile.cwd === '.' ? '' : `/${safePath(profile.cwd)}`;
    return { files: pkg.files, directories: index.directories(), arguments: [
      '-root', '/root', '-zip', '/wine-system.zip', '-mount_drive', '/d_drive', 'd',
      '-w', `/home/username/.wine/dosdevices/d:${cwd}`, '-nosound', '-resolution', '800x600',
      '/bin/wine', `D:\\${target.path.replaceAll('/', '\\')}`,
    ] };
  } catch { throw new AppError('WINDOWS_SETTINGS'); }
}
