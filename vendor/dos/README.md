# Retained DOS runtime and fixture materials

Adopted for private local development, 2026-11-21; reviewed with Prompt 5 acceptance
on 2026-11-22. This directory is provenance/source material, not imported user data.
See `manifest.json` for SHA-256 and sizes, `NOTICE.txt` for full notices, and
`../../docs/runtime-license-audit.md` for the adoption decision and release gates.

- `emulators-source.zip`: upstream commit e6f4e5449a5b17ae3ea0fdccfd453c8d299e9ea5,
  source, native bridge/libraries, CMake targets, gulp build scripts and yarn lock.
  Upstream test game binaries/screenshots and unrelated submodule contents excluded.
  Prompt 11 additionally removes two overlooked native/dhry2/bin benchmark EXEs;
  see the explicit correction in ../../docs/release-license-review.md.
- `dosbox-source.tar.gz`: exact classic DOSBox submodule
  528578d5a6f76afd4d5ef4e722b5670826f1183a; fills `native/dosbox/`.
- `emulators.js.map`: original npm source map, including bundled source and licenses;
  `npm-build.ts` preserves its exact generated build seed/version metadata.
- `core-js-3.30.0.tgz`, `browser-pack-6.1.0.tgz`, `process-0.11.10.tgz`: exact
  separately licensed JS dependencies in that map and upstream lockfile.
- `zlib-1.2.13.tar.gz`: upstream SDK 3.1.28 port, verified against the SDK's SHA-512.
  Libzip 1.5 and SDL_net sources/notices are inside `emulators-source.zip`.
- Emscripten, musl and libc++ license texts: from SDK tag 3.1.28. Libc++ uses the
  Apache license with LLVM exceptions, including its GPLv2 combination waiver.
- `mem-source.zip`, `mem-LICENSE.txt`: official FreeDOS MEM 1.12 corresponding source.
- `freecom-source.zip`, `freecom-LICENSE.txt`, `suppl-LICENSE.txt`: official FreeCOM
  0.86 corresponding source, bundled message resources and SUPPL LGPL v2 materials.

## Reproduce the exact application assets

From the PHANTOM root, Node 24: `npm ci` then `npm run runtime:assets`.
The lockfile pins the official npm tarball. The script verifies all three upstream
JS/WASM hashes, builds the separate PHANTOM host from source, and verifies/copies
retained notices and sources alongside the generated runtime. `npm run build` does
this automatically. No emulator executable bytes are patched. No fixture runs on
the host. `public/runtimes/` is generated/ignored; preserve its source subdirectory
if copying a local `dist/` build.

## Rebuilding upstream from C/C++ and TypeScript

This recipe is supplied for source access, **not a claimed locally tested or
bit-identical rebuild**. The upstream timestamp-seeded Build metadata and SDK/tool
versions affect output. Do not replace the pinned assets without a new audit and
browser acceptance. Public release remains blocked until this rebuild and the
source-to-binary correspondence review are completed. Prompt 11 has selected
GPL-2.0-only for original PHANTOM source. The actual partial rebuild, patches,
failures and remaining validation are recorded in `../../docs/source-rebuild.md`.

1. Extract `emulators-source.zip` to a separate directory. Extract the contents of
   the DOSBox archive's top-level folder to its `native/dosbox/` directory.
2. Install Emscripten **3.1.28** (the retained upstream Dockerfile's SDK), CMake
   >=3.21, Ninja and the upstream Node/Yarn toolchain. Activate `emsdk_env.sh` and
   run `yarn install --frozen-lockfile`. The original Dockerfile's all-target
   commands also need non-DOSBox submodules and upstream `test/`; this filtered
   source bundle intentionally does not include their game binaries.
3. For the classic target only, retain the root CMake setup and the `zip.cmake`
   and `dosbox.cmake` includes. Remove the `dhry2`, `sokol`, `dosbox-sdl`,
   `dosbox-x-sdl2` includes and the trailing `sokol-shaders` custom target from
   that **working copy**. Keep this patch with any new output; the archived
   original remains unchanged. No classic `wdosbox` source/flags need changing.
4. Run `emcmake cmake -S . -B build/wasm -GNinja -DCMAKE_BUILD_TYPE=Release`,
   then `cmake --build build/wasm --target wdosbox`. The pinned zlib source is
   available here for the Emscripten port cache; its SDK port patch/config remains
   in upstream SDK 3.1.28 `tools/ports/zlib.py`.
5. Follow `gulpfile.ts/emulators.ts`: copy generated wdosbox.js/wasm to `dist/`,
   append `src/dos/dosbox/ts/worker-server.js` to JS, replace `@MODULE_NAME@` with
   `WDOSBOX` and `@SOCKDRIVE@` with empty text. For the wrapper, restore
   `npm-build.ts` to `src/build.ts` and expose/run the existing `compileJs` gulp
   task. It uses Browserify/tsify, Babel core-js and Terser from `yarn.lock`.
   The original default gulp task builds additional engines and is not a shortcut
   for this filtered classic-only build.
6. Record SDK/compiler versions, complete patches, new hashes and source package;
   repeat PHANTOM tests before considering a replacement. Unresolved build failures
   or differences remain release blockers, never a reason to invent a match.

MEM and FreeCOM sources retain their own makefiles, compiler notes and grants.
Their original executable members are used unchanged. Compiler binaries are not
redistributed. Fixture reconstruction instructions are in `../../tests/fixtures/dos/README.md`.
