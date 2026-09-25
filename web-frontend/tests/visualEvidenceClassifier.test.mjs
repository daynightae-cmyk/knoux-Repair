import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(webRoot, 'scripts', 'capture-final-visual-evidence.mjs'),
  'utf8',
);

test('final visual evidence ignores only the exact local Vite HMR CSP diagnostic', () => {
  assert.match(source, /Connecting to 'ws:\\\/\\\/127\\\.0\\\.0\\\.1:24678/);
  assert.match(source, /Content Security Policy directive/);
  assert.match(source, /http:\\\/\\\/127\\\.0\\\.0\\\.1:8787/);
  assert.doesNotMatch(source, /Content Security Policy\.\*ws:/);
});


test('navigation blank-frame classifier accepts only substantive visible route surfaces', () => {
  assert.match(source, /substantive=route\.filter/);
  assert.match(source, /r\.width>320&&r\.height>180/);
  assert.match(source, /text\.length>=24\|\|signal/);
  assert.match(source, /meaningful=Math\.max/);
  assert.doesNotMatch(source, /meaningful=route\.length/);
});


test('navigation gate accepts only verified POST /api/runs RUN_IN_PROGRESS conflicts', () => {
  assert.match(source, /responseChecks/);
  assert.match(source, /pathname==='\/api\/runs'/);
  assert.match(source, /rec\.error==='RUN_IN_PROGRESS'/);
  assert.match(source, /unexpected409/);
  assert.match(source, /expectedRunConflicts/);
  assert.doesNotMatch(source, /ignored=.*409/);
});
