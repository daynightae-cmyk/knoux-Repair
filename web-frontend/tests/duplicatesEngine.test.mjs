import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanDuplicateRoots,
  quarantineDuplicatePaths,
  isForbiddenPath,
  validateScanRoot,
  classifyType,
} from '../server/duplicatesEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-dupeng-'));
  const big = 'x'.repeat(4096);
  fs.writeFileSync(path.join(root, 'a.txt'), big);
  fs.writeFileSync(path.join(root, 'b-copy.txt'), big);
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'c-copy.txt'), big);
  fs.writeFileSync(path.join(root, 'unique.txt'), 'y'.repeat(4096));
  fs.writeFileSync(path.join(root, 'tiny.txt'), 'z');
  return root;
}

test('engine finds exact duplicates and skips unique and tiny files', () => {
  const root = makeFixture();
  try {
    const preview = scanDuplicateRoots({ roots: [root], minSizeBytes: 1024 });
    assert.equal(preview.Engine, 'node');
    assert.equal(preview.GroupCount, 1);
    assert.equal(preview.DuplicateCopies, 2);
    assert.equal(preview.Groups[0].Files.length, 3);
    assert.equal(preview.Groups[0].RecoverableBytes, 2 * 4096);
    assert.equal(preview.Truncated, false);
    assert.ok(preview.PreviewId.startsWith('eng-'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('engine keeper policy keeps oldest-then-alphabetical by default, newest on demand', () => {
  const root = makeFixture();
  try {
    const now = Date.now() / 1000;
    fs.utimesSync(path.join(root, 'a.txt'), now - 300, now - 300);
    fs.utimesSync(path.join(root, 'b-copy.txt'), now - 200, now - 200);
    fs.utimesSync(path.join(root, 'sub', 'c-copy.txt'), now - 100, now - 100);
    const oldest = scanDuplicateRoots({ roots: [root], minSizeBytes: 1024 });
    assert.ok(oldest.Groups[0].KeepPath.endsWith('a.txt'));
    const newest = scanDuplicateRoots({ roots: [root], minSizeBytes: 1024, keeperPolicy: 'Newest' });
    assert.ok(newest.Groups[0].KeepPath.endsWith('c-copy.txt'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('engine type filter narrows results honestly', () => {
  const root = makeFixture();
  try {
    const images = scanDuplicateRoots({ roots: [root], minSizeBytes: 1024, types: ['images'] });
    assert.equal(images.GroupCount, 0);
    assert.equal(images.FilesObserved, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('engine refuses forbidden and missing roots', () => {
  assert.equal(isForbiddenPath(process.env.SystemRoot || 'C:\\Windows'), true);
  assert.equal(isForbiddenPath('C:\\'), true);
  assert.equal(validateScanRoot('C:\\').ok, false);
  assert.equal(validateScanRoot(path.join(os.tmpdir(), 'knoux-nope-missing-xyz')).ok, false);
  assert.throws(() => scanDuplicateRoots({ roots: ['C:\\'] }), /FORBIDDEN_ROOT/);
  try {
    scanDuplicateRoots({ roots: [] });
    assert.fail('empty roots must throw');
  } catch (err) {
    assert.equal(err.code, 'NO_ROOTS');
  }
});

test('engine quarantine moves copies, preserves keeper, writes reader-compatible meta', () => {
  const root = makeFixture();
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-duprepo-'));
  try {
    const preview = scanDuplicateRoots({ roots: [root], minSizeBytes: 1024 });
    const group = preview.Groups[0];
    const doomed = group.Files.map((f) => f.Path).filter((p) => p !== group.KeepPath);
    assert.equal(doomed.length, 2);
    const result = quarantineDuplicatePaths(repo, doomed, { hashes: { [doomed[0]]: group.Hash } });
    assert.equal(result.movedCount, 2);
    assert.equal(result.failedCount, 0);
    assert.ok(fs.existsSync(group.KeepPath), 'keeper must survive');
    for (const m of result.moved) {
      assert.ok(!fs.existsSync(m.path), 'moved file must be gone from origin');
      assert.ok(fs.existsSync(m.quarantinePath), 'moved file must exist in quarantine');
      const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(m.quarantinePath), 'quarantine-meta.json'), 'utf8'));
      assert.equal(typeof meta.QuarantineId, 'string');
      assert.equal(meta.OriginalPath, m.path);
      assert.equal(meta.TransactionState, 'COMPLETE');
    }
    // Second attempt on the same (now missing) files reports failure, never success.
    const again = quarantineDuplicatePaths(repo, doomed);
    assert.equal(again.movedCount, 0);
    assert.equal(again.failedCount, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('engine quarantine refuses forbidden paths and directories', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-duprepo-'));
  try {
    const result = quarantineDuplicatePaths(repo, ['C:\\Windows\\notepad.exe', os.tmpdir()]);
    assert.equal(result.movedCount, 0);
    assert.equal(result.failedCount, 2);
    assert.deepEqual(result.failed.map((f) => f.error).sort(), ['FORBIDDEN_PATH', 'NOT_A_FILE']);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('classifier covers the documented file-type families', () => {
  assert.equal(classifyType('photo.JPG'), 'images');
  assert.equal(classifyType('clip.mp4'), 'video');
  assert.equal(classifyType('report.pdf'), 'documents');
  assert.equal(classifyType('song.flac'), 'audio');
  assert.equal(classifyType('backup.zip'), 'archives');
  assert.equal(classifyType('notes.xyz'), 'other');
});

test('bridge exposes the node engine scan and quarantine routes', () => {
  const bridge = fs.readFileSync(path.join(webRoot, 'server', 'bridge-core.mjs'), 'utf8');
  assert.match(bridge, /'engine-scan'/);
  assert.match(bridge, /'engine-quarantine'/);
  assert.match(bridge, /duplicatesEngine\.mjs/);
  assert.match(bridge, /scanDuplicateRoots/);
  assert.match(bridge, /quarantineDuplicatePaths/);
});

test('api client offers engine scan and quarantine calls', () => {
  const client = fs.readFileSync(path.join(webRoot, 'src', 'lib', 'api.ts'), 'utf8');
  assert.match(client, /duplicatesEngineScan/);
  assert.match(client, /duplicatesEngineQuarantine/);
  assert.match(client, /\/api\/duplicates\/engine-scan/);
  assert.match(client, /\/api\/duplicates\/engine-quarantine/);
});

test('station defaults to the node engine and keeps the DF11 fallback', () => {
  const station = fs.readFileSync(path.join(webRoot, 'src', 'features', 'stations', 'station05', 'DuplicateStation.tsx'), 'utf8');
  assert.match(station, /scanSource/);
  assert.match(station, /duplicatesScanJob/);
  assert.match(station, /duplicatesJobCancel/);
  assert.match(station, /duplicatesLatestScan/);
  assert.match(station, /duplicatesEngineQuarantine/);
  assert.match(station, /duplicatePreview\(folderToScan/);
  assert.match(station, /SHA-256/);
});

test('main entry loads the duplicates command-center styles', () => {
  const entry = fs.readFileSync(path.join(webRoot, 'src', 'main.tsx'), 'utf8');
  assert.match(entry, /duplicates-command-center\.css/);
});

test('engine reports honest duration and min-size evidence', () => {
  const root = makeFixture();
  try {
    const preview = scanDuplicateRoots({ roots: [root], minSizeBytes: 2048 });
    assert.equal(typeof preview.DurationMs, 'number');
    assert.ok(preview.DurationMs >= 0);
    assert.equal(preview.MinSizeBytes, 2048);
    assert.deepEqual(preview.ScannedRoots, [root]);
    assert.equal(preview.GroupCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('duplicates mounts through the single canonical station path and owns its own actions', () => {
  const familyPage = fs.readFileSync(path.join(webRoot, 'src', 'components', 'premium', 'FamilyPage.tsx'), 'utf8');
  const serviceApps = fs.readFileSync(path.join(webRoot, 'src', 'components', 'ServiceApps.tsx'), 'utf8');
  const stage = fs.readFileSync(path.join(webRoot, 'src', 'components', 'premium', 'FamilyLiveStage.tsx'), 'utf8');
  assert.match(familyPage, /05-Duplicate-Files/);
  assert.doesNotMatch(familyPage, /showDuplicateStudio/);
  assert.doesNotMatch(familyPage, /<DuplicateStation/);
  assert.equal((familyPage.match(/<FamilyLiveStage/g) ?? []).length, 1);
  assert.equal((serviceApps.match(/<DuplicateStation/g) ?? []).length, 1);
  assert.match(stage, /duplicatesDockEnabled = service\.id === '05-Duplicate-Files' && serviceAppMode/);
  assert.match(stage, /'05-Duplicate-Files': 'duplicates'/);
});

test('station renders pipeline, evidence, sort and scan-log from live data', () => {
  const station = fs.readFileSync(path.join(webRoot, 'src', 'features', 'stations', 'station05', 'DuplicateStation.tsx'), 'utf8');
  for (const marker of ['duplicate-pipeline', 'pipelineStep', 'duplicate-evidence-grid', 'duplicate-sort-box', 'setSortKey', 'duplicate-insight-grid', 'typeImpact', 'duplicate-scan-log', 'DurationMs']) {
    assert.match(station, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `station must contain ${marker}`);
  }
  assert.doesNotMatch(station, /Similar Files|perceptual|AI-recommended/i);
});
