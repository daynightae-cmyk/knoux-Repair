import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const authGate = read('src/components/AuthGate.tsx');
const accountCenter = read('src/components/AccountCenter.tsx');
const topBar = read('src/components/premium/TopBar.tsx');
const app = read('src/App.tsx');
const styles = read('src/account-shell.css');
const capture = read('scripts/capture-evidence.mjs');

test('Mission 01: premium login keeps Google primary, Microsoft/GitHub secondary, and explicit Local Mode', () => {
  assert.match(authGate, /knoux-login-google/);
  assert.match(authGate, /\['entra', 'github'\]/);
  assert.match(authGate, /Continue in Local Mode/);
  assert.match(authGate, /Local Mode never bypasses bridge-side authorization/);
  assert.match(authGate, /onLocalMode/);
});

test('Mission 01: account shell renders connected providers only from bridge auth evidence', () => {
  assert.match(accountCenter, /auth\?\.authenticated/);
  assert.match(accountCenter, /user\?\.provider === provider/);
  assert.match(accountCenter, /No remote device registry is connected/);
  assert.doesNotMatch(accountCenter, /lastSeen|Windows 11 Pro|DESKTOP-|deviceId:/);
});

test('Mission 01: local-first shell does not bypass protected execution and AUTH_REQUIRED reopens identity gate', () => {
  assert.match(app, /localModeActive/);
  assert.match(app, /e\.code === 'AUTH_REQUIRED'/);
  assert.match(app, /setLocalModeActive\(false\)/);
  assert.match(app, /onLocalMode=\{\(\) =>/);
});

test('Mission 01: account center is reachable from TopBar and has visual evidence capture', () => {
  assert.match(topBar, /onAccountOpen/);
  assert.match(topBar, /knoux-account-trigger/);
  assert.match(app, /<AccountCenter/);
  assert.match(styles, /\.knoux-account-center/);
  assert.match(capture, /MISSION-01_ACCOUNT-CENTER\.png/);
  assert.match(capture, /requireAccount/);
});
