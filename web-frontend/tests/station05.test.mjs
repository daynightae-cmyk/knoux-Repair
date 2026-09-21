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

test('Station 05: service-apps.css includes complete KNOUX Repair styles and keyframes', () => {
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

/* =========================================================================
 * BEHAVIORAL ACCEPTANCE SUITE — STATION 05 (Tests 1–40)
 * ========================================================================= */

test('Station 05 Acceptance 01: identical content hash and size classified as duplicate', () => {
  const res = model.validateContentIdentity(
    { name: 'doc1.pdf', size: 1048576, hash: 'a1b2c3d4e5f6' },
    { name: 'doc2.pdf', size: 1048576, hash: 'a1b2c3d4e5f6' }
  );
  assert.equal(res.isDuplicate, true);
  assert.equal(res.reason, 'IDENTICAL_CONTENT');
});

test('Station 05 Acceptance 02: identical name with different hash classified as NOT duplicate', () => {
  const res = model.validateContentIdentity(
    { name: 'config.json', size: 2048, hash: 'hash_v1' },
    { name: 'config.json', size: 2048, hash: 'hash_v2' }
  );
  assert.equal(res.isDuplicate, false);
  assert.equal(res.reason, 'HASH_MISMATCH');
});

test('Station 05 Acceptance 03: different name with identical hash classified as duplicate', () => {
  const res = model.validateContentIdentity(
    { name: 'original_photo.raw', size: 25000000, hash: 'photo_sha256_exact' },
    { name: 'copy (1) of photo.raw', size: 25000000, hash: 'photo_sha256_exact' }
  );
  assert.equal(res.isDuplicate, true);
  assert.equal(res.reason, 'IDENTICAL_CONTENT');
});

test('Station 05 Acceptance 04: zero-byte files classified as ZERO_BYTE and not content duplicates', () => {
  const res = model.validateContentIdentity(
    { name: 'empty1.txt', size: 0, hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { name: 'empty2.txt', size: 0, hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
  );
  assert.equal(res.isDuplicate, false);
  assert.equal(res.reason, 'ZERO_BYTE');
});

test('Station 05 Acceptance 05: selectKeeper with oldest strategy selects earliest timestamp', () => {
  const group = {
    Files: [
      { Path: 'C:\\Users\\user\\newer.png', ModifiedTime: '2026-05-01T10:00:00Z' },
      { Path: 'C:\\Users\\user\\oldest.png', ModifiedTime: '2024-01-01T10:00:00Z' },
      { Path: 'C:\\Users\\user\\middle.png', ModifiedTime: '2025-01-01T10:00:00Z' },
    ],
  };
  const keeper = model.selectKeeper(group, 'oldest');
  assert.equal(keeper, 'C:\\Users\\user\\oldest.png');
});

test('Station 05 Acceptance 06: selectKeeper with newest strategy selects latest timestamp', () => {
  const group = {
    Files: [
      { Path: 'C:\\Users\\user\\older.png', ModifiedTime: '2024-01-01T10:00:00Z' },
      { Path: 'C:\\Users\\user\\newest.png', ModifiedTime: '2026-06-01T10:00:00Z' },
    ],
  };
  const keeper = model.selectKeeper(group, 'newest');
  assert.equal(keeper, 'C:\\Users\\user\\newest.png');
});

test('Station 05 Acceptance 07: selectKeeper with shortestPath strategy selects shortest path', () => {
  const group = {
    Files: [
      { Path: 'D:\\Archive\\Deep\\Folder\\Structure\\file.dat' },
      { Path: 'D:\\file.dat' },
      { Path: 'D:\\Archive\\file.dat' },
    ],
  };
  const keeper = model.selectKeeper(group, 'shortestPath');
  assert.equal(keeper, 'D:\\file.dat');
});

test('Station 05 Acceptance 08: selectKeeper with longestPath strategy selects longest path', () => {
  const group = {
    Files: [
      { Path: 'D:\\file.dat' },
      { Path: 'D:\\Archive\\Deep\\Folder\\Structure\\file.dat' },
      { Path: 'D:\\Archive\\file.dat' },
    ],
  };
  const keeper = model.selectKeeper(group, 'longestPath');
  assert.equal(keeper, 'D:\\Archive\\Deep\\Folder\\Structure\\file.dat');
});

test('Station 05 Acceptance 09: selectKeeper with alphabetical strategy selects alphabetically first', () => {
  const group = {
    Files: [
      { Path: 'C:\\Z_folder\\file.txt' },
      { Path: 'C:\\A_folder\\file.txt' },
      { Path: 'C:\\M_folder\\file.txt' },
    ],
  };
  const keeper = model.selectKeeper(group, 'alphabetical');
  assert.equal(keeper, 'C:\\A_folder\\file.txt');
});

test('Station 05 Acceptance 10: selectKeeper honors userOverridePath if valid', () => {
  const group = {
    Files: [
      { Path: 'C:\\a.txt', ModifiedTime: '2024-01-01T00:00:00Z' },
      { Path: 'C:\\b.txt', ModifiedTime: '2026-01-01T00:00:00Z' },
    ],
  };
  const keeper = model.selectKeeper(group, 'oldest', 'C:\\b.txt');
  assert.equal(keeper, 'C:\\b.txt');
});

test('Station 05 Acceptance 11: selectKeeper falls back to policy if userOverridePath is invalid', () => {
  const group = {
    Files: [
      { Path: 'C:\\a.txt', ModifiedTime: '2024-01-01T00:00:00Z' },
      { Path: 'C:\\b.txt', ModifiedTime: '2026-01-01T00:00:00Z' },
    ],
  };
  const keeper = model.selectKeeper(group, 'oldest', 'C:\\nonexistent.txt');
  assert.equal(keeper, 'C:\\a.txt');
});

test('Station 05 Acceptance 12: enforceKeeperInvariant guarantees keeper is excluded from quarantine', () => {
  const allFiles = [{ Path: 'C:\\f1.bin' }, { Path: 'C:\\f2.bin' }, { Path: 'C:\\f3.bin' }];
  const candidates = ['C:\\f1.bin', 'C:\\f2.bin', 'C:\\f3.bin'];
  const result = model.enforceKeeperInvariant(allFiles, candidates, 'C:\\f2.bin');

  assert.equal(result.preservedKeeper, 'C:\\f2.bin');
  assert.deepEqual(result.safeQuarantinePaths.sort(), ['C:\\f1.bin', 'C:\\f3.bin']);
  assert.ok(!result.safeQuarantinePaths.includes('C:\\f2.bin'));
});

test('Station 05 Acceptance 13: enforceKeeperInvariant prevents zero-keeper state if user selects all', () => {
  const allFiles = [{ Path: 'C:\\doc1.docx' }, { Path: 'C:\\doc2.docx' }];
  const candidates = ['C:\\doc1.docx', 'C:\\doc2.docx'];
  const result = model.enforceKeeperInvariant(allFiles, candidates, 'C:\\doc1.docx');

  assert.equal(result.preservedKeeper, 'C:\\doc1.docx');
  assert.equal(result.safeQuarantinePaths.length, 1);
  assert.equal(result.safeQuarantinePaths[0], 'C:\\doc2.docx');
});

test('Station 05 Acceptance 14: detectHardLinks identifies hard link flag on group', () => {
  const group = {
    HardLinkInvolved: true,
    Files: [{ Path: 'C:\\f1.txt' }, { Path: 'C:\\f2.txt' }],
  };
  const res = model.detectHardLinks(group);
  assert.equal(res.hasHardLink, true);
  assert.equal(res.status, 'HARD_LINKS_DETECTED');
  assert.equal(res.reclaimMultiplier, 0);
});

test('Station 05 Acceptance 15: detectHardLinks identifies shared hard link indices', () => {
  const group = {
    Files: [
      { Path: 'C:\\f1.txt', HardLinkIndex: '1001-2002' },
      { Path: 'C:\\f2.txt', HardLinkIndex: '1001-2002' },
    ],
  };
  const res = model.detectHardLinks(group);
  assert.equal(res.hasHardLink, true);
  assert.equal(res.status, 'HARD_LINKS_DETECTED');
});

test('Station 05 Acceptance 16: detectHardLinks returns 1 reclaim multiplier for independent files', () => {
  const group = {
    HardLinkInvolved: false,
    Files: [
      { Path: 'C:\\f1.txt', HardLinkIndex: '1001-2001' },
      { Path: 'C:\\f2.txt', HardLinkIndex: '1001-2002' },
    ],
  };
  const res = model.detectHardLinks(group);
  assert.equal(res.hasHardLink, false);
  assert.equal(res.status, 'SAFE_COPIES');
  assert.equal(res.reclaimMultiplier, 1);
});

test('Station 05 Acceptance 17: validatePathContainment accepts valid path within root', () => {
  const res = model.validatePathContainment('D:\\Data\\Project\\file.txt', 'D:\\Data');
  assert.equal(res.isContained, true);
  assert.equal(res.reason, 'VALID');
});

test('Station 05 Acceptance 18: validatePathContainment rejects path with .. traversal', () => {
  const res = model.validatePathContainment('D:\\Data\\..\\Windows\\cmd.exe', 'D:\\Data');
  assert.equal(res.isContained, false);
  assert.equal(res.reason, 'PATH_TRAVERSAL');
});

test('Station 05 Acceptance 19: validatePathContainment rejects path outside root', () => {
  const res = model.validatePathContainment('C:\\Other\\file.txt', 'D:\\Data');
  assert.equal(res.isContained, false);
  assert.equal(res.reason, 'OUTSIDE_ROOT');
});

test('Station 05 Acceptance 20: validatePathContainment rejects Windows system root C:\\Windows', () => {
  const res = model.validatePathContainment('C:\\Windows\\System32\\calc.exe', 'C:\\');
  assert.equal(res.isContained, false);
  assert.equal(res.reason, 'SYSTEM_PROTECTED');
});

test('Station 05 Acceptance 21: validatePathContainment rejects C:\\Program Files', () => {
  const res = model.validatePathContainment('C:\\Program Files\\App\\app.dll', 'C:\\');
  assert.equal(res.isContained, false);
  assert.equal(res.reason, 'SYSTEM_PROTECTED');
});

test('Station 05 Acceptance 22: isPathExcluded detects .git folder', () => {
  assert.equal(model.isPathExcluded('D:\\Repo\\.git\\config', ['.git', 'node_modules']), true);
});

test('Station 05 Acceptance 23: isPathExcluded detects node_modules folder', () => {
  assert.equal(model.isPathExcluded('D:\\Repo\\node_modules\\pkg\\index.js', ['.git', 'node_modules']), true);
});

test('Station 05 Acceptance 24: isPathExcluded detects Quarantine folder', () => {
  assert.equal(model.isPathExcluded('D:\\Repo\\Quarantine\\item.bin', ['Quarantine']), true);
});

test('Station 05 Acceptance 25: isPathExcluded allows non-excluded folders', () => {
  assert.equal(model.isPathExcluded('D:\\Repo\\src\\index.ts', ['.git', 'node_modules']), false);
});

test('Station 05 Acceptance 26: calculateReclaimAccounting computes potential and selected bytes', () => {
  const groups = [
    { Id: 'g1', RecoverableBytes: 5000, Files: [{ Path: 'a' }, { Path: 'b' }], KeepPath: 'a' },
    { Id: 'g2', RecoverableBytes: 10000, Files: [{ Path: 'c' }, { Path: 'd' }], KeepPath: 'c' },
  ];
  const acc = model.calculateReclaimAccounting(groups, new Set(['g1']), { g1: 'a' });
  assert.equal(acc.potentialReclaimBytes, 15000);
  assert.equal(acc.selectedReclaimBytes, 5000);
  assert.equal(acc.totalGroupCount, 2);
  assert.equal(acc.selectedGroupCount, 1);
  assert.equal(acc.quarantineFileCount, 1);
});

test('Station 05 Acceptance 27: calculateReclaimAccounting returns 0 selected when no groups selected', () => {
  const groups = [
    { Id: 'g1', RecoverableBytes: 5000, Files: [{ Path: 'a' }, { Path: 'b' }], KeepPath: 'a' },
  ];
  const acc = model.calculateReclaimAccounting(groups, new Set([]));
  assert.equal(acc.potentialReclaimBytes, 5000);
  assert.equal(acc.selectedReclaimBytes, 0);
  assert.equal(acc.quarantineFileCount, 0);
});

test('Station 05 Acceptance 28: prepareQuarantinePlan packages non-keeper files', () => {
  const groups = [
    {
      Id: 'g1',
      Files: [
        { Path: 'D:\\Data\\keep.txt', SizeBytes: 100 },
        { Path: 'D:\\Data\\copy.txt', SizeBytes: 100 },
      ],
      KeepPath: 'D:\\Data\\keep.txt',
    },
  ];
  const plan = model.prepareQuarantinePlan(groups, new Set(['g1']), { g1: 'D:\\Data\\keep.txt' }, 'D:\\Data');
  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0].path, 'D:\\Data\\copy.txt');
  assert.equal(plan.rejectedPaths.length, 0);
});

test('Station 05 Acceptance 29: prepareQuarantinePlan filters out outside-root files into rejectedPaths', () => {
  const groups = [
    {
      Id: 'g1',
      Files: [
        { Path: 'D:\\Data\\keep.txt', SizeBytes: 100 },
        { Path: 'C:\\Windows\\System32\\evil.dll', SizeBytes: 100 },
      ],
      KeepPath: 'D:\\Data\\keep.txt',
    },
  ];
  const plan = model.prepareQuarantinePlan(groups, new Set(['g1']), { g1: 'D:\\Data\\keep.txt' }, 'D:\\Data');
  assert.equal(plan.targets.length, 0);
  assert.equal(plan.rejectedPaths.length, 1);
  assert.equal(plan.rejectedPaths[0].path, 'C:\\Windows\\System32\\evil.dll');
});

test('Station 05 Acceptance 30: verifyRestoreSafety returns RESTORE_DIRECT when destination clear', () => {
  const res = model.verifyRestoreSafety('D:\\Data\\file.txt', false, 'D:\\Data');
  assert.equal(res.canRestore, true);
  assert.equal(res.action, 'RESTORE_DIRECT');
});

test('Station 05 Acceptance 31: verifyRestoreSafety returns RESTORE_CONFLICT when destination exists', () => {
  const res = model.verifyRestoreSafety('D:\\Data\\file.txt', true, 'D:\\Data');
  assert.equal(res.canRestore, true);
  assert.equal(res.action, 'RESTORE_CONFLICT');
});

test('Station 05 Acceptance 32: verifyRestoreSafety returns RESTORE_REJECTED when path outside root', () => {
  const res = model.verifyRestoreSafety('C:\\Windows\\evil.txt', false, 'D:\\Data');
  assert.equal(res.canRestore, false);
  assert.equal(res.action, 'RESTORE_REJECTED');
});

test('Station 05 Acceptance 33: isPreviewStale returns true when file modified after preview', () => {
  const previewTime = 1000000;
  const fileMtime = 1000500;
  assert.equal(model.isPreviewStale(previewTime, fileMtime), true);
});

test('Station 05 Acceptance 34: isPreviewStale returns false when file unchanged', () => {
  const previewTime = 1000000;
  const fileMtime = 999000;
  assert.equal(model.isPreviewStale(previewTime, fileMtime), false);
});

test('Station 05 Acceptance 35: Arabic and Unicode paths handled correctly in path containment', () => {
  const res = model.validatePathContainment('D:\\المستندات\\مشروع_جديد\\ملف.pdf', 'D:\\المستندات');
  assert.equal(res.isContained, true);
  assert.equal(res.reason, 'VALID');
});

test('Station 05 Acceptance 36: DF09 script is strictly READ_ONLY in manifest and script text', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const df09Entry = manifest.find((e) => e.ToolId === 'DF09');
  assert.equal(df09Entry.RiskLevel, 'READ_ONLY');
  const df09Script = readRepo('05-Duplicate-Files/DF09-ListDuplicateSystemFiles.ps1');
  assert.match(df09Script, /READ_ONLY/);
  assert.doesNotMatch(df09Script, /Remove-Item/);
});

test('Station 05 Acceptance 37: DF10 restore script provides quarantine restoration capability', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const df10Entry = manifest.find((e) => e.ToolId === 'DF10');
  assert.ok(df10Entry);
  assert.equal(df10Entry.ToolId, 'DF10');
  const df10Script = readRepo('05-Duplicate-Files/DF10-RestoreQuarantinedItems.ps1');
  assert.match(df10Script, /Restore-KnouxQuarantinedItem/);
});

test('Station 05 Acceptance 38: quarantine count matches non-keeper count for multi-copy groups (3+ copies)', () => {
  const group = {
    Id: 'g_triplet',
    RecoverableBytes: 4000,
    Files: [
      { Path: 'D:\\copy1.iso', SizeBytes: 2000 },
      { Path: 'D:\\copy2.iso', SizeBytes: 2000 },
      { Path: 'D:\\copy3.iso', SizeBytes: 2000 },
    ],
    KeepPath: 'D:\\copy1.iso',
  };
  const plan = model.prepareQuarantinePlan([group], new Set(['g_triplet']), { g_triplet: 'D:\\copy1.iso' }, 'D:\\');
  assert.equal(plan.targets.length, 2);
  assert.deepEqual(plan.targets.map((t) => t.path), ['D:\\copy2.iso', 'D:\\copy3.iso']);
});

test('Station 05 Acceptance 39: zero-byte files handled gracefully by formatBytes', () => {
  assert.equal(model.formatBytes(0, 'en'), '0 B');
  assert.equal(model.formatBytes(-50, 'en'), '—');
});

test('Station 05 Acceptance 40: Station 05 tools category inventory matches 11 tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const stationTools = manifest.filter((e) => e.Category === '05-Duplicate-Files');
  assert.equal(stationTools.length, 11);
  assert.deepEqual(model.STATION05_TOOL_IDS.length, 11);
});
