import type { ApplicationPackage, CompatibilityPlan, CompatibilityPlanner, ExecutableCapability, Inspection,
  LaunchProfile, PlanIssue, PlanningRequest, ProbeResult, RequiredFile, RuntimeDescriptor } from '../domain/contracts';
import { isRuntimeInstalled } from '../domain/runtime-descriptor';
import { validateLaunchProfile } from '../profiles/launch-profile';
import { matchObservedLaunch, observedLaunchCatalogue } from './verification';
import type { ObservedLaunchEvidence } from './verification';
import { dosConfigurationIssue } from '../runtime/dos/config';

const diskFormats = new Set(['iso9660', 'mbr-disk', 'gpt-disk', 'disk-image-ambiguous']);
const unknowns = 'Headers cannot establish required OS versions, runtime libraries, DRM, a valid guest environment or whether the application will start.';

function ruleMatches(rule: ExecutableCapability, probe: ProbeResult): boolean {
  if (rule.maturity === 'unsupported' || rule.format !== probe.format) return false;
  switch (rule.id) {
    case 'dos-com': return probe.format === 'dos-com-ambiguous';
    case 'dos-mz': return probe.format === 'dos-mz';
    case 'windows-ne': return probe.format === 'ne' && probe.platform === 'Windows (declared NE target)';
    case 'windows-pe32': return probe.format === 'pe32' && probe.architecture === 'x86' && probe.bitness === 32
      && probe.kind === 'Executable image' && ['Windows GUI', 'Windows console'].includes(probe.subsystem ?? '');
  }
}
function unsupportedReason(probe: ProbeResult): string {
  switch (probe.format) {
    case 'pe32+': return 'PE32+ / 64-bit Windows execution is unsupported. The planned Windows path is an x86 PE32 trial only.';
    case 'pe32': return 'This PE32 machine, image kind or subsystem is outside the x86 Windows GUI/console path. Drivers, DLL entrypoints and EFI images are not applications this adapter can launch.';
    case 'ne': return 'Only explicitly declared Windows NE images are candidates. OS/2 and other NE targets are unsupported.';
    case 'elf': return 'ELF/Linux execution is unsupported. Neither DOS nor the Windows adapter provides a general Linux environment.';
    case 'zip': return 'An archive is a container, not an executable. Inspect its contents and select an intended program; nested archives stay opaque.';
    case 'iso9660': case 'mbr-disk': case 'gpt-disk': case 'disk-image-ambiguous':
      return 'No disk-image environment is installed or enabled. A filesystem or partition signature does not identify a bootable, licensed guest OS.';
    default: return 'No eligible executable format was established. A filename, including .exe, .msi or a Mac application suffix, is not proof of a runnable program. MSI and Mac execution are unsupported.';
  }
}

/** Pure planning: no reads, downloads, dynamic imports, time, execution or persistence. */
export function createCompatibilityPlanner(catalogue: readonly ObservedLaunchEvidence[] = observedLaunchCatalogue): CompatibilityPlanner {
  // Only app-owned, reviewed evidence belongs here. JSON import has no catalogue interface.
  const records = catalogue.map(record => Object.freeze({ ...record, observed: Object.freeze({ ...record.observed }) }));
  return { plan(pkg: ApplicationPackage, inspection: Inspection, runtimes: readonly RuntimeDescriptor[], request: PlanningRequest = {}): CompatibilityPlan {
    const selection = request.selection ?? { mode: 'automatic' as const };
    const issues: PlanIssue[] = [], missingFiles: RequiredFile[] = [], reasons: string[] = [], requirements: string[] = [], warnings = [unknowns];
    let runtime: RuntimeDescriptor | undefined = undefined;
    let automaticRuntimeId: RuntimeDescriptor['id'] | undefined = undefined;
    let entrypoint = pkg.entrypoint;
    const finish = (decision: CompatibilityPlan['decision'], verificationRecordId?: string): CompatibilityPlan => ({
      decision, selection, engineInstalled: runtime ? isRuntimeInstalled(runtime) : false,
      ...(runtime ? { runtimeId: runtime.id, ...(runtime.buildId ? { runtimeBuildId: runtime.buildId } : {}) } : {}),
      ...(automaticRuntimeId ? { automaticRuntimeId } : {}), ...(entrypoint ? { entrypoint } : {}),
      canLaunch: Boolean(runtime && isRuntimeInstalled(runtime) && entrypoint && !issues.some(issue => issue.blocking)
        && ['candidate', 'experimental', 'verified-compatible'].includes(decision)),
      reasons, requirements, warnings, issues, missingFiles, ...(verificationRecordId ? { verificationRecordId } : {}),
    });
    const issue = (code: string, message: string, action: string, blocking = true, path?: string) => {
      issues.push({ code, message, action, blocking, ...(path ? { path } : {}) });
    };
    let profile: LaunchProfile | undefined;
    if (request.profile) {
      try { profile = validateLaunchProfile(request.profile); entrypoint = profile.entrypoint ?? pkg.entrypoint; }
      catch { reasons.push('The launch profile failed schema or safety validation.'); issue('INVALID_PROFILE', reasons[0]!, 'Import a valid PHANTOM profile or reset it.'); return finish('invalid'); }
    }
    if (!pkg.files.length) {
      reasons.push('The package contains no files.'); issue('EMPTY_PACKAGE', reasons[0]!, 'Select a complete application folder or archive.'); return finish('needs-files');
    }
    const explicitEntrypoint = Boolean(entrypoint);
    // A single file may be explained before selection. It is never silently chosen for launch.
    const target = entrypoint ? pkg.files.find(file => file.path === entrypoint) : pkg.files.length === 1 ? pkg.files[0] : undefined;
    if (entrypoint && !target) {
      missingFiles.push({ path: entrypoint, kind: 'package-member' });
      reasons.push('The profile’s entrypoint is absent from the selected package.');
      issue('ENTRYPOINT_MISSING', reasons[0]!, 'Select the original package with the same relative paths, or choose a different entrypoint.', true, entrypoint);
      return finish('needs-files');
    }
    if (!target) {
      const hasCandidates = pkg.candidates.length > 0;
      reasons.push(hasCandidates ? 'The package has no chosen entrypoint. Candidate order does not decide which application you intend to run.' : 'No executable candidate was identified in this package.');
      issue('CHOOSE_ENTRYPOINT', reasons[0]!, 'Open Inspect and review the candidate reasons before selecting a program.');
      return finish(hasCandidates ? 'needs-files' : 'unsupported');
    }
    const probe = inspection.get(target.path);
    if (!probe || probe.localAccess !== 'readable') {
      reasons.push('No readable local header report is available for this file.');
      issue('INSPECTION_REQUIRED', reasons[0]!, 'Return to Inspect and analyze the selected file.'); return finish('needs-files');
    }
    if (probe.validity === 'invalid' || probe.fileSize !== target.size || probe.scope !== 'static-inspection') {
      reasons.push('The header is corrupt, inconsistent or does not match the selected file.');
      issue('INVALID_HEADER', reasons[0]!, 'Review the header warnings in Inspect; select an intact copy of the original package.'); return finish('invalid');
    }
    const environment = profile?.diskEnvironment;
    const compatible = [...runtimes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).filter(candidate =>
      candidate.maturity !== 'unsupported' && (candidate.rules.some(rule => ruleMatches(rule, probe))
        || (environment && candidate.diskEnvironments.some(env => env.id === environment && env.maturity !== 'unsupported' && env.formats.some(format => format === probe.format)))));
    automaticRuntimeId = compatible[0]?.id;
    if (!compatible.length) {
      reasons.push(unsupportedReason(probe));
      issue('FORMAT_UNSUPPORTED', reasons[0]!, 'Keep inspecting the evidence or export a draft profile for later review.');
      if (selection.mode === 'override') warnings.push('A runtime override cannot add format support.');
      return finish('unsupported');
    }
    runtime = selection.mode === 'override' ? runtimes.find(item => item.id === selection.runtimeId) : compatible[0];
    if (!runtime || !compatible.includes(runtime)) {
      reasons.push('The selected runtime override does not accept this header’s platform, architecture or image kind.');
      issue('OVERRIDE_MISMATCH', reasons[0]!, 'Return to automatic selection or choose the matching candidate adapter.'); return finish('unsupported');
    }
    const rule = runtime.rules.find(candidate => ruleMatches(candidate, probe));
    const disk = runtime.diskEnvironments.find(env => env.id === environment && env.formats.some(format => format === probe.format));
    reasons.push(rule?.justification ?? `The explicitly selected ${disk?.label ?? 'disk'} environment requires its own observed boot test.`);
    reasons.push(selection.mode === 'override' ? 'Your override selected this adapter; it does not bypass requirements or grant verification.' : 'Automatic selection used the header fields and the registry’s explicit capability rules.');
    requirements.push(...runtime.requirements, ...(rule?.requirements ?? disk?.requirements ?? []));
    for (const blocker of runtime.blockers ?? []) issue(blocker.code, blocker.message, blocker.action);
    if (!explicitEntrypoint) issue('CHOOSE_ENTRYPOINT', 'This file has not been selected as the intended executable.', 'Choose it in Inspect before any future launch.');
    if (!isRuntimeInstalled(runtime)) issue('ENGINE_NOT_INSTALLED', `${runtime.name} is not installed with a complete pinned asset set.`, 'Execution remains disabled until this adapter is integrated, licensed and tested.');
    if (rule?.maturity === 'planned' || disk?.maturity === 'planned') issue('CAPABILITY_PLANNED', 'This adapter capability is still planned.', 'Wait for the specific DOS, Win16, Win32 or disk-environment integration test.');
    for (const asset of runtime.assets.filter(asset => !asset.installed)) issue('RUNTIME_ASSET_MISSING', `Required runtime asset ${asset.id} is missing.`, 'Restore the app’s exact audited runtime asset set.');
    if (probe.validity === 'partial') issue('PARTIAL_HEADER', 'The bounded inspection could not validate the entire required header.', 'Inspect the diagnostics and supply an intact file within the probe limits.');
    if (probe.format === 'dos-com-ambiguous' && !request.dosComConfirmed) issue('COM_CONTEXT_REQUIRED', 'Raw COM bytes remain ambiguous; the suffix is not proof.', 'Confirm DOS COM intent using the application’s documentation.');
    if (isRuntimeInstalled(runtime) && !profile) issue('PROFILE_REQUIRED', 'A validated launch profile is required before preparing a runtime.', 'Review and apply the draft profile settings.');
    if (profile) {
      if (runtime.id === 'js-dos' && isRuntimeInstalled(runtime)) {
        const problem = dosConfigurationIssue(pkg, profile);
        if (problem) issue('DOS_CONFIGURATION', problem, 'Correct the local package or apply compatible DOS profile settings.');
      }
      if (isRuntimeInstalled(runtime) && (!runtime.capabilities.keyboard || (profile.controls.audio && !runtime.capabilities.audio)
        || (profile.controls.mouse !== 'off' && !runtime.capabilities.mouse) || runtime.capabilities.fileImport === 'none')) issue('CONTROLS_UNAVAILABLE', 'This adapter cannot provide the requested input, audio or file staging.', 'Turn off unsupported controls or use an adapter that implements the required capabilities.');
      if (profile.runtimeId && profile.runtimeId !== runtime.id) issue('PROFILE_RUNTIME_MISMATCH', 'The profile references a different runtime.', 'Reset the profile or choose its matching adapter; an override does not erase version pins.');
      if (profile.runtimeVersion !== null && (profile.runtimeVersion !== runtime.version || profile.runtimeBuildId !== runtime.buildId)) issue('PROFILE_VERSION_MISMATCH', 'The profile’s runtime version/build is not installed.', 'Use the exact registered build or explicitly reset the profile to the current registry.');
      if (isRuntimeInstalled(runtime) && (profile.runtimeVersion === null || profile.runtimeId === null)) issue('PROFILE_UNPINNED', 'This draft does not pin an installed runtime.', 'Reset the profile to bind it to the installed build before launch.');
      if (profile.limits.guestMemoryMiB > runtime.maxGuestMemoryMiB) issue('MEMORY_LIMIT', 'The profile requests more memory than this adapter allows.', `Reduce guest memory to at most ${runtime.maxGuestMemoryMiB} MiB.`);
      if (profile.cwd !== '.' && !pkg.directories.includes(profile.cwd)) issue('CWD_MISSING', 'The profile’s working directory is absent.', 'Select the complete package or reset the working directory.', true, profile.cwd);
      for (const mount of profile.mounts) {
        if (mount.packagePath !== '.' && !pkg.files.some(file => file.path === mount.packagePath) && !pkg.directories.includes(mount.packagePath)) issue('MOUNT_SOURCE_MISSING', 'A mount source is absent from the package.', 'Select the original package or correct the relative mount path.', true, mount.packagePath);
      }
      const covers = (path: string) => profile.mounts.some(mount => mount.packagePath === '.' || path === mount.packagePath || path.startsWith(`${mount.packagePath}/`));
      if (entrypoint && !covers(entrypoint)) issue('ENTRYPOINT_NOT_MOUNTED', 'The entrypoint is outside the selected mounts.', 'Mount its package path or reset to the complete package mount.');
      if (profile.cwd !== '.' && !covers(profile.cwd)) issue('CWD_NOT_MOUNTED', 'The working directory is outside the selected mounts.', 'Mount the working directory or reset the profile.');
    }
    const required = new Map<string, RequiredFile>();
    for (const file of [...(pkg.requiredFiles ?? []), ...(profile?.requiredFiles ?? [])]) required.set(file.path, file);
    for (const file of required.values()) {
      if (!pkg.files.some(item => item.path === file.path)) {
        missingFiles.push(file);
        issue('REQUIRED_FILE_MISSING', `A declared ${file.kind} file is absent.`, 'Select the complete original folder/ZIP with these relative paths. Do not download arbitrary replacement DLLs.', true, file.path);
      } else if (profile && !profile.mounts.some(mount => mount.packagePath === '.' || file.path === mount.packagePath || file.path.startsWith(`${mount.packagePath}/`))) {
        issue('REQUIRED_FILE_NOT_MOUNTED', 'A declared companion file is present but not mounted.', 'Include its relative path in the package mounts.', true, file.path);
      }
    }
    warnings.push('Declared files are checked for presence only. Their contents, dependency versions and API compatibility are not validated.');
    if (pkg.resources.some(resource => resource.kind === 'archive')) warnings.push('Nested archives remain opaque; they may contain additional required files.');
    if (!explicitEntrypoint) entrypoint = undefined;
    const needsFiles = issues.some(item => ['CHOOSE_ENTRYPOINT', 'PARTIAL_HEADER', 'COM_CONTEXT_REQUIRED', 'RUNTIME_ASSET_MISSING', 'REQUIRED_FILE_MISSING', 'REQUIRED_FILE_NOT_MOUNTED', 'CWD_MISSING', 'MOUNT_SOURCE_MISSING', 'ENTRYPOINT_NOT_MOUNTED', 'CWD_NOT_MOUNTED', 'PROFILE_VERSION_MISMATCH', 'PROFILE_RUNTIME_MISMATCH', 'PROFILE_UNPINNED', 'PROFILE_REQUIRED', 'CONTROLS_UNAVAILABLE', 'MEMORY_LIMIT'].includes(item.code));
    if (needsFiles || issues.some(item => item.code === 'DOS_CONFIGURATION')) return finish('needs-files');
    const verification = matchObservedLaunch(request.identity, pkg, profile, runtime, records);
    if (verification && !issues.some(item => item.blocking)) {
      reasons.push('A reviewed observed-launch record matches the full package, runtime assets, profile and exact browser scope.');
      return finish('verified-compatible', verification);
    }
    warnings.push('No matching observed launch evidence exists. Header confidence cannot verify execution.');
    return finish(rule?.id === 'windows-ne' || diskFormats.has(probe.format) || runtime.maturity === 'experimental' || rule?.maturity === 'experimental' ? 'experimental' : 'candidate');
  } };
}
export const compatibilityPlanner = createCompatibilityPlanner();
