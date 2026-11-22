import { AppError } from '../domain/errors';
import { PACKAGE_LIMITS as limits } from './limits';

const byteLength = (text: string) => new TextEncoder().encode(text).length;
const fold = (path: string) => path.normalize('NFKC').toUpperCase().toLowerCase();

/** Reject, never sanitize away traversal. Percent sequences stay literal; never URL-decode paths. */
export function safePath(value: string): string {
  const path = value.normalize('NFC');
  const parts = path.split('/');
  const controls = [...path].some(character => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
  if (!path || byteLength(path) > limits.pathBytes || parts.length > limits.depth
    || controls || /[\\:*?"<>|\u202a-\u202e\u2066-\u2069]/u.test(path)
    || parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
      || byteLength(part) > 255 || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part))) {
    throw new AppError('INVALID_PATH');
  }
  const compatible = path.normalize('NFKC');
  if (compatible !== path && (compatible.split('/').length !== parts.length
    || /[\\:]/.test(compatible) || compatible.split('/').some(part => part === '.' || part === '..'))) {
    throw new AppError('INVALID_PATH');
  }
  return path;
}

/** Includes implicit parents, so A/file and a/other cannot alias in a future adapter. */
export class PathIndex {
  readonly #paths = new Map<string, { path: string; directory: boolean; explicit: boolean }>();
  #metadataBytes = 0;
  #entries = 0;
  add(raw: string, directory = false): string {
    const path = safePath(raw);
    this.#entries++;
    this.#metadataBytes += byteLength(path);
    if (this.#entries > limits.entries || this.#metadataBytes > limits.pathMetadataBytes) throw new AppError('PACKAGE_LIMIT');
    const parts = path.split('/');
    for (let n = 1; n <= parts.length; n++) {
      const subpath = parts.slice(0, n).join('/'), key = fold(subpath);
      const isParent = n < parts.length, isDirectory = isParent || directory;
      const previous = this.#paths.get(key);
      if (previous) {
        if (previous.path !== subpath || !previous.directory || !isDirectory
          || (!isParent && previous.explicit)) throw new AppError('PATH_COLLISION');
        if (!isParent) previous.explicit = true;
      } else this.#paths.set(key, { path: subpath, directory: isDirectory, explicit: !isParent });
      if (this.#paths.size > limits.entries) throw new AppError('PACKAGE_LIMIT');
    }
    return path;
  }
  directories(): readonly string[] {
    return [...this.#paths.values()].filter(entry => entry.directory).map(entry => entry.path).sort();
  }
}
