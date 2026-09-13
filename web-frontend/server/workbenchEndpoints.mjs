import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_SALT = Buffer.from('2ce7fa3251d239d83a6d10c1f0de3179', 'hex');
const EXPECTED_HASH = Buffer.from('8f356ac240babbfb6db8e57101e7b3abd81998ddd24b9f81a12f67777d2d9f751704dc2de12fcffd77cafea8c0fe80f2f4bfa274a4ba9085cb90d75ac6dc4a90', 'hex');

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
let failedAttempts = 0;
let lockUntil = 0;
const activeSessions = new Map(); // token -> { createdAt, expiresAt }

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}

export function verifyWorkbenchKey(providedKey) {
  const now = Date.now();
  if (lockUntil > 0 && now >= lockUntil) {
    // Cooldown has expired, reset attempts state
    failedAttempts = 0;
    lockUntil = 0;
  }

  if (now < lockUntil) {
    const remainingSec = Math.ceil((lockUntil - now) / 1000);
    return { ok: false, error: 'LOCKED', message: `Too many failed attempts. Locked for ${remainingSec} seconds.` };
  }

  if (typeof providedKey !== 'string' || !providedKey) {
    return { ok: false, error: 'INVALID_INPUT', message: 'Key must be a non-empty string.' };
  }

  try {
    const derivedKey = crypto.scryptSync(providedKey, EXPECTED_SALT, 64);
    const matches = crypto.timingSafeEqual(derivedKey, EXPECTED_HASH);

    if (matches) {
      failedAttempts = 0;
      lockUntil = 0;
      pruneExpiredSessions();
      const sessionToken = crypto.randomBytes(32).toString('hex');
      activeSessions.set(sessionToken, {
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
      });
      return { ok: true, sessionToken, message: 'Engineering Workbench Station unlocked.' };
    }
  } catch (err) {
    // hashing error
  }

  failedAttempts++;
  if (failedAttempts >= 5) {
    lockUntil = Date.now() + 60_000;
    return { ok: false, error: 'LOCKED', message: 'Maximum attempts exceeded. Station access locked for 60 seconds.' };
  } else if (failedAttempts >= 3) {
    lockUntil = Date.now() + 15_000;
    return { ok: false, error: 'DELAYED', message: `Invalid key. Attempt ${failedAttempts}/5. Rate limited for 15 seconds.` };
  }

  return { ok: false, error: 'INVALID_KEY', message: `Invalid key. Attempt ${failedAttempts}/5.` };
}

export function isWorkbenchSessionValid(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return false;
  pruneExpiredSessions();
  const session = activeSessions.get(sessionToken);
  if (!session) return false;
  if (Date.now() >= session.expiresAt) {
    activeSessions.delete(sessionToken);
    return false;
  }
  return true;
}

export function validateWorkbenchSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { ok: false, valid: false, message: 'Invalid or missing token.' };
  }
  pruneExpiredSessions();
  const session = activeSessions.get(sessionToken);
  if (!session) {
    return { ok: false, valid: false, message: 'Session not found or expired.' };
  }
  const now = Date.now();
  if (now >= session.expiresAt) {
    activeSessions.delete(sessionToken);
    return { ok: false, valid: false, message: 'Session has expired.' };
  }
  const remainingSec = Math.max(0, Math.ceil((session.expiresAt - now) / 1000));
  return { ok: true, valid: true, remainingSec, message: 'Session is active.' };
}

export function extractSessionToken(req, body) {
  const headerToken = req.headers?.['x-workbench-session'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  if (body && typeof body.sessionToken === 'string' && body.sessionToken.trim()) {
    return body.sessionToken.trim();
  }
  return null;
}

export function requireWorkbenchPremiumSession(req, body) {
  const token = extractSessionToken(req, body);
  if (!token) {
    return { ok: false, error: 'PREMIUM_REQUIRED', message: 'Valid workbench premium session required.' };
  }
  if (!isWorkbenchSessionValid(token)) {
    return { ok: false, error: 'PREMIUM_UNAUTHORIZED', message: 'Workbench session is invalid or has expired.' };
  }
  return { ok: true, sessionToken: token };
}

export function revokeWorkbenchSession(sessionToken) {
  let wasActive = false;
  if (sessionToken && typeof sessionToken === 'string') {
    wasActive = activeSessions.has(sessionToken);
    activeSessions.delete(sessionToken);
  }
  return { ok: true, revoked: wasActive, message: wasActive ? 'Session revoked successfully.' : 'Session not found or already revoked.' };
}

export function getWorkbenchLockStatus() {
  const now = Date.now();
  if (lockUntil > 0 && now >= lockUntil) {
    failedAttempts = 0;
    lockUntil = 0;
  }
  const locked = now < lockUntil;
  return {
    locked,
    lockRemainingSec: locked ? Math.ceil((lockUntil - now) / 1000) : 0,
    failedAttempts,
  };
}

const MAX_ZIP_CENTRAL_DIR_SIZE = 32 * 1024 * 1024; // 32MB max central directory
const MAX_ZIP_ENTRIES = 10_000;
const MAX_ZIP_FILENAME_LEN = 1024;

export function inspectZipArchive(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'FILE_NOT_FOUND', message: 'File not found.' };
  }
  const stats = fs.statSync(filePath);
  if (stats.size > 2 * 1024 * 1024 * 1024) {
    return { ok: false, error: 'ARCHIVE_TOO_LARGE', message: 'Archive exceeds 2GB maximum inspection limit.' };
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(Math.min(stats.size, 65536));
  fs.readSync(fd, buffer, 0, buffer.length, Math.max(0, stats.size - buffer.length));
  fs.closeSync(fd);

  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return { ok: false, error: 'INVALID_ARCHIVE', message: 'Could not find zip end of central directory.' };
  }

  const entriesCount = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  // Strict Bounds Validation
  if (cdSize > MAX_ZIP_CENTRAL_DIR_SIZE) {
    return { ok: false, error: 'ARCHIVE_TOO_LARGE', message: `Central directory size (${cdSize} bytes) exceeds safety limit.` };
  }
  if (cdOffset < 0 || cdSize < 0 || (cdOffset + cdSize) > stats.size) {
    return { ok: false, error: 'ARCHIVE_INVALID_BOUNDS', message: 'Central directory offsets exceed total archive file size.' };
  }
  if (entriesCount > MAX_ZIP_ENTRIES) {
    return { ok: false, error: 'ARCHIVE_TOO_LARGE', message: `Entry count (${entriesCount}) exceeds maximum allowed entries (${MAX_ZIP_ENTRIES}).` };
  }

  const cdBuffer = Buffer.alloc(cdSize);
  const cdFd = fs.openSync(filePath, 'r');
  fs.readSync(cdFd, cdBuffer, 0, cdSize, cdOffset);
  fs.closeSync(cdFd);

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
      return { ok: false, error: 'ARCHIVE_INVALID_BOUNDS', message: 'Archive entry filename exceeds maximum length.' };
    }

    if (pos + 46 + fileNameLen > cdSize) break;
    const fileName = cdBuffer.toString('utf8', pos + 46, pos + 46 + fileNameLen);
    const isTraversal = fileName.includes('..') || path.isAbsolute(fileName) || fileName.startsWith('/') || fileName.startsWith('\\');
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
    capability: 'INSPECTION_ONLY', // explicitly declares no safe extraction
    totalFiles: files.length,
    uncompressedBytesTotal: files.reduce((acc, f) => acc + f.size, 0),
    hasPathTraversal,
    files: files.slice(0, 500),
  };
}

// Streaming SHA-256 calculation to avoid buffering whole files in memory
export function computeFileSha256Streaming(targetPath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(targetPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

const SECRET_PATTERNS = [
  { type: 'OpenAI/LLM Key', regex: /sk-[a-zA-Z0-9]{20,}/g },
  { type: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{30,45}/g },
  { type: 'GitHub Personal Access Token', regex: /gh[pousr]_[0-9a-zA-Z]{36}/g },
  { type: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { type: 'Bearer Token', regex: /Bearer\s+([a-zA-Z0-9_\-\.]{20,})/gi },
  { type: 'Private Key Block', regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE KEY-----/gi },
  { type: 'Generic Password Field', regex: /(?:password|passwd|pwd|secret|api_key|apikey|auth_token)\s*[:=]\s*["']([^"']{8,})["']/gi },
  { type: 'Database Connection String', regex: /(?:postgres|mysql|mongodb|redis|mssql):\/\/[^\s"'<>]+/gi },
];

export function redactSecretsAndAudit(text) {
  if (!text || typeof text !== 'string') return { redactedText: text || '', secretFindings: [] };

  const secretFindings = [];
  let redactedText = text;

  for (const { type, regex } of SECRET_PATTERNS) {
    // Reset regex index if global
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const rawMatch = match[0];
      const startIdx = match.index;
      const endIdx = startIdx + rawMatch.length;

      let maskedPreview = '';
      if (rawMatch.length <= 8) {
        maskedPreview = '***REDACTED***';
      } else {
        maskedPreview = `${rawMatch.slice(0, 3)}...${rawMatch.slice(-3)} [REDACTED]`;
      }

      secretFindings.push({
        type,
        location: { start: startIdx, end: endIdx },
        maskedPreview,
      });
    }

    // Replace all occurrences in redactedText
    regex.lastIndex = 0;
    redactedText = redactedText.replace(regex, (matched) => {
      if (matched.length <= 8) return '***REDACTED***';
      return `${matched.slice(0, 3)}...${matched.slice(-3)} [REDACTED]`;
    });
  }

  return { redactedText, secretFindings };
}

export async function inspectLocalFile(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { ok: false, error: 'NOT_FOUND', message: 'Target file does not exist.' };
  }
  const stat = fs.statSync(targetPath);
  if (!stat.isFile()) {
    return { ok: false, error: 'NOT_A_FILE', message: 'Target path is not a file.' };
  }

  // Stream SHA256 to handle arbitrary file sizes safely without memory bloat
  const sha256 = await computeFileSha256Streaming(targetPath);

  // Read preview sample (up to 1MB)
  const fd = fs.openSync(targetPath, 'r');
  const sampleSize = Math.min(stat.size, 1024 * 1024);
  const sampleBuf = Buffer.alloc(sampleSize);
  fs.readSync(fd, sampleBuf, 0, sampleSize, 0);
  fs.closeSync(fd);

  let isBinary = false;
  for (let i = 0; i < Math.min(sampleSize, 1024); i++) {
    if (sampleBuf[i] === 0) {
      isBinary = true;
      break;
    }
  }

  const textSample = isBinary ? '' : sampleBuf.toString('utf8');
  const risks = [];

  if (!isBinary) {
    if (/Invoke-Expression|iex\s/i.test(textSample)) risks.push('Invoke-Expression execution');
    if (/DownloadString|DownloadFile/i.test(textSample)) risks.push('Remote script download');
    if (/Start-Process.*-Verb\s+RunAs/i.test(textSample)) risks.push('UAC Elevation request');
    if (/Set-ExecutionPolicy/i.test(textSample)) risks.push('ExecutionPolicy change');
    if (/\[System\.Convert\]::FromBase64String/i.test(textSample)) risks.push('Base64 decoded command');
  }

  const { redactedText, secretFindings } = isBinary ? { redactedText: null, secretFindings: [] } : redactSecretsAndAudit(textSample);

  if (secretFindings.length > 0) {
    for (const sf of secretFindings) {
      const riskDesc = `Sensitive Secret Detected: ${sf.type} (${sf.maskedPreview})`;
      if (!risks.includes(riskDesc)) risks.push(riskDesc);
    }
  }

  return {
    ok: true,
    path: targetPath,
    name: path.basename(targetPath),
    sizeBytes: stat.size,
    isBinary,
    sha256,
    created: stat.birthtime,
    modified: stat.mtime,
    risks,
    secretFindings,
    snippet: isBinary ? null : (redactedText ? redactedText.slice(0, 4000) : null),
  };
}

export function detectToolchain() {
  const isWin = process.platform === 'win32';
  const tools = [
    { name: 'node', exe: 'node', args: ['--version'], lookup: 'node' },
    { name: 'npm', exe: isWin ? 'cmd.exe' : 'npm', args: isWin ? ['/d', '/s', '/c', 'npm', '--version'] : ['--version'], lookup: 'npm' },
    { name: 'git', exe: 'git', args: ['--version'], lookup: 'git' },
    { name: 'python', exe: 'python', args: ['--version'], lookup: 'python' },
    { name: 'dotnet', exe: 'dotnet', args: ['--version'], lookup: 'dotnet' },
    { name: 'powershell', exe: 'pwsh', args: ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], lookup: 'pwsh' },
  ];

  const results = [];
  for (const t of tools) {
    try {
      const res = spawnSync(t.exe, t.args, { encoding: 'utf8', timeout: 3000, windowsHide: true });
      if (res.status === 0) {
        const whichExe = isWin ? 'where.exe' : 'which';
        const whichRes = spawnSync(whichExe, [t.lookup], { encoding: 'utf8', timeout: 2000, windowsHide: true });
        const paths = whichRes.status === 0 ? whichRes.stdout.split(/\r?\n/).filter(Boolean) : [];
        results.push({
          tool: t.name,
          available: true,
          version: res.stdout.trim() || res.stderr.trim(),
          primaryPath: paths[0] || 'Available in PATH',
          candidates: paths,
        });
      } else {
        results.push({ tool: t.name, available: false, version: '', primaryPath: '', candidates: [] });
      }
    } catch {
      results.push({ tool: t.name, available: false, version: '', primaryPath: '', candidates: [] });
    }
  }

  return { ok: true, toolchain: results };
}

export function getActiveDevPorts() {
  try {
    const res = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', timeout: 4000 });
    if (res.status !== 0 || !res.stdout) {
      return { ok: true, ports: [] };
    }

    const lines = res.stdout.split(/\r?\n/);
    const ports = [];
    const seen = new Set();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4 && parts[0].toUpperCase() === 'TCP') {
        const localAddr = parts[1];
        const state = parts[3];
        const pid = parts[4] ? parseInt(parts[4], 10) : null;

        if (state === 'LISTENING') {
          const colonIdx = localAddr.lastIndexOf(':');
          if (colonIdx > 0) {
            const portNum = parseInt(localAddr.slice(colonIdx + 1), 10);
            const ip = localAddr.slice(0, colonIdx);
            if (!Number.isNaN(portNum) && !seen.has(portNum)) {
              seen.add(portNum);
              ports.push({ port: portNum, address: ip, processId: pid });
            }
          }
        }
      }
    }

    return { ok: true, ports: ports.slice(0, 50) };
  } catch (err) {
    return { ok: true, ports: [] };
  }
}
