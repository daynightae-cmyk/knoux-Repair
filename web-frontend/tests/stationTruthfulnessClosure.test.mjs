import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const s01 = read('src/features/stations/station01/MaintenanceStation.tsx');
const s02 = read('src/features/stations/station02/CleanupStation.tsx');
const s03 = read('src/features/stations/station03/NetworkStation.tsx');
const s05 = read('src/features/stations/station05/DuplicateStation.tsx');
const s06 = read('src/features/stations/station06/DiskSpaceStation.tsx');
const s06Model = read('src/features/stations/station06/diskSpaceModel.ts');
const s13 = read('src/features/stations/station13/PrivacyStation.tsx');
const s14 = read('src/features/stations/station14/DriversStation.tsx');
const s14Hero = read('src/features/stations/station14/DriversHeroVisual.tsx');
const s15 = read('src/features/stations/station15/MonitoringStation.tsx');

test('Station 01 never reports a clean scan before a check reported back', () => {
  assert.match(s01, /const scanReportedBack = completedCount > 0/);
  assert.match(s01, /scanReportedBack \? text\.noFindings/);
  assert.match(s01, /Nothing has been diagnosed yet/);
  assert.match(s01, /لم يُشخَّص شيء بعد/);
});

test('Station 02 and 03 previews are never logged as successful tool runs', () => {
  assert.doesNotMatch(s02, /kind: 'scan', toolId: 'SC11', mode: 'run', status: 'SUCCESS'/);
  assert.match(s02, /kind: 'scan', toolId: 'SC11', mode: 'run', status: preview \? 'INCONCLUSIVE' : 'ERROR'/);
  assert.doesNotMatch(s03, /kind: 'diagnose', toolId: 'NI11', mode: 'run', status: 'SUCCESS'/);
  assert.match(s03, /status: preview\?\.Adapters\?\.length \? 'INCONCLUSIVE' : 'ERROR'/);
});

test('Station 05 scan bar and engine labels stay truthful', () => {
  assert.doesNotMatch(s05, /width: '100%' \} \/>/);
  assert.match(s05, /\['COMPLETED', 'RESUMED', 'VERIFIED'\]\.includes\(jobState\.status\) \? 'is-complete' : 'is-indeterminate'/);
  assert.match(s05, /phase: 'RESULTS', status: 'RESUMED'/);
  assert.match(s05, /const engineSource = engineLabel === 'node' \|\| engineLabel === 'node-index'/);
  assert.match(s05, /DF11 PowerShell provider/);
});

test('Station 06 never derives a SMART pass from an empty evidence set', () => {
  assert.doesNotMatch(s06, /healthItems\.some\(\(h\) => h\.smartPredictFailure\) \? 'FAILURE PREDICTED' : 'NOMINAL'/);
  assert.match(s06, /healthItems\.length === 0\s*\n\s*\? t\.notCheckedYet/);
  assert.match(s06, /healthItems\.every\(\(h\) => h\.evaluation === 'HEALTHY'\)/);
  assert.match(s06, /t\.smartInconclusive/);
  assert.match(s06, /Detected Volumes: \{volumes\.length === 0 \? t\.notCheckedYet/);
  assert.match(s06, /Physical Drives Tested: \{healthItems\.length === 0 \? t\.notCheckedYet/);
});

test('Station 06 model fabricates no drive identity, file system, or zero size', () => {
  assert.doesNotMatch(s06Model, /d\.Name \|\| d\.Drive \|\| 'C:'/);
  assert.doesNotMatch(s06Model, /d\.FileSystem \|\| 'NTFS'/);
  assert.doesNotMatch(s06Model, /d\.Model \|\| 'Physical Drive'/);
  assert.doesNotMatch(s06Model, /const sizeGB = typeof d\.SizeGB === 'number' \? d\.SizeGB : 0;/);
  assert.match(s06Model, /let healthStatus: DriveVolume\['healthStatus'\] = 'UNKNOWN';/);
  assert.match(s06Model, /if \(totalBytes > 0\) \{/);
});

test('Station 13 gates every metric and the DNS flush behind a real audit', () => {
  assert.match(s13, /const auditMeasured = summary\.stance !== 'INCONCLUSIVE'/);
  assert.match(s13, /\{auditMeasured \? summary\.restrictedCount : t\.notCheckedYet\}/);
  assert.match(s13, /\{auditMeasured \? summary\.allowedCount : t\.notCheckedYet\}/);
  assert.match(s13, /\{auditMeasured \? summary\.runHistoryCount : t\.notCheckedYet\}/);
  assert.match(s13, /const dnsFlushNeedsElevation = Boolean\(tools\.find\(\(tool\) => tool\.ToolId === 'PR03'\)\?\.RequiresAdmin\) && !bridgeElevated/);
  assert.equal((s13.match(/disabled=\{dnsFlushNeedsElevation\}/g) ?? []).length, 2);
  assert.doesNotMatch(s13, /All privacy vectors and permissions are operating within standard hardened baseline/);
});

test('Station 14 gates every metric, both empty states, and the hero bus label', () => {
  assert.match(s14, /const inventoryMeasured = Boolean\(preview\?\.RecentInventory\?\.length \|\| preview\?\.ReviewDrivers\?\.length\)/);
  for (const key of ['summary.totalDrivers', 'summary.signedDrivers', 'summary.thirdPartyDrivers', 'summary.deviceProblemsCount']) {
    assert.match(s14, new RegExp(`inventoryMeasured \\? ${key.replace('.', '\\.')} : t\\.notCheckedYet`), `${key} must be gated`);
  }
  assert.equal((s14.match(/inventoryMeasured \? t\.noReviewNeeded : t\.notCheckedYet/g) ?? []).length, 1);
  assert.equal((s14.match(/inventoryMeasured \? t\.noProblems : t\.notCheckedYet/g) ?? []).length, 1);
  assert.match(s14, /disabled=\{!bridgeElevated\}/);
  assert.match(s14Hero, /'PNP STATUS NOT CHECKED'/);
  assert.match(s14Hero, /totalDrivers > 0\s*\n\s*\? 'PnP Devices OK'/);
});

test('Station 15 gates every metric behind a real sample and localizes its chrome', () => {
  assert.match(s15, /const sampleMeasured = summary\.condition !== 'INCONCLUSIVE'/);
  assert.match(s15, /\{sampleMeasured \? summary\.totalProcesses : t\.notCheckedYet\}/);
  assert.match(s15, /\{sampleMeasured \? summary\.unresponsiveCount : t\.notCheckedYet\}/);
  assert.match(s15, /\{sampleMeasured \? summary\.runningServices : t\.notCheckedYet\}/);
  assert.match(s15, /t\.ofTotalServices\(summary\.totalServices\)/);
  assert.match(s15, /\{tool\.Purpose \|\| t\.noDescription\}/);
  assert.doesNotMatch(s15, /'No description available\.'\}\s*<\/|tool\.Purpose \|\| '/);
  assert.doesNotMatch(s15, />User Execution<\/span>/);
  assert.match(s15, /display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #1e293b'/);
});

test('Station 13 and 14 tab strips wrap so no required tab leaves the dock center', () => {
  for (const [label, source] of [['privacy', s13], ['drivers', s14]]) {
    assert.equal((source.match(/display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #1e293b'/g) ?? []).length, 1, `${label} tab strip must wrap`);
    assert.doesNotMatch(source, /borderBottom: '1px solid #1e293b', gap: 6, overflowX: 'auto'/, `${label} must not scroll its tabs out of view`);
  }
});
