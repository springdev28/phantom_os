import type { GuestFile } from '../../domain/contracts';
import { AppError } from '../../domain/errors';
import { PathIndex, safePath } from '../../packages/paths';

type HostMessage = { type: 'connected' | 'running' | 'stopped' | 'error' }
  | { type: 'input'; focused: boolean }
  | { type: 'metrics'; frames: number; audioSamples: number; audioPeak: number; keyEvents: number; mouseEvents: number }
  | { type: 'reply'; id: number; error?: true; value?: unknown };
const invalid = (): never => { throw new AppError('RUNTIME_FAILED'); };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : invalid();
const exact = (value: object, keys: string[]) => {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
};
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

/** The opaque guest is not a trusted application peer, even when its engine is pinned. */
export function parseHostMessage(value: unknown): HostMessage {
  const data = record(value);
  if (typeof data.type === 'string' && ['connected', 'running', 'stopped', 'error'].includes(data.type)) {
    exact(data, ['type']); return { type: data.type as 'connected' | 'running' | 'stopped' | 'error' };
  }
  if (data.type === 'input') {
    exact(data, ['type', 'focused']); if (typeof data.focused !== 'boolean') return invalid();
    return { type: 'input', focused: data.focused };
  }
  if (data.type === 'metrics') {
    exact(data, ['type', 'frames', 'audioSamples', 'audioPeak', 'keyEvents', 'mouseEvents']);
    if (!count(data.frames) || !count(data.audioSamples) || !count(data.keyEvents) || !count(data.mouseEvents)
      || typeof data.audioPeak !== 'number' || !Number.isFinite(data.audioPeak) || data.audioPeak < 0) return invalid();
    return { type: 'metrics', frames: data.frames, audioSamples: data.audioSamples, audioPeak: data.audioPeak, keyEvents: data.keyEvents, mouseEvents: data.mouseEvents };
  }
  if (data.type === 'reply') {
    exact(data, data.error === true ? ['type', 'id', 'error'] : ['type', 'id', 'value']);
    if (!count(data.id) || data.id === 0) return invalid();
    return data.error === true ? { type: 'reply', id: data.id, error: true } : { type: 'reply', id: data.id, value: data.value };
  }
  return invalid();
}

export function guestFileList(value: unknown): GuestFile[] {
  if (!Array.isArray(value) || value.length > 2048) return invalid();
  const paths = new PathIndex(); let total = 0;
  return value.map(item => {
    const f = record(item); exact(f, ['path', 'size']);
    if (typeof f.path !== 'string' || safePath(f.path) !== f.path || !count(f.size)
      || f.size > 32 * 1024 * 1024 || (total += f.size) > 64 * 1024 * 1024) return invalid();
    paths.add(f.path); return { path: f.path, size: f.size };
  });
}
