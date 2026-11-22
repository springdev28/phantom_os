import type { RuntimeAdapter, RuntimeDescriptor, RuntimeId } from '../domain/contracts';
import { AppError } from '../domain/errors';
import { descriptorSignature, isRuntimeInstalled } from '../domain/runtime-descriptor';
import { dosDescriptor } from './dos/descriptor';
import { boxedwineDescriptor } from './boxedwine/descriptor';

export interface RuntimeRegistration {
  readonly descriptor: RuntimeDescriptor;
  /** Future adapters provide () => import('../adapters/...').then(...). */
  readonly load?: () => Promise<RuntimeAdapter>;
}
export class RuntimeRegistry {
  readonly #entries: ReadonlyMap<RuntimeId, RuntimeRegistration>;
  readonly #loads = new Map<RuntimeId, Promise<RuntimeAdapter>>();
  constructor(entries: readonly RuntimeRegistration[]) {
    const registered = new Map<RuntimeId, RuntimeRegistration>();
    for (const entry of entries) {
      if (registered.has(entry.descriptor.id)
        || new Set(entry.descriptor.assets.map(asset => asset.id)).size !== entry.descriptor.assets.length
        || Boolean(entry.descriptor.version) !== Boolean(entry.descriptor.buildId)
        || (entry.descriptor.available && (!entry.load || !isRuntimeInstalled(entry.descriptor)))) throw new AppError('RUNTIME_MISMATCH');
      // Registry metadata cannot be mutated by a caller after validation.
      registered.set(entry.descriptor.id, Object.freeze({ ...entry, descriptor: freezeDescriptor(entry.descriptor) }));
    }
    this.#entries = registered;
  }
  list(): readonly RuntimeDescriptor[] {
    return [...this.#entries.values()].map(entry => entry.descriptor);
  }
  get(id: RuntimeId): RuntimeDescriptor | undefined { return this.#entries.get(id)?.descriptor; }
  async load(id: RuntimeId): Promise<RuntimeAdapter> {
    const entry = this.#entries.get(id);
    if (!entry || !isRuntimeInstalled(entry.descriptor) || !entry.load) {
      throw new AppError('RUNTIME_UNAVAILABLE');
    }
    const cached = this.#loads.get(id);
    if (cached) return cached;
    const promise = Promise.resolve().then(entry.load).then(adapter => {
      if (!adapter?.descriptor || descriptorSignature(adapter.descriptor) !== descriptorSignature(entry.descriptor)) throw new AppError('RUNTIME_MISMATCH');
      return adapter;
    }).catch((error: unknown) => {
      this.#loads.delete(id);
      throw error instanceof AppError ? error : new AppError('RUNTIME_ASSETS');
    });
    this.#loads.set(id, promise);
    return promise;
  }
}

function freezeDescriptor(descriptor: RuntimeDescriptor): RuntimeDescriptor {
  return Object.freeze({ ...descriptor,
    ...(descriptor.blockers ? { blockers: Object.freeze(descriptor.blockers.map(blocker => Object.freeze({ ...blocker }))) } : {}),
    formats: Object.freeze([...descriptor.formats]), requirements: Object.freeze([...descriptor.requirements]),
    rules: Object.freeze(descriptor.rules.map(rule => Object.freeze({ ...rule, requirements: Object.freeze([...rule.requirements]) }))),
    diskEnvironments: Object.freeze(descriptor.diskEnvironments.map(environment => Object.freeze({ ...environment,
      formats: Object.freeze([...environment.formats]), requirements: Object.freeze([...environment.requirements]) }))),
    assets: Object.freeze(descriptor.assets.map(asset => Object.freeze({ ...asset }))), capabilities: Object.freeze({ ...descriptor.capabilities }),
  });
}
export const runtimeRegistry = new RuntimeRegistry([
  { descriptor: dosDescriptor, load: () => import('./dos/adapter').then(module => module.dosAdapter) },
  { descriptor: boxedwineDescriptor, load: () => import('./boxedwine/adapter').then(module => module.boxedwineAdapter) },
]);
