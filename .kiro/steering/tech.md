---
inclusion: always
---
# Engineering constraints

Vite, React, strict TypeScript; Node 24; Python 3.11+ for fixture/source auditing.
Keep runtime code behind RuntimeAdapter/RuntimeSession, loaded only on explicit
launch. Keep CSP and permission policy shared with production acceptance.

Never upload selected files, names, hashes, reports or working documents. No
guest networking, host filesystem mounts, remote drives, analytics or cloud saves.
Temporary memory is the default; OPFS is explicit and origin-local. Preserve
export/delete and no-storage fallback. Treat package/profile strings as untrusted.

Use bounded inspection, extraction and session budgets. Do not execute imports
on the host. Workers/WASM are not a guarantee against emulator/browser escapes.
Audit dependencies and actual archive contents before changing pins. Do not add
unlicensed binaries, OS images or ROMs. Do not relax release gates to obtain a URL.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run audit:sources`,
`npm run build`, and appropriate Playwright tests. `npm run check` is the full
existing gate. Mock success cannot substitute for a running emulator. No deploy,
contest submission, account action or Kiro usage assertion follows from a hook.
