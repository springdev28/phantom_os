import type { FileArtifact, Inspection, PackageInspector, ProbeResult } from '../domain/contracts';
import { probeMz, probeElf } from './executables';
import { probeDisk, probeZip } from './containers';
import { BoundedReader, ProbeFault, Report, requireData } from './probe-core';
import { PACKAGE_LIMITS } from '../packages/limits';

/** Only the selected local handle is read. No network, storage, evaluation or runtime API. */
export async function probeFile(file: FileArtifact, signal: AbortSignal): Promise<ProbeResult> {
  const report = new Report(new BoundedReader(file, signal));
  try {
    signal.throwIfAborted();
    requireData(Number.isSafeInteger(file.size) && file.size > 0, 'EMPTY_INPUT', 'There are no readable bytes to inspect.');
    const head = await report.reader.range(0, Math.min(512, file.size));
    if (head.has(0, [0x4d, 0x5a])) await probeMz(report, head);
    else if (head.has(0, [0x7f, 0x45, 0x4c, 0x46])) probeElf(report, head);
    else if ([[3, 4], [5, 6], [7, 8], [1, 2], [6, 6], [6, 7]].some(pair => head.has(0, [0x50, 0x4b, ...pair]))) await probeZip(report, head);
    else if (!await probeDisk(report, head)) {
      report.record('Leading bytes', head, 0, Math.min(16, head.bytes.length), 'No recognized executable or container header in the probed ranges.');
      if (/\.com$/i.test(file.path)) {
        if (file.size <= 0xff00) report.format = 'dos-com-ambiguous';
        report.ambiguity.push('Raw COM has no universal magic. A .com name and a small file cannot distinguish DOS code from arbitrary data.');
        report.warn('COM_AMBIGUOUS', file.size <= 0xff00
          ? 'The filename provides a possible DOS COM context only. No instruction or execution validity is claimed.'
          : 'The file exceeds the usual 65,280-byte raw COM image capacity. Its .com name does not establish a DOS format.');
      } else if (/\.(img|ima|iso)$/i.test(file.path)) {
        report.format = 'disk-image-ambiguous';
        report.ambiguity.push('The image suffix is a hint only. No handled disk signature was found.');
      }
      report.warn('UNKNOWN_FORMAT', 'No conclusive format was recognized. The file may be data, incomplete, or a format outside this probe. It will not be run.');
      if (/\.exe$/i.test(file.path)) report.warn('EXTENSION_ONLY', 'An .exe suffix is never proof of DOS, Windows or any other platform.');
    }
  } catch (error) {
    signal.throwIfAborted();
    if (!(error instanceof ProbeFault)) throw error;
    report.validity = error.validity;
    report.confidence = error.validity === 'invalid' || report.format === 'unknown' ? 'ambiguous' : 'probable';
    report.warn(error.code, error.message, error.offset, error.validity === 'invalid' ? 'error' : 'warning');
  }
  signal.throwIfAborted();
  return report.finish();
}

export const selectionInspector: PackageInspector = {
  async inspect(pkg, signal): Promise<Inspection> {
    const results = new Map<string, ProbeResult>();
    let bytesRead = 0;
    for (const file of pkg.files) {
      signal.throwIfAborted();
      const bounded: FileArtifact = { ...file, async read(offset, length, readSignal) {
        if (length > PACKAGE_LIMITS.probeBytes - bytesRead) throw new ProbeFault('PACKAGE_PROBE_LIMIT',
          'The package reached its 8 MiB aggregate header-read budget. This file was not fully examined.', 'partial');
        bytesRead += length;
        return file.read(offset, length, readSignal);
      } };
      results.set(file.path, await probeFile(bounded, signal));
    }
    return results;
  },
};
