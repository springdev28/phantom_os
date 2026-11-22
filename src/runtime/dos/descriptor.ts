import type { RuntimeDescriptor } from '../../domain/contracts';
import { DOS_HOST_ASSETS } from './host-manifest';

export const DOS_ASSETS = {
  'emulators.js': '52598b412977a892fa81c5613c653ed233e06732972c02897d8eac115b941075',
  'wdosbox.js': 'a0806cc99e0c66bc594e7efd78eb22d675af7ebb0a4de543697cbe5cd7440a2e',
  'wdosbox.wasm': 'b33afba80de1a420c123086e5952d135de041f9e85d4444170e29d9249ec049c',
} as const;
export const dosDescriptor: RuntimeDescriptor = {
  id: 'js-dos', name: 'js-dos / DOSBox', version: '8.5.3', buildId: `emulators-8.5.3-e6f4e544-dosbox-${Object.values(DOS_HOST_ASSETS)[0]!.slice(0, 12)}`,
  maturity: 'experimental', available: true, formats: ['dos-mz', 'dos-com-ambiguous'],
  assets: Object.entries({ ...DOS_ASSETS, ...DOS_HOST_ASSETS }).map(([id, sha256]) => ({ id, sha256, installed: true })),
  diskEnvironments: [], maxGuestMemoryMiB: 64,
  capabilities: { keyboard: true, mouse: true, audio: true, fileImport: 'live', fileExport: 'live', guestNetworking: 'disabled' },
  requirements: ['A DOS program with its original companion files. Windows, disk booting and networking are unavailable.',
    'DOS 8.3 paths, at most 32 MiB of package data, and one writable temporary C:/ mount. Originals are never changed.'],
  rules: [
    { id: 'dos-mz', format: 'dos-mz', maturity: 'experimental', justification: 'A DOS MZ image can be tried in the installed DOSBox worker. A stub or DOS extender may still fail.', requirements: ['Any required DOS extender and application data must be in the selected package.'] },
    { id: 'dos-com', format: 'dos-com-ambiguous', maturity: 'experimental', justification: 'The installed DOSBox worker accepts DOS COM programs after you confirm their intended platform.', requirements: ['Confirm DOS intent from the program documentation.'] },
  ],
};
