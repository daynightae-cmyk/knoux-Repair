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

/* =========================================================================
 * BEHAVIORAL ACCEPTANCE SUITE — STATION 06 (Tests 1–35)
 * ========================================================================= */

test('Station 06 Acceptance 01: parseVolumeInventory handles 0-capacity volume without division by zero', () => {
  const drives = [{ Name: 'E:', TotalGB: 0, FreeGB: 0, FileSystem: 'RAW' }];
  const parsed = model.parseVolumeInventory(drives, 'C:');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].totalBytes, 0);
  assert.equal(parsed[0].usedPercent, 0);
  assert.equal(parsed[0].healthStatus, 'UNKNOWN');
});

test('Station 06 Acceptance 02: parseVolumeInventory returns empty array for empty drive list', () => {
  const parsed = model.parseVolumeInventory([], 'C:');
  assert.deepEqual(parsed, []);
});

test('Station 06 Acceptance 03: parseVolumeInventory flags warning status at >= 85% used', () => {
  const drives = [{ Name: 'D:', TotalGB: 100, FreeGB: 12, FileSystem: 'NTFS' }];
  const parsed = model.parseVolumeInventory(drives, 'C:');
  assert.equal(parsed[0].usedPercent, 88);
  assert.equal(parsed[0].healthStatus, 'WARNING');
});

test('Station 06 Acceptance 04: parseVolumeInventory flags healthy status when space is ample', () => {
  const drives = [{ Name: 'D:', TotalGB: 1000, FreeGB: 600, FileSystem: 'NTFS' }];
  const parsed = model.parseVolumeInventory(drives, 'C:');
  assert.equal(parsed[0].usedPercent, 40);
  assert.equal(parsed[0].healthStatus, 'HEALTHY');
});

test('Station 06 Acceptance 05: rankLargeFiles sorts files descending by size', () => {
  const files = [
    { path: 'a', name: 'a', sizeBytes: 100, category: 'other', isProtected: false, safeReviewCandidate: true },
    { path: 'b', name: 'b', sizeBytes: 500, category: 'other', isProtected: false, safeReviewCandidate: true },
    { path: 'c', name: 'c', sizeBytes: 300, category: 'other', isProtected: false, safeReviewCandidate: true },
  ];
  const ranked = model.rankLargeFiles(files);
  assert.deepEqual(ranked.map((f) => f.sizeBytes), [500, 300, 100]);
});

test('Station 06 Acceptance 06: rankLargeFiles respects limit parameter', () => {
  const files = [
    { path: 'a', name: 'a', sizeBytes: 100, category: 'other', isProtected: false, safeReviewCandidate: true },
    { path: 'b', name: 'b', sizeBytes: 500, category: 'other', isProtected: false, safeReviewCandidate: true },
    { path: 'c', name: 'c', sizeBytes: 300, category: 'other', isProtected: false, safeReviewCandidate: true },
  ];
  const ranked = model.rankLargeFiles(files, 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].sizeBytes, 500);
  assert.equal(ranked[1].sizeBytes, 300);
});

test('Station 06 Acceptance 07: isPathProtected strictly flags pagefile.sys and hiberfil.sys', () => {
  assert.equal(model.isPathProtected('C:\\pagefile.sys'), true);
  assert.equal(model.isPathProtected('C:\\hiberfil.sys'), true);
  assert.equal(model.isPathProtected('C:\\swapfile.sys'), true);
});

test('Station 06 Acceptance 08: isPathProtected strictly flags C:\\ProgramData', () => {
  assert.equal(model.isPathProtected('C:\\ProgramData\\system.dat'), true);
});

test('Station 06 Acceptance 09: classifySpaceHogs classifies developer caches', () => {
  const items = [{ path: 'D:\\Projects\\app\\node_modules\\large.bin', sizeBytes: 500000000 }];
  const hogs = model.classifySpaceHogs(items);
  assert.equal(hogs[0].category, 'Developer Cache');
  assert.equal(hogs[0].recommendation, 'REVIEW');
});

test('Station 06 Acceptance 10: classifySpaceHogs classifies temporary files', () => {
  const items = [{ path: 'C:\\Users\\user\\AppData\\Local\\Temp\\build.tmp', sizeBytes: 300000000 }];
  const hogs = model.classifySpaceHogs(items);
  assert.equal(hogs[0].category, 'Temporary Files');
  assert.equal(hogs[0].recommendation, 'REVIEW');
});

test('Station 06 Acceptance 11: classifySpaceHogs classifies games and media', () => {
  const items = [{ path: 'D:\\Steam\\steamapps\\common\\game\\data.pak', sizeBytes: 40000000000 }];
  const hogs = model.classifySpaceHogs(items);
  assert.equal(hogs[0].category, 'Games & Media');
  assert.equal(hogs[0].recommendation, 'REVIEW');
});

test('Station 06 Acceptance 12: classifySpaceHogs classifies virtual machines', () => {
  const items = [{ path: 'D:\\VMs\\win11.vhdx', sizeBytes: 60000000000 }];
  const hogs = model.classifySpaceHogs(items);
  assert.equal(hogs[0].category, 'Virtual Machines');
  assert.equal(hogs[0].recommendation, 'REVIEW');
});

test('Station 06 Acceptance 13: classifySpaceHogs flags system infrastructure', () => {
  const items = [{ path: 'C:\\Windows\\System32\\driver.sys', sizeBytes: 50000000 }];
  const hogs = model.classifySpaceHogs(items);
  assert.equal(hogs[0].category, 'System Infrastructure');
  assert.equal(hogs[0].isProtected, true);
});

test('Station 06 Acceptance 14: validateRecycleBinOperation in analyze mode is safe and non-destructive', () => {
  const res = model.validateRecycleBinOperation('analyze', 15, 1073741824);
  assert.equal(res.isDestructive, false);
  assert.equal(res.requiresConfirmation, false);
  assert.equal(res.reclaimableBytes, 1073741824);
  assert.match(res.messageEn, /Inspection only/);
});

test('Station 06 Acceptance 15: validateRecycleBinOperation in whatif mode is safe and non-destructive', () => {
  const res = model.validateRecycleBinOperation('whatif', 8, 500000000);
  assert.equal(res.isDestructive, false);
  assert.equal(res.requiresConfirmation, false);
  assert.match(res.messageAr, /فحص فقط/);
});

test('Station 06 Acceptance 16: validateRecycleBinOperation in run mode is DESTRUCTIVE with confirmation required', () => {
  const res = model.validateRecycleBinOperation('run', 25, 2147483648);
  assert.equal(res.isDestructive, true);
  assert.equal(res.requiresConfirmation, true);
  assert.match(res.messageEn, /Permanently emptying/);
  assert.match(res.messageAr, /التفريغ النهائي/);
});

test('Station 06 Acceptance 17: verifyFileHistorySafety protects actual backup data', () => {
  const res = model.verifyFileHistorySafety('D:\\FileHistory\\Data\\User\\Documents\\resume.docx');
  assert.equal(res.isProtectedBackup, true);
  assert.equal(res.isDisposableCache, false);
  assert.equal(res.action, 'PROTECTED_BACKUP');
});

test('Station 06 Acceptance 18: verifyFileHistorySafety allows clearing disposable staging cache', () => {
  const res = model.verifyFileHistorySafety('C:\\Users\\user\\AppData\\Local\\Microsoft\\Windows\\FileHistory\\temp\\staging.bin');
  assert.equal(res.isDisposableCache, true);
  assert.equal(res.isProtectedBackup, false);
  assert.equal(res.action, 'SAFE_TO_CLEAR');
});

test('Station 06 Acceptance 19: parseCompactOSState parses compacted state correctly', () => {
  const raw = 'The system is in the Compact state. It will remain in this state unless changed by an administrator.';
  const res = model.parseCompactOSState(raw);
  assert.equal(res.state, 'COMPACTED');
  assert.match(res.explanationEn, /currently compressed/);
});

test('Station 06 Acceptance 20: parseCompactOSState parses not-compacted state correctly', () => {
  const raw = 'The system is not in the Compact state because Windows has determined that it is not beneficial for this system.';
  const res = model.parseCompactOSState(raw);
  assert.equal(res.state, 'NOT_COMPACTED');
  assert.match(res.explanationEn, /uncompressed/);
});

test('Station 06 Acceptance 21: parseCompactOSState returns UNKNOWN for empty or unrecognized output', () => {
  const res = model.parseCompactOSState('');
  assert.equal(res.state, 'UNKNOWN');
});

test('Station 06 Acceptance 22: evaluateDiskHealth marks empty SMART status as INCONCLUSIVE (NO DATA != HEALTHY)', () => {
  const items = [{ Index: 0, Model: 'Drive 0', SizeGB: 500, Status: '' }];
  const evalRes = model.evaluateDiskHealth(items);
  assert.equal(evalRes[0].evaluation, 'INCONCLUSIVE');
});

test('Station 06 Acceptance 23: evaluateDiskHealth marks failure predicted when Status contains FAIL', () => {
  const items = [{ Index: 0, Model: 'Drive 0', SizeGB: 500, Status: 'Pred Fail' }];
  const evalRes = model.evaluateDiskHealth(items);
  assert.equal(evalRes[0].evaluation, 'FAILURE_PREDICTED');
});

test('Station 06 Acceptance 24: validateDiskCleanupCategories sorts safe vs caution categories', () => {
  const selected = ['TemporaryFiles', 'ThumbnailCache', 'RecycleBin', 'PreviousInstallations'];
  const res = model.validateDiskCleanupCategories(selected);
  assert.deepEqual(res.safeCategories, ['TemporaryFiles', 'ThumbnailCache']);
  assert.deepEqual(res.cautionCategories, ['RecycleBin', 'PreviousInstallations']);
  assert.equal(res.downloadsIncluded, false);
});

test('Station 06 Acceptance 25: validateDiskCleanupCategories flags user Downloads if included', () => {
  const selected = ['TemporaryFiles', 'Downloads'];
  const res = model.validateDiskCleanupCategories(selected);
  assert.equal(res.downloadsIncluded, true);
  assert.deepEqual(res.safeCategories, ['TemporaryFiles']);
});

test('Station 06 Acceptance 26: evaluateHibernationRollback returns disable action when enabled', () => {
  const res = model.evaluateHibernationRollback(true);
  assert.equal(res.actionRequired, 'DISABLE');
  assert.equal(res.command, 'powercfg -h off');
  assert.equal(res.rollbackCommand, 'powercfg -h on');
});

test('Station 06 Acceptance 27: evaluateHibernationRollback returns enable action when disabled', () => {
  const res = model.evaluateHibernationRollback(false);
  assert.equal(res.actionRequired, 'ENABLE');
  assert.equal(res.command, 'powercfg -h on');
  assert.equal(res.rollbackCommand, 'powercfg -h off');
});

test('Station 06 Acceptance 28: buildStorageReport aggregates totals truthfully', () => {
  const evidence = {
    volumes: [
      { name: 'C:', fileSystem: 'NTFS', totalBytes: 500000000000, usedBytes: 400000000000, freeBytes: 100000000000, usedPercent: 80, isSystem: true, healthStatus: 'HEALTHY' },
      { name: 'D:', fileSystem: 'NTFS', totalBytes: 1000000000000, usedBytes: 200000000000, freeBytes: 800000000000, usedPercent: 20, isSystem: false, healthStatus: 'HEALTHY' },
    ],
    largeFiles: [
      { path: 'C:\\big.iso', name: 'big.iso', sizeBytes: 5000000000, category: 'diskimage', isProtected: false, safeReviewCandidate: true },
    ],
    health: [
      { index: 0, model: 'NVMe SSD', sizeGB: 500, status: 'OK', smartPredictFailure: false, evaluation: 'HEALTHY' },
    ],
    hibernation: model.evaluateHibernationImpact(),
    reclaimPlan: [
      { toolId: 'DS04', titleEn: 'Recycle', titleAr: '', category: 'recycle', estimatedBytes: 2000000000, risk: 'DESTRUCTIVE', requiresAdmin: false, enabled: true },
    ],
  };

  const report = model.buildStorageReport(evidence, 'en');
  assert.equal(report.volumeCount, 2);
  assert.equal(report.totalStorageBytes, 1500000000000);
  assert.equal(report.totalFreeBytes, 900000000000);
  assert.equal(report.systemVolumeUsedPercent, 80);
  assert.equal(report.largeFilesObserved, 1);
  assert.equal(report.potentialReclaimBytes, 2000000000);
  assert.equal(report.hardwareHealthStatus, 'HEALTHY');
  assert.match(report.summaryEn, /Observed 2 volumes/);
  assert.match(report.summaryAr, /تم رصد 2 أقراص/);
});

test('Station 06 Acceptance 29: buildStorageReport reports CRITICAL hardware status if any disk fails', () => {
  const evidence = {
    volumes: [],
    largeFiles: [],
    health: [
      { index: 0, model: 'Disk 0', sizeGB: 500, status: 'OK', smartPredictFailure: false, evaluation: 'HEALTHY' },
      { index: 1, model: 'Disk 1', sizeGB: 1000, status: 'FAIL', smartPredictFailure: true, evaluation: 'FAILURE_PREDICTED' },
    ],
    hibernation: model.evaluateHibernationImpact(),
    reclaimPlan: [],
  };
  const report = model.buildStorageReport(evidence, 'en');
  assert.equal(report.hardwareHealthStatus, 'CRITICAL');
});

test('Station 06 Acceptance 30: filterLargeFiles filters by category', () => {
  const files = [
    { path: 'a.zip', name: 'a.zip', sizeBytes: 100, category: 'archive', isProtected: false, safeReviewCandidate: true },
    { path: 'b.mp4', name: 'b.mp4', sizeBytes: 200, category: 'media', isProtected: false, safeReviewCandidate: true },
  ];
  const filtered = model.filterLargeFiles(files, '', 'media');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'b.mp4');
});

test('Station 06 Acceptance 31: filterLargeFiles filters by query string', () => {
  const files = [
    { path: 'a.zip', name: 'a.zip', sizeBytes: 100, category: 'archive', isProtected: false, safeReviewCandidate: true },
    { path: 'b.mp4', name: 'video_holiday.mp4', sizeBytes: 200, category: 'media', isProtected: false, safeReviewCandidate: true },
  ];
  const filtered = model.filterLargeFiles(files, 'holiday');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'video_holiday.mp4');
});

test('Station 06 Acceptance 32: stationTools returns exactly the 10 DS tools', () => {
  const mockTools = [
    { ToolId: 'DS01', Category: '06-Disk-Space' },
    { ToolId: 'DS02', Category: '06-Disk-Space' },
    { ToolId: 'PA01', Category: '04-Programs-Applications' },
  ];
  const result = model.stationTools(mockTools);
  assert.equal(result.length, 2);
  assert.equal(result[0].ToolId, 'DS01');
  assert.equal(result[1].ToolId, 'DS02');
});

test('Station 06 Acceptance 33: outcomeFromRun formats success history entry in Arabic', () => {
  const mockTool = { ToolId: 'DS01', EnglishName: 'Analyze Disk Space', ArabicName: 'تحليل مساحة القرص' };
  const mockResult = { status: 'success', exitCode: 0, itemsProcessed: 4 };
  const entry = model.outcomeFromRun(mockTool, mockResult, 'ar');
  assert.equal(entry.status, 'SUCCESS');
  assert.match(entry.summary, /تحليل مساحة القرص/);
});

test('Station 06 Acceptance 34: outcomeFromRun formats failed history entry in English', () => {
  const mockTool = { ToolId: 'DS06', EnglishName: 'Compact System Files', ArabicName: 'ضغط ملفات النظام' };
  const mockResult = { status: 'error', exitCode: 1, errorMessage: 'Elevation denied by user' };
  const entry = model.outcomeFromRun(mockTool, mockResult, 'en');
  assert.equal(entry.status, 'FAILED');
  assert.equal(entry.summary, 'Elevation denied by user');
});

test('Station 06 Acceptance 35: categorizeFileExtension correctly identifies archives, media, documents, executables', () => {
  assert.equal(model.categorizeFileExtension('.zip'), 'archive');
  assert.equal(model.categorizeFileExtension('.mp4'), 'media');
  assert.equal(model.categorizeFileExtension('.pdf'), 'document');
  assert.equal(model.categorizeFileExtension('.exe'), 'executable');
  assert.equal(model.categorizeFileExtension('.iso'), 'diskimage');
  assert.equal(model.categorizeFileExtension('.unknown_ext'), 'other');
});
