# Prompt 1 acceptance evidence

Date: 2026-11-21, Europe/Istanbul. Scope: the frontend foundation only.
The repository still has no commit, so this report refers to the local Prompt 1
working tree. No emulator or third-party application fixture was installed or run.

## Observed frontend behavior

- The Vite app loads Home, Inspect, Compatibility, Player and Workspace in a real
  Chrome browser. Direct hash routes, keyboard skip link, route-heading focus,
  empty/loading states and recovery from an invalid selection were exercised.
- Choosing a synthetic text file named `PRIVATE_SELECTION_SENTINEL.exe` advances
  from idle to selected. **Check file access** performs a local read, transitions
  through inspecting, then produces the explicit execution-unavailable state.
  The file remains unknown/not inspected; its `.exe` name causes no format verdict.
- Run stays disabled. Player has no simulated canvas, video, iframe, or program
  output. Workspace reflects/clears the selected reference. Reload loses the selection.
- Cancellation/clear during a deliberately delayed native file read cannot revive
  the previous selection. This delay exists only in that test, not product code.
- Browser request and outgoing dev-websocket inspection found no synthetic file
  name, content or base64 content transmitted. All observed HTTP requests were local
  GETs. No service worker, localStorage/sessionStorage entry, IndexedDB database or
  Cache Storage entry was created by the tested journey.

## Commands and results

| Check | Result |
| --- | --- |
| `npm install --cache /private/tmp/phantom-npm-cache` | Passed; pinned packages installed; npm reported no vulnerabilities |
| `npm run dev -- --port 4173 --strictPort` | Passed; real local Vite server started |
| `npm run typecheck` | Passed with strict mode, unchecked-index checks and exact optional properties |
| `npm run lint` | Passed with zero warnings after correcting an intentional control-character check |
| `npm test` | 20 tests passed across 4 files |
| `npm run build` | Passed; five screen chunks are lazy-loaded; no engine assets in the build |
| `npm run test:browser -- --workers=2` | 12 tests passed: 6 journeys each at desktop and emulated-mobile sizes; zero console errors/page exceptions |
| `npm run check` | Final combined run passed: strict typecheck, lint, 20 unit tests, production build and all 12 browser tests |
| Production browser smoke against `dist/` | Passed in Chrome 157.0.8103.79: Home → select synthetic file → check access → compatibility with Run disabled; zero console errors/page exceptions |

Unit coverage includes lifecycle guards, stale completions, cancellation, launch
preconditions, local read bounds, misleading filenames, input rejection, safe logging,
and on-demand runtime loading. Fake adapters/eligible plans appear only in unit tests;
they are contract tests and **not emulator verification**.

Toolchain: Node 24.19.0, npm 11.17.0, macOS 26.6.2, arm64. Lockfile SHA-256:
`516609ee39b30693a4611b0aa28fd06e5f78f192f5c194558b7edab27b739648`.

The browser suite uses the installed Chrome channel and Playwright 1.65.1. Visual
inspection used Chrome 157.0.8103.79 on macOS at 1440×1000 and 393×852. Automated
desktop uses Playwright's Desktop Chrome profile; mobile uses its Pixel 7 profile.
This is responsive-layout testing in desktop Chrome, not proof of an Android device,
Firefox, Safari, or guest-runtime compatibility.

## Reproduction and limitations

Follow [README.md](../../README.md). The test creates its own plain-text byte buffer;
no personal file or copyrighted legacy executable is needed. Browser reports are
generated in `playwright-report/`; failed-run traces/screenshots go in `test-results/`.
These disposable directories are ignored by Git.

Initial checks encountered cloud-placeholder dependency files that blocked local
reads. A local temporary dependency installation from the same lockfile was used to
resolve that environment issue, then copied back into a regular workspace
`node_modules` directory; the app no longer depends on the temporary path.
The folder materialized some dependencies as on-demand files again; those generated
files were restored from the same local install before the final combined check.
That final run used the regular workspace `node_modules` directory and passed.
Later `npm run preview` startup attempts stalled on another on-demand dependency;
two early production smoke attempts received connection-refused errors. These are
not counted as passes. The final production smoke used the same built `dist/`
served by `python3 -m http.server 4174 --bind 127.0.0.1 --directory dist`, and passed.
The stalled preview processes were stopped. On-demand storage can delay future
local tooling reads; keeping this project and its dependencies downloaded avoids
that environment dependency.
Earlier stopped checks are not counted as passes.
An initial test typo and a lint finding were corrected before the passing runs.

No format parser, archive extraction, guest execution, persistent workspace or file
export has been verified. The next permitted stage is Prompt 2. Future runtime
integrations must repeat privacy and browser checks against their actual behavior.
