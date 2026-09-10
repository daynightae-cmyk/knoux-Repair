import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveProvisioningReadiness,
  summarizeProvisioning,
  detectProvisioningSignals,
  filterCatalog,
  stationTools,
} from '../src/features/stations/station17/postInstallModel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, '../../Docs/TOOLS-MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('Station 17: manifest inventory is exactly 6 registered tools', () => {
  const piTools = manifest.filter(
    (t) => t.Category === '17-PostInstall-Setup' || t.ToolId.startsWith('PI')
  );
  assert.equal(piTools.length, 6);
  const ids = piTools.map((t) => t.ToolId).sort();
  assert.deepEqual(ids, ['PI01', 'PI02', 'PI03', 'PI04', 'PI05', 'PI06']);
});

test('Station 17: risk levels and admin requirements match safety architecture', () => {
  const piTools = manifest.filter(
    (t) => t.Category === '17-PostInstall-Setup' || t.ToolId.startsWith('PI')
  );
  const pi01 = piTools.find((t) => t.ToolId === 'PI01');
  const pi02 = piTools.find((t) => t.ToolId === 'PI02');
  const pi03 = piTools.find((t) => t.ToolId === 'PI03');
  const pi04 = piTools.find((t) => t.ToolId === 'PI04');
  const pi05 = piTools.find((t) => t.ToolId === 'PI05');
  const pi06 = piTools.find((t) => t.ToolId === 'PI06');

  assert.equal(pi01.RiskLevel, 'READ_ONLY');
  assert.equal(pi02.RiskLevel, 'SYSTEM_REPAIR');
  assert.equal(pi03.RiskLevel, 'READ_ONLY');
  assert.equal(pi04.RiskLevel, 'SYSTEM_REPAIR');
  assert.equal(pi05.RiskLevel, 'SAFE_CLEANUP');
  assert.equal(pi06.RiskLevel, 'READ_ONLY');

  // PI02 installs driver updates to the system kernel and requires elevation
  assert.equal(pi02.RequiresAdmin, true, 'PI02 must require admin elevation');
  assert.equal(pi01.RequiresAdmin, false);
  assert.equal(pi03.RequiresAdmin, false);
  assert.equal(pi04.RequiresAdmin, false);
  assert.equal(pi05.RequiresAdmin, false);
  assert.equal(pi06.RequiresAdmin, false);
});

test('Station 17: deriveProvisioningReadiness evaluates readiness truthfully', () => {
  assert.equal(deriveProvisioningReadiness(null), 'inconclusive');

  const basePreview = {
    CapturedAt: new Date().toISOString(),
    System: {
      Caption: 'Windows 11 Pro',
      Build: '26100',
      LastBoot: '2026-09-10T10:00:00Z',
      InstalledProgramCount: 80,
      PendingRestartSignals: [],
    },
    Winget: { Available: true, SourceCount: 2, Version: '1.9', Error: null },
    UpdateServices: [
      { Name: 'wuauserv', Status: 'Running', StartType: 'Manual' },
      { Name: 'bits', Status: 'Running', StartType: 'Manual' },
    ],
    DriverOffers: { Available: true, Count: 0, Offers: [], Error: null },
    Catalog: [
      { Selection: 1, Name: 'Chrome', PackageId: 'Google.Chrome', Category: 'Browser', Detected: true, MatchedDisplayName: 'Chrome', MatchedVersion: '120', Evidence: 'Registry' },
    ],
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  assert.equal(deriveProvisioningReadiness(basePreview), 'ready');

  // Pending reboot takes priority
  const rebootPreview = {
    ...basePreview,
    System: { ...basePreview.System, PendingRestartSignals: ['RebootRequired registry key'] },
  };
  assert.equal(deriveProvisioningReadiness(rebootPreview), 'pending_restart');

  // Driver offers available triggers attention
  const driverPreview = {
    ...basePreview,
    DriverOffers: { Available: true, Count: 2, Offers: [{ Selection: 1, Title: 'Intel Driver', DriverClass: 'Net', DriverModel: 'WiFi', DriverVerDate: '2026' }], Error: null },
  };
  assert.equal(deriveProvisioningReadiness(driverPreview), 'attention');
});

test('Station 17: summarizeProvisioning normalizes metrics accurately', () => {
  const preview = {
    CapturedAt: new Date().toISOString(),
    System: {
      Caption: 'Windows 11 Pro',
      Build: '26100',
      LastBoot: '2026-09-10T08:00:00Z',
      InstalledProgramCount: 95,
      PendingRestartSignals: ['Signal1', 'Signal2'],
    },
    Winget: { Available: true, SourceCount: 3, Version: '1.9.0', Error: null },
    UpdateServices: [
      { Name: 'wuauserv', Status: 'Running', StartType: 'Manual' },
    ],
    DriverOffers: { Available: true, Count: 1, Offers: [{ Selection: 1, Title: 'Driver', DriverClass: 'Display', DriverModel: 'GPU', DriverVerDate: '2026' }], Error: null },
    Catalog: [
      { Selection: 1, Name: 'Chrome', PackageId: 'Google.Chrome', Category: 'Browser', Detected: true, MatchedDisplayName: 'Chrome', MatchedVersion: '120', Evidence: 'Reg' },
      { Selection: 2, Name: 'VLC', PackageId: 'VideoLAN.VLC', Category: 'Media', Detected: false, MatchedDisplayName: null, MatchedVersion: null, Evidence: '' },
    ],
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const summary = summarizeProvisioning(preview);
  assert.equal(summary.systemCaption, 'Windows 11 Pro');
  assert.equal(summary.build, '26100');
  assert.equal(summary.installedAppsCount, 95);
  assert.equal(summary.pendingRestartCount, 2);
  assert.equal(summary.driverOffersCount, 1);
  assert.equal(summary.catalogTotal, 2);
  assert.equal(summary.catalogDetected, 1);
  assert.equal(summary.catalogMissing, 1);
  assert.equal(summary.wingetAvailable, true);
  assert.equal(summary.wingetSourcesCount, 3);
  assert.equal(summary.readiness, 'pending_restart');
});

test('Station 17: detectProvisioningSignals cites relevant tools', () => {
  const preview = {
    CapturedAt: new Date().toISOString(),
    System: {
      Caption: 'Windows 11',
      Build: '26100',
      LastBoot: null,
      InstalledProgramCount: 50,
      PendingRestartSignals: ['PendingReboot'],
    },
    Winget: { Available: true, SourceCount: 0, Version: '1.9', Error: null },
    UpdateServices: [],
    DriverOffers: { Available: true, Count: 3, Offers: [], Error: null },
    Catalog: [
      { Selection: 1, Name: 'VS Code', PackageId: 'Microsoft.VisualStudioCode', Category: 'Dev', Detected: false, MatchedDisplayName: null, MatchedVersion: null, Evidence: '' },
    ],
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const signals = detectProvisioningSignals(preview);
  const rebootSignal = signals.find((s) => s.id === 'pi-pending-restart');
  const driverSignal = signals.find((s) => s.recommendedToolId === 'PI01');
  const catalogSignal = signals.find((s) => s.recommendedToolId === 'PI03');
  const sourcesSignal = signals.find((s) => s.recommendedToolId === 'PI05');

  assert.ok(rebootSignal, 'Should detect pending restart');
  assert.ok(driverSignal, 'Should detect driver offers and cite PI01');
  assert.ok(catalogSignal, 'Should detect missing apps and cite PI03');
  assert.ok(sourcesSignal, 'Should detect empty winget sources and cite PI05');
});

test('Station 17: filterCatalog filters correctly by query and status', () => {
  const catalog = [
    { Selection: 1, Name: 'Google Chrome', PackageId: 'Google.Chrome', Category: 'Browsers', Detected: true, MatchedDisplayName: 'Chrome', MatchedVersion: '120', Evidence: 'Reg' },
    { Selection: 2, Name: '7-Zip', PackageId: '7zip.7zip', Category: 'Utilities', Detected: false, MatchedDisplayName: null, MatchedVersion: null, Evidence: '' },
    { Selection: 3, Name: 'VLC Media Player', PackageId: 'VideoLAN.VLC', Category: 'Media', Detected: false, MatchedDisplayName: null, MatchedVersion: null, Evidence: '' },
  ];

  assert.equal(filterCatalog(catalog, '', 'all').length, 3);
  assert.equal(filterCatalog(catalog, '', 'missing').length, 2);
  assert.equal(filterCatalog(catalog, '', 'installed').length, 1);
  assert.equal(filterCatalog(catalog, '7-zip', 'all').length, 1);
});
