import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  openIndex,
  SCHEMA_VERSION,
  quickFingerprintSync,
  runIndexedScan,
  reconcileScan,
  getScanState,
  getScanPreview,
  getLatestScan,
  recordHistory,
  finishHistory,
  listHistory,
  restoreQuarantineEntries,
  verifyQuarantineEntries,
  createJobStore,
  ScanCancelled,
} from '../server/duplicatesJobs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function makeDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-dupidx-'));
  return { dir, db: openIndex(path.join(dir, 'index.db')) };
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-dupjob-'));
  const big = 'x'.repeat(6000);
  fs.writeFileSync(path.join(root, 'a.txt'), big);
  fs.writeFileSync(path.join(root, 'b.txt'), big);
  fs.writeFileSync(path.join(root, 'same-size-diff.txt'), 'y'.repeat(6000));
  fs.writeFileSync(path.join(root, 'unique.txt'), 'z'.repeat(6000) + 'q');
  return root;
}

test('index opens with schema version and required tables', () => {
  const { dir, db } = makeDb();
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
    assert.equal(row.value, String(SCHEMA_VERSION));
    for (const table of ['scans', 'files', 'groups', 'members', 'decisions', 'quarantine_log', 'run_history']) {
      const found = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      assert.ok(found, `table ${table} must exist`);
    }
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fingerprint is deterministic and bounded', () => {
  const root = makeFixture();
  try {
    const file = path.join(root, 'a.txt');
    assert.equal(quickFingerprintSync(file, 6000), quickFingerprintSync(file, 6000));
    assert.equal(quickFingerprintSync(file, 6000).length, 64);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('indexed scan rejects same-size different-content false positives', async () => {
  const { dir, db } = makeDb();
  const root = makeFixture();
  try {
    const phases = [];
    const outcome = await runIndexedScan(db, 'scan-fp-1', [root], { minSizeBytes: 1024 }, {
      onPhase: (phase) => phases.push(phase),
      shouldCancel: () => false,
    });
    assert.equal(outcome.status, 'COMPLETED');
    assert.equal(outcome.groups.length, 1);
    assert.deepEqual(outcome.groups[0].Files.map((f) => f.Name).sort(), ['a.txt', 'b.txt']);
    assert.ok(phases.includes('SCANNING'));
    assert.ok(phases.includes('FINGERPRINTING'));
    assert.ok(phases.includes('HASHING'));
    assert.ok(phases.includes('GROUPING'));
    const state = getScanState(db, 'scan-fp-1');
    assert.equal(state.status, 'COMPLETED');
    assert.equal(state.duplicateGroups, 1);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('indexed scan cancellation settles CANCELLED honestly', async () => {
  const { dir, db } = makeDb();
  const root = makeFixture();
  try {
    let calls = 0;
    await assert.rejects(
      runIndexedScan(db, 'scan-cancel-1', [root], { minSizeBytes: 1 }, {
        onPhase: () => {},
        shouldCancel: () => (++calls > 2),
      }),
      (err) => err instanceof ScanCancelled || err?.code === 'SCAN_CANCELLED'
    );
    const state = getScanState(db, 'scan-cancel-1');
    assert.equal(state.status, 'CANCELLED');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resume rebuilds a preview-compatible object from the index', async () => {
  const { dir, db } = makeDb();
  const root = makeFixture();
  try {
    await runIndexedScan(db, 'scan-resume-1', [root], { minSizeBytes: 1024 }, {});
    const latest = getLatestScan(db);
    assert.equal(latest.scanId, 'scan-resume-1');
    const preview = getScanPreview(db, 'scan-resume-1');
    assert.equal(preview.GroupCount, 1);
    assert.equal(preview.Groups[0].Files.length, 2);
    assert.ok(preview.Groups[0].KeepPath);
    assert.equal(preview.Engine, 'node-index');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale reconciliation marks deleted files unavailable', async () => {
  const { dir, db } = makeDb();
  const root = makeFixture();
  try {
    await runIndexedScan(db, 'scan-stale-1', [root], { minSizeBytes: 1024 }, {});
    fs.unlinkSync(path.join(root, 'a.txt'));
    const result = reconcileScan(db, 'scan-stale-1');
    // Only duplicate-evidence files are indexed (unique sizes are never hashed).
    assert.ok(result.checked >= 2);
    assert.equal(result.markedUnavailable, 1);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('restore returns files with collision-safe rename and verification', async () => {
  const { dir, db } = makeDb();
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-duprepo-'));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-dupwork-'));
  try {
    const content = 'restore-me-'.repeat(500);
    const original = path.join(work, 'doc.txt');
    fs.writeFileSync(original, content);
    fs.mkdirSync(path.join(work, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(work, 'sub', 'doc.txt'), content);
    const { quarantineDuplicatePaths } = await import('../server/duplicatesEngine.mjs');
    const moved = quarantineDuplicatePaths(repo, [path.join(work, 'sub', 'doc.txt')]);
    assert.equal(moved.movedCount, 1);
    const qid = moved.moved[0].quarantineId;
    // Recreate a colliding file at the original path.
    fs.writeFileSync(path.join(work, 'sub', 'doc.txt'), 'different-content');
    const result = restoreQuarantineEntries(db, repo, [qid]);
    assert.equal(result.restoredCount, 1);
    assert.equal(result.restored[0].collision, true);
    assert.equal(result.restored[0].verified, true);
    assert.equal(fs.readFileSync(result.restored[0].restoredPath, 'utf8'), content);
    const verify = verifyQuarantineEntries(repo, [qid]);
    assert.equal(verify.failedCount, 1, 'vault copy is gone after restore');
    const missing = restoreQuarantineEntries(db, repo, ['no-such-id']);
    assert.equal(missing.failed[0].error, 'NOT_FOUND');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test('history records and lists operations', () => {
  const { dir, db } = makeDb();
  try {
    recordHistory(db, { operationId: 'op-1', action: 'scan', status: 'running' });
    finishHistory(db, 'op-1', { status: 'success' });
    recordHistory(db, { operationId: 'op-2', action: 'quarantine', status: 'running' });
    finishHistory(db, 'op-2', { status: 'partial', error: 'one failed' });
    const history = listHistory(db, 10);
    assert.equal(history.length, 2);
    assert.equal(history[0].operationId, 'op-2');
    assert.equal(history[0].status, 'partial');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('job store tracks lifecycle and cancel requests', () => {
  const store = createJobStore();
  const job = store.create('job-1');
  assert.equal(job.status, 'PREPARING');
  store.setRunning(job, 'HASHING', { filesObserved: 10 });
  assert.equal(store.get('job-1').phase, 'HASHING');
  assert.equal(store.requestCancel('job-1'), true);
  assert.equal(store.get('job-1').cancelRequested, true);
  store.settle(job, 'COMPLETED', { ok: true }, null);
  assert.equal(store.get('job-1').status, 'COMPLETED');
  assert.equal(store.requestCancel('job-1'), false);
  assert.equal(store.get('missing'), null);
});

test('duplicate data path uses no PowerShell', () => {
  for (const file of ['server/duplicatesEngine.mjs', 'server/duplicatesJobs.mjs']) {
    const source = fs.readFileSync(path.join(webRoot, file), 'utf8');
    assert.doesNotMatch(source, /spawnSync|[^a-zA-Z]spawn\(|powershell|pwsh/i, `${file} must not shell out`);
    assert.doesNotMatch(source, /\.ps1/i, `${file} must not reference PS1 scripts`);
  }
});

test('station wires async jobs, resume, restore-all and verify-all', () => {
  const station = fs.readFileSync(path.join(webRoot, 'src', 'features', 'stations', 'station05', 'DuplicateStation.tsx'), 'utf8');
  for (const marker of [
    'duplicatesScanJob', 'duplicatesJob', 'duplicatesJobCancel', 'duplicatesLatestScan',
    'duplicatesRestore', 'duplicatesVerify', 'duplicatesHistory',
    'pollJob', 'cancelJob', 'resumeLastScan', 'restoreVaultEntries', 'verifyVaultEntries',
    'duplicate-job-progress', 'duplicate-op-history',
  ]) {
    assert.match(station, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `station must wire ${marker}`);
  }
});
