import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveSoftwareHubCondition,
  summarizeSoftwareHub,
  detectSoftwareSignals,
  filterSoftwareItems,
  filterDeveloperTools,
  filterChromeExtensions,
  stationTools,
  formatBytes,
  parseWingetUpgradeCount,
} from '../src/features/stations/station16/softwareModel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, '../../Docs/TOOLS-MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('Station 16: manifest inventory is exactly 8 registered tools', () => {
  const swTools = manifest.filter(
    (t) => t.Category === '16-Software-Environment' || t.ToolId.startsWith('SW')
  );
  assert.equal(swTools.length, 8);
  const ids = swTools.map((t) => t.ToolId).sort();
  assert.deepEqual(ids, ['SW01', 'SW02', 'SW03', 'SW04', 'SW05', 'SW06', 'SW07', 'SW08']);
});

test('Station 16: risk levels and safety contracts match architecture', () => {
  const swTools = manifest.filter(
    (t) => t.Category === '16-Software-Environment' || t.ToolId.startsWith('SW')
  );
  const sw04 = swTools.find((t) => t.ToolId === 'SW04');
  const sw05 = swTools.find((t) => t.ToolId === 'SW05');
  const sw06 = swTools.find((t) => t.ToolId === 'SW06');
  const sw07 = swTools.find((t) => t.ToolId === 'SW07');
  const sw08 = swTools.find((t) => t.ToolId === 'SW08');

  assert.equal(sw04.RiskLevel, 'SAFE_CLEANUP');
  assert.equal(sw05.RiskLevel, 'SYSTEM_REPAIR');
  assert.equal(sw06.RiskLevel, 'DESTRUCTIVE');
  assert.equal(sw07.RiskLevel, 'READ_ONLY');
  assert.equal(sw08.RiskLevel, 'READ_ONLY');

  for (const t of swTools) {
    assert.equal(t.RequiresAdmin, false, `Tool ${t.ToolId} should not require admin`);
    assert.equal(t.AnalyzeOnlySupported, true, `Tool ${t.ToolId} must support AnalyzeOnly`);
  }
});

test('Station 16: deriveSoftwareHubCondition returns condition truthfully', () => {
  assert.equal(deriveSoftwareHubCondition(null, null), 'inconclusive');

  const normalSoftware = {
    Items: [{ Name: 'App', Version: '1.0', Publisher: 'Pub', Kind: 'Desktop', CanUninstall: true }],
    Total: 1,
    DesktopCount: 1,
    AppxCount: 0,
    Truncated: false,
    Safety: { ChangesMade: false, InventorySources: ['registry'] },
  };

  const normalAdvanced = {
    CapturedAt: new Date().toISOString(),
    DeveloperTools: [{ Command: 'node', Available: true, Source: 'C:\\node.exe', Version: '20.0.0' }],
    ChromeExtensions: [],
    ChromeExtensionsTruncated: false,
    CacheEvidence: [{ Name: 'npm cache', Path: 'C:\\cache', Exists: true, SizeBytes: 1024 * 1024 }],
    Winget: { Available: true, Version: '1.9', UpgradeLines: [], Error: null },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  assert.equal(deriveSoftwareHubCondition(normalSoftware, normalAdvanced), 'optimal');

  // Large cache triggers attention
  const heavyCacheAdvanced = {
    ...normalAdvanced,
    CacheEvidence: [{ Name: 'npm cache', Path: 'C:\\cache', Exists: true, SizeBytes: 3 * 1024 * 1024 * 1024 }],
  };
  assert.equal(deriveSoftwareHubCondition(normalSoftware, heavyCacheAdvanced), 'attention');

  // Winget upgrades available triggers attention
  const upgradeAdvanced = {
    ...normalAdvanced,
    Winget: {
      Available: true,
      Version: '1.9',
      UpgradeLines: ['Name Id Version Available Source', '-----------------------------', 'Git Git.Git 2.40 2.45 winget'],
      Error: null,
    },
  };
  assert.equal(deriveSoftwareHubCondition(normalSoftware, upgradeAdvanced), 'attention');
});

test('Station 16: summarizeSoftwareHub normalizes metrics accurately', () => {
  const software = {
    Items: [
      { Name: 'Git', Version: '2.40', Publisher: 'Git', Kind: 'Desktop', CanUninstall: true },
      { Name: 'Terminal', Version: '1.18', Publisher: 'MS', Kind: 'Appx', CanUninstall: true },
    ],
    Total: 2,
    DesktopCount: 1,
    AppxCount: 1,
    Truncated: false,
    Safety: { ChangesMade: false, InventorySources: ['registry'] },
  };

  const advanced = {
    CapturedAt: new Date().toISOString(),
    DeveloperTools: [
      { Command: 'git', Available: true, Source: 'C:\\git.exe', Version: '2.40' },
      { Command: 'rustc', Available: false, Source: null, Version: null },
    ],
    ChromeExtensions: [
      { Profile: 'Default', ExtensionId: 'abc', Version: '1.0', Name: 'Ext1', Description: 'Test' },
    ],
    ChromeExtensionsTruncated: false,
    CacheEvidence: [
      { Name: 'npm cache', Path: 'C:\\cache', Exists: true, SizeBytes: 500000000 },
    ],
    Winget: {
      Available: true,
      Version: '1.9.0',
      UpgradeLines: ['Name Id Version Available Source', '-----------------------------', 'App1 id1 1.0 2.0 winget'],
      Error: null,
    },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const summary = summarizeSoftwareHub(software, advanced);
  assert.equal(summary.installedTotal, 2);
  assert.equal(summary.desktopCount, 1);
  assert.equal(summary.appxCount, 1);
  assert.equal(summary.detectedRuntimes, 1);
  assert.equal(summary.missingRuntimes, 1);
  assert.equal(summary.extensionCount, 1);
  assert.equal(summary.totalCacheBytes, 500000000);
  assert.equal(summary.wingetAvailable, true);
  assert.equal(summary.wingetVersion, '1.9.0');
  assert.equal(summary.wingetUpgradeCandidates, 1);
});

test('Station 16: detectSoftwareSignals identifies caches and upgrades with tool citations', () => {
  const software = {
    Items: [{ Name: 'App', Version: '1.0', Publisher: 'Pub', Kind: 'Desktop', CanUninstall: true }],
    Total: 1,
    DesktopCount: 1,
    AppxCount: 0,
    Truncated: false,
    Safety: { ChangesMade: false, InventorySources: [] },
  };

  const advanced = {
    CapturedAt: new Date().toISOString(),
    DeveloperTools: [{ Command: 'node', Available: true, Source: 'C:\\node.exe', Version: '20.0' }],
    ChromeExtensions: [{ Profile: 'Default', ExtensionId: 'id', Version: '1.0', Name: 'Ext', Description: '' }],
    ChromeExtensionsTruncated: false,
    CacheEvidence: [{ Name: 'npm cache', Path: 'C:\\npm', Exists: true, SizeBytes: 600 * 1024 * 1024 }],
    Winget: {
      Available: true,
      Version: '1.9',
      UpgradeLines: ['Name Id Version Available Source', '-----------------------------', 'Tool Tool.Id 1.0 2.0 winget'],
      Error: null,
    },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const signals = detectSoftwareSignals(software, advanced);
  const catalogSignal = signals.find((s) => s.recommendedToolId === 'SW01');
  const runtimesSignal = signals.find((s) => s.recommendedToolId === 'SW02');
  const cacheSignal = signals.find((s) => s.recommendedToolId === 'SW04');
  const upgradeSignal = signals.find((s) => s.recommendedToolId === 'SW05');
  const extensionSignal = signals.find((s) => s.recommendedToolId === 'SW03');

  assert.ok(catalogSignal, 'Should detect software inventory signal');
  assert.ok(runtimesSignal, 'Should detect active runtimes signal');
  assert.ok(cacheSignal, 'Should detect large cache signal');
  assert.ok(upgradeSignal, 'Should detect winget upgrades signal');
  assert.ok(extensionSignal, 'Should detect extensions signal');
});

test('Station 16: filter helpers correctly filter items, runtimes, and extensions', () => {
  const items = [
    { Name: 'Node.js', Version: '20.0.0', Publisher: 'OpenJS', Kind: 'Desktop', CanUninstall: true },
    { Name: 'Windows Terminal', Version: '1.18', Publisher: 'Microsoft', Kind: 'Appx', CanUninstall: true },
    { Name: 'Python 3.12', Version: '3.12.0', Publisher: 'Python Foundation', Kind: 'Desktop', CanUninstall: true },
  ];

  const desktopOnly = filterSoftwareItems(items, '', 'Desktop');
  assert.equal(desktopOnly.length, 2);

  const appxOnly = filterSoftwareItems(items, '', 'Appx');
  assert.equal(appxOnly.length, 1);

  const filteredQuery = filterSoftwareItems(items, 'terminal', 'all');
  assert.equal(filteredQuery.length, 1);
  assert.equal(filteredQuery[0].Name, 'Windows Terminal');

  const tools = [
    { Command: 'node', Available: true, Source: 'C:\\node.exe', Version: '20.0' },
    { Command: 'python', Available: true, Source: 'C:\\python.exe', Version: '3.12' },
  ];
  assert.equal(filterDeveloperTools(tools, 'py').length, 1);

  const exts = [
    { Profile: 'Default', ExtensionId: 'react-dev', Version: '5.0', Name: 'React DevTools', Description: 'React' },
    { Profile: 'Profile 1', ExtensionId: 'redux-dev', Version: '3.0', Name: 'Redux DevTools', Description: 'Redux' },
  ];
  assert.equal(filterChromeExtensions(exts, 'react').length, 1);
});

test('Station 16: formatBytes produces valid localized representations', () => {
  assert.equal(formatBytes(0, 'en'), '0 B');
  assert.equal(formatBytes(0, 'ar'), '0 بايت');
  assert.equal(formatBytes(1024 * 1024, 'en'), '1.0 MB');
  assert.equal(formatBytes(1024 * 1024, 'ar'), '1.0 ميجابايت');
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024, 'en'), '1.5 GB');
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024, 'ar'), '1.5 جيجابايت');
});
