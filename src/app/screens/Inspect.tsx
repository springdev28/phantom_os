import { useRef, useState } from 'react';
import type { ScreenProps } from '../screen-props';
import { formatSize } from '../screen-props';
import { AppError } from '../../domain/errors';
import { Icon } from '../components/Icon';
import { EmptyState, OpenButton, PageHeading } from '../components/Shared';
import { ProbeReport } from '../components/ProbeReport';
import { EntrypointPicker, PackageExplorer } from '../components/PackageExplorer';
import { formatLabels } from '../probe-labels';
import { demos } from '../demos';

export default function Inspect({ state, progress, openFile, openZip, openFolder, checkSelection, cancelInspection, clearSelection, chooseEntrypoint, demoId }: ScreenProps) {
  const [viewPath, setViewPath] = useState('');
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const pkg = 'pkg' in state ? state.pkg : undefined;
  // The initial displayed file is only a preview; it never becomes the chosen entrypoint.
  const file = pkg?.files.find(item => item.path === viewPath) ?? pkg?.files[0];
  const result = 'inspection' in state && file ? state.inspection.get(file.path) : undefined;
  const checked = 'inspection' in state;
  const checking = state.status === 'inspecting';
  const isPackage = Boolean(pkg && (pkg.files.length > 1 || pkg.origin !== 'files'));
  const additionalInputs = <div className="button-row import-options"><button className="button button-secondary" onClick={openZip}>Import ZIP</button><button className="button button-secondary" onClick={openFolder}>Choose folder</button></div>;
  return <>
    <PageHeading eyebrow="01 / INSPECT" title="Inspect your file" description="Analyze the contents, then choose the program you want to open." />
    {demoId && <p className="demo-guide"><strong>{demos[demoId].title} demo.</strong> Analyze it, choose <code>{demos[demoId].entrypoint}</code>, then view compatibility.</p>}
    {state.status === 'error' && <div className="notice notice-error" role="alert"><Icon name="info" /><div><strong>We couldn’t continue</strong><p>{new AppError(state.code).message}</p></div></div>}
    {!pkg ? <EmptyState icon="inspect" title="No file selected" action={<><OpenButton onClick={openFile} />{additionalInputs}</>}>
      <p>Choose software from your device. Originals stay unchanged.</p>
    </EmptyState> : <>
      <section className="selection-card" aria-labelledby="selected-title" aria-busy={checking}>
        <div className="selection-header"><div className="file-tile"><Icon name="inspect" size={27} /></div>
          <div className="selection-title"><p className="eyebrow" id="selected-title">{isPackage ? 'SELECTED PACKAGE' : 'SELECTED FILE'}</p><h2 className="break-name">{pkg.label}</h2></div>
          <button className="icon-button" onClick={clearSelection} aria-label="Clear selected file"><Icon name="close" size={18} /></button>
        </div>
        <dl className="metadata-grid">
          <div><dt>{isPackage ? 'Package size' : 'File size'}</dt><dd>{formatSize(pkg.totalBytes)}</dd></div>
          <div><dt>{isPackage ? 'Files retained' : 'Last modified'}</dt><dd>{isPackage ? pkg.files.length : file && new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(file.lastModified)}</dd></div>
          <div><dt>{isPackage ? 'Input kind' : 'Likely format'}</dt><dd className="muted" data-testid="probe-format">{isPackage ? pkg.origin === 'zip' ? 'ZIP package' : pkg.origin === 'folder' ? 'Folder' : 'Selected files' : result ? formatLabels[result.format] : 'Not inspected'}</dd></div>
          <div><dt>Local access</dt><dd>{checked ? <span className="positive"><Icon name="check" size={15} />{isPackage ? 'Processed locally' : 'Readable'}</span> : checking ? 'Checking…' : 'Not checked'}</dd></div>
        </dl>
        {pkg.totalBytes > 16 * 1024 * 1024 && <p className="large-file-note" role="status">Large selection: {formatSize(pkg.totalBytes)}. Header reads and ZIP extraction are bounded; you can cancel analysis. The DOS launch limit is 32 MiB including working files.</p>}
        {checked && <EntrypointPicker key={pkg.id} pkg={pkg} chooseEntrypoint={chooseEntrypoint} />}
        <div className="selection-actions">
          {checked ? <a className="button button-primary" href="#/compatibility">View compatibility <Icon name="arrow" size={17} /></a>
            : <button className="button button-primary" onClick={() => { void checkSelection(); }} disabled={checking || state.status !== 'selected'}>
              {checking ? <span className="spinner" /> : <Icon name="inspect" size={18} />}{checking ? 'Analyzing file…' : isPackage ? 'Analyze package' : 'Analyze file'}
            </button>}
          {checking ? <button className="button button-secondary" onClick={cancelInspection}>Cancel analysis</button>
            : <button className="button button-secondary" onClick={openFile}>Choose another file</button>}
        </div>
      </section>
      {checking && <div className="notice" role="status"><span className="spinner" /><div><p>{progress
        ? `${progress.phase === 'validating' ? 'Validating ZIP paths and limits' : 'Extracting and checking CRCs'}${progress.total ? ` · ${progress.completed} / ${progress.total}` : '…'}`
        : 'Reading local headers. No program runs during analysis.'}</p>{progress && progress.total > 0 && <progress aria-label="Package inspection progress" max={progress.total} value={progress.completed} />}</div></div>}
      {(isPackage || checked) && <PackageExplorer key={pkg.id} pkg={pkg} inspected={checked}
        onView={item => { setViewPath(item.path); requestAnimationFrame(() => { reportHeading.current?.focus(); reportHeading.current?.scrollIntoView({ block: 'start' }); }); }} />}
      {result && <><h2 className="report-file-heading break-name" ref={reportHeading} tabIndex={-1}>Header report: {file?.path}</h2><ProbeReport result={result} /></>}
      <details className="import-details"><summary>Import limits and other ways to select files</summary><div className="explanation-grid">
        <section><span className="small-symbol"><Icon name="inspect" size={18} /></span><h2>Keep the package together</h2><p>Imports retain relative paths, resources and empty files. A ZIP inside a package stays opaque. Disk images remain intact; mounting and booting are unavailable.</p><span className="badge">64 MiB per file · 128 MiB total · 2,048 entries</span></section>
        <section><span className="small-symbol"><Icon name="shield" size={18} /></span><h2>Only what you choose</h2><p>This selection lives in browser memory. No program runs during import. Reloading or clearing releases the selection.</p>{additionalInputs}</section>
      </div></details>
    </>}
  </>;
}
