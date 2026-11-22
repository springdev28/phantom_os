# Kiro work queue

All tasks are unchecked. Their presence is not completion evidence.

- [ ] K1: In Kiro, inspect the actual runtime preparation cancellation paths;
  implement delayed-download cancel/reselection browser regressions and fix any
  observed stale-session bug. Validate real MEM launch/input/export after retry.
- [ ] K2: In Kiro, extend source audit tests for tar symlinks/hardlinks, duplicate
  entries, entry-count and cumulative-size boundaries. Fix only observed defects.
- [ ] K3: In Kiro, implement a reusable HTTPS acceptance command using shared
  policy; test actual DOS output/input/export/cleanup plus page/worker privacy.
  Run against a real candidate deployment only after its release gates close.
- [ ] K4: In Kiro, review source rebuild failures and produce a reproducible
  classic-runtime recipe or a precise upstream issue. A changed runtime requires
  fresh hashes, audit and all browser acceptance; never silently replace pins.
- [ ] K5: Record Kiro participation with dated evidence, reviewed diffs/commits
  and exact commands. Have the owner verify the written account before submitting.

- [ ] K6: Reproduce and fix the actual Chromium 159 mobile zero-height framebuffer
  defect described in `docs/chromium-mobile-blocker.md`. Preserve DPR, sandbox and
  visibility assertions. Validate real guest input/export/cleanup and the existing
  Chrome/Firefox paths; rerun the complete unchanged CI gate. This is unresolved
  Codex-observed behavior, not prior Kiro work.

Suggested first prompt in Kiro: “Read AGENTS.md and the PHANTOM core docs. Work
only on K6 in .kiro/specs/submission-validation/tasks.md. Inspect before editing,
preserve privacy and Windows-disabled state, run real browser acceptance, and
report your actual diff, commands, outcomes and unresolved blockers.”
