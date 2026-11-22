# Prompt 8 acceptance — 2026-11-22

**Implemented: an explicit Inspect → Compatibility → Configure → Run journey,
Home demo selection, local compatibility reports, real player focus/full-screen
controls and file-export guidance.** The DOS and opt-in OPFS paths remain working.
Windows is still experimental and disabled. No simulated program or new emulator
was introduced.

Engineering acceptance passes below. **The 3-of-3 first-time human usability target
and screen-reader speech validation remain unverified.** Automated loopback timings
are not human results or a measured cold/warm internet performance guarantee.

## Environment and exact scope

- Chrome **157.0.8103.79**, macOS **26.6.2 (25G83)**, arm64 Apple M1 / 16 GiB;
  Node **24.19.0**, npm **11.17.0**. Desktop plus Pixel 7 viewport emulation on
  host Chrome, not physical Android/iOS, Firefox or Safari.
- Same exact `emulators` **8.5.3** classic DOSBox worker and GPL fixtures as Prompt 7;
  no new dependency, OS image, font or third-party graphic. `npm install` was not
  repeated because the manifests/lockfile are unchanged; its prior result remains
  in [Prompt 6](prompt-6.md).
- Runtime build ID: `emulators-8.5.3-e6f4e544-dosbox-9715b4467d0f`.
  Host SHA-256: `9715b4467d0f58ad7f3c38f215241e76b6fb18bebf465ee8f1bc465cfe359460`.
  Host changes cover genuine focus events, reserved browser shortcuts and semantic
  controls; the opaque origin, sandbox and network denial remain intact. Old
  workspace/profile pins require explicit review/reset; no automatic migration.
- MEM fixture: 15,028 bytes, SHA-256
  `6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4`.
  FreeCOM ZIP: 88,187 bytes, SHA-256
  `fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e`.
  Original license/source pairs and notice texts remain in
  [fixture provenance](../../tests/fixtures/dos/README.md) and `vendor/dos/`.
- No Git commit/PR/deployment. The repository remains unborn; the
  [107 source/fixture hashes](prompt-8-source-files.json) identify the tested code.
  [38 changed source files](prompt-8-changed-files.json) compare against Prompt 7.

## Commands and checks

The [final full log](prompt-8-check.log) records an exit-zero
`caffeinate -dims npm run check`. Caffeinate is only a test-host sleep inhibitor;
it does not ship in the app or execute imported guest software on the host.

| Command/check | Final result |
| --- | --- |
| `npm run typecheck` | Passed strict TypeScript |
| `npm run lint` | Passed, zero warnings |
| `npm test` | **242 tests / 14 files passed** |
| `npm run build` | Passed; exact engine/source/fixture inventory verified and local assets copied |
| `npm run test:browser` | **82 passed, 0 skipped, 0 failed, 0 retries**, 167.8s; [per-test outcomes](prompt-8-browser.json) |
| `npm run test:production` | Passed; strict CSP, actual DOS output/export, offline relaunch, blocked guest network attempt, Windows gates, OPFS restore and public demo paths; [traffic/build report](prompt-8-production.json) |
| `npm run dev -- --port 4176 --strictPort --mode test` | Started/served/closed by Playwright; additional manual visual run used 4178 |
| Keyboard, reduced motion, contrast, 200% CSS zoom and 320px reflow | Passed scoped browser checks; [audit](../accessibility-audit.md), [measurements](prompt-8-accessibility.json) |
| Documentation links and retained hashes | [Final document/integrity checks](prompt-8-doc-check.json) |

## What actually ran

The new browser tests use the visible Home demo buttons, then Analyze, the named
entrypoint radio, View compatibility, Configure launch, Use these settings and
continue, and Start DOS program. Both fixtures have MZ headers; their names alone
are not used as proof. No implicit entrypoint selection, profile application or
program launch occurs.

The adapter is not imported and no runtime asset is fetched until Start. Tests
require real framebuffer pixels and meaningful keyboard input. They check focus,
Ctrl+Alt+Esc release, Tab exit, full-screen entry/exit and graceful fallback when
that browser API is unavailable. A delayed **real** asset request exposes actual
runtime download progress. No mocked runtime or image substitutes for execution.

| Automated Home demo → real running state | Desktop | Phone layout | Guest export |
| --- | --- | --- | --- |
| FreeDOS MEM, entrypoint `MEM.EXE` | 4,115 ms | 4,135 ms | `MEM > MEMOUT.TXT`: 747-byte memory report |
| FreeCOM ZIP, entrypoint `APP/COMMAND.COM` | 3,713 ms | 4,161 ms | `ECHO HELLO FROM DOS>RESULT.TXT`: 16 bytes including CRLF |

The [journey records](prompt-8-journeys.json) include output hashes, worker URLs,
all requests, Chrome version and zero console/page errors for these journeys.
Production repeats the four journeys in **4,006–4,536 ms** on loopback, with real
exports under the hosting CSP. These are four samples, not a p95 benchmark or a
claim that an unfamiliar person took four seconds.

Default configuration: cwd `.`, whole-package writable temporary C:/ mount,
64 MiB DOS memory, 3000 cycles, core auto, SVGA S3, XMS/EMS enabled, US keyboard,
mouse/audio off, 30-minute limit. The existing runtime regressions also enable
real audio/absolute mouse, run three launch/input/export/stop cycles and verify
stop within two seconds. No new program was added to the automatic verification
catalogue; general DOS remains experimental.

[Actual desktop player viewport](prompt-8-player-desktop.png), direct
[MEM pixels](prompt-8-mem-desktop-chrome-framebuffer.png) and
[FreeCOM pixels](prompt-8-freecom-desktop-chrome-framebuffer.png) supplement the
input/file evidence. Phone-layout pixels are retained separately. Full-page
Playwright captures can omit opaque iframe layers or place fixed elements oddly;
no image was composited or substituted into the application.

## Feedback, accessibility and privacy

- Home has exactly one dominant Open legacy software action. Native file/ZIP/folder
  pickers remain available; real folder drops display guidance instead of silently
  importing a subset. A browser with no directory-picker feature gets ZIP/multiple-
  file guidance. Large selections show actual size and DOS/import limits.
- The candidate list precedes Inspect's continue action. Multiple executable choices,
  resource hints and all companion files remain intact. Compatibility retains
  missing-file actions, disabled Windows, unsupported PE32+/ELF/Mac/disk paths and
  copy/download reports. No confidence score becomes a supported claim.
- Clipboard denial opens a focused readonly textarea and a local text download.
  Profile JSON moves to Configure/Workspace and still excludes software/documents.
  The report has metadata, requirements and uncertainty, never raw file contents.
- Focus is represented by actual child canvas events and a visible border/status.
  Start no longer captures the keyboard. Native semantic buttons, arrow labels,
  skip link, route-heading focus, live status and visible outlines are retained.
  Text/field contrast measurements pass within the audited shell states; reduced
  motion removes shell transitions. The original DOS canvas has no semantic guest
  accessibility tree and cannot be claimed screen-reader accessible.
- Tests instrument context-level requests, including worker-originated traffic.
  Production has only fixed same-origin app/runtime/demo downloads and local Blob
  worker loads, **no external requests, WebSockets or service workers**. The public
  fixture filenames are fixed literals selected by the demo buttons; user-selected
  names, paths, report/document contents and export command strings do not appear
  in requests. The guest IPX attempt still fails closed with clean recovery.
- The production main `connect-src` allowlist adds only `/demos/MEM.EXE` and
  `/demos/FREECOM.ZIP` beside the three pinned engine URLs. Runtime frame and worker
  `connect-src 'none'` remain unchanged. Vite's fixed development socket is not
  shipped and carries no selected-file data in the tests. This evidence supports
  the scoped UI statement **Files are processed locally**.
- Saving still requires explicit opt-in and separate software/working-file choices.
  Real import/edit/export/capture, backup, reload/restore, profile-only reselection,
  origin isolation and deletion regressions pass. No hidden persistence was added.

## Failed attempts, fixes and remaining limits

Earlier targeted runs caught outdated route selectors and a misspelled test helper;
those tests now explicitly visit Configure. A first attempt to use a nonexistent
Playwright project name failed before testing; the configured projects are
`desktop-chrome` and `mobile-chrome`.

The new focus tests exposed a genuine Chrome browsing-context/blur race. Focusing
only the child canvas (and initially doing it automatically on startup) could leave
browser focus elsewhere or recapture it after release. The fix makes capture
explicit, orders parent/child focus and reports actual focus events. Both layouts
now pass without test retries or relaxed focus assertions.

Element screenshot stability waits stalled after a full-screen transition. New
journey evidence reads the actual rendered canvas PNG; full-page screenshots are
not launch acceptance. A synthetic folder-drop wrapper did not behave like a
native drag item; the test now uses a real local folder through Chrome's drag API.
Feature denial/absence uses controlled browser API fault injection only; it does
not fake runtime behavior.

The [first full run](prompt-8-first-full-check.log) passed 80/82 browser cases, with
two mobile tests spanning roughly 16 minutes before timing out during a long host
pause. No application assertion was weakened. The final full run kept the display
awake as well as inhibiting idle sleep and passed all 82, then production acceptance.
The manual browser tool also had an automatic-approval timeout; its permitted
single retry succeeded. No user approval or sandbox relaxation was needed.

Remaining limits:

- Zero first-time human participants and no VoiceOver/NVDA speech session are
  claimed. Follow the [documented tester protocol](../accessibility-audit.md) before
  calling the minute-to-first-launch target or full accessibility verified.
- Chrome/macOS only; phone layout emulates physical keys. No complete mobile DOS
  text keyboard, IME/non-US mapping, real-phone/Safari/Firefox or host-heap benchmark.
- Full-screen requires browser permission/API support. Browser/OS reserved shortcuts
  cannot be captured. Actual guest UI accessibility/contrast varies by program.
- Guest writes remain temporary unless explicitly exported/captured/saved. The new
  remaining-time display warns before the existing session deadline; there is no
  autosave, pause snapshot or permanent-storage promise.
- Windows, ELF/Linux, classic Mac and disk-image execution did not gain support.
  Boxedwine/Wine and public-distribution license/source rebuild gates remain.

## Changed files and next stage

The exact [source change list](prompt-8-changed-files.json) covers routes/screens,
launch steps, demo intake, compatibility report/export, focus/progress contracts,
DOS host/adapter, styles and tests. README, AGENTS, product specification,
architecture, compatibility matrix and DOS guide were updated. The accessibility
audit and this evidence set are new. Package/lock manifests and original fixture
and vendor source bytes are unchanged; the build copies the existing audited demos
into ignored `public/demos/` for explicit selection.

No later stage was implemented. Next roadmap stage only on a new request:
**Prompt 9**, with human usability/assistive-technology validation still outstanding.
