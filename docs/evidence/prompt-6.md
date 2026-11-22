# Prompt 6 acceptance — 2026-11-22

**Allowed fallback outcome: Windows execution is explicitly unverified and disabled.**
The real Boxedwine 25R1 engine initialized and exercised its memory FS, then reported
a missing `/bin/wine` and shut down. No Windows program launched. The existing real
DOS path passed its regression suite. No simulated Windows output was added.

## Environment and scope

- Chrome **157.0.8103.79**, macOS **26.6.2 (25G83)**, arm64, the same Apple M1/16 GiB
  laptop as Prompt 5. Desktop and Pixel 7 layout emulation use host Chrome; no
  physical Android, Firefox or Safari claim.
- Node **24.19.0**, npm **11.17.0**. Workspace is still an unborn Git repository;
  no commit/PR was created. [Source SHA-256 records](prompt-6-source-files.json)
  identify the tested source state instead of inventing a commit ID.
- No new npm dependency or dependency-version change. The [Boxedwine artifact
  record](../../tests/fixtures/boxedwine-artifacts.json) pins the investigated
  official release, source commit, engine, base filesystem and rejected fixture.
- Actual engine probe uses original text data and no guest application. UI gating
  tests use original parser-only PE32/NE bytes, explicitly not working software.
  DOS tests use the unchanged [licensed MEM/FreeCOM fixtures](../../tests/fixtures/dos/README.md).

## Commands and outcomes

| Command | Result |
| --- | --- |
| `npm install` | Passed; 184 packages audited, zero reported vulnerabilities. npm still warns about the optional unapproved fsevents install script; no script approval was added |
| `python3 scripts/boxedwine-audit.py /private/tmp/phantom-boxedwine-audit` | Passed against the cached official release; published digest and member hashes match. `--download` provides the fixed-URL reproducer for a fresh directory |
| `caffeinate -i npm run check` | Passed, exit 0; exact full command output retained in [check log](prompt-6-check.log) |
| `npm run typecheck` / `npm run lint` (within check) | Passed strict TypeScript and zero ESLint warnings |
| `npm test` (within check) | **220 tests passed**, 12 files |
| `npm run build` (within check) | Passed; audited DOS assets verified and production bundle produced |
| `npm run test:browser` (within check) | **60 tests passed**, 1.7 minutes; real Chrome desktop/mobile layouts, zero failed tests |
| `npm run test:production` (within check) | Passed strict CSP, Windows disabled-path checks, both DOS fixtures, actual guest file export, offline relaunch and guest-network failure recovery |
| `caffeinate -i npm run test:boxedwine -- /private/tmp/phantom-boxedwine-audit` | Passed **three engine-only cycles**, not Windows execution acceptance. [Raw structured report](prompt-6-boxedwine-engine.json) |
| Documentation/local links and recorded source hashes | Validated after recording this evidence; no new app scaffolding or future-stage feature added |

The development server was started by Playwright using
`npm run dev -- --port 4176 --strictPort --mode test`. It and the test browsers were
closed by their runners. `caffeinate -i` prevents macOS host sleep only for each
command. It is not a product dependency.

## What the Boxedwine trial established

The official `25R1.0` tag points to
`9279ab115e3c1e513aca4ea95aa30ea2f65258be`; the web release is from 2025-09-13.
The [audit result](prompt-6-boxedwine-audit.json) and
[filesystem path/size inventory](prompt-6-filesystem-inventory.json) are reproducible
from `scripts/boxedwine-audit.py`. No guest archive path is extracted to the host.

The real JS/WASM ran inside a disposable opaque iframe through the documented
Emscripten `Module`/`preRun`/`FS` surface. It preserved `SUPPORT/INPUT.TXT` and an
empty directory in MEMFS and read the expected bytes back before `main`. There
were no additional filesystem mounts, storage calls, network API attempts,
WebSockets, workers or service workers. Only fixed loopback page/engine URLs were
requested. JS supplied the hash-verified WASM bytes directly.

| Cycle | Bootstrap/staging/missing-Wine completion | Frame removal | Linear WASM memory |
| --- | ---: | ---: | ---: |
| 1 | 380 ms | 28 ms | 536,870,912 bytes |
| 2 | 369 ms | 7 ms | 536,870,912 bytes |
| 3 | 370 ms | 7 ms | 536,870,912 bytes |

Actual engine messages include `Could not find /bin/wine` and `Boxedwine shutdown`.
The missing environment is deliberate: the reviewed filesystem was withheld at
the license/provenance gate. This result shows the small integration surface can
bootstrap and fail predictably. It is **not** program output, Windows guest file
I/O, meaningful Windows input, a performance benchmark, or clean shutdown of a
running application. Memory reclamation after iframe removal is not measured.

The audit found a stripped Wine **6.0**, revision `3`, filesystem with 1,640 entries
and 117,830,656 unpacked bytes. No license/copyright/source inventory paths occur
in that archive. Its x86 PE32 `notepad.exe` contains the marker
`Wine placeholder DLL` and has an ELF32 `notepad.exe.so` implementation. Neither
file was added as a runnable fixture. This does not establish unlawful upstream
distribution; the required PHANTOM component audit is incomplete.

No Boxedwine JS/WASM, Wine filesystem, Notepad placeholder, proprietary Windows
image/DLL pack or demo game is present in the production runtime assets. The
engine-only probe loads temporary private research inputs, separate from the app.

## Shared app and DOS regression

[Windows UI records](prompt-6-browser.json) cover PE32 and NE with misleading COM
suffixes, automatic/override selection, imported researched-version pins, local
profile export, direct Player navigation, no canvas/iframe, disabled Start/Stop,
responsive layouts and no selected-file data in requests. ZIP and folder tests
preserve companion paths and subsequently launch real DOS MEM through the same
app shell, exporting its memory report. Unit tests also reject direct adapter
prepare/launch before any selected-byte read and prevent enabling a blocked build
by flipping `available` and supplying hashes.

The Vite development client opens one local control WebSocket even with HMR
disabled. It carries no selected-file sentinels; its short-lived token is redacted
in committed records. The [production report](prompt-6-production.json) separately
records **zero sockets, zero Windows runtime requests, zero selected-data requests,
zero user storage, zero remaining workers and zero console errors** for Windows
on both layouts. This is disabled-path privacy evidence, not live-Windows guest
network containment evidence.

[DOS browser observations](prompt-6-dos-browser.json) repeat three genuine
launch/input/stop cycles per fixture/layout, audio-stream and mouse-forwarding
checks, missing-asset recovery and blocked IPX abort/relaunch. The production
checks also pass both fixtures with actual exported output and offline relaunch:

| Fixture | First observed DOS frame | Stop | Guest output |
| --- | ---: | ---: | --- |
| MEM 1.12 | 1,044 ms | 62 ms | [747-byte report](prompt-6-MEM.EXE-output.txt), [actual framebuffer](prompt-6-MEM.EXE-framebuffer.png) |
| FreeCOM 0.86 ZIP | 1,034 ms | 61 ms | [16-byte file](prompt-6-FREECOM.ZIP-output.txt), [actual framebuffer](prompt-6-FREECOM.ZIP-framebuffer.png) |

These are individual measured runs, not 20-run p95 or a cold-network benchmark.
The DOS core/config/host source and pinned artifacts are unchanged from Prompt 5.
US physical keyboard, browser shortcut reservations and the previously documented
DOS limitations remain. No Windows keyboard, mouse, audio or guest I/O is verified.

## Failures retained and follow-up

- Python's local HTTPS certificate store initially rejected public metadata reads.
  System curl with normal certificate validation succeeded; TLS checks were never
  disabled. The reproducible audit now uses that HTTPS client.
- Initial new browser tests assumed the single-file Analyze label for folders,
  and assumed no development-server control socket. Those test assumptions failed
  on both layouts. Selectors and explicit development/production network assertions
  were corrected; all four new browser cases then passed. The final full suite has
  no retries or skipped cases.
- The Windows application acceptance remains **not run / blocked**, not passed.
  No attempted execution of a licensed standalone PE or NE fixture is claimed.
  The permitted fallback is supported by the audit, real engine failure logs and
  disabled-path acceptance above.

The smallest actionable Windows follow-up is to build an auditable minimal Wine
filesystem, retain its full component sources/notices, build/source-match a real
x86 PE32 Wine Notepad fixture, then complete actual framebuffer/input/save/export,
stop/relaunch and guest-network checks before removing the blockers. Exact steps
and upstream sources are in [the runtime guide](../boxedwine-runtime.md#actionable-next-step).
Win16 needs independent fixture evidence. No final distribution license or public
deployment is selected here.

Changed areas: the new `src/runtime/boxedwine/` boundary; descriptor/registry/planner
adoption guards; shared availability and Player copy; fixed error/log codes;
Windows/unit/production tests; opt-in audit/probe scripts and artifact pins; project
rules, product/architecture/matrix/readme and this evidence. Earlier evidence is
retained unchanged. The next playbook stage is **Prompt 7**, only when requested;
continuing Windows instead requires the concrete follow-up above. No persistence
or live file import was added.
