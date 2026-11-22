# Local workspaces and DOS documents — Prompt 7

PHANTOM starts in **temporary mode**. No account or backend is involved. Inspection
and execution use explicitly selected files, temporary browser objects and a guest
memory filesystem. Workspace saving is a separate, manual user action.

## Save, restore and delete

1. Inspect an application, choose its entrypoint and apply its launch profile.
2. In **Workspace**, check **Enable browser storage for manual saves**.
   **Save application software** and **Save captured working files** are separately
   unchecked by default. Without either, **Save workspace** stores only the profile,
   runtime pins, safe relative references and metadata; it never reads software bytes.
3. **Save workspace** replaces the one saved workspace with those exact choices.
   Previously saved file categories become absent if unchecked on the replacement.
   Save and capture are snapshots, not automatic synchronization.
4. Reload. The saved manifest and launch profile are schema/integrity checked and
   compared with this app's exact runtime build/assets. A matching profile is restored
   without loading an emulator. This validation is **not executable verification**.
5. Select **Restore workspace** to load saved file bytes, check every chunk hash,
   re-inspect software and reassess compatibility. The saved entrypoint is retained
   only if re-inspection still identifies it as a candidate. Start is always explicit.
   Raw COM still requires DOS intent confirmation; FreeCOM's COMMAND.COM is MZ.
6. If software was not saved, re-select and analyze the originals with the same
   relative paths, then restore any saved working files. New package selection clears
   temporary working copies to avoid carrying documents into a different program.
7. **Delete workspace** → **Confirm delete workspace** removes only PHANTOM's OPFS
   root. Current temporary selections, originals and previously downloaded exports
   remain unchanged. Turning manual saving off performs no writes and does not delete
   an existing saved copy.

A browser-local copy is private to this site's **origin and browser profile**.
Changing scheme, host or port means a different origin. OPFS is not an encrypted
vault or a boundary against other scripts in the same origin. The guest cannot
access it: DOS remains in an opaque-origin iframe with storage/network APIs denied.

OPFS and Web Locks require a secure context (HTTPS or supported loopback localhost).
Missing APIs or denied storage leave temporary inspection/execution and explicit
exports available. Reload after changing site permissions. Storage usage/quota are
browser estimates for the whole origin, not exact PHANTOM allocation accounting.
The app does not request durable-storage retention or promise permanence. Browser
clearing, private mode, eviction, profile loss and disk failure can remove data.

## Real DOS document transfer

Use the existing lawful `tests/fixtures/dos/FREECOM.ZIP` fixture, entrypoint
`APP/COMMAND.COM`, default C: mount, default DOS settings, US keyboard. Apply its
profile and start the real player. Create an original local text file named
`DOC.TXT` containing `LOCAL DOCUMENT SEVEN` and a line ending.

1. Select **Import document into running program**, then DOC.TXT. This calls the
   installed `CommandInterface.fsWriteFile('package/DOC.TXT', bytes)` through the
   adapter and local message channel. The copy appears at `C:\DOC.TXT`.
2. Focus the real DOS screen and type:

   ```dos
   TYPE DOC.TXT > RESULT.TXT
   ECHO CHANGED INSIDE DOS>>RESULT.TXT
   TYPE RESULT.TXT
   ```

3. **Refresh guest files** → **Export RESULT.TXT** reads actual guest bytes through
   `fsReadFile`, then downloads a Blob. The original host DOC.TXT stays unchanged.
4. **Capture RESULT.TXT** copies the current guest file into temporary app memory.
   It survives Stop/navigation, overlays a temporary package copy on relaunch, and
   can be explicitly saved in Workspace with **Save captured working files**.
   It is not a running-VM snapshot and does not capture later edits automatically.
5. Stop, save software and captured files in Workspace, reload and restore. Launch
   again and `TYPE RESULT.TXT`; append another line and export to check real continued
   file I/O. Capture again and save again if those further edits should be retained.

Live import accepts one new root file, DOS 8.3 ASCII naming, ≤8 MiB, with no overwrite
(case insensitive). Existing files/directories, unsafe names, excessive totals and
multiple files are rejected before mutation. Rename a local copy when needed.
Import does not open the document in an application or execute it. Directory caches
in other DOS programs may need a refresh; `RESCAN` is a DOSBox prompt option.
The tested FreeCOM path sees the imported file without RESCAN.

Save and close a document **inside its program** before export/capture: an application
may buffer changes in memory. Transfers are serialized at the supported API boundary.
A selected executable cannot be captured as a working document. Working copies are
limited to 32 MiB total and cannot overwrite the selected executable on relaunch.
Overlays still pass DOS path, size and mount validation; original application bytes
remain separate and unchanged.

Uncaptured guest changes disappear on stop, leaving Player, timeout, crash or reload.
There is no automatic exit snapshot; use live capture/export before stopping. Boxedwine
is disabled and exposes no live transfer controls. No dead Windows transfer button or
claim of a generic save-state API is offered.

## Portable export versus browser storage

- **Export profile JSON** downloads settings and relative references, without binary
  or document contents. It does not save OPFS or assert compatibility.
- **Export guest file** downloads current bytes from the running guest.
- **Save workspace** copies only explicitly chosen data categories into this origin's
  OPFS. It does not download files or touch the originals.
- **Export backup** downloads a ZIP of the *saved* workspace: `manifest.json`,
  `launch-profile.json`, and optional `application/` and `documents/` directories.
  Unsaved memory/live guest changes are excluded. The two JSON files contain no
  embedded file contents. Safe relative paths and empty application directories remain.

For portability, extract a backup locally, select the **contents** of `application/`
with the same relative paths, and import `launch-profile.json`. The browser folder
picker retains its selected root name; selecting the extracted root may require
reviewing the profile's entrypoint and mount paths. Import documents from `documents/`
through Player (new root file, or reselect a complete package before launch for nested
paths/overwrites). Backup is intentionally not an executable bundle or a one-click
backup importer. Changed runtime hashes require explicit profile review/reset; never
silently migrate an old launch configuration. Keep backups outside the browser for
retention. Application/software redistribution rights remain the user's responsibility.

## Storage implementation and limits

`LocalWorkspace` uses `readManifest`, `save`, `restore`, `exportBackup`, `remove` and
`estimate`. `OpfsWorkspace` is the browser implementation; no runtime global or
networking code lives in this layer. Temporary objects remain in the session controller.

- Owned root: `phantom-workspace-v1`; no directory is created during a missing-save
  check. Internal paths are generated UUID revisions and opaque numbered files,
  never imported names. The portable manifest carries validated relative names.
- Maximum 128 MiB saved file data, 64 MiB per application file, 32 MiB captured
  documents, 2,048 paths per group, 2 MiB manifest, 1 KiB head. DOS launch remains
  narrower: 32 MiB combined package/working files, DOS 8.3 paths, one C: mount.
- Blob/file reads and writes use ≤1 MiB chunks. SHA-256 per chunk is checked before
  any restored file set is applied. The closed manifest validates schemas, paths,
  collisions, quotas, chunk counts and launch settings. Hashes detect corruption;
  they are not signatures, permissions or evidence that software is safe.
- A new generation is fully written before `head.json` closes atomically. A failure
  or cancellation before commit preserves the prior head. Old/interrupted generations
  are cleaned after a successful save. Cleanup failure cannot invalidate the new head;
  a later save retries. Deletion is logical browser deletion, not secure disk erasure.
- One same-origin Web Lock serializes read/save/restore/backup/delete across tabs.
  The last completed explicit save wins. A generation requires temporary space for
  both old and new copies; quota preflight reserves new bytes plus 2 MiB. Browser write
  errors are still caught because estimates can change or be unavailable.
- Restore and backup are bounded but materialize file Blobs/ZIP output in memory.
  Browser peak heap, adversarial low-memory eviction and crash/power-loss durability
  are not measured guarantees. No automatic persistence, IndexedDB, service-worker
  user cache or `navigator.storage.persist()` call is installed.

No new dependency, emulator asset or fixture was adopted. ZIP backup reuses the
already audited fflate 0.8.3. The DOS host hash and build ID change with its transfer
code, so stale saved runtime pins cannot silently apply.

Primary API references used with installed 8.5.3 declarations and retained source:
[js-dos CommandInterface](https://js-dos.com/command-interface.html),
[OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system),
[atomic writable close](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable).
See [Prompt 7 evidence](evidence/prompt-7.md) for exact outcomes and limitations.
