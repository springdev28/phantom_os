# Boxedwine browser trial — Prompt 6

**Windows execution has not been verified. The adapter is experimental and disabled.**
The DOS adapter remains enabled. This stage exercised the real Boxedwine engine's
bootstrap, memory filesystem and missing-environment failure, but did not run a
Windows application, test its input, or establish clean application shutdown.
See [the recorded checks](evidence/prompt-6.md).

## Build investigated

The official [25R1.0 web release](https://github.com/danoon2/Boxedwine/releases/tag/25R1.0)
was published **2025-09-13**, not in 2026. Its annotated tag resolves to
`9279ab115e3c1e513aca4ea95aa30ea2f65258be`. The archive's published SHA-256 is
`b10e46bbe8b236d9b8088b3cf8a63d285154763c07d2fc4acb26999e10ad8f7d`.
The [artifact record](../tests/fixtures/boxedwine-artifacts.json) pins exact sizes,
hashes, roles and rejection reasons, including the reviewed but unadopted files.

| Investigated file | Bytes | SHA-256 |
| --- | ---: | --- |
| `boxedwine.js` | 441,587 | `e9da809cf6ef1437621e661be4a50ca6b92d7a369123d4056a3c8cfff04385af` |
| `boxedwine.wasm` | 2,303,715 | `f1588fdfa3aa5024620bf5b1688745061d48a3f5f63e2e8e84a91fbe84dbb3cd` |
| `boxedwine.zip` — not loaded | 37,247,698 | `55b26c04b46986c977d6ec18989623d983274e03a72d3dc2fb048fc74d1245f9` |

The release README and `wineVersion.txt` identify the web filesystem as stripped
**Wine 6.0**, revision `3`. The native release's Wine 10.0 default must not be used
to describe these web assets. The WASM has a `target_features` custom section,
including exception handling, but no `producers` section identifying the exact
compiler. The source commit is pinned; reproducing a bit-identical binary from it
has **not** been demonstrated.

## Small integration boundary

The pinned [Emscripten makefile](https://github.com/danoon2/Boxedwine/blob/9279ab115e3c1e513aca4ea95aa30ea2f65258be/project/emscripten/makefile)
and [web shell](https://github.com/danoon2/Boxedwine/blob/9279ab115e3c1e513aca4ea95aa30ea2f65258be/project/emscripten/boxedwine-shell.js)
document the actual surface: a classic Emscripten `Module`, `preRun`,
`arguments`, `canvas`, dependency callbacks, and `FS` methods. There is no js-dos
session API to assume. The stock shell defaults to IndexedDB, accepts URL launch
parameters and prints filenames/arguments. PHANTOM does **not** use that shell.

- `src/runtime/boxedwine/descriptor.ts` contains lightweight availability, separate
  PE32/NE rules and explicit adoption blockers. Investigated hashes are not marked
  installed assets. Runtime version/build fields stay absent, so exported draft
  profiles retain null pins.
- `adapter.ts` implements the common `RuntimeAdapter` contract and rejects both
  preparation and launch with `WINDOWS_UNVERIFIED` **before reading selected bytes**.
  The lazy registry also rejects it. Direct calls, overrides and imported profiles
  cannot bypass either gate.
- `config.ts` validates a narrow trial mount plan from the existing normalized
  `ApplicationPackage`; no second extraction or lost companion files. It builds
  an argument array, not a URL or command script. A whole temporary **D:** package
  mount leaves Wine's own C: separate. Working paths with spaces stay one argv
  element; traversal, collisions, absent entrypoints, wrong PE kinds and oversized
  packages are rejected. The trial is capped at 32 MiB/2,048 entries, audio off,
  fixed 800×600 and a 512 MiB requested memory limit. These settings do not enable
  launch or prove Wine compatibility.
- `bridge.ts` is the small Emscripten in-memory staging boundary. The browser
  probe exercises it with the actual engine FS, preserves a text companion and
  empty directory, and reads the bytes back. This is **host-side VFS staging**, not
  guest Windows file I/O. The engine's observed linear memory is 536,870,912 bytes;
  total browser heap, guest quotas and running-app performance are unmeasured.
- The shared Compatibility/Player screens explain the disabled path without
  loading a canvas, iframe or Windows assets. Inspect, entrypoint choice, ZIP,
  folder intake and local JSON profile export remain available. DOS uses its
  existing runtime and player controls.

The opt-in engine probe supplies fixed JS/WASM from a loopback test server and an
opaque iframe; it never serves a selected application. `Module.wasmBinary` supplies
the verified bytes, so the engine needs no dynamic WASM download. Network and
storage APIs throw, CSP denies connections, and no IndexedDB filesystem is mounted.
`/bin/wine` is deliberately absent. The engine actually reports
`Could not find /bin/wine`, followed by `Boxedwine shutdown`. Frame removal and
fresh reinitialization work. This does not prove live guest networking is contained,
Windows keyboard/mouse/audio work, or a running Windows process stops cleanly.

## Why the adoption gate stays closed

| Component | Inspected evidence | Outstanding requirement |
| --- | --- | --- |
| Boxedwine core | Pinned source [README](https://github.com/danoon2/Boxedwine/blob/9279ab115e3c1e513aca4ea95aa30ea2f65258be/README.md) and [GPL v2 text](https://github.com/danoon2/Boxedwine/blob/9279ab115e3c1e513aca4ea95aa30ea2f65258be/license.txt); official web archive digest matches | Retain corresponding build/source/patch/toolchain material before shipping; resolve the project's compatible distribution license |
| Linked engine components | Makefile names SDL2, zlib/minizip, SoftFloat and Emscripten runtime integration | Audit the exact linked versions and notices, compiler/runtime libraries and source correspondence; no complete engine redistribution clearance is claimed |
| Wine/Linux filesystem | 1,640 entries, 117,830,656 unpacked bytes; includes Wine modules, loader/libc, fontconfig, fonts and configuration | No license/copyright/source inventory paths are present in this stripped archive. Recover per-component origins, exact sources, patches, licenses and build recipe before adopting it |
| Wine Notepad candidate | [Wine 6.0 source](https://github.com/wine-mirror/wine/blob/wine-6.0/programs/notepad/main.c) grants LGPL-2.1-or-later; a lawful candidate when its obligations are met | The archive's `notepad.exe` has an x86 PE32 header but carries `Wine placeholder DLL`; execution depends on `opt/wine/lib/wine/notepad.exe.so` (ELF32). Acquire/build a source-matched standalone x86 PE fixture for intake testing |
| Demo game in upstream archive | `ski32.zip` is listed in the release | Excluded: not extracted, executed, installed or redistributed. No abandonware inference |

Absence of notices in the stripped filesystem is **not** a claim that Wine or its
fonts are proprietary, or that upstream necessarily lacks redistribution rights.
It means this repository cannot yet satisfy its own per-component provenance and
corresponding-source gate. The upstream
[filesystem build notes](https://github.com/danoon2/Boxedwine/blob/9279ab115e3c1e513aca4ea95aa30ea2f65258be/tools/buildWine/readme.txt)
say assembling the base filesystem requires manual steps; the
[build script](https://github.com/danoon2/Boxedwine/blob/9279ab115e3c1e513aca4ea95aa30ea2f65258be/tools/buildWine/buildAll.sh)
fetches a separate TinyCore base. These are starting points, not a reproducible
component inventory for the downloaded archive.

No Boxedwine binary, Wine root, placeholder EXE, ELF helper, Microsoft Windows image,
DLL pack or upstream game was added to `public/`, `vendor/`, committed fixtures or
the production build. Only audit metadata, original boundary code and tests are
retained. The app's license remains private/UNLICENSED; the [DOS license gate](runtime-license-audit.md)
is unchanged.

## Reproduce the bounded trial

With Node 24, Python 3, curl and installed Chrome:

```sh
npm install
python3 scripts/boxedwine-audit.py /private/tmp/phantom-boxedwine-audit --download
npm run test:boxedwine -- /private/tmp/phantom-boxedwine-audit
npm run check
```

The audit uses verified HTTPS and the fixed official release URL/digest. It only
extracts the two pinned engine files; all guest paths are inspected inside ZIPs,
never written to the host filesystem. It refuses output inside this repository.
It writes `audit.json` and the filesystem's path/size inventory in the temporary
directory. The engine probe writes `test-results/boxedwine-engine-probe.json`.
The normal build/check never downloads or serves Boxedwine. Browser test runners
may clear `test-results/`, so preserve a probe report before another browser suite.
On this laptop `caffeinate -i` was used around acceptance commands to prevent host
sleep; it is optional and macOS-specific.

The disabled-path browser tests use original **parser-only** PE32/NE byte fixtures,
not Windows applications. They prove reporting, gating and privacy only. The
separate DOS regressions execute the real licensed MEM/FreeCOM fixtures.

## Actionable next step

Continue Windows only as a separately authorized follow-up to this bounded trial:

1. Produce a minimal Wine filesystem from pinned source/package inputs, with a
   complete component bill of materials, notices, source archives and repeatable
   build steps. Use the pinned Boxedwine build tools as a starting point; exclude
   uncertain DLLs, demos and optional network/persistence services.
2. Build a standalone x86 PE32 Wine Notepad from its licensed source using an
   appropriate Windows-targeting toolchain. Retain its exact source/build record
   and verify it is not a placeholder or ELF helper. A smaller original Win32 test
   application is an alternative if separately authorized; no Windows OS image is
   required. Do not widen this to Win16 without its own fixture.
3. Extend the tested memory/argv boundary into a disposable runtime context with
   framebuffer/input, bounded runtime writes and dependable termination. Run the
   fixture through PHANTOM's actual File/ZIP intake, type and save known text,
   recover guest-written bytes, and repeat launch/input/stop three times.
4. Exercise attempted guest connections, worker traffic, cancellation/timeouts and
   offline relaunch. Record browser/platform, full asset/fixture hashes and
   configuration. Only then remove blockers, install pinned assets and expose
   experimental launch. An exact observed fixture record alone may be verified.

Prompt 7 (live transfer/opt-in persistence) remains separate and is not implemented
by this trial. Neither a library load nor this expected missing-Wine failure can
be presented as a working Windows player.
