# Prompt 2 acceptance evidence

Date: **2026-11-21**, Europe/Istanbul. Scope: local static file analysis only.
The repository still has no commit; these results refer to the current local working
tree. No emulator, guest OS or real legacy application was installed or executed.

## Commands and outcomes

| Command / check | Observed result |
| --- | --- |
| `npm run typecheck` | Passed, strict TypeScript plus exact optional properties and unchecked-index checks |
| `npm run lint` | Passed, zero warnings |
| `npm test` | Passed, **65 tests across 5 files**, including the parser corpus, extra malformed fields, read budgets and cancellation |
| `npm run build` | Passed; production Vite assets built, no engine assets |
| `npm run test:browser` | Passed, **20 tests**, ten each in desktop Chrome and Pixel 7 emulation; zero console errors/page exceptions |
| `npm run check` | Final combined typecheck → lint → unit → build → browser run passed |
| `npm run dev -- --port 4173 --strictPort` | Passed; updated local app served at `http://127.0.0.1:4173/` |
| Fixture generation / hashing | 19 original deterministic byte arrays materialized locally; SHA-256 manifest recorded below |

The initial pre-final typecheck/lint/unit run also passed (62 unit tests). Three
additional pointer/descriptor checks were added before the final 65-test run.
No test failure is hidden by retries; Playwright retries are zero. Vite timing
notices and the terminal's NO_COLOR/FORCE_COLOR warnings are tooling notices, not
browser console errors. Dependencies and lockfile were unchanged; installation
was not repeated for this stage.

Toolchain: Node **24.19.0**, npm **11.17.0**, macOS **26.6.2**, arm64;
Playwright **1.65.1**, Google Chrome **157.0.8103.79**.
Lockfile SHA-256: `516609ee39b30693a4611b0aa28fd06e5f78f192f5c194558b7edab27b739648`.

## Observed browser behavior

- Actual File selection → selected → inspecting → unsupported (execution unavailable).
  Analyze reads the selected bytes; no fake output or timer-generated verdict is used.
- DOS MZ, PE32, PE32+, NE with OS/2 target, big-endian ELF64, ZIP, ISO, MBR/GPT,
  raw COM ambiguity and misleading EXE text produce different reports. Expandable
  evidence displays real hex bytes, offsets, labels and interpretations.
- PE32 GUI versus PE32+ console and declared machine/class remain distinct.
  An ELF named `.exe` remains ELF; ZIP named `.docx` is only called a ZIP container.
  No “Supported” label appears and Run stays disabled.
- A PE secondary pointer outside the file produces a readable error with retained
  evidence. Choosing another file recovers. Empty-input and File-read failures use
  readable, fixed errors without private thrown text. Cancellation/stale-result,
  navigation, temporary-selection and reload checks remain passing.
- Evidence toggles are keyboard accessible. Automated desktop/mobile checks find no
  horizontal overflow. Visual inspection used a 1440×1100 desktop and phone-width
  Chrome views. These are responsive/emulated checks, not a physical Android device
  or Safari/Firefox verification.

## Privacy observations

The browser suite loads Inspect, then selects/analyzes all 19 synthetic fixtures.
Context-level request collection and outgoing page-websocket observation find:

- **Zero requests after Inspect finishes loading**, throughout selection and analysis.
- All observed initial HTTP requests are local static GETs; no filenames, encoded
  filenames or base64 file bytes appear in observed traffic.
- No page workers or service workers are created. This accounts for the current
  absence of worker traffic; future worker/runtime code needs its own checks.
- Zero localStorage/sessionStorage entries, IndexedDB databases or Cache Storage
  entries from the tested journey. No report or selected bytes are persisted.

This is evidence for this implementation/corpus, not a universal security proof.
The analyzer source has no network/storage/guest execution calls. Its logger takes
fixed events and safe error codes, never a ProbeResult or raw exception.

## Fixture provenance and reproduction

Source: [`tests/fixtures/probe-fixtures.ts`](../../tests/fixtures/probe-fixtures.ts).
All bytes are original, synthetic parser test data. No executable payload or
third-party application/OS was downloaded. These fixtures do **not** validate a
loader, filesystem mount, emulator, OS license or application compatibility.

The [machine-readable hash manifest](prompt-2-fixtures.json) records all 19 IDs,
names, sizes, expected formats/validity and SHA-256 values. Additional mutation and
seeded corpus generation is deterministic in
[`selection-inspector.test.ts`](../../src/inspection/selection-inspector.test.ts).

Follow [fixture instructions](../../tests/fixtures/README.md) to create manual inputs
under the ignored `test-results/parser-fixtures/`. Run `npm run check` to reproduce
automated checks; reports go to ignored `playwright-report/` and `test-results/`.
Visual captures under `.playwright-mcp/` are disposable views of the actual report,
not screenshots presented as running guest programs.

## Limits and next stage

Read policy: 1 MiB total, 64 KiB per slice, 32 reads; 64 evidence rows with at most
16 hex bytes per row. Unit tests verify actual read requests/cumulative limits and
safe handling of invalid 32-/64-bit offsets. Parsing loops are bounded; asynchronous
Blob reads use cancellation and the controller's 10-second deadline.

“Checked fields agree” is not full-file validation. NE checks are limited, GPT
checks are partial without CRC/backup validation, ZIP is not unpacked, and ELF
extended numbering is not resolved. Raw COM/IMG can remain ambiguous. Required OS
version, libraries, guest environment, DRM and successful startup remain unknown.
See [the exact analyzer scope](../analyzer.md).

No remaining Prompt 2 blocker. Next permitted stage: **Prompt 3 — local ZIP/folder
intake and entrypoint selection**. Execution remains unavailable until a later
runtime integration passes real guest acceptance.
