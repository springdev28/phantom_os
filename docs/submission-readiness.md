# Kiroween 2026 Resurrection — readiness, not a submitted entry

Reviewed 2026-11-22 against the [official rules](https://kiroween.devpost.com/rules).
The proposed category is Resurrection: preserving access to legacy software through
a modern local browser workflow. Registration, entrant eligibility, terms acceptance
and submission have not been performed or asserted here.

The deadline is **2026-12-04 22:00 UTC / 2026-12-05 01:00 Europe/Istanbul**.
The rules require meaningful actual Kiro use, a root `.kiro` directory, a public
licensed GitHub repository, a functional application URL, a public YouTube demo
under three minutes and an explanation of Kiro use. Keep the functional project
available without charge/restriction for judging through 2027-01-29. Recheck the
official rules before entry; this readiness record is not an eligibility ruling.

| Requirement | Current evidence / remaining action |
| --- | --- |
| Meaningful actual Kiro use | **Not evidenced.** Installed IDE/help/version is insufficient. Execute a bounded task from `.kiro/specs/submission-validation/tasks.md` in Kiro and retain the actual diff/tests/session evidence. |
| Root `.kiro` tracked, not ignored | Specs and steering prepared in Codex; no automatic hooks. Check Git tracking after publication. This is an artifact requirement, not proof of participation. |
| Public licensed GitHub source | Target is [springdev28/phantom_os](https://github.com/springdev28/phantom_os). Original code is GPL-2.0-only after the recorded dependency review. Publication status and exact commit belong in Prompt 11 evidence. |
| Reproducible install/build | Fresh-source `npm ci` and full gates are recorded in Prompt 11 evidence. Do not infer a hosted CI result from a local run. |
| Source/license completeness | Full grants and pinned sources retained; two unused unaudited benchmark binaries removed. Native rebuild experiment is incomplete as a release replacement; upstream bit-identical rebuild remains unproven. |
| Deployed working HTTPS demo | **No verified URL.** Do not publish runtime assets until the source rebuild/release gate is resolved. Then preserve actual CSP/permissions, source downloads, no telemetry and page/worker privacy checks. |
| Public YouTube video under 3 minutes | **No published URL.** A 2:55 script and reproducible genuine local evidence capture are prepared. Record/review the actual release build, publish publicly and verify signed out. |
| Written Kiro explanation | Honest pending record in `kiro-usage.md`; replace the template only with substantiated session facts. |
| Windows segment | Disabled. Film the visible limitation; no Windows launch claim. |

## Remaining work in order

1. Perform meaningful Kiro work using K1 or K2, then document what actually changed.
2. Resolve runtime rebuild/source reproducibility with K4. The current SDK 3.1.28
   build needs an optimizer compatibility patch, produces different hashes and
   retains Asyncify warnings. The TypeScript wrapper and resulting guest behavior
   still need validation. Preserve the existing working DOS path meanwhile.
3. After the release gate closes, deploy the audited build and its corresponding
   sources to HTTPS with the shared CSP/permission headers. Run K3 against that
   actual URL, including real launch/input/export/stop and observed network traffic.
4. Rehearse and record [the genuine demo script](demo-script.md), fill the Kiro
   contribution sentence from the ledger, verify duration and publish to YouTube.
5. Review source/license links, exact URLs, category and entrant requirements;
   the participant then submits. Do not invent missing URLs or eligibility facts.

## Factual project description draft

PHANTOM OS inspects a user-selected legacy package locally, explains detected
formats and runtime requirements, preserves support files, and lets the user
explicitly choose an entrypoint. The js-dos adapter displays real DOS output,
accepts input and exports guest-written documents. Opt-in browser storage can
save a package, working files and a launch profile; no account is required.

Two exact GPL DOS fixtures have observed Chrome/Firefox runs. General DOS
compatibility is experimental. Windows is disabled; ELF/PE64/Mac/disk execution
is unavailable. Bounded parsing, path/extraction limits, an isolated runtime host
and observed network checks define the local-processing boundary. These do not
guarantee containment of malicious programs or universal application compatibility.

This description deliberately makes no completed Kiro, hosting or video claim.
