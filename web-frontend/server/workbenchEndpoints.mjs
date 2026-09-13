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

export function revokeWorkbenchSession(sessionToken) {
  if (sessionToken && typeof sessionToken === 'string') {
    activeSessions.delete(sessionToken);
  }
  return { ok: true, message: 'Session revoked.' };
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

export function inspectZipArchive(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'FILE_NOT_FOUND', message: 'File not found.' };
  }
  const stats = fs.statSync(filePath);
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

  const cdBuffer = Buffer.alloc(cdSize);
  const cdFd = fs.openSync(filePath, 'r');
  fs.readSync(cdFd, cdBuffer, 0, cdSize, cdOffset);
  fs.closeSync(cdFd);

  const files = [];
  let pos = 0;
  let hasPathTraversal = false;

  for (let i = 0; i < entriesCount && pos < cdSize; i++) {
    if (cdBuffer.readUInt32LE(pos) !== 0x02014b50) break;
    const flags = cdBuffer.readUInt16LE(pos + 8);
    const compMethod = cdBuffer.readUInt16LE(pos + 10);
    const uncompressedSize = cdBuffer.readUInt32LE(pos + 24);
    const fileNameLen = cdBuffer.readUInt16LE(pos + 28);
    const extraLen = cdBuffer.readUInt16LE(pos + 30);
    const commentLen = cdBuffer.readUInt16LE(pos + 32);

    const fileName = cdBuffer.toString('utf8', pos + 46, pos + 46 + fileNameLen);
    const isTraversal = fileName.includes('..') || path.isAbsolute(fileName);
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
    totalFiles: files.length,
    uncompressedBytesTotal: files.reduce((acc, f) => acc + f.size, 0),
    hasPathTraversal,
    files: files.slice(0, 500),
  };
}

export function inspectLocalFile(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { ok: false, error: 'NOT_FOUND', message: 'Target file does not exist.' };
  }
  const stat = fs.statSync(targetPath);
  if (!stat.isFile()) {
    return { ok: false, error: 'NOT_A_FILE', message: 'Target path is not a file.' };
  }

  const fd = fs.openSync(targetPath, 'r');
  const sampleSize = Math.min(stat.size, 1024 * 1024);
  const sampleBuf = Buffer.alloc(sampleSize);
  fs.readSync(fd, sampleBuf, 0, sampleSize, 0);
  fs.closeSync(fd);

  const fullHash = crypto.createHash('sha256');
  const stream = fs.readFileSync(targetPath);
  fullHash.update(stream);
  const sha256 = fullHash.digest('hex');

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

    if (/AIza[0-9A-Za-z-_]{35}/.test(textSample)) risks.push('Google API Key detected');
    if (/sk-[a-zA-Z0-9]{20,}/.test(textSample)) risks.push('OpenAI/LLM Key detected');
    if (/ghp_[0-9a-zA-Z]{36}/.test(textSample)) risks.push('GitHub Personal Access Token');
    if (/BEGIN\s+(RSA|OPENSSH|EC|DSA)?\s*PRIVATE KEY/.test(textSample)) risks.push('Private SSH/RSA Key');
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
    snippet: isBinary ? null : textSample.slice(0, 4000),
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
