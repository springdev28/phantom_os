import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { routes, useRoute } from './routes';
import { useSession } from './use-session';
import { formatSize } from './screen-props';
import { Icon } from './components/Icon';
import { EmptyState } from './components/Shared';
import type { ScreenProps } from './screen-props';
import { LaunchSteps } from './components/LaunchSteps';

const Home = lazy(() => import('./screens/Home'));
const Inspect = lazy(() => import('./screens/Inspect'));
const Compatibility = lazy(() => import('./screens/Compatibility'));
const Configure = lazy(() => import('./screens/Configure'));
const Player = lazy(() => import('./screens/Player'));
const Workspace = lazy(() => import('./screens/Workspace'));
const screens = { home: Home, inspect: Inspect, compatibility: Compatibility, configure: Configure, player: Player, workspace: Workspace };

function RouteScreen({ route, ...props }: ScreenProps & { route: ReturnType<typeof useRoute> }) {
  const region = useRef<HTMLDivElement>(null);
  const previousRoute = useRef(route);
  useEffect(() => {
    // The effect runs after a lazy screen resolves, so navigation focus is reliable.
    if (previousRoute.current !== route) region.current?.querySelector<HTMLElement>('h1')?.focus();
    previousRoute.current = route;
  }, [route]);
  if (route === 'not-found') return <div ref={region}><h1 tabIndex={-1}>Page not found</h1>
    <EmptyState icon="info" title="That view isn’t available" action={<a className="button button-primary" href="#/home">Return home</a>}><p>Use the navigation to choose a workspace view.</p></EmptyState></div>;
  const Screen = screens[route];
  return <div ref={region}><Screen {...props} /></div>;
}

export default function App() {
  const route = useRoute();
  const session = useSession();
  const input = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [intakeMessage, setIntakeMessage] = useState('');
  function openFolder() {
    if (folderInput.current && 'webkitdirectory' in folderInput.current) { setIntakeMessage(''); folderInput.current.click(); }
    else setIntakeMessage('Folder selection is unavailable in this browser. Open a ZIP, or select multiple files with Open legacy software.');
  }
  const pkg = 'pkg' in session.state ? session.state.pkg : undefined;
  const label = routes.find(item => item.id === route)?.label ?? 'Not found';
  useEffect(() => { document.title = `${label} — PHANTOM OS`; }, [label]);
  const status = session.state.status === 'inspecting' ? 'Processing selected files locally.'
    : session.state.status === 'selected' ? 'File selected. Ready to analyze.'
      : session.state.status === 'unsupported' ? 'Inspection finished. Review compatibility and remaining setup.'
        : session.state.status === 'error' ? 'The operation failed. Review the error and retry.'
          : session.state.status === 'running' ? 'The DOS worker is running.'
            : session.state.status === 'ready' ? 'Ready for an experimental DOS launch.'
              : session.state.status === 'stopped' ? 'The session stopped.' : '';
  return <div className="app-shell" data-session-state={session.state.status} onDragOver={event => {
    if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
  }} onDrop={event => { event.preventDefault(); }}>
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault(); document.getElementById('main-content')?.focus();
    }}>Skip to content</a>
    <aside className="sidebar">
      <a className="brand" href="#/home" aria-label="PHANTOM OS home"><span className="brand-mark" aria-hidden="true">P<span /></span><span>PHANTOM<span className="brand-os">OS</span></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{routes.map(item => <a key={item.id} className={`nav-item${route === item.id ? ' active' : ''}`}
        href={`#/${item.id}`} aria-label={item.label} aria-current={route === item.id ? 'page' : undefined}>
        <Icon name={item.id} size={19} /><span>{item.label}</span><span className="nav-index">{item.index}</span>
      </a>)}</nav>
      <div className="sidebar-bottom"><div className="local-session"><p className="eyebrow"><span className="status-dot" />ON THIS DEVICE</p>
        <strong>{session.workspace.storageEnabled ? 'Manual saving enabled' : 'Temporary session'}</strong><p>{session.workspace.savedWorkspace ? 'Saved copy available.' : 'Unsaved files clear on reload.'}<br />No account required.</p></div>
        <div className="sidebar-version"><span>PHANTOM / 0.1</span><span>PREVIEW</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={12} /><strong>{label}</strong></div>
        <div className="topbar-actions"><span className="session-badge"><span className="status-dot" />Local session</span>
          {route !== 'home' && <button className="button button-small" onClick={() => input.current?.click()}><Icon name="plus" size={16} />Open file</button>}</div>
      </header>
      <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose a local file"
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length) session.selectFiles(files);
        }} />
      <input ref={zipInput} type="file" accept=".zip,application/zip" className="sr-only" tabIndex={-1} aria-label="Choose a ZIP archive"
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
          if (files.length) session.selectFiles(files, 'zip');
        }} />
      <input ref={folderInput} type="file" multiple {...{ webkitdirectory: '' }} className="sr-only" tabIndex={-1} aria-label="Choose a local folder"
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
          if (files.length) session.selectFiles(files, 'folder');
        }} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status}</div>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <LaunchSteps route={route} state={session.state} />
        {intakeMessage && <p className="notice" role="status">{intakeMessage}</p>}
        <Suspense fallback={<div className="view-loading" role="status"><span className="spinner" />Loading view…</div>}>
          <RouteScreen route={route} {...session} openFile={() => input.current?.click()}
            openZip={() => zipInput.current?.click()} openFolder={openFolder} />
        </Suspense>
      </main>
      <footer className="app-footer"><span><Icon name="shield" size={14} />Local processing · explicit saves and exports.</span>
        <span className="footer-selection">{pkg ? <><span className="footer-filename">{pkg.label}</span><span>{formatSize(pkg.totalBytes)}</span></> : 'No file selected'}</span></footer>
    </div>
  </div>;
}
