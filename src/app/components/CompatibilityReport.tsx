import { useRef, useState } from 'react';
import type { SessionState } from '../../domain/session-machine';
import { compatibilityReport } from '../compatibility-report';
import { downloadLocal } from '../download';
export function CompatibilityReport({ state }: { state: SessionState }) {
  const text = compatibilityReport(state), field = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(''), [show, setShow] = useState(false);
  async function copy() {
    if (!text) return;
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); setMessage('Compatibility report copied. It contains metadata, not file contents.'); }
    catch { setShow(true); setMessage('Clipboard access is unavailable. Select the report below and press Ctrl+C or Command+C, or download it.'); requestAnimationFrame(() => { field.current?.focus(); field.current?.select(); }); }
  }
  return <section className="report-panel" aria-label="Export compatibility report">
    <div className="button-row"><button className="button button-secondary" disabled={!text} onClick={() => { void copy(); }}>Copy compatibility report</button>
      <button className="text-link" disabled={!text} onClick={() => { if (text) downloadLocal({ path: 'phantom-compatibility.txt', blob: new Blob([text], { type: 'text/plain' }) }); }}>Download report</button></div>
    {message && <p role="status">{message}</p>}
    {show && <label>Compatibility report text<textarea ref={field} readOnly rows={10} value={text ?? ''} spellCheck={false} /></label>}
  </section>;
}
