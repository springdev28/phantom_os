import type { ProbeResult } from '../../domain/contracts';
import { confidenceLabels, validityLabels } from '../probe-labels';
import { formatSize } from '../screen-props';
import { Icon } from './Icon';

const offsetLabel = (offset: number) => `0x${offset.toString(16).toUpperCase().padStart(4, '0')}`;

export function ProbeReport({ result }: { readonly result: ProbeResult }) {
  const invalid = result.validity === 'invalid';
  return <section className="probe-report" aria-labelledby="probe-report-title" data-testid="probe-report">
    <div className="section-heading"><h2 id="probe-report-title">Inspection report</h2><span className="badge">Static analysis only</span></div>
    <div className={`notice${invalid ? ' notice-error' : ''}`} role={invalid ? 'alert' : undefined}>
      <Icon name="info" /><div><strong>{invalid ? 'This header is incomplete or inconsistent'
        : result.validity === 'unknown' ? 'The format remains uncertain' : 'Format evidence, not execution proof'}</strong>
        <p>{invalid ? 'The detected structure failed a header check. Review the diagnostics below or choose another file.'
          : 'Header analysis does not execute the file. Review Compatibility separately; this report cannot tell you whether the application will start.'}</p></div>
    </div>
    <dl className="probe-facts">
      <div><dt>Format confidence</dt><dd>{confidenceLabels[result.confidence]}</dd></div>
      <div><dt>Header consistency</dt><dd>{validityLabels[result.validity]}</dd></div>
      <div><dt>Architecture</dt><dd>{result.architecture ?? 'Not established'}</dd></div>
      <div><dt>Header class / byte order</dt><dd>{result.bitness ? `${result.bitness}-bit` : 'Not established'}{result.endianness ? ` · ${result.endianness}-endian` : ''}</dd></div>
      <div><dt>PE subsystem</dt><dd>{result.subsystem ?? 'Not applicable / not read'}</dd></div>
      <div><dt>Declared target / ABI</dt><dd>{result.platform ?? 'Not established'}</dd></div>
      <div><dt>Image or container kind</dt><dd>{result.kind ?? 'Not established'}</dd></div>
      <div><dt>Executable compatibility</dt><dd>Not assessed</dd></div>
    </dl>
    <details className="evidence-panel" open>
      <summary>Signature evidence <span>{result.evidence.length} observations</span></summary>
      <p className="evidence-intro">Offsets and hex bytes come from your selected file. They stay in this tab.</p>
      <ol className="evidence-list">{result.evidence.map((item, index) => <li key={`${item.offset}-${index}`}>
        <div className="evidence-location"><span>Offset {offsetLabel(item.offset)}</span><small>{item.length} bytes</small></div>
        <code>{item.hex}</code><div><h3>{item.label}</h3><p>{item.interpretation}</p></div>
      </li>)}</ol>
      {result.evidence.length === 0 && <p className="evidence-intro">No complete signature could be read.</p>}
      <p className="probe-read-budget">Read {formatSize(result.readStats.bytesRead)} of {formatSize(result.fileSize)} in {result.readStats.operations} local range requests.
        {' '}Limit: 1 MiB per analysis, 64 KiB per read. No full-file validation is claimed.</p>
    </details>
    {result.warnings.length > 0 && <section className="probe-diagnostics" aria-labelledby="diagnostics-title">
      <h3 id="diagnostics-title">Diagnostics</h3><ul>{result.warnings.map((warning, index) => <li key={`${warning.code}-${index}`} data-severity={warning.severity}>
        <span className="diagnostic-code">{warning.code}{warning.offset === undefined ? '' : ` · ${offsetLabel(warning.offset)}`}</span><p>{warning.message}</p>
      </li>)}</ul></section>}
    {result.ambiguity.length > 0 && <section className="probe-unknowns"><h3>Ambiguity</h3><ul>{result.ambiguity.map(item => <li key={item}>{item}</li>)}</ul></section>}
    <section className="probe-unknowns"><h3>What this cannot establish</h3><ul>{result.notInferred.map(item => <li key={item}>{item}</li>)}</ul></section>
  </section>;
}
