# Prompt 3 acceptance evidence

Date: **2026-11-21**, Europe/Istanbul. Scope: local ZIP/folder/file intake and
normalized package preservation. No emulator, OS or real legacy program was run.
The repository remains an uncommitted working tree; the
[source hash snapshot](prompt-3-source-hashes.json) identifies the tested import code,
contracts, tests/configuration and dependency lock. No Git commit/push was performed.

## Commands and outcomes

| Command/check | Observed final result |
| --- | --- |
| `npm install --save-exact fflate@0.8.3` | Passed; pinned patched codec, npm reported zero vulnerabilities |
| `npm audit --json` | Passed; zero reported vulnerabilities in the pinned dependency tree |
| `npm run typecheck` | Passed strict TypeScript, exact optional properties and unchecked-index checks |
| `npm run lint` | Passed, zero warnings |
| `npm test` | **112 passed across 7 files** |
| `npm run build` | Passed; production app includes its build-owned ZIP worker source inline, not an emulator |
| `npm run test:browser` | **34 passed**, 17 desktop Chrome and 17 Pixel 7 emulation; zero retries, console errors or page exceptions |
| `npm run test:production` | Passed desktop/mobile production imports both online and offline after Inspect loads; strict CSP, zero HTTP requests during imports, no persistent user storage and zero surviving workers |
| `npm run check` | Passed combined typecheck → lint → unit → build → browser → production checks |
| Visual review | Actual desktop 1440×1100 and Pixel 7 (412 CSS px) browser captures inspected; no horizontal overflow; file paths/reasons wrap and radio choices remain visible |

Node **24.19.0**, npm **11.17.0**, macOS **26.6.2**, arm64; Playwright **1.65.1**;
actual Google Chrome **157.0.8103.79**. Pixel 7 uses Playwright device emulation,
not physical Android verification. Firefox and Safari were not run.
Lock SHA-256: `f5dd49e4e589cef4ce27fc7a573e987003d98c8a746d263c2613ed794e7cc613`.
[Production results and built asset hashes](prompt-3-production.json) include the
app bundle containing the worker. Runtime/guest hashes: **not applicable**, none installed.

The browser suite now owns `127.0.0.1:4176` in Vite test mode with hot reload disabled.
The normal dev workflow retains hot reload. The production smoke test serves only
`dist/` at an ephemeral loopback port and closes its browser/server after testing.
Its `connect-src 'none'` and `worker-src 'self' blob:` policy is a test-server policy,
not a claim that a deployment has been configured. Build before running it alone.

## Observed behavior and preservation

- Real ZIP and folder picker flows progress selected → inspecting → unsupported
  (execution unavailable). Progress and cancellation reflect actual local work.
- A DOS-header package retains its executable, data subdirectory, configuration,
  documentation, inert autorun script, empty file and empty directory. In a real
  browser worker, **all six normalized file SHA-256 values match their authored
  originals**. Empty ZIP directories remain in `directories`. This verifies the
  adapter input contract, not a running guest filesystem.
- A mixed package retains eight files and presents two distinct MZ/PE candidates.
  No candidate is selected by archive order or file suffix. Keyboard radio choice
  persists across views; previewing a different header does not change the choice.
  DLL/driver-like files remain possible resources, and installer names have cautions.
- The native folder picker preserves `SelectedFolder/APP/DATA/LEVEL.DAT` and empty
  resource files. Browser-supplied paths pass the same validation as ZIP paths.
- The explorer filters paths and pages 40 rows/20 candidate choices. Resource roles
  are visible hints, never asserted resolved dependencies. Disk images stay intact.
- Empty/corrupt/ZIP-slip imports return fixed readable errors without a partial
  package. Replacing the selection recovers. A real 16 MiB extraction can be cancelled;
  its worker terminates and a subsequent package imports normally.
- No selected script is evaluated; no guest output, canvas or mock Run result was
  added. Compatibility remains not assessed and Run disabled.

## Security and privacy checks

Unit cases include stored/Deflate payloads, signed data descriptors, CRC/actual-size
mismatches, invalid Deflate, all-empty/directory-only ZIPs, truncated records,
local/central name disagreement, overlapping/hidden records, ZIP64/encryption,
unsupported methods, Unix links/special modes, unsafe/absolute/drive/UNC paths,
normalized/case aliases, file-parent collisions, too many entries, per-file and
aggregate size ceilings, 100:1 expansion limits, lying output lengths, cumulative
probe limits and abort checks. ZIP reads are observed to stay at or below 64 KiB.
Worker lifecycle doubles are used **only in unit tests** for deterministic timeout
and startup-failure cases; real browser workers prove extraction and cancellation.

No extractor writes to a host filesystem. Rejected ZIP-slip input never yields a
virtual package. Valid files live as immutable Blob handles under checked relative
paths. Nested archives remain opaque and count as retained bytes, never recursively
expanded. Selecting an entrypoint keeps the same file array and directories.

Development browser tests collect context-wide requests (including workers), page
websocket frames, worker lifecycle and origin storage. They block external origins
and observe only fixed local static GETs; no sentinel filename, path, script body
or base64 package appears in traffic. Imported script content remains inert.
The built production test additionally observes:

- Inspect loads fixed app assets, then ZIP import causes **zero network requests**.
  Playwright records two local `blob:` worker loads per profile; those are in-browser
  code loads, not HTTP uploads or remote worker downloads.
- Online import and a second import with Chrome networking disabled both pass.
  All eight files and two candidates remain visible. Workers are created from the
  bundled build-owned source; user bytes are passed by structured clone only.
- `localStorage`, `sessionStorage`, IndexedDB and Cache Storage stay empty.
  Completed workers drop to zero. No service worker, guest connection or telemetry
  exists in this implementation; no guest networking behavior is claimed tested.

This is evidence for the recorded corpus/build/browser, not a universal security
proof or a measured portable browser-heap ceiling. Exact limits and ZIP exclusions
are documented in [package-import.md](../package-import.md).

## Resolved findings during implementation

- The initial fflate 0.8.2 candidate had a reported malformed-ZIP64 loop. It was
  replaced with audited/pinned 0.8.3 before completion; no whole-archive library
  extraction API is used. Full MIT notices ship with the build.
- A unit test caught missing folder-relative metadata; it now receives a fixed
  invalid-path error. An empty Deflate stream was also explicitly rejected.
- Old ZIP-header-only browser expectations were updated to the new import behavior;
  unit tests still retain the header-only probe checks.
- A development test run was interrupted by a Vite `full-reload` event triggered by
  `src/packages/zip.ts`; three mobile checks lost their temporary session. Dedicated
  test mode now disables hot reload. The final 34-test run passed without retries.
- The first production worker used a separate script URL. Repeating import offline
  exposed a safe worker-start failure. Worker source is now bundled with the app;
  both production profiles pass the offline repeat. The network assertion explicitly
  distinguishes local Blob loads from HTTP requests.

## Changed files and reproduction

- Domain/intake: `src/domain/contracts.ts`, `errors.ts`, `session-machine.ts` and its
  tests; `src/intake/local-file.ts`; aggregate read limits in
  `src/inspection/selection-inspector.ts`.
- Package boundary: new `src/packages/limits.ts`, `paths.ts`, `virtual-package.ts`,
  `crc32.ts`, `zip.ts`, `zip.worker.ts`, `zip-worker-client.ts`,
  `package-analysis.ts`, and package/worker unit tests.
- UI/controller: `src/app/App.tsx`, `use-session.ts`, `screen-props.ts`, `logger.ts`,
  `components/PackageExplorer.tsx`, Home/Inspect/Compatibility/Workspace screens
  and `src/styles.css`.
- Tests/tooling: `tests/fixtures/package-fixtures.ts`, fixture README,
  `tests/browser/packages.spec.ts`, analyzer/smoke tests,
  `tests/production-smoke.ts`, `package.json`, lockfile, Vite/Playwright configs.
- Documentation/licenses: AGENTS, README, product/architecture/matrix/analyzer docs,
  `docs/package-import.md`, dependency inventory, notices and this evidence set.

Run `npm run check`. Generate manual ZIP/folder inputs using
[fixture instructions](../../tests/fixtures/README.md). Fixture package/per-file
hashes and provenance are in [the fixture manifest](prompt-3-fixtures.json).
The bytes are original synthetic parser/import data, not real DOS/Windows apps.
No third-party guest binary or OS was downloaded. Live test artifacts remain in
ignored `test-results/`, `playwright-report/` and `.playwright-mcp/` paths.

No remaining Prompt 3 blocker. Deliberate limitations: ordinary ZIP subset only;
no encrypted/ZIP64/multi-volume import, recursive extraction, legacy CP437 names,
link/permission restoration or disk mounting. Folder pickers do not expose empty
folders or host link metadata. Peak heap is unmeasured. Cold offline startup and
uncached route navigation are not claimed. No emulator/execution path exists.
Next permitted stage: **Prompt 4 — deterministic planner and launch profiles**.
