import type { SessionState } from '../domain/session-machine';
/** Explicit local export of metadata, never file contents, raw errors or guest output. */
export function compatibilityReport(state: SessionState): string | null {
  if (!('inspection' in state)) return null;
  const { pkg, plan } = state, path = plan.entrypoint ?? pkg.entrypoint;
  const probe = path ? state.inspection.get(path) : pkg.files.length === 1 ? state.inspection.get(pkg.files[0]!.path) : undefined;
  const list = (values: readonly string[]) => [...values.slice(0, 24).map(value => `- ${value}`), ...(values.length > 24 ? [`- ${values.length - 24} more items; see the full package report in PHANTOM OS.`] : [])];
  return ['PHANTOM OS compatibility report', `Package: ${pkg.label}`, `Files: ${pkg.files.length}; bytes: ${pkg.totalBytes}`,
    `Entrypoint: ${path ?? 'not selected'}`, `Detected format: ${probe?.format ?? 'not selected'}`,
    `Architecture: ${probe?.architecture ?? 'unknown'}; bitness: ${probe?.bitness ?? 'unknown'}`,
    `Header validity: ${probe?.validity ?? 'unknown'}`, `Decision: ${plan.decision}`, `Launch offered: ${plan.canLaunch ? 'yes' : 'no'}`,
    `Runtime: ${plan.runtimeId ?? 'none'}; build: ${plan.runtimeBuildId ?? 'not installed'}`,
    `Observed launch evidence: ${plan.verificationRecordId ?? 'no matching evidence'}`, '', 'Reasons:', ...list(plan.reasons),
    '', 'Actions required:', ...list(plan.issues.map(issue => `${issue.message} ${issue.action}${issue.path ? ` (${issue.path})` : ''}`)),
    '', 'Requirements:', ...list(plan.requirements), '', 'Uncertainty:', ...list([...plan.warnings, ...(probe?.notInferred ?? [])]),
    '', 'Static recognition and profile validation do not prove execution. No file contents are included.'].join('\n');
}
