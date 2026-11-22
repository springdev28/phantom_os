# Real DOS acceptance fixtures

These are lawfully redistributable open-source programs, subject to their retained
license/source terms. They are real binaries, not synthetic parser samples.
Never execute them on the host; select them in PHANTOM's browser interface.

| Input | Release and origin | License/source retained |
| --- | --- | --- |
| `MEM.EXE` | FreeDOS MEM 1.12, `BIN/MEM.EXE` from the [official FreeDOS 1.4 package](https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/base/mem.zip) | GPL v2; `vendor/dos/mem-LICENSE.txt`, `mem-source.zip` |
| `FREECOM.ZIP` → `APP/COMMAND.COM` | FreeCOM 0.86, unmodified English `BIN/COMMAND.COM` from the [official package](https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/dos/command/0.86/command.zip) | GPL v2; `vendor/dos/freecom-LICENSE.txt`, `freecom-source.zip`; bundled SUPPL LGPL v2 grant/source retained |

`COMMAND.COM` is actually a legacy MZ image, despite its suffix. Its old DOS
relocation table overlaps offset 0x3c, so those bytes must not be interpreted as a
Windows `e_lfanew` pointer. This real fixture caught and fixes that parser edge case.
The English message resource is already appended to the official executable.
The ZIP adds `APP/INPUT.TXT` (82 bytes) for a real guest resource-read/copy check and
`APP/BELL.TXT` (BEL+CRLF, 3 bytes) for the PC speaker audio check. These original,
minimal test text resources assert no additional copyright restriction.

Exact original download, retained binary, ZIP member and source hashes are in
[the manifest](../../../vendor/dos/manifest.json). Reconstruct using Python 3:

```sh
python3 scripts/dos-fixtures.py --mem /path/to/official-mem.zip --freecom /path/to/official-command.zip
python3 scripts/dos-fixtures.py --verify
```

The reconstruction script checks the official package SHA-256 values before
reading fixed members, retains their executable bytes unchanged, and creates a
stored ZIP with fixed entry order, timestamp and permissions. It performs no
archive extraction to disk and no execution. All corresponding source and notices
are already retained in `vendor/dos`; do not distribute binaries alone.

For exact UI steps, settings, guest commands and expected output see
[the DOS runtime guide](../../../docs/dos-runtime.md). Recorded browser outcomes
and limitations are in [Prompt 5 evidence](../../../docs/evidence/prompt-5.md).
