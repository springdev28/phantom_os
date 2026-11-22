import { describe, expect, it, vi } from 'vitest';
import { RuntimeRegistry, runtimeRegistry } from './registry';
import type { RuntimeAdapter, RuntimeDescriptor } from '../domain/contracts';

const descriptor: RuntimeDescriptor = {
  ...runtimeRegistry.list()[0]!, available: true, maturity: 'experimental', buildId: 'test-only-build',
  version: 'test-only-1', assets: [{ id: 'unit-test-asset', sha256: 'a'.repeat(64), installed: true }],
};
function fakeAdapter(): RuntimeAdapter {
  return {
    descriptor,
    probe: () => ({ candidate: false, requirements: [], reasons: [] }),
    prepare: vi.fn(), launch: vi.fn(),
  };
}
describe('runtime boundary (unit contracts only)', () => {
  it('rejects duplicate IDs, inconsistent pins and available descriptors without a loader or complete assets', () => {
    const entry = { descriptor, load: async () => fakeAdapter() };
    expect(() => new RuntimeRegistry([entry, entry])).toThrow('did not match');
    expect(() => new RuntimeRegistry([{ descriptor }])).toThrow('did not match');
    expect(() => new RuntimeRegistry([{ ...entry, descriptor: { ...descriptor, assets: [] } }])).toThrow('did not match');
    expect(() => new RuntimeRegistry([{ ...entry, descriptor: { ...descriptor, assets: [{ ...descriptor.assets[0]!, installed: false }] } }])).toThrow('did not match');
    const unversioned = { ...descriptor, version: '' };
    expect(() => new RuntimeRegistry([{ ...entry, descriptor: unversioned }])).toThrow('did not match');
  });
  it('copies and freezes descriptor state so a caller cannot change installation claims', () => {
    const source = { ...descriptor, assets: descriptor.assets.map(asset => ({ ...asset })) };
    const registry = new RuntimeRegistry([{ descriptor: source, load: async () => fakeAdapter() }]);
    source.available = false; source.assets[0]!.sha256 = 'changed';
    expect(registry.get('js-dos')).toMatchObject({ available: true, assets: [{ sha256: 'a'.repeat(64) }] });
    expect(Object.isFrozen(registry.get('js-dos'))).toBe(true);
    expect(Object.isFrozen(registry.get('js-dos')!.rules)).toBe(true);
  });
  it('compares every descriptor capability and asset while ignoring object key order', async () => {
    const changed = { ...fakeAdapter(), descriptor: { ...descriptor, capabilities: { ...descriptor.capabilities, audio: !descriptor.capabilities.audio } } };
    await expect(new RuntimeRegistry([{ descriptor, load: async () => changed }]).load('js-dos')).rejects.toThrow('did not match');
    const reordered = Object.fromEntries(Object.entries(descriptor).reverse()) as unknown as RuntimeDescriptor;
    await expect(new RuntimeRegistry([{ descriptor, load: async () => ({ ...fakeAdapter(), descriptor: reordered }) }]).load('js-dos')).resolves.toBeDefined();
  });
  it('loads only the installed production DOS adapter and keeps Windows absent', async () => {
    expect(runtimeRegistry.get('js-dos')).toMatchObject({ available: true, maturity: 'experimental', version: '8.5.3' });
    await expect(runtimeRegistry.load('js-dos')).resolves.toMatchObject({ descriptor: runtimeRegistry.get('js-dos') });
    await expect(runtimeRegistry.load('boxedwine')).rejects.toThrow('not installed');
  });
  it('does not import at registration/listing time and caches an on-demand load', async () => {
    const load = vi.fn(async () => fakeAdapter());
    const registry = new RuntimeRegistry([{ descriptor, load }]);
    registry.list();
    expect(load).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([registry.load('js-dos'), registry.load('js-dos')]);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('refuses a mismatched build and allows a clean retry', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ ...fakeAdapter(), descriptor: { ...descriptor, buildId: 'wrong-build' } })
      .mockResolvedValueOnce(fakeAdapter());
    const registry = new RuntimeRegistry([{ descriptor, load }]);
    await expect(registry.load('js-dos')).rejects.toThrow('did not match');
    await expect(registry.load('js-dos')).resolves.toMatchObject({ descriptor });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
