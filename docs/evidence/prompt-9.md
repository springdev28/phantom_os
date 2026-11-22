# Prompt 9 acceptance — 2026-11-22

**Implemented: hostile-input regression coverage, shared enforced hosting policies,
bounded runtime downloads, validated guest messages, stricter guest API denial,
refresh cleanup and detection of a silently dead emulator worker.** General DOS
remains experimental; the two existing DOS fixtures retain scoped observations.
Windows remains experimental and disabled. No OS image, emulator or dependency was added.

PHANTOM is **not a secure malware sandbox**. The [security model](../security.md)
describes resource limits, supported platforms and residual browser/emulator escape,
denial-of-service and same-origin supply-chain risks. This is engineering acceptance,
not a penetration test or proof against every possible program.

## Tested environment and pins

- Chrome **157.0.8103.79**, macOS **26.6.2 (25G83)**, arm64 Apple M1 / 16 GiB;
  Node **24.19.0**, npm **11.17.0**. Desktop and Pixel 7 layout emulation in host
  Chrome; no physical phone, Safari, Firefox or other OS verification.
- `emulators` **8.5.3**, upstream commit
  `e6f4e5449a5b17ae3ea0fdccfd453c8d299e9ea5`; classic DOSBox worker. Vendor JS/WASM,
  fixtures, licenses and corresponding retained source are unchanged. Exact engine
  hashes are in the [retained manifest](../../vendor/dos/manifest.json).
- Runtime build ID: `emulators-8.5.3-e6f4e544-dosbox-74394f7d792e`.
  Host SHA-256: `74394f7d792ea8c330217231b6b6d4f223c006b4d4935fb19ee87c51b57e7318`.
  Existing profile/verification pins require explicit review/reset; no silent migration.
- MEM: **15,028 bytes**, SHA-256
  `6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4`.
  FreeCOM ZIP: **88,187 bytes**, SHA-256
  `fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e`.
  [Provenance and reproduction](../../tests/fixtures/dos/README.md).
- Normal profile: temporary writable whole-package C:/ mount; cwd `.`, 64 MiB
  DOS memory, 3000 cycles, core auto, SVGA S3, XMS/EMS on, US keyboard, audio/mouse
  off, 30-minute deadline. The duration regression explicitly selects one minute;
  existing runtime regressions also test enabled audio/mouse and three launch cycles.
- No Git commit/PR/deployment. The repository is still unborn. The
  [114 source/fixture hashes](prompt-9-source-files.json) identify the final tested
  code; [15 changed source/test/configuration files](prompt-9-changed-files.json)
  compare with Prompt 8. Package manifests and lockfile are unchanged.

## Commands and results

The [final full log](prompt-9-check.log) records exit-zero
`caffeinate -dims npm run check`. Caffeinate prevents test-host sleep only; it is
not part of the product and never executes imported programs on the host.

| Command / check | Final result |
| --- | --- |
| `npm run typecheck` | Passed strict TypeScript |
| `npm run lint` | Passed, zero warnings |
| `npm test` | **263 tests / 15 files passed**, including 21 new boundary cases |
| `npm run build` | Passed; existing exact engine/fixture/source inventory verified |
| `npm run test:browser` | **92 passed, 0 failed, 0 skipped, 0 retries**; [all outcomes](prompt-9-browser.json) |
| `npm run test:production` | Passed on the ordinary Vite preview headers; [traffic, policy, storage and asset report](prompt-9-production.json) |
| `npm run dev -- --port 4176 --strictPort --mode test` | Started, served and closed by Playwright |
| Documentation links, source and retained asset hashes | [Final integrity check](prompt-9-doc-check.json) |

`npm install` was not repeated: package/lock bytes are unchanged and its earlier
result remains in [Prompt 6](prompt-6.md). No test retry or mocked execution is
counted as real runtime acceptance.

## Hostile inputs and lifecycle

The [deterministic inert fixtures](prompt-9-fixtures.json) exercise a corrupt PE
pointer, unusual GPT metadata using 4 KiB sectors and an overflowing entry pointer,
and eight ZIP cases: corruption, traversal, drive-absolute paths, symlink,
oversized declaration, extreme compression ratio, understated actual output and
2,049 entries. Both layouts reject unsafe archives without a partial package;
unsupported image/header input retains controlled inspection. Encoded HTML-like
names stay literal text; no injected elements or execution occur. Existing parser,
path/alias/CRC, aggregate extraction and cancellation regressions also pass.

Ten new real-browser cases cover these inputs and lifecycle behavior:

- A running MEM session creates and exports a document, then refresh destroys its
  real worker. The UI is idle, no program auto-runs and reselection launches a new
  guest without the old temporary file.
- Controlled fault injection calls `self.close()` in the **actual** emulator worker.
  The documented `asyncifyStats()` round trip detects its absence, disposes the
  iframe and shows a recoverable error; fresh launch produces an exported DOS file.
  This tests failure handling, not an intentionally simulated runtime.
- A real one-minute profile expires with actual wall-clock time, removes the frame
  and workers and reports the deadline. No fake timer or implicit save is used.
- With OPFS access deliberately denied in the application context, FreeCOM still
  imports a selected document, copies it inside DOS and exports the exact result.
  Save stays unavailable; no host directory picker or clipboard read is required.

Exact timings and per-case records are in [security results](prompt-9-security.json).
Silent worker loss was detected in **6,377 ms desktop / 6,362 ms phone layout**.
The one-minute deadline stopped the guest **59,338 / 59,293 ms after the test
observed its first frame**, respectively; both had zero remaining workers.
The deadline is measured after the helper observes a real frame, so the recorded
interval is slightly shorter than 60 seconds. Background throttling/device sleep
can delay JavaScript timers; there is no OS CPU or complete heap quota.

## Real production isolation and network observations

Production uses `vite.preview()` with the same middleware as `npm run preview`;
tests no longer supply a separate, stronger server policy. Real MEM and FreeCOM
output, meaningful keyboard input, guest export, stop/relaunch, cached offline
relaunch, blocked IPX and explicit OPFS save/reload/restore all pass. These actual
[MEM pixels](prompt-9-mem-exe-framebuffer.png) and
[FreeCOM pixels](prompt-9-freecom-zip-framebuffer.png) supplement file-byte and input
assertions; no image is used as a substitute player.

The security flow records request **method, URL, body and headers** at browser-context
level, covering page and worker traffic. After selecting local MEM and a private
synthetic document, all **23 observed requests** are fixed same-origin static GETs or
local Blob load, with no request body, query, cookie, authorization or referrer.
No selected filename, document sentinel, binary/document bytes or SHA-256 appears
in the recorded requests. Separate public demo actions request only their two
fixed approved filenames. There are no external requests, WebSockets, service
workers, analytics or error-report requests in normal production journeys.

Real-context probes establish that the opaque guest cannot read parent DOM,
cookies or localStorage; clipboard/storage/service-worker APIs are absent; host
picker and legacy WebRTC calls are denied. Actual worker probes confirm fetch,
sockets, importScripts, legacy WebRTC, IndexedDB and caches are unavailable, and
WASM allocation above 256 MiB fails. An actual Emscripten filesystem write at the
32 MiB file boundary is rejected without a partial write. These are explicit API
probes, not a claim that every possible emulator exploit was tested.

Temporary mode leaves no workspace, local/session storage, IndexedDB database,
cache or service worker. After normal execution is stopped, fixed public policy
probes attempt external fetch, service-worker registration, inline script, a
foreign frame and clipboard reading. Browser policy rejects them before the
network routing boundary (**zero escaped requests**). Expected CSP diagnostics
are recorded separately from **zero normal runtime console/page errors**.

Application source maps are disabled. The only `.map` shipped is the unchanged,
public upstream `emulators.js.map` in the retained source bundle, pinned to
`fc7b1af91c9d4af2f9a75c51bd74469b21d673c1667666c181cbca0e48efe1e8`.
It contains 84 upstream source modules, not app state or selected content. No map
fetch was observed. Main-app logging stores fixed codes only; raw guest output,
filenames, exception text and stacks are not forwarded or transmitted.

## Failed attempts and corrections

- Restricting the child to `wasm-unsafe-eval` broke the installed vendor loader's
  real startup. The [failed trial](prompt-9-wasm-eval-trial.log) is retained.
  General `unsafe-eval` remains only in the opaque guest; the main app forbids it.
- An optional credentialless iframe broke cached offline relaunch in Chrome;
  [trial log](prompt-9-credentialless-trial.log). It was removed to preserve the
  working path. The app sets no cookies, asset/demo fetches omit credentials, and
  the hosting guidance requires a dedicated cookie-free origin.
- A real [worker policy probe](prompt-9-storage-guard-trial.log) exposed that plain
  assignments did not remove read-only IndexedDB/cache APIs. Explicit property
  guards now remove them; current production checks require their absence.
- The [first full run](prompt-9-first-full-check.log) passed 90/92 browser cases;
  two old clipboard tests attempted reads now denied by policy. The corrected
  test observes the actual copied text from a separate test-owned blank page;
  product clipboard reads remain denied. No copy result is mocked.
- The next [full run](prompt-9-map-audit-check.log) passed all 92 browser cases and
  reached the final production artifact assertion, which incorrectly prohibited
  the retained upstream source map. The corrected audit pins that one public
  source artifact and rejects additional maps, preserving source/license material.
- Targeted test development also corrected an assumption that DOS `EXIT` closes
  the configured engine, restricted storage-denial injection to the app realm,
  and fixed an older file helper that treated “30 bytes” as “0 bytes”. No product
  acceptance relies on DOS `EXIT`, fake runtime messages or relaxed file contents.
- Final review added strict rejection of arrays/boxed strings used as message
  names. Normal protocol behavior and all real-runtime checks were rerun.

## Limits, changed files and next stage

Changed code is limited to the DOS host/adapter/protocol, session lifecycle,
`src/security/`, Vite hosting and test helpers/cases. README, AGENTS, product spec,
architecture, compatibility matrix and DOS guide were updated; the security model
and this evidence set are new. Original vendor/fixture/manifest/lock bytes remain
unchanged. All existing functionality is retained under the tested configuration.

Browser/emulator vulnerabilities, same-origin compromise, extensions, malicious
pixels, navigation channels after compromise and CPU/heap exhaustion remain risks.
JavaScript guards supplement the opaque sandbox; they do not make it a malware
containment boundary. Other static hosts must reproduce response headers and
rerun acceptance; the meta-only fallback is not the verified configuration.

No implementation blocker remains for this stage. Windows support, other physical
platforms, first-time human/assistive-technology validation and the public-distribution
source/license gate retain their earlier limitations. No later stage was started.
Next permitted roadmap stage: **Prompt 10, only when requested**.
