# Dependency inventory — Prompts 1, 3 and 5

Reviewed 2026-11-21. Versions/licenses were read from the public npm registry before
installation, then checked against the installed package metadata and license files.
`package-lock.json` pins transitive versions, registry origins, integrity hashes and
license identifiers. The Prompt 5 DOS adoption is separately documented in
[the runtime license audit](runtime-license-audit.md), with retained full source,
licenses and hashes; this updates the earlier frontend-only inventory.

## Direct dependencies

| Package | Pinned version | License | Role |
| --- | --- | --- | --- |
| emulators | 8.5.3 | GPL-2.0 metadata; per-file grants audited separately | Lazy classic DOSBox worker; includes bundled dependencies detailed in the runtime audit |
| fflate | 0.8.3 | MIT | Streaming Deflate codec in the local ZIP worker; no production transitive dependencies |
| react | 19.3.1 | MIT | Browser runtime |
| react-dom | 19.3.1 | MIT | Browser runtime |
| @eslint/js | 10.0.1 | MIT | Development lint rules |
| @playwright/test | 1.65.1 | Apache-2.0 | Real browser tests; retains LICENSE and NOTICE |
| @types/node | 24.10.0 | MIT | Development type declarations |
| @types/react | 19.3.0 | MIT | Development type declarations |
| @types/react-dom | 19.3.0 | MIT | Development type declarations |
| @vitejs/plugin-react | 6.3.0 | MIT | Development/build transform |
| eslint | 10.15.0 | MIT | Development lint tool |
| eslint-plugin-react-hooks | 7.1.1 | MIT | Development React rules |
| eslint-plugin-react-refresh | 0.5.8 | MIT | Development refresh rules |
| globals | 17.14.0 | MIT | Development lint definitions |
| typescript | 5.9.3 | Apache-2.0 | Type checking; version chosen within typescript-eslint's supported range |
| typescript-eslint | 8.73.0 | MIT | Development TypeScript lint tool |
| vite | 8.3.8 | MIT | Dev server/bundler; generated browser preload helpers |
| vitest | 5.1.1 | MIT | Unit tests |

The separately resolved production transitive npm dependency is **scheduler 0.28.0 (MIT)**.
The emulators tarball also contains bundled JS and compiled WASM dependencies;
the lockfile alone does not enumerate those. See the DOS source/notice inventory.
Full MIT notices for React, React DOM, Scheduler, fflate and Vite's generated helpers are
included in [the shipped notice file](../public/third-party-notices.txt). Vite's
development package also bundles separately licensed utilities; its full
`node_modules/vite/LICENSE.md` retains those notices.

## Transitive review and distribution boundary

The Prompt 5 lockfile contains 214 non-root package entries, including optional
binaries for operating systems not installed here. Every entry has a license field:
160 MIT, 19 Apache-2.0, 12 MPL-2.0, 10 ISC, 6 BSD-2-Clause, 2 BSD-3-Clause,
2 BlueOak-1.0.0, 1 CC-BY-4.0, 1 GPL-2.0 and 1 0BSD. Bundled emulator internals
require the separate source-level inventory; they are not additional lock entries.

Notable development-only components:

- Lightning CSS 1.33.0 and its platform binaries use MPL-2.0. They are build tools,
  not browser dependencies. A future distribution of modified tool binaries must
  separately satisfy their source/license requirements.
- caniuse-lite 1.0.30001826 uses CC-BY-4.0 for compatibility data used by tooling.
  Do not omit its attribution if distributing that dataset/toolchain.
- minimatch 11.0.9 and @isaacs/nonrecursive-glob-match 1.1.0 use BlueOak-1.0.0.

The release boundary for this stage is the built `dist/` directory, not `node_modules`.
No toolchain redistribution or modification is planned. A public source release must
retain package/license notices and establish the project's own license. Prompt 11 selects GPL-2.0-only for original source after the
[recorded compatibility review](release-license-review.md); the npm package stays
private to prevent accidental registry publication. The Prompt 5 emulators build adds
GPL obligations; permissive frontend licenses do not waive them. No public release
is authorized or cleared by the local development adoption.

Re-audit on any dependency or output change. License identifiers and npm audit are
not substitutes for reviewing actual distributed contents. Runtime assets must pass
the separate [emulator license gate](architecture.md#dependency-and-license-gate).

## Prompt 3 ZIP dependency decision

Selected **fflate 0.8.3**, using only its `Inflate` stream in our dedicated worker.
The library has no production dependencies. Its installed MIT license grants
redistribution with the copyright/permission notice; the full 2026 Arjun Barrett
notice ships in `public/third-party-notices.txt`. Source package and browser ESM
were inspected; no modified library source is distributed. No emulator license
choice follows from this permissive compression dependency.

- Upstream: https://github.com/101arrowz/fflate/tree/v0.8.3
- Registry origin: https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz
- npm integrity: `sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==`
- Browser ESM SHA-256: `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1`
- License SHA-256: `0a1df3a083d0c010560aa342e87959c8c1070e6fd54545741f083f22d0c8b551`

An initial 0.8.2 install was rejected by review after npm audit identified
[GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98), a malformed
ZIP64 `unzipSync` loop. The lockfile now pins patched 0.8.3 and npm reports zero
vulnerabilities. PHANTOM does not call `unzipSync` or any whole-archive extractor:
our checked central-directory reader rejects ZIP64, validates paths/limits, then
streams small compressed chunks through `Inflate`. Worker termination is an
additional availability limit, not a proof of hostile-code isolation.
