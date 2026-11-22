# Requirements: genuine Kiro release validation

Status: proposed working spec prepared in Codex, not yet implemented in Kiro.
Select one task at a time. No retroactive credit for existing features.

1. WHEN a user cancels runtime preparation, selects another package, or leaves
   the page before downloads finish, the app SHALL discard stale work, remove
   any frame/worker, and require a fresh explicit Start. Cover delayed fetch and
   retry with real browser tests, not mocked runtime success.
2. WHEN a release candidate is served over HTTPS, acceptance SHALL compare real
   CSP/permission headers with the shared policy, exercise DOS input/export and
   cleanup, and inspect page/worker network requests. It SHALL fail on third-party
   requests, selected-data sentinels, guest connectivity or automatic persistence.
3. WHEN audited source bundles change, the release gate SHALL reject unexpected
   executables, symlinks, traversal and size/count violations. Kiro SHALL review
   the current audit and add meaningful tar/link/count regression coverage where
   missing. It SHALL not add unlicensed fixtures to demonstrate rejection.
4. WHEN a Kiro task completes, the contributor SHALL record date, Kiro version,
   exact task, reviewed diff/commit, test commands/outcomes and actual session
   evidence. Absent evidence SHALL remain pending. Installing Kiro or generating
   `.kiro` files elsewhere SHALL NOT count as meaningful Kiro use.
5. A public demo SHALL preserve complete source/license access and audited runtime
   pins. Windows SHALL stay disabled unless a separately authorized integration
   satisfies its full adoption and real-program acceptance gate.

6. WHEN the real runtime produces frames in Chromium 159 mobile emulation, the
   player SHALL keep the actual canvas visible with usable controls. Acceptance
   SHALL retain the current DPR, sandbox and visibility/output/input checks. The
   observed zero-height defect SHALL remain a failure until a tested fix exists.
