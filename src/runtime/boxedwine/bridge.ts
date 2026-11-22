/** Small, version-specific Emscripten FS surface used by the 25R1 upstream preRun.
 * Independent of React and the upstream website's URL/IndexedDB wrapper.
 * Exercised with the real JS/WASM in tests/boxedwine-engine-probe.ts.
 */
export interface BoxedwineMemoryFS {
  mkdirTree(path: string): void;
  writeFile(path: string, bytes: Uint8Array): void;
  readFile(path: string): Uint8Array;
}
export function createBoxedwineMemoryMount(fs: BoxedwineMemoryFS): {
  write(relativePath: string, bytes: Uint8Array): void;
  directory(relativePath: string): void;
} {
  let bytesWritten = 0, entries = 0;
  const paths = new Set<string>();
  const path = (value: string) => {
    // This inner boundary receives normalized paths, but still rejects escape syntax.
    if (!value || value.length > 1024 || /[\\:]/u.test(value) || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('BOXEDWINE_PATH');
    return `/d_drive/${value}`;
  };
  const reserve = (value: string) => {
    if (++entries > 2048 || paths.has(value.toLowerCase())) throw new Error('BOXEDWINE_LIMIT');
    paths.add(value.toLowerCase());
  };
  fs.mkdirTree('/root'); fs.mkdirTree('/d_drive');
  return {
    directory(relativePath) { const destination = path(relativePath); reserve(destination); fs.mkdirTree(destination); },
    write(relativePath, bytes) {
      const destination = path(relativePath);
      if (bytesWritten + bytes.byteLength > 32 * 1024 * 1024) throw new Error('BOXEDWINE_LIMIT');
      reserve(destination); bytesWritten += bytes.byteLength;
      fs.mkdirTree(destination.slice(0, destination.lastIndexOf('/')));
      fs.writeFile(destination, bytes);
    },
  };
}
