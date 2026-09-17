import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const main = readWeb('src/main.tsx');
const css = readWeb('src/recovery-storage-polish.css');
const cleanup = readWeb('src/features/stations/station02/CleanupStation.tsx');
const duplicate = readWeb('src/features/stations/station05/DuplicateStation.tsx');
const disk = readWeb('src/features/stations/station06/DiskSpaceStation.tsx');
const recovery = readWeb('src/features/stations/station11/RecoveryStation.tsx');

test('Recovery polish loads after the proven System Vitality authority layer', () => {
  const vitality = main.indexOf("./system-vitality-polish.css");
  const recoveryPolish = main.indexOf("./recovery-storage-polish.css");
  assert.ok(vitality >= 0, 'System Vitality visual authority must remain loaded');
  assert.ok(recoveryPolish > vitality, 'Recovery visual authority must load after prior proof layers');
});

test('all four Recovery and Storage services own isolated visual scopes', () => {
  for (const service of ['02-System-Cleanup', '05-Duplicate-Files', '06-Disk-Space', '11-Backup-Recovery']) {
    assert.match(css, new RegExp(`data-service='${service}'`), `${service} must own a scoped visual treatment`);
  }
  assert.match(css, /data-family='recovery'/);
  assert.doesNotMatch(css, /\.knoux-home(?:\s|\{|__|-)/, 'Recovery polish must not restyle Home');
});

test('Cleanup keeps scan-review-run evidence surfaces and does not invent a health score', () => {
  assert.match(cleanup, /cleanup-groups/);
  assert.match(cleanup, /cleanup-review/);
  assert.match(cleanup, /cleanup-live/);
  assert.match(cleanup, /cleanup-history/);
  assert.match(css, /cleanup-landing-canvas[\s\S]*radial-gradient/);
  assert.match(css, /cleanup-group[\s\S]*linear-gradient/);
  assert.doesNotMatch(css, /--score\s*:/, 'visual polish must not inject a synthetic score');
});

test('Duplicate Files keeps integrity workflow and premium card surfaces', () => {
  assert.match(duplicate, /duplicate-studio-root/);
  assert.match(duplicate, /duplicate-group-card/);
  assert.match(duplicate, /duplicate-review-board/);
  assert.match(duplicate, /duplicate-quarantine-page/);
  assert.match(css, /duplicate-landing-canvas[\s\S]*radial-gradient/);
  assert.match(css, /duplicate-group-card[\s\S]*linear-gradient/);
});

test('Disk Space keeps measured telemetry and in-card execution state', () => {
  assert.match(disk, /usedPercent/);
  assert.match(disk, /toolStatuses\[tool\.ToolId\]/);
  assert.match(disk, /isRunning\s*=\s*status\s*===\s*'running'/);
  assert.match(css, /disk-space-station[\s\S]*glass-panel/);
  assert.match(css, /:has\(button:disabled\)/, 'running or unavailable disk actions need a visible card state');
});

test('Backup and Recovery stays evidence-backed and preserves real vault states', () => {
  assert.match(recovery, /summarizeRecoveryVault\(preview\)/);
  assert.match(recovery, /preview\?\.RestorePoints/);
  assert.match(recovery, /preview\?\.ShadowCopies/);
  assert.match(recovery, /preview\?\.LocalBackups/);
  assert.match(recovery, /recovery-vault-station/);
  assert.match(css, /recovery-vault-station[\s\S]*radial-gradient/);
  assert.doesNotMatch(css, /(?:READY|PROTECTED)\s*:\s*100/, 'visual layer must not fabricate readiness values');
});

test('Recovery polish keeps responsive and reduced-motion fallbacks', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
