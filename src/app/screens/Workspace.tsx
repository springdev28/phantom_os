import { useState } from 'react';
import type { ScreenProps } from '../screen-props';
import { formatSize } from '../screen-props';
import { Icon } from '../components/Icon';
import { EmptyState, OpenButton, PageHeading } from '../components/Shared';
import { ProfilePanel } from '../components/ProfilePanel';
import { savedBytes } from '../../workspace/manifest';

export default function Workspace(props: ScreenProps) {
  const { state, openFile, clearSelection, workspace: storage, workingFiles, removeWorkingFile, saveCurrentWorkspace, restoreSavedWorkspace, draftProfile } = props;
  const pkg = 'pkg' in state ? state.pkg : undefined;
  const [saveSoftware, setSaveSoftware] = useState(false), [saveDocuments, setSaveDocuments] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const busy = storage.storageBusy || ['running', 'preparing', 'inspecting'].includes(state.status);
  const saved = storage.savedWorkspace;
  return <>
    <PageHeading eyebrow="04 / LOCAL WORKSPACE" title="Keep only what you choose" description="Work temporarily, or save a copy in this browser. No account, uploads or automatic saves." />
    <div className="workspace-stats"><div><span>Selected files</span><strong>{pkg ? pkg.files.length.toString().padStart(2, '0') : '00'}</strong></div>
      <div><span>Saved file bytes</span><strong>{saved ? formatSize(savedBytes(saved)) : '0 bytes'}</strong></div>
      <div><span>Storage mode</span><strong className="stat-text"><span className="status-dot" />{storage.storageEnabled ? 'Manual saves' : 'Temporary'}</strong></div></div>
    <section className="profile-panel storage-panel" aria-label="Browser-local storage">
      <div className="section-heading"><h2>Browser-local storage</h2><span className="badge">OPFS · this origin only</span></div>
      <p>Saved data belongs to this browser profile and this site’s origin (including its port). It is separate from your original files and downloads. Browser data can be cleared or evicted. Keep an exported backup; retention is not guaranteed.</p>
      <fieldset disabled={busy || !storage.storageAvailable}>
        <legend>Storage choices</legend>
        <label className="storage-choice"><input type="checkbox" checked={storage.storageEnabled} onChange={event => storage.toggleStorage(event.target.checked)} /> Enable browser storage for manual saves</label>
        <p className="caption">Temporary mode performs no new saves. Turning it off leaves any existing saved copy until you delete it.</p>
        <label className="storage-choice"><input type="checkbox" checked={saveSoftware} disabled={!storage.storageEnabled || !pkg} onChange={event => setSaveSoftware(event.target.checked)} /> Save application software</label>
        <label className="storage-choice"><input type="checkbox" checked={saveDocuments} disabled={!storage.storageEnabled || !workingFiles.length} onChange={event => setSaveDocuments(event.target.checked)} /> Save captured working files</label>
        <p className="caption">Profile-only is the default. Each save replaces the previous saved workspace with exactly these choices. Unchecked software and working-file copies are removed from that saved workspace.</p>
        <button className="button button-primary" disabled={!storage.storageEnabled || !draftProfile} onClick={() => { void saveCurrentWorkspace(saveSoftware && Boolean(pkg), saveDocuments && Boolean(workingFiles.length)); }}>Save workspace</button>
      </fieldset>
      {busy && <p className="caption">Finish inspection or stop the guest before managing saved storage. Capture live changes in Player before leaving it.</p>}
      <p className="storage-status" role="status">{storage.storageMessage}</p>
      <dl className="metadata-grid"><div><dt>Estimated origin usage</dt><dd>{storage.storageEstimate.usage === undefined ? 'Unavailable' : formatSize(storage.storageEstimate.usage)}</dd></div>
        <div><dt>Estimated origin quota</dt><dd>{storage.storageEstimate.quota === undefined ? 'Unavailable' : formatSize(storage.storageEstimate.quota)}</dd></div>
        <div><dt>Last saved</dt><dd>{saved ? new Date(saved.savedAt).toLocaleString() : 'No readable save'}</dd></div>
        <div><dt>Software bytes</dt><dd>{saved?.application?.saved ? 'Explicitly saved' : 'Not saved · original required'}</dd></div></dl>
      <div className="button-row">
        <button className="button button-secondary" disabled={!saved || busy} onClick={() => { void restoreSavedWorkspace(); }}>Restore workspace</button>
        <button className="button button-secondary" disabled={!saved || busy} onClick={() => { void storage.exportBackup(); }}>Export backup</button>
        <button className="text-link" disabled={storage.storageBusy} onClick={() => { void storage.refreshStorageUsage(); }}>Refresh storage usage</button>
        <button className="text-link" disabled={busy || !storage.storageAvailable} onClick={() => setDeleteArmed(true)}>Delete workspace</button>
      </div>
      {deleteArmed && <div className="notice" role="alert"><div><strong>Delete this browser’s saved workspace?</strong><p>This removes the saved software, working copies and profile. Temporary files and downloaded backups are unchanged.</p>
        <div className="button-row"><button className="button button-secondary" disabled={busy} onClick={() => { setDeleteArmed(false); void storage.deleteWorkspace(); }}>Confirm delete workspace</button><button className="text-link" onClick={() => setDeleteArmed(false)}>Cancel deletion</button></div></div></div>}
      <p className="caption">Backup is a ZIP of previously saved files plus a portable JSON manifest and launch profile. Extract it locally, select its application folder and import launch-profile.json to use it elsewhere. Import saved documents through Player. Backup exports do not include unsaved guest changes.</p>
    </section>
    {pkg ? <section className="workspace-files" aria-labelledby="workspace-files-title">
      <div className="section-heading"><h2 id="workspace-files-title">Current selection</h2><span className="badge">In memory</span></div>
      <div className="workspace-file"><div className="file-tile"><Icon name="inspect" size={24} /></div><div className="workspace-file-name"><strong className="break-name">{pkg.label}</strong><span>{pkg.files.length} files · {formatSize(pkg.totalBytes)} · Original file unchanged</span></div>
        <a className="text-link" href="#/inspect">Inspect <Icon name="arrow" size={16} /></a></div>
      <div className="workspace-actions"><button className="button button-secondary" disabled={busy} onClick={clearSelection}><Icon name="close" size={16} />Clear selection</button><p>Clears temporary selection and working copies. Saved data and original files are unchanged.</p></div>
    </section> : <EmptyState icon="workspace" title="A fresh workspace" action={<OpenButton onClick={openFile} />}><p>Select the original software or restore an explicitly saved package. Nothing starts automatically.</p></EmptyState>}
    <section className="guest-files" aria-label="Captured working files"><h2>Captured working files</h2>
      <p className="caption">Capture saved guest files in Player before stopping. These snapshots are in memory until you explicitly save them above. They overlay application copies on the next launch; originals stay unchanged. Selecting another package clears these temporary captures.</p>
      {workingFiles.length ? <ul>{workingFiles.map(file => <li key={file.path}><code>{file.path}</code><span>{formatSize(file.size)}</span><button className="text-link" disabled={busy} onClick={() => removeWorkingFile(file.path)}>Remove {file.path}</button></li>)}</ul> : <p>No working files captured.</p>}
    </section>
    <ProfilePanel {...props} />
  </>;
}
