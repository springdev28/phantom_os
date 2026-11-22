# DOS runtime — Prompts 5, 7 and 8

The first real adapter uses the pinned **emulators 8.5.3 classic `dosboxWorker`**
API. The backend reports `8.5.3 (aeecd448025fcd8fc2843a780660a8f7)`. It is an
experimental DOS path with observed results for two exact fixtures, not universal
DOS compatibility. Windows and bootable disks remain unavailable. Prompt 7 adds
live document import/export and explicit working snapshots for opt-in storage; see
the [workspace guide](workspace.md), [Prompt 7 evidence](evidence/prompt-7.md) and
[original runtime evidence](evidence/prompt-5.md).

## Local setup and repeatable fixtures

Use Node 24, installed Google Chrome and `npm install`, then `npm run dev`.
`runtime:assets` runs automatically before dev/build and verifies exact source/asset
hashes. All three engine assets are served locally; no CDN, account or cloud API is
used. See [source and licensing](runtime-license-audit.md) before redistributing.

Both fixtures are already in `tests/fixtures/dos/`. Their original binary/source
pairs, license grants, deterministic ZIP reconstruction and hashes are recorded
in [fixture provenance](../tests/fixtures/dos/README.md) and
[the manifest](../vendor/dos/manifest.json). No binary executes on the development host.

For each case, select its file, Analyze, choose the named entrypoint, open
Compatibility, **Configure launch**, **Use these settings and continue**, then
**Start DOS program**. Home also offers **Try FreeDOS MEM** and **Try FreeCOM**;
these use the identical audited bytes and inspection path without finding source files.
Do not choose the first EXE automatically. For an actual raw COM, the additional
DOS-intent confirmation is required. FreeCOM's .COM file has a real MZ header.

### Single executable: MEM 1.12

Select `tests/fixtures/dos/MEM.EXE`, entrypoint `MEM.EXE`. Keep the generated
profile: cwd `.`, one whole-package writable C:/ mount, 64 MiB DOS memory, 3000
cycles, core `auto`, machine `svga_s3`, XMS/EMS true, 30-minute session limit,
US keyboard, mouse off and audio off.

The framebuffer shows the FreeDOS memory report, then a DOS prompt. Focus it and type:

```dos
MEM
MEM > MEMOUT.TXT
TYPE MEMOUT.TXT
```

Refresh guest files and export MEMOUT.TXT. Its real bytes include `Conventional`
and `Extended (XMS)`. The report's “MS-DOS is resident” wording is printed by MEM
against DOSBox's internal DOS services; no Microsoft OS binary is bundled.
Stop the session and relaunch. MEM runs again; the previous output file is absent.

### ZIP with resources: FreeCOM 0.86

Select `tests/fixtures/dos/FREECOM.ZIP`, entrypoint `APP/COMMAND.COM`. Keep the same
DOS settings and cwd `.`, so resources are addressed from the package root. For
the audio/mouse test, expand **Edit controls, mounts and limits**, select absolute
mouse and audio enabled, then **Apply profile settings** before returning to Player.
Click **Enable audio** inside the player after launch.

The FreeCOM banner/prompt appears. Type:

```dos
TYPE APP\INPUT.TXT
TYPE APP\INPUT.TXT > COPY.TXT
ECHO PHANTOM DOS OK>OUTPUT.TXT
TYPE OUTPUT.TXT
TYPE APP\BELL.TXT
```

The text resource is read by FreeCOM; COPY.TXT must preserve its 82 bytes.
OUTPUT.TXT must contain `PHANTOM DOS OK` followed by CRLF (16 bytes). The BEL
resource triggers the actual PC speaker stream. Refresh/export while running,
then Stop and Relaunch. The original three package files remain; guest-created
files are discarded. No app-side text is substituted for any guest output.

### Automated checks

```sh
python3 scripts/dos-fixtures.py --verify
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser -- --workers=2
npm run test:production
```

For just the real runtime cases:
`npx playwright test tests/browser/dos-runtime.spec.ts --workers=2`.
Tests require a real lit framebuffer, use real physical key events, read actual
emulated files and compare their bytes, check audio samples, then stop/relaunch.
There are three consecutive normal cycles per fixture/layout plus recovery tests.
No mocked adapter or synthetic framebuffer satisfies these checks. Chrome full-page
screenshots can omit the opaque iframe compositor surface; evidence captures the
actual canvas directly and uses a normal viewport capture for the surrounding UI.

## Adapter boundary and documented API

The installed `emulators` declarations/source and upstream
[embedding API](https://js-dos.com/emulators.html) and
[CommandInterface](https://js-dos.com/command-interface.html) were consulted.
No js-dos website/application source was copied into the product.

- `RuntimeAdapter.prepare` validates the exact runtime pin, bounded package,
  DOS 8.3 paths, single writable mount and closed profile; it reads each normalized
  file in 64 KiB chunks. ZIPs are not decompressed again. Directories/resources and
  relative paths are preserved; empty directories are created programmatically.
- `createDosConfiguration` builds the config from enumerated settings and safe
  paths. The virtual Emscripten `/home/web_user/package` directory becomes C:.
  That is an in-browser path, not the user's host filesystem. Supplied configs,
  autorun and embedded scripts are never executed during import or automatically
  appended to the launch sequence. The chosen executable may of course interpret
  its own inputs once the user explicitly starts it.
- `emulators.dosboxWorker(InitFs, options)` receives `DosConfig` plus `InitFile[]`.
  No bundled ZIP/download helper, token, network transport or sockdrive is used.
  `ci.net()` must be null. The wrapper resolves before the first video mode;
  PHANTOM waits for a valid real frame before announcing the engine is running.
- `events().onFrameSize/onFrame` feed a real 2D canvas from RGB/RGBA output.
  `sendKeyEvent`, mouse methods and `onSoundPush` drive actual input/audio.
  Audio consumes mono Float32 buffers at `ci.soundFrequency()`, bounded to a
  250 ms playback queue. Silence is not proof of broken audio; BEL is tested.
- `fsTree` and `fsReadFile` enumerate/export only the virtual package directory.
  Export is a local Blob download, one ≤32 MiB file per request. `fsWriteFile`
  imports one new root DOS 8.3 document (≤8 MiB), without overwrite. The file
  operations are serialized and both parent/host enforce bounds. `exit` is awaited; a 1.5-second parent fallback removes the
  sandbox and terminates its workers. Startup has a 45-second outer deadline;
  the sandbox handshake/start has 30 seconds; file operations have four seconds.

`src/runtime/dos/descriptor.ts` is lightweight and eagerly available for planning;
`adapter.ts` is dynamically imported only on Start. Vendor JS/WASM is fetched and
SHA-256 checked only then (1,665,363 bytes total). The generated host document is
content-hashed. Successful engine bytes can be reused in memory; selected package
buffers are not saved by the runtime. Explicit app-level OPFS saving is separate.
The runtime build ID includes the generated host hash to invalidate stale profiles.
Stop removes the iframe, worker, message
channel, held keys/buttons, audio context, timers and Blob URLs. Temporary changes
must be exported or captured before stop, navigation, timeout or reload. Player
shows remaining minutes, with an emphasized last-minute export reminder. Captures
are temporary snapshots until the user explicitly saves them in Workspace.

## Input, limits and known issues

- Click the actual screen or **Focus program** for keyboard input. Start does not
  automatically capture the keyboard. The focus border/status reflects real input
  focus; **Release keyboard** and **Ctrl+Alt+Esc** return to browser controls.
  **Full screen** expands the real viewport with session controls and an Exit
  button; denial/unavailability keeps the embedded viewport usable. Physical US key mapping is
  implemented; non-US/IME layouts, touch text entry and OS-reserved shortcuts are
  not verified. Tab leaves the canvas; the in-frame Tab button sends a DOS Tab.
  Ctrl+Alt+Esc releases keys/pointer; blur also releases held keys. A complete
  mobile virtual keyboard is not included.
- Mouse may be off, absolute or captured. Captured mode requires a browser-granted
  pointer lock; failure keeps input release available. Pointer mapping is wired
  and forwarding is tested, but these two text fixtures do not prove behavior in
  a mouse-driven DOS application.
- Audio needs profile opt-in and a user click; autoplay is not assumed. Tests
  confirm AudioContext activation and nonzero actual PCM after BEL. Human listening,
  music fidelity, game timing and real mobile audio are not verified.
- 32 MiB package, 2,048 selected files, DOS 8.3 components; no multi-drive/read-only
  mount, arbitrary launch arguments or free-form DOSBox config. Short names avoid
  command injection and alias ambiguity. The normal analyzer/import limits may
  accept larger/longer-name packages that this narrower adapter cannot launch.
- Guest memory 16–64 MiB; cycles 300–30,000; core auto/normal/simple; machine
  svga_s3/vgaonly/ega; XMS/EMS toggles. These are launch settings, not a portable
  browser CPU/heap quota. The worker caps WebAssembly linear memory at 256 MiB,
  writes at 32 MiB per file / 64 MiB aggregate growth and 4,096 newly created VFS
  nodes. Deleted/truncated growth is not reclaimed from that conservative budget.
  Host JS, canvas/audio and temporary copies also consume memory; peak heap is unmeasured.
- The selected core aborts when FreeCOM invokes `IPXNET CONNECT` with networking
  disabled. PHANTOM shows a recoverable error, releases the worker and retains the
  original package/profile for relaunch. The production test verifies no outgoing
  connection and a successful retry. Networking remains unavailable.
- SIG/extension confidence, first-frame activity or successful API calls do not
  grant compatibility. Only the exact documented program/input/config/browser
  observations are verified; the general DOS descriptor remains experimental.

## Network and hosting boundary

The runtime lives in an **opaque-origin** iframe (`allow-scripts allow-pointer-lock`,
never `allow-same-origin`). The iframe CSP has `connect-src 'none'`, `worker-src blob:`,
script/style hashes, and blob script permission; vendor `unsafe-eval` is confined
there. Worker code is created from verified local bytes. Asset-only fetch/XHR facades
supply the two worker assets; network APIs, persistence and raw vendor logs are
blocked before startup. IPX and serial networking are disabled in generated config.
No optional js-dos UI, account, saves, MCP/debug service, WebRTC, proxy or remote drive
is configured. This is defense in depth, not a claim of perfect hostile-program isolation.

For strict production hosting, `npm run preview` and production acceptance now use
the shared policy in `src/security/policy.ts`: main scripts/styles are self-only,
frame-src permits the exact hashed host, and connect-src lists only the
three exact same-origin engine paths and the two explicit public demo paths
(`/demos/MEM.EXE`, `/demos/FREECOM.ZIP`). **Do not apply that main script policy to the
sandbox document**: serve its own hash-bound meta policy as its response header,
without allowing eval in the main app. Cache hashed host/assets immutably so an
already-loaded session can relaunch offline; cache the static favicon normally.
No service worker or implicit user-data cache is installed. OPFS is opt-in,
app-owned and unavailable to the opaque guest. Only static application,
source/notice, audited public fixtures and engine files are hosted; there is no user-data endpoint.

Prompt 9 also adds actual streamed-download limits, guest reply validation,
explicit permission denial,
`pagehide` teardown and a documented worker health query. The experimental attempt
to replace guest `unsafe-eval` with only `wasm-unsafe-eval` failed real startup:
the pinned loader invokes `eval.call(window, source)`. General eval stays prohibited
in the parent. Host changes produce a new build pin; old saved profiles require
explicit review/reset. See the [security boundary](security.md) and
[current evidence](evidence/prompt-9.md); browser/engine escape remains a residual risk.
