# DOS source rebuild experiment — 2026-11-22

The tested application still uses the three pinned official `emulators@8.5.3`
assets. **No experimental output from this attempt was adopted or distributed.**
This experiment advanced source reproduction; it did not close the release gate.

## Inputs and observed outcomes

- Filtered source archive and DOSBox submodule: exact pins in
  `vendor/dos/manifest.json`; corrected archive SHA-256
  `38910afe4d3e51bf6507aff18f71216e05cf48284ed75b56fc40d449691f026f`.
- Emscripten SDK 3.1.28 (upstream Dockerfile's pin), CMake 3.27.9, Ninja 1.11.1.1;
  macOS arm64. Tools installed only in `/private/tmp`; no guest program ran natively.
- Docker client was installed but its daemon was unavailable. A native SDK cross
  build was attempted instead. SDK installation first failed TLS trust, then
  succeeded using the system CA bundle with certificate verification enabled.
- A classic-only CMake patch disables unused GL4ES and excludes unrelated targets.
  Configure passed. The first compile attempt could not fetch zlib in the sandbox.
  The retained zlib archive matched the SDK's exact SHA-512 and was placed in its
  port cache; no alternate zlib version or TLS bypass was used.
- Compilation reached linking, then SDK Acorn generated invalid `for(;of ...)`
  from the source's destructured for-of loop. A small working-copy patch replaces
  it with iteration over keys and lookup of the same object values.
- The patched native target emitted JS/WASM. Asyncify missing-pattern warnings
  remain; output hashes differ from the tested upstream build. The wrapper build
  and real guest/browser tests of these outputs were **not performed**.

[Machine-readable results](evidence/prompt-11-source-build.json),
[classic-only patch](evidence/prompt-11-classic-only.patch),
[SDK compatibility patch](evidence/prompt-11-sdk-compat.patch),
[failed build log](evidence/prompt-11-native-retry.log),
[patched build log](evidence/prompt-11-native-patched.log).
Long generated JavaScript/command lines are explicitly omitted from the retained
logs; the failure and reproduction remain visible. These are compiler logs, not
invented guest output.

## Reproduce the experiment

In a fresh temporary working directory, extract `emulators-source.zip`, then the
contents of the pinned DOSBox tarball's top directory into `native/dosbox/`.
Apply both retained patches with `patch -p1 < /absolute/path/to/the.patch`.

Install the official [emsdk](https://github.com/emscripten-core/emsdk) tag 3.1.28
and run `./emsdk install 3.1.28`, `./emsdk activate 3.1.28 --embedded`, then source
its `emsdk_env.sh`. CMake 3.27.9 and Ninja 1.11.1.1 were installed in a separate
Python venv. Do not overwrite the project's Node 24 environment with SDK Node
when subsequently building PHANTOM.

```sh
emcmake cmake -S . -B build/wasm -GNinja -DCMAKE_BUILD_TYPE=Release -DDOSBOX_DEBUG=OFF
cmake --build build/wasm --target wdosbox -j4
```

If offline, verify retained `zlib-1.2.13.tar.gz` SHA-512 equals the `HASH` in SDK
`tools/ports/zlib.py`. Extract it under SDK `cache/ports/zlib/` preserving its
`zlib-1.2.13/` directory and write the exact expected source URL plus newline to
`cache/ports/zlib/.emscripten_url`:
`https://github.com/madler/zlib/archive/refs/tags/v1.2.13.tar.gz`.
This seeds the SDK's normal port cache from the checked source; it does not turn
off content verification or patch zlib. Keep source files and build logs.

Native link output is not the complete distributable adapter. Upstream's footer,
module substitutions and TypeScript wrapper pipeline are documented in
[vendor/dos/README.md](../vendor/dos/README.md). Complete those, resolve the warning
and upstream toolchain discrepancy, compare hashes/source behavior, and run the
full PHANTOM browser/privacy regression before proposing any new runtime pin.
Kiro task K4 is scoped to this concrete remaining work. Do not replace the
working assets merely because a compiler emitted a `.wasm` file.
