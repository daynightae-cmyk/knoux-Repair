/**
 * KNOUX Repair — Node-native duplicate-file engine (self-contained: only
 * Node builtins, no child processes, no external scripts).
 *
 * Professional rules base:
 *  - READ-ONLY scan: sizes first, SHA-256 streaming hash only for same-size
 *    candidates. Bounded by file count, hash-byte budget and time budget.
 *  - QUARANTINE, never delete: files are moved into Quarantine/DF11/<id>/
 *    with metadata compatible with the existing quarantine reader, and the
 *    keeper copy of every group is always preserved.
 *  - FORBIDDEN roots (Windows dir, Program Files, drive roots, …) are refused
 *    for both scanning and quarantine. No exceptions.
 *  - Every bound that is hit is reported honestly (truncated/partial flags).
 *    Nothing is ever invented.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TYPE_EXTENSIONS = {
  images: new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tif', 'tiff', 'heic']),
  video: new Set(['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'm4v', 'mpg', 'mpeg']),
  documents: new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'odt']),
  audio: new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus']),
  archives: new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab']),
  other: new Set(),
};

function extensionOf(fileName) {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function classifyType(fileName) {
  const ext = extensionOf(fileName);
  for (const [type, set] of Object.entries(TYPE_EXTENSIONS)) {
    if (type !== 'other' && set.has(ext)) return type;
  }
  return 'other';
}

function forbiddenRoots() {
  const prefixes = new Set();
  const exact = new Set();
  const pushPrefix = (value) => {
    if (!value) return;
    try {
      prefixes.add(path.resolve(value).toLowerCase());
    } catch { /* ignore unresolvable */ }
  };
  const pushExact = (value) => {
    if (!value) return;
    try {
      exact.add(path.resolve(value).toLowerCase());
    } catch { /* ignore unresolvable */ }
  };
  pushPrefix(process.env.SystemRoot || 'C:\\Windows');
  pushPrefix(process.env.ProgramFiles);
  pushPrefix(process.env['ProgramFiles(x86)']);
  pushPrefix(process.env.ProgramData);
  // Drive roots are refused exactly (scanning a whole drive is never allowed),
  // but they must NOT act as prefixes or every path would be forbidden.
  for (const drive of ['C:\\', 'D:\\']) pushExact(drive);
  return { prefixes, exact };
}

/** True when the path is inside (or equal to) a forbidden root. */
export function isForbiddenPath(candidate) {
  if (typeof candidate !== 'string' || !candidate) return true;
  let resolved;
  try {
    resolved = path.resolve(candidate);
  } catch {
    return true;
  }
  const lowered = resolved.toLowerCase();
  const { prefixes, exact } = forbiddenRoots();
  if (exact.has(lowered)) return true;
  for (const root of prefixes) {
    if (lowered === root || lowered.startsWith(root + path.sep)) return true;
  }
  return false;
}

export function validateScanRoot(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return { ok: false, error: 'EMPTY_PATH' };
  let resolved;
  try {
    resolved = path.resolve(candidate.trim());
  } catch {
    return { ok: false, error: 'INVALID_PATH' };
  }
  if (!path.isAbsolute(resolved)) return { ok: false, error: 'RELATIVE_PATH' };
  if (isForbiddenPath(resolved)) return { ok: false, error: 'FORBIDDEN_ROOT' };
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return { ok: false, error: 'NOT_FOUND' };
  }
  if (!stat.isDirectory()) return { ok: false, error: 'NOT_A_DIRECTORY' };
  return { ok: true, path: resolved };
}

function hashFileSync(filePath, maxBytes, budget) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    let remaining = Math.min(stat.size, maxBytes);
    let hashed = 0;
    const buffer = Buffer.alloc(1024 * 1024);
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

function pickKeeper(files, policy) {
  const sorted = [...files].sort((a, b) => {
    const timeA = a.mtimeMs ?? 0;
    const timeB = b.mtimeMs ?? 0;
    if (policy === 'Newest') {
      if (timeB !== timeA) return timeB - timeA;
    } else if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.path.localeCompare(b.path);
  });
  return sorted[0];
}

/**
 * Scan roots for exact duplicate files. Pure Node — no child processes.
 * Returns a DuplicatePreview-compatible object (Groups/Files shape matches
 * the DF11 contract so the existing UI renders either source).
 */
export function scanDuplicateRoots(options = {}) {
  const startedAt = Date.now();
  const {
    roots = [],
    minSizeBytes = 1024,
    types = ['all'],
    excludeSubfolders = [],
    keeperPolicy = 'OldestThenAlphabetical',
    maxFiles = 200000,
    maxHashBytes = 2 * 1024 * 1024 * 1024,
    timeBudgetMs = 100000,
    maxGroups = 2000,
  } = options;

  const safeTypes = (Array.isArray(types) ? types : [types])
    .map((t) => String(t).toLowerCase())
    .filter((t) => ['all', 'images', 'video', 'documents', 'audio', 'archives', 'other'].includes(t));
  const acceptAll = safeTypes.length === 0 || safeTypes.includes('all');
  const safePolicy = keeperPolicy === 'Newest' ? 'Newest' : 'OldestThenAlphabetical';
  const excluded = new Set(
    (Array.isArray(excludeSubfolders) ? excludeSubfolders : [excludeSubfolders])
      .map((v) => String(v).toLowerCase())
      .filter(Boolean)
  );
  const minSize = Math.max(1, Number(minSizeBytes) || 1024);

  const validatedRoots = [];
  const rejectedRoots = [];
  for (const root of roots) {
    const checked = validateScanRoot(root);
    if (checked.ok) validatedRoots.push(checked.path);
    else rejectedRoots.push({ path: String(root), error: checked.error });
  }
  if (validatedRoots.length === 0) {
    const err = new Error(rejectedRoots[0] ? `Scan root refused: ${rejectedRoots[0].error}` : 'No scan roots provided.');
    err.code = rejectedRoots[0]?.error || 'NO_ROOTS';
    err.status = 400;
    throw err;
  }

  const budget = { used: 0, limit: Math.max(1, Number(maxHashBytes) || 1) };
  const deadline = startedAt + Math.max(5000, Number(timeBudgetMs) || 100000);
  let scannedFiles = 0;
  let skippedFiles = 0;
  let budgetHit = false;
  let timeHit = false;
  const bySize = new Map();

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      skippedFiles += 1;
      return false;
    }
    for (const entry of entries) {
      if (Date.now() > deadline) { timeHit = true; return false; }
      if (scannedFiles + skippedFiles >= maxFiles) { budgetHit = true; return false; }
      const full = path.join(dir, entry.name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        skippedFiles += 1;
        continue;
      }
      if (stat.isSymbolicLink()) { skippedFiles += 1; continue; }
      if (stat.isDirectory()) {
        if (excluded.has(entry.name.toLowerCase())) { skippedFiles += 1; continue; }
        if (walk(full) === false) return false;
        continue;
      }
      if (!stat.isFile()) { skippedFiles += 1; continue; }
      if (stat.size < minSize) { skippedFiles += 1; continue; }
      const type = classifyType(entry.name);
      if (!acceptAll && !safeTypes.includes(type)) { skippedFiles += 1; continue; }
      scannedFiles += 1;
      let mtimeMs = 0;
      try { mtimeMs = stat.mtimeMs; } catch { /* keep 0 */ }
      const record = { path: full, name: entry.name, size: stat.size, mtimeMs, type };
      const list = bySize.get(stat.size) || [];
      list.push(record);
      bySize.set(stat.size, list);
    }
    return true;
  };

  for (const root of validatedRoots) {
    if (walk(root) === false) break;
  }

  const groups = [];
  let hashedBytes = 0;
  const byHash = new Map();
  for (const [size, candidates] of bySize) {
    if (candidates.length < 2) continue;
    if (Date.now() > deadline) { timeHit = true; break; }
    for (const file of candidates) {
      let record;
      try {
        const result = hashFileSync(file.path, file.size, budget);
        hashedBytes += result.hashed;
        if (result.capped || !result.digest) { budgetHit = true; continue; }
        record = { ...file, hash: result.digest };
      } catch {
        skippedFiles += 1;
        continue;
      }
      const list = byHash.get(record.hash) || [];
      list.push(record);
      byHash.set(record.hash, list);
    }
  }

  const ordered = [...byHash.entries()].sort((a, b) => {
    const recoverA = (a[1].length - 1) * (a[1][0]?.size || 0);
    const recoverB = (b[1].length - 1) * (b[1][0]?.size || 0);
    return recoverB - recoverA;
  });

  let truncated = budgetHit || timeHit;
  for (const [hash, files] of ordered) {
    if (files.length < 2) continue;
    if (groups.length >= maxGroups) { truncated = true; break; }
    const orderedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const keeper = pickKeeper(orderedFiles, safePolicy);
    const recoverable = (orderedFiles.length - 1) * (orderedFiles[0]?.size || 0);
    groups.push({
      Id: `eng-${hash.slice(0, 16)}`,
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

  const duplicateCopies = groups.reduce((acc, g) => acc + g.DuplicateCopies, 0);
  const recoverableBytes = groups.reduce((acc, g) => acc + g.RecoverableBytes, 0);
  return {
    PreviewId: `eng-${crypto.randomUUID()}`,
    PreviewExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    Folder: validatedRoots.join('; '),
    ScannedRoots: validatedRoots,
    FileTypes: acceptAll ? ['all'] : safeTypes,
    KeeperPolicy: safePolicy,
    MinSizeBytes: minSize,
    FilesObserved: scannedFiles,
    SkippedFiles: skippedFiles,
    HashedBytes: budget.used,
    RejectedRoots: rejectedRoots,
    DurationMs: Date.now() - startedAt,
    Groups: groups,
    GroupCount: groups.length,
    DuplicateCopies: duplicateCopies,
    RecoverableBytes: recoverableBytes,
    Truncated: truncated,
    PartialHash: budgetHit,
    Engine: 'node',
    Safety: { ChangesMade: false, HashByteBudget: `${budget.used} / ${budget.limit} bytes`, MaxGroupsShown: maxGroups },
  };
}

function quarantineRoot(repoRoot) {
  return path.join(repoRoot, 'Quarantine', 'DF11');
}

/**
 * Move duplicate copies into quarantine (keeper always preserved by the
 * caller passing only non-keeper paths). Returns per-file outcomes.
 */
export function quarantineDuplicatePaths(repoRoot, paths, extra = {}) {
  if (!repoRoot) {
    const err = new Error('Repository root is required.');
    err.code = 'NO_REPO_ROOT';
    err.status = 500;
    throw err;
  }
  const list = Array.isArray(paths) ? paths : [paths];
  const moved = [];
  const failed = [];
  for (const raw of list) {
    const candidate = String(raw || '');
    let resolved;
    try {
      resolved = path.resolve(candidate);
    } catch {
      failed.push({ path: candidate, error: 'INVALID_PATH' });
      continue;
    }
    if (!path.isAbsolute(resolved) || isForbiddenPath(resolved)) {
      failed.push({ path: candidate, error: 'FORBIDDEN_PATH' });
      continue;
    }
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch {
      failed.push({ path: candidate, error: 'NOT_FOUND' });
      continue;
    }
    if (!stat.isFile()) {
      failed.push({ path: candidate, error: 'NOT_A_FILE' });
      continue;
    }
    const id = crypto.randomUUID();
    const destDir = path.join(quarantineRoot(repoRoot), id);
    const destPath = path.join(destDir, path.basename(resolved));
    try {
      fs.mkdirSync(destDir, { recursive: true });
      try {
        fs.renameSync(resolved, destPath);
      } catch (moveErr) {
        // Cross-device move (EXDEV): copy the bytes, verify size, then unlink.
        // Never delete the original unless the copy is verified.
        if (moveErr?.code !== 'EXDEV') throw moveErr;
        fs.copyFileSync(resolved, destPath);
        const copied = fs.statSync(destPath);
        if (copied.size !== stat.size) {
          try { fs.unlinkSync(destPath); } catch { /* best effort */ }
          const sizeErr = new Error('COPY_VERIFY_FAILED');
          sizeErr.code = 'COPY_VERIFY_FAILED';
          throw sizeErr;
        }
        fs.unlinkSync(resolved);
      }
      const meta = {
        SchemaVersion: '2.0.2',
        QuarantineId: id,
        SessionId: extra.sessionId || null,
        ToolId: 'DF11',
        Engine: 'node',
        ItemType: 'File',
        OriginalPath: resolved,
        QuarantinePath: destPath,
        OriginalName: path.basename(resolved),
        OriginalSize: stat.size,
        OriginalHash: extra.hashes?.[resolved] || null,
        QuarantinedAt: new Date().toISOString(),
        TransactionState: 'COMPLETE',
        MetadataHash: null,
      };
      fs.writeFileSync(path.join(destDir, 'quarantine-meta.json'), JSON.stringify(meta, null, 2), 'utf8');
      moved.push({ path: resolved, quarantineId: id, quarantinePath: destPath, size: stat.size });
    } catch (err) {
      failed.push({ path: candidate, error: err?.code || 'MOVE_FAILED' });
    }
  }
  return { moved, failed, movedCount: moved.length, failedCount: failed.length };
}
