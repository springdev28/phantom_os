# Local package import — Prompt 3

PHANTOM imports explicitly selected files, a folder, or a ZIP into the same
`ApplicationPackage` contract. Import is static processing, not executable
compatibility. No emulator, mount, script runner, network service or persistence
is involved. [Acceptance evidence](evidence/prompt-3.md) records the tested scope.

## User journey

1. Choose **Open legacy software / Open file** (one or several files), **Import ZIP**,
   or **Choose folder**. File drops are accepted; directory drops reopen the folder
   picker rather than silently dropping subdirectories.
2. Select **Analyze file/package**. A single selected ZIP is expanded after its
   header is identified; an explicit ZIP action or `.zip` suffix requests strict
   ZIP parsing but never proves that the contents are valid. Other files and images
   keep their bounded header reports. Loading, progress and cancellation are visible.
3. Inspect the package: paths, byte sizes, resource hints, candidate reasons and
   per-file header evidence. The file list is filtered/paged (40 rows), candidate
   choices are paged (20). Empty ZIP directories and empty resource files survive.
4. Choose the intended executable with a labelled radio control. No candidate,
   including a lone EXE, is selected automatically. Viewing a file's report is a
   separate operation and does not change the chosen entrypoint.
5. Header evidence remains separate from the Prompt 4 planner's decisions; Run
   stays unavailable. Clear/reload
   releases the package. No originals are changed.

Resource roles are **hints**, generally by name: libraries/overlays, configuration,
application data/media/fonts, documentation, scripts and opaque archives/images.
No dependency graph, missing-library diagnosis or valid guest environment is
inferred. Header-confirmed formats produce candidates; raw COM stays explicitly
ambiguous, misleading EXE text is not a candidate, DLL/driver-like files are
retained as possible resources, and setup/uninstall names receive a caution.

## Shared virtual filesystem

`src/domain/contracts.ts` defines schema version 1:

- `id`, `label`, `origin` (`files`, `folder`, `zip`) and `totalBytes`;
- a sorted immutable `files` array of `FileArtifact` handles, unique validated
  relative `path`, `size`, `lastModified`, source and bounded asynchronous `read`;
- `directories`, including implicit parents and explicit empty ZIP directories;
- `candidates`, `resources`, `warnings`, and an optional user-chosen `entrypoint`.

Each file has one immutable Blob/selected File backing it. Folder files remain
browser File references; ZIP chunks become immutable Blobs. A worker result uses
structured cloning of Blobs, not a second whole-archive byte array. No functions
or host paths cross the worker boundary. The compressed selection is released
when its normalized package replaces it. Old versions can temporarily coexist
until browser garbage collection; no precise portable heap bound is claimed.

Choosing an entrypoint changes metadata only: the same file array and directory
list are handed to future `RuntimeAdapter.prepare`. Adapters must consume this
validated package, not re-extract an original ZIP, select a first EXE, URL-decode
paths, evaluate bundled configuration or discard files they did not recognize.
An adapter still needs its own guest path/command encoding rules. These byte/path
preservation checks do not verify any guest filesystem or runtime integration.

Folder selection retains the chosen root directory and all relative segments.
Names are normalized to NFC with conservative compatibility/case collision checks.
ZIP timestamps/permissions/ownership are not imported (lastModified is unknown,
represented by 0); directory metadata does not grant execution rights. The browser
folder picker does not expose host symlink metadata or empty directories. PHANTOM
never follows a link or enumerates the host itself; it reads only the File objects
explicitly provided by the browser. Use a ZIP when empty directories matter. Mac
resource-fork semantics and POSIX metadata restoration are not supported.

## ZIP subset and validation

The implementation follows the record structures in the
[PKWARE ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).
It uses the pinned, MIT-licensed
[fflate 0.8.3 streaming Inflate codec](https://github.com/101arrowz/fflate/tree/v0.8.3)
only after PHANTOM validates metadata. The license and artifact hashes are recorded
in [the dependency inventory](dependency-licenses.md).

Accepted: ordinary single-volume ZIP, stored (method 0) or Deflate (method 8),
ASCII names without a UTF-8 flag or valid explicitly UTF-8 names, optional ordinary
12/16-byte data descriptors, comments and bounded non-link metadata extras.
Central/local names, compression flags, sizes, descriptors and locations must
agree. CRC32 and actual output length are checked for every entry before the
package is published. Local records must cover the local-record area without
prefixes, hidden records, overlaps or gaps; central directory and end record must
be contiguous. This deliberately rejects some valid but unusual ZIP variants.

Rejected with fixed, human-readable errors: malformed/truncated records, CRC/size
mismatches, empty or directory-only packages, encrypted/multi-volume/ZIP64 archives,
other compression methods, self-extracting prefixes, unsupported legacy filename
encodings, conflicting Unicode-name extras, Unix link extras, symlink/device/socket
modes and conflicting file/directory attributes. No partial filesystem is returned.

Paths reject traversal, `.`/`..`, empty components, absolute/drive/UNC paths,
backslashes, controls, Windows reserved devices/stream syntax, trailing dots/spaces
and ambiguous separators. Files cannot alias files or directories after conservative
Unicode/case normalization, including implicit parent directories. Paths stay in
Maps/arrays; there is no native filesystem write API or object-key assignment from
an archive name. ZIP-slip therefore cannot escape to a host path.

Nested archives are **retained as opaque files** and explicitly labelled. They are
never recursively unpacked. Their compressed bytes count against the same package
limits; their declared inner expansion is never materialized. A nested program
cannot be chosen from unseen contents. Scripts and autorun files are never executed;
configuration and documents are not interpreted as app instructions.

## Enforced budgets

| Resource | Limit |
| --- | --- |
| Input ZIP or any selected/extracted file | 64 MiB |
| Sum of retained file sizes | 128 MiB, declared before decompression and actual while streaming |
| Entries | 2,048, including virtual parent directories; duplicate paths rejected |
| Expansion ratio | At most 100:1 unpacked/compressed per entry; zero denominator uses 1 byte |
| Path | 1,024 UTF-8 bytes, 255 bytes per segment, depth 32; 1 MiB cumulative explicit path metadata |
| ZIP central directory | 2 MiB; 4 KiB per extra field area/comment |
| Local reads | At most 64 KiB per physical Blob slice; compressed chunks 4 KiB |
| Header probing | Prior 1 MiB/file, 64 KiB/range, 32 reads plus 8 MiB aggregate/package |
| Processing | 30-second controller deadline; separate 30-second extraction-worker termination |
| UI | 40 file rows and 20 executable choices per page; directories in a bounded scroll region |

Preflight completes for all entries before decompression. Inflater output is checked
against declared and policy ceilings before retaining chunks; CRCs are incremental.
Small compressed input chunks bound per-call expansion rather than asking the
library to allocate an entire declared file. Native Blob retention/copying and
browser GC add overhead beyond these byte budgets; actual peak browser heap was
not measured, and worker isolation is not a perfect security boundary.

A ZIP job owns one dedicated worker. Success, error, cancellation, timeout or
component teardown terminates it. Job IDs prevent stale results after clear/replace.
A failure preserves only the original selection for review/replacement, never a
partly extracted package. Header probes remain bounded async main-thread work.

## Local-only behavior and limits

All user input is passed through local File/Blob reads and browser structured clone.
Production includes the small worker and codec as build-owned code in the app
bundle. Each job starts a local Blob worker; its source contains no user data.
Development uses a fixed Vite worker URL with no input-derived parameter. No CDN
or fflate worker factory is used. There is no
fetch, socket, beacon, storage or script-evaluation call in the intake/extractor.
The logger accepts fixed event/error codes only. Browser tests cover page and worker
traffic, inert script sentinels and empty origin storage. See the evidence record
for the precise observed browsers and production/static-asset checks. The built
Inspect view imports again with networking disabled; no HTTP worker-script reload
is required. Cold offline app loading and uncached route navigation are not claimed.

This stage does not provide archive creation/export, filesystem mounting, guest
launch, library resolution, CP437 conversion, password decryption, ZIP64 or archive
repair. Extract unsupported archives with a local tool and select their folder.
Prompt 4 now consumes this virtual package for [deterministic planning and profiles](compatibility-planning.md).
Next permitted stage, only when requested: Prompt 5's licensed DOS runtime integration.
