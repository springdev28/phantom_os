# PHANTOM OS product specification

Audit date: **2026-11-21**. Current stage: **Prompt 11 — truthful submission preparation** (2026-11-22).
The initial Prompt 0 audit is retained below as historical evidence. See
[Prompt 10 evidence](evidence/prompt-10.md), [Prompt 9 security evidence](evidence/prompt-9.md), [Prompt 8 interface evidence](evidence/prompt-8.md), [Windows trial](evidence/prompt-6.md) and the retained
[DOS acceptance evidence](evidence/prompt-5.md) for the current implemented scope.

## Starting evidence

The source brief is [PHANTOM OS: Codex Build Playbook and Sequential Prompts,
version 1.0](https://docs.google.com/document/d/1NzFk3ftcyBY2784VDaZYNhEXbbeqAuu--hMB7eIl1-4/edit).
It was read through the Google Drive connector, including the sequential prompts
and acceptance matrix. Prompts 0 through 7 are complete; Prompt 8 is implemented
with human usability validation pending. Prompt 9 hardens the existing boundaries;
Prompt 10 adds compatibility validation. Prompt 11 prepares Kiro working artifacts,
license/source review and submission materials. Actual Kiro work, runtime release
clearance, hosted HTTPS acceptance and public video remain separate evidence gates.

| Inspected item | Finding before this change | Consequence |
| --- | --- | --- |
| Local working tree | Only `.git/`; `git ls-files --cached --others --exclude-standard` returned no files | No existing implementation to preserve or validate |
| Local Git history/configuration | Unborn `master`; no commits; `git remote -v` returned no remotes | The workspace was not a checkout of an existing remote implementation |
| [GitHub repository](https://github.com/springdev28/phantom_os) | Metadata reported size 0 and default branch `main`; the contents endpoint returned HTTP 404 with “This repository is empty.” | Remote emptiness was checked independently of local state |
| README and AGENTS.md | Absent; no applicable ancestor AGENTS.md found | Establish project rules and a documented starting point |
| Package manifests and lockfiles | Absent | No installed or selected application dependency versions |
| Source, assets, runtime binaries, scripts, tests and CI | Absent | No parser, UI, storage implementation, emulator integration, or runnable test command |
| Browser execution evidence | None; no app exists to run | **Zero verified runtime integrations or compatible programs** |

Prompt 0 created `AGENTS.md` and the three requested documents. Prompt 1 adds a
Vite/React/TypeScript frontend, local selection/readability checks, domain contracts
and tests. Prompt 2 adds bounded local signature analysis and evidence reports.
Prompt 3 adds bounded ZIP/folder intake, preserved virtual files, resource hints
and explicit entrypoint choice. No program is started during import.
Prompt 4 adds deterministic planning and profiles. Prompt 5 adds a pinned classic
DOSBox worker through emulators 8.5.3. MEM 1.12 and FreeCOM 0.86 now execute
through the real browser player, accept keyboard input, export guest-written files
and stop/relaunch. The wider journey below still contains future work; Windows
and disk booting remain unavailable. Prompt 7 adds live DOS file import/export,
explicit working-copy capture and opt-in OPFS saves with restore/backup/delete.
Prompt 6 adds a disabled Boxedwine adapter and real engine-only bootstrap/mount/failure tests.
It takes the permitted unverified outcome: no Windows application has run. The
Wine filesystem inventory and standalone PE fixture are concrete blockers, exposed
in Compatibility and Player with inspection/profile export retained.
Prompt 8 adds a distinct Configure screen, public demo selection, copy/download
reports, actual focus/full-screen controls and in-app guest file-export instructions.
Keyboard capture begins only on a focus action. Status definitions and the current evidence ledger live in
[compatibility-matrix.md](compatibility-matrix.md).
Prompt 9 adds shared enforced preview/production security policies, streamed runtime
asset limits, validated guest replies, silent-worker liveness checks and pagehide
disposal. The [security model](security.md) keeps residual risk and browser limits explicit.
Prompt 10 adds the [reproduction protocol](compatibility-testing.md), Chrome/Firefox
production core tests, seeded input invariants, CI and recorded laptop measurements.
Automated correctness, performance targets and independent manual validation remain
separate outcomes; failures are retained in the evidence instead of reclassified.

## Product and audience

PHANTOM OS will let someone bring a lawfully obtained legacy application, inspect
its real contents locally, understand its requirements, and try it in an appropriate
browser runtime. Its value is the coherent inspection, planning, execution, and
file-recovery workflow across existing runtimes.

The first user is a person trying to open a small DOS utility or application with
its supporting files. The next is a person testing a simple legacy x86 Windows
application. Both need an honest explanation when execution is unavailable. The
primary task ends with an actual program session and an exported result, or a
useful unsupported/needs-files report that preserves the selected originals.

## Required user journey

| Step | User action and product behavior | Failure or uncertainty handling |
| --- | --- | --- |
| 1. Open | Home has one dominant **Open legacy software** action; ZIP/folder selectors and audited demos are secondary; multiple selected files and relative folder paths are retained. Explain temporary local processing. Explicit demo selection fetches only the fixed public MEM/FreeCOM asset. | Cancelling returns to idle. No account or broad host filesystem permission is required. |
| 2. Inspect | Read bounded file bytes locally. Show format evidence, architecture when known, size, and uncertainty. A filename is a hint, not a verdict. | Invalid/truncated data yields a readable diagnostic. A raw COM may remain ambiguous. Users can inspect/export without running. |
| 3. Choose entrypoint | Show the normalized package tree and candidate programs with reasons; preserve relative resources. Require a choice for ambiguous packages. | Do not execute the first EXE, an installer, an autorun file, or archive-supplied configuration automatically. Explain missing companions. |
| 4. Understand compatibility | Show recognition separately from installed engine status, requirements, candidate status, and prior test evidence. Explain automatic adapter selection; allow a distinct user override. | “PE32 detected” is not “Windows application verified.” Missing declared files, ambiguous entrypoints, unsupported formats and corrupt inputs have different explanations. |
| 5. Configure | Review requested controls, working directory, mounted paths and limits. Export/import a local JSON profile with relative references, no program/document contents. Unavailable runtime versions stay null. Future launches must bind a pinned build. | A user override or imported profile cannot invent an adapter, waive checks or grant verification. Restore original files separately; present file references do not prove library compatibility. |
| 6. Run | On explicit Run, prepare the virtual filesystem and start the real runtime. Display its framebuffer; route keyboard/mouse and available audio. Show focus, release-input, stop, and recoverable errors. | Keep launch/download/crash errors visible. No synthetic player output. An untested Windows path stays disabled or explicitly experimental. |
| 7. Bring in and recover work | Import a selected document into the guest filesystem; export actual changed files. Label live transfer versus export-after-stop according to the adapter. | Do not show a working export button for an unsupported operation. Preserve a recoverable snapshot where possible and explain failures. |
| 8. Stop and return | Stop cleanly, release input/audio/workers, then offer a local profile. Persist packages only by opt-in. Reload a saved workspace or request originals again. | Browser storage is quota-limited and evictable. Offer backup and deletion; do not promise permanent retention or silently discard unsaved work. |

Minimal UI progression: **Home → Inspect → Compatibility → Configure → Run (Player) →
Workspace**. Shared state must distinguish idle, selected, inspecting, ready,
unsupported, preparing, running, stopped, and error. “Ready” means the user has
a valid next action; it does not mean the program is verified-compatible.

## Scope and non-goals

The first runnable slice is DOS through js-dos, using the common intake and
adapter boundary. The MVP target adds a distinct Boxedwine/Wine Windows path
**only if proven**, local file import/export, optional workspace persistence, and
honest unsupported states. If Windows remains unverified, describe the release as
a DOS-first preview with Windows experimental or unavailable, not a proven
cross-platform runner.

Non-goals for this build:

- Universal execution of arbitrary EXE, COM, MSI, ELF, Mac applications, or disk
  images; a scanner result never establishes that promise.
- A new emulator, operating system, native compatibility layer, or emulation novelty
  claim. Reuse js-dos and Boxedwine.
- Server-side execution, remote upload, accounts, cloud synchronization, guest
  networking, remote disk streaming, or native host helpers.
- Bundled proprietary Windows/Mac OS images, unlicensed BIOS/ROMs or software,
  DRM circumvention, or an abandonware download catalogue.
- 64-bit Windows, general Linux execution, full-machine boot, classic Mac execution,
  modern macOS execution, and complex installer/.NET/driver compatibility in the MVP.
- A themed pretend desktop, fake terminal output, placeholder product screenshots,
  chatbot, generated compatibility narrative, or unrelated AI features.
- Perfect hostile-code isolation or permanent browser storage. The implementation
  must expose its actual boundaries and measured limits.

## Smallest viable build order

Follow the playbook's prompt numbers. Each row is a separate future task and must
pass its gate before the next starts. Do not build the whole roadmap from Prompt 0.
License review precedes adding each dependency or runtime asset.

| Prompt | Smallest useful increment | Exit gate |
| --- | --- | --- |
| 0 — complete | Four documentation files; evidence-based scope, contracts, rules, matrix, license plan | Every required format has separate recognition/execution status; lawful DOS/Windows fixtures are named; no implementation claims |
| 1 — complete | One Vite/React application with strict TypeScript, domain contracts, state machine, accessible file selection and empty/error screens | Install/dev/build/typecheck/lint, 20 unit tests and 12 browser smoke tests pass; real Chrome selection advances through actual UI states with zero console errors; execution remains unavailable |
| 2 — complete | Bounded byte inspection of COM ambiguity, MZ, NE, PE32/PE32+, ELF, ZIP and selected ISO/MBR/GPT signatures | 65 unit tests and 20 desktop/mobile Chrome tests pass; reports differ by content and expose evidence; analysis causes zero requests after the Inspect screen loads; Run remains disabled |
| 3 — complete | Local ZIP/folder intake and entrypoint choice | Single/multiple-entrypoint, support-file, empty/corrupt ZIP and traversal/bomb fixtures pass; actual worker byte preservation and local-only browser import recorded in [Prompt 3 evidence](evidence/prompt-3.md) |
| 4 — complete | Deterministic planner, adapter registry, versioned launch profile | Unknown, missing-files, uninstalled-runtime, Win16/Win32, PE64 and ELF cases remain distinct; no verification from signatures; JSON profile round-trip preserves settings without embedding binaries; see [Prompt 4 evidence](evidence/prompt-4.md) |
| 5 — complete | One real js-dos adapter, lazy assets, framebuffer/input/stop and recoverable failures | Two lawful DOS programs: one single executable and one multi-file ZIP. Both execute, respond to input, stop and relaunch in PHANTOM OS; fixture and network evidence recorded |
| 6 — complete, Windows unverified | Bounded Boxedwine 25R1 browser trial targeting Wine Notepad | Engine-only memory staging and missing-Wine shutdown recorded. Filesystem provenance/fixture blockers keep Windows disabled; DOS regression and Windows gating tests recorded in [Prompt 6 evidence](evidence/prompt-6.md) |
| 7 — complete | File transfer plus opt-in OPFS workspace with temporary fallback | Actual FreeCOM document bytes export; opt-in saved package/profile/document restores after reload; profile-only requires originals; quota/denial/corruption/isolation/deletion checks in [Prompt 7 evidence](evidence/prompt-7.md) |
| 8 — implemented; human validation pending | Refine the same journey, keyboard access, focus and clear copy; [browser evidence](evidence/prompt-8.md) | A new tester reaches a real DOS session within 60 seconds under the warm-asset protocol below, identifies an unsupported example, and exports a result |
| 9 — implemented | Harden parsers, extraction, runtime boundaries and networking; [security notes](security.md) | Malformed/oversized input, traversal, refresh, forced stop, no-storage and offline cases; actual outcomes and network traces in [Prompt 9 evidence](evidence/prompt-9.md) |
| 10 — implemented; see recorded limits | Reproducible compatibility and performance suite | Clean source install, Chrome/Firefox core runs and laptop measurements are recorded in [Prompt 10](evidence/prompt-10.md); independent manual results remain separate |
| 11 | Accurate README, final license/source bundles and genuine release/demo evidence | Only observed features are advertised; any hosting, Kiro work or submission is a separate authorized stage with current rules checked then |
| 12 — deferred | At most one optional full-machine or classic Mac feasibility study | Separate provenance, license and execution evidence; no automatic scope expansion |

The first useful execution milestone is Prompt 5. Prompt 6 must not expand into
general Windows compatibility research at the cost of that DOS path. A documented
failed Windows trial is an allowed outcome in the source playbook; it is not a
Windows compatibility pass.

## Measurable acceptance targets

These are product targets; the completed subset is recorded in
[Prompt 10 evidence](evidence/prompt-10.md). Twenty-run p95, Chrome shaped cold-network,
Firefox and sampled browser-process memory now have explicit measurement scope there.
Independent usability remains **not verified**. Until evidence exists, display
“not measured.” Record OS, CPU/RAM, browser/version, app commit, runtime/fixture
hashes, asset cache state, network settings, and elapsed times for every benchmark.
Use one documented laptop with at least 8 GB RAM and no CPU throttling. Warm tests
have runtime assets cached and network disabled. Cold tests use an empty cache
and a recorded 20 Mbit/s, 50 ms RTT network profile. Report cold downloads separately
from guest startup; do not hide them inside the warm metric.

| Area | Required measurement/pass criterion |
| --- | --- |
| Inspection correctness | 100% of the committed format, ambiguity and malformed-input corpus returns its expected result without an uncaught exception; no fixture is auto-run during inspection |
| Small-file inspection | For the fixture set up to 1 MiB, selection-to-report p95 ≤ 500 ms over 20 warm runs; larger packages have cancellable progress and obey the declared limits |
| DOS execution | Both named DOS cases pass 3 consecutive launch → meaningful input → stop → relaunch cycles per tested browser; stop releases the session within 2 seconds |
| Launch latency | For the small DOS fixtures, Run-to-observed guest output p95 ≤ 5 seconds over 20 warm runs; record cold total time and asset bytes without asserting an unmeasured cold target |
| Windows evidence | At least one exact Wine Notepad/Boxedwine combination passes 3 consecutive cycles with real typed text, or Windows remains explicitly unverified with the failure recorded; Win16 requires its own future fixture |
| File recovery | Import a known text file, change it in the guest, export it, and compare the resulting bytes to the expected result; no application-side substitute for the guest write |
| Persistence | Opt-in package/profile/output survives a reload; temporary mode creates no persistent user-data entry; deletion removes that workspace; quota failure preserves export access |
| Privacy | Zero requests carrying selected-file names, contents, paths, hashes or derived data; runtime traffic matches a fixed static-asset allowlist; a cached session runs with external networking blocked |
| Browser coverage | Real Chrome and Firefox results for the core DOS journey; exact versions recorded. Safari/mobile remain unverified until separately exercised |
| Usability | At least 3 of 3 first-time testers reach a supplied DOS fixture's interactive state in ≤ 60 seconds with warm assets, and export a result in ≤ 120 seconds, using only in-app guidance |
| Licensing | Every distributed third-party artifact has a pinned origin, hash, license/notice entry and required corresponding source/build material; zero unreviewed guest OS/ROM/application binaries |

Record peak memory where the browser exposes a reliable measurement, guest memory
settings, runtime transfer size, and retained workers after stop. Do not invent a
portable browser-heap measurement or pass a memory budget using missing data.
Initial conservative processing limits are specified in [architecture.md](architecture.md).

## Current blockers and next stage

Prompt 5 acceptance passes for the two exact DOS fixtures in Chrome on macOS and
Chrome mobile-layout emulation. General DOS compatibility remains experimental;
no automatic `verified-compatible` claim is emitted for new selections. Initial
asset downloads use fixed local URLs; offline relaunch after loading is tested.
Read [the runtime guide](dos-runtime.md) and [recorded outcomes](evidence/prompt-5.md).

The first adapter accepts DOS 8.3 paths, a package up to 32 MiB and a writable
temporary whole-package C: mount. Input uses US physical key codes; browser
shortcuts are reserved. Audio requires an explicit click. IPXNET with networking
disabled aborts this pinned backend; PHANTOM releases it and supports relaunch.
Uncaptured guest changes are discarded on stop/navigation/reload. Capture makes a
temporary working snapshot; explicit Workspace Save can retain it with a validated
profile and optionally the software. Browser eviction remains possible. See the
[actual storage/document journey](workspace.md). The Windows trial stays disabled;
disk environments have no enabled execution path.

The earlier bounded parser/ZIP/profile limitations remain in [analyzer notes](analyzer.md),
[package import](package-import.md) and [planning rules](compatibility-planning.md).
The runtime/source inventory is retained, but public distribution remains gated
on the final compatible project-license decision and upstream source rebuild.
No public deployment is part of Prompts 5–10.

Prompt 6 reached the allowed disabled outcome. The stock web filesystem lacks the
required source/license inventory, and its Notepad PE is a placeholder backed by
an ELF module. The actual engine probe reaches a missing-Wine failure, never a
Windows running state. See [the audit and follow-up](boxedwine-runtime.md).

The supplied-demo UI journey and file export pass automated Chrome checks; Prompt
10 adds actual Firefox DOS launch, input, file I/O and cleanup observations. The
3-of-3 novice usability protocol and assistive-technology speech checks are **not yet
verified**; see [the audit and tester protocol](accessibility-audit.md). Automated
loopback timings are not cold-network or warm human timings.

Next roadmap stage, only when requested: **Prompt 11**, or a separately authorized
Windows follow-up. This does not waive the outstanding human validation. Preserve
the DOS path and keep Windows disabled until its own launch gates pass.
