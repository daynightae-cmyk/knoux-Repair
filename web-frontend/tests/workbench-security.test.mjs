import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  verifyWorkbenchKey,
  validateWorkbenchSession,
  requireWorkbenchPremiumSession,
  revokeWorkbenchSession,
  getWorkbenchLockStatus,
  inspectZipArchive,
  inspectLocalFile,
  redactSecretsAndAudit,
  computeFileSha256Streaming,
} from '../server/workbenchEndpoints.mjs';

test('Workbench Security: redactSecretsAndAudit redacts sensitive keys and produces findings', () => {
  const sample = `
    const OPENAI_KEY = "sk-abcdef1234567890abcdef123456";
    const GOOGLE_KEY = "AIzaSyDa-123456789012345678901234567";
    const GITHUB_TOKEN = "ghp_123456789012345678901234567890123456";
    const AWS_KEY = "AKIA1234567890123456";
    const AUTH_HEADER = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M";
    const DB_URI = "postgres://user:secretpass123@localhost:5432/mydb";
    const normalCode = "const x = 42; console.log('hello');";
  `;

  const { redactedText, secretFindings } = redactSecretsAndAudit(sample);

  assert.equal(redactedText.includes('sk-abcdef1234567890abcdef123456'), false);
  assert.equal(redactedText.includes('AIzaSyDa-123456789012345678901234567'), false);
  assert.equal(redactedText.includes('ghp_123456789012345678901234567890123456'), false);
  assert.equal(redactedText.includes('AKIA1234567890123456'), false);
  assert.equal(redactedText.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), false);
  assert.equal(redactedText.includes('secretpass123'), false);

  assert.ok(secretFindings.length >= 6);
  for (const f of secretFindings) {
    assert.ok(f.type);
    assert.ok(f.location);
    assert.ok(typeof f.location.start === 'number');
    assert.ok(typeof f.location.end === 'number');
    assert.ok(f.maskedPreview.includes('[REDACTED]') || f.maskedPreview.includes('***REDACTED***'));
  }
});

test('Workbench Security: inspectLocalFile streams SHA-256 and detects masked secrets', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-file-test-'));
  const testFilePath = path.join(tmpDir, 'secure-config.ts');

  try {
    const rawContent = `// Secret config\nconst apiKey = "sk-syntheticSecretKey1234567890123456";\nconst port = 8080;\n`;
    fs.writeFileSync(testFilePath, rawContent, 'utf8');

    const streamingHash = await computeFileSha256Streaming(testFilePath);
    const expectedHash = crypto.createHash('sha256').update(rawContent).digest('hex');
    assert.equal(streamingHash, expectedHash);

    const result = await inspectLocalFile(testFilePath);
    assert.equal(result.ok, true);
    assert.equal(result.sha256, expectedHash);
    assert.ok(result.snippet);
    assert.equal(result.snippet.includes('sk-syntheticSecretKey1234567890123456'), false);
    assert.ok(result.secretFindings.length > 0);
    assert.ok(result.risks.some((r) => r.includes('Sensitive Secret Detected')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Workbench Security: inspectZipArchive enforces bounds checks and traversal guards', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-zip-test-'));
  const fakeZipPath = path.join(tmpDir, 'corrupt.zip');

  try {
    const corruptBuf = Buffer.alloc(100);
    corruptBuf.writeUInt32LE(0x06054b50, 50);
    corruptBuf.writeUInt16LE(1, 60);
    corruptBuf.writeUInt32LE(100000, 62);
    corruptBuf.writeUInt32LE(500000, 66);
    fs.writeFileSync(fakeZipPath, corruptBuf);

    const result = inspectZipArchive(fakeZipPath);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'ARCHIVE_INVALID_BOUNDS');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Workbench Security: session validation, authorization requirement, and revocation lifecycle', () => {
  // Test invalid key
  const badAuth = verifyWorkbenchKey('WrongKey1234');
  assert.equal(badAuth.ok, false);

  // Test correct key unlocks and issues session
  const goodAuth = verifyWorkbenchKey('KnouxAi200900$$');
  assert.equal(goodAuth.ok, true, `Expected ok: true, got: ${JSON.stringify(goodAuth)}`);
  assert.ok(goodAuth.sessionToken);

  const token = goodAuth.sessionToken;

  const validCheck = validateWorkbenchSession(token);
  assert.equal(validCheck.ok, true);
  assert.equal(validCheck.valid, true);
  assert.ok(validCheck.remainingSec > 0);

  const reqWithHeader = { headers: { 'x-workbench-session': token } };
  const authFromHeader = requireWorkbenchPremiumSession(reqWithHeader, {});
  assert.equal(authFromHeader.ok, true);

  const reqWithBody = { headers: {} };
  const authFromBody = requireWorkbenchPremiumSession(reqWithBody, { sessionToken: token });
  assert.equal(authFromBody.ok, true);

  const fakeAuth = requireWorkbenchPremiumSession({ headers: { 'x-workbench-session': 'fake-token-123' } }, {});
  assert.equal(fakeAuth.ok, false);
  assert.equal(fakeAuth.error, 'PREMIUM_UNAUTHORIZED');

  const revokeResult = revokeWorkbenchSession(token);
  assert.equal(revokeResult.ok, true);
  assert.equal(revokeResult.revoked, true);

  const postRevokeCheck = validateWorkbenchSession(token);
  assert.equal(postRevokeCheck.valid, false);

  const reqPostRevoke = requireWorkbenchPremiumSession(reqWithHeader, {});
  assert.equal(reqPostRevoke.ok, false);
});
