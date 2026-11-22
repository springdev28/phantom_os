import type { ApplicationPackage, DosSettings, LaunchProfile } from '../../domain/contracts';
import { AppError } from '../../domain/errors';

export const DEFAULT_DOS_SETTINGS: DosSettings = { cycles: 3000, core: 'auto', machine: 'svga_s3', xms: true, ems: true };
export const DOS_PACKAGE_LIMIT = 32 * 1024 * 1024;
const dosPath = (path: string) => path.split('/').every(part => /^[A-Za-z0-9_~!-]{1,8}(?:\.[A-Za-z0-9_~!-]{1,3})?$/.test(part));
/** This narrow mount/path subset makes command injection impossible. No supplied .conf or autoexec is consumed. */
export function dosConfigurationIssue(pkg: ApplicationPackage, profile: LaunchProfile): string | undefined {
  if (pkg.files.length > 2048 || pkg.totalBytes > DOS_PACKAGE_LIMIT || pkg.files.some(file => !Number.isSafeInteger(file.size) || file.size < 0)
    || pkg.files.reduce((total, file) => total + file.size, 0) > DOS_PACKAGE_LIMIT) return 'Use a package of at most 32 MiB for this DOS adapter.';
  if (pkg.files.some(file => !dosPath(file.path)) || pkg.directories.some(path => !dosPath(path))) return 'Use DOS 8.3 file and folder names (letters, digits, _, ~, ! or -). Rename a local copy and select it again.';
  if (profile.mounts.length !== 1 || profile.mounts[0]?.packagePath !== '.' || profile.mounts[0].guestPath !== 'C:/' || profile.mounts[0].readOnly) return 'This DOS adapter requires one whole-package mount at C:/ with Read only unchecked. Only temporary copies are writable.';
  return undefined;
}
export function createDosConfiguration(pkg: ApplicationPackage, profile: LaunchProfile): string {
  if (dosConfigurationIssue(pkg, profile) || !profile.entrypoint || !pkg.files.some(file => file.path === profile.entrypoint)
    || (profile.cwd !== '.' && !pkg.directories.includes(profile.cwd))) throw new AppError('DOS_SETTINGS');
  const dos = profile.dos ?? DEFAULT_DOS_SETTINGS;
  const path = (value: string) => `C:\\${value === '.' ? '' : value.replaceAll('/', '\\')}`;
  const emptyDirs = pkg.directories.filter(dir => !pkg.files.some(file => file.path.startsWith(`${dir}/`)));
  return `[sdl]\nautolock=false\n[dosbox]\nmachine=${dos.machine}\nmemsize=${profile.limits.guestMemoryMiB}\n[cpu]\ncore=${dos.core}\ncycles=${dos.cycles}\n[render]\nframeskip=0\n[mixer]\nrate=44100\n[sblaster]\nsbtype=sb16\n[dos]\nxms=${dos.xms}\nems=${dos.ems}\numb=true\nkeyboardlayout=us\n[ipx]\nipx=false\n[serial]\nserial1=disabled\nserial2=disabled\nserial3=disabled\nserial4=disabled\n[autoexec]\n@echo off\nmount c /home/web_user/package\nc:\n${emptyDirs.map(dir => `md ${path(dir)} >nul\n`).join('')}cd ${path(profile.cwd)}\n${path(profile.entrypoint)}\n`;
}
