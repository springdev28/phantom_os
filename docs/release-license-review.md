# Distribution-license review — 2026-11-22

Scope: current lockfile, generated browser output, three pinned DOS engine assets,
retained corresponding sources and two demo fixtures. This is the project's
engineering compliance record, not an assertion that a license field clears all
distribution obligations. Re-audit changed dependencies and output.

## Original project license decision

Use **GPL-2.0-only** for original PHANTOM source, documentation, tests and project
configuration. This selects GPL version 2 for combination with the adopted
`emulators` GPL-2.0 build. Upstream files retain their own grants and copyright
notices. The root LICENSE does not relicense third-party archives, screenshots of
their actual output, fixture binaries, or users' imported software/documents.
No ownership or license grant over user files is requested.

The actual package license files were read and hashed in
[the npm review](evidence/prompt-11-npm-license-review.json). The source-level
[runtime review](runtime-license-audit.md) covers components absent from the npm
dependency graph. This decision was recorded before adding the project LICENSE.

| Distributed component | Actual terms reviewed | Combination/retention decision |
| --- | --- | --- |
| Original PHANTOM code | New GPL-2.0-only grant | Ship source, scripts and full GPL v2 text; no iframe exception assumed |
| emulators 8.5.3 / DOSBox | GPL v2 text / DOSBox GPL v2-or-later grants | Select GPL v2; preserve corresponding source, exact pins and build recipe |
| React, React DOM, Scheduler, fflate; Vite preload helper | MIT license texts | Keep complete permission/copyright notices in built output |
| Browserify prelude/process, core-js, MiniLZ4 | MIT notices and retained source/map | Preserve notices/source alongside GPL wrapper |
| libzip 1.5, zlib 1.2.13, SDL_net | BSD-style/zlib-style per-file grants | Preserve separate grants and sources; no unreviewed attribution-stripping |
| MAME-derived sound code in DOSBox | GPL v2-or-later source grants | Select GPL v2 and retain source/header notices |
| Emscripten/musl/libc++ runtime | MIT/NCSA; MIT; Apache-2.0 WITH LLVM-exception | Preserve actual license text, including LLVM's GPLv2 combination waiver; plain Apache-2.0 alone is not the rationale |
| MEM 1.12 / FreeCOM 0.86 / SUPPL | GPL v2 / GPL v2 / LGPL v2 source and license materials | Distribute unchanged lawful fixture binaries with source/build files and notices |
| Build/test tooling in node_modules | Separate MIT/Apache/MPL/ISC/BSD/BlueOak/CC-BY/0BSD grants | Not copied into browser distribution; lockfile is not a substitute for package notices if toolchains are redistributed |
| Boxedwine, Wine filesystem, Microsoft OS/ROM/DLL bundles | No adopted combined asset inventory | Do not distribute or enable; existing Windows blockers remain |

The [LLVM exception](https://llvm.org/LICENSE.txt) is also retained verbatim at
`vendor/dos/libcxx-LICENSE.txt`. Full grants, component source and fixture provenance
are linked from [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md).

## Correction to earlier source inventory

The old filtered `emulators-source.zip` still contained unused
`native/dhry2/bin/DOS4GW.EXE` and `dhry_2.exe`. Their redistribution rights were not
established. Both were removed before any public deployment; all remaining member
bytes are unchanged. [Before/after hashes and excluded members](evidence/prompt-11-source-filter.json)
preserve the audit correction without retaining those executable bytes. Historical
Prompt 5–10 source hashes describe the old archive and are not the release inventory.

`npm run audit:sources` verifies retained pins and scans archives without extracting
them. It rejects executable signatures, unaudited executable-like names, nested
archives, links, unsafe paths and budgets. Six exact-hash text configuration/DCL
files are separately allowed. Signature checking is a regression guard, not proof
that arbitrary binary data is licensed. Review new archives manually as well.

## Remaining release conditions

The license selection is complete. **Public runtime distribution remains gated on
the source rebuild review**, retained reproducible instructions and any output
differences. Do not claim a bit-identical rebuild based on npm asset copying.
The current attempt and outcome belong in [Prompt 11 evidence](evidence/prompt-11.md).
After that gate, publish corresponding source and notices with the actual build,
run clean-checkout and real HTTPS acceptance, and record exact source/deploy IDs.
Do not omit source archives from hosting to reduce download size; they are not
requested during normal gameplay and can be downloaded separately for compliance.
