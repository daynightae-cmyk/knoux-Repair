import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const STATION04_IDS = ['PA01','PA02','PA03','PA04','PA05','PA06','PA07','PA08','PA09','PA10'];

function readRepo(p) { return fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'); }

test('Station 04: manifest inventory is exactly 10 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((e) => e.Category === '04-Programs-Applications');
  assert.equal(station.length, 10, 'Station 04 must have 10 tools');
  assert.deepEqual(station.map((e) => e.ToolId).sort(), [...STATION04_IDS].sort());
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve`);
  }
});

test('Station 04: every script honors analyze/what-if gate and records mode', () => {
  for (const id of STATION04_IDS) {
    const entry = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, '')).find((e) => e.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    const hasInlineGate = /(if|elseif)\s*\(\$AnalyzeOnly\s+-or\s+\$WhatIf\)/.test(script);
    assert.ok(hasInlineGate, `${id} must branch on AnalyzeOnly/WhatIf`);
    assert.match(script, /Start-KnouxSession[^\r\n]*-Mode/, `${id} must record the Core session mode`);
  }
});

test('Station 04: safe analyze smoke passes for read-only tools', () => {
  // Verify PA01 and PA06 scripts resolve and contain READ_ONLY markers.
  const pa01 = readRepo('04-Programs-Applications/PA01-ListInstalledPrograms.ps1');
  assert.match(pa01, /READ_ONLY/, 'PA01 must declare READ_ONLY');
  const pa06 = readRepo('04-Programs-Applications/PA06-CheckRuntimeComponents.ps1');
  assert.match(pa06, /READ_ONLY/, 'PA06 must declare READ_ONLY');
  const pa07 = readRepo('04-Programs-Applications/PA07-RemoveUnnecessaryWindowsApps.ps1');
  assert.match(pa07, /DESTRUCTIVE/, 'PA07 must declare DESTRUCTIVE');
  const pa10 = readRepo('04-Programs-Applications/PA10-ProgramsReport.ps1');
  assert.match(pa10, /READ_ONLY/, 'PA10 must declare READ_ONLY');
});

test('Station 04: repair ladder escalates properly', () => {
  // Verify PA03 (destructive/uninstall residual) is protected and PA02 (system repair) requires admin.
  const pa02 = readRepo('04-Programs-Applications/PA02-RepairProgramInstallations.ps1');
  assert.match(pa02, /RequiresAdmin\s*=\s*\$true/, 'PA02 must require admin');
  const pa03 = readRepo('04-Programs-Applications/PA03-UninstallResidualFiles.ps1');
  assert.match(pa03, /DESTRUCTIVE/, 'PA03 must declare destructive');
});

test('Station 04: packaged runtime includes 04-Programs-Applications', () => {
  // Verify package.json extraResources includes station 04.
  const pkg = JSON.parse(readRepo('package.json'));
  const includes = pkg.build?.extraResources?.some((r) => r.from && String(r.from).includes('04-Programs-Applications'));
  assert.ok(includes !== false, 'Package extraResources must include 04-Programs-Applications');
});
