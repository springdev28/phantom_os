import type { Format, ProbeResult } from '../domain/contracts';

export const formatLabels: Readonly<Record<Format, string>> = {
  'dos-mz': 'DOS MZ image / stub', 'dos-com-ambiguous': 'Possible raw COM (ambiguous)',
  ne: 'NE segmented image', pe32: 'PE32', 'pe32+': 'PE32+', elf: 'ELF', zip: 'ZIP container',
  iso9660: 'ISO 9660 image', 'mbr-disk': 'Possible MBR disk image', 'gpt-disk': 'Possible GPT disk image',
  'disk-image-ambiguous': 'Possible disk image (ambiguous)', unknown: 'Unknown format',
};
export const confidenceLabels: Readonly<Record<ProbeResult['confidence'], string>> = {
  'certain-format': 'Strong format evidence', probable: 'Probable format', ambiguous: 'Ambiguous',
};
export const validityLabels: Readonly<Record<ProbeResult['validity'], string>> = {
  'valid-header': 'Checked fields agree', partial: 'Partial inspection', invalid: 'Invalid / incomplete header', unknown: 'Not established',
};
