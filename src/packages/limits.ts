export const PACKAGE_LIMITS = Object.freeze({
  fileBytes: 64 * 1024 * 1024, totalBytes: 128 * 1024 * 1024, entries: 2048,
  pathBytes: 1024, depth: 32, pathMetadataBytes: 1024 * 1024,
  zipDirectoryBytes: 2 * 1024 * 1024, zipExtraBytes: 4096,
  expansionRatio: 100, compressedChunkBytes: 4096,
  probeBytes: 8 * 1024 * 1024, timeoutMs: 30_000,
});
