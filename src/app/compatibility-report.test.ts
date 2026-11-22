import { describe, expect, it } from 'vitest';
import { compatibilityReport } from './compatibility-report';
import { compatibilityPlanner } from '../planner/compatibility-planner';
import { runtimeRegistry } from '../runtime/registry';
import { inspectedFixture } from '../../tests/fixtures/planner-fixtures';
import { peFixture } from '../../tests/fixtures/probe-fixtures';

describe('explicit local compatibility report', () => {
  it('does not manufacture a report before inspection', () => {
    expect(compatibilityReport({ status: 'idle' })).toBeNull();
  });
  it('preserves the Windows blocker and separates header evidence from execution', async () => {
    const { pkg, inspection } = await inspectedFixture(peFixture(), 'MISLEADING.COM');
    const plan = compatibilityPlanner.plan(pkg, inspection, runtimeRegistry.list());
    const report = compatibilityReport({ status: 'unsupported', pkg, inspection, plan });
    expect(report).toContain('Detected format: pe32');
    expect(report).toContain('Decision: experimental');
    expect(report).toContain('Launch offered: no');
    expect(report).toContain('Observed launch evidence: no matching evidence');
    expect(report).toContain('Windows execution has not been verified');
    expect(report).toContain('Static recognition and profile validation do not prove execution');
    expect(report).not.toContain('4d 5a');
  });
});
