import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { runtimeRegistry } from '../../runtime/registry';

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p>
    <h1 tabIndex={-1}>{title}</h1><p className="page-description">{description}</p></div>;
}
export function EmptyState({ icon, title, children, action }: {
  icon: IconName; title: string; children: ReactNode; action?: ReactNode;
}) {
  return <div className="empty-state"><div className="empty-symbol"><Icon name={icon} size={30} /></div>
    <h2>{title}</h2><div className="empty-copy">{children}</div>{action}</div>;
}
export function OpenButton({ onClick, label = 'Open legacy software' }: { onClick(): void; label?: string }) {
  return <button className="button button-primary" onClick={onClick}><Icon name="plus" size={18} />{label}</button>;
}
export function RuntimeList() {
  return <section className="runtime-section" aria-labelledby="runtime-title">
    <div className="section-heading"><h2 id="runtime-title">Runtime availability</h2><span className="quiet-label">{runtimeRegistry.list().filter(runtime => runtime.available).length} installed</span></div>
    <div className="runtime-list">{runtimeRegistry.list().map(runtime => <div className="runtime-row" key={runtime.id}>
      <div className="runtime-monogram" aria-hidden="true">{runtime.id === 'js-dos' ? 'D_' : 'W_'}</div>
      <div className="runtime-name"><strong>{runtime.id === 'js-dos' ? 'DOS' : 'Legacy Windows'}</strong>
        <span>{runtime.name}{runtime.id === 'boxedwine' ? ' / Wine' : ''}</span></div>
      <span className="runtime-detail">{runtime.id === 'js-dos' ? 'COM / MZ candidates' : 'Windows NE / x86 PE32 candidates'}</span>
      <span className="badge">{runtime.maturity === 'experimental' ? 'Experimental' : 'Planned'}{!runtime.available ? ' · disabled' : ''}</span>
    </div>)}</div>
    <p className="caption">DOSBox is available for explicit local trials. Windows execution has not been verified: the Boxedwine trial remains disabled pending an audited Wine environment and a real application test. No disk-image environment is enabled. Format recognition never verifies an arbitrary program.</p>
  </section>;
}
