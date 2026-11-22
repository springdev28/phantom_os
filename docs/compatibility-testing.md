> Prompt 11 update: the published Chromium 159 CI run fails 13 mobile framebuffer
> cases. The commands below intentionally reproduce that open failure. Chrome 157
> and Firefox 159 local results remain scoped to their recorded environments.
> See [the blocker and evidence](chromium-mobile-blocker.md). Do not interpret the
> earlier clean-source local results as a passing public CI run.

# Reproduce compatibility results

This protocol tests PHANTOM itself. A recognized header, canvas or successful API
call does not count as a program launch. Use only the committed GPL DOS fixtures;
never put personal software or documents in CI artifacts.

## Fresh setup

Use Node 24.x. From a fresh source checkout with no `node_modules`, `dist` or
generated `public/runtimes`/`public/demos`:

```sh
npm ci
npx playwright install chromium firefox
PLAYWRIGHT_CHANNEL=chromium npm run check
```

On Linux use `npx playwright install --with-deps chromium firefox`. With installed
Google Chrome, omit `PLAYWRIGHT_CHANNEL=chromium`; the default uses Chrome. The
Firefox binary is Playwright's pinned patched build, not a claim about stock Firefox
on every platform. Record the actual browser version from the test output.

`npm run check` runs strict TypeScript, lint, deterministic unit/property cases,
production build, the existing Chrome suite, production security checks and the
new Chrome/Firefox core suite. The core suite uses ordinary preview hosting/CSP,
zero retries and the same assertions in both engines. Windows stays disabled;
its gating/inspection test is not a Windows execution pass. CI uploads passing
and failed test artifacts for 14 days; it never runs supplied user files.

```sh
npm run build
npm run preview
```

Open the printed loopback address for the manual protocol. No account, guest OS
download or runtime CDN is needed. Initial engine assets come from this same site.
Do not use a third-party emulator demo as PHANTOM evidence.

## Manual protocol for someone who did not implement the app

Record your browser/version, OS/version, hardware model/RAM, date, PHANTOM source
hash/commit, and runtime/fixture pins from the [matrix](compatibility-matrix.md).
State whether this is your first use, whether assets were cached, and whether a
physical keyboard/mouse or touch was used. Start a timer on selecting the demo;
record actual interactive output separately from first visible pixels.

| Case | Exact actions | Required observable result |
| --- | --- | --- |
| MEM 1.12; single MZ executable | Home → Try FreeDOS MEM → Analyze file → choose `MEM.EXE` → View compatibility → Configure launch → Use these settings and continue → Start DOS program | The original DOS program displays memory totals. Focus program, type `MEM > MEMOUT.TXT`, Enter. Refresh guest files → Export MEMOUT.TXT; its text contains `Conventional` and `Extended (XMS)` |
| FreeCOM 0.86; ZIP/support files | Home → Try FreeCOM; follow the same steps but choose `APP/COMMAND.COM` | The actual prompt identifies FreeCom 0.86. Type `TYPE APP\INPUT.TXT` and confirm the package resource text. Type `ECHO HELLO FROM DOS>RESULT.TXT`, Enter; export RESULT.TXT and confirm `HELLO FROM DOS` |
| Keyboard and cleanup | Focus the screen, type commands, then Ctrl+Alt+Esc or Release keyboard. Export before stopping; Stop session → Relaunch; repeat three times | Keys reach the guest, release returns to browser controls; stopped view has no running program. Relaunch responds again; uncaptured temporary result files are absent |
| Mouse/audio (FreeCOM) | Configure → Edit controls → absolute mouse, audio on. Start, Enable audio, move pointer, `TYPE APP\BELL.TXT` | Record whether a bell is heard. Shell commands do not prove mouse-driven application behavior; record input routing separately from a mouse UI |
| Document I/O and local storage | Import a text document named `DOC.TXT` containing `LOCAL CHECK`. Type `TYPE DOC.TXT>RESULT.TXT`, then `ECHO EDITED>>RESULT.TXT`. Export, Capture RESULT.TXT, Stop; Workspace → explicitly enable saves and choose software/working files → Save | Export contains both lines. Reload never auto-runs. Restore, then explicitly launch and re-export; bytes match. Export backup, then Delete workspace; reload finds no save |
| Unsupported case | Inspect one parser-only ELF or PE64 fixture generated below | Header evidence is shown; Run stays unavailable. A profile/report can be exported. Never attempt to execute synthetic parser fixtures |
| Fallback | If storage, clipboard or fullscreen is unavailable, record the exact message | Embedded player and temporary operation still work; explicit file download remains available. No account or broad host directory permission is requested |

Generate the two **inert, parser-only** unsupported files for manual selection:

```sh
node scripts/manual-fixtures.mjs
```

They are written under ignored `test-results/manual-inputs/`. No source or guest
code is executed. A timeout, wrong output, lost input, console error or failed
export is a **failure**, even if a screenshot looks plausible. Keep the failed row,
describe the actual result and link a new retest row after fixing it. Do not relabel
execution success as “detected” to hide a failure.

Use [the manual result template](../tests/manual-result.template.json). Leave
unperformed fields `null`/`not-tested`; do not invent browser memory, audio listening,
mouse application behavior or novice timings. Human and automated rows are separate.
The author/agent running a scripted browser is not an independent human participant.

## Performance protocol

After building, run `npm run benchmark`. Defaults are five fresh-context cold
samples and twenty offline warm samples per fixture/browser. It writes
`test-results/benchmark.json`, including failed attempts, exact asset sizes/hashes,
hardware, observed output hashes, cleanup and memory availability. Optional
`BENCH_WARM=2 BENCH_COLD=1` is a harness smoke test, not a p95 acceptance sample.
The full benchmark exits nonzero for a failed launch/output/cleanup check or a
20-sample warm inspection p95 above 500 ms / confirmed-output p95 above 5 seconds.
Correctness CI does not enforce laptop timing on an unrelated hosted runner.
`BENCH_FIXTURE=MEM.EXE BENCH_CYCLES=10000 npm run benchmark` records a separate
profile experiment through the actual Configure screen; it never changes the
product defaults. Keep the original result alongside any retest.

Chrome cold samples use CDP 20 Mbit/s throughput and 50 ms minimum response latency;
Firefox cold samples are explicitly unshaped loopback. Neither is an internet
service benchmark. No CPU throttling is applied. First load ends when Home's open
action is visible. Analysis excludes time in the native picker. First-frame timing
is separate from confirmed guest output, which includes physical-key automation
and exported-file checks. No automated time counts as human first-launch time.
Guest-file lists are snapshots: the harness refreshes them at bounded 100–400 ms
intervals, instead of waiting on a stale list. The original five-second polling
delay and CPU-setting trial remain in the [results](compatibility-results.md).

Memory is sampled from this dedicated browser's process tree every 500 ms where
the host permits it. Summed resident memory can double-count shared pages and miss
brief peaks; it is neither JS heap nor unique memory. If unavailable, record that
fact. Preserve raw samples, medians/p95 and sample counts. Do not drop outliers or
optimize without a measured bottleneck. Hosted CI checks correctness; laptop
benchmark results are not inferred from an unexecuted CI job.

References: [Playwright browser installation](https://playwright.dev/docs/browsers),
[CI guidance](https://playwright.dev/docs/ci), [browser process access](https://playwright.dev/docs/api/class-browserserver#browser-server-process),
[CDP network conditions](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions).
