import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReadiness, classifyDiagnosticRun } from '../src/lib/systemRepair.ts';

const baseSystem = {
  SystemDrive: 'C:',
  Drives: [
    { Name: 'C:', TotalGB: 200, FreeGB: 80, IsSystem: true },
    { Name: 'D:', TotalGB: 1000, FreeGB: 1 },
  ],
  CpuLoad: 12,
  FreeRamGB: 12,
  TotalRamGB: 32,
  DefenderRealtime: true,
  Firewall: [{ Profile: 'Domain', Enabled: true }],
};

test('system readiness uses only the system volume for capacity', () => {
  const readiness = computeReadiness(baseSystem);
  assert.equal(readiness.systemDrive?.Name, 'C:');
  assert.equal(readiness.checks.find((check) => check.id === 'systemCapacity')?.state, 'passed');
});

test('low system volume lowers readiness', () => {
  const readiness = computeReadiness({ ...baseSystem, Drives: [{ Name: 'C:', TotalGB: 200, FreeGB: 4, IsSystem: true }, { Name: 'D:', TotalGB: 1000, FreeGB: 900 }] });
  assert.equal(readiness.checks.find((check) => check.id === 'systemCapacity')?.state, 'review');
});

test('readiness score and gauge use the same canonical value at boundaries', () => {
  const perfect = computeReadiness(baseSystem);
  assert.equal(perfect.gaugeDegrees, perfect.score * 3.6);
  const maximumReview = computeReadiness({ ...baseSystem, Drives: [{ Name: 'C:', TotalGB: 200, FreeGB: 1, IsSystem: true }], CpuLoad: 99, FreeRamGB: 1, DefenderRealtime: false, Firewall: [{ Profile: 'Domain', Enabled: false }] });
  assert.equal(maximumReview.score, 52);
  assert.equal(maximumReview.gaugeDegrees, maximumReview.score * 3.6);
});

test('diagnostic result is represented without promoting failed or cancelled runs to success', () => {
  assert.equal(classifyDiagnosticRun({ status: 'success', result: { Status: 'Success', VerificationResult: 'OK' } }), 'completed_healthy');
  assert.equal(classifyDiagnosticRun({ status: 'success', result: { Status: 'Warning', VerificationResult: 'VIOLATIONS_FOUND' } }), 'completed_issues');
  assert.equal(classifyDiagnosticRun({ status: 'error', result: { Status: 'Failed', VerificationResult: 'FAILED' } }), 'failed');
  assert.equal(classifyDiagnosticRun({ status: 'cancelled', result: { Status: 'Cancelled' } }), 'cancelled');
});
