# Parser-only fixtures

`probe-fixtures.ts` constructs 19 deterministic byte arrays for header recognition.
They are original project test data, with no downloaded software/OS/ROM or copied
program payload. The PE/DOS/NE/ELF code areas and disk images are deliberately not
runnable application fixtures. They cannot verify emulators or program compatibility.

Prompt 4 reuses this byte corpus for deterministic planning regressions.
`planner-fixtures.ts` supplies profile settings and explicitly unit-only installed
descriptors. `verification.test.ts` uses unit-only observation records to test exact
matching and rejection; the production catalogue is empty. These test doubles must
never be shipped as runtime or guest-launch evidence. Profile JSON contains only
settings and file references, never these fixture bytes.

To create local files for manual selection, run from the project root with Node 24:

```sh
node --input-type=module <<'JS'
import { mkdirSync, writeFileSync } from 'node:fs';
import { parserFixtures } from './tests/fixtures/probe-fixtures.ts';
const directory = 'test-results/parser-fixtures';
mkdirSync(directory, { recursive: true });
for (const fixture of parserFixtures) writeFileSync(`${directory}/${fixture.name}`, fixture.bytes);
console.log(`Wrote ${parserFixtures.length} parser-only fixtures to ${directory}`);
JS
```

Choose a generated file in PHANTOM, then select **Analyze file**. The names deliberately
include misleading `.exe`, `.com`, `.docx` and extensionless examples. No sample is
uploaded or executed. `test-results/` is disposable and ignored by Git; the browser
test runner may replace it. Committed fixture provenance/hashes are recorded in
[the Prompt 2 evidence](../../docs/evidence/prompt-2.md).


## ZIP and folder fixtures — Prompt 3

`package-fixtures.ts` writes deterministic ordinary ZIP records and uses Node's
zlib for independent Deflate streams. DOS/Windows candidates contain the same
original parser-only MZ/PE headers, **not working applications**. Resources,
empty files/directories, inert scripts, mixed candidates, empty/corrupt archives,
ZIP-slip, nested ZIP and disk-image packages are included. Unit tests generate
additional malicious variants. No fixture is an executable runtime demonstration.

Generate manual ZIPs and a folder using Node 24:

```sh
node --input-type=module <<'JS'
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { packageFixtures, dosPackageFiles } from './tests/fixtures/package-fixtures.ts';
const directory = 'test-results/package-fixtures';
mkdirSync(directory, { recursive: true });
for (const fixture of packageFixtures) writeFileSync(join(directory, fixture.name), fixture.bytes);
for (const entry of dosPackageFiles) {
  const path = join(directory, 'SelectedFolder', entry.path);
  if (entry.path.endsWith('/')) mkdirSync(path, { recursive: true });
  else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, entry.bytes); }
}
JS
```

Choose **Import ZIP** or **Choose folder**, then **Analyze file/package**.
The [manifest](../../docs/evidence/prompt-3-fixtures.json) records ZIP and individual
file hashes. The real worker browser test reads every normalized file and compares
its SHA-256 to these authored source bytes; no adapter test double or guest run
substitutes for import evidence. These paths are generated test data only, never
arbitrary user-supplied output paths.
