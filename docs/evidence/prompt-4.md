# Prompt 4 acceptance evidence

Date: **2026-11-21** (Europe/Istanbul). Scope: typed runtime registry,
deterministic compatibility planning, local launch-profile JSON and UI regression.
**No emulator or guest application was installed or executed.**

## Environment and reproducibility

- macOS 26.6.2, arm64; Node 24.19.0; npm 11.17.0.
- Actual Google Chrome **157.0.8103.79**, Playwright **1.65.1**.
- Browser suite: Desktop Chrome and Pixel 7 responsive emulation. This is not a
  physical mobile-device, Safari, Firefox or guest-execution verification.
- Vite test server: `127.0.0.1:4176`, `--mode test`, HMR disabled, fresh browser
  contexts, no retries. Production acceptance uses an ephemeral loopback static
  server and the existing `dist/` files.
- Git remains an unborn/uncommitted working tree with no configured remote. Source
  identity is recorded by [source hashes](prompt-4-source-hashes.json), not an
  invented commit. No push, deployment, dependency change or distribution-license
  decision is part of this prompt.
- [Fixture hashes](prompt-4-fixtures.json) cover the original deterministic parser
  and ZIP corpus. These bytes are not working DOS/Windows software. No downloaded
  proprietary software, OS image or personal document is used.
- [Production report](prompt-4-production.json) records Chrome/platform, online/
  offline outcomes, observed network/worker counts and exact built-asset SHA-256s.
  Runtime IDs/versions/hashes: **none installed**. The production evidence catalogue
  remains empty.

## Commands and outcomes

| Command/check | Final outcome |
| --- | --- |
| `npm run typecheck` | Passed, strict TypeScript |
| `npm run lint` | Passed, zero warnings |
| `npm test` | Passed: **188 tests in 10 files** |
| `npm run build` | Passed; 51 transformed modules, no engine assets; largest JS approximately 303 kB / 99.3 kB gzip |
| `npm run test:browser` | Passed: **48 tests**, 24 each desktop/mobile layout, no retries, no console errors |
| `npm run test:production` | Passed: desktop/mobile online and offline after relevant views load; two profile round-trips and two ZIP workers per context |
| Local Markdown links, source whitespace, JSON parsing and report/asset hash consistency | Passed; recorded after final writes |
| Manual real-browser UI review | Compatibility decision, adapter control, profile controls and responsive layout reviewed using an original synthetic DOS header; no execution output |
| `npm install` / `npm ci` | Not rerun for Prompt 4; dependency manifests/lockfile unchanged from the earlier accepted installation |

`npm run test:production` requires a preceding build. Its hosting configuration is
`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self';
worker-src 'self' blob:; connect-src 'none'; base-uri 'none'; object-src 'none'`.
Hashed JS/CSS assets have immutable caching; the fixed public favicon has a one-day
cache lifetime. Application HTML is revalidated. This is a developer acceptance
server, not an application backend or deployment.

## What was actually exercised

The planner tests consume real parser results for MZ, PE32/PE32+, Windows/OS2 NE,
ELF, COM ambiguity and disk signatures. They cover wrong extensions, native/EFI/DLL/
non-x86 PE images, corrupt input, mixed ZIP entrypoint choice and unchanged companion
handles. Unsupported formats do not fall back to an MZ stub. No declared missing
library name is invented from header confidence.

Requirements tests cover explicit package/profile dependency references, missing
entrypoint/working directory/mounts, unmounted required files, incorrect version
pins, absent runtime assets, memory ceilings and raw-COM confirmation. Automatic
adapter selection and user override are separate, and mismatches remain blocked.
The reducer rejects stale replans and revokes readiness when requirements change.

Registry tests use **unit-only adapters**, never a demo player. They check lazy
loading/caching, retry, duplicate IDs, incomplete installations, frozen descriptors
and mismatched builds/assets/capabilities. Observed-evidence tests use **unit-only
records** to verify full-package chunk identity and exact profile/runtime/browser
matching, including companion-byte, path, directory, asset/build/configuration and
browser changes. Fake JSON identities and verification assertions cannot match.
Those passing tests establish matching mechanics only, not executable compatibility.

Real Chrome tests select original fixtures, inspect them, explicitly choose an
entrypoint, change adapter override, edit controls/limits, import a missing-library
profile, export actual JSON and import it again. Unknown EXE, MSI/Mac-labelled
opaque input, ELF, ISO and PE32+ retain Inspect/export, including a conflicting
manual override. Raw-COM confirmation resets for a different selection. Unsafe
paths, forged verification and version mismatches show guidance; invalid imports
preserve the prior usable state. Import-before-files and reload-to-empty also pass.

The profile validator checks a closed version-1 schema, 2 MiB read/export ceiling,
runtime pins, relative paths, guest-mount overlaps, enum controls, bounded integer
limits and 2,048 file references. JSON exports contain settings and relative paths
only, not application/document contents, hashes or verification records.

## Network, storage and worker evidence

- Browser tests observe page/context requests, worker traffic and outgoing websocket
  frames using synthetic filename/path/content sentinels. No sentinel is sent in a
  URL, body, socket or external request. No file/profile upload API exists.
- Production uses `connect-src 'none'`, then repeats ZIP → inspection → planning →
  profile export/import while Playwright networking is offline after the needed
  static views have loaded. Every package retains eight files and two candidates.
- Per production context: two actual local Blob workers, both closed; zero workers
  left, zero unexpected requests, zero user-data requests, zero console errors.
  Chrome reports **four fixed `/favicon.svg` requests** across screen changes. The
  icon is cached for offline reuse and contains no selected-data parameters. These
  requests are explicitly counted, not hidden by a claim of zero total requests.
- No localStorage, sessionStorage, IndexedDB database or CacheStorage entry is
  created. Normal browser caching contains only public app assets. Downloaded JSON
  is created only after the explicit Export action and is not a persisted workspace.
- There is no guest network to test because no guest runtime exists. No conclusion
  about a future engine's network isolation follows from these frontend results.

## Failures found and resolved during this prompt

- Typecheck initially found tests importing the removed unavailable-planner stub;
  they now use the deterministic planner and assert no unsupported verification.
  Lint found declaration/unused-binding issues; corrected before final checks.
- Review found that an unsupported format with a manual override could generate an
  inconsistent null-runtime draft. Export now preserves the explicit override ID;
  unit/browser regressions cover the case without granting eligibility.
- The first production privacy assertion expected only worker Blob requests after
  initial view load. Chrome also re-requested the fixed favicon during navigation.
  Allowing only that exact public path exposed offline console failures under the
  test host's original `no-cache` favicon header. Public-icon caching now permits
  offline reuse; the final report retains those four browser request events and
  asserts zero unexpected/data requests and console errors. No user-data exception
  or broad origin allow-list was added to the post-load check.
- Manual mobile review found the Reset profile button retaining the browser's white
  button background. It now uses the existing text-action styling and touch height.

## Changed files

- Contracts/guards: `src/domain/contracts.ts`, `runtime-descriptor.ts`,
  `session-machine.ts`, `session-machine.test.ts`.
- Planner: new `src/planner/compatibility-planner.ts`, its regression tests,
  `verification.ts` and its tests. Removed `src/planner/unavailable-planner.ts`.
- Profiles: new `src/profiles/launch-profile.ts` and tests.
- Runtime registry: `src/runtime/registry.ts` and tests.
- UI: `src/app/use-session.ts`, `screen-props.ts`, `screens/Compatibility.tsx`,
  `screens/Workspace.tsx`, `components/ProfilePanel.tsx`, `components/Shared.tsx`,
  `src/styles.css`.
- Acceptance: `src/inspection/selection-inspector.test.ts`,
  `tests/browser/planner.spec.ts`, `tests/browser/smoke.spec.ts`,
  `tests/fixtures/planner-fixtures.ts`, `tests/fixtures/README.md`,
  `tests/production-smoke.ts`.
- Documentation: `AGENTS.md`, `README.md`, `docs/product-spec.md`,
  `docs/architecture.md`, `docs/compatibility-matrix.md`,
  `docs/compatibility-planning.md`, `docs/analyzer.md`, `docs/package-import.md`,
  and these Prompt 4 evidence files. Earlier evidence remains historical.

## Remaining limits and next permitted stage

No remaining Prompt 4 blocker. Runtime-dependent behavior remains unavailable:
there is no engine, verified program, disk boot/mount, guest I/O, persistent
workspace or resolved library/OS dependency graph. Requested memory and controls
are profile settings, not measured engine behavior or browser-heap limits. macOS
Chrome responsive emulation does not establish actual mobile or other-browser
compatibility. Full-package identity collection is a contract/test primitive;
the current UI never claims an observed execution match.

Next stage, only when requested: **Prompt 5**, select/license/pin a js-dos build and
test two lawful DOS fixtures in the actual PHANTOM browser integration. Boxedwine/
Wine remains the separate Prompt 6 trial; do not implement it as an extension of
this planning task.
