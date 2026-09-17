import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const mainTsx = readWeb('src/main.tsx');
const css = readWeb('src/recovery-workspace.css');
const serviceApps = readWeb('src/components/ServiceApps.tsx');
const ciCapture = readWeb('scripts/run-capture-18-services-evidence-ci.mjs');

const services = [
  '02-System-Cleanup',
  '05-Duplicate-Files',
  '06-Disk-Space',
  '11-Backup-Recovery',
];

test('Recovery workspace override loads after the proven Vitality layer', () => {
  const vitalityIndex = mainTsx.indexOf("./vitality-workspace.css");
  const recoveryIndex = mainTsx.indexOf("./recovery-workspace.css");
  assert.ok(vitalityIndex >= 0, 'Vitality proof layer must remain loaded');
  assert.ok(recoveryIndex > vitalityIndex, 'Recovery override must load after the proven Vitality layer');
});

test('all four Recovery services remove the duplicated outer ACTIONS rail', () => {
  for (const service of services) {
    assert.match(
      css,
      new RegExp(`data-family='recovery'\\]\\[data-service='${service}'\\][^}]*> \\.knoux-command-tool-rail`, 's'),
      `${service} must suppress the duplicated FamilyPage ACTIONS rail`,
    );
  }
  assert.match(css, /\.knoux-command-tool-rail[\s\S]*display:\s*none\s*!important/);
});

test('Recovery keeps family service navigation and gives the operational center the remaining width', () => {
  assert.match(css, /grid-template-columns:\s*var\(--command-rail-width\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.knoux-command-service-rail\s*\{\s*display:\s*none/);
  assert.match(css, /\.knoux-command-live-column[\s\S]*width:\s*100%/);
  assert.match(css, /\.duplicate-studio-root[\s\S]*width:\s*100%/);
});

test('Cleanup, Disk Space and Backup stay mounted while generic preview refreshes run', () => {
  assert.match(serviceApps, /const stationOwnsLifecycle =/);
  for (const section of ['cleanup', 'disk', 'backupRecovery']) {
    assert.match(serviceApps, new RegExp(`activeSection === '${section}'`));
  }
  assert.match(serviceApps, /loading=\{loading && !stationOwnsLifecycle\}/);
});

test('CI route evidence treats Recovery stations as owners of their operational actions', () => {
  assert.match(ciCapture, /02-System-Cleanup[\s\S]*ownsActions: true/);
  assert.match(ciCapture, /06-Disk-Space[\s\S]*ownsActions: true/);
  assert.match(ciCapture, /11-Backup-Recovery[\s\S]*ownsActions: true/);
});
