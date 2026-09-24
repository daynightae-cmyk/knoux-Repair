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
