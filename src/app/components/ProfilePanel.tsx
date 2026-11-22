import { useRef, useState } from 'react';
import type { ScreenProps } from '../screen-props';
import { ProfileError, serializeLaunchProfile } from '../../profiles/launch-profile';
import { DEFAULT_DOS_SETTINGS } from '../../runtime/dos/config';

export function ProfilePanel({ draftProfile: profile, importProfile, updateProfile, resetProfile, profileLoading, profileMessage }: ScreenProps) {
  const input = useRef<HTMLInputElement>(null), [exportMessage, setExportMessage] = useState('');
  function exportProfile() {
    if (!profile) return;
    try {
      const blob = new Blob([serializeLaunchProfile(profile)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'phantom-launch-profile.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExportMessage('JSON exported locally. No application or document contents are included.');
    } catch (error) { setExportMessage(error instanceof ProfileError ? error.message : 'The profile could not be exported.'); }
  }
  return <section className="profile-panel" aria-labelledby="profile-title">
    <div className="section-heading"><h2 id="profile-title">Launch profile</h2><span className="badge">JSON · local only</span></div>
    <p>Advanced settings and portable JSON. No application or document contents are included.</p>
    <div className="button-row">
      <button className="button button-secondary" onClick={() => input.current?.click()} disabled={profileLoading}>{profileLoading ? 'Reading profile…' : 'Import profile JSON'}</button>
      <button className="button button-secondary" onClick={exportProfile} disabled={!profile}>Export profile JSON</button>
      {profile && <button className="button button-secondary" onClick={() => updateProfile(profile)}>Use this profile</button>}
      {profile && <button className="text-link" onClick={resetProfile}>Reset profile</button>}
    </div>
    <input ref={input} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose a launch profile JSON"
      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; setExportMessage(''); if (file) void importProfile(file); }} />
    <p className="caption" role="status">{profileMessage || exportMessage}</p>
    {exportMessage && profileMessage && <p className="caption" role="status">{exportMessage}</p>}
    {profile ? <>
      <dl className="metadata-grid profile-metadata">
        <div><dt>Runtime / version</dt><dd>{profile.runtimeId ?? 'Unresolved'} / {profile.runtimeVersion ?? 'not installed'}</dd></div>
        <div><dt>Build</dt><dd>{profile.runtimeBuildId ?? 'Unpinned draft'}</dd></div>
        <div><dt>Entrypoint reference</dt><dd className="break-name">{profile.entrypoint ?? 'Choose in Inspect'}</dd></div>
        <div><dt>Required file references</dt><dd>{profile.requiredFiles.length} · presence only</dd></div>
      </dl>
      <p className="caption">Null runtime/version fields mark an unresolved draft. An imported profile can ask for missing files; it cannot supply them or install an engine.</p>
      <details className="profile-settings"><summary>Edit controls, mounts and limits</summary>
        <form key={JSON.stringify(profile)} onSubmit={event => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          updateProfile({ ...profile, cwd: String(data.get('cwd')),
            ...(profile.runtimeId === 'js-dos' ? { dos: { cycles: Number(data.get('cycles')), core: data.get('core') as 'auto' | 'normal' | 'simple', machine: data.get('machine') as 'svga_s3' | 'vgaonly' | 'ega', xms: data.has('xms'), ems: data.has('ems') } } : {}),
            controls: { keyboard: 'us', mouse: data.get('mouse') as 'off' | 'absolute' | 'captured', audio: data.has('audio') },
            limits: { guestMemoryMiB: Number(data.get('memory')), maxSessionMs: Number(data.get('minutes')) * 60_000 },
            mounts: profile.mounts.map((_, index) => ({ packagePath: String(data.get(`source-${index}`)), guestPath: String(data.get(`destination-${index}`)), readOnly: data.has(`readonly-${index}`) })),
          });
        }}>
          <div className="profile-form-grid">
            <label>Keyboard<select disabled aria-label="Keyboard layout"><option>US</option></select></label>
            <label>Mouse mode<select name="mouse" defaultValue={profile.controls.mouse}><option value="off">Off</option><option value="absolute">Absolute</option><option value="captured">Captured</option></select></label>
            <label>Guest memory (MiB)<input name="memory" type="number" min={16} max={512} step={1} defaultValue={profile.limits.guestMemoryMiB} required /></label>
            <label>Session limit (minutes)<input name="minutes" type="number" min={1} max={30} step="any" defaultValue={profile.limits.maxSessionMs / 60_000} required /></label>
            <label>Working directory<input name="cwd" defaultValue={profile.cwd} maxLength={1024} required autoComplete="off" spellCheck={false} /></label>
            <label className="check-label"><input name="audio" type="checkbox" defaultChecked={profile.controls.audio} />Enable audio if the adapter provides it</label>
          </div>
          {profile.runtimeId === 'js-dos' && <fieldset><legend>DOS launch settings</legend><div className="profile-form-grid">
            <label>CPU cycles<input name="cycles" type="number" min={300} max={30000} step={1} required defaultValue={(profile.dos ?? DEFAULT_DOS_SETTINGS).cycles} /></label>
            <label>CPU core<select name="core" defaultValue={(profile.dos ?? DEFAULT_DOS_SETTINGS).core}><option value="auto">Auto</option><option value="normal">Normal</option><option value="simple">Simple</option></select></label>
            <label>Video machine<select name="machine" defaultValue={(profile.dos ?? DEFAULT_DOS_SETTINGS).machine}><option value="svga_s3">SVGA S3</option><option value="vgaonly">VGA</option><option value="ega">EGA</option></select></label>
            <label className="check-label"><input type="checkbox" name="xms" defaultChecked={(profile.dos ?? DEFAULT_DOS_SETTINGS).xms} />XMS memory</label>
            <label className="check-label"><input type="checkbox" name="ems" defaultChecked={(profile.dos ?? DEFAULT_DOS_SETTINGS).ems} />EMS memory</label>
          </div><p className="caption">Generated DOSBox configuration only. Imported .conf files and autoexec scripts are never used automatically. Fixed cycles cap CPU demand; real-time performance varies by device.</p></fieldset>}
          <fieldset><legend>Package mounts</legend><p className="caption">Use “.” for the whole package. These references do not access host folders or mount a disk image.</p>
            {profile.mounts.map((mount, index) => <div className="profile-form-grid mount-row" key={index}>
              <label>Package path {index + 1}<input name={`source-${index}`} defaultValue={mount.packagePath} required maxLength={1024} autoComplete="off" spellCheck={false} /></label>
              <label>Guest path {index + 1}<input name={`destination-${index}`} defaultValue={mount.guestPath} required maxLength={1027} autoComplete="off" spellCheck={false} /></label>
              <label className="check-label"><input name={`readonly-${index}`} type="checkbox" defaultChecked={mount.readOnly} />Read only</label>
            </div>)}
          </fieldset>
          <p className="caption">The DOS adapter accepts one writable temporary C:/ mount and 16–64 MiB guest memory. Your selected originals are immutable; guest changes are lost when the session stops.</p>
          <button className="button button-secondary" type="submit">Apply profile settings</button>
        </form>
      </details>
    </> : <p className="caption">Analyze a selected package to create a draft, or import a saved profile first. Maximum JSON size: 2 MiB.</p>}
  </section>;
}
