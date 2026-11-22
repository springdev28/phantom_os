import type { ScreenProps } from '../screen-props';
import { selectedFile } from '../screen-props';
import { Icon } from '../components/Icon';
import { EmptyState, OpenButton, PageHeading, RuntimeList } from '../components/Shared';
import { CompatibilityReport } from '../components/CompatibilityReport';
import { formatLabels, validityLabels } from '../probe-labels';
import { runtimeRegistry } from '../../runtime/registry';
import type { CompatibilityPlan, RuntimeId } from '../../domain/contracts';

const labels: Record<CompatibilityPlan['decision'], string> = {
  'verified-compatible': 'Verified for this exact configuration', candidate: 'Candidate adapter · untested',
  'needs-files': 'Files or setup required', experimental: 'Experimental path · unverified',
  unsupported: 'No eligible execution path', invalid: 'Invalid input',
};

export default function Compatibility(props: ScreenProps) {
  const { state, openFile, selection, chooseRuntime, dosComConfirmed, confirmDosCom } = props;
  const pkg = 'pkg' in state ? state.pkg : undefined, plan = 'plan' in state ? state.plan : undefined;
  const file = plan?.entrypoint ? pkg?.files.find(item => item.path === plan.entrypoint) : selectedFile(state);
  const result = 'inspection' in state && file ? state.inspection.get(file.path) : undefined;
  return <>
    <PageHeading eyebrow="02 / COMPATIBILITY" title="Compatibility, with evidence" description="Check the runtime and any blockers before configuring a launch." />
    {pkg ? <section className="compatibility-summary">
      <div className="summary-top"><span className="badge badge-amber" data-testid="compatibility-decision">{plan?.decision ?? 'Awaiting inspection'}</span><span className="quiet-label">{plan?.engineInstalled ? 'Engine installed' : 'No runtime installed'}</span></div>
      <h2>{plan ? labels[plan.decision] : 'Inspect the selected package first'}</h2><p className="break-name">{pkg.label}</p>
      <p className="break-name">{plan?.entrypoint ? `Chosen entrypoint: ${plan.entrypoint}` : 'No entrypoint selected. Choose the intended executable in Inspect.'}</p>
      <div className="compatibility-checks"><div><Icon name="inspect" /><div><strong>Format recognition</strong><span>{result ? `${formatLabels[result.format]} · ${validityLabels[result.validity]}` : 'Select and inspect an entrypoint'}</span></div></div>
        <div><Icon name="player" /><div><strong>Observed execution</strong><span>{plan?.verificationRecordId ?? 'No matching launch evidence'}</span></div></div></div>
      {plan && <>
        <details className="planner-selection"><summary>Change runtime selection</summary><label htmlFor="runtime-selection">Adapter selection</label>
          <select id="runtime-selection" value={selection.mode === 'automatic' ? 'automatic' : selection.runtimeId}
            onChange={event => chooseRuntime(event.target.value === 'automatic' ? { mode: 'automatic' } : { mode: 'override', runtimeId: event.target.value as RuntimeId })}>
            <option value="automatic">Automatic · use header evidence</option>
            {runtimeRegistry.list().map(runtime => <option key={runtime.id} value={runtime.id}>Override: {runtime.name} · {runtime.available ? runtime.version : 'not installed'}</option>)}
          </select>
          <p className="caption">Automatic suggestion: {plan.automaticRuntimeId ?? 'none'}. An override changes the requested adapter, never the evidence or safety checks.</p>
        </details>
        {result?.format === 'dos-com-ambiguous' && <label className="check-label"><input type="checkbox" checked={dosComConfirmed} onChange={event => confirmDosCom(event.target.checked)} />I have confirmed from its documentation that this raw binary is intended for DOS COM.</label>}
        <div className="decision-reasons"><h3>Why this decision</h3><ul>{plan.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
        {plan.issues.some(issue => issue.code !== 'PROFILE_REQUIRED') && <div className="planner-issues"><h3>Before execution can be offered</h3><ul>{plan.issues.filter(issue => issue.code !== 'PROFILE_REQUIRED').map((issue, index) => <li key={`${issue.code}-${index}`}>
          <strong>{issue.message}</strong>{issue.path && <code className="break-name">{issue.path}</code>}<p>{issue.action}</p>
        </li>)}</ul></div>}
        {plan.requirements.length > 0 && <details><summary>Environment and resource requirements</summary><ul>{plan.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul></details>}
        <details className="plan-uncertainty"><summary>What remains unknown</summary><ul>{plan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
          {pkg.resources.length > 0 && <p>{pkg.resources.length} possible resources retained. Inspect shows library, configuration and data hints; these are not a resolved dependency list.</p>}
        </details>
      </>}
      <div className="button-row">{plan?.engineInstalled && !plan.issues.some(issue => issue.blocking && issue.code !== 'PROFILE_REQUIRED')
        ? <a className="button button-primary" href="#/configure">Configure launch <Icon name="arrow" size={17} /></a> : <button className="button button-primary" disabled aria-describedby="run-unavailable"><Icon name="lock" size={17} />Run unavailable</button>}
        <a className="text-link" href="#/inspect">Back to file details <Icon name="arrow" size={16} /></a></div>
      <p id="run-unavailable" className="caption">{plan?.engineInstalled ? 'Configure a profile next. Starting the program is a separate action.' : 'You can inspect this package and export its report. No eligible runtime is available.'}</p>
    </section> : <EmptyState icon="compatibility" title="Start with a file" action={<OpenButton onClick={openFile} />}>
      <p>Select your software first. No compatibility verdict is made from a filename alone.</p>
    </EmptyState>}
    <CompatibilityReport state={state} />
    <a className="text-link" href="#/configure">Review or import launch settings</a>
    <section className="format-guide" aria-label="Format availability"><h2>Which formats can run?</h2>
      <dl><dt>DOS COM / MZ</dt><dd>Experimental DOSBox path. Each program still needs its files and a launch test.</dd>
        <dt>16-bit / 32-bit Windows</dt><dd>Experimental Boxedwine investigation, currently disabled. A verified Wine environment and Windows application test are missing.</dd>
        <dt>64-bit Windows, ELF/Linux, Mac, disk images</dt><dd>Unsupported execution. Recognizing a header does not provide the OS or runtime it requires.</dd></dl></section>
    <RuntimeList />
    <details className="decision-legend"><summary>How to read compatibility states</summary><dl>
      <dt>verified-compatible</dt><dd>Observed output, meaningful input, stop/relaunch, applicable file I/O and network checks match this exact package, runtime, configuration and browser.</dd>
      <dt>candidate</dt><dd>Header fields suggest an adapter. This is not a successful launch or a compatibility promise.</dd>
      <dt>needs-files</dt><dd>An entrypoint, declared dependency, mount, context or configuration still needs your attention.</dd>
      <dt>experimental</dt><dd>An explicitly experimental adapter or environment path needs testing.</dd>
      <dt>unsupported</dt><dd>No eligible adapter rule exists, or the override conflicts with the detected format.</dd>
      <dt>invalid</dt><dd>The input header or profile failed validation.</dd>
    </dl></details>
  </>;
}
