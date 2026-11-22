import type { RuntimeDescriptor } from '../../domain/contracts';

/** An engine-only trial is not an installed Windows environment. See docs/boxedwine-runtime.md. */
export const boxedwineDescriptor: RuntimeDescriptor = {
  id: 'boxedwine', name: 'Boxedwine', maturity: 'experimental', available: false,
  formats: ['ne', 'pe32'], assets: [], diskEnvironments: [], maxGuestMemoryMiB: 512,
  capabilities: { keyboard: false, mouse: false, audio: false, fileImport: 'none', fileExport: 'none', guestNetworking: 'disabled' },
  requirements: [
    'The 25R1 browser engine was investigated; no complete Boxedwine/Wine asset set is installed.',
    'An independently audited Wine filesystem, libraries, fonts and corresponding source are required.',
  ],
  blockers: [
    { code: 'WINDOWS_FILESYSTEM_AUDIT', message: 'Windows is disabled: the reviewed Wine 6.0 filesystem has no component license/source inventory.',
      action: 'Build or obtain a minimal Wine filesystem with pinned component sources, licenses and hashes before installing it. Do not supply replacement Windows DLL packs.' },
    { code: 'WINDOWS_LAUNCH_UNVERIFIED', message: 'Windows execution has not been verified. The bundled Notepad EXE is a Wine placeholder backed by an ELF module.',
      action: 'Test a source-matched x86 PE32 Wine Notepad build through local intake, with actual output, typed input, clean stop/relaunch and network checks. Inspect and profile export remain available.' },
  ],
  rules: [
    { id: 'windows-pe32', format: 'pe32', maturity: 'experimental', justification: 'The x86 PE32 header matches the Boxedwine trial target. The engine-only trial did not launch a Windows application; execution is disabled.', requirements: ['Matching 32-bit libraries and APIs; header metadata cannot establish the required Windows version.'] },
    { id: 'windows-ne', format: 'ne', maturity: 'planned', justification: 'This declared Windows NE image needs a separate Win16 trial. No Win16 application has been executed in PHANTOM.', requirements: ['An audited Win16-capable Wine environment and a separately licensed NE fixture.'] },
  ],
};
