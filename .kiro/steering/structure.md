---
inclusion: always
---
# Repository map

- `src/domain`: shared contracts; `inspection`, `packages`: bounded local intake.
- `src/planner`, `profiles`: deterministic decisions and validated settings.
- `src/runtime/dos`: actual frame/worker bridge; `runtime/boxedwine`: disabled path.
- `src/workspace`: opt-in OPFS; `src/security`: shared hosting/confinement policy.
- `src/app`: six screens and controller. The UI must not call emulator globals.
- `tests/browser`, `tests/compatibility`: real browser acceptance.
- `tests/fixtures/dos`: two licensed programs; synthetic headers are not demos.
- `vendor/dos`: audited corresponding source, notices and exact hash manifest.
- `docs/compatibility-results.md`: observed program/browser outcomes.
- `docs/security.md`, `runtime-license-audit.md`, `release-license-review.md`:
  boundaries and distribution blockers.
- `docs/kiro-usage.md`: provenance ledger; `submission-readiness.md`: actual status.

Generated `dist`, `public/runtimes`, `public/demos`, browser traces and dependencies
are ignored. Root `.kiro` is source and must be committed. Never include personal
files, tokens, private screenshots or unredacted user-program traces in evidence.
