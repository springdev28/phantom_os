import type { ScreenProps } from '../screen-props';
import { PageHeading } from '../components/Shared';
import { ProfilePanel } from '../components/ProfilePanel';
import { compatibilityPlanner } from '../../planner/compatibility-planner';
import { runtimeRegistry } from '../../runtime/registry';
import { navigate } from '../routes';

export default function Configure(props: ScreenProps) {
  const { state, draftProfile, updateProfile, selection, dosComConfirmed } = props;
  const preview = draftProfile && 'inspection' in state ? compatibilityPlanner.plan(state.pkg, state.inspection, runtimeRegistry.list(),
    { profile: draftProfile, selection, dosComConfirmed }) : null;
  return <>
    <PageHeading eyebrow="03 / CONFIGURE" title="Configure launch" description="Review the defaults. Advanced settings are optional." />
    <section className="configure-summary" aria-label="Launch settings summary">
      <h2>{draftProfile?.runtimeId === 'js-dos' ? 'DOS launch defaults' : 'No eligible launch yet'}</h2>
      {draftProfile ? <><p className="break-name"><strong>Program:</strong> {draftProfile.entrypoint ?? 'Choose a program in Inspect'}</p>
        <p>{draftProfile.runtimeId === 'js-dos' ? `US keyboard · ${draftProfile.limits.guestMemoryMiB} MiB memory · ${Math.round(draftProfile.limits.maxSessionMs / 60000)} minute limit` : 'Review the missing runtime or format requirements in Compatibility.'}</p>
        <p>Guest writes use temporary copies. Capture or export changes before stopping.</p></> : <p>Inspect a file, or import a profile below.</p>}
      <div className="button-row"><button className="button button-primary" disabled={!preview?.canLaunch} onClick={() => {
        if (draftProfile && preview?.canLaunch) { updateProfile(draftProfile); navigate('player'); }
      }}>Use these settings and continue</button><a className="text-link" href="#/compatibility">Back to compatibility</a></div>
      {preview && !preview.canLaunch && <p className="caption" role="status">{preview.issues.find(issue => issue.blocking)?.action ?? preview.reasons[0]}</p>}
    </section>
    <ProfilePanel {...props} />
  </>;
}
