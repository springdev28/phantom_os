import type { ApplicationPackage, FileArtifact, RuntimeDescriptor, WorkspaceManifest } from '../domain/contracts';
import { AppError } from '../domain/errors';
import { PathIndex } from '../packages/paths';

/** Verifies schema/build integrity, never executable compatibility or launch success. */
export function verifyWorkspaceRuntime(manifest: WorkspaceManifest, descriptors: readonly RuntimeDescriptor[]): void {
  const profile = manifest.profile;
  if (!profile.runtimeId) { if (manifest.runtimeAssets.length) throw new AppError('STORAGE_RUNTIME'); return; }
  const runtime = descriptors.find(item => item.id === profile.runtimeId);
  if (!runtime || runtime.version !== profile.runtimeVersion || runtime.buildId !== profile.runtimeBuildId
    || runtime.assets.length !== manifest.runtimeAssets.length
    || runtime.assets.some(asset => !manifest.runtimeAssets.some(pin => pin.id === asset.id && pin.sha256 === asset.sha256))) throw new AppError('STORAGE_RUNTIME');
}
/** Captured documents overlay temporary launch copies, never mutate the selected package. */
export function withWorkingFiles(pkg: ApplicationPackage, documents: readonly FileArtifact[], entrypoint: string | null): ApplicationPackage {
  if (!documents.length) return pkg;
  const byPath = new Map(pkg.files.map(file => [file.path.toLowerCase(), file]));
  for (const file of documents) {
    if (file.path.toLowerCase() === entrypoint?.toLowerCase()) throw new AppError('TRANSFER_SETTINGS');
    const previous = byPath.get(file.path.toLowerCase());
    byPath.set(file.path.toLowerCase(), previous ? { ...file, path: previous.path } : file);
  }
  const index = new PathIndex(); for (const directory of pkg.directories) index.add(directory, true);
  const files = [...byPath.values()]; for (const file of files) index.add(file.path);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 32 * 1024 * 1024) throw new AppError('STORAGE_LIMIT');
  return { ...pkg, files, directories: index.directories(), totalBytes };
}
