import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

function parseVersion(raw) {
  const parts = raw.split('.').map(Number);
  assert.ok(parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 0), `not a plain x.y.z version: ${raw}`);
  return parts;
}

function parseCaret(range) {
  const match = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
  assert.ok(match, `expected a caret range like ^x.y.z, got: ${range}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test('locked electron version satisfies the declared caret range', () => {
  const [maj, min, pat] = parseCaret(pkg.devDependencies.electron);
  const candidate = parseVersion(lock.packages['node_modules/electron'].version);
  assert.equal(candidate[0], maj, 'locked electron major must equal the declared caret major');
  assert.ok(
    candidate[1] > min || (candidate[1] === min && candidate[2] >= pat),
    `locked electron ${candidate.join('.')} is below the declared floor ${maj}.${min}.${pat}`,
  );
});

test('allowScripts electron pin matches the locked electron version exactly', () => {
  const pins = Object.keys(pkg.allowScripts || {}).filter((key) => key.startsWith('electron@'));
  assert.ok(pins.length === 1, `expected exactly one electron@<version> pin in allowScripts, found: ${JSON.stringify(pins)}`);
  const pinned = pins[0].split('@')[1];
  assert.equal(pinned, lock.packages['node_modules/electron'].version, 'allowScripts electron pin drifted from the lockfile');
});

test('electron-builder remains declared beside electron', () => {
  assert.match(pkg.devDependencies['electron-builder'], /^\^?\d+/);
  assert.ok(pkg.scripts['desktop:package'].includes('electron-builder'));
});
