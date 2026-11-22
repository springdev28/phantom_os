// Authored headers only. These files are deliberately not executable programs.
import { mkdir, writeFile } from 'node:fs/promises';
import { elfFixture, peFixture } from '../tests/fixtures/probe-fixtures.ts';
await mkdir('test-results/manual-inputs', { recursive: true });
for (const [name, bytes] of [['ELF64-parser-only.bin', elfFixture(true)], ['PE64-parser-only.exe', peFixture(true)]]) {
  await writeFile(`test-results/manual-inputs/${name}`, bytes);
}
console.log('Wrote inert parser fixtures under test-results/manual-inputs/. Do not execute them.');
