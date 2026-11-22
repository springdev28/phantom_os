import type { ExportArtifact } from '../domain/contracts';
/** Explicit user export. Distinct from browser-local workspace storage. */
export function downloadLocal(artifact: ExportArtifact): void {
  const url = URL.createObjectURL(artifact.blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = artifact.path.split('/').at(-1) ?? 'exported-file'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
