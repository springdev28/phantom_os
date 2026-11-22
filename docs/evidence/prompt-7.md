# Prompt 7 acceptance — 2026-11-22

**Implemented: opt-in OPFS workspaces and real DOS document import, modification,
export and restore after reload.** Temporary mode remains the default. Saving
software and captured working files requires separate explicit choices. No account,
remote user-data endpoint, implicit autosave or automatic launch was added.

## Environment and exact scope

- Chrome **157.0.8103.79**, macOS **26.6.2 (25G83)**, arm64, Apple M1 / 16 GiB.
  Desktop and Pixel 7 viewport emulation use host Chrome; no real-phone, Firefox
  or Safari acceptance claim. Separate saved-workspace visual inspection recorded
  widths 1440 and 393 CSS pixels with equal scroll widths (no horizontal overflow).
- Node **24.19.0**, npm **11.17.0**. Dependencies, lockfile and licensed fixtures
  are unchanged from Prompt 6. No new npm dependency or emulator asset adoption.
  `npm install` was not repeated for this stage; its prior passing outcome is
  retained in [Prompt 6](prompt-6.md).
- No Git commit/PR/deployment: the workspace is still an unborn repository. The
  [source hashes](prompt-7-source-files.json) identify the tested source state.
  [Changed source files](prompt-7-changed-files.json) compare against Prompt 6.
- Real runtime: `emulators` **8.5.3**, classic `dosboxWorker`; backend reports
  `8.5.3 (aeecd448025fcd8fc2843a780660a8f7)`. Build ID now binds the generated host:
  `emulators-8.5.3-e6f4e544-dosbox-c41239cc61ec`.
- Generated host SHA-256:
  `c41239cc61ec3e073408395f82daab3427f69cb1d55db919b2aabbca521973b6`.
  Engine hashes are unchanged; the manifest in [workspace observations](prompt-7-workspace-browser.json)
  lists all four pins, the complete launch profile, file references and actual chunk hashes.
- FreeCOM fixture: `tests/fixtures/dos/FREECOM.ZIP`, 88,187 bytes,
  SHA-256 `fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e`.
  Entrypoint `APP/COMMAND.COM`, cwd `.`, full writable C: mount, US keyboard,
  mouse off, audio false, 64 MiB guest memory, default DOS cycles/core/machine.
  See the retained GPL source/licenses in [fixture provenance](../../tests/fixtures/dos/README.md).
- MEM regression fixture: 15,028 bytes,
  SHA-256 `6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4`.
  No proprietary software or personal document is used in recorded evidence.

## Acceptance checks

The [full check log](prompt-7-check.log) records the final command output.
The [browser summary](prompt-7-browser.json) records every test outcome and duration.
The [production report](prompt-7-production.json) records strict CSP and all traffic.

| Command/check | Result |
| --- | --- |
| `caffeinate -i npm run check` | **Passed, exit 0**; all gates in the retained log |
| `npm run typecheck` / `npm run lint` | Strict TypeScript and zero ESLint warnings passed |
| `npm test` | 240 tests, 13 files passed; 20 new storage/transfer tests |
| `npm run build` | Passed; exact DOS assets checked, fresh production bundle emitted |
| `npm run test:browser` | **70 tests passed**, desktop and Pixel 7 layout Chrome, zero failed tests |
| `npm run test:production` | Passed real DOS guest I/O, offline relaunch, disabled Windows gates, strict CSP, opt-in save/reload/restore |
| `npm run dev -- --port 4176 --strictPort --mode test` | Started/served by the browser runner and closed afterward |
| Native saved-workspace visual inspection | 1440/393 pixel layouts fit their viewports; [measurements](prompt-7-layout.json), [desktop](prompt-7-workspace-desktop.png), [mobile](prompt-7-workspace-mobile.png) |
| Documentation links and source/asset hashes | Final local validation recorded in [document checks](prompt-7-doc-check.json) |

`caffeinate -i` prevents host sleep for the duration of testing. It is not part of
the app. No runtime acceptance uses unit doubles. Memory OPFS doubles and injected
permission/quota errors are fault tests, not claims of a real disk-full incident.

## What actually ran

[Desktop and mobile observations](prompt-7-workspace-browser.json) show the same
real FreeCOM sequence:

1. Start the real DOS worker/framebuffer from the full licensed ZIP. Assert no
   OPFS workspace exists before opt-in.
2. Import authored DOC.TXT via `fsWriteFile`. A second differently cased name is
   rejected without overwrite; exporting DOC.TXT still returns the original bytes.
3. Send actual guest keyboard input `TYPE DOC.TXT > RESULT.TXT`, then
   `ECHO CHANGED INSIDE DOS>>RESULT.TXT`. Export via `fsReadFile` and compare exact
   bytes. Capture RESULT.TXT as a working snapshot; stop and release the worker.
4. Confirm all storage choices are initially unchecked and Save is disabled.
   Enable manual saves; explicitly check software and captured files; save.
5. Export backup and parse its actual ZIP. The application companion files are
   intact; RESULT.TXT has expected bytes; both JSON manifests are parseable and
   the launch profile agrees. File contents are not embedded in JSON.
6. Reload. Profile/runtime pins validate, no iframe/worker auto-starts. Restore
   validates chunks and re-inspects the saved software. Explicitly launch again.
7. Export RESULT.TXT: bytes match the prior save. Append another line inside DOS
   and export again. The exact final bytes are:

   ```text
   LOCAL DOCUMENT SEVEN\r\n
   CHANGED INSIDE DOS\r\n
   RESTORED AND EDITED\r\n
   ```

8. Stop; Delete workspace with its explicit deletion confirmation; verify the
   owned OPFS root is absent. Reload confirms no saved workspace.

The [desktop framebuffer](prompt-7-desktop-chrome-framebuffer.png) and
[mobile-layout framebuffer](prompt-7-mobile-chrome-framebuffer.png) are direct PNG
captures of the actual canvas. They are supplemental evidence; acceptance comes
from real execution/input and exact exported bytes, not image appearance.

The production build repeats import/edit/export/save/reload/restore under the actual
hosting CSP. `SAVED.TXT` contains `PRODUCTION LOCAL DOCUMENT\r\nEDITED IN DOS\r\n`,
SHA-256 `5a477ff0d53d2b50195662b92ad50b2b58d487250860fdbaf579a8241a3f6645`.
Restored guest bytes match exactly. Existing MEM and FreeCOM input, audio/keyboard,
stop/relaunch and offline tests pass without weakening their sandbox.

## Privacy, integrity and recovery

- Context-level request monitoring covers the page and worker-originated requests.
  Production traffic contains only fixed same-origin app/runtime assets and local
  Blob loads. No user file/name/path/content sentinel, external request, WebSocket
  or service worker appears. Vite's fixed developer HMR socket is not shipped.
- Existing guest `IPXNET CONNECT phantom-network.invalid` regression still fails
  closed, releases the worker and permits a clean DOS relaunch; no outgoing guest
  connection occurs. OPFS is controlled by the app, not accessible from the opaque
  guest iframe/worker. New storage code has no network API.
- Profile-only backup has just `manifest.json` and `launch-profile.json`. Software
  references have `chunks: null`; no software bytes are read/copied (unit read spies)
  or restored. Player stays disabled until original software is reselected/reviewed.
- A second host origin (`localhost` versus `127.0.0.1`) cannot see the saved workspace.
  Web Locks serialize same-origin operations. Unit concurrency/failure tests verify
  complete generations, prior-save preservation and owned-root-only deletion;
  simultaneous native multi-tab race/power-loss tests were not performed.
- Quota preflight failure leaves the actual previous head intact. Deliberately
  corrupting saved software at the same byte length fails SHA-256 checks and does
  not apply files or start a program. Denied and unavailable OPFS keep temporary
  inspection and profile export usable. Quota/permission failures use controlled
  browser API injection, not raw user exception messages.
- Unit tests also cover cancellation mid-write, backup corruption refusal, safe
  relative paths, oversized metadata/file rejection, hash-count mismatches, forged
  compatibility assertions, runtime-build/asset mismatches, explicit unsaving,
  executable-overlay rejection and bounded 1 MiB reads.

## Failed attempts and limitations

The first targeted browser run completed real live import/edit/export/capture but
stalled during Playwright's element screenshot stability wait. It was interrupted;
canvas evidence now reads the real pixel buffer directly. Another targeted run
expected a raw-COM confirmation checkbox for COMMAND.COM; the fixture is correctly
recognized by its **MZ bytes**, so the test was corrected to follow header evidence.
A subsequent in-progress rerun of the old assertion was interrupted. These are
recorded test-harness failures, not successful acceptance runs. The initial unit
spy attempted to modify a frozen artifact; wrapping its read callback fixed the
unit harness. Final recorded verification supersedes those runs.

- No new execution verification for arbitrary DOS software, Windows, disk booting,
  ELF/Linux or classic Mac. Windows remains explicitly disabled with Prompt 6 blockers.
- Manual snapshots only. Save and close a file inside the guest before capture or
  export; guest-buffered/uncaptured edits are lost on stop/navigation/crash/reload.
  No automatic save-on-exit or running VM snapshot. A timed stop currently has no
  advance countdown; the Player advises capture/export before stopping.
- Live import: one new root DOS 8.3 file ≤8 MiB, no overwrite. More general nested
  filesystem synchronization and GUI document-opening automation are not implemented.
- Storage requires OPFS, Web Locks and a secure origin. It is origin/profile-specific,
  evictable and unencrypted at the app layer. Estimates may be approximate. Old and
  new generations need space during a save; maximum saved data 128 MiB, working
  snapshots 32 MiB, actual DOS launch package plus working files 32 MiB.
- Backup export is portable ZIP + JSON, with documented manual extraction/import.
  There is no one-click backup importer or cross-origin storage migration. Updated
  host/runtime pins require explicit profile review/reset. No retention guarantee.
- No physical mobile, Firefox/Safari, long-duration retention, real device quota
  exhaustion, power-loss durability or browser peak-heap measurement. US physical
  keyboard mapping and reserved browser shortcuts retain Prompt 5 limitations.
- The inherited release/license gate remains; no new dependency was introduced,
  no final distribution license selected, and no public deployment performed.

## Changed files and next stage

The [exact source change list](prompt-7-changed-files.json) covers the domain storage
contracts/errors; `src/workspace/`; session/workspace/runtime hooks and download
helper; Player/Workspace/app shell/styles; DOS adapter/host/descriptor/transfer
validation; logger codes; unit, browser and production tests. README, AGENTS,
product specification, architecture, compatibility matrix and DOS guide were
updated; the workspace guide and this evidence set are new. Package manifests,
lockfile, vendor sources and fixture bytes did not change.

Next permitted stage, only on a new request: **Prompt 8 — refine the existing
journey and accessibility**. Preserve the tested DOS path, opt-in semantics and
Windows disabled state. No later playbook stage was implemented here.
