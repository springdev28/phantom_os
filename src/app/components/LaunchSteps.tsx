import type { Route } from '../routes';
import type { SessionState } from '../../domain/session-machine';
const steps = [{ id: 'inspect', label: 'Inspect' }, { id: 'compatibility', label: 'Compatibility' }, { id: 'configure', label: 'Configure' }, { id: 'player', label: 'Run' }] as const;
export function LaunchSteps({ route, state }: { route: Route; state: SessionState }) {
  if (!steps.some(step => step.id === route)) return null;
  return <nav className="launch-steps" aria-label="Launch steps"><ol>{steps.map((step, index) => {
    const enabled = step.id === 'inspect' || 'inspection' in state;
    return <li key={step.id}>{enabled ? <a href={`#/${step.id}`} aria-current={route === step.id ? 'step' : undefined}>
      <span aria-hidden="true">{index + 1}</span>{step.label}</a> : <span aria-disabled="true"><span aria-hidden="true">{index + 1}</span>{step.label}</span>}</li>;
  })}</ol></nav>;
}
