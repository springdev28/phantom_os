# PHANTOM OS compatibility matrix

Evidence date: **2026-11-22**. Repository baseline: empty before Prompt 0.
**Prompt 10 records reproducible Chrome/Firefox tests and laptop measurements. Two exact
DOS fixtures retain verified browser observations; Windows application execution
remains unverified and unavailable.**
Static recognition and frontend verification do not promote executable compatibility.
The matrix distinguishes tested header checks, exact guest observations and future work.
Prompts 1–4 below are historical snapshots, not current engine availability.

## Submission preparation — Prompt 11

The first public CI run also exposes an [unresolved Chromium 159 mobile
framebuffer defect](chromium-mobile-blocker.md): 79 browser passes, 13 failures.
Keep those failures visible; no compatibility promotion follows from desktop results.

No runtime capability is promoted by adding Kiro files, a project license or a
submission script. The original-source GPL-2.0-only decision and corrected source
archive are recorded in [the release review](release-license-review.md). Existing
runtime assets and launch observations remain unchanged. Rebuilt experimental
outputs are not adopted. Windows is still disabled; Kiro participation and hosted
HTTPS/video results are [explicitly pending](submission-readiness.md).

## Current automated and manual matrix — Prompt 10

The [current program/environment/results table](compatibility-results.md) separates
static recognition, real launch/input/I/O observations, measured performance and
manual validation. It records exact browser versions, program/runtime pins and
configuration. The [reproduction protocol](compatibility-testing.md) is for both
automated clean installs and a non-author's manual run. Failed trials and unperformed
checks remain visible. A synthetic ELF/PE header is never an execution fixture.

The same production core checks run in Chrome and Playwright Firefox. Hosted CI
results require an actual CI run; local results do not invent one. Independent
human validation remains a separate row. These observations do not populate the
automatic verified-compatible catalogue or imply that arbitrary DOS software runs.

## Current security scope — Prompt 9

The [security model](security.md) records threat boundaries, explicit resource
budgets, supported platforms and residual escape/denial-of-service risk. The
[acceptance evidence](evidence/prompt-9.md) records current malformed-input,
refresh/worker-stop, session-deadline, storage-denial, CSP/permissions and page/worker
network checks. Preview and acceptance now share real hosting policies. This
does not establish general malware safety or expand executable compatibility.
Windows stays experimental/disabled; disk, Linux and Mac execution stay unsupported.
New host hashes require revalidation; historical evidence below retains its original pins.

| Capability | Status | Observed scope |
| --- | --- | --- |
| Hostile input rejection and recovery | `verified` in the deterministic corpus | Corrupt PE/GPT metadata, eight hostile ZIP cases, bounded extraction and literal metadata rendering; no partial virtual package or host writes |
| Guest isolation and disabled external services | `verified` in recorded Chrome probes | Parent DOM/storage/clipboard/host pickers unavailable; guest/worker network APIs denied, no service worker, explicit WASM/VFS bounds |
| Refresh, silent worker failure and session deadline | `verified` in both Chrome layouts | Actual worker disposal, recoverable error/relaunch and real one-minute expiration; no automatic persistence or launch |
| Local processing under production headers | `verified` for observed requests | Fixed static GET/Blob loads only; no selected names, bytes, hashes or documents in URL/body/headers; actual guest import/export and cached offline relaunch |
| Complete malware containment or universal browser support | `unsupported` guarantee | Emulator/browser escapes, CPU/heap exhaustion and compromised same-origin code remain risks; full policy probes beyond Chrome and physical mobile platforms remain unverified |

## Current interface evidence — Prompt 8

| Capability | Status | Observed scope |
| --- | --- | --- |
| Home → Inspect → Compatibility → Configure → Run | `verified` in the automated corpus | Two actual public DOS fixtures selected from Home; explicit entrypoint/profile/start; actual guest result bytes exported; no automatic launch |
| Focus, input release, full-screen and session controls | `verified` in Chrome desktop/mobile layout | Actual iframe/canvas focus, Ctrl+Alt+Esc and Tab release, full-screen entry/exit, denied-feature fallback, clean stop/relaunch |
| Concise blockers and local reports | `verified` in the tested cases | Ambiguous ZIP, missing library, PE32 experimental/disabled and PE32+ unsupported; clipboard, denied-clipboard selectable text, local report/profile download |
| File picker / drop and large-file feedback | `verified` in Chrome | Actual selected files and native folder drop; folder drop gives a picker/ZIP instruction rather than partial import; feature-absence injection tests picker fallback; bounded 17 MiB input message |
| Keyboard navigation, contrast, reduced motion, 200% CSS zoom | `verified` for the measured shell states | Native control roles/focus, six direct routes, sampled Home/Compatibility/Configure text and fields, 320px reflow; no screen-reader speech or full WCAG conformance claim |
| First-time human launch in ≤60s and export in ≤120s | `planned` validation | Automated loopback runs recorded separately; 3-of-3 human protocol still outstanding |
| Original guest application screen-reader support | `unsupported` by this adapter | Framebuffer pixels are not a semantic accessibility tree. Exported text can be read outside DOS; app controls retain labels |
| Local processing with public demo selection | `verified` for the observed network corpus | Only fixed app/runtime/demo downloads and local Blob loads; no user metadata/content requests or guest networking; explicit OPFS behavior preserved |

See [current acceptance evidence](evidence/prompt-8.md), [accessibility audit and
human protocol](accessibility-audit.md). Runtime/host/configuration/browser pins are
recorded there. General DOS execution remains **experimental**; Windows remains
**experimental and disabled**; ELF/Linux, classic Mac and disk boot execution remain
**unsupported**. UI progress/focus and demo discovery do not add compatible formats
or populate the automatic verified-compatible catalogue.

## Historical frontend evidence — Prompt 1

| Capability | Status | Observed scope |
| --- | --- | --- |
| Five screens, direct routes, keyboard navigation and responsive layout | `verified` | Real Chrome desktop and emulated mobile; no console errors or horizontal overflow |
| Single-file selection and metadata | `verified` | Name/size/date displayed; controlled rejection of empty/oversized inputs; filenames confer no format result |
| Local file readability | `verified` | Bounded one-byte read, loading/cancel/recovery and stale-result guards; format remains unknown |
| Temporary selection, clear and reload | `verified` | Current file reference only; no persistent workspace or guest data |
| Local-only frontend processing | `verified` | The synthetic browser journey sends no file/name sentinel, creates no persistent storage and uses no worker; future engines require separate validation |
| Runtime loading boundary | `verified` contract tests only | Lazy factory/caching/build checks tested with test doubles; production descriptors remain planned/unavailable |

See [the exact checks and limitations](evidence/prompt-1.md). Chrome responsive
emulation is not verification of a mobile device, Firefox, Safari or emulation.

## Analyzer evidence — Prompt 2

| Capability | Status | Observed scope |
| --- | --- | --- |
| Bounded format recognition and reports | `verified` within the checks below | 19 original parser fixtures, additional malformed-field tests and 256 deterministic malformed-byte cases; actual hex fields/offsets and explicit uncertainty |
| Desktop/mobile report journey | `verified` | 20 real Chrome browser tests including distinct format reports, expandable keyboard-accessible evidence, corrupt-input recovery and no horizontal overflow |
| Local-only analyzer | `verified` for this corpus | Zero requests during selection/analysis after Inspect loads; no page/service workers, persistent entries or file/name data in observed traffic |
| Header recognition as runtime support | `unsupported` | Every report keeps executable compatibility not assessed and Run disabled; no guest code was executed |

Exact commands, fixture hashes, browser scope and exclusions are in
[Prompt 2 evidence](evidence/prompt-2.md) and [analyzer notes](analyzer.md).

## Package import evidence — Prompt 3

| Capability | Status | Observed scope |
| --- | --- | --- |
| ZIP normalization, stored/Deflate payloads and CRC validation | `verified` for the documented subset | Authored DOS-header/mixed packages, companions and empty files/directories retained; every DOS package file hash matches through a real browser worker |
| Folder and multiple-file intake | `verified` | Native Chrome folder picker preserves selected-root paths; multiple explicit files share the same virtual package contract |
| Candidate choice and resource explorer | `verified` | No automatic entrypoint; reasons, installer cautions, resource hints, per-file reports, pagination/filtering and keyboard choice |
| ZIP path and resource defenses | `verified` for the tested corpus | Traversal, absolute paths, collisions, links, corrupt/CRC failures, output/count/ratio limits rejected; nested archives remain opaque |
| Local-only import and temporary package | `verified` for the recorded browser tests | Page/worker requests contain no selected names or bytes; no user storage or script execution; completed workers terminate |
| Runtime acceptance from an imported package | `unsupported` | Byte preservation proves intake only. No guest has consumed these files or run an imported executable |

See [Prompt 3 evidence](evidence/prompt-3.md), [import scope/limits](package-import.md)
and [fixture hashes](evidence/prompt-3-fixtures.json). Folder picker limitations,
unsupported ZIP features and unmeasured browser peak heap remain explicit.

## Compatibility planning and profiles — Prompt 4

| Capability | Status | Observed scope |
| --- | --- | --- |
| Deterministic six-state planner and adapter registry | `verified` for the recorded tests | Explicit DOS COM/MZ and Windows NE/x86 PE32 rules; automatic suggestion separated from override; installed assets, version pins, missing references and actionable issues |
| Local launch-profile round-trip | `verified` | Real Chrome desktop/emulated mobile export/import, strict closed JSON schema, requested controls/mounts/limits and unresolved drafts; no file contents or verification assertions |
| Unsupported and invalid recovery | `verified` for the synthetic corpus | ELF, arbitrary EXE/MSI/Mac input, ISO/IMG and PE32+ retain Inspect/profile export; corrupt header and unsafe profile diagnostics; mixed archives require choice |
| Exact observed-launch evidence matching | `verified` contract tests only | Full package/chunk identity, runtime assets, profile and browser scope; forged identities and mismatches denied using unit-only records |
| Executable compatibility / installed engines | `planned` | Both production adapters remain unavailable; the observed-launch catalogue is empty; no real program can receive `verified-compatible` |
| Disk-image boot/mount environments | `unsupported` | Typed allow-list exists but has no production entries. Synthetic matching tests do not prove a guest OS boots |

See [Prompt 4 evidence](evidence/prompt-4.md) and [decision/profile rules](compatibility-planning.md).
The per-file `experimental` planning state for a Win16 candidate does not upgrade
the planned, absent adapter's capability maturity. At the end of Prompt 4, no
runtime was installed; Prompt 5 changes DOS availability below.

## DOS runtime evidence — Prompt 5

| Capability | Status | Exact observed scope |
| --- | --- | --- |
| Lazy emulators 8.5.3 / classic DOSBox worker | `experimental` | Actual WebAssembly worker, RGB/RGBA framebuffer, generated DOS configuration, temporary whole-package C: mount; engine loads only after Start |
| FreeDOS MEM 1.12, single `MEM.EXE` | `verified` | Real memory report, keyboard reinvocation, redirected 747-byte report exported, three fresh launch/input/stop cycles on each tested layout |
| FreeCOM 0.86 in `FREECOM.ZIP` | `verified` | Real shell banner, selected `APP/COMMAND.COM`, support-file read/copy, 16-byte guest-written output export, three fresh launch/input/stop cycles per layout |
| Audio | `verified` stream delivery; `experimental` playback breadth | AudioContext enabled by click, real nonzero PC speaker samples after BEL; human listening/music/device timing unverified |
| Mouse | `experimental` | Absolute event forwarding exercised; no claim that a mouse-driven DOS application works; pointer lock remains browser-dependent |
| Stop, navigation cleanup and recoverable errors | `verified` for these cases | Real worker exit, zero remaining workers, fresh filesystem on relaunch, missing assets can retry; IPXNET abort cleaned up without exposing raw guest logs |
| Locality / offline relaunch | `verified` for recorded production traces | Fixed same-origin assets only, opaque frame/worker, no selected names/bytes in requests, no sockets or persistent user data; both real fixtures relaunch offline |
| Windows, disk booting, live import, persistence | `unsupported` in this stage | No enabled implementation; no inherited DOS evidence |

Scope: Chrome 157.0.8103.79 on macOS 26.6.2 / arm64, desktop plus Pixel 7 layout
emulation. The latter is not a physical Android run. Runtime pins, fixture hashes,
settings, exact commands/output, timings and limitations are in
[the Prompt 5 evidence record](evidence/prompt-5.md) and [DOS guide](dos-runtime.md).
IPXNET with networking disabled aborts the backend; recovery passes, guest networking
stays disabled. The runtime remains experimental for any untested program/configuration.

## Boxedwine trial evidence — Prompt 6

| Capability | Status | Exact observed scope |
| --- | --- | --- |
| Boxedwine 25R1 engine/bootstrap | `experimental` | Official pinned JS/WASM initialized in real Chrome; Emscripten memory FS accepted and returned an original text file and preserved an empty directory |
| Missing Wine environment and frame disposal | `verified` for this failure only | Three engine-only cycles return `Could not find /bin/wine` and `Boxedwine shutdown`; detached frames leave no worker. This is not clean shutdown of a running Windows application |
| Shared Windows intake/report/profile/player gate | `verified` for the test corpus | Single PE32/NE, ZIP/folder intake, candidate choice, immutable blockers, override/import rejection and local export; no Windows engine requests, framebuffer or fabricated running state |
| General Win32 execution | `experimental`, disabled | Unadopted Wine 6.0 filesystem lacks the required retained source/license inventory; bundled Notepad is a PE placeholder backed by ELF, not the standalone test fixture needed |
| Win16, Windows input/audio/live I/O/clean stop | `planned` | Not tested; no inherited proof from engine bootstrap or DOS results |
| DOS regression | `verified` for the same exact fixtures | MEM and FreeCOM actual output/input/export/stop/relaunch, offline and recoverable-error checks repeated; switching from Windows import to MEM also passes |

The audit, pins, test commands, limitations and follow-up are in the
[Boxedwine guide](boxedwine-runtime.md) and [Prompt 6 evidence](evidence/prompt-6.md).
No Boxedwine engine/guest binaries are shipped. No Windows program is claimed to run.

## Workspace and document evidence — Prompt 7

| Capability | Status | Exact observed scope |
| --- | --- | --- |
| DOS live document import and export | `verified` for FreeCOM 0.86 / emulators 8.5.3 / Chrome 157 | New DOC.TXT enters C: through fsWriteFile, TYPE/ECHO produces RESULT.TXT, fsReadFile exports exact modified bytes. Input is real guest keyboard input; duplicate names cannot overwrite existing files |
| Manual working snapshots | `verified` for this fixture/configuration | Capture copies actual closed/saved guest files; Stop retains the capture in app memory; re-launch overlays copies without modifying the selected application. Later guest edits require a new capture |
| Opt-in OPFS software/profile/working files | `verified` for the recorded browser | Explicit choices only; saved FreeCOM package, profile and RESULT.TXT survive reload; stored bytes are hash checked, software re-inspected, saved candidate retained, no automatic start |
| Profile-only restore | `verified` for the recorded browser | Backup contains only two JSON files, software references have no chunk data, originals must be selected before launch. Schema/runtime-pin validation is not program verification |
| Storage isolation and recovery | `verified` within tested cases | Different host origins cannot see each other's workspace. Injected quota-preflight failure and corrupted native OPFS file reject replacement/restore. Denied/missing API retains temporary processing. Delete removes only the saved workspace |
| Temporary mode and locality | `verified` within recorded traces | No OPFS workspace before opt-in; no user names/bytes/hashes in traffic. Production CSP, opaque worker, disabled networking and offline DOS regressions retained |
| Persistence permanence, VM suspend/resume, automatic saves | `unsupported` | Browser storage may be cleared/evicted; no durable retention claim, account, cloud upload, automatic exit snapshot or running-machine serialization |
| Windows document transfer/storage-backed execution | `unsupported` | Boxedwine stays disabled; storing a Windows package/profile cannot enable its runtime |

See [workspace protocol and reproduction](workspace.md) and [Prompt 7 evidence](evidence/prompt-7.md).
Verification remains scoped to the fixture, exact runtime assets/configuration and
recorded Chrome platform. Static format detection, manifest integrity and a successfully
restored profile never populate the `verified-compatible` catalogue. Other browsers,
real phones, long-term retention and power-loss recovery are unverified.

## Status and evidence rules

| Capability status | Meaning |
| --- | --- |
| `planned` | A scoped design exists, but no implementation/evidence yet. Not available to users. |
| `experimental` | An implementation or integration trial exists with recorded partial results or limitations. Requires an explicit opt-in, or remains disabled if unsafe/unusable. Research alone is not experimental support. |
| `verified` | The specific claimed behavior passed recorded tests. Static recognition requires real parser tests and browser inspection; execution requires a real PHANTOM browser run for an exact program/package, runtime/configuration and browser. |
| `unsupported` | No usable path is offered in the current scope, or the operation is inapplicable. This does not claim that no upstream emulator could ever handle it. |

Keep **recognition/ingestion maturity** and **execution maturity** separate. A
verified ZIP parser does not execute ZIPs. A verified PE parser does not implement
Windows APIs. Never report “all DOS” or “all Windows” verified from a single test.

Per-file launch decisions are another axis: `invalid`, `unsupported`, `needs-files`,
`candidate`, `experimental`, or `verified-compatible`. A planned runtime is absent
and cannot launch; a matching signature can only identify a future candidate.
`verified-compatible` requires a matching recorded run, not a confidence threshold.

## Format and execution scope

Recognition verification is limited to the corpus and implemented checks, including
FreeCOM's legacy overlapping MZ relocation table; it is not general program validation.
The DOS rows now have the bounded implementation and exact guest evidence below.

| Format/family | Recognition / ingestion | Implemented static scope / exclusions | Execution | Target and boundary |
| --- | --- | --- | --- | --- |
| DOS raw COM | `verified` ambiguity handling only | A small `.com` is an ambiguous hint; no universal magic or code validity is claimed | `experimental` | Installed DOSBox path requires explicit DOS context, entrypoint and reviewed profile; no raw COM fixture is verified yet |
| DOS MZ executable | `verified` header subset | MZ structure, DOS declared sizes, relocation bounds and secondary pointers; LE/LX remains partial | `experimental` | MEM 1.12 and FreeCOM 0.86 verified only for the configurations/browser below; PE/NE/LE/LX stubs and arbitrary DOS extenders remain unproven |
| 16-bit Windows / OS/2 NE | `verified` limited probe | Fixed NE header, selected table/segment bounds and declared Windows versus OS/2 target; recognition confidence remains probable | `planned` | Separate Boxedwine/Wine candidate; no Win16 execution fixture or guest browser evidence yet; Win32 success cannot promote this row |
| 32-bit x86 Windows PE32 | `verified` header subset | Signature, optional kind, machine, subsystem, entrypoint bounds, alignments and section ranges; no dependency/code validation | `experimental`, disabled | Boxedwine 25R1 engine-only trial; no Windows application launched. Audited Wine filesystem and standalone PE fixture are still required; DLLs, installers, drivers, .NET and imported APIs are not guaranteed |
| Windows PE32+ / non-x86 PE / MSI | `verified` PE32+/selected machine reporting; `unsupported` MSI semantics | PE kind and machine are separate facts; x86-64 and ARM64/EFI declarations tested; no architecture-wide or installer compatibility claim | `unsupported` | No 64-bit Windows, other-architecture Windows, MSI installer or kernel-driver execution path in MVP |
| ELF / Linux | `verified` header subset | ELF class/endianness, machine, type, declared ABI and table bounds; extended counts partial; no interpreter/dependency decoding | `unsupported` | Recognition does not supply a Linux kernel, loader, libc or needed libraries. Boxedwine's internal Linux environment is not a promised general ELF service |
| Classic Mac 68K / PowerPC | `unsupported` | Dedicated classic Mac recognition and preservation of forks/container metadata are deferred | `unsupported` | No Mac adapter, ROM/OS entitlement review or fixture. Classic code/resources must not be confused with a modern Mach-O executable |
| Modern macOS Mach-O / app bundle | `unsupported` | No parser committed to this stage | `unsupported` | Outside MVP; an `.app` suffix is not a cross-platform executable format |
| ISO 9660 disk image | `verified` selected descriptors | CD001, primary descriptor, size/endian copies and root-record bounds at 2048-byte sector offsets; no filesystem traversal | `unsupported` | No mount/boot path in MVP; optional v86/full-machine work is deferred and would require a licensed guest environment |
| Raw IMG / floppy or hard-disk image | `verified` signature/ambiguity handling only | MBR range candidates, GPT signature/fixed fields at 512/4096 (partial without CRC/backup checks), bare 55 AA ambiguity; no FAT or extended-partition decoding | `unsupported` | No universal IMG signature; even a recognizable boot sector does not prove a bootable/compatible OS |
| ZIP / ZIP-based application bundle | `verified` bounded stored/Deflate import | Central/local paths and sizes, CRCs, streamed limits, normalized files/directories and explicit candidate choice; no execution or ZIP subtype promise; ZIP64, encryption, links and multi-volume import rejected | `unsupported` as a direct executable | The selected contained DOS entrypoint can use the experimental adapter; Windows remains disabled. Preserve companion files. Never execute autorun or supplied emulator config during import |
| RAR / 7z / tar / encrypted or nested archives | `unsupported` | Outside initial unpacker scope; report explicit unsupported input rather than guessing contents | `unsupported` | Ask the user to extract locally and select files/folder. No remote extraction service |
| Unknown, truncated, corrupt or misleadingly named data | `verified` corpus handling | Unknown/invalid evidence and human-readable diagnostics with bounded reads; selection can be replaced or cleared | `unsupported` | No execution-based repair; no report/file export feature is claimed at this stage |

Parser implementation references: Microsoft's [PE format specification](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
describes the DOS stub, secondary signature and PE fields; the
[ELF header specification](https://gabi.xinuos.com/elf/02-eheader.html) describes
class, byte order and machine fields. These structures cannot establish runtime
library availability or successful launch. Apple's [Segment Manager documentation](https://developer.apple.com/library/archive/documentation/mac/pdf/Processes/Segment_Manager.pdf)
explains classic code resources; [file I/O porting guidance](https://developer.apple.com/library/archive/documentation/Porting/Conceptual/PortingUnix/io_porting/io_porting.html)
explains why old resource forks must be preserved.

## Runtime evidence ledger

| Candidate runtime | Upstream evidence | PHANTOM status | What is missing |
| --- | --- | --- | --- |
| js-dos / `emulators` | [Embedding API](https://js-dos.com/emulators.html) documents DOS backends, workers and filesystem inputs | `experimental` | Two DOS fixture runs recorded in Chrome and pinned Playwright Firefox; broader apps, stock Firefox/Safari, physical mobile devices, source rebuild and release-license gate remain outstanding |
| Boxedwine + Wine | [25R1 source](https://github.com/danoon2/Boxedwine/tree/9279ab115e3c1e513aca4ea95aa30ea2f65258be) and [web build](https://github.com/danoon2/Boxedwine/releases/tag/25R1.0) investigated; actual engine-only browser probe recorded | `experimental`, disabled | Retained component source/license inventory, usable PE fixture and actual Windows framebuffer/input/stop/I/O/network tests. Wine 6.0 web root is not the native release's Wine 10.0 |
| v86 | [Upstream project](https://github.com/copy/v86) provides a possible full-machine route | `unsupported` in MVP | Separate optional feasibility prompt, BIOS/guest licensing and exact boot/mount tests |
| Classic Mac runtime | No runtime selected | `unsupported` in MVP | Emulator selection, fork preservation, legally usable ROM/OS/fixtures and actual execution evidence |

There is **one enabled experimental runtime** (DOS) and a disabled Windows adapter
with engine-only trial evidence. The verified application scope is the
following exact fixture behavior; it does not promote the general DOS family.
The production automatic verified-launch catalogue remains empty, so imported
profiles/names/confidence cannot claim `verified-compatible`.

## Lawful fixture plan

The following are named open-source candidates with inspected primary provenance.
They are legally redistributable/usable under their applicable terms, including
notices and source obligations. The two DOS fixtures are now retained with their
official source packages, licenses and [exact hashes](../vendor/dos/manifest.json);
Windows remains unverified; the reviewed Notepad placeholder is not retained as a
fixture. [Reproduction instructions](../tests/fixtures/dos/README.md)
identify immutable binary bytes rather than treating a moving source link as provenance.

| Fixture | License / source basis | Planned test | Current status |
| --- | --- | --- | --- |
| **FreeDOS MEM (`MEM.EXE`)** — single-file DOS case | [Upstream source](https://github.com/FDOS/mem), [package metadata](https://github.com/FDOS/mem/blob/master/doc/mem.lsm) declares GPL; inspect the selected release's full license/source when packaging | Select the actual DOS binary through PHANTOM, verify header evidence, launch it, observe its memory report, then type a second invocation at the guest prompt; stop/relaunch | `verified` for MEM 1.12 / this pinned DOSBox build / recorded Chrome and Playwright Firefox configurations in [current results](compatibility-results.md) |
| **FreeDOS FreeCOM (`COMMAND.COM`)** — DOS ZIP and file-I/O case | [Upstream](https://github.com/FDOS/freecom), [metadata](https://github.com/FDOS/freecom/blob/master/command.lsm) specifies GPL v2, with [license text](https://github.com/FDOS/freecom/blob/master/license) | A project-authored ZIP contains the lawful shell, required companion files and a small original text fixture. Select its entrypoint, start the real FreeCOM shell, read the text and write an output file; export from the running DOS session | `verified` for FreeCOM 0.86 / this pinned DOSBox build / recorded Chrome and Playwright Firefox configurations in [current results](compatibility-results.md) |
| **Wine Notepad (`notepad.exe`, x86 PE32 build)** — Windows case | [Wine's implementation](https://github.com/wine-mirror/wine/blob/master/programs/notepad/main.c) has an LGPL-2.1-or-later grant. Use a build from the same audited Wine source/filesystem version as the Boxedwine trial; no Microsoft Notepad binary is needed | Select/mount the fixture through PHANTOM, observe actual window output, type `PHANTOM WINDOWS OK`, save a file where the adapter allows, stop and relaunch. Record the actual PE machine/kind and package hashes | `planned`; no chosen build, browser run or claim of Win16 coverage |

For FreeCOM, the recorded interactive check uses its own shell to run commands such
as `TYPE APP\INPUT.TXT`, `ECHO PHANTOM DOS OK>OUTPUT.TXT`, and `TYPE OUTPUT.TXT`.
Record the actual invocation and resulting file bytes when executed. A DOSBox
built-in shell alone does not count as launching the FreeCOM fixture. MEM and
FreeCOM are two different programs, not two wrappers around a synthetic output.

For Windows, an upstream/native `wine notepad` smoke check can guide investigation
but cannot pass the PHANTOM browser intake test. Confirm that the test artifact is
the intended x86 PE32 executable, not merely an ELF Wine helper. Any required
Wine libraries, fonts and filesystem content need their own license inventory.
The chosen Wine Notepad can establish one Win32 case only; acquire a separately
licensed NE/Win16 fixture before making a Win16 execution claim.

Prompt 2 includes original **parser-only** fixtures for MZ/NE/PE/ELF headers, misleading
extensions, raw COM ambiguity, ZIP records and selected disk signatures, plus corrupt
variants. See [fixture instructions](../tests/fixtures/README.md). Prompt 3 adds original package fixtures, traversal/case collisions and decompression limits,
plus real browser worker checks of preserved file hashes. None of these
parser data files satisfy runtime acceptance or represent working legacy programs.

## How a result becomes verified

Create an evidence record only after running the relevant test. It must include:

- Date/tester, PHANTOM commit, browser/version, OS and relevant hardware details.
- Program name/version, source URL, license, exact binary/package SHA-256 and
  companion-file hashes; runtime JS/WASM/worker/filesystem versions and hashes.
- Entry point, working directory, args, mount layout, settings and limits.
- Recognition result **separately** from launch outcome and expected/observed output.
- Keyboard/mouse/audio results individually; mark untested operations untested.
- Import/export expected and actual bytes or hashes; persistence/reload result if
  claimed; stop/relaunch and failure behavior.
- Browser test command or exact manual steps, logs/trace, genuine framebuffer
  capture where useful, network observation and performance measurements.
- Remaining limitations and failure cases; reproduction steps for another tester.

Runtime-ready events, nonempty canvases, successful library calls and screenshots
alone are insufficient. Require an actual program-specific result and meaningful
input. For a file-writing case, confirm the changed bytes come from the guest VFS.
Use [the product's measurable gates](product-spec.md#measurable-acceptance-targets).
Public/committed evidence uses licensed fixtures, never private imported software.

Record evidence under `docs/evidence/`; the original DOS observations are in
[Prompt 5](evidence/prompt-5.md), and DOS regression plus the disabled Windows
trial are in [Prompt 6](evidence/prompt-6.md); storage and document observations
are in [Prompt 7](evidence/prompt-7.md). Update
only the exact tested row/scope. Keep unsupported and failed cases visible. A
runtime/fixture/configuration change invalidates the old verification match until
retested; it does not silently inherit success.
