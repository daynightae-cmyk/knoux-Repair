import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveBrowsePath, browseRoots, browseFolders } from '../server/bridge.mjs';

test('browseRoots returns real Windows roots including Home and active drives', () => {
  const roots = browseRoots();
  assert.ok(Array.isArray(roots), 'roots must be an array');
  assert.ok(roots.length >= 1, 'must have at least 1 root');

  const homeRoot = roots.find((r) => r.kind === 'home');
  assert.ok(homeRoot, 'must include user home directory');
  assert.equal(fs.existsSync(homeRoot.path), true, 'home root must exist on disk');

  if (process.platform === 'win32') {
    const driveRoots = roots.filter((r) => r.kind === 'drive');
    assert.ok(driveRoots.length >= 1, 'must include at least one drive root on Windows');
    for (const drive of driveRoots) {
      assert.match(drive.path, /^[a-zA-Z]:[\\/]/, 'drive path must be formatted with drive letter and separator');
      assert.equal(fs.existsSync(drive.path), true, `drive path ${drive.path} must exist`);
    }
  }
});

test('browseFolders enumerates real directories with valid parent and sorted entries', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');
  const result = browseFolders(repoRoot);

  assert.equal(result.status, 'OK', 'status must be OK for populated directory');
  assert.equal(path.resolve(result.path), repoRoot, 'path must match normalized requested directory');
  assert.ok(result.parentPath === null || typeof result.parentPath === 'string');
  assert.ok(Array.isArray(result.folders), 'folders must be an array');
  assert.ok(result.folders.length > 0, 'repo root must contain subfolders');

  const names = result.folders.map((f) => f.name);
  assert.ok(names.includes('web-frontend'), 'must include web-frontend folder');
  assert.ok(names.includes('Docs'), 'must include Docs folder');

  // Verify sort order
  const sortedNames = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  assert.deepEqual(names, sortedNames, 'folders must be sorted alphabetically');
});

test('browseFolders reports EMPTY status for an empty directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-empty-test-'));
  try {
    const result = browseFolders(tmpDir);
    assert.equal(result.status, 'EMPTY');
    assert.equal(result.folders.length, 0);
    assert.equal(result.truncated, false);
    assert.equal(path.resolve(result.path), path.resolve(tmpDir));
  } finally {
    try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
  }
});

test('resolveBrowsePath rejects path traversal sequences (..)', () => {
  const badPaths = [
    '..',
    'C:\\Windows\\..\\Windows',
    'D:\\Knoux-repair\\..\\..\\secret',
    '/foo/../bar',
    'C:/test/..',
    '..\\test',
  ];

  for (const badPath of badPaths) {
    assert.throws(
      () => resolveBrowsePath(badPath),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_FOLDER_PATH');
        return true;
      },
      `Should reject path traversal sequence: ${badPath}`
    );
  }
});

test('resolveBrowsePath rejects null bytes and %00 poisonings', () => {
  const poisoned = [
    'C:\\Windows\0evil',
    'D:\\Knoux-repair\u0000sub',
    'C:\\Users%00test',
  ];

  for (const bad of poisoned) {
    assert.throws(
      () => resolveBrowsePath(bad),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_FOLDER_PATH');
        return true;
      },
      `Should reject null byte poisoned path: ${bad}`
    );
  }
});

test('resolveBrowsePath rejects URL-encoded path traversal characters', () => {
  const encoded = [
    'C:\\test%2e%2e\\secret',
    'C:%2fWindows',
    'C:%5cWindows',
    'D:\\safe%2e%2e',
  ];

  for (const bad of encoded) {
    assert.throws(
      () => resolveBrowsePath(bad),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_FOLDER_PATH');
        return true;
      },
      `Should reject encoded traversal: ${bad}`
    );
  }
});

test('resolveBrowsePath rejects malformed UNC paths and invalid drive letters', () => {
  const invalid = [
    '\\\\',
    '\\\\localhost',
    '\\\\?\\C:\\Windows',
    '1:\\Windows',
    'C:RelativePathWithoutSlash',
  ];

  for (const bad of invalid) {
    assert.throws(
      () => resolveBrowsePath(bad),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_FOLDER_PATH');
        return true;
      },
      `Should reject malformed UNC or invalid drive: ${bad}`
    );
  }
});

test('resolveBrowsePath returns 404 FOLDER_NOT_FOUND for non-existent paths and files', () => {
  const nonExistent = 'C:\\Knoux_Ghost_Directory_99999_xyz';
  assert.throws(
    () => resolveBrowsePath(nonExistent),
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, 'FOLDER_NOT_FOUND');
      return true;
    }
  );

  // A file rather than directory should also return FOLDER_NOT_FOUND
  const thisFile = path.resolve(import.meta.dirname, 'filesystem.test.mjs');
  assert.throws(
    () => resolveBrowsePath(thisFile),
    (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, 'FOLDER_NOT_FOUND');
      return true;
    }
  );
});
