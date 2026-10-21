import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  inspectZipArchive,
  computeFileSha256Streaming,
  redactSecretsAndAudit,
  __workbenchInspectionTest,
} from '../server/workbench-inspection.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const SOURCE = fs.readFileSync(path.join(WEB_ROOT, 'server', 'workbench-inspection.mjs'), 'utf8');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-inspection-'));
}

/** Build a store-only ZIP so the inspector can be exercised without any dependency. */
function buildZip(entryNames) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const name of entryNames) {
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14); // crc
    local.writeUInt32LE(0, 18); // compressed size
    local.writeUInt32LE(0, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBytes);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0, 14);
    dir.writeUInt32LE(0, 16);
    dir.writeUInt32LE(0, 20);
    dir.writeUInt32LE(0, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBytes);

    offset += local.length + nameBytes.length;
  }
  const centralBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entryNames.length, 8);
  eocd.writeUInt16LE(entryNames.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuffer, eocd]);
}

test('secret redaction masks every supported credential family', () => {
  const samples = [
    ['OpenAI/LLM Key', 'sk-abcdefghijklmnopqrstuvwxyz012345'],
    ['Google API Key', 'AIzaSyA1234567890abcdefghijklmnopqrstuvw'],
    ['GitHub Personal Access Token', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['AWS Access Key ID', 'AKIAIOSFODNN7EXAMPLE'],
  ];
  for (const [type, secret] of samples) {
    const result = redactSecretsAndAudit(`value=${secret} tail`);
    assert.equal(result.secretFindings.length, 1, `${type} must be detected`);
    assert.equal(result.secretFindings[0].type, type);
    assert.ok(!result.redactedText.includes(secret), `${type} must not survive redaction`);
    assert.ok(result.redactedText.includes('tail'), 'surrounding text must be preserved');
    assert.ok(!JSON.stringify(result.secretFindings).includes(secret), 'findings must not carry the raw secret');
  }
});

test('secret redaction covers bearer tokens, private keys, password fields and connection strings', () => {
  const cases = [
    ['Bearer Token', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789'],
    ['Private Key Block', '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----'],
    ['Generic Password Field', 'password = "hunter2hunter2"'],
    ['Database Connection String', 'postgres://user:pass@localhost:5432/knoux'],
  ];
  for (const [type, sample] of cases) {
    const result = redactSecretsAndAudit(sample);
    const types = result.secretFindings.map((finding) => finding.type);
    assert.ok(types.includes(type), `${type} must be detected, got ${types.join(',')}`);
    assert.ok(!result.redactedText.includes(sample), `${type} must be masked`);
  }
});

test('secret redaction is safe on empty, non-string and oversized input', () => {
  assert.deepEqual(redactSecretsAndAudit('').secretFindings, []);
  assert.deepEqual(redactSecretsAndAudit(null).secretFindings, []);
  assert.equal(redactSecretsAndAudit(undefined).redactedText, '');
  const huge = 'a'.repeat(__workbenchInspectionTest.MAX_REDACT_INPUT_CHARS + 10);
  const result = redactSecretsAndAudit(huge);
  assert.equal(result.truncated, true);
  assert.ok(result.redactedText.length <= __workbenchInspectionTest.MAX_REDACT_INPUT_CHARS);
});

test('streaming sha256 matches the reference digest and never buffers the whole file', async () => {
  const dir = tempDir();
  const file = path.join(dir, 'sample.bin');
  const payload = crypto.randomBytes(3 * 1024 * 1024);
  fs.writeFileSync(file, payload);
  try {
    const result = await computeFileSha256Streaming(file);
    assert.equal(result.capped, false);
    assert.equal(result.digest, crypto.createHash('sha256').update(payload).digest('hex'));
    assert.equal(result.hashed, payload.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('streaming sha256 rejects a missing file instead of hanging', async () => {
  await assert.rejects(() => computeFileSha256Streaming(path.join(os.tmpdir(), 'knoux-missing-file.bin')));
});

test('zip inspection lists entries and reports traversal risk without extracting anything', () => {
  const dir = tempDir();
  const archive = path.join(dir, 'safe.zip');
  fs.writeFileSync(archive, buildZip(['readme.txt', 'docs/guide.md']));
  try {
    const result = inspectZipArchive(archive);
    assert.equal(result.ok, true);
    assert.equal(result.capability, 'INSPECTION_ONLY');
    assert.equal(result.totalFiles, 2);
    assert.equal(result.hasPathTraversal, false);
    assert.deepEqual(result.files.map((file) => file.name), ['readme.txt', 'docs/guide.md']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('zip inspection flags path traversal entries', () => {
  const dir = tempDir();
  const archive = path.join(dir, 'evil.zip');
  fs.writeFileSync(archive, buildZip(['../../etc/passwd', 'C:\\Windows\\System32\\evil.dll']));
  try {
    const result = inspectZipArchive(archive);
    assert.equal(result.ok, true);
    assert.equal(result.hasPathTraversal, true);
    assert.ok(result.files.every((file) => file.pathTraversalRisk === true));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('zip inspection refuses missing files, directories and non-archives', () => {
  const dir = tempDir();
  try {
    assert.equal(inspectZipArchive(path.join(dir, 'nope.zip')).error, 'FILE_NOT_FOUND');
    assert.equal(inspectZipArchive(dir).error, 'NOT_A_FILE');
    const notZip = path.join(dir, 'plain.txt');
    fs.writeFileSync(notZip, 'this is definitely not a zip archive');
    assert.equal(inspectZipArchive(notZip).error, 'INVALID_ARCHIVE');
    assert.equal(inspectZipArchive('').error, 'INVALID_PATH');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('zip inspection enforces the entry-count ceiling', () => {
  const dir = tempDir();
  const archive = path.join(dir, 'many.zip');
  const bytes = buildZip(['a.txt']);
  const eocdOffset = bytes.length - 22; // the EOCD record is the last 22 bytes
  bytes.writeUInt16LE(0xffff, eocdOffset + 8); // entries on this disk
  bytes.writeUInt16LE(0xffff, eocdOffset + 10); // total entries
  fs.writeFileSync(archive, bytes);
  try {
    const result = inspectZipArchive(archive);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'ARCHIVE_TOO_LARGE');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the ported inspection module carries no premium verifier, session or write capability', () => {
  // The donor premium gate must never reappear in the product tree.
  assert.doesNotMatch(SOURCE, /1d536dd78e4bf53ac43ad153e54af0da/i);
  assert.doesNotMatch(SOURCE, /a953276c868cc1b9887c0ff1c48998b47df24c421d22660c05e9036c4a9f3995c3ec1354fc735ad75899d6188635a72919b46fe21bb209ca6606e2cfa9b4c29d/i);
  assert.doesNotMatch(SOURCE, /knoux-workbench-token/i);
  assert.doesNotMatch(SOURCE, /scrypt/i);
  assert.doesNotMatch(SOURCE, /sessionToken|createSession|verifyWorkbenchKey/i);
  // Inspection only: no writes, no archive extraction libraries, no execution.
  assert.doesNotMatch(SOURCE, /writeFile|writeFileSync|appendFile|createWriteStream/);
  assert.doesNotMatch(SOURCE, /child_process|execSync|spawnSync/);
  assert.doesNotMatch(SOURCE, /adm-zip|unzipper|yauzl|node-stream-zip|Extract-Archive|tar\s+-x|7z\s/i);
});

test('the bridge enforces the local-secret promise instead of only asserting it', () => {
  const bridge = fs.readFileSync(path.join(WEB_ROOT, 'server', 'bridge-core.mjs'), 'utf8');
  assert.match(bridge, /import \{ redactSecretsAndAudit \} from '\.\/workbench-inspection\.mjs'/);
  assert.match(bridge, /function redactSonarPreview\(preview\)/);
  assert.match(bridge, /finding\.Evidence = scrub\(finding\.Evidence\)/);
  assert.match(bridge, /preview\.SecretsRedacted = secretsRedacted/);
  // The AI payload must report how many secrets were masked on the way out.
  assert.match(bridge, /secretsMaskedBeforeSend: Number\(preview\?\.SecretsRedacted \|\| 0\)/);
  // The written report must state the masking too.
  assert.match(bridge, /local secret\(s\) were masked before this report was written/);
});
