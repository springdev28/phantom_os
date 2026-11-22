import { useState } from 'react';
import type { ApplicationPackage, FileArtifact } from '../../domain/contracts';
import { formatSize } from '../screen-props';

const PAGE_SIZE = 40;
export function EntrypointPicker({ pkg, chooseEntrypoint }: { pkg: ApplicationPackage; chooseEntrypoint(path: string): void }) {
  const [candidatePage, setCandidatePage] = useState(0);
  const candidates = pkg.candidates.slice(candidatePage * 20, (candidatePage + 1) * 20);
  return <fieldset className="entrypoint-picker">
      <legend>Choose the intended executable</legend>
      <p>{pkg.candidates.length ? `${pkg.candidates.length} candidate${pkg.candidates.length === 1 ? '' : 's'} found. No program is selected automatically.`
        : 'No executable candidate was identified. Files remain available for inspection.'}</p>
      <p className="entrypoint-status" data-testid="entrypoint-status">{pkg.entrypoint ? <>Selected entrypoint: <strong>{pkg.entrypoint}</strong></> : 'No entrypoint selected'}</p>
      {candidates.map(candidate => <label key={candidate.path} className={`candidate-option${pkg.entrypoint === candidate.path ? ' chosen' : ''}`}>
        <input type="radio" name="entrypoint" value={candidate.path} checked={pkg.entrypoint === candidate.path}
          onChange={() => chooseEntrypoint(candidate.path)} aria-label={`Choose ${candidate.path} as entrypoint`} />
        <span><strong className="break-name">{candidate.path}</strong><span>{candidate.reason}</span><small>{candidate.caution}</small></span>
      </label>)}
      {pkg.candidates.length > 20 && <div className="explorer-pagination"><button className="button button-small" disabled={candidatePage === 0} onClick={() => setCandidatePage(value => value - 1)}>Previous candidates</button>
        <span>{candidatePage + 1} / {Math.ceil(pkg.candidates.length / 20)}</span><button className="button button-small" disabled={(candidatePage + 1) * 20 >= pkg.candidates.length} onClick={() => setCandidatePage(value => value + 1)}>Next candidates</button></div>}
  </fieldset>;
}

export function PackageExplorer({ pkg, onView, inspected }: {
  pkg: ApplicationPackage; onView(file: FileArtifact): void; inspected: boolean;
}) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const matches = pkg.files.filter(file => file.path.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE)), visiblePage = Math.min(page, pageCount - 1);
  return <section className="package-explorer" aria-labelledby="package-explorer-title">
    <div className="section-heading"><h2 id="package-explorer-title">Package explorer</h2><span className="badge">{pkg.files.length} files · {formatSize(pkg.totalBytes)}</span></div>
    <p>Relative paths stay intact. Choosing a program keeps every companion file in the package.</p>
    <label className="explorer-search">Filter paths<input type="search" value={query} maxLength={1024}
      onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Find a file in this package" /></label>
    <ul className="package-file-list" aria-label="Package files">
      {matches.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE).map(file => {
        const candidate = pkg.candidates.find(item => item.path === file.path), resource = pkg.resources.find(item => item.path === file.path);
        return <li key={file.path}><div className="package-file-info"><button className="path-button" onClick={() => onView(file)} aria-label={`Inspect ${file.path}`}>{file.path}</button>
          <span>{candidate ? 'Executable candidate' : resource ? `${resource.kind} · ${resource.reason}` : inspected ? 'Other retained file' : 'Awaiting header analysis'}</span></div>
          <span className="package-file-size">{formatSize(file.size)}</span></li>;
      })}
    </ul>
    {!matches.length && <p role="status">No paths match this filter.</p>}
    <div className="explorer-pagination"><button className="button button-small" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous files</button>
      <span aria-live="polite">{matches.length} matches · page {visiblePage + 1} / {pageCount}</span>
      <button className="button button-small" disabled={visiblePage + 1 === pageCount} onClick={() => setPage(visiblePage + 1)}>Next files</button></div>
    {!!pkg.directories.length && <details className="package-directories"><summary>{pkg.directories.length} preserved directories</summary>
      <div className="directory-scroll">{pkg.directories.map(path => <div className="break-name" key={path}>{path}/</div>)}</div></details>}
    {!!pkg.warnings.length && <ul className="package-warnings">{pkg.warnings.map(message => <li key={message}>{message}</li>)}</ul>}
  </section>;
}
