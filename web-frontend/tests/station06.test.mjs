import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');

function readRepo(p) { return fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'); }
function readWeb(p) { return fs.readFileSync(path.join(WEB_ROOT, p), 'utf8'); }

const STATION06_IDS = ['DS01', 'DS02', 'DS03', 'DS04', 'DS05', 'DS06', 'DS07', 'DS08', 'DS09', 'DS10'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station06-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station06', 'diskSpaceModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

/* =========================================================================
 * REPOSITORY CONTRACT & MANIFEST VERIFICATION
 * ========================================================================= */

test('Station 06: manifest inventory is exactly 10 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '06-Disk-Space');
  assert.equal(station.length, 10, 'Station 06 must have exactly 10 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION06_IDS].sort(),
    'Station 06 ToolIds must match the manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 06: destructive tools honor analyze/what-if and confirmation contracts', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const ds04 = manifest.find((entry) => entry.ToolId === 'DS04');
  assert.ok(ds04, 'DS04 must exist');
  assert.equal(ds04.RiskLevel, 'DESTRUCTIVE', 'DS04 must be DESTRUCTIVE');
  assert.equal(ds04.AnalyzeOnlySupported, true, 'DS04 must support AnalyzeOnly');
  assert.equal(ds04.WhatIfSupported, true, 'DS04 must support WhatIf');
});

test('Station 06: admin requirements match security posture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const ds06 = manifest.find((entry) => entry.ToolId === 'DS06');
  const ds09 = manifest.find((entry) => entry.ToolId === 'DS09');
  assert.ok(ds06 && ds09);
  assert.equal(ds06.RequiresAdmin, true, 'DS06 CompactOS must require admin');
  assert.equal(ds09.RequiresAdmin, true, 'DS09 Disable Hibernation must require admin');
});

test('Station 06: read-only reporting tools are properly flagged and safe', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const readOnly = manifest.filter((entry) => entry.Category === '06-Disk-Space' && entry.RiskLevel === 'READ_ONLY');
  const readOnlyIds = readOnly.map((e) => e.ToolId);
  assert.ok(readOnlyIds.includes('DS01'), 'DS01 must be READ_ONLY');
  assert.ok(readOnlyIds.includes('DS02'), 'DS02 must be READ_ONLY');
  assert.ok(readOnlyIds.includes('DS03'), 'DS03 must be READ_ONLY');
  assert.ok(readOnlyIds.includes('DS07'), 'DS07 must be READ_ONLY');
  assert.ok(readOnlyIds.includes('DS10'), 'DS10 must be READ_ONLY');
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (diskSpaceModel.ts)
 * ========================================================================= */

test('Station 06: parseVolumeInventory calculates used and free capacity truthfully', () => {
  const drives = [
    { Name: 'C:', TotalGB: 500, FreeGB: 100, FileSystem: 'NTFS' },
    { Name: 'D:', TotalGB: 1000, FreeGB: 800, FileSystem: 'NTFS' },
  ];
  const parsed = model.parseVolumeInventory(drives, 'C:');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'C:');
  assert.equal(parsed[0].isSystem, true);
  assert.equal(parsed[0].usedPercent, 80);
  assert.equal(parsed[0].healthStatus, 'HEALTHY');

  assert.equal(parsed[1].name, 'D:');
  assert.equal(parsed[1].isSystem, false);
  assert.equal(parsed[1].usedPercent, 20);
});

test('Station 06: parseVolumeInventory flags critical volume usage at >= 95%', () => {
  const drives = [
    { Name: 'C:', TotalGB: 100, FreeGB: 3, FileSystem: 'NTFS' },
  ];
  const parsed = model.parseVolumeInventory(drives, 'C:');
  assert.equal(parsed[0].usedPercent, 97);
  assert.equal(parsed[0].healthStatus, 'CRITICAL');
});

test('Station 06: isPathProtected strictly defends Windows system files', () => {
  assert.equal(model.isPathProtected('C:\\Windows\\System32\\cmd.exe'), true);
  assert.equal(model.isPathProtected('C:\\pagefile.sys'), true);
  assert.equal(model.isPathProtected('C:\\hiberfil.sys'), true);
  assert.equal(model.isPathProtected('C:\\Program Files\\app\\app.exe'), true);
  assert.equal(model.isPathProtected('C:\\Users\\user\\Downloads\\bigfile.zip'), false);
  assert.equal(model.isPathProtected('D:\\Games\\installer.iso'), false);
});

test('Station 06: classifyLargeFile categorizes file types and flags safety candidate', () => {
  const archive = model.classifyLargeFile('C:\\Users\\user\\Downloads\\backup.tar.gz', 500 * 1024 * 1024);
  assert.equal(archive.category, 'archive');
  assert.equal(archive.isProtected, false);
  assert.equal(archive.safeReviewCandidate, true);

  const sysDll = model.classifyLargeFile('C:\\Windows\\System32\\large.dll', 200 * 1024 * 1024);
  assert.equal(sysDll.category, 'executable');
  assert.equal(sysDll.isProtected, true);
  assert.equal(sysDll.safeReviewCandidate, false);
});

test('Station 06: evaluateDiskHealth distinguishes SMART OK vs Failure Predicted vs Inconclusive', () => {
  const items = [
    { Index: 0, Model: 'Samsung 980 PRO', SizeGB: 1000, Status: 'OK', SmartPredictFailure: false },
    { Index: 1, Model: 'Crucial P3', SizeGB: 2000, Status: 'FAILURE PREDICTED', SmartPredictFailure: true },
    { Index: 2, Model: 'Generic USB', SizeGB: 64, Status: '' },
  ];
  const evalResult = model.evaluateDiskHealth(items);
  assert.equal(evalResult[0].evaluation, 'HEALTHY');
  assert.equal(evalResult[1].evaluation, 'FAILURE_PREDICTED');
  assert.equal(evalResult[2].evaluation, 'INCONCLUSIVE');
});

test('Station 06: evaluateHibernationImpact accurately discloses admin and Fast Startup impact', () => {
  const ramBytes = 16 * 1024 * 1024 * 1024; // 16 GB
  const assessment = model.evaluateHibernationImpact(ramBytes);
  assert.equal(assessment.requiresAdmin, true);
  assert.equal(assessment.affectsFastStartup, true);
  assert.equal(assessment.reversibility, 'FULLY_REVERSIBLE');
  assert.ok(assessment.estimateReclaimBytes > 0);
});

test('Station 06: formatBytes provides valid representations for English and Arabic', () => {
  const bytes = 10 * 1024 * 1024 * 1024; // 10 GB
  const en = model.formatBytes(bytes, 'en');
  const ar = model.formatBytes(bytes, 'ar');
  assert.match(en, /GB/);
  assert.match(ar, /جيجابايت/);
});

test('Station 06: calculatePotentialReclaim sums enabled reclaim candidates correctly', () => {
  const candidates = [
    { toolId: 'DS04', titleEn: 'Recycle', titleAr: '', category: 'recycle', estimatedBytes: 5000, risk: 'DESTRUCTIVE', requiresAdmin: false, enabled: true },
    { toolId: 'DS08', titleEn: 'Cleanup', titleAr: '', category: 'cleanup', estimatedBytes: 2000, risk: 'SAFE_CLEANUP', requiresAdmin: false, enabled: false },
    { toolId: 'DS06', titleEn: 'Compact', titleAr: '', category: 'compaction', estimatedBytes: 8000, risk: 'SAFE_CLEANUP', requiresAdmin: true, enabled: true },
  ];
  assert.equal(model.calculatePotentialReclaim(candidates), 13000);
});

/* =========================================================================
 * ARCHITECTURAL INTEGRATION (ServiceApps & Components)
 * ========================================================================= */

test('Station 06: DiskSpaceStation and DiskSpaceHeroVisual components exist', () => {
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station06', 'DiskSpaceStation.tsx')));
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station06', 'DiskSpaceHeroVisual.tsx')));
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station06', 'diskSpaceModel.ts')));
});

test('Station 06: ServiceApps routes activeSection disk directly to DiskSpaceStation', () => {
  const serviceAppsCode = readWeb('src/components/ServiceApps.tsx');
  assert.match(serviceAppsCode, /import\s+DiskSpaceStation\s+from/);
  assert.match(serviceAppsCode, /activeSection === ['"]disk['"]/);
  assert.match(serviceAppsCode, /<DiskSpaceStation/);
});

