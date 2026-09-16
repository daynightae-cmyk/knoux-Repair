/**
 * KNOUX Repair — Indexed duplicate engine: staged async scan jobs over a
 * focused SQLite index (node:sqlite, zero new dependencies).
 *
 * Pipeline: PREPARING → SCANNING → FINGERPRINTING → HASHING → GROUPING
 *           → READY → COMPLETED | FAILED | CANCELLED | INCONCLUSIVE
 *
 * Rules carried over from duplicatesEngine.mjs (same forbidden roots,
 * quarantine-first discipline, keeper preservation):
 *  - bounded sample fingerprint (size + head + tail) reduces candidates;
 *  - full SHA-256 confirms duplicates — never name/size alone;
 *  - every bound hit is reported (truncated/partial), never invented;
 *  - cancellation is cooperative and honest: CANCELLED only when the
 *    worker actually stops; partial results stay queryable.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  classifyType,
  isForbiddenPath,
  validateScanRoot,
} from './duplicatesEngine.mjs';

export const SCHEMA_VERSION = 1;

const FINGERPRINT_HEAD = 4096;
const FINGERPRINT_TAIL = 4096;

export function openIndex(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scans (
      scanId TEXT PRIMARY KEY,
      rootsJson TEXT NOT NULL,
      status TEXT NOT NULL,
      phase TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      filesObserved INTEGER NOT NULL DEFAULT 0,
      bytesObserved INTEGER NOT NULL DEFAULT 0,
      candidateFiles INTEGER NOT NULL DEFAULT 0,
      duplicateGroups INTEGER NOT NULL DEFAULT 0,
      duplicateBytes INTEGER NOT NULL DEFAULT 0,
      truncated INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scanId TEXT NOT NULL,
      fullPath TEXT NOT NULL,
      fileName TEXT NOT NULL,
      extension TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      modifiedAt TEXT,
      volume TEXT,
      quickFingerprint TEXT,
      strongHash TEXT,
      protected INTEGER NOT NULL DEFAULT 0,
      unavailable INTEGER NOT NULL DEFAULT 0,
      lastSeenAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      groupId TEXT NOT NULL,
      scanId TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      copyCount INTEGER NOT NULL,
      reclaimableBytes INTEGER NOT NULL,
      verificationState TEXT NOT NULL,
      PRIMARY KEY (groupId, scanId)
    );
    CREATE TABLE IF NOT EXISTS members (
      groupId TEXT NOT NULL,
      scanId TEXT NOT NULL,
      fileId INTEGER NOT NULL,
      fullPath TEXT NOT NULL,
      keepRecommended INTEGER NOT NULL DEFAULT 0,
      keepReason TEXT
    );
    CREATE TABLE IF NOT EXISTS decisions (
      decisionId TEXT PRIMARY KEY,
      scanId TEXT NOT NULL,
      groupId TEXT NOT NULL,
      keepPath TEXT NOT NULL,
      selectedAction TEXT NOT NULL,
      selectedPathsJson TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quarantine_log (
      quarantineId TEXT PRIMARY KEY,
      scanId TEXT,
      groupId TEXT,
      originalPath TEXT NOT NULL,
      vaultPath TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      movedAt TEXT NOT NULL,
      restoreState TEXT NOT NULL DEFAULT 'quarantined',
      verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS run_history (
      operationId TEXT PRIMARY KEY,
      scanId TEXT,
      groupId TEXT,
      action TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      status TEXT NOT NULL,
      bytesMoved INTEGER NOT NULL DEFAULT 0,
      bytesDeleted INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_files_scan ON files (scanId);
    CREATE INDEX IF NOT EXISTS idx_files_size ON files (sizeBytes);
    CREATE INDEX IF NOT EXISTS idx_files_fp ON files (quickFingerprint);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files (strongHash);
    CREATE INDEX IF NOT EXISTS idx_files_path ON files (fullPath);
    CREATE INDEX IF NOT EXISTS idx_groups_scan ON groups (scanId);
    CREATE INDEX IF NOT EXISTS idx_members_group ON members (groupId, scanId);
    CREATE INDEX IF NOT EXISTS idx_history_started ON run_history (startedAt DESC);
  `);
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
  if (!row) db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  return db;
}

function extensionOf(fileName) {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function volumeOf(resolved) {
  const match = /^[A-Za-z]:/.exec(resolved);
  return match ? match[0].toUpperCase() : '';
}

/** Deterministic bounded sample: sha256(size + head + tail). */
export function quickFingerprintSync(filePath, sizeBytes) {
  const hash = crypto.createHash('sha256');
  hash.update(`size:${sizeBytes};`);
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(Math.min(FINGERPRINT_HEAD, sizeBytes));
    const readHead = fs.readSync(fd, head, 0, head.length, 0);
    hash.update(head.subarray(0, readHead));
    if (sizeBytes > FINGERPRINT_HEAD) {
      const tailLen = Math.min(FINGERPRINT_TAIL, sizeBytes - FINGERPRINT_HEAD);
      const tail = Buffer.alloc(tailLen);
      const readTail = fs.readSync(fd, tail, 0, tailLen, sizeBytes - tailLen);
      hash.update(tail.subarray(0, readTail));
    }
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function hashFileBounded(filePath, sizeBytes, budget) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  let hashed = 0;
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let remaining = sizeBytes;
    while (remaining > 0) {
      if (budget.used >= budget.limit) return { digest: null, hashed, capped: true };
      const want = Math.min(buffer.length, remaining, budget.limit - budget.used);
      if (want <= 0) return { digest: null, hashed, capped: true };
      const read = fs.readSync(fd, buffer, 0, want, null);
      if (read <= 0) break;
      hash.update(buffer.subarray(0, read));
      remaining -= read;
      hashed += read;
      budget.used += read;
    }
    return { digest: hash.digest('hex'), hashed, capped: false };
  } finally {
    fs.closeSync(fd);
  }
}

const yieldTick = () => new Promise((resolve) => setImmediate(resolve));

export class ScanCancelled extends Error {
  constructor() {
    super('Scan cancelled by user.');
    this.code = 'SCAN_CANCELLED';
  }
}

function pickKeeper(files, policy) {
  const sorted = [...files].sort((a, b) => {
    if (policy === 'Newest') {
      if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    } else if (a.mtimeMs !== b.mtimeMs) {
      return a.mtimeMs - b.mtimeMs;
    }
    return a.path.localeCompare(b.path);
  });
  return sorted[0];
}

/**
 * Staged async scan. hooks: { onPhase(phase, progress), shouldCancel() }.
 * Returns the persisted scan row summary. Throws ScanCancelled on cancel.
 */
export async function runIndexedScan(db, scanId, roots, options = {}, hooks = {}) {
  const startedAt = new Date().toISOString();
  const {
    minSizeBytes = 1024,
    types = ['all'],
    excludeSubfolders = [],
    keeperPolicy = 'OldestThenAlphabetical',
    maxFiles = 200000,
    maxHashBytes = 2 * 1024 * 1024 * 1024,
    maxGroups = 2000,
    includeHidden = false,
  } = options;
  const onPhase = hooks.onPhase || (() => {});
  const shouldCancel = hooks.shouldCancel || (() => false);
  const checkCancel = () => { if (shouldCancel()) throw new ScanCancelled(); };

  const safeTypes = (Array.isArray(types) ? types : [types])
    .map((t) => String(t).toLowerCase())
    .filter((t) => ['all', 'images', 'video', 'documents', 'audio', 'archives', 'other'].includes(t));
  const acceptAll = safeTypes.length === 0 || safeTypes.includes('all');
  const safePolicy = keeperPolicy === 'Newest' ? 'Newest' : 'OldestThenAlphabetical';
  const excluded = new Set(
    (Array.isArray(excludeSubfolders) ? excludeSubfolders : [excludeSubfolders])
      .map((v) => String(v).toLowerCase()).filter(Boolean)
  );
  const minSize = Math.max(1, Number(minSizeBytes) || 1024);

  const validatedRoots = [];
  const rejectedRoots = [];
  onPhase('PREPARING', { filesObserved: 0 });
  for (const root of roots) {
    const checked = validateScanRoot(root);
    if (checked.ok) validatedRoots.push(checked.path);
    else rejectedRoots.push({ path: String(root), error: checked.error });
    checkCancel();
  }
  if (validatedRoots.length === 0) {
    const err = new Error(rejectedRoots[0] ? `Scan root refused: ${rejectedRoots[0].error}` : 'No scan roots provided.');
    err.code = rejectedRoots[0]?.error || 'NO_ROOTS';
    err.status = 400;
    throw err;
  }

  // Supersede prior scans over the same roots (stale-index reconciliation).
  const rootsKey = JSON.stringify([...validatedRoots].sort());
  db.prepare("UPDATE scans SET status = 'superseded' WHERE status IN ('COMPLETED','INCONCLUSIVE') AND rootsJson = ?").run(rootsKey);
  db.prepare(
    `INSERT INTO scans (scanId, rootsJson, status, phase, startedAt, filesObserved, bytesObserved)
     VALUES (?, ?, 'running', 'PREPARING', ?, 0, 0)`
  ).run(scanId, rootsKey, startedAt);
  const updateScan = (fields) => {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE scans SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE scanId = ?`)
      .run(...keys.map((k) => fields[k]), scanId);
  };

  const insertFile = db.prepare(
    `INSERT INTO files (scanId, fullPath, fileName, extension, sizeBytes, modifiedAt, volume,
      quickFingerprint, strongHash, protected, unavailable, lastSeenAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
  );

  const progress = { filesObserved: 0, bytesObserved: 0, candidateFiles: 0, duplicateGroups: 0 };
  let skipped = 0;
  let budgetHit = false;
  let timeHit = false;
  const deadline = Date.now() + 1000 * 60 * 20;
  const bySize = new Map();
  const seenAt = new Date().toISOString();

  onPhase('SCANNING', progress);
  const walk = async (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped += 1;
      return true;
    }
    for (const entry of entries) {
      checkCancel();
      if (Date.now() > deadline) { timeHit = true; return false; }
      if (progress.filesObserved + skipped >= maxFiles) { budgetHit = true; return false; }
      if (!includeHidden && entry.name.startsWith('.')) { skipped += 1; continue; }
      const full = path.join(dir, entry.name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        skipped += 1;
        continue;
      }
      if (stat.isSymbolicLink()) { skipped += 1; continue; }
      if (stat.isDirectory()) {
        if (excluded.has(entry.name.toLowerCase())) { skipped += 1; continue; }
        if ((await walk(full)) === false) return false;
        continue;
      }
      if (!stat.isFile()) { skipped += 1; continue; }
      if (stat.size < minSize) { skipped += 1; continue; }
      const type = classifyType(entry.name);
      if (!acceptAll && !safeTypes.includes(type)) { skipped += 1; continue; }
      progress.filesObserved += 1;
      progress.bytesObserved += stat.size;
      const record = { path: full, name: entry.name, size: stat.size, mtimeMs: stat.mtimeMs || 0 };
      const list = bySize.get(stat.size) || [];
      list.push(record);
      bySize.set(stat.size, list);
      if (progress.filesObserved % 400 === 0) {
        onPhase('SCANNING', { ...progress });
        updateScan({ phase: 'SCANNING', filesObserved: progress.filesObserved, bytesObserved: progress.bytesObserved });
        await yieldTick();
      }
    }
    return true;
  };

  try {
    for (const root of validatedRoots) {
      if ((await walk(root)) === false) break;
    }

    // FINGERPRINTING: bounded samples reduce hash candidates deterministically.
    onPhase('FINGERPRINTING', { ...progress, candidateFiles: 0 });
    const budget = { used: 0, limit: Math.max(1, Number(maxHashBytes) || 1) };
    const fingerprinted = [];
    let processed = 0;
    for (const [, candidates] of bySize) {
      if (candidates.length < 2) continue;
      for (const file of candidates) {
        checkCancel();
        let fp;
        try {
          fp = quickFingerprintSync(file.path, file.size);
        } catch {
          skipped += 1;
          continue;
        }
        fingerprinted.push({ ...file, fp });
        processed += 1;
        if (processed % 400 === 0) {
          onPhase('FINGERPRINTING', { ...progress, candidateFiles: processed });
          await yieldTick();
        }
      }
    }
    progress.candidateFiles = fingerprinted.length;

    // HASHING: full SHA-256 only for fingerprint collisions.
    onPhase('HASHING', { ...progress });
    const fpGroups = new Map();
    for (const file of fingerprinted) {
      const list = fpGroups.get(file.fp) || [];
      list.push(file);
      fpGroups.set(file.fp, list);
    }
    const byHash = new Map();
    let hashed = 0;
    for (const [, candidates] of fpGroups) {
      if (candidates.length < 2) continue;
      for (const file of candidates) {
        checkCancel();
        let result;
        try {
          result = hashFileBounded(file.path, file.size, budget);
        } catch {
          skipped += 1;
          continue;
        }
        if (result.capped || !result.digest) { budgetHit = true; continue; }
        const list = byHash.get(result.digest) || [];
        list.push({ ...file, hash: result.digest });
        byHash.set(result.digest, list);
        hashed += 1;
        if (hashed % 200 === 0) {
          onPhase('HASHING', { ...progress, candidateFiles: hashed });
          await yieldTick();
        }
      }
    }

    // GROUPING + persist.
    onPhase('GROUPING', { ...progress });
    const ordered = [...byHash.entries()]
      .filter(([, files]) => files.length > 1)
      .sort((a, b) => ((b[1].length - 1) * b[1][0].size) - ((a[1].length - 1) * a[1][0].size));

    const insertGroup = db.prepare(
      'INSERT INTO groups (groupId, scanId, fingerprint, fileSize, copyCount, reclaimableBytes, verificationState) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertMember = db.prepare(
      'INSERT INTO members (groupId, scanId, fileId, fullPath, keepRecommended, keepReason) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const persistTx = (entries) => {
      db.exec('BEGIN');
      try {
        for (const entry of entries) insertFile.run(...entry);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* best effort */ }
        throw err;
      }
    };

    const groups = [];
    let truncated = budgetHit || timeHit;
    for (const [hash, files] of ordered) {
      checkCancel();
      if (groups.length >= maxGroups) { truncated = true; break; }
      const orderedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
      const keeper = pickKeeper(orderedFiles, safePolicy);
      const groupId = `eng-${hash.slice(0, 16)}`;
      const recoverable = (orderedFiles.length - 1) * orderedFiles[0].size;
      const fileRows = orderedFiles.map((f) => ([
        scanId, f.path, f.name, extensionOf(f.name), f.size,
        new Date(f.mtimeMs).toISOString(), volumeOf(f.path),
        f.fp, hash, seenAt,
      ]));
      persistTx(fileRows);
      const ids = db.prepare('SELECT id, fullPath FROM files WHERE scanId = ? AND strongHash = ?').all(scanId, hash);
      const idByPath = new Map(ids.map((r) => [r.fullPath, r.id]));
      insertGroup.run(groupId, scanId, orderedFiles[0].fp, orderedFiles[0].size, orderedFiles.length, recoverable, 'sha256-verified');
      for (const f of orderedFiles) {
        const isKeeper = f.path === keeper.path;
        insertMember.run(groupId, scanId, idByPath.get(f.path) ?? -1, f.path, isKeeper ? 1 : 0,
          isKeeper ? (safePolicy === 'Newest' ? 'newest-then-alphabetical' : 'oldest-then-alphabetical') : null);
      }
      groups.push({
        Id: groupId,
        Hash: hash,
        Copies: orderedFiles.length,
        DuplicateCopies: orderedFiles.length - 1,
        RecoverableBytes: recoverable,
        KeepPath: keeper.path,
        HardLinkInvolved: false,
        Files: orderedFiles.map((f) => ({
          Path: f.path,
          Name: f.name,
          Extension: extensionOf(f.name).toUpperCase() || 'FILE',
          SizeBytes: f.size,
          LastWriteUtc: new Date(f.mtimeMs).toISOString(),
        })),
      });
    }

    const duplicateBytes = groups.reduce((acc, g) => acc + g.RecoverableBytes, 0);
    onPhase('READY', { ...progress, duplicateGroups: groups.length });
    updateScan({
      phase: 'READY',
      filesObserved: progress.filesObserved,
      bytesObserved: progress.bytesObserved,
      candidateFiles: progress.candidateFiles,
      duplicateGroups: groups.length,
      duplicateBytes,
      truncated: truncated ? 1 : 0,
    });

    const status = progress.filesObserved === 0 ? 'INCONCLUSIVE' : 'COMPLETED';
    updateScan({ status, phase: status, completedAt: new Date().toISOString(), error: status === 'INCONCLUSIVE' ? 'NO_FILES_OBSERVED' : null });
    return {
      scanId,
      status,
      groups,
      summary: {
        filesObserved: progress.filesObserved,
        bytesObserved: progress.bytesObserved,
        candidateFiles: progress.candidateFiles,
        duplicateGroups: groups.length,
        duplicateBytes,
        skipped,
        truncated,
        rejectedRoots,
      },
    };
  } catch (err) {
    if (err instanceof ScanCancelled || err?.code === 'SCAN_CANCELLED') {
      updateScan({ status: 'CANCELLED', phase: 'CANCELLED', completedAt: new Date().toISOString() });
      throw err;
    }
    updateScan({ status: 'FAILED', phase: 'FAILED', completedAt: new Date().toISOString(), error: err?.message || String(err) });
    throw err;
  }
}

/** Mark indexed files missing from disk as unavailable (stale reconciliation). */
export function reconcileScan(db, scanId) {
  const rows = db.prepare('SELECT id, fullPath FROM files WHERE scanId = ? AND unavailable = 0').all(scanId);
  let marked = 0;
  const mark = db.prepare('UPDATE files SET unavailable = 1 WHERE id = ?');
  const staleIds = rows
    .filter((r) => { try { return !fs.statSync(r.fullPath).isFile(); } catch { return true; } })
    .map((r) => r.id);
  db.exec('BEGIN');
  try {
    for (const id of staleIds) { mark.run(id); marked += 1; }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* best effort */ }
    throw err;
  }
  return { checked: rows.length, markedUnavailable: marked };
}

export function getScanState(db, scanId) {
  const scan = db.prepare('SELECT * FROM scans WHERE scanId = ?').get(scanId);
  if (!scan) return null;
  return scan;
}

export function getScanGroups(db, scanId) {
  const groups = db.prepare('SELECT * FROM groups WHERE scanId = ?').all(scanId);
  const members = db.prepare('SELECT * FROM members WHERE scanId = ?').all(scanId);
  const byGroup = new Map();
  for (const m of members) {
    const list = byGroup.get(m.groupId) || [];
    list.push(m);
    byGroup.set(m.groupId, list);
  }
  return groups.map((g) => ({ ...g, members: byGroup.get(g.groupId) || [] }));
}

export function getLatestScan(db) {
  return db.prepare("SELECT * FROM scans WHERE status IN ('COMPLETED','INCONCLUSIVE') ORDER BY startedAt DESC LIMIT 1").get() || null;
}

/** Rebuild a DuplicatePreview-compatible object from the index (resume path). */
export function getScanPreview(db, scanId) {
  const scan = db.prepare('SELECT * FROM scans WHERE scanId = ?').get(scanId);
  if (!scan) return null;
  const rows = db.prepare(
    `SELECT g.groupId, g.fingerprint, g.fileSize, g.copyCount, g.reclaimableBytes, g.verificationState,
            m.fullPath, m.keepRecommended,
            f.fileName, f.extension, f.sizeBytes, f.modifiedAt
     FROM groups g
     JOIN members m ON m.groupId = g.groupId AND m.scanId = g.scanId
     LEFT JOIN files f ON f.id = m.fileId
     WHERE g.scanId = ?
     ORDER BY g.reclaimableBytes DESC, g.groupId, m.fullPath`
  ).all(scanId);
  const groupMap = new Map();
  for (const row of rows) {
    if (!groupMap.has(row.groupId)) {
      groupMap.set(row.groupId, {
        Id: row.groupId,
        Hash: row.fingerprint,
        Copies: row.copyCount,
        DuplicateCopies: Math.max(0, row.copyCount - 1),
        RecoverableBytes: row.reclaimableBytes,
        KeepPath: null,
        HardLinkInvolved: false,
        Files: [],
      });
    }
    const group = groupMap.get(row.groupId);
    group.Files.push({
      Path: row.fullPath,
      Name: row.fileName || row.fullPath.split(/[\\/]/).pop(),
      Extension: (row.extension || '').toUpperCase() || 'FILE',
      SizeBytes: row.sizeBytes ?? row.fileSize,
      LastWriteUtc: row.modifiedAt || null,
    });
    if (row.keepRecommended === 1) group.KeepPath = row.fullPath;
  }
  const groups = [...groupMap.values()];
  for (const group of groups) {
    if (!group.KeepPath && group.Files.length) group.KeepPath = group.Files[0].Path;
  }
  let roots = [];
  try { roots = JSON.parse(scan.rootsJson || '[]'); } catch { /* keep empty */ }
  return {
    PreviewId: `idx-${scan.scanId}`,
    PreviewExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    Folder: roots.join('; '),
    FileTypes: ['all'],
    KeeperPolicy: 'OldestThenAlphabetical',
    FilesObserved: scan.filesObserved,
    SkippedFiles: null,
    Groups: groups,
    GroupCount: groups.length,
    DuplicateCopies: groups.reduce((acc, g) => acc + g.DuplicateCopies, 0),
    RecoverableBytes: groups.reduce((acc, g) => acc + g.RecoverableBytes, 0),
    Truncated: scan.truncated === 1,
    Engine: 'node-index',
    ResumedFrom: scan.scanId,
    Safety: { ChangesMade: false, HashByteBudget: '', MaxGroupsShown: groups.length },
  };
}

export function recordDecision(db, { decisionId, scanId, groupId, keepPath, selectedAction, selectedPaths }) {
  db.prepare(
    'INSERT INTO decisions (decisionId, scanId, groupId, keepPath, selectedAction, selectedPathsJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(decisionId, scanId, groupId, keepPath, selectedAction, JSON.stringify(selectedPaths), new Date().toISOString());
}

export function recordHistory(db, { operationId, scanId = null, groupId = null, action, status = 'running', bytesMoved = 0, bytesDeleted = 0, verified = 0, error = null }) {
  db.prepare(
    'INSERT INTO run_history (operationId, scanId, groupId, action, startedAt, status, bytesMoved, bytesDeleted, verified, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(operationId, scanId, groupId, action, new Date().toISOString(), status, bytesMoved, bytesDeleted, verified, error);
}

export function finishHistory(db, operationId, { status, bytesMoved = 0, bytesDeleted = 0, verified = 0, error = null }) {
  db.prepare(
    'UPDATE run_history SET finishedAt = ?, status = ?, bytesMoved = ?, bytesDeleted = ?, verified = ?, error = ? WHERE operationId = ?'
  ).run(new Date().toISOString(), status, bytesMoved, bytesDeleted, verified, error, operationId);
}

export function listHistory(db, limit = 30) {
  return db.prepare('SELECT * FROM run_history ORDER BY startedAt DESC LIMIT ?').all(Math.max(1, Math.min(200, Number(limit) || 30)));
}

export function findQuarantineMeta(repoRoot, quarantineId) {
  const root = path.join(repoRoot, 'Quarantine');
  if (!fs.existsSync(root)) return null;
  for (const toolDir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!toolDir.isDirectory() || !/^DF/i.test(toolDir.name)) continue;
    const metaPath = path.join(root, toolDir.name, quarantineId, 'quarantine-meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.QuarantineId === quarantineId) return { meta, metaPath, dir: path.dirname(metaPath) };
    } catch { /* ignore malformed */ }
  }
  return null;
}

/** Restore vault entries to original paths (collision-safe, verified). */
export function restoreQuarantineEntries(db, repoRoot, quarantineIds) {
  const restored = [];
  const failed = [];
  for (const id of quarantineIds) {
    const found = findQuarantineMeta(repoRoot, String(id));
    if (!found) {
      failed.push({ quarantineId: id, error: 'NOT_FOUND' });
      continue;
    }
    const { meta, metaPath, dir } = found;
    const vaultFile = meta.QuarantinePath && fs.existsSync(meta.QuarantinePath)
      ? meta.QuarantinePath
      : path.join(dir, meta.OriginalName || path.basename(meta.OriginalPath || ''));
    let vaultStat;
    try {
      vaultStat = fs.statSync(vaultFile);
      if (!vaultStat.isFile()) throw new Error('not-a-file');
    } catch {
      failed.push({ quarantineId: id, error: 'VAULT_MISSING' });
      continue;
    }
    let target = meta.OriginalPath;
    if (fs.existsSync(target)) {
      const parsed = path.parse(target);
      let counter = 1;
      let candidate = path.join(parsed.dir, `${parsed.name}-restored-${counter}${parsed.ext}`);
      while (fs.existsSync(candidate) && counter < 1000) {
        counter += 1;
        candidate = path.join(parsed.dir, `${parsed.name}-restored-${counter}${parsed.ext}`);
      }
      if (fs.existsSync(candidate)) {
        failed.push({ quarantineId: id, error: 'COLLISION_UNRESOLVABLE' });
        continue;
      }
      target = candidate;
    }
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try {
        fs.renameSync(vaultFile, target);
      } catch (moveErr) {
        if (moveErr?.code !== 'EXDEV') throw moveErr;
        fs.copyFileSync(vaultFile, target);
        const copied = fs.statSync(target);
        if (copied.size !== vaultStat.size) {
          try { fs.unlinkSync(target); } catch { /* best effort */ }
          throw Object.assign(new Error('COPY_VERIFY_FAILED'), { code: 'COPY_VERIFY_FAILED' });
        }
        fs.unlinkSync(vaultFile);
      }
      const back = fs.statSync(target);
      const verified = back.size === Number(meta.OriginalSize) && back.size === vaultStat.size;
      const updated = { ...meta, restoreState: 'restored', restoredPath: target, restoredAt: new Date().toISOString(), restoreVerified: verified };
      try { fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf8'); } catch { /* meta best effort */ }
      try {
        db.prepare('INSERT INTO quarantine_log (quarantineId, originalPath, vaultPath, sizeBytes, movedAt, restoreState, verified) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(quarantineId) DO UPDATE SET restoreState = excluded.restoreState, verified = excluded.verified')
          .run(id, meta.OriginalPath, meta.QuarantinePath || '', Number(meta.OriginalSize || 0), meta.QuarantinedAt || new Date().toISOString(), 'restored', verified ? 1 : 0);
      } catch { /* log best effort */ }
      restored.push({ quarantineId: id, restoredPath: target, verified, collision: target !== meta.OriginalPath });
    } catch (err) {
      failed.push({ quarantineId: id, error: err?.code || 'RESTORE_FAILED' });
    }
  }
  return { restored, failed, restoredCount: restored.length, failedCount: failed.length };
}

/** Re-verify vault entries against their metadata (existence + size). */
export function verifyQuarantineEntries(repoRoot, quarantineIds) {
  const verified = [];
  const failed = [];
  for (const id of quarantineIds) {
    const found = findQuarantineMeta(repoRoot, String(id));
    if (!found) {
      failed.push({ quarantineId: id, error: 'NOT_FOUND' });
      continue;
    }
    const { meta, dir } = found;
    const vaultFile = meta.QuarantinePath && fs.existsSync(meta.QuarantinePath)
      ? meta.QuarantinePath
      : path.join(dir, meta.OriginalName || path.basename(meta.OriginalPath || ''));
    try {
      const stat = fs.statSync(vaultFile);
      if (stat.isFile() && stat.size === Number(meta.OriginalSize)) verified.push({ quarantineId: id, size: stat.size });
      else failed.push({ quarantineId: id, error: 'SIZE_MISMATCH' });
    } catch {
      failed.push({ quarantineId: id, error: 'VAULT_MISSING' });
    }
  }
  return { verified, failed, verifiedCount: verified.length, failedCount: failed.length };
}

/** In-memory async job registry (one per bridge process). */
export function createJobStore() {
  const jobs = new Map();
  return {
    create(scanId, task) {
      const job = {
        scanId,
        status: 'PREPARING',
        phase: 'PREPARING',
        progress: { filesObserved: 0 },
        result: null,
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        cancelRequested: false,
        task,
      };
      jobs.set(scanId, job);
      return job;
    },
    get(scanId) {
      return jobs.get(scanId) || null;
    },
    requestCancel(scanId) {
      const job = jobs.get(scanId);
      if (!job) return false;
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'INCONCLUSIVE'].includes(job.status)) return false;
      job.cancelRequested = true;
      if (job.status === 'PREPARING') {
        job.status = 'CANCELLING';
        job.phase = 'CANCELLING';
      }
      return true;
    },
    setRunning(job, phase, progress) {
      job.status = phase === 'CANCELLING' ? 'CANCELLING' : 'running';
      job.phase = phase;
      job.progress = progress;
    },
    settle(job, status, result, error) {
      job.status = status;
      job.phase = status;
      job.result = result || null;
      job.error = error || null;
      job.finishedAt = new Date().toISOString();
    },
  };
}
