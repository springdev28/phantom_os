# Prompt 10 acceptance — 2026-11-22

This stage adds reproducible compatibility tests and measurements for the existing
DOS path. It adds no emulator, guest program, runtime asset, dependency or product
feature. All 66 production source files in the Prompt 9 inventory remain byte
identical. Windows remains experimental and disabled.

The [program matrix](../compatibility-results.md) records exact environments,
launch/input/file-I/O outcomes, performance and limitations. The [reproduction
protocol](../compatibility-testing.md) covers clean installation and manual testing
by someone who did not implement PHANTOM. Independent human results are still
pending; automated runs are not substituted for them.

## Environment and source identity

MacBook Air MacBookAir10,1, Apple M1, 8 logical CPUs, 16 GiB RAM; macOS 26.6.2
(25G83), Darwin 25.6.0 arm64. Node 24.19.0 and npm 11.17.0. Chrome
157.0.8103.79 and Playwright Firefox 159.0 (revision 1572), both headless, with
Playwright 1.65.1. No physical phone, stock Firefox, Safari or other OS was tested.

Engine, host, fixture and profile pins are in the [matrix](../compatibility-results.md#environment-and-reproducibility)
and [retained manifest](../../vendor/dos/manifest.json). The host remains
`74394f7d792ea8c330217231b6b6d4f223c006b4d4935fb19ee87c51b57e7318`.
No automatic profile migration or new compatibility-catalogue entry was introduced.

The repository is still unborn, so there is no tested commit or remote checkout
to cite. The [125-file source inventory](prompt-10-source-files.json) identifies
the exact code, configuration and fixtures. An isolated source snapshot in
`/private/tmp/phantom-p10-build` was installed with **no prior node_modules, dist,
generated runtime or demo assets**. Its source hashes match the working project.
This is clean-source-install evidence, not an invented GitHub Actions run.
The [clean-install record](prompt-10-clean-install.json) identifies the absent
generated directories, matching source inventory and lock hash.

The [install log](prompt-10-install.log) records `npm ci`: 183 packages installed.
npm reported an unapproved optional fsevents install script; it was not approved
or needed for these successful checks. Earlier reads in the original workspace's
existing dependency tree stalled, and an initial preview probe ended in a host
ReadStream `ETIMEDOUT`. Those attempts do not count as passing browser runs.
The isolated fresh install avoided that host condition without altering app code.

## Final commands and outcomes

`npm ci && caffeinate -dims npm run check` completed with **exit 0** from the clean
source copy. Caffeinate prevents laptop sleep only; it is not a guest feature.
The [complete check log](prompt-10-check.log) retains all commands and observations.

| Command / check | Result |
| --- | --- |
| `npm ci` | Passed; 183 packages installed from the unchanged lockfile |
| `npm run typecheck` | Passed strict TypeScript, including both Playwright configurations and new tests |
| `npm run lint` | Passed, zero warnings |
| `npm test` | **275 passed / 16 files**, including 12 new seeded property tests |
| `npm run build` | Passed; pinned runtime/fixture/source inventory verified; rebuilt assets match the benchmarked hashes |
| `npm run test:browser` | **92 passed**, zero failed/skipped/retries; desktop and Pixel 7 layout emulation in Chrome; [runner JSON](prompt-10-browser.json) |
| `npm run test:production` | Passed actual preview headers, both real programs, input/export, cached offline relaunch, guest network failure, OPFS and policy probes; [report](prompt-10-production.json) |
| `npm run test:compatibility` | **12 passed**, six per browser, zero failed/skipped/retries; [runner JSON](prompt-10-core-runner.json), [profiles, file hashes and traffic](prompt-10-core.json) |
| `caffeinate -dims npm run benchmark` | Exit 0; **100 measured launches plus four warm-ups**, no functional failure or timing-target miss; [raw measurements](prompt-10-benchmark.json), [log](prompt-10-benchmark.log) |
| `node scripts/manual-fixtures.mjs` | Passed; writes only two inert parser examples to ignored test-results |
| `python3 scripts/dos-fixtures.py --verify` | Passed; both real program hashes match the retained manifest |
| CI YAML parse and gate inspection | Passed; required check command present. Hosted CI itself **not run** |
| Local links, source and built/retained asset integrity | [Final document/integrity check](prompt-10-doc-check.json) |

`npm run dev -- --port 4176 --strictPort --mode test` was started, exercised and
closed by the baseline browser suite. The production core suite likewise starts
and closes ordinary `npm run preview -- --port 4175 --strictPort`. No test retry,
mock engine or upstream demo is counted as execution acceptance.

The final matrix records 747-byte MEM reports and exact 21-byte FreeCOM results
from all three core cycles on both browsers. Live document editing and opt-in
OPFS restoration also produce the expected bytes. All 288 core requests were
local static GET/Blob loads without tested selected-data sentinels or bodies;
normal console/page errors, sockets and service workers were zero. The retained
production trace additionally audits request headers and expected blocked probes.

## New test coverage

- Twelve seeded unit/property tests generate 512 mutated/truncated headers, 128
  valid stored/Deflate packages and 256 invalid ZIP path/size cases. They assert
  bounded reads, unchanged input, no executable-compatibility claim, byte-preserved
  files and atomic rejection. Seeds are fixed and reported in test names. This is
  not an exhaustive fuzzer or proof against all hostile inputs.
- The production core suite runs the same six cases in Chrome and Firefox:
  MEM three-cycle execution; FreeCOM three-cycle execution/resource read/audio
  samples/mouse routing; real document import/edit/export and opt-in OPFS
  save/reload/backup/delete; ELF/PE64 unsupported and NE/PE32 Windows disabled;
  corrupt/ambiguous ZIP recovery; and unavailable-storage/fullscreen fallback with
  real DOS export and refresh cleanup.
- Actual exported profile JSON, hashes of guest-written files, frame/input/audio
  metrics, request traces and cleanup results accompany each core observation.
  PNGs are captured from the real emulator canvas; output-byte and input assertions
  establish execution, rather than treating a canvas or API call as proof.
- Existing Chrome desktop/mobile-layout tests retain lifecycle, forced worker
  failure, actual duration deadline, parser/ZIP limits, missing dependencies,
  drag/drop, clipboard and storage denial coverage. Production security assertions
  still use ordinary preview headers and actual page/worker traffic.
- CI pins checkout/setup-node/upload-artifact action commits, uses Node 24 and
  pinned Playwright Chromium/Firefox on Ubuntu 24.04, runs `npm run check`, and
  retains success/failure artifacts for 14 days. It is configured, **not executed
  on GitHub**. Only committed lawful fixtures and synthetic test bytes enter CI.

## Failed observations and measurement correction

Failures remain separate records; neither program-output checks nor the five-second
warm launch target were relaxed.

1. The first benchmark used `Download.path()` through Playwright's local
   BrowserServer connection. That API disallows path access with the remote
   protocol. All eight browser/fixture/mode attempts failed at download access;
   [raw failed attempts](prompt-10-benchmark-harness-first.json). Reading the
   actual download stream fixes the harness; it does not fake an export.
2. The original full benchmark completed five cold and twenty warm samples for
   each of four browser/program pairs, with valid guest results and cleanup.
   MEM's confirmed-output p95 exceeded five seconds: Chrome **6,948.30 ms**,
   Firefox **7,034.99 ms**. These misses remain in the
   [original data](prompt-10-benchmark-default.json), [log](prompt-10-benchmark-default.log)
   and [original script](prompt-10-benchmark-default-source.txt). That early script
   reported measurement completion; the final script explicitly returns nonzero
   for timing-target misses as well as functional failures.
3. A separately exported 10,000-cycle profile did not fix the delay: Chrome
   **6,965.12 ms**, Firefox **7,008.92 ms**, both failed the unchanged timing target.
   [CPU trial data](prompt-10-benchmark-cpu-trial.json), [log](prompt-10-benchmark-cpu-trial.log)
   and [script](prompt-10-benchmark-cpu-trial-source.txt) are retained. Phase p95s
   located **5,284.06 / 5,265.44 ms** in file-list wait/export, versus
   **649.59 / 642.14 ms** in typed input. No general CPU-default change was justified.
4. The [old helper](prompt-10-benchmark-original-helper.txt) waited up to the
   default five seconds for an item on a **snapshot** file list before refreshing.
   The corrected helper refreshes at bounded 100–400 ms intervals, with the same
   eight-second outer deadline and unchanged actual-file assertions. The final
   measurement repeats the original 3,000-cycle profile. This is a measurement
   correction, not an emulator or application speedup. Both earlier timing-failure
   rows remain visible.

## Scope, changed files and outstanding work

The [11 changed source/test/configuration files](prompt-10-changed-files.json) add
the production core configuration, tests, seeded properties, measurement runner,
manual fixture/template, CI and npm/TypeScript wiring; they also correct the shared
download helper. Three existing dotfiles were newly included in the hash inventory
without being modified. Package-lock, dependencies, product UI/runtime, vendor
sources, notices and real DOS binaries remain unchanged.

Documentation changes are AGENTS.md, README.md, product-spec.md, architecture.md,
compatibility-matrix.md and security.md; compatibility-testing.md,
compatibility-results.md and this evidence set are new. No generated result is a
placeholder program or screenshot used as a player.

Independent manual/non-author acceptance, three-novice timing and screen-reader
speech remain outstanding. Mouse-driven application behavior and human audio
listening are not covered by the shell fixtures. Windows retains its prior lawful
filesystem/fixture blockers. The source rebuild/project-license gate still blocks
public distribution. Browser storage remains optional and evictable; unsupported
formats retain inspection/export. No later roadmap stage, deployment or release
was started. Next permitted stage: **Prompt 11, only when requested**; it does not
waive these pending checks.
