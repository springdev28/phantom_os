# PHANTOM OS project rules

These rules apply to every contribution in this repository. Read this file and the
three documents in `docs/` before changing the project. Follow the user's current
prompt; later stages in the playbook are a roadmap, not authorization to implement
them now.

## Scope and truthfulness

- Implement **one prompt at a time**. Complete its acceptance checks and report its
  outcome before starting another. Preserve working paths when an experiment fails.
- The initial repository audit on 2026-11-21 found an empty repository. Prompt 0
  creates documentation only. Do not add a frontend, package manifest, runtime,
  downloaded fixture, mock player, or product screenshot during Prompt 0.
  Prompt 1 adds the frontend and contracts only; it does not authorize later
  format parsing, archive extraction, emulator integration or persistence.
  Prompt 2 adds bounded local header analysis and evidence reports only. ZIP
  extraction, full compatibility planning, guest execution and persistence remain
  separate prompts; recognizing a signature never authorizes those operations.
  Prompt 3 adds bounded ZIP/folder intake, a normalized virtual package and explicit
  entrypoint choice only. It does not authorize compatibility planning, runtime
  integration, filesystem mounting, execution or persistent storage.
  Prompt 4 adds deterministic compatibility planning, typed adapter capabilities and
  local JSON launch profiles. It does not authorize installing engines, guest
  execution, disk booting or persistent storage. Keep the observed-launch catalogue
  empty until a later prompt supplies real PHANTOM browser launch evidence.
  Prompt 5 adds the pinned, local-only js-dos/DOSBox adapter, explicit launch,
  real framebuffer/input/audio, temporary guest file export, lawful DOS fixtures
  and recorded browser acceptance. It does not authorize Windows integration,
  disk booting, live file import, persistent workspaces or public deployment.
  Preserve the DOS regression suite and its sandbox/network boundary in later work.
  Prompt 6 adds a bounded Boxedwine 25R1 browser trial. Windows remains disabled:
  engine-only bootstrap/mount/failure tests are not application execution evidence.
  Preserve the explicit adoption blockers until an audited Wine filesystem and
  lawful Windows fixture pass actual input/stop/network tests. Do not copy the
  upstream demo game, placeholder Notepad, or unaudited guest filesystem into the app.
  Prompt 6 does not authorize persistence, disk booting or public deployment.
  Prompt 7 adds explicit opt-in origin-local OPFS saves and DOS live document
  import/export/capture. Keep temporary mode, separate software/document consent,
  atomic replacements, hash/schema checks, backup/delete and no automatic launch.
  Restore validation is not executable verification. Do not silently save guest
  files or migrate a runtime pin. Browser retention is never guaranteed. Prompt 7
  does not authorize enabling Windows, disk booting, cloud services or deployment.
  Prompt 8 refines the existing journey: Home has one dominant open action;
  Inspect → Compatibility → Configure → Run remains explicit. Supplied public
  demos use the same bounded intake and real runtime. Keep clipboard/report exports
  local, preserve the opaque guest sandbox and opt-in storage. Automated timings
  do not count as first-time human usability or screen-reader speech validation.
  Prompt 8 does not authorize new runtimes, cloud services or public deployment.
  Prompt 9 hardens and tests the existing intake/runtime/hosting boundaries. Keep
  the security model and observed network evidence in docs/security.md current.
  Production preview and tests must share the same CSP/permissions implementation;
  do not pass security acceptance with test-server-only protections. An opaque
  sandbox and resource budgets are not a malware-containment guarantee. Prompt 9
  does not authorize new runtimes, guest networking, host mounts or deployment.
  Prompt 10 adds reproducible Chrome/Firefox compatibility and performance tests,
  seeded parser/ZIP properties and CI for committed lawful fixtures only. Preserve
  failed observations, fixed success criteria, environment/pin details and separate
  manual results. Automated or agent runs are not independent human validation.
  Benchmark before optimizing; missing memory measurements stay unavailable.
  Prompt 10 does not authorize Windows enablement, new runtimes or deployment.
  Prompt 11 prepares genuine Kiro artifacts and submission materials, audits the
  release/license boundary and attempts reproducible public demo preparation.
  Kiro artifacts authored elsewhere are not evidence of actual Kiro use. Preserve
  source rebuild, public HTTPS and genuine video gates; do not publish unaudited
  binaries or claim missing Kiro work. No contest submission or terms acceptance
  is authorized. Windows stays disabled until separately verified.
- Reuse **js-dos / its `emulators` API** for the DOS path and investigate
  **Boxedwine with Wine** for the distinct Windows path. Do not write an emulator,
  CPU implementation, or Windows API compatibility layer from scratch.
- Separate static format recognition from executable compatibility. An extension,
  magic signature, confidence score, rendered canvas, or successful API call does
  not prove that a program runs.
- Use only `planned`, `experimental`, `verified`, or `unsupported` for capability
  maturity, with the definitions in [the matrix](docs/compatibility-matrix.md).
  Record launch eligibility separately. Verification applies to the tested
  program, runtime build, configuration, browser, and observed behavior.
- No fake demos: no HTML imitation, prerecorded output, invented logs, fabricated
  test results, or static screenshots presented as execution. Test doubles are
  allowed in unit tests only and cannot satisfy execution acceptance.
- No unnecessary AI content: no chatbot, generated compatibility verdicts,
  promotional filler, invented app artwork, or AI service in the product path.

## Local execution and privacy

- All user-program inspection and execution must happen locally in the browser.
  No server execution, cloud runner, native helper, or host execution of imported
  programs. Local developer build tools are not a guest execution feature.
- **Never upload user files.** Do not transmit their bytes, names, paths, hashes,
  derived reports, or working documents through requests, URLs, analytics, crash
  reports, logs sent off-device, or emulator networking. Do not send them to AI
  services. Static app/runtime downloads must be independent of user input.
- Disable cloud saves, guest networking, remote drives, proxies, telemetry, and
  upstream debug services in the shipped runtime configuration. An adapter that
  cannot satisfy the local-only boundary must remain disabled.
- Use only explicitly selected files. Do not request broad filesystem access or
  silently persist software. Default to temporary memory; persistence in OPFS or
  other origin-local storage is opt-in and must have export and deletion paths.
- Treat imported metadata, archives, profiles, and programs as untrusted. Bound
  reads and extraction; validate paths, configuration, quotas, and resource limits.
  Never execute archive scripts during inspection. Workers and WebAssembly do not
  constitute a perfect security boundary.

## Licenses and assets

- No pirated OS/software, proprietary ROM/BIOS bundles without redistribution
  rights, DRM bypass, abandonware assumptions, or copied commercial demos.
- Complete the [license gate](docs/architecture.md#dependency-and-license-gate)
  before adopting or distributing an emulator build. Audit the wrapper, core,
  WASM/JS, workers, filesystem, Wine, libraries, fonts, BIOS/ROM, and fixtures
  separately. An engine license does not license its bundled software.
- Pin exact versions/commits and asset hashes. Keep license texts, copyright
  notices, corresponding source, patches, and reproducible build instructions as
  required. Do not treat a mutable upstream link or an npm license field as the
  complete compliance record. Do not assume an iframe removes copyleft duties.
- Use the named lawful fixture candidates in the matrix. Record provenance before
  adding binaries. Do not choose or announce the project's final distribution
  license until the dependency compatibility review is recorded.

## Acceptance and reporting

- Inspect the working tree, manifests, README, source, assets, scripts, and applicable
  instructions first. Do not overwrite unrelated user work.
- Once scripts exist, run the applicable typecheck, lint, unit, build, and browser
  tests. Report exact commands and outcomes; distinguish not run, failed, and passed.
  For documentation-only work, validate documents and links without scaffolding an
  application just to obtain a test command.
- Use **real browser runs** for UI and execution acceptance. A runtime claim requires
  actual framebuffer output, meaningful input, clean stop/relaunch, and relevant
  file I/O checks. Mocks and an upstream demo do not verify PHANTOM OS integration.
- Capture the browser version/platform, fixture and runtime hashes, configuration,
  observed result, network behavior, and evidence location. Use redistributable
  fixtures in committed evidence; keep personal files and their traces out of Git.
- Check network behavior before asserting that files stay local. Include worker
  traffic and attempted guest connections, not only the top-level page.
- Update the compatibility matrix when evidence changes. Keep failed cases and
  known limitations visible. Do not generalize one Win32 success to Win16 or all EXEs.
- End each task with changed files, tests/checks and results, blockers/limitations,
  and the next permitted stage. Never say an emulator is integrated until its
  PHANTOM OS browser integration has actually been tested.
