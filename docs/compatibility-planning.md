# Deterministic planning and local launch profiles

Implemented in Prompt 4, extended through Prompt 6 on 2026-11-22. Planning remains
separate from execution. The DOS adapter is now installed and `experimental`;
Boxedwine is `experimental` and disabled after an engine-only trial. Disk
environments remain empty. Exact DOS runs, Windows blockers and the gating
regression are documented in [Prompt 6 evidence](evidence/prompt-6.md).

Runtime descriptors may carry app-owned adoption blockers. The registry freezes
them; `isRuntimeInstalled` rejects any blocked descriptor even if its available
flag and pins are populated. The planner exposes each blocker as a mandatory
issue. Imported profiles and runtime overrides cannot remove them. The researched
Boxedwine version is not an installed build and is never exported as an installed
profile pin. Direct calls to its disabled adapter also reject before file reads.

## Inputs and decision precedence

`CompatibilityPlanner.plan(package, inspection, descriptors, request)` is synchronous
and deterministic. It reads no files, imports no engine, uses no clock or network,
and mutates neither package nor evidence. The inputs are the normalized virtual
package, its path-keyed `ProbeResult` map, app-owned registry descriptors, and an
optional explicit runtime choice/profile/COM-context confirmation. The registry is
never populated from imported JSON.

The decision order is:

1. Reject an invalid profile or corrupt/inconsistent header as `invalid`.
2. Require readable inspection, a present entrypoint and an explicit choice for a
   package. No ZIP entry or first EXE wins by position. A single file can have its
   format explained before it is explicitly chosen, but cannot launch.
3. Match explicit format, architecture, image-kind, subsystem and platform rules.
   No eligible rule is `unsupported`. An incompatible override is also unsupported;
   the automatic suggestion remains visible and can be restored.
4. Surface missing entrypoints, declared companions, mount sources, working
   directories, COM context, partial inspection, runtime assets and profile-pin/
   resource-limit mismatches as `needs-files`. The UI explains the particular action;
   this state includes incomplete setup, not only absent bytes.
5. Consider exact observed evidence only when all blocking checks pass. An eligible
   record yields `verified-compatible`. Otherwise, use `experimental` for Win16,
   explicitly experimental rules/runtimes or an allow-listed disk trial, and
   `candidate` for an eligible unverified path.

`engineInstalled` and `canLaunch` are independent fields. A candidate with an absent
engine has `canLaunch: false`; the absence does not prove the program itself is
incompatible. A reviewed valid DOS profile can now enable explicit Start. Capability maturity remains the
four-state axis in [the matrix](compatibility-matrix.md), separate from these six
per-file decisions. A planned NE adapter can have an experimental *candidate plan*
without being an implemented experimental runtime.

## Explicit capability rules

| Evidence | Rule / required context | Current result after choosing an entrypoint |
| --- | --- | --- |
| DOS MZ | DOS header, not a PE/NE interpretation; may still be a stub or need an extender | js-dos `experimental` after a valid pinned profile is applied; missing setup is `needs-files` |
| Raw COM hint | Small raw bytes with ambiguous `.com` context; user must confirm DOS intent from documentation | `needs-files` until context is confirmed, then the reviewed installed DOS path is `experimental`; confidence remains ambiguous; confirmation resets on a new selection |
| Windows NE | Declared target must be Windows; OS/2 and other NE targets do not match | Boxedwine `experimental` plan; separate Win16 trial required, engine absent |
| Windows PE32 | x86, 32-bit, executable image, Windows GUI or console subsystem | Boxedwine candidate; no claim about OS/API versions or DLL compatibility |
| PE32+ / Win64, non-x86 PE32, EFI/native images, DLL entrypoints | No eligible production rule | `unsupported`; do not fall back to the MZ stub |
| ELF/Linux, arbitrary EXE/MSI, Mac applications | No eligible production execution path | `unsupported`; inspect and export draft profile |
| ISO/MBR/GPT/ambiguous IMG | Requires a specifically registered format/environment and explicit environment selection | `unsupported`: production `diskEnvironments` arrays are empty |
| ZIP or nested archive | Container only; never directly executable or recursively expanded | Choose an inspected program in the normalized package; nested archives remain opaque |

`ExecutableCapability` and `DiskEnvironmentCapability` describe these distinct
paths. A future disk capability must name its guest environment, accepted formats,
requirements and maturity. Recognizing ISO9660 or a partition table never proves
which guest OS is present or whether it boots. Unit-only disk descriptors test this
matching boundary; they do not constitute an integration.

## Requirements and missing assets

`CompatibilityPlan` carries reasons, requirements, warnings, structured `issues`
(code, human message, next action, blocking flag and optional relative path), and
`missingFiles`. There are three sources of requirements:

- Registry requirements: engine build and licensed runtime/filesystem assets.
  An installed claim needs an available experimental/verified descriptor, version
  and build pins, nonempty asset hashes, installed assets and an actual lazy loader.
- Explicit package metadata (`requiredFiles`) or imported profile references.
  Presence is checked using exact normalized relative paths. Exported profiles
  reference every file in the selected package, preserving companion expectations.
- Header limitations: OS version, libraries, DRM, valid guest environment and actual
  startup are unknown. Library/config/data resource hints are visible in Inspect,
  but are not a dependency resolver. Missing DLL names are never invented.

An existing named DLL is only *present*, not known to satisfy an ABI or version.
Never advise downloading arbitrary DLL replacements. Request the complete original
licensed folder/archive or a corrected profile. Nested archives may hide resources
and remain explicitly opaque.

## Registry and evidence trust boundary

`RuntimeRegistry` rejects duplicate IDs and inconsistent installation claims,
snapshots/freezes descriptors, and lazy-loads only eligible pinned entries. It
compares the returned descriptor including version, build, assets and capabilities;
failed loads are evicted for retry. Metadata reads and planning never call a loader.

The app-owned `observedLaunchCatalogue` is empty. Imported profile JSON cannot add
records, hashes, URLs, confidence scores or verification IDs to it. Future reviewed
records must refer to actual local evidence under `docs/evidence/` and record passed
program-specific output, meaningful input, stop/relaunch, applicable file I/O and
local-only network checks. Review must verify that evidence before adding a record.
The code cannot authenticate an invented observation entered by a maintainer.

`captureLaunchIdentity` is a future coordinator/test-recording primitive, not part
of routine header inspection or profile export. It reads the entire immutable
selected package in bounded 64 KiB chunks, within the existing 64 MiB/file and
128 MiB/package limits, with cancellation. The identity is SHA-256 of a canonical
manifest containing sorted file paths, sizes and chunk SHA-256s, directories, the
validated profile, runtime descriptor/asset hashes and exact browser name/version/
platform. Its algorithm ID is `phantom-package-chunks-sha256-v1`; this is a manifest
hash, not a conventional single-binary SHA-256.

An opaque process-local identity is kept in a WeakMap. A JSON object with the same
hash is not an identity. Matching also checks current package handle, profile and
runtime descriptor bindings, and requires a reviewed passing catalogue record.
Changed companions, paths, directories, assets, build, controls/limits or browser
scope require a fresh matching run. No identity or observation is exported in a
profile. Positive evidence-matching tests use unit-only records; they cannot verify
PHANTOM execution.

## Launch profile schema version 1

The authoritative closed schema and validator are
[`LaunchProfile`](../src/domain/contracts.ts) and
[`validateLaunchProfile`](../src/profiles/launch-profile.ts). Every field below is
required. Unknown fields are rejected, including `args`, scripts, URLs, arbitrary
settings, binary payloads, reports and verification assertions.

| Field | Allowed value / meaning |
| --- | --- |
| `schemaVersion` | Exactly `1` |
| `runtimeId` | `js-dos`, `boxedwine`, or `null` for no candidate |
| `runtimeVersion`, `runtimeBuildId` | Both pinned identifiers or both `null`; never a fabricated version or URL |
| `selectionMode` | `automatic` or `override`; override needs a runtime ID |
| `entrypoint` | Safe relative file path or `null` while unresolved |
| `cwd` | Safe relative directory or `.` for package root |
| `mounts` | 1–8 objects: relative `packagePath` (or `.`), `guestPath` on C:/–F:/, boolean `readOnly`. Reject overlapping guest destinations; no host path access |
| `controls` | `keyboard: "us"`, `mouse: "off" / "absolute" / "captured"`, boolean `audio` |
| `requiredFiles` | Up to 2,048 unique normalized relative paths with kind `library`, `data`, `configuration` or `package-member`; content is excluded |
| `diskEnvironment` | An allow-listed environment identifier or `null`; none currently enabled |
| `dos` (optional, DOS only) | Exactly cycles (integer 300–30,000), core (`auto`, `normal`, `simple`), machine (`svga_s3`, `vgaonly`, `ega`), and boolean xms/ems. Defaults: 3000, auto, svga_s3, true, true. No free-form commands/configuration |
| `limits` | Integer `guestMemoryMiB` 16–512 and integer `maxSessionMs` 60,000–1,800,000; stricter runtime cap applies separately (DOS 64 MiB) |

Profile reads and exports are capped at **2 MiB**. This accommodates the importer's
1 MiB path-metadata ceiling and bounded reference overhead. Reads time out after
five seconds. Shared path validation rejects traversal, absolute/drive/UNC source
paths, ambiguous separators, reserved names and normalization/case collisions.
Import validates the entire object before applying anything. Invalid imports retain
the previous package/profile and show fixed guidance without raw parser exceptions.

Example unresolved DOS draft, containing no program or document bytes:

```json
{
  "schemaVersion": 1,
  "runtimeId": "js-dos",
  "runtimeVersion": null,
  "runtimeBuildId": null,
  "selectionMode": "automatic",
  "entrypoint": "APP/MAIN.EXE",
  "cwd": ".",
  "mounts": [{ "packagePath": ".", "guestPath": "C:/", "readOnly": true }],
  "controls": { "keyboard": "us", "mouse": "off", "audio": false },
  "requiredFiles": [{ "path": "APP/MAIN.EXE", "kind": "package-member" }],
  "diskEnvironment": null,
  "limits": { "guestMemoryMiB": 64, "maxSessionMs": 1800000 }
}
```

Requested guest settings are not a portable browser heap guarantee. A future
adapter must enforce its limits and supported controls/mount behavior before
preparing anything. Boxedwine's actual memory/startup limits remain unmeasured.
Arbitrary command-line arguments and custom keybinding scripts are intentionally
absent until an adapter can encode and validate them safely.

## UI and locality

Compatibility shows the six-state decision, readable reasons, engine availability,
automatic suggestion versus override and actionable requirements. The original
ProbeResult keeps `executableCompatibility: not-assessed` because that object still
describes only header recognition. The lifecycle reducer stays unlaunchable until
a real installed adapter makes all checks pass. DOS requires one writable whole-package
C:/ mount, 8.3 paths and ≤32 MiB of files. The original selected files are never
modified. Old unresolved profiles retain null pins and must be reset/reviewed against
the installed build before launch. Profiles without optional `dos` use safe defaults.

Compatibility and Workspace offer Import/Export profile JSON and editable controls,
working directory, mounts and limits. Export uses an explicit local Blob download
named `phantom-launch-profile.json`. Relative file references are included, file
contents are not. Nothing is uploaded or persisted; reload/clear releases the
profile. Importing before selecting files is supported; original files must be
selected again. An imported entrypoint is an explicit profile choice, never a
reason to choose the first EXE or to execute it automatically.

Production browser acceptance covers desktop/emulated mobile, online/offline
round-trips, strict CSP, page/worker traffic and no persistent storage. Prompt 4
covered no execution; [Prompt 5](evidence/prompt-5.md) adds real DOS launch/input,
guest writes/export, stop, network-failure recovery and offline relaunch. The
Prompt 6 suite repeats these DOS checks and adds Windows blocked-path privacy,
profile/export, direct Player, ZIP/folder and DOS-after-Windows regressions. Its
separate real Boxedwine engine probe does not execute a Windows program. The
app-owned verification catalogue remains empty: recorded fixture observations
are not automatically generalized to selections or untested configurations.
