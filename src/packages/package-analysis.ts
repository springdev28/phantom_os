import type { ApplicationPackage, CandidateEntrypoint, Inspection, PackageResource } from '../domain/contracts';

const executableFormats = new Set(['dos-mz', 'dos-com-ambiguous', 'ne', 'pe32', 'pe32+', 'elf']);
export function describePackage(pkg: ApplicationPackage, inspection: Inspection): ApplicationPackage {
  const candidates: CandidateEntrypoint[] = [], resources: PackageResource[] = [];
  for (const file of pkg.files) {
    const probe = inspection.get(file.path), name = file.path.split('/').at(-1)!.toLowerCase();
    const library = probe?.kind === 'DLL image' || /\.(dll|drv|sys|so|ovl)$/.test(name);
    if (probe && executableFormats.has(probe.format) && probe.validity !== 'invalid' && !library) {
      candidates.push({ path: file.path, format: probe.format,
        reason: probe.format === 'dos-com-ambiguous'
          ? 'Small .com file: possible raw DOS program, but no confirming signature.'
          : `${probe.format.toUpperCase()} header evidence${probe.architecture ? `; ${probe.architecture}` : ''}${probe.subsystem ? `; ${probe.subsystem}` : ''}.`,
        caution: /^(setup|install|unins|uninst)/.test(name)
          ? 'May be an installer or uninstaller by name. Do not assume it is the application.'
          : 'Candidate only. Required libraries, OS and successful startup are not established.',
      });
      continue;
    }
    let kind: PackageResource['kind'] = 'unclassified';
    let reason = 'Kept intact. Its role is not known from the available evidence.';
    if (library) { kind = 'library'; reason = 'Possible library, driver or overlay by header/name. Required versions and linkage are not resolved.'; }
    else if (probe?.format === 'zip' || /\.(zip|7z|rar|tar|gz|bz2|xz|jsdos)$/.test(name)) {
      kind = 'archive'; reason = 'Opaque archive retained as a file. Nested archives are never expanded automatically.';
    } else if (probe && ['iso9660', 'mbr-disk', 'gpt-disk', 'disk-image-ambiguous'].includes(probe.format)) {
      kind = 'disk-image'; reason = 'Disk image retained intact. Filesystem mounting and booting are unavailable.';
    } else if (/\.(bat|cmd|ps1|sh|js|vbs|com)$/i.test(name)) {
      kind = 'script'; reason = 'Script or ambiguous program by name; kept as inert bytes. Never evaluated during inspection.';
    } else if (/\.(ini|cfg|conf|json|xml|inf)$/.test(name)) {
      kind = 'configuration'; reason = 'Possible configuration by name. Preserved, never applied to the app or a runtime during import.';
    } else if (/\.(txt|md|pdf|doc|hlp)$/.test(name) || /^(readme|license)/.test(name)) {
      kind = 'documentation'; reason = 'Possible documentation by name; content is not rendered or interpreted.';
    } else if (/\.(dat|pak|wad|bin|res|bmp|png|wav|mid|fnt|ttf)$/.test(name)) {
      kind = 'data'; reason = 'Possible application data, media or font by name. Keep it at its original relative path.';
    }
    resources.push({ path: file.path, kind, reason });
  }
  const warnings = ['Resource roles are hints, not a resolved dependency list. Every file and directory is retained.'];
  if (resources.some(resource => resource.kind === 'archive')) warnings.push('Nested archives remain opaque; no recursive extraction or nested entrypoint selection is performed.');
  if (pkg.origin === 'folder') warnings.push('Folder selection exposes regular File objects only. Empty folders and host link metadata are not provided by the browser picker.');
  if ([...inspection.values()].some(probe => probe.warnings.some(warning => warning.code === 'PACKAGE_PROBE_LIMIT'))) warnings.push('The aggregate inspection budget was reached. Some headers remain unexamined. All files are still retained.');
  return Object.freeze({ ...pkg, candidates: Object.freeze(candidates), resources: Object.freeze(resources), warnings: Object.freeze(warnings) });
}
