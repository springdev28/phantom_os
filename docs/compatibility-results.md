# Program compatibility results — 2026-11-22

These are observations of exact fixtures, profiles and browser builds, not a list
of all executable formats PHANTOM can run. The [format matrix](compatibility-matrix.md)
records recognition separately. Follow the [clean-install and manual protocol](compatibility-testing.md)
to reproduce the results; the [evidence ledger](evidence/prompt-10.md) retains
commands, failures, source hashes and raw records.

## Environment and reproducibility

| Field | Tested value |
| --- | --- |
| Laptop | MacBook Air `MacBookAir10,1`, Apple M1, 8 logical CPUs, 16 GiB RAM |
| Platform | macOS 26.6.2 (25G83), Darwin 25.6.0, arm64 |
| Browser A | Google Chrome 157.0.8103.79, headless, installed Chrome channel |
| Browser B | Playwright Firefox 159.0, revision 1572, headless patched build; stock Firefox is not separately verified |
| Automation/toolchain | Playwright 1.65.1; Node 24.19.0; npm 11.17.0; core viewport 1440×1000 |
| Hosting | Ordinary Vite production preview, loopback, actual application/guest CSP and permission headers; no stronger test-only hosting |
| Runtime | js-dos `emulators` 8.5.3, commit `e6f4e5449a5b17ae3ea0fdccfd453c8d299e9ea5`, classic DOSBox worker |
| Runtime build ID | `emulators-8.5.3-e6f4e544-dosbox-74394f7d792e` |
| Host SHA-256 | `74394f7d792ea8c330217231b6b6d4f223c006b4d4935fb19ee87c51b57e7318` |
| Source identity | [Tested source inventory](evidence/prompt-10-source-files.json); repository has no commit yet, so no commit ID is invented |

The [retained manifest](../vendor/dos/manifest.json) pins each JS, worker, WASM,
fixture, source archive and license. No runtime asset or product code changed in
this stage. The ordinary profile mounts the complete selected package at writable
temporary C:/, cwd `.`, no arguments, 64 MiB guest memory, 3,000 cycles, core auto,
SVGA S3, XMS/EMS on, US physical keyboard, and a 30-minute deadline. Mouse/audio
are off for timing; the core FreeCOM test explicitly enables absolute mouse and
audio. Exact exported profile JSON is retained in the core observations.

| Real program / input | Entrypoint | Size and SHA-256 | Provenance |
| --- | --- | --- | --- |
| FreeDOS MEM 1.12; single MZ EXE | `MEM.EXE` | 15,028 bytes; `6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4` | Official FreeDOS binary, retained GPL v2 license/source |
| FreeCOM 0.86; ZIP with support text and bell file | `APP/COMMAND.COM` (MZ despite `.COM`) | 88,187 bytes; `fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e` | Official English FreeCOM binary plus original test resources; retained GPL v2 and SUPPL/source terms |

See [fixture provenance and reconstruction](../tests/fixtures/dos/README.md).
No proprietary Windows image or DLL bundle is included.

## Automated execution matrix

All rows use the exact laptop/build/profile definitions above; the FreeCOM core
profile additionally enables audio and absolute mouse. [Twelve core observations](evidence/prompt-10-core.json)
and the [runner result](evidence/prompt-10-core-runner.json) record **12 passed,
zero failed/skipped/retried**. `verified` below applies only to these observations,
not arbitrary DOS applications or imported profiles.

| Browser / real program / input | Launch and keyboard | Mouse / audio | File I/O | Cleanup / known limits |
| --- | --- | --- | --- | --- |
| Chrome 157.0.8103.79 / MEM 1.12 / single MZ | `verified`: three real launches; memory report and typed second invocation | Disabled; not exercised | Actual redirected 747-byte report exported in each cycle, including Conventional and Extended (XMS) totals | Three stops; max 63.66 ms; zero frames/workers retained. US physical keys only; [actual pixels](evidence/prompt-10-mem-chrome-framebuffer.png) |
| Firefox 159.0 / MEM 1.12 / single MZ | `verified`: same three-cycle/input/output checks | Disabled; not exercised | Same 747-byte guest report in every cycle | Three stops; max 174.20 ms; zero frames/workers retained. Pinned patched browser only; [actual pixels](evidence/prompt-10-mem-firefox-framebuffer.png) |
| Chrome 157.0.8103.79 / FreeCOM 0.86 / ZIP | `verified`: real FreeCom 0.86 prompt; three launches with TYPE/ECHO commands | Absolute events reach engine; nonzero PC-speaker bell samples. No mouse-driven app or human-hearing claim | Reads package support file; exports exact `LOCAL COMPATIBILITY\r\n` (21 bytes) in each cycle | Three stops; max 68.98 ms; zero frames/workers retained. Temporary uncaptured files disappear on stop; [actual pixels](evidence/prompt-10-freecom-chrome-framebuffer.png) |
| Firefox 159.0 / FreeCOM 0.86 / ZIP | `verified`: same prompt, three-cycle and input checks | Same routed events/nonzero sample checks and limitations | Same exact support-file/read/write/export checks | Three stops; max 160.39 ms; zero frames/workers retained; [actual pixels](evidence/prompt-10-freecom-firefox-framebuffer.png) |

All four captures were visually reviewed: MEM shows the actual memory report and
FreeCOM identifies version 0.86. The captures supplement assertions on guest-written
bytes and input; they are never displayed in place of the emulator.

| Additional production workflow | Chrome 157 | Firefox 159 | Exact scope |
| --- | --- | --- | --- |
| FreeCOM live document import/edit/export | Passed | Passed | Selected DOC.TXT enters the real guest; TYPE/ECHO produces exact `LOCAL COMPATIBILITY\r\nEDITED IN DOS\r\n` bytes |
| Explicit OPFS save / backup / reload / restore / delete | Passed | Passed | Separate software/document consents; exported backup contains actual file; reload never auto-launches; restored export matches; deletion survives reload |
| OPFS + fullscreen deliberately unavailable | Passed | Passed | Real embedded MEM session and file export still work; storage stays disabled with a clear message; refresh removes frame/workers |
| Network and console observation | Passed | Passed | Across the twelve core cases, 288 requests are same-origin static GETs or local Blob loads, with empty bodies and no tested selected-data sentinels; zero console/page errors, sockets or service workers |

The [production security run](evidence/prompt-10-production.json) additionally
records request headers, blocked guest IPX, actual worker API denial and temporary
storage checks in Chrome: 23 normal requests with no selected content/metadata,
zero normal runtime errors, and zero escaped policy-probe requests. Expected blocked
CSP diagnostics are separate from normal console errors. These are observations
of the tested paths, not proof against all malicious programs or browser escapes.

## Detection, rejection and common errors

These tests use **inert authored header/package data**, never fake executable demos.
The same production checks pass in Chrome and Firefox; they do not verify a Windows,
Linux or disk program launch.

| Input / user error | Observed decision and recovery | Execution evidence |
| --- | --- | --- |
| ELF64 header in a misleading `.EXE` | Static ELF evidence; `unsupported`; Run disabled; profile export remains available | None; unsupported |
| PE32+ x86-64 header | Static PE64 evidence; `unsupported`; Run disabled; profile export available | None; unsupported |
| PE32 x86 or NE header | Recognized metadata; `experimental` Windows adapter remains disabled; no runtime assets loaded | None; Windows unverified |
| Corrupt ZIP | Human-readable corrupt-archive error; new selection recovers | No script/program executed |
| Two-candidate mixed ZIP | Eight package files preserved; neither candidate auto-selected; explicit MAIN.EXE selection changes the report | Inspection only |
| Missing declared dependency / invalid profile / wrong extension | Existing Chrome regressions retain needs-files/invalid/unsupported explanations and local export; overrides cannot invent verification | No unsupported launch |

Measured feedback in the single corrupt/mixed-package core case: corrupt ZIP
**127.44 ms Chrome / 112.71 ms Firefox**; ambiguous package choices
**110.73 / 92.11 ms**. These are one-sample UI response times, not p95 or a study of
how often people make mistakes. Actual user error frequency remains unmeasured.

## Laptop performance

Final [raw samples, profiles, traffic and inventory](evidence/prompt-10-benchmark.json)
and [run log](evidence/prompt-10-benchmark.log): **100 measured successful launches**,
four separate uncounted warm-ups, zero functional failures or timing-target misses.
Each browser/program row has **five fresh-context cold** and **twenty cached offline
warm** samples. Samples run sequentially; correctness tests do not compete with
the measurement run. There is no CPU throttling. Other laptop activity is not a
controlled laboratory workload; host sleep was prevented with caffeinate.

All values below are milliseconds. First load ends at Home's visible open action;
first frame is a separate observation, **not program-readiness proof**. Confirmed
output includes simulated physical typing (35 ms/key), the real guest command,
refreshed file listing and downloaded bytes. It is a conservative automation
measure, not human interaction time or pure emulator boot time.

| Browser / program | Cold Home median | Cold first frame median | Warm inspect p95 | Warm confirmed output p95 | Stop p95 (cold + warm) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chrome / MEM 1.12 | 518.51 | 1,535.16 | 66.77 | 2,063.94 | 57.12 |
| Chrome / FreeCOM 0.86 | 533.78 | 1,539.65 | 120.16 | 2,189.41 | 62.94 |
| Firefox / MEM 1.12 | 90.25 | 1,089.52 | 78.11 | 2,124.88 | 172.03 |
| Firefox / FreeCOM 0.86 | 100.99 | 1,077.30 | 117.98 | 2,189.41 | 176.32 |

Warm first-frame p95 ranges from 1,037.94 to 1,127.41 ms, including polling delay.
Cold Run-to-confirmed-output medians are **2,555.62 / 2,610.80 ms** for Chrome
MEM/FreeCOM and **2,099.18 / 2,155.96 ms** for Firefox MEM/FreeCOM. Cold startup
includes the on-demand runtime downloads; it excludes time spent reviewing settings.
The ≤500 ms inspection and ≤5,000 ms confirmed-output goals pass in the final
20-sample runs. Every individual stop also passed the 2,000 ms limit. p95 uses
nearest rank; raw samples and outliers are retained.

Chrome cold tests use CDP **20 Mbit/s aggregate throughput and 50 ms minimum
request-to-headers latency**; this is an approximation, not a measurement of
physical network RTT. Firefox cold tests use **unshaped loopback**. Those cold
columns cannot rank the browsers against each other under equal network conditions.
Fresh contexts/cache are tested, not a laptop reboot or cold browser process.
The warm samples set the browser context offline after an actual successful preload.

| Resource | Observed size / scope |
| --- | --- |
| DOS WASM | 1,459,535 bytes; SHA-256 `b33afba80de1a420c123086e5952d135de041f9e85d4444170e29d9249ec049c` |
| Engine JS + worker JS + WASM | 1,665,363 bytes |
| Hashed guest host document | 22,827 bytes; total active engine + host **1,688,190 bytes** (~1.61 MiB), loaded on demand |
| All application JS/CSS chunks | 440,259 bytes total, including lazy screens; this is not all transferred on Home |
| Sampled Chrome process-tree peak RSS | **1,407.66 MiB**, 331 samples across both fixtures and their repeated contexts |
| Sampled Firefox process-tree peak RSS | **1,602.39 MiB**, 318 samples across both fixtures and their repeated contexts |

RSS is sampled every 500 ms from the dedicated browser process and descendants;
shared pages are not deduplicated and brief peaks may be missed. It is not unique
heap, per-program memory, the WASM allocation size, or a maximum-memory guarantee.
No portable total-memory browser API was assumed. Raw asset bytes and hashes are
authoritative; computed gzip sizes in JSON are comparison values, not a claim that
preview served compressed responses. No source archive was fetched during launch.

### Retained timing failures and optimization decision

| Observation | Chrome MEM p95 | Firefox MEM p95 | Outcome |
| --- | ---: | ---: | --- |
| Original 3,000-cycle profile; old file-list observation | 6,948.30 ms | 7,034.99 ms | **Failed** unchanged 5,000 ms timing target; real output/cleanup passed |
| 10,000-cycle trial; same observation method | 6,965.12 ms | 7,008.92 ms | **Failed**; no evidence for raising product CPU defaults |
| Original 3,000 cycles; bounded snapshot refresh | 2,063.94 ms | 2,124.88 ms | Passed with the same real output/cleanup checks |

The measured wait/export phase consumed 5,284.06 / 5,265.44 ms in the CPU trial.
The helper was waiting five seconds on an outdated file-list snapshot. Refreshing
at 100–400 ms intervals removes this **measurement delay**, rather than speeding
up guest execution. Final wait/export p95 is 392.62 / 375.25 ms. Product defaults,
runtime assets, success criteria and output expectations remain unchanged. The
[failed data, scripts and correction](evidence/prompt-10.md#failed-observations-and-measurement-correction)
remain available; no result was silently overwritten or redefined as success.

## Independent manual matrix

Manual execution is **planned**, not verified. The scripted browser runs below do
not count as an independent human tester, human listening or assistive-technology
speech validation. A non-author can use the exact UI steps and expected guest-file
contents in the [protocol](compatibility-testing.md#manual-protocol-for-someone-who-did-not-implement-the-app)
without reading application source. Record new rows with the [result template](../tests/manual-result.template.json).

| Intended real program | Environment, profile and runtime | Launch / keyboard / mouse / file I/O | Timing / issues | Status |
| --- | --- | --- | --- | --- |
| MEM 1.12, exact fixture above | Tester browser/platform/hardware not yet supplied; record exact tested build/profile | Not performed by an independent tester | Not measured | `planned` |
| FreeCOM 0.86, exact ZIP above | Tester browser/platform/hardware not yet supplied; record exact tested build/profile | Not performed by an independent tester | Not measured | `planned` |

The three-first-time-users ≤60-second launch / ≤120-second export target remains
unverified. No user error frequency or novice success rate is inferred from the
automated error-recovery cases.

## Limitations that remain visible

- Windows stays **experimental and disabled**. The retained Boxedwine trial failed
  at the missing-Wine environment; it never launched a Windows application. The
  [blocker and next step](boxedwine-runtime.md) remain unchanged. Synthetic NE/PE32
  checks prove gating and metadata recognition only.
- ELF/Linux, PE64, classic Mac and disk booting remain **unsupported** execution
  paths. They may expose useful static metadata; that is not launch evidence.
- The shell fixtures exercise keyboard and file I/O. Mouse event delivery is not
  proof of a mouse-driven program; audio sample checks are not human listening.
- US physical keys and reserved browser shortcuts retain their limitations.
  Uncaptured temporary guest files are lost on stop/refresh. OPFS is opt-in and
  evictable; it is not a permanent backup.
- Firefox core results do not extend every Chrome-only sandbox-policy probe to
  Firefox. Stock Firefox, Safari, physical mobile devices, other OS/hardware and
  hostile programs outside the deterministic corpus remain unverified.
- The [security boundaries](security.md) are not a malware-containment guarantee.
  Network observations cover application/frame/worker requests in these tests,
  not every browser OS service or extension.
- Hosted Linux CI is configured but has not run. Local Mac results cannot be
  presented as a GitHub Actions pass. Public distribution still has the existing
  source-rebuild/project-license gate; no release or deployment occurred.
