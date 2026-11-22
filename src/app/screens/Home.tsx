import { useState } from 'react';
import type { ScreenProps } from '../screen-props';
import { Icon } from '../components/Icon';
import { OpenButton } from '../components/Shared';
import { demos } from '../demos';

export default function Home({ state, openFile, openZip, openFolder, selectFiles, loadDemo, demoLoading, demoMessage }: ScreenProps) {
  const [dragging, setDragging] = useState(false), [dropMessage, setDropMessage] = useState('');
  const pkg = 'pkg' in state ? state.pkg : undefined;
  return <>
    <section className="home-hero">
      <div className="hero-copy"><p className="eyebrow">PHANTOM OS / LOCAL SOFTWARE WORKSPACE</p>
        <h1 tabIndex={-1}>Open your software.<br /><span>See what can run.</span></h1>
        <p className="hero-description">Bring a program, ZIP or folder. Inspect it, check compatibility, then launch with reviewed settings.</p>
        <p className="hero-note">DOS is experimental. Windows, Linux, Mac and disk booting are unavailable.</p>
      </div>
      <section aria-label="Open software" className={`file-drop${dragging ? ' is-dragging' : ''}`} aria-describedby="drop-help"
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragging(true); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={event => {
          event.preventDefault(); event.stopPropagation(); setDragging(false);
          if (Array.from(event.dataTransfer.items).some(item => item.webkitGetAsEntry?.()?.isDirectory)) {
            setDropMessage('Folder drops are not imported. Use Choose folder, or open a ZIP to preserve all files.'); return;
          }
          const files = Array.from(event.dataTransfer.files);
          if (!files.length) { setDropMessage('Drop local files here, or use the file picker. Web links are not imported.'); return; }
          setDropMessage(''); selectFiles(files);
        }}>
        <Icon name="inspect" size={30} />
        <OpenButton onClick={openFile} />
        <p id="drop-help">Or drop files here. Up to 64 MiB per file.</p>
        <div className="import-links"><button className="text-link" onClick={openZip}>Import ZIP</button><button className="text-link" onClick={openFolder}>Choose folder</button></div>
        {pkg && <a className="text-link" href="#/inspect">Continue with <span className="break-name">{pkg.label}</span><Icon name="arrow" size={16} /></a>}
        {dropMessage && <p role="status">{dropMessage}</p>}
        <p className="drop-privacy"><Icon name="shield" size={16} />Files are processed locally.</p>
        <p className="caption">Selected files are not uploaded. Saving to this browser is optional.</p>
      </section>
    </section>
    <ol className="home-steps" aria-label="Launch journey"><li><strong>1. Inspect</strong><span>Choose the program in your package.</span></li><li><strong>2. Compatibility</strong><span>See the available runtime and any blockers.</span></li><li><strong>3. Configure</strong><span>Review defaults or edit settings.</span></li><li><strong>4. Run</strong><span>Use the original program and export your work.</span></li></ol>
    <section className="demo-section" aria-labelledby="demo-title"><div className="section-heading"><h2 id="demo-title">First time? Try a supplied DOS program</h2><span className="badge">Real software · GPL</span></div>
      <p>Each selection downloads a small, audited program from this site. Inspect and start it yourself.</p>
      <div className="demo-options">{(['mem', 'freecom'] as const).map(id => <div key={id}><h3>{demos[id].title}</h3><p>{demos[id].description}</p>
        <button className="button button-secondary" disabled={demoLoading} onClick={() => { void loadDemo(id); }}>Try {demos[id].title}</button></div>)}</div>
      {demoMessage && <p role="status">{demoLoading && <span className="spinner" />}{demoMessage}</p>}
      <div className="import-links"><a className="text-link" href={`${import.meta.env.BASE_URL}demos/NOTICE.txt`} target="_blank" rel="noreferrer">Demo licenses and sources</a><a className="text-link" href="#/compatibility">Which formats can run?</a></div>
    </section>
  </>;
}
