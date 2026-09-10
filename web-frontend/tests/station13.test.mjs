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

const STATION13_IDS = ['PR01', 'PR02', 'PR03', 'PR04'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station13-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station13', 'privacyModel.ts')],
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

test('Station 13: manifest inventory is exactly 4 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '13-Privacy');
  assert.equal(station.length, 4, 'Station 13 must have exactly 4 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION13_IDS].sort(),
    'Station 13 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 13: risk levels and admin requirements match safety architecture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const pr01 = manifest.find((t) => t.ToolId === 'PR01');
  assert.equal(pr01.RiskLevel, 'READ_ONLY');
  assert.equal(pr01.RequiresAdmin, false);

  const pr02 = manifest.find((t) => t.ToolId === 'PR02');
  assert.equal(pr02.RiskLevel, 'DESTRUCTIVE');
  assert.equal(pr02.RequiresAdmin, false);

  const pr03 = manifest.find((t) => t.ToolId === 'PR03');
  assert.equal(pr03.RiskLevel, 'SAFE_CLEANUP');
  assert.equal(pr03.RequiresAdmin, true, 'PR03 flushing DNS must require admin');

  const pr04 = manifest.find((t) => t.ToolId === 'PR04');
  assert.equal(pr04.RiskLevel, 'READ_ONLY');
  assert.equal(pr04.RequiresAdmin, false);
});

/* =========================================================================
 * DOMAIN MODEL DETERMINISTIC DERIVATIONS
 * ========================================================================= */

test('Station 13: derivePrivacyStance determines stance truthfully without synthetic scoring', () => {
  const hardenedSettings = [
    { Id: '1', Name: 's1', Category: 'c', Available: true, State: 'Restricted', Value: 0, Detail: '' },
    { Id: '2', Name: 's2', Category: 'c', Available: true, State: 'Disabled', Value: 0, Detail: '' },
    { Id: '3', Name: 's3', Category: 'c', Available: true, State: 'Denied', Value: 'deny', Detail: '' },
    { Id: '4', Name: 's4', Category: 'c', Available: true, State: 'Enabled', Value: 1, Detail: '' },
  ];
  assert.equal(model.derivePrivacyStance(hardenedSettings), 'HARDENED');

  const balancedSettings = [
    { Id: '1', Name: 's1', Category: 'c', Available: true, State: 'Restricted', Value: 0, Detail: '' },
    { Id: '2', Name: 's2', Category: 'c', Available: true, State: 'Enabled', Value: 1, Detail: '' },
    { Id: '3', Name: 's3', Category: 'c', Available: true, State: 'Enabled', Value: 1, Detail: '' },
  ];
  assert.equal(model.derivePrivacyStance(balancedSettings), 'BALANCED');

  const permissiveSettings = [
    { Id: '1', Name: 's1', Category: 'c', Available: true, State: 'Enabled', Value: 1, Detail: '' },
    { Id: '2', Name: 's2', Category: 'c', Available: true, State: 'Allowed', Value: 'allow', Detail: '' },
  ];
  assert.equal(model.derivePrivacyStance(permissiveSettings), 'PERMISSIVE');

  assert.equal(model.derivePrivacyStance([]), 'INCONCLUSIVE');
});

test('Station 13: summarizePrivacy aggregates telemetry accurately', () => {
  const preview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    Settings: [
      { Id: 'locationAccess', Name: 'Location', Category: 'App permissions', Available: true, State: 'Allowed', Value: 'allow', Detail: '' },
      { Id: 'cameraAccess', Name: 'Camera', Category: 'App permissions', Available: true, State: 'Denied', Value: 'deny', Detail: '' },
      { Id: 'advertisingId', Name: 'Ads', Category: 'Personalization', Available: true, State: 'Restricted', Value: 0, Detail: '' },
    ],
    ActivityEvidence: {
      RunHistoryAvailable: true,
      RunHistoryEntryCount: 5,
      DnsCacheAvailable: true,
      DnsCacheEntryCount: 42,
    },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const summary = model.summarizePrivacy(preview);
  assert.equal(summary.totalSettings, 3);
  assert.equal(summary.restrictedCount, 2);
  assert.equal(summary.allowedCount, 1);
  assert.equal(summary.runHistoryCount, 5);
  assert.equal(summary.dnsCacheCount, 42);
  assert.equal(summary.hasActivityTraces, true);
  assert.equal(summary.hardwareSensorsAudited, 2);
});

test('Station 13: detectPrivacySignals identifies run history and DNS footprints', () => {
  const preview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    Settings: [
      { Id: 'advertisingId', Name: 'Ads', Category: 'Personalization', Available: true, State: 'Enabled', Value: 1, Detail: '' },
    ],
    ActivityEvidence: {
      RunHistoryAvailable: true,
      RunHistoryEntryCount: 3,
      DnsCacheAvailable: true,
      DnsCacheEntryCount: 12,
    },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const signals = model.detectPrivacySignals(preview);
  assert.ok(signals.some((s) => s.code === 'PRIVACY_RUN_HISTORY_TRACE'));
  assert.ok(signals.some((s) => s.code === 'PRIVACY_DNS_CACHE_TRACE'));
  assert.ok(signals.some((s) => s.code === 'PRIVACY_AD_ID_ENABLED'));
});

test('Station 13: filterSettingsByCategory isolates category groups', () => {
  const settings = [
    { Id: '1', Name: 'A', Category: 'Activity', Available: true, State: 'Disabled', Value: 0, Detail: '' },
    { Id: '2', Name: 'B', Category: 'Personalization', Available: true, State: 'Enabled', Value: 1, Detail: '' },
  ];
  const filtered = model.filterSettingsByCategory(settings, 'Activity');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].Id, '1');
});
