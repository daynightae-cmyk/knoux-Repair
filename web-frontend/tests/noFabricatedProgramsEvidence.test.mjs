import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/features/stations/station04/ProgramsStation.tsx'), 'utf8');

test('Programs station starts empty and never injects fabricated machine evidence', () => {
  assert.match(source, /useState<ProgramsEvidence>\(\(\) => emptyEvidence\(\)\)/);
  assert.doesNotMatch(source, /Seed initial diagnostics/);
  assert.doesNotMatch(source, /KB5072653|KB5126421|xyz_broken|PDFXEdit\.PDF/);
});

test('Generic service shortcuts are labelled as quick actions, not recommendations', () => {
  const serviceApps = fs.readFileSync(path.join(root, 'src/components/ServiceApps.tsx'), 'utf8');
  assert.match(serviceApps, /recommend: 'Quick actions'/);
  assert.match(serviceApps, /recommend: 'إجراءات سريعة'/);
  assert.doesNotMatch(serviceApps, /Recommended next step|الخطوة المقترحة التالية/);
});
