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

const STATION11_IDS = ['BR01', 'BR02', 'BR03', 'BR04', 'BR05'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station11-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station11', 'recoveryModel.ts')],
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

test('Station 11: manifest inventory is exactly 5 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '11-Backup-Recovery');
  assert.equal(station.length, 5, 'Station 11 must have exactly 5 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION11_IDS].sort(),
    'Station 11 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 11: risk levels and admin requirements match safety architecture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const br01 = manifest.find((t) => t.ToolId === 'BR01');
  assert.equal(br01.RiskLevel, 'SYSTEM_REPAIR');
  assert.equal(br01.RequiresAdmin, true, 'BR01 creating restore point must require admin');

  const br02 = manifest.find((t) => t.ToolId === 'BR02');
  assert.equal(br02.RiskLevel, 'SAFE_CLEANUP');
  assert.equal(br02.RequiresAdmin, false);

  const br03 = manifest.find((t) => t.ToolId === 'BR03');
  assert.equal(br03.RiskLevel, 'READ_ONLY');

  const br04 = manifest.find((t) => t.ToolId === 'BR04');
  assert.equal(br04.RiskLevel, 'READ_ONLY');

  const br05 = manifest.find((t) => t.ToolId === 'BR05');
  assert.equal(br05.RiskLevel, 'SYSTEM_REPAIR');
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (recoveryModel.ts)
 * ========================================================================= */

test('Station 11: deriveRecoveryReadiness evaluates categorical readiness truthfully', () => {
  assert.equal(model.deriveRecoveryReadiness(0, 0, 0), 'UNPROTECTED');
  assert.equal(model.deriveRecoveryReadiness(2, 0, 0), 'PARTIAL_COVERAGE');
  assert.equal(model.deriveRecoveryReadiness(0, 0, 1), 'PARTIAL_COVERAGE');
  assert.equal(model.deriveRecoveryReadiness(1, 1, 1), 'READY');
  assert.equal(model.deriveRecoveryReadiness(2, 0, 1), 'READY');
});

test('Station 11: summarizeRecoveryVault aggregates preview metadata', () => {
  const mockPreview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    RestorePoints: { QueryAvailable: true, Count: 2, Items: [{ SequenceNumber: 1, Description: 'P1', RestorePointType: 10, CreatedAt: 'Today' }] },
    ShadowCopies: { QueryAvailable: true, Count: 1, Items: [{ Id: 'id1', Volume: 'C:', CreatedAt: 'Today', Persistent: true, ClientAccessible: true }] },
    LocalBackups: { Root: 'D:\\Backups', RootAvailable: true, Count: 1, Latest: { Name: 'Backup_01', Path: 'D:\\Backups\\01', LastWriteAt: 'Today', FileCount: 150, SizeBytes: 1024 * 1024 * 50 }, Items: [] },
    BackupSources: [{ Name: 'Documents', Path: 'C:\\Users\\User\\Documents', Exists: true }],
    Storage: { ProjectDrive: 'D:', FreeGB: 45, TotalGB: 500 },
    Safety: { ChangesMade: false, Sources: [], Notice: 'Safe' },
  };

  const summary = model.summarizeRecoveryVault(mockPreview);
  assert.equal(summary.state, 'READY');
  assert.equal(summary.restorePointsCount, 2);
  assert.equal(summary.shadowCopiesCount, 1);
  assert.equal(summary.localBackupsCount, 1);
  assert.equal(summary.hasLatestLocalBackup, true);
  assert.equal(summary.latestBackupName, 'Backup_01');
  assert.equal(summary.sourcesVerifiedCount, 1);
});

test('Station 11: sortRestorePoints sorts descending by sequence number', () => {
  const points = [
    { SequenceNumber: 12, Description: 'Old', RestorePointType: 0, CreatedAt: null },
    { SequenceNumber: 45, Description: 'Newest', RestorePointType: 0, CreatedAt: null },
    { SequenceNumber: 20, Description: 'Middle', RestorePointType: 0, CreatedAt: null },
  ];
  const sorted = model.sortRestorePoints(points);
  assert.equal(sorted[0].SequenceNumber, 45);
  assert.equal(sorted[1].SequenceNumber, 20);
  assert.equal(sorted[2].SequenceNumber, 12);
});

test('Station 11: formatBytes formats byte units accurately for en and ar', () => {
  assert.equal(model.formatBytes(1024 * 1024 * 500, 'en'), '500.0 MB');
  assert.equal(model.formatBytes(1024 * 1024 * 1024 * 2.5, 'en'), '2.5 GB');
  assert.ok(model.formatBytes(1024 * 1024 * 500, 'ar').includes('م.ب'));
  assert.ok(model.formatBytes(1024 * 1024 * 1024 * 2.5, 'ar').includes('ج.ب'));
});

test('Station 11: detectRecoverySignals detects unprotected vectors and cites tools', () => {
  const signals = model.detectRecoverySignals({
    state: 'UNPROTECTED',
    restorePointsCount: 0,
    shadowCopiesCount: 0,
    localBackupsCount: 0,
    hasLatestLocalBackup: false,
    latestBackupName: null,
    latestBackupBytes: 0,
    latestBackupFiles: 0,
    sourcesVerifiedCount: 0,
    totalSourcesCount: 5,
    projectDriveFreeGB: 4,
  });

  assert.ok(signals.some((s) => s.code === 'NO_RESTORE_POINTS' && s.suggestedTool === 'BR01'));
  assert.ok(signals.some((s) => s.code === 'NO_LOCAL_PROFILE_BACKUP' && s.suggestedTool === 'BR02'));
  assert.ok(signals.some((s) => s.code === 'LOW_BACKUP_STORAGE' && s.suggestedTool === 'BR04'));
});

/* =========================================================================
 * COMPONENT & ROUTING INTEGRATION
 * ========================================================================= */

test('Station 11: RecoveryStation and RecoveryHeroVisual components exist', () => {
  const stationSrc = readWeb('src/features/stations/station11/RecoveryStation.tsx');
  assert.ok(stationSrc.includes('export default function RecoveryStation'), 'RecoveryStation component must be exported');
  assert.ok(stationSrc.includes('BR01–BR05'), 'Must cite Station 11 tool range');

  const heroSrc = readWeb('src/features/stations/station11/RecoveryHeroVisual.tsx');
  assert.ok(heroSrc.includes('export default function RecoveryHeroVisual'), 'RecoveryHeroVisual component must be exported');
});

test('Station 11: ServiceApps routes activeSection backupRecovery directly to RecoveryStation', () => {
  const src = readWeb('src/components/ServiceApps.tsx');
  assert.ok(src.includes("activeSection === 'backupRecovery'"), 'ServiceApps must route activeSection backupRecovery');
  assert.ok(src.includes('<RecoveryStation'), 'ServiceApps must render RecoveryStation');
});
