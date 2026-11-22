# Local file analyzer — Prompt 2

The analyzer reads only the File/Blob handle selected through the existing picker
or normalized virtual package. The header probe itself produces a `ProbeResult`;
it never executes, repairs, mounts, extracts, uploads or persists data. No dependency
was added for these probes. Since Prompt 3, the **Analyze file/package** action can
also invoke the separate bounded [ZIP importer](package-import.md), then probe its
virtual files. The ZIP row below describes header recognition only, not extraction.

## Result and interpretation

The authoritative type is [`ProbeResult`](../src/domain/contracts.ts). Each result
includes file size, likely format, available machine/class/endianness/subsystem or
declared target, confidence, header consistency, ambiguity, diagnostic warnings and
read statistics. `evidence[]` contains a label, absolute file offset, byte count,
actual hex bytes and the interpretation of that field. Evidence is displayed only
in the local UI and is never passed to the logger.

`certain-format`, `probable` and `ambiguous` describe **format recognition**, not
executable compatibility. `valid-header` means only that the implemented field and
range checks agree. `partial` means an identified structure was not fully examined;
`invalid` records contradictory/truncated fields; `unknown` leaves format validity
unestablished. All results carry `executableCompatibility: not-assessed` and the
same explicit limits: required OS version, runtime libraries, valid guest environment,
DRM and successful application startup are not established. The runtime planner
still returns `canLaunch: false` for every file.

## Implemented checks and deliberate limits

| Probe | Checks | What remains outside the claim |
| --- | --- | --- |
| MZ | Signature, page/image/header sizes, relocation-table bounds; secondary pointer only when the DOS header is at least 64 bytes | No instruction validation, CPU-generation guarantee, extender or overlay decoding; MZ can be a stub |
| PE32 / PE32+ | MZ/PE signatures, optional-header magic/length, machine, image flag, subsystem, directory count, alignment, image/header/entrypoint bounds, up to 96 section ranges | No import resolution, section/code semantics, signatures, managed-code requirements or practical OS-version determination; EFI/DLL/native images are not relabeled Windows GUI apps |
| NE | Fixed header, declared target (including Windows versus OS/2), selected table bounds and at most 256 segment ranges | No entry-bundle, resource or relocation decoding; CPU generation is not encoded by this report; recognition remains probable |
| ELF | Magic, class, byte order, version, machine, object type, ABI declaration, fixed-header length and program/section table bounds using BigInt for 64-bit offsets | Extended numbering is partial; interpreter, dynamic dependencies and table contents are not decoded; ELF does not mean Linux |
| ZIP | Local header, bounded end-record search, ordinary directory sizes/location, first directory signature and local-header reference; encryption/streaming flags reported | No entry listing, subtype inference, decompression, CRC verification or path safety assessment; ZIP64/multi-volume/fragments remain partial; self-extracting overlays are not searched |
| ISO 9660 | Up to 16 descriptors starting at byte 32768 in 2048-byte sectors; CD001, primary fields, duplicate byte-order values and root-record bounds | No directory traversal, filesystem mount, bootability, raw 2352-byte CD sectors or other optical-image formats |
| MBR / GPT / IMG | 55 AA marker and four primary MBR ranges under a 512-byte interpretation; EFI PART at 512 or 4096 with bounded fixed GPT fields | MBR is a probable candidate; GPT is partial without CRC/backup/partition checks; no FAT parsing, extended-partition traversal or universal IMG recognition |
| Raw COM / unknown | A small `.com` supplies ambiguity only; raw images without a recognized signature remain ambiguous; arbitrary `.exe` text remains unknown | No raw-code heuristic or suffix can establish platform, safety or launch eligibility |

Recognized leading executable/container headers take precedence over disk probes.
This is a bounded signature analyzer, not an exhaustive polyglot or malware scanner.
Unknown/corrupt inputs return readable diagnostics and retain the selection/evidence;
local File read failures use fixed safe application errors instead of raw exceptions.

## Processing and privacy bounds

- Existing intake limit: one explicitly selected, nonempty file of at most 64 MiB.
- At most 1 MiB of actual reads per analysis, 64 KiB per File slice, 32 reads.
  Covered ranges are reused. Offsets and lengths are checked before every read.
- At most 64 evidence rows, 16 displayed bytes per row and 32 diagnostics. The ZIP
  scan is bounded to 65,557 trailing bytes; fixed loop limits apply to other tables.
- Native Blob reads are asynchronous. The small, bounded parsing loops run on the
  main thread; the header probe adds no worker. ZIP extraction has its own Prompt 3 worker. Abort checks
  bracket reads and a 30-second controller deadline rejects late work. Stale job IDs
  cannot publish a result after selection replacement, cancellation or clearing.
- No fetch, socket, beacon, worker, external URL, analytics, report export or storage
  API exists in the analyzer. The logger accepts fixed event names/error codes only.
  Browser tests observe context requests, outgoing websocket frames and worker creation;
  after the Inspect screen loads, selecting/analyzing the corpus causes zero requests.

## Reproduction and fixture provenance

Run `npm run check`. The deterministic corpus is generated by
[`probe-fixtures.ts`](../tests/fixtures/probe-fixtures.ts); tests include additional
field mutations and a seeded 256-case malformed-byte corpus. All fixture bytes are
original, project-authored **parser data**, with no downloaded OS, ROM, library or
third-party program. Zero-filled code areas and incomplete filesystems are deliberate.
They must never be presented as runnable guest software or runtime acceptance.

See [Prompt 2 evidence](evidence/prompt-2.md) for exact commands, results, browser
scope and fixture hashes. Guest fixture/license plans remain in the compatibility
matrix. Prompt 3 ZIP/folder import and Prompt 4 deterministic planning are now
implemented separately. The ProbeResult itself remains static evidence only;
see [planning/profile rules](compatibility-planning.md). Prompt 5 now implements
the separate [DOS runtime](dos-runtime.md). Its real FreeCOM fixture also exposed
a legacy MZ layout: when the relocation table overlaps offset 0x3c, those bytes
are relocation data, not a Windows e_lfanew pointer. The analyzer records this
layout and does not reject the DOS image on an invented secondary-header offset.
This recognition fix does not itself prove execution.

## Field-layout references

The implementation was written for this project using these primary layout
references; no upstream parser or emulator implementation was copied:

- [Microsoft PE/COFF specification](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format) — signatures, machine/subsystem fields and image/table structure.
- [Microsoft MS-DOS EXE header definitions](https://github.com/microsoft/MS-DOS/blob/main/v4.0/src/INC/EXE.INC) and [Wine header definitions](https://github.com/wine-mirror/wine/blob/master/include/winnt.h) — DOS and NE field locations.
- [System V ELF header specification](https://gabi.xinuos.com/elf/02-eheader.html) — class, endian, ABI, machine and table metadata.
- [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT) — ordinary ZIP records; no compression/encryption algorithm is implemented.
- [Ecma ECMA-119](https://ecma-international.org/wp-content/uploads/ECMA-119_6th_edition_december_2025.pdf) — ISO volume-descriptor layout.
- [EDK II MBR definitions](https://github.com/tianocore/edk2/blob/master/MdePkg/Include/IndustryStandard/Mbr.h) and [GPT definitions](https://github.com/tianocore/edk2/blob/master/MdePkg/Include/Uefi/UefiGpt.h) — selected disk-header fields.

Prompt 3 adds an 8 MiB aggregate package probe budget. Exhaustion returns explicit
partial/unexamined warnings; it never drops files from the normalized package. ZIP
extraction reads and limits are separate from these small header probes.
