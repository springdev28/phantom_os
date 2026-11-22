import type { ApplicationPackage, LaunchProfile, RuntimeDescriptor, VerificationIdentity } from '../domain/contracts';
import { serializeLaunchProfile } from '../profiles/launch-profile';
import { descriptorSignature } from '../domain/runtime-descriptor';

export interface BrowserScope { readonly name: string; readonly version: string; readonly platform: string; }
export interface ObservedLaunchEvidence {
  readonly id: string;
  readonly identitySha256: string;
  readonly evidencePath: string;
  readonly observed: {
    readonly programOutput: 'passed'; readonly meaningfulInput: 'passed';
    readonly stopAndRelaunch: 'passed'; readonly fileIO: 'passed' | 'not-applicable';
    readonly localOnlyNetwork: 'passed';
  };
}
interface IdentityData {
  readonly pkg: ApplicationPackage;
  readonly profile: string;
  readonly runtime: string;
  readonly sha256: string;
}
const identities = new WeakMap<VerificationIdentity, IdentityData>();
async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Full content identity, read only when verification is requested by a future launch coordinator.
 * SHA-256 of a canonical manifest of 64 KiB chunk SHA-256s, paths, directories,
 * the entire profile, runtime descriptor/asset hashes, and exact browser scope.
 * No input from profile JSON can mint this process-local capability.
 */
export async function captureLaunchIdentity(pkg: ApplicationPackage, profile: LaunchProfile,
  runtime: RuntimeDescriptor, browser: BrowserScope, signal: AbortSignal): Promise<VerificationIdentity> {
  const profileText = serializeLaunchProfile(profile), runtimeText = descriptorSignature(runtime);
  if (pkg.files.length > 2048 || pkg.totalBytes > 128 * 1024 * 1024) throw new Error('Verification package exceeds its budget.');
  const files: { path: string; size: number; chunks: string[] }[] = [];
  let total = 0;
  for (const file of [...pkg.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > 64 * 1024 * 1024) throw new Error('Invalid verification file size.');
    total += file.size;
    if (total > 128 * 1024 * 1024) throw new Error('Verification package exceeds its budget.');
    const chunks: string[] = [];
    for (let offset = 0; offset < file.size; offset += 65536) {
      signal.throwIfAborted();
      const length = Math.min(65536, file.size - offset), bytes = await file.read(offset, length, signal);
      if (bytes.length !== length) throw new Error('Verification read was incomplete.');
      chunks.push(await digest(bytes));
    }
    files.push({ path: file.path, size: file.size, chunks });
  }
  signal.throwIfAborted();
  const sha256 = await digest(new TextEncoder().encode(JSON.stringify({ algorithm: 'phantom-package-chunks-sha256-v1',
    files, directories: [...pkg.directories].sort(), profile: profileText, runtime: runtimeText, browser })));
  const identity = Object.freeze({}) as VerificationIdentity;
  identities.set(identity, { pkg, profile: profileText, runtime: runtimeText, sha256 });
  return identity;
}
/** Only for recording a completed, observed test; this hash is not itself evidence. */
export function launchIdentityDigest(identity: VerificationIdentity): string | undefined { return identities.get(identity)?.sha256; }

export function matchObservedLaunch(identity: VerificationIdentity | undefined, pkg: ApplicationPackage,
  profile: LaunchProfile | undefined, runtime: RuntimeDescriptor, catalogue: readonly ObservedLaunchEvidence[]): string | undefined {
  if (!identity || !profile) return undefined;
  const data = identities.get(identity);
  if (!data || data.pkg !== pkg || data.profile !== serializeLaunchProfile(profile) || data.runtime !== descriptorSignature(runtime)) return undefined;
  return catalogue.find(record => record.identitySha256 === data.sha256 && /^[a-f0-9]{64}$/.test(record.identitySha256)
    && /^docs\/evidence\/[a-zA-Z0-9/_-]+\.md$/.test(record.evidencePath)
    && record.observed.programOutput === 'passed' && record.observed.meaningfulInput === 'passed'
    && record.observed.stopAndRelaunch === 'passed' && record.observed.localOnlyNetwork === 'passed'
    && ['passed', 'not-applicable'].includes(record.observed.fileIO))?.id;
}

/** Empty deliberately: fixture runs are documented, not automatically matched to user selections. Never populate from imported JSON. */
export const observedLaunchCatalogue: readonly ObservedLaunchEvidence[] = Object.freeze([]);
