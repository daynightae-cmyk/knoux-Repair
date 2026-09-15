import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const serviceApps = read('src/components/ServiceApps.tsx');
const stationCss = read('src/service-station-integration.css');
const workbenchCss = read('src/workbench-anima-finish.css');
const app = read('src/App.tsx');
const diskHero = read('src/features/stations/station06/DiskSpaceHeroVisual.tsx');
const servicesHero = read('src/features/stations/station07/ServicesHeroVisual.tsx');
const performance = read('src/features/stations/station08/PerformanceStation.tsx');
const performanceHero = read('src/features/stations/station08/PerformanceHeroVisual.tsx');
const developerHero = read('src/features/stations/station12/DeveloperHeroVisual.tsx');
const privacyHero = read('src/features/stations/station13/PrivacyHeroVisual.tsx');
const driversHero = read('src/features/stations/station14/DriversHeroVisual.tsx');
const monitoringHero = read('src/features/stations/station15/MonitoringHeroVisual.tsx');

const serviceKeys = [
  'maintenance', 'cleanup', 'network', 'programs', 'duplicates', 'disk',
  'services', 'performance', 'security', 'diagnostics', 'backupRecovery',
  'developerTools', 'privacy', 'drivers', 'monitoring', 'softwareEnvironment',
  'postInstall', 'projectSonar',
];

const stationFiles = [
  'station01/MaintenanceStation.tsx', 'station02/CleanupStation.tsx', 'station03/NetworkStation.tsx',
  'station04/ProgramsStation.tsx', 'station05/DuplicateStation.tsx', 'station06/DiskSpaceStation.tsx',
  'station07/ServicesStation.tsx', 'station08/PerformanceStation.tsx', 'station09/SecurityStation.tsx',
  'station10/DiagnosticsStation.tsx', 'station11/RecoveryStation.tsx', 'station12/DeveloperStation.tsx',
  'station13/PrivacyStation.tsx', 'station14/DriversStation.tsx', 'station15/MonitoringStation.tsx',
  'station16/SoftwareStation.tsx', 'station17/PostInstallStation.tsx', 'station18/ProjectSonarStation.tsx',
];

test('all 18 real stations carry service identity hooks without replacing station runtime', () => {
  assert.match(serviceApps, /data-service-id=\{serviceId\}/);
  assert.match(serviceApps, /service-app-shell--\$\{serviceId\}/);
  for (const key of serviceKeys) {
    assert.match(stationCss, new RegExp(`data-service-id=['"]${key}['"]`));
  }
  for (const relative of stationFiles) {
    const source = read(`src/features/stations/${relative}`);
    assert.match(source, /Station|station/);
  }
});

test('all 18 service shells use the intended operational product identities', () => {
  for (const label of [
    'KNOUX Care', 'Space Cleaner', 'Connection Map', 'Application Studio',
    'Duplicate Intelligence', 'Storage Map', 'System Topology', 'Performance Observatory',
    'Security Evidence Center', 'Diagnostic Evidence Lab', 'Recovery Vault',
    'Engineering Workbench', 'Privacy Control Center', 'Driver Matrix', 'Live Observatory',
    'Runtime Matrix', 'Provisioning Pipeline', 'Project Intelligence Sonar',
  ]) {
    assert.match(serviceApps, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('service copy keeps ToolIds out of primary literal labels', () => {
  const visibleId = /['"][^'"\n]*\([A-Z]{2}\d{2}\)[^'"\n]*['"]/;
  for (const relative of stationFiles) {
    const source = read(`src/features/stations/${relative}`);
    assert.doesNotMatch(source, visibleId, relative);
  }
});

test('primary command cards present human actions instead of ToolId badges', () => {
  const primaryCardFiles = [
    'station03/NetworkStation.tsx', 'station06/DiskSpaceStation.tsx', 'station07/ServicesStation.tsx',
    'station08/PerformanceStation.tsx', 'station09/SecurityStation.tsx', 'station10/DiagnosticsStation.tsx',
    'station11/RecoveryStation.tsx', 'station12/DeveloperStation.tsx', 'station13/PrivacyStation.tsx',
    'station14/DriversStation.tsx', 'station15/MonitoringStation.tsx', 'station16/SoftwareStation.tsx',
    'station17/PostInstallStation.tsx', 'station18/ProjectSonarStation.tsx',
  ];
  for (const relative of primaryCardFiles) {
    const source = read(`src/features/stations/${relative}`);
    assert.doesNotMatch(source, />\{(?:tool|t)\.ToolId\}<\/span>/, relative);
  }
});

test('visuals do not invent disk, services, or performance telemetry before evidence', () => {
  assert.doesNotMatch(diskHero, /primary \? primary\.usedPercent : 68/);
  assert.match(diskHero, /hasVolumeEvidence/);
  assert.match(diskHero, /Not checked yet/);
  assert.doesNotMatch(servicesHero, /topology \? topology\.running : 85/);
  assert.doesNotMatch(servicesHero, />\s*(?:RPCSS|WMI|Spooler|DCOM|CryptSvc)\s*</);
  assert.match(servicesHero, /hasTopologyEvidence/);
  assert.doesNotMatch(performance, /LoadPercent \?\? 25|LoadPercent \?\? 42/);
  assert.match(performance, /LoadPercent \?\? null/);
  assert.match(performance, /INCONCLUSIVE/);
  assert.match(performanceHero, /cpuPercent = null/);
  assert.match(performanceHero, /memoryPercent = null/);
  assert.match(performanceHero, /hasCpuEvidence/);
  assert.match(performanceHero, /hasMemoryEvidence/);
});

test('inconclusive service visuals say not checked or awaiting evidence, never ready', () => {
  assert.match(developerHero, /NOT CHECKED YET/);
  assert.doesNotMatch(developerHero, /AUDIT READY/);
  assert.match(driversHero, /NOT CHECKED YET/);
  assert.doesNotMatch(driversHero, /INVENTORY READY|Ready to Query Drivers/);
  assert.match(monitoringHero, /NOT CHECKED YET/);
  assert.doesNotMatch(monitoringHero, /OBSERVATORY READY|Telemetry Ready|Proc A|Proc B|Proc C/);
  assert.match(privacyHero, /have not been checked yet|Evidence unavailable/);
  assert.doesNotMatch(privacyHero, /System Inspection Ready/);
});

test('route transitions mount incoming content concurrently to prevent the observed blank wait frame', () => {
  assert.match(app, /<AnimatePresence initial=\{false\} mode="sync">/);
  assert.doesNotMatch(app, /<AnimatePresence mode="wait">/);
});

test('engineering finish preserves a dominant real workspace and responsive truth surfaces', () => {
  assert.match(workbenchCss, /FINAL ENGINEERING CLOSURE/);
  assert.match(workbenchCss, /knoux-deck-center/);
  assert.match(workbenchCss, /knoux-deck-explorer/);
  assert.match(workbenchCss, /knoux-deck-side/);
  assert.match(workbenchCss, /prefers-reduced-motion/);
  assert.match(stationCss, /\[dir='rtl'\]/);
});
