import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createDosConfiguration, dosConfigurationIssue, DEFAULT_DOS_SETTINGS } from './config';
import { DOS_ASSETS, dosDescriptor } from './descriptor';
import { createLaunchProfile, validateLaunchProfile } from '../../profiles/launch-profile';
import { inspectedFixture } from '../../../tests/fixtures/planner-fixtures';
import { mzFixture } from '../../../tests/fixtures/probe-fixtures';
import { compatibilityPlanner } from '../../planner/compatibility-planner';
import { DOS_KEYS } from './keys';

async function input(name = 'MEM.EXE') {
  const { pkg, inspection } = await inspectedFixture(mzFixture(), name);
  const plan = compatibilityPlanner.plan(pkg, inspection, [dosDescriptor]);
  const profile = createLaunchProfile(pkg, plan, dosDescriptor);
  return { pkg, inspection, profile };
}
describe('bounded DOS launch configuration (no guest execution)', () => {
  it('stages the whole package and generates only constrained local startup commands', async () => {
    const { pkg, inspection, profile } = await input();
    const config = createDosConfiguration(pkg, profile);
    expect(config).toContain('mount c /home/web_user/package\nc:\ncd C:\\\nC:\\MEM.EXE');
    expect(config).toContain('ipx=false'); expect(config).toContain('serial1=disabled');
    expect(config).not.toContain('http'); expect(config).not.toContain('sockdrive');
    expect(compatibilityPlanner.plan(pkg, inspection, [dosDescriptor], { profile })).toMatchObject({ decision: 'experimental', canLaunch: true });
  });
  it.each(['long-filename.exe', 'evil%P%.exe', 'a&b.exe', 'unicode-ğ.exe', 'a;b.exe', 'a b.exe'])('rejects DOS-incompatible or command-bearing path %s', async path => {
    const { pkg, profile } = await input(path);
    expect(dosConfigurationIssue(pkg, profile)).toContain('8.3');
    expect(() => createDosConfiguration(pkg, profile)).toThrow();
  });
  it('rejects unsupported mounts, read-only promises and oversized guest packages before launch', async () => {
    const { pkg, profile } = await input();
    expect(dosConfigurationIssue(pkg, { ...profile, mounts: [{ packagePath: '.', guestPath: 'C:/', readOnly: true }] })).toContain('temporary');
    expect(dosConfigurationIssue(pkg, { ...profile, mounts: [{ packagePath: '.', guestPath: 'D:/', readOnly: false }] })).toContain('C:/');
    expect(dosConfigurationIssue({ ...pkg, totalBytes: 32 * 1024 * 1024 + 1 }, profile)).toContain('32 MiB');
  });
  it.each([{ cycles: 0 }, { cycles: 30001 }, { cycles: 'max' }, { core: 'dynamic\n[autoexec]' }, { machine: 'arbitrary' }, { xms: 'true' }, { ems: null }, { autoexec: 'mount d remote' }])('rejects uncontrolled DOS setting %j', async patch => {
    const { profile } = await input();
    expect(() => validateLaunchProfile({ ...profile, dos: { ...DEFAULT_DOS_SETTINGS, ...patch } })).toThrow();
  });
  it('pins every shipped runtime byte and uses physical GLFW input codes', async () => {
    for (const [name, hash] of Object.entries(DOS_ASSETS)) {
      expect(createHash('sha256').update(await readFile(`node_modules/emulators/dist/${name}`)).digest('hex')).toBe(hash);
    }
    expect(DOS_KEYS).toMatchObject({ KeyA: 65, Enter: 257, Escape: 256, ShiftLeft: 340, ArrowLeft: 263 });
  });
});
