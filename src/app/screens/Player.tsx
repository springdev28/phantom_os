import { useEffect, useRef, useState } from 'react';
import type { ScreenProps } from '../screen-props';
import { formatSize, selectedFile } from '../screen-props';
import { Icon } from '../components/Icon';
import { EmptyState, PageHeading } from '../components/Shared';
import { boxedwineDescriptor } from '../../runtime/boxedwine/descriptor';
import { demos } from '../demos';

export default function Player({ state, run, stopRuntime, runtimeProgress, runtimeMessage, runtimeMetrics, guestFiles, refreshGuestFiles, exportGuestFile,
  importDocument, captureWorkingFile, transferBusy, draftProfile, workingFiles, demoId,
  runtimeFocused, runtimeRemaining, focusRuntime, releaseRuntimeInput }: ScreenProps) {
  const file = selectedFile(state);
  const panel = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(false), [displayMessage, setDisplayMessage] = useState('');
  const active = state.status === 'running' || state.status === 'preparing';
  const running = state.status === 'running';
  const demo = demoId ? demos[demoId] : null;
  const eligible = 'plan' in state && state.plan.canLaunch;
  const windows = 'plan' in state && (state.plan.runtimeId === 'boxedwine' || state.plan.automaticRuntimeId === 'boxedwine');
  useEffect(() => () => { void stopRuntime(); }, [stopRuntime]);
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === panel.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => {
    if (!active && document.fullscreenElement === panel.current) void document.exitFullscreen().catch(() => undefined);
  }, [active]);
  async function toggleFullscreen() {
    setDisplayMessage('');
    try {
      if (document.fullscreenElement === panel.current) await document.exitFullscreen();
      else if (document.fullscreenEnabled && panel.current?.requestFullscreen) await panel.current.requestFullscreen();
      else setDisplayMessage('Full screen is unavailable in this browser. The program remains usable in this viewport.');
    } catch { setDisplayMessage('Full screen was not allowed. Continue here, or try again from the button.'); }
  }
  return <>
    <PageHeading eyebrow="04 / RUN" title="Your program, running locally" description={windows ? 'Windows execution has not been verified. The Boxedwine browser trial remains disabled.' : 'Start your program. Export your work before stopping or leaving Run.'} />
    <section ref={panel} className={`player-panel${runtimeFocused ? ' input-focused' : ''}`} aria-label={windows ? 'Windows player · disabled' : 'DOS player'}>
      <div className="panel-toolbar"><span><span className={`status-dot${state.status === 'running' ? '' : ' neutral'}`} />{state.status === 'running' ? 'DOSBox running' : state.status === 'preparing' ? 'Preparing session' : 'No active session'}</span><span className="quiet-label">{windows ? 'Boxedwine · unavailable' : 'emulators 8.5.3'}</span></div>
      <div ref={viewport} className="runtime-viewport" hidden={!active} />
      {runtimeProgress && <p className="runtime-progress" role="status"><span className="spinner" />{runtimeProgress}</p>}
      {!active && <EmptyState icon="player" title={windows ? 'Windows execution unverified' : state.status === 'stopped' ? 'Session stopped' : 'Nothing is running'}>
        <p>{windows ? 'Your package remains available for inspection and profile export. No Windows program has been started.' : eligible ? 'Start the selected DOS program with the reviewed profile. Each launch receives temporary copies of your package and captured working files.' : 'Inspect the package, choose its entrypoint and apply a DOS profile before starting.'}</p>
        <a className="button button-secondary" href={file ? '#/compatibility' : '#/home'}>{file ? 'View compatibility' : 'Return home'}<Icon name="arrow" size={17} /></a>
      </EmptyState>}
      <div className="player-controls">
        <button className="button button-primary" disabled={active || !eligible} onClick={() => { if (viewport.current) void run(viewport.current); }}>{windows ? 'Windows execution unavailable' : state.status === 'stopped' || state.status === 'error' ? 'Relaunch DOS program' : 'Start DOS program'}</button>
        <button className="button button-secondary" disabled={!active} onClick={() => { void stopRuntime(); }}>Stop session</button>
        {running && <><button className="button button-secondary" onClick={focusRuntime}>Focus program</button>
          <button className="button button-secondary" onClick={releaseRuntimeInput}>Release keyboard</button>
          <button className="button button-secondary" aria-pressed={fullscreen} onClick={() => { void toggleFullscreen(); }}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button></>}
      </div>
      {running && <div className="input-help"><p role="status" data-testid="input-focus">{runtimeFocused ? 'Keyboard: program focused' : 'Keyboard: browser controls'}</p>
        <p>Click the screen or Focus program to type. <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Esc</kbd> releases input; <kbd>Tab</kbd> leaves the screen. Use the on-screen Tab button for DOS. {fullscreen && 'Esc exits full screen.'}</p>
        {runtimeRemaining !== null && <p className={runtimeRemaining <= 60 ? 'time-warning' : 'caption'}>Session limit: {Math.ceil(runtimeRemaining / 60)} min remaining. Export before it ends.</p>}</div>}
      {displayMessage && <p className="runtime-notice" role="status">{displayMessage}</p>}
      <div className="panel-bottom"><Icon name="lock" size={15} /><span>Guest networking disabled</span><span className="quiet-label">{windows ? 'No guest environment mounted' : 'Temporary C: drive'}</span></div>
    </section>
    {runtimeMessage && <p className="runtime-notice" role="status">{runtimeMessage}</p>}
    {workingFiles.length > 0 && <p className="caption">{workingFiles.length} captured working files will be included on relaunch. Manage or save them in <a className="text-link" href="#/workspace">Workspace</a>.</p>}
    {windows ? <section className="planner-issues" aria-label="Windows integration blockers"><h2>Why Windows stays disabled</h2><ul>{boxedwineDescriptor.blockers!.map(blocker => <li key={blocker.code}><strong>{blocker.message}</strong><p>{blocker.action}</p></li>)}</ul></section>
      : <p className="caption">US keyboard mapping. Browser shortcuts stay available. Audio needs Enable audio in the viewport. The original DOS screen uses pixels and may not work with a screen reader; exported text files can be read separately.</p>}
    {runtimeMetrics && active && <details className="session-diagnostics"><summary>Session diagnostics</summary><p className="caption" data-testid="runtime-metrics" data-frames={runtimeMetrics.frames} data-audio-samples={runtimeMetrics.audioSamples} data-audio-peak={runtimeMetrics.audioPeak} data-key-events={runtimeMetrics.keyEvents} data-mouse-events={runtimeMetrics.mouseEvents}>Received {runtimeMetrics.frames} real framebuffer updates · {runtimeMetrics.keyEvents} keyboard events · {runtimeMetrics.mouseEvents} mouse events. Activity alone does not verify program compatibility.</p></details>}
    {demo && <section className="demo-help" aria-label="Demo instructions"><h2>Try it: create and export a file</h2>
      <ol><li>{running ? 'Focus the DOS screen.' : 'Start DOS program, then focus the DOS screen.'} At the prompt, type <code>{demo.command}</code> and press Enter.</li>
        <li>Select <strong>Refresh guest files</strong> below, then <strong>Export {demo.output}</strong>.</li>
        <li>Open the downloaded text file. Your program created these bytes in DOS.</li></ol>
      <p className="caption">The command uses a US keyboard; &gt; is Shift + period. Files remain temporary until you export or explicitly save them.</p></section>}
    {state.status === 'running' && <section className="guest-files" aria-label="Guest files">
      <div className="section-heading"><h2>Temporary guest files</h2><button className="button button-secondary" disabled={transferBusy} onClick={() => { void refreshGuestFiles(); }}>Refresh guest files</button></div>
      <p>Save and close the document inside DOS, then refresh and export it below.</p>
      <p className="caption">Export downloads a file. Capture keeps a copy for relaunch; Workspace can save that copy to this browser. Later edits require a new capture.</p>
      <button className="button button-secondary" disabled={transferBusy} onClick={() => documentInput.current?.click()}>{transferBusy ? 'Transferring locally…' : 'Import document into running program'}</button>
      <input ref={documentInput} type="file" className="sr-only" tabIndex={-1} aria-label="Choose a document for DOS" onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importDocument(file);
      }} />
      <p className="caption">Import one new file, up to 8 MiB, into C:\\ using a DOS 8.3 name such as NOTES.TXT. Existing names cannot be overwritten. Open it from inside the program. No file is saved to browser storage automatically.</p>
      {guestFiles.length ? <ul>{guestFiles.map(file => <li key={file.path}><code>{file.path}</code><span>{formatSize(file.size)}</span><button className="text-link" disabled={transferBusy} onClick={() => { void exportGuestFile(file.path); }}>Export {file.path}</button>
        <button className="text-link" disabled={transferBusy || file.path.toLowerCase() === draftProfile?.entrypoint?.toLowerCase()} onClick={() => { void captureWorkingFile(file.path, draftProfile?.entrypoint ?? null); }}>Capture {file.path}</button></li>)}</ul> : <p>No file list loaded. Refresh to read the real guest filesystem.</p>}
    </section>}
  </>;
}
