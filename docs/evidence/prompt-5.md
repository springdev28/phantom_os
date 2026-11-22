# Prompt 5 — real DOS runtime acceptance

**Passed on 2026-11-22.** The installed classic DOSBox worker actually executes
FreeDOS MEM 1.12 and FreeCOM 0.86 through PHANTOM's selected-file/package flow.
This verifies the behavior below for these exact inputs/configurations. General
DOS compatibility remains **experimental**; Windows is not integrated. The app's
automatic `verified-compatible` catalogue remains empty.

## Environment and immutable inputs

- macOS **26.6.2 (25G83)**, arm64, **MacBookAir10,1 / Apple M1 / 16 GiB RAM**.
- Real Google Chrome **157.0.8103.79**, Playwright **1.65.1**, Node **24.19.0**.
  Desktop Chrome and Pixel 7 layout emulation; the latter is not a physical phone.
  Production viewport: 1440×1100. Tests used two browser workers, no CPU/network
  throttling, loopback static serving. These are acceptance observations, not a benchmark.
- `emulators` **8.5.3**, upstream commit
  `e6f4e5449a5b17ae3ea0fdccfd453c8d299e9ea5`; classic DOSBox submodule
  `528578d5a6f76afd4d5ef4e722b5670826f1183a`. Actual backend version:
  `8.5.3 (aeecd448025fcd8fc2843a780660a8f7)`.
- Engine build ID: `emulators-8.5.3-e6f4e544-dosbox`. The three vendor file hashes,
  original download hashes, retained corresponding sources/licenses and ZIP member
  hashes are in [the audited manifest](../../vendor/dos/manifest.json).
- Generated opaque host: `host-8fa726507174f8ea.html`, SHA-256
  `8fa726507174f8ea0776e1e2efd4518ee9ccb1d3d2b05a0d4e69d10ca0d43871`.
- Git remains an unborn, uncommitted workspace. The [83-file source/test/config
  hash snapshot](prompt-5-source-files.json) binds the tested code without inventing
  a commit. The [production record](prompt-5-production.json) hashes every built
  artifact, including source/notice copies. No private user software is in this evidence.

| Fixture | SHA-256 | Actual selected entrypoint |
| --- | --- | --- |
| MEM.EXE, 15,028 bytes | `6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4` | `MEM.EXE` |
| FREECOM.ZIP, 88,187 bytes | `fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e` | `APP/COMMAND.COM` |

Both official binaries are unmodified and retained with their GPL source/license
materials. The FreeCOM package includes its English message resource plus the
original INPUT.TXT and BELL.TXT companions. [Provenance and reconstruction](../../tests/fixtures/dos/README.md)
and the [exact user reproduction guide](../dos-runtime.md) are part of this evidence.

The [profiles exported from the actual UI](prompt-5-profiles.json) capture the
configuration: 64 MiB guest memory, 3000 cycles, auto core, svga_s3, XMS/EMS on,
US keyboard, cwd `.`, whole package mounted writable at C:/, 30-minute limit.
Production runs use mouse/audio off. FreeCOM browser cases explicitly enable
absolute mouse/audio before launch. No arbitrary commands or imported DOSBox config
are appended. The hashed configuration generator supplies IPX/serial disabled and
the selected executable command under `/home/web_user/package` in the virtual FS.

## Commands and outcomes

| Command/check | Outcome |
| --- | --- |
| `npm install` | Passed; 184 installed packages audited, zero reported vulnerabilities. npm warned that optional fsevents install scripts were not approved; dev/build/tests still passed, no script approval was granted |
| `npm run dev -- --port 4177 --strictPort --mode test` | Passed; real Chrome loaded all screens and the fixture/profile flow without console errors |
| `npm run typecheck` | Passed, TypeScript strict mode |
| `npm run lint` | Passed, zero warnings |
| `npm test` | Passed, **206 tests / 11 files** |
| `npm run build` | Passed, including SHA verification, host generation, full notices/source copies and Vite production output |
| `npm run test:browser` | Passed, **56 tests**, including eight real DOS lifecycle/recovery cases across two layouts; no retries |
| `npm run test:production` | Passed; desktop/mobile local intake/profile flow plus both actual DOS fixtures, strict CSP, file export, stop, offline relaunch and guest-network failure recovery |
| Final aggregate `caffeinate -i npm run check` | Passed, exit 0. Temporary idle-sleep prevention surrounded the unchanged acceptance command; it ended with the command |
| `python3 scripts/dos-fixtures.py --mem …/mem.zip --freecom …/freecom-package.zip` | Passed; reconstructed both fixtures from audited original archives with identical hashes |
| `python3 scripts/dos-fixtures.py --verify` | Passed, both retained fixture hashes match |
| Document/asset validation | Local Markdown file targets resolve; generated host script/style CSP hashes match their bytes; all 83 recorded source hashes still match |

## Actual execution and I/O

MEM displays its real memory report. Keyboard reinvocation and redirection create
MEMOUT.TXT inside DOS. The [exported report](prompt-5-mem-output.txt) is 747 bytes,
contains Conventional and Extended (XMS) values, and hashes to
`a89b9c2e1869c81b57d603ff9eeac228982a335d1235beb2a78bb13e55bedbfb`.

FreeCOM displays its own 0.86 banner. It reads APP/INPUT.TXT through TYPE, copies
that resource through shell redirection, and creates OUTPUT.TXT with a typed ECHO
command. The [actual exported output](prompt-5-freecom-output.txt) is 16 bytes,
`PHANTOM DOS OK` plus CRLF, SHA-256
`e90558aafe505f5d526a58eca96a088fd03b18b9940b15e3c7ec9dc7fe424fda`.
The source package stays intact. Each fresh launch discards prior guest-created
files. The application does not synthesize these outputs.

[MEM desktop framebuffer](prompt-5-mem-desktop-framebuffer.png) and
[FreeCOM desktop framebuffer](prompt-5-freecom-desktop-framebuffer.png) are direct
captures of the real emulator canvas after input. [MEM player](prompt-5-mem-player.png)
and [FreeCOM player](prompt-5-freecom-player.png) show the actual interface.
Mobile-layout frame captures are retained as
[MEM](prompt-5-mem-mobile-framebuffer.png) and
[FreeCOM](prompt-5-freecom-mobile-framebuffer.png). None are used as a product player
or fallback. The tests also read actual canvas pixels and require a lit framebuffer.

The [browser observation JSON](prompt-5-browser.json) records all three normal
launch/input/stop cycles per fixture/layout, frame/input/audio counters, requests
and sockets. Only the ephemeral Vite developer websocket token is redacted.

| Fixture/layout | First-frame launch times, three cycles (ms) | Stop times, three cycles (ms) |
| --- | --- | --- |
| MEM / desktop | 1109, 1065, 948 | 67, 79, 65 |
| MEM / mobile layout | 1120, 1098, 1064 | 52, 66, 62 |
| FreeCOM / desktop | 1143, 1057, 1059 | 66, 62, 76 |
| FreeCOM / mobile layout | 1113, 1082, 965 | 66, 76, 63 |

Production first-frame launch/stop: MEM **1031/62 ms**, FreeCOM **1041/59 ms**.
These measure Start-to-real-lit-frame, not program completion or a 20-run p95.
The three vendor assets total **1,665,363 bytes**, plus the generated host. No shaped
cold-network, cross-browser p95, peak JS heap or sustained game FPS claim is made.
All observed normal stops finished below two seconds and left **zero workers**.

## Input, network and recovery observations

- Physical keyboard events drive the real programs, including uppercase characters,
  Enter, backslash paths and `>` redirection. Browser/OS shortcuts remain reserved;
  US physical layout only. Tab releases canvas focus; an in-frame Tab button sends
  that key to DOS. Mouse coordinates account for display letterboxing.
- FreeCOM's BEL file produced nonzero actual PCM: peak **0.152587890625** in both
  browser layouts, with audio explicitly enabled. Absolute mouse movement reached
  the adapter. These are stream/input observations, not human-listening, music or
  mouse-driven application verification. Real mobile touch keyboards are untested.
- Real missing-asset failure retains the selected package/profile, shows fixed
  actionable guidance, and succeeds on retry after the connection is restored.
  Navigating away from Player removes the sandbox and worker.
- Production recorded **zero console errors, external requests, sockets or remaining
  workers**. Page/frame/worker traffic consists of fixed loopback application and
  engine assets plus local Blob workers. No selected file/name/content sentinel is
  in a request. localStorage, sessionStorage, IndexedDB databases and CacheStorage
  remain empty. Browser HTTP caching is used only for static assets.
- After assets are loaded, both real fixtures relaunch with Playwright networking
  disabled and write/export OFFLINE.TXT with the expected `OFFLINE LOCAL OK` bytes.
- `IPXNET CONNECT phantom-network.invalid` is intentionally attempted with the
  connection available. This pinned core aborts because networking is disabled.
  PHANTOM releases the failed worker, offers relaunch, and the fresh guest writes
  RETRY.TXT with `RECOVERED`. No guest connection or hostname-bearing request is sent.

## Failed attempts and limits retained

Early integration tests exposed a wrong virtual mount root, quoting incompatible
with the DOSBox command parser, the backend's full build-version string, and the
API resolving before a video mode exists. These were corrected against installed
source/API behavior. The first FreeCOM probe also misread legacy relocation data
at offset 0x3c as a Windows secondary pointer; a bounded layout check and regression
now preserve DOS recognition without weakening valid PE/NE handling.

Reading an output immediately while the guest was still writing returned zero
bytes; the smoke test now waits for a nonempty real file. Audio's initial activation
branch was corrected to resume rather than immediately suspend a new context.
The IPXNET backend abort is retained as a known unsupported operation, not hidden
as a passing network feature. The recoverable error path is tested explicitly.

On this Chrome host, full-page screenshots omitted the opaque iframe's compositor
surface even though direct canvas/normal viewport captures showed the guest. Tests
now capture the real canvas and assert its pixels. An offline recovery test also
initially disconnected before the lazy Player route had mounted; it now waits for
the enabled Start control before cutting connectivity.

One later unchanged-code pass finished 54/56 after two simultaneous traces showed
matching **~946-second gaps** during unrelated keyboard and ZIP-picker actions,
consistent with host suspension. It is not counted as a pass. The final run with
temporary idle-sleep prevention passed 56/56 without retries.

Remaining limitations: Firefox/Safari and physical mobile devices untested; no
complete on-screen keyboard/IME, mouse-driven DOS fixture, audible hardware listening,
GPU/3D fidelity or peak heap benchmark. DOS 8.3 paths, 32 MiB package, single temporary
writable mount and documented worker/file limits apply. No live file import,
persistence, Windows/ELF/Mac execution or disk booting. Public release remains gated
on the final compatible project license and upstream source rebuild; see
[the adoption audit](../runtime-license-audit.md).

## Changed files and next stage

- Runtime: new `src/runtime/dos/{adapter,host,host-manifest,config,descriptor,keys}.ts`,
  `frame.html`, `config.test.ts`, `scripts/runtime-assets.mjs`; pinned dependency and
  lockfile; generated runtime/source assets remain ignored and reproducible.
- Integration: domain contracts/errors/state machine, planner/registry and their
  regressions, profile schema/editor, `use-runtime.ts`, session controller, Player,
  Home/Compatibility/inspection copy, shared props, logger, CSS and metadata.
- Fixtures/tests: real MEM/FreeCOM inputs, fixture provenance/reconstruction script,
  DOS browser helpers and tests, production smoke, existing planner/profile/header
  regressions, browser worker limit and this evidence bundle.
- Documentation: AGENTS, README, product/architecture/matrix, analyzer/planning notes,
  dependency/license records, full vendor notices/source archive inventory and the
  DOS reproduction guide. No unrelated work was deleted; no commit, push or deployment.

Next permitted stage, only upon request: **Prompt 6 — the separate bounded
Boxedwine/Wine trial**, with DOS regressions preserved. No further runtime is implied
by the successful DOS cases.
