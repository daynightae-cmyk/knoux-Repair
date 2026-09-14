import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const topBar = fs.readFileSync(path.join(WEB_ROOT, 'src', 'components', 'premium', 'TopBar.tsx'), 'utf8');
const shellCss = fs.readFileSync(path.join(WEB_ROOT, 'src', 'premium-shell.css'), 'utf8');

test('TopBar brand uses the real PNG identity with a text fallback', () => {
  assert.match(topBar, /\/brand\/knoux-repair-logo\.png/);
  assert.match(topBar, /alt="KNOUX Repair"/);
  assert.match(topBar, /onError/);
  // Fallback text lockup survives for failed/missing assets.
  assert.match(topBar, /knoux-brand__text/);
  assert.match(topBar, />KNOUX</);
  assert.match(topBar, />Repair</);
  // The real wide-logo asset ships with the app.
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'public', 'brand', 'knoux-repair-logo.png')));
});

test('TopBar brand keeps object-fit contain and a compact K at narrow widths', () => {
  assert.match(topBar, /knoux-brand__compact/);
  assert.match(shellCss, /\.knoux-brand__img[\s\S]*?object-fit:\s*contain/);
  assert.match(shellCss, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.knoux-brand__compact/);
  assert.match(shellCss, /prefers-reduced-motion/);
});

test('TopBar brand change preserves existing shell contracts', () => {
  assert.match(topBar, /knoux-mcp-topbar-trigger/);
  assert.match(topBar, /knoux:mcp-open/);
  assert.match(topBar, /knoux:ai-open/);
  assert.match(topBar, /onAccountOpen/);
  assert.match(topBar, /knoux-account-trigger/);
});
