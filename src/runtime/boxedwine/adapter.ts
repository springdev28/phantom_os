import type { RuntimeAdapter } from '../../domain/contracts';
import { AppError } from '../../domain/errors';
import { boxedwineDescriptor } from './descriptor';
import { isBoxedwinePeCandidate } from './config';

/** Deliberately fail closed, including direct calls that bypass RuntimeRegistry.
 * No runtime assets or user bytes may be loaded until the adoption blockers are resolved.
 * The tested Emscripten staging boundary is in bridge.ts; it is not a Windows session.
 */
export const boxedwineAdapter: RuntimeAdapter = {
  descriptor: boxedwineDescriptor,
  probe(pkg, inspection) {
    const probe = pkg.entrypoint ? inspection.get(pkg.entrypoint) : undefined;
    return { candidate: Boolean(probe && isBoxedwinePeCandidate(probe)),
      requirements: boxedwineDescriptor.requirements,
      reasons: ['Static PE evidence is separate from execution.', ...boxedwineDescriptor.blockers!.map(blocker => blocker.message)] };
  },
  prepare() { return Promise.reject(new AppError('WINDOWS_UNVERIFIED')); },
  launch() { return Promise.reject(new AppError('WINDOWS_UNVERIFIED')); },
};
