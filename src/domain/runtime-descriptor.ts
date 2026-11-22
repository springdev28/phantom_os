import type { RuntimeDescriptor } from './contracts';

export function isRuntimeInstalled(runtime: RuntimeDescriptor): boolean {
  return runtime.available && !runtime.blockers?.length && Boolean(runtime.version && runtime.buildId)
    && (runtime.maturity === 'experimental' || runtime.maturity === 'verified')
    && runtime.assets.length > 0 && runtime.assets.every(asset => asset.installed && /^[a-f0-9]{64}$/.test(asset.sha256));
}

/** Stable key ordering for descriptors and their nested, JSON-only metadata. */
export function descriptorSignature(runtime: RuntimeDescriptor): string {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  return JSON.stringify(ordered(runtime));
}
