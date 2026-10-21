/**
 * Workbench inspection helpers — read-only, local-only, no premium gate.
 *
 * Ported from the preserved donor capability kept in the closure archive
 * (`preserved-cockpit/files/web-frontend/server/workbenchEndpoints.mjs`).
 * The donor's premium verifier, session store and unlock flow are deliberately NOT part of this module:
 * `web-frontend/tests/workbenchReconciliation.test.mjs` forbids that material in the product tree.
 *
 * Guarantees of this module:
 *  - No authentication, licensing, unlock or session logic of any kind.
 *  - No network access, no writes, no unpacking, no execution.
 *  - Inspection only: ZIP metadata is read, never unpacked.
 *  - Every read is bounded (byte budgets) so a hostile or huge input cannot exhaust the bridge.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_ZIP_CENTRAL_DIR_SIZE = 32 * 1024 * 1024; // 32 MB central directory
const MAX_ZIP_ENTRIES = 10_000;
const MAX_ZIP_FILENAME_LEN = 1024;
const MAX_ZIP_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_ZIP_REPORTED_ENTRIES = 500;
const MAX_HASH_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB hashing budget
const MAX_REDACT_INPUT_CHARS = 4 * 1024 * 1024; // 4 MB text budget

/**
 * Inspect a ZIP archive without extracting it.
 * Returns entry metadata plus a path-traversal verdict so callers can refuse unsafe archives.
 */
export function inspectZipArchive(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'INVALID_PATH', message: 'A file path is required.' };
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'FILE_NOT_FOUND', message: 'File not found.' };
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return { ok: false, error: 'FILE_NOT_READABLE', message: 'File could not be inspected.' };
  }
  if (!stats.isFile()) {
    return { ok: false, error: 'NOT_A_FILE', message: 'Only regular files can be inspected.' };
  }
  if (stats.size > MAX_ZIP_ARCHIVE_BYTES) {
    return { ok: false, error: 'ARCHIVE_TOO_LARGE', message: 'Archive exceeds the 2GB inspection limit.' };
  }

  let buffer;
  let eocdOffset = -1;
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      buffer = Buffer.alloc(Math.min(stats.size, 65536));
      fs.readSync(fd, buffer, 0, buffer.length, Math.max(0, stats.size - buffer.length));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { ok: false, error: 'FILE_NOT_READABLE', message: 'File could not be inspected.' };
  }

  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    return { ok: false, error: 'INVALID_ARCHIVE', message: 'Could not find the zip end-of-central-directory record.' };
  }

  const entriesCount = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (cdSize > MAX_ZIP_CENTRAL_DIR_SIZE) {
    return { ok: false, error: 'ARCHIVE_TOO_LARGE', message: `Central directory size (${cdSize} bytes) exceeds the safety limit.` };
  }
  if (cdOffset < 0 || cdSize < 0 || (cdOffset + cdSize) > stats.size) {
    return { ok: false, error: 'ARCHIVE_INVALID_BOUNDS', message: 'Central directory offsets exceed the archive size.' };
  }
  if (entriesCount > MAX_ZIP_ENTRIES) {
    return { ok: false, error: 'ARCHIVE_TOO_LARGE', message: `Entry count (${entriesCount}) exceeds the maximum of ${MAX_ZIP_ENTRIES}.` };
  }

  let cdBuffer;
  try {
    cdBuffer = Buffer.alloc(cdSize);
    const cdFd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(cdFd, cdBuffer, 0, cdSize, cdOffset);
    } finally {
      fs.closeSync(cdFd);
    }
  } catch {
    return { ok: false, error: 'FILE_NOT_READABLE', message: 'Central directory could not be read.' };
  }

  const files = [];
  let pos = 0;
  let hasPathTraversal = false;

  for (let i = 0; i < entriesCount && pos < cdSize; i++) {
    if (pos + 46 > cdSize || cdBuffer.readUInt32LE(pos) !== 0x02014b50) break;
    const compMethod = cdBuffer.readUInt16LE(pos + 10);
    const uncompressedSize = cdBuffer.readUInt32LE(pos + 24);
    const fileNameLen = cdBuffer.readUInt16LE(pos + 28);
    const extraLen = cdBuffer.readUInt16LE(pos + 30);
    const commentLen = cdBuffer.readUInt16LE(pos + 32);

    if (fileNameLen > MAX_ZIP_FILENAME_LEN) {
      return { ok: false, error: 'ARCHIVE_INVALID_BOUNDS', message: 'Archive entry filename exceeds the maximum length.' };
    }
    if (pos + 46 + fileNameLen > cdSize) break;

    const fileName = cdBuffer.toString('utf8', pos + 46, pos + 46 + fileNameLen);
    const isTraversal = fileName.includes('..') || path.isAbsolute(fileName)
      || fileName.startsWith('/') || fileName.startsWith('\\');
    if (isTraversal) hasPathTraversal = true;

    files.push({
      name: fileName,
      size: uncompressedSize,
      compressed: compMethod !== 0,
      pathTraversalRisk: isTraversal,
    });

    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  return {
    ok: true,
    capability: 'INSPECTION_ONLY',
    totalFiles: files.length,
    uncompressedBytesTotal: files.reduce((acc, file) => acc + file.size, 0),
    hasPathTraversal,
    files: files.slice(0, MAX_ZIP_REPORTED_ENTRIES),
    truncated: files.length > MAX_ZIP_REPORTED_ENTRIES,
  };
}

/**
 * SHA-256 of a file, streamed so the whole file is never buffered.
 * The digest is bounded by MAX_HASH_BYTES; oversized inputs report `capped`.
 */
export function computeFileSha256Streaming(targetPath) {
  return new Promise((resolve, reject) => {
    if (!targetPath || typeof targetPath !== 'string') {
      reject(Object.assign(new Error('A file path is required.'), { code: 'INVALID_PATH' }));
      return;
    }
    const hash = crypto.createHash('sha256');
    let hashed = 0;
    const stream = fs.createReadStream(targetPath);
    stream.on('data', (chunk) => {
      if (hashed >= MAX_HASH_BYTES) {
        stream.destroy();
        return;
      }
      const room = MAX_HASH_BYTES - hashed;
      const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
      hashed += slice.length;
      hash.update(slice);
    });
    stream.on('end', () => {
      resolve({
        digest: hashed >= MAX_HASH_BYTES ? null : hash.digest('hex'),
        hashed,
        capped: hashed >= MAX_HASH_BYTES,
      });
    });
    stream.on('error', reject);
  });
}

const SECRET_PATTERNS = [
  { type: 'OpenAI/LLM Key', regex: /sk-[a-zA-Z0-9]{20,}/g },
  { type: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{30,45}/g },
  { type: 'GitHub Personal Access Token', regex: /gh[pousr]_[0-9a-zA-Z]{36}/g },
  { type: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { type: 'Bearer Token', regex: /Bearer\s+([a-zA-Z0-9_\-.]{20,})/gi },
  { type: 'Private Key Block', regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE KEY-----/gi },
  { type: 'Generic Password Field', regex: /(?:password|passwd|pwd|secret|api_key|apikey|auth_token)\s*[:=]\s*["']([^"']{8,})["']/gi },
  { type: 'Database Connection String', regex: /(?:postgres|mysql|mongodb|redis|mssql):\/\/[^\s"'<>]+/gi },
];

/**
 * Detect secrets in text and return a masked copy plus the findings.
 * The findings never carry the raw secret: only a type, the location and a masked preview.
 */
export function redactSecretsAndAudit(text) {
  if (!text || typeof text !== 'string') {
    return { redactedText: text || '', secretFindings: [], truncated: false };
  }

  const truncated = text.length > MAX_REDACT_INPUT_CHARS;
  const source = truncated ? text.slice(0, MAX_REDACT_INPUT_CHARS) : text;
  const secretFindings = [];
  let redactedText = source;

  for (const { type, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const rawMatch = match[0];
      const startIdx = match.index;
      const endIdx = startIdx + rawMatch.length;
      const maskedPreview = rawMatch.length <= 8
        ? '***REDACTED***'
        : `${rawMatch.slice(0, 3)}...${rawMatch.slice(-3)} [REDACTED]`;
      secretFindings.push({ type, location: { start: startIdx, end: endIdx }, maskedPreview });
    }
    redactedText = redactedText.replace(regex, (whole) => (
      whole.length <= 8 ? '***REDACTED***' : `${whole.slice(0, 3)}...${whole.slice(-3)} [REDACTED]`
    ));
  }

  return { redactedText, secretFindings, truncated };
}

export const __workbenchInspectionTest = Object.freeze({
  MAX_ZIP_CENTRAL_DIR_SIZE,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_FILENAME_LEN,
  MAX_ZIP_ARCHIVE_BYTES,
  MAX_HASH_BYTES,
  MAX_REDACT_INPUT_CHARS,
  SECRET_PATTERNS: SECRET_PATTERNS.map((entry) => entry.type),
});
