# Open compatibility defect: Chromium 159 mobile emulation

**Unresolved; do not mark CI or this environment as passing.** This was discovered
by the first public clean-checkout run, not by Kiro. The existing Chrome 157/macOS
and Playwright Firefox 159/macOS observations remain valid for their exact setups.

[GitHub run 44986874082](https://github.com/springdev28/phantom_os/actions/runs/44986874082)
tested source `ef8994bf4312f738319a19a572ecec94961845ec` on Ubuntu 24.04 with
Playwright 1.65.1 / Chromium 159.0.8154.6 (revision 1255). Typecheck, lint, all
275 unit tests, seven source-audit tests and build passed. The browser gate had
**79 passes and 13 failures**, all in the mobile project. Later production and
Firefox/core gates did not run because the chain correctly stopped on failure.
The successful desktop DOS tests record actual browser versions and guest I/O in
[this evidence](evidence/prompt-11-ci-desktop-dos.json); this is not a full Linux
production-support claim.

The emulator produces frames, but `toBeVisible()` correctly rejects the canvas
with a zero-height rectangle. In the local macOS reproduction with the same
Chromium revision and Pixel 7 emulation (DPR 2.625), the parent viewport measures
370 × 419.5 CSS pixels while the sandboxed child reports about 141 × 160. The
wrapped input toolbar needs 260 pixels; the flex canvas collapses to zero.
These are measured observations, not a proven upstream root-cause diagnosis or
evidence that a physical Android device behaves the same way.

## Exact reproduction

```sh
npm ci
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:browser -- tests/browser/dos-runtime.spec.ts --project=mobile-chrome --grep 'MEM.EXE'
```

Use the original supplied GPL MEM fixture and original production iframe/sandbox.
The failure occurs at `tests/fixtures/dos-browser.ts`'s canvas visibility assertion
after the real runtime reports frames. Keep that assertion, real input/export
checks, DPR/mobile settings and the current CI gate. Do not turn this into an
expected failure, substitute a mock viewport, remove sandbox restrictions, or
silently change the browser to obtain a green result.

Two temporary experiments added an iframe-document viewport meta tag and explicit
iframe pixel dimensions. Both reproduced the failure. Neither was adopted; the
temporary helper diagnostics were restored and original application source is
unchanged. A successful compiler/API/frame-counter result is insufficient here.

## Evidence and next task

- [Original CI log](evidence/prompt-11-ci-failure.log) and
  [browser result](evidence/prompt-11-ci-browser.json).
- [Actual failed mobile screenshot](evidence/prompt-11-ci-mobile-failure.png).
- [Local dimensions/reproduction](evidence/prompt-11-chromium-mobile-repro.log),
  [viewport attempt](evidence/prompt-11-chromium-viewport.log),
  [explicit-size attempt](evidence/prompt-11-chromium-explicit-size.log).

Kiro task **K6** must isolate the iframe/emulation sizing behavior and implement a
bounded fix or establish a precise upstream blocker. Validate real visible output,
input, file export, resizing/fullscreen and cleanup in the failing environment and
the previously working browsers. A host-document change creates a new host hash;
re-run security/profile/runtime acceptance and record the new build. This remains
meaningful actual Kiro work to do, not a contribution already credited to it.
