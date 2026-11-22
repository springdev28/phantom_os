# Prompt 11 — truthful submission preparation

Date: 2026-11-22. Work performed in Codex, not Kiro. No contest registration,
submission or terms acceptance was performed. Windows remains disabled.

## Delivered artifacts and provenance

- Root `.kiro` README, always-included product/tech/structure steering and the
  submission-validation requirements/design/tasks spec. No automatic hooks.
  K1–K5 are unchecked remaining Kiro work, not retroactive implementation claims.
- README covers actual browsers, build/run steps, package/guest file import/export,
  OPFS/temporary modes, privacy, fixtures and compatibility limits.
- `docs/kiro-usage.md`, `submission-readiness.md`, `demo-script.md` distinguish
  preparation from meaningful actual Kiro use, hosting and public video.
- GPL-2.0-only original-project LICENSE, explicit README grant, REUSE annotations,
  package/lock metadata and updated third-party attribution follow the recorded
  dependency review. Upstream grants stay intact; the npm package remains private.
- The source audit removed two unused unreviewed benchmark executables. Exact
  hashes and the correction to prior inventories are in
  [the filter record](prompt-11-source-filter.json). Remaining source members and
  runtime asset bytes are unchanged. Eight source archives pass bounded scanning.
- `scripts/audit-source-bundles.py` and seven synthetic regression tests are now
  part of predev/prebuild and therefore CI. No unlicensed regression binary added.
- A repeatable recording command and genuine, unedited 7.48-second local FreeCOM
  clip verify actual keyboard input, exported bytes and worker cleanup. The
  [clip](prompt-11-local-freecom.webm), [record](prompt-11-recording.json) and
  [capture log](prompt-11-recording.log) are evidence, not a finished narrated
  YouTube submission. The 4-second frame was visually checked: actual FreeCom
  0.86 output appears inside PHANTOM's player.

## Commands and outcomes

Fresh source copy at `/private/tmp/phantom-p11-clean`, excluding prior dependencies,
dist, generated runtime assets and test results. Same laptop/browser versions as
[Prompt 10](../compatibility-results.md): macOS arm64, Chrome 157.0.8103.79 and
Playwright Firefox 159.0; Node 24.19.0, npm 11.17.0.

| Command/check | Observed result |
| --- | --- |
| `npm ci` | Passed; 183 installed packages, audit reports zero vulnerabilities. Optional fsevents install-script approval warning retained; no blanket script approval added. |
| `npm run check` | Passed, exit 0: strict typecheck, lint, 275 tests across 16 unit files, source audit, production build, 92 browser regressions, production security/I/O check, 12 Chrome/Firefox core cases. No skipped/flaky/failed Playwright cases. |
| `python3 scripts/audit-source-bundles.py` | Passed: eight retained source archives, manifest pins, no extraction or guest execution. |
| `python3 tests/source-bundles.test.py` | Seven passed: source acceptance, removed benchmark name, disguised executable signatures, unsafe paths, nested archive, member budget, exact text-exception pin. |
| `npm run typecheck && npm run lint` after adding the recording runner | Passed. |
| `npm run record:demo` | One passed; actual FreeCOM input, exact 16-byte `HELLO FROM DOS` + CRLF export, zero console errors, same-origin GET/Blob requests, clean stop. |
| Final `npm run build` after documentation/license changes | Initially correctly failed the retained README hash check; updated that audited file's manifest pin, reran successfully. Runtime hashes unchanged. |
| `.kiro` ignore check | `git check-ignore` returned 1 with no matched paths: not ignored. No `.kiro` ignore patterns are present. |
| Credential-pattern scan | Clean-copy scan of 259 text source/config/evidence files found no private-key/token patterns. This is a bounded scan, not a guarantee. An original-workspace scan stalled on a filesystem read and was stopped after the clean-copy check. |

Full check/build/install logs and production/browser results are retained with
this evidence. The final changes after the full browser run are release metadata,
documentation and recording tooling; original application/runtime source and
tested engine hashes are preserved. Typecheck/lint, source audit and build were
repeated for the final tooling edits. No new laptop performance claim is made.

## Native rebuild experiment and blocker

The [actual rebuild record](prompt-11-source-build.json) and
[reproduction instructions](../source-rebuild.md) preserve failures and patches.
Docker had no reachable daemon. Official SDK 3.1.28 was installed temporarily;
TLS verification remained enabled. A pinned local zlib source resolved a sandboxed
fetch failure. Original linking failed an SDK optimizer syntax transformation;
a documented working-copy compatibility patch emitted native JS/WASM.

Those bytes differ from the tested official assets, carry Asyncify warnings and
have not been integrated, wrapped or browser-validated. A successful native target
is not a verified adapter. **The runtime source-rebuild release gate is not closed.**
No production engine pins were changed to conceal that outcome.

## Submission acceptance still open

The Chromium 159 mobile CI failure; meaningful Kiro work and its truthful usage
explanation; runtime rebuild clearance;
an actual audited HTTPS deployment; and a public YouTube video remain outstanding.
Do not fill missing URLs with examples or claim this task completes submission
eligibility. Independent human usability/screen-reader validation also remains
unperformed. Public source publication alone does not clear runtime deployment.

The next permitted work is the explicit Kiro queue, beginning with K6 for the
newly discovered CI defect; K1/K2 remain further bounded work.
K4 addresses the release blocker and K3 tests the real deployment afterward.
No new runtime or Windows enablement is part of this preparation.

## Public source verification

Published [source commit ef8994b](https://github.com/springdev28/phantom_os/commit/ef8994bf4312f738319a19a572ecec94961845ec)
to the requested public repository's `main` branch. GitHub detects GPL v2;
all seven `.kiro` files are tracked. An unauthenticated raw README request returned
HTTP 200. The [publication record](prompt-11-publication.json) preserves details.

A fresh `git clone --depth 1` from that public URL, `npm ci` and `npm run build`
all passed, separately from the earlier source-copy test. Logs:
[install](prompt-11-github-install.log), [build](prompt-11-github-build.log).
The initial push stalled on workspace object reads; an identical temporary copy
was verified against every Git blob, tree and commit hash before finishing the
same push. No force push, changed source identity or imported user data was used.

The public [CI run](https://github.com/springdev28/phantom_os/actions/runs/44986874082)
**failed**: 79 browser cases passed and 13 mobile canvas-visibility cases failed.
Typecheck/lint/unit/source audit/build passed; later production/core gates did not
run. The [exact reproduction, failed attempts and evidence](../chromium-mobile-blocker.md)
are preserved. No product/test-environment changes were adopted to hide this result.
These publication facts do not
close the runtime-distribution, Kiro-participation or hosted-demo/video gates.
