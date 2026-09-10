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

const STATION14_IDS = ['DV01', 'DV02', 'DV03', 'DV04'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station14-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station14', 'driversModel.ts')],
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

test('Station 14: manifest inventory is exactly 4 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '14-Driver-Management');
  assert.equal(station.length, 4, 'Station 14 must have exactly 4 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION14_IDS].sort(),
    'Station 14 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 14: risk levels and admin requirements match safety architecture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const dv01 = manifest.find((t) => t.ToolId === 'DV01');
  assert.equal(dv01.RiskLevel, 'READ_ONLY');
  assert.equal(dv01.RequiresAdmin, false);

  const dv02 = manifest.find((t) => t.ToolId === 'DV02');
  assert.equal(dv02.RiskLevel, 'READ_ONLY');
  assert.equal(dv02.RequiresAdmin, false);

  const dv03 = manifest.find((t) => t.ToolId === 'DV03');
  assert.equal(dv03.RiskLevel, 'SYSTEM_REPAIR');
  assert.equal(dv03.RequiresAdmin, true, 'DV03 exporting drivers requires admin');

  const dv04 = manifest.find((t) => t.ToolId === 'DV04');
  assert.equal(dv04.RiskLevel, 'READ_ONLY');
  assert.equal(dv04.RequiresAdmin, false);
});

/* =========================================================================
 * DOMAIN MODEL DETERMINISTIC DERIVATIONS
 * ========================================================================= */

test('Station 14: deriveDriverCondition returns condition truthfully', () => {
  assert.equal(model.deriveDriverCondition(1, 0), 'CRITICAL');
  assert.equal(model.deriveDriverCondition(0, 2), 'NEEDS_ATTENTION');
  assert.equal(model.deriveDriverCondition(0, 0), 'HEALTHY');
});

test('Station 14: summarizeDrivers normalizes preview metrics accurately', () => {
  const preview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    Summary: {
      TotalDrivers: 150,
      SignedDrivers: 148,
      UnsignedDrivers: 2,
      ThirdPartyDrivers: 30,
      OlderDateSignals: 5,
      DeviceProblems: 1,
    },
    DeviceProblems: [
      { DeviceId: 'PCI\\VEN_10DE', Name: 'GPU Controller', Status: 'Error', ErrorCode: 43 },
    ],
    ReviewDrivers: [],
    ClassSummary: [
      { Class: 'Display', Count: 2 },
      { Class: 'Net', Count: 4 },
    ],
    RecentInventory: [],
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const summary = model.summarizeDrivers(preview);
  assert.equal(summary.condition, 'CRITICAL');
  assert.equal(summary.totalDrivers, 150);
  assert.equal(summary.signedDrivers, 148);
  assert.equal(summary.unsignedDrivers, 2);
  assert.equal(summary.thirdPartyDrivers, 30);
  assert.equal(summary.deviceProblemsCount, 1);
  assert.equal(summary.classesCount, 2);
});

test('Station 14: detectDriverSignals flags problem devices, unsigned, and exports', () => {
  const preview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    Summary: {
      TotalDrivers: 50,
      SignedDrivers: 48,
      UnsignedDrivers: 2,
      ThirdPartyDrivers: 10,
      OlderDateSignals: 0,
      DeviceProblems: 1,
    },
    DeviceProblems: [
      { DeviceId: 'USB\\VID_001', Name: 'Camera', Status: 'Fail', ErrorCode: 10 },
    ],
    ReviewDrivers: [],
    ClassSummary: [],
    RecentInventory: [],
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const signals = model.detectDriverSignals(preview);
  assert.ok(signals.some((s) => s.code === 'DRIVER_DEVICE_PROBLEM'));
  assert.ok(signals.some((s) => s.code === 'DRIVER_UNSIGNED'));
  assert.ok(signals.some((s) => s.code === 'DRIVER_EXPORT_CANDIDATE'));
});

test('Station 14: filterDriversByQuery and filterDriversByClass filter properly', () => {
  const drivers = [
    { DeviceName: 'Intel Wi-Fi 6', DeviceClass: 'Net', Provider: 'Intel', ProviderGroup: 'ThirdParty', Version: '22.0', DriverDate: '2023-01-01', AgeYears: 1, InfName: 'oem1.inf', Signed: true, DeviceStatus: 'OK', ProblemCode: 0, ReviewSignals: [] },
    { DeviceName: 'Realtek Audio', DeviceClass: 'MEDIA', Provider: 'Realtek', ProviderGroup: 'ThirdParty', Version: '6.0', DriverDate: '2021-01-01', AgeYears: 3, InfName: 'oem2.inf', Signed: false, DeviceStatus: 'OK', ProblemCode: 0, ReviewSignals: [] },
  ];

  const netDrivers = model.filterDriversByClass(drivers, 'Net');
  assert.equal(netDrivers.length, 1);
  assert.equal(netDrivers[0].DeviceName, 'Intel Wi-Fi 6');

  const queryDrivers = model.filterDriversByQuery(drivers, 'realtek');
  assert.equal(queryDrivers.length, 1);
  assert.equal(queryDrivers[0].DeviceName, 'Realtek Audio');
});
