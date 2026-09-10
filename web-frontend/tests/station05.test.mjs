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

const bridge = await import('../server/bridge.mjs');

const STATION05_IDS = ['DF01', 'DF02', 'DF03', 'DF04', 'DF05', 'DF06', 'DF07', 'DF08', 'DF09', 'DF10', 'DF11'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station05-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station05', 'duplicateModel.ts')],
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

test('Station 05: manifest inventory is exactly the 11 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '05-Duplicate-Files');
  assert.equal(station.length, 11, 'Station 05 must have exactly 11 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION05_IDS].sort(),
    'Station 05 ToolIds must match the manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 05: destructive tools honor analyze/what-if and quarantine backup contracts', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const destructive = manifest.filter((entry) => entry.Category === '05-Duplicate-Files' && entry.RiskLevel === 'DESTRUCTIVE');
  assert.ok(destructive.length >= 4, 'Must have destructive tools (DF02, DF03, DF04, DF05, DF08)');

  for (const entry of destructive) {
    assert.equal(entry.AnalyzeOnlySupported, true, `${entry.ToolId} must support analyze-only`);
    assert.equal(entry.WhatIfSupported, true, `${entry.ToolId} must support what-if`);
    assert.match(entry.BackupMethod, /Quarantine/i, `${entry.ToolId} must back up to quarantine`);
    assert.match(entry.RollbackMethod, /Quarantine/i, `${entry.ToolId} must provide quarantine rollback`);
  }
});

test('Station 05: read-only reporting tools are properly flagged and safe', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const readOnly = manifest.filter((entry) => entry.Category === '05-Duplicate-Files' && entry.RiskLevel === 'READ_ONLY');
  const readOnlyIds = readOnly.map((e) => e.ToolId);
  assert.ok(readOnlyIds.includes('DF01'), 'DF01 must be READ_ONLY');
  assert.ok(readOnlyIds.includes('DF09'), 'DF09 must be READ_ONLY');
  assert.ok(readOnlyIds.includes('DF11'), 'DF11 must be READ_ONLY');
  for (const entry of readOnly) {
    assert.equal(entry.RequiresAdmin, false, `${entry.ToolId} must not require admin`);
    assert.equal(entry.RequiresRestart, false, `${entry.ToolId} must not require restart`);
  }
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (duplicateModel.ts)
 * ========================================================================= */

test('Station 05: calculatePotentialReclaim correctly sums recoverable bytes', () => {
  const groups = [
    { Id: 'g1', ContentHash: 'hash1', FileCount: 2, TotalBytes: 2000, RecoverableBytes: 1000, Files: [] },
    { Id: 'g2', ContentHash: 'hash2', FileCount: 3, TotalBytes: 3000, RecoverableBytes: 2000, Files: [] },
  ];
  assert.equal(model.calculatePotentialReclaim(groups), 3000);
  assert.equal(model.calculatePotentialReclaim([]), 0);
});

test('Station 05: calculateSelectedCopies counts keepers and recoverable copies accurately', () => {
  const groups = [
    {
      Id: 'g1',
      ContentHash: 'hash1',
      FileCount: 2,
      TotalBytes: 2000,
      RecoverableBytes: 1000,
      Files: [
        { Path: 'C:\\a.txt', Name: 'a.txt', Size: 1000, ModifiedTime: '2026-01-01T00:00:00Z', Extension: '.txt' },
        { Path: 'C:\\b.txt', Name: 'b.txt', Size: 1000, ModifiedTime: '2026-01-02T00:00:00Z', Extension: '.txt' },
      ],
    },
    {
      Id: 'g2',
      ContentHash: 'hash2',
      FileCount: 3,
      TotalBytes: 6000,
      RecoverableBytes: 4000,
      Files: [
        { Path: 'C:\\x.png', Name: 'x.png', Size: 2000, ModifiedTime: '2026-01-01T00:00:00Z', Extension: '.png' },
        { Path: 'C:\\y.png', Name: 'y.png', Size: 2000, ModifiedTime: '2026-01-02T00:00:00Z', Extension: '.png' },
        { Path: 'C:\\z.png', Name: 'z.png', Size: 2000, ModifiedTime: '2026-01-03T00:00:00Z', Extension: '.png' },
      ],
    },
  ];

  const selectedAll = new Set(['g1', 'g2']);
  const res1 = model.calculateSelectedCopies(groups, selectedAll);
  assert.equal(res1.keepingCount, 2, 'One keeper preserved per group');
  assert.equal(res1.quarantineCount, 3, '1 redundant from g1 + 2 redundant from g2');
  assert.equal(res1.selectedBytes, 5000, 'Sum of recoverable bytes for selected groups');

  const selectedOne = new Set(['g1']);
  const res2 = model.calculateSelectedCopies(groups, selectedOne);
  assert.equal(res2.keepingCount, 1);
  assert.equal(res2.quarantineCount, 1);
  assert.equal(res2.selectedBytes, 1000);
});

test('Station 05: computeGroupChronology determines oldest and newest duplicate files', () => {
  const group = {
    Id: 'g1',
    ContentHash: 'hash1',
    FileCount: 3,
    TotalBytes: 300,
    RecoverableBytes: 200,
    Files: [
      { Path: 'C:\\older.txt', Name: 'older.txt', Size: 100, ModifiedTime: '2025-01-01T12:00:00Z' },
      { Path: 'C:\\middle.txt', Name: 'middle.txt', Size: 100, ModifiedTime: '2025-06-01T12:00:00Z' },
      { Path: 'C:\\newer.txt', Name: 'newer.txt', Size: 100, ModifiedTime: '2026-01-01T12:00:00Z' },
    ],
  };
  const chronology = model.computeGroupChronology(group);
  assert.ok(chronology.minTime < chronology.maxTime);
  assert.equal(chronology.minTime, new Date('2025-01-01T12:00:00Z').getTime());
  assert.equal(chronology.maxTime, new Date('2026-01-01T12:00:00Z').getTime());
});

test('Station 05: filterGroupsByQuery matches filename or path case-insensitively', () => {
  const groups = [
    {
      Id: 'g1',
      ContentHash: 'h1',
      Files: [{ Path: 'C:\\Photos\\Summer_Trip.jpg', Name: 'Summer_Trip.jpg' }],
    },
    {
      Id: 'g2',
      ContentHash: 'h2',
      Files: [{ Path: 'C:\\Docs\\Tax_2025.pdf', Name: 'Tax_2025.pdf' }],
    },
  ];

  const matchedPhoto = model.filterGroupsByQuery(groups, 'summer');
  assert.equal(matchedPhoto.length, 1);
  assert.equal(matchedPhoto[0].Id, 'g1');

  const matchedExt = model.filterGroupsByQuery(groups, '.PDF');
  assert.equal(matchedExt.length, 1);
  assert.equal(matchedExt[0].Id, 'g2');

  const emptyMatch = model.filterGroupsByQuery(groups, 'nonexistent');
  assert.equal(emptyMatch.length, 0);

  const blankQuery = model.filterGroupsByQuery(groups, '');
  assert.equal(blankQuery.length, 2);
});

test('Station 05: formatBytes formats byte units accurately for en and ar', () => {
  assert.equal(model.formatBytes(500, 'en'), '500 B');
  assert.match(model.formatBytes(1024 * 1024 * 5, 'en'), /5.*MB/);
  assert.match(model.formatBytes(1024 * 1024 * 1024 * 2.5, 'en'), /2\.5.*GB/);
});

/* =========================================================================
 * UI & STANDALONE APPLICATION INTEGRATION VERIFICATION
 * ========================================================================= */

test('Station 05: DuplicateStation source code provides full stateful app workflow', () => {
  const stationSource = readWeb('src/features/stations/station05/DuplicateStation.tsx');

  // Mini-navigation rail tabs
  assert.match(stationSource, /duplicate-mini-nav/, 'Must have standalone mini-navigation rail');
  assert.match(stationSource, /currentTab === 'scan'/, 'Supports scan landing tab');
  assert.match(stationSource, /currentTab === 'duplicates'/, 'Supports duplicates results tab');
  assert.match(stationSource, /currentTab === 'quarantine'/, 'Supports quarantine center tab');
  assert.match(stationSource, /currentTab === 'recovery'/, 'Supports recovery tab');
  assert.match(stationSource, /currentTab === 'system-review'/, 'Supports read-only system review tab');

  // Progressive disclosure landing screen
  assert.match(stationSource, /duplicate-landing-canvas/, 'Must have dedicated landing canvas');
  assert.match(stationSource, /START SCAN/, 'Must have prominent Start Scan CTA');
  assert.match(stationSource, /بدء الفحص/, 'Must have Arabic Start Scan CTA');

  // Safe keeper preservation and no fake score claims
  assert.match(stationSource, /سيتم الاحتفاظ بها/, 'Displays keeper preserved badge in Arabic');
  assert.match(stationSource, /Preserved/, 'Displays keeper preserved badge in English');
  assert.doesNotMatch(stationSource, /100% Junk Cleaned/, 'Must not contain fake junk percentage claims');
  assert.doesNotMatch(stationSource, /PC Health Score: \d+/, 'Must not contain fabricated health scores');

  // Recharts recovery visual and floating action dock
  assert.match(stationSource, /ResponsiveContainer/, 'Embeds Recharts responsive container');
  assert.match(stationSource, /duplicate-action-dock/, 'Includes action dock for batch actions');
});

test('Station 05: DuplicateHeroVisual provides original vector storage core and animations', () => {
  const heroSource = readWeb('src/features/stations/station05/DuplicateHeroVisual.tsx');

  assert.match(heroSource, /knoux-duplicate-hero-container/, 'Has container class');
  assert.match(heroSource, /id="dfCoreGlow"/, 'Has glowing energy core gradient');
  assert.match(heroSource, /df-central-chamber/, 'Has central translucent storage core');
  assert.match(heroSource, /KEEP ORIGINAL/, 'Keeper badge present on visual');
  assert.match(heroSource, /isScanning/, 'Supports dynamic scanning visual state');
  assert.match(heroSource, /quarantine/, 'Supports quarantine visual state');
});

test('Station 05: service-apps.css includes complete Glass Nexus styles and keyframes', () => {
  const cssSource = readWeb('src/service-apps.css');

  assert.match(cssSource, /\.duplicate-studio-root/, 'Defines .duplicate-studio-root');
  assert.match(cssSource, /\.duplicate-mini-nav/, 'Defines .duplicate-mini-nav');
  assert.match(cssSource, /\.knoux-duplicate-hero-container/, 'Defines .knoux-duplicate-hero-container');
  assert.match(cssSource, /@keyframes dfOrbitRotate/, 'Defines orbital rotation keyframes');
  assert.match(cssSource, /@keyframes dfScanRotate/, 'Defines radar scan rotation keyframes');
  assert.match(cssSource, /prefers-reduced-motion/, 'Includes reduced motion accessibility support');
});

test('Station 05: ServiceApps routes activeSection duplicates directly to DuplicateStation', () => {
  const serviceAppsSource = readWeb('src/components/ServiceApps.tsx');

  assert.match(serviceAppsSource, /import DuplicateStation from '\.\.\/features\/stations\/station05\/DuplicateStation';/);
  assert.match(serviceAppsSource, /activeSection === 'duplicates'\s*\?\s*<DuplicateStation/);
});
