# DOS runtime adoption review — 2026-11-21 / acceptance review 2026-11-22

Decision: adopt `emulators` **8.5.3**, classic `dosboxWorker`, for a local-only
experimental integration. No js-dos website/UI, account, cloud, remote filesystem,
DOSBox-X, Wine, external BIOS/ROM or proprietary operating system is included.
Prompt 11 selects GPL-2.0-only for original PHANTOM source after the
[distribution review](release-license-review.md). The source rebuild review still
gates public runtime distribution; `private: true` is not a GPL exemption.
The application source and corresponding runtime sources must accompany a release
under compatible terms. Sandbox/iframe separation is not a copyleft exemption.

Prompt 6 does not change this DOS adoption decision or its pinned core. The
[Boxedwine audit](boxedwine-runtime.md#why-the-adoption-gate-stays-closed) records a
separate, **unadopted** 25R1 engine trial. No Boxedwine/Wine binary or guest image
is included in this repository's production assets.

## Pinned provenance and source inventory

- npm `emulators@8.5.3`, git commit
  `e6f4e5449a5b17ae3ea0fdccfd453c8d299e9ea5` in
  <https://github.com/caiiiycuk/emulators>. GPL-2.0; retain the actual LICENSE.
- Classic DOSBox submodule `528578d5a6f76afd4d5ef4e722b5670826f1183a`
  in <https://github.com/js-dos/dosbox>. GPL-2.0-or-later source grants.
  The built-in DOS services, BIOS behavior and bitmap fonts are core source;
  no separate ROM, DOS image or Microsoft file is downloaded.
- `emulators.js`: wrapper/protocol (GPL-2.0), Browserify prelude/process shim and
  core-js 3.30.0 (MIT), and MiniLZ4/node-lz4 (MIT). The full npm source map
  preserves bundled JS source, including exact generated Build metadata; separate
  source tarballs and full notices are retained for the bundled npm dependencies.
- `wdosbox.js` / `wdosbox.wasm`: DOSBox, js-dos bridge, libzip 1.5 (BSD-style
  per-file grants), zlib (zlib license), SDL_net (zlib-style grant), MAME sound
  sources (GPL-2.0-or-later headers), and Emscripten glue/runtime
  (MIT / University of Illinois-NCSA; musl MIT; libc++ Apache-2.0 with LLVM
  exceptions, including its GPLv2 combination waiver). SDK 3.1.28 pins zlib
  1.2.13; its source hash was checked against the SDK port. Full grants/notices
  are retained in source and `vendor/dos/NOTICE.txt`.
  Sokol, GL4ES, DOSBox-X and the standalone wlibzip module are not loaded.
- FreeDOS MEM **1.12**, FreeDOS 1.4 repository package: GPL v2, actual license
  and source included. English messages are built in; this test uses MEM.EXE alone.
- FreeCOM **0.86**, official `command.zip` package: GPL v2, with SUPPL library
  LGPL v2 source and build instructions included. English COMMAND.COM includes
  its message resource. Original project INPUT.TXT and BEL+CRLF BELL.TXT are packaged alongside it.
  Source packages and their compiler/build files are preserved; no proprietary
  compiler, OS, or ROM is redistributed.

Exact downloaded, retained and served artifact hashes are recorded in
`vendor/dos/manifest.json`. Fixture binaries are unmodified upstream artifacts.
The sample ZIP is authored deterministically from the audited binary plus a text
resource. Fixtures are developer acceptance inputs, never auto-run downloads.

## Reproduction and limitations

The npm tarball is pinned by lockfile integrity. `npm run runtime:assets` checks
the three exact upstream asset SHA-256 values and copies only those files into
`public/runtimes/js-dos/8.5.3/`. Production and development run this step first.
No postinstall script or runtime CDN request is needed. Our adapter changes no
upstream executable bytes. Its network confinement code is separate application
source, retained with the application.

The retained emulator source archive contains src/, native bridge/libraries,
targets/, build scripts, lockfile, CMakeLists.txt, Dockerfile and license. Upstream
test game binaries/screenshots and unrelated submodules are excluded. The pinned
DOSBox archive supplies native/dosbox. The source map retains the actual npm wrapper
sources, and `npm-build.ts` preserves its timestamp-seeded build metadata.

[Retained materials and source rebuild instructions](../vendor/dos/README.md)
distinguish the original all-target build from a classic-only build. The original
all-target gulp/Docker build needs extra submodules/test files; do not claim that
running it against the filtered archive has been verified. SDK 3.1.28, original
classic compiler flags, source grants, fixture makefiles and compiler notes are
retained/documented. Toolchain binaries are not redistributed.

`runtime:assets` verifies retained source/fixture hashes and copies full DOS notices,
source archives and their manifest alongside local dist assets. These files are
not requested by the player and contain only reviewed upstream material. No fixture
binary is auto-downloaded or executed by the product. The opaque host, confinement,
frame/input/audio bridge and lifecycle code are PHANTOM source, not vendor patches.

These are upstream prebuilt binaries, not a claimed bit-for-bit local rebuild.
Reproducing binary hashes from source remains an unresolved release gate.
The original-project license is now selected; the [Prompt 11 build experiment](source-rebuild.md)
records actual compiler results, differences and remaining work. The local development integration can be tested without publishing a build.
The local integration passed [real fixture/browser acceptance](evidence/prompt-5.md);
that result establishes only the documented execution scope, not a public-release
license or bit-identical source rebuild claim.
