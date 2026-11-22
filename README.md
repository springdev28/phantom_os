# PHANTOM OS

Open legacy software, inspect its package, choose an entrypoint, and run it in a
browser when an eligible runtime exists. The player displays the original
program's real framebuffer. **DOS is experimental; Windows is disabled.** Two
specific DOS programs have verified browser observations. Recognition of MZ, PE,
ELF or an image signature never promises execution.

Submission preparation is in progress. Actual Kiro participation, public HTTPS
acceptance and a public demo video must be evidenced before claiming readiness.
See [current submission status](docs/submission-readiness.md) and the
[truthful Kiro record](docs/kiro-usage.md). `.kiro` was prepared with Codex; that
alone does not satisfy Kiro-use requirements.

## Browser and system support

| Environment | Evidence and limits |
| --- | --- |
| Chrome 157.0.8103.79 on macOS 26.6.2 / Apple M1, 16 GiB | Real MEM/FreeCOM launch, keyboard, guest file I/O, stop/relaunch, OPFS and privacy checks passed locally |
| Playwright Firefox 159.0, revision 1572, same laptop | Same core workflows passed; patched automation browser, not separate verification of stock Firefox |
| Other Chrome/Firefox versions; Windows/Linux hosts | Expected browser APIs, but no exact platform acceptance claim; Linux CI is configured and requires an actual run |
| Safari/iOS, Android/physical phones, other browsers | Unverified; responsive Chrome emulation is not device validation |

Requires JavaScript, WebAssembly, workers, File/Blob, canvas and cryptographic
hashing in a secure context (HTTPS or localhost). OPFS is optional; if unavailable,
use temporary sessions and downloads. Fullscreen/clipboard have visible fallbacks.
US physical keyboard mapping is tested. Guest canvas pixels have no semantic
screen-reader tree; the surrounding controls have labels and keyboard navigation.
This is not a general malware sandbox. See [security boundaries](docs/security.md).

## Run and build

Install **Node 24.x**, npm and **Python 3.11+**. No account, API key, native guest
runner, cloud service or proprietary operating-system image is required.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm install` is also supported; `npm ci` uses
the exact lockfile for reproduction. Predev/prebuild verify source/fixture pins,
audit retained source archives, then generate assets. The actual runtime downloads
only on explicit Start. Package installation fetches public development dependencies;
it never consumes user-selected application files.

```sh
npm run typecheck
npm run lint
npm test
npm run audit:sources
npm run build
npm run preview
```

For browser gates, install `npx playwright install chromium firefox` (Linux:
`npx playwright install --with-deps chromium firefox`) and run
`PLAYWRIGHT_CHANNEL=chromium npm run check`. The default uses installed Chrome;
`npm run test:browser` includes desktop/mobile-layout regressions,
`npm run test:production` checks actual production security and DOS file I/O,
and `npm run test:compatibility` runs Chrome/Firefox core acceptance.
`npm run benchmark` is the separate laptop protocol, not a CI timing guarantee.
See [reproduction steps](docs/compatibility-testing.md),
[measured results](docs/compatibility-results.md) and
[current checks](docs/evidence/prompt-11.md). Keep failures visible.

## First real launch and file export

1. Choose **Open legacy software**, select `tests/fixtures/dos/FREECOM.ZIP`, then
   **Analyze file**. Or choose **Try FreeCOM** to download that same public fixture
   from this site. Own files use the same local intake. Folders and ZIPs retain
   relative resources; multiple candidates require an explicit choice.
2. Choose `APP/COMMAND.COM` → **View compatibility** → **Configure launch** →
   **Use these settings and continue** → **Start DOS program**.
3. Wait for the real FreeCom 0.86 prompt. Choose **Focus program**, type
   `TYPE APP\INPUT.TXT` and press Enter. Then type
   `ECHO HELLO FROM DOS>RESULT.TXT` and press Enter.
4. Press **Ctrl+Alt+Esc** or **Release keyboard**. Choose **Refresh guest files**,
   then **Export RESULT.TXT**. Open the download: DOS wrote its contents.
5. Export before **Stop session**. A stopped session discards uncaptured temporary
   changes. Relaunch requires Start again and creates a fresh guest.

The second demo is **Try FreeDOS MEM**, or select `tests/fixtures/dos/MEM.EXE`.
Choose `MEM.EXE` as entrypoint and follow the same flow. Its real memory report
appears in the viewport. Type `MEM > MEMOUT.TXT`, then export `MEMOUT.TXT`.

While running, **Choose a document for DOS** imports an explicitly selected file
into temporary C:/. Use a new DOS 8.3 root name, at most 8 MiB; existing names
aren't silently overwritten. A guest can read/change it; Refresh guest files and
Export retrieve the actual bytes. **Capture** copies a guest file into the
in-memory workspace before stopping. Read [the workspace guide](docs/workspace.md).

## Optional browser-local workspace

Temporary/no-persistence mode is the default. In Workspace, enable browser storage
for manual saves, separately choose whether to save application software and
captured working files, then **Save workspace**. On reload, the saved profile is
validated and restored only on request; no program auto-runs. If binaries weren't
saved, reselect the original package. Restore validation is not launch verification.

**Export backup** downloads a ZIP with a portable JSON manifest and only the bytes
explicitly saved. **Delete workspace** removes the saved local workspace after its
confirmation. Quota/permission failures retain the temporary/export path. Storage
is isolated to this origin and can be evicted or cleared; it is not permanent.
Launch-profile JSON separately exports settings/relative references, never binaries
or personal documents. Downloaded backups may contain software you chose to save:
share only material you have rights to redistribute.

## Compatibility limits

The actual engine is js-dos **emulators 8.5.3**, classic DOSBox worker. DOS 8.3 paths,
a bounded package (up to 32 MiB), a temporary writable C:/ mount and a session
limit apply. Mouse/audio are optional and application-dependent. Disk booting is
not implemented. COM remains ambiguous without context; a `.exe` suffix proves
nothing. MZ/PE/NE/ELF/ZIP/selected disk signatures are inspection evidence only.

Windows NE/PE32 uses an **experimental, disabled** Boxedwine descriptor. No Windows
application has been verified; no Wine filesystem or Windows assets are shipped.
PE64, ELF/Linux, classic Mac, arbitrary MSI and disk-image execution are unavailable.
Unsupported inputs retain inspection/report/profile export. The planner's automatic
verified-compatible catalogue is empty; exact fixture observations live in the
[compatibility matrix](docs/compatibility-matrix.md), not a universal support badge.

## Privacy

In the recorded local production browser tests, selected bytes, filenames, paths,
hashes, reports and documents did not appear in network requests. Both page and
worker traffic were observed. Runtime downloads are fixed same-origin assets;
cloud saves, guest networking, remote drives, telemetry, service workers and remote
error reporting are disabled/absent. Selected data stays in browser memory unless
you explicitly save to OPFS or export a download. Clipboard writing needs your
copy action; the app does not read the clipboard or arbitrary host directories.

These are tested observations, not protection against a compromised browser,
emulator escape, extension or modified deployment. A future hosting provider may
see ordinary IP/address and static-request logs; PHANTOM has no user-file upload
endpoint. Local tests do not establish a future deployment's policy. Recheck its
headers, injected scripts and page/worker traffic before making a hosted-locality
claim. [Security policy and limits](docs/security.md) explains the residual risks.

## Fixtures, license and source

Original PHANTOM source, documentation, tests and configuration are licensed under
**GNU GPL version 2 only (GPL-2.0-only)**: you may redistribute and modify them
under that license; they are provided without warranty. See [LICENSE](LICENSE)
and [the recorded compatibility review](docs/release-license-review.md).
Third-party material retains its own terms; no rights to users' files are claimed.

- **FreeDOS MEM 1.12:** unmodified official FreeDOS executable; GPL v2. SHA-256
  `6f850921e0fdd40ad172099ec126831c17397e250963402fb03f4eb7c79dc9f4`.
- **FreeCOM 0.86:** unmodified English COMMAND.COM plus original text resources in
  a deterministic ZIP; GPL v2, with retained SUPPL LGPL v2 source. ZIP SHA-256
  `fc598be15e3deaa559f65dee5911e89a9060791030d50cf127f3791248b7744e`.
- Origins, reconstruction, licenses and corresponding source are in the
  [fixture record](tests/fixtures/dos/README.md), [vendor inventory](vendor/dos/README.md)
  and [exact manifest](vendor/dos/manifest.json). No proprietary ROM, OS image,
  unlicensed application or commercial game is bundled.

[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) links the full grants for React,
fflate, the GPL emulator, its compiled dependencies and fixtures. Builds retain
those source/notice files beside runtime assets. Preserve them when distributing.
The upstream source rebuild review remains a public-runtime release gate; an npm
asset copy is not a demonstrated rebuild. The corrected source audit removes two
previously overlooked unused benchmark executables. See [release evidence](docs/evidence/prompt-11.md).

For contributors: read [AGENTS.md](AGENTS.md), [product scope](docs/product-spec.md),
[architecture](docs/architecture.md) and [matrix](docs/compatibility-matrix.md).
For submission work: [.kiro](.kiro/README.md), [Kiro ledger](docs/kiro-usage.md),
[readiness](docs/submission-readiness.md) and [2:55 demo script](docs/demo-script.md).
