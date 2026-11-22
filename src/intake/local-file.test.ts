import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, selectLocalFile } from './local-file';
import { selectionInspector } from '../inspection/selection-inspector';

describe('local selection', () => {
  it('keeps the original bytes locally and does not infer format from an extension', async () => {
    const file = new File(['plain text, not an executable'], 'misleading.exe', { lastModified: 0 });
    const pkg = selectLocalFile([file]);
    expect(pkg.files[0]?.path).toBe('misleading.exe');
    expect(pkg.candidates).toEqual([]);
    const result = await selectionInspector.inspect(pkg, new AbortController().signal);
    expect(result.get('misleading.exe')).toMatchObject({ format: 'unknown', localAccess: 'readable', validity: 'unknown', confidence: 'ambiguous' });
    expect(result.get('misleading.exe')?.warnings.some(warning => warning.code === 'EXTENSION_ONLY')).toBe(true);
  });
  it('rejects empty, multiple and oversized selections before reading', () => {
    expect(() => selectLocalFile([])).toThrow('one file');
    expect(() => selectLocalFile([new File([], 'empty')])).toThrow('empty');
    expect(() => selectLocalFile([new File(['a'], 'a'), new File(['b'], 'b')])).toThrow('one file');
    const oversized = new File(['a'], 'big');
    Object.defineProperty(oversized, 'size', { value: MAX_FILE_BYTES + 1 });
    expect(() => selectLocalFile([oversized])).toThrow('64 MiB');
  });
  it.each(['../secret', 'C:\\secret', '..', 'a\u0000b'])('rejects a non-local basename: %s', name => {
    expect(() => selectLocalFile([new File(['a'], name)])).toThrow('name');
  });
  it('bounds all reads and honors cancellation', async () => {
    const file = selectLocalFile([new File(['hello'], 'test')]).files[0]!;
    const signal = new AbortController().signal;
    await expect(file.read(0, 5, signal)).resolves.toEqual(new TextEncoder().encode('hello'));
    await expect(file.read(4, 2, signal)).rejects.toThrow('range');
    await expect(file.read(-1, 1, signal)).rejects.toThrow('range');
    await expect(file.read(0.5, 1, signal)).rejects.toThrow('range');
    const controller = new AbortController();
    controller.abort();
    await expect(file.read(0, 1, controller.signal)).rejects.toThrow();
  });
  it('does not publish inspection evidence after an aborted read', async () => {
    const controller = new AbortController();
    const pkg = selectLocalFile([new File(['a'], 'sample')]);
    const file = pkg.files[0]!;
    const delayed = { ...file, read: async () => { controller.abort(); return new Uint8Array([1]); } };
    await expect(selectionInspector.inspect({ ...pkg, files: [delayed] }, controller.signal)).rejects.toThrow();
  });
});
