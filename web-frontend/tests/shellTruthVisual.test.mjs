import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const action = read('src/components/pages/ActionCenterPage.tsx');
const app = read('src/App.tsx');
const settings = read('src/components/SettingsCenter.tsx');
const splashModel = read('src/components/splashModel.ts');

test('Action Center resolves the real family/service for a failed tool instead of hardcoding Vitality', () => {
  assert.match(action, /destinationForTool/);
  assert.match(action, /family\.services\.find\(candidate => candidate\.id === tool\.Category\)/);
  assert.match(action, /tools\.find\(candidate => candidate\.ToolId === toolId\)/);
  assert.doesNotMatch(action, /onNavigate\(\{ family: 'vitality', toolId \}\)/);
});

test('Action Center keeps ToolId internal and shows human tool names', () => {
  assert.match(action, /tool\.EnglishName/);
  assert.match(action, /tool\.ArabicName/);
  assert.doesNotMatch(action, /Retry Tool \$\{toolId\}/);
  assert.match(app, /tools=\{allTools\}/);
});

test('shell readiness wording distinguishes registered tools from executable readiness', () => {
  assert.match(splashModel, /TOOLS REGISTERED/);
  assert.match(app, /tools registered/);
  assert.doesNotMatch(splashModel, /TOOLS READY/);
});

test('Settings reports bridge checking separately from offline', () => {
  assert.match(settings, /bridgeOnline===true\?c\.ready:bridgeOnline===false\?'OFFLINE':'CHECKING'/);
  assert.match(settings, /is-checking/);
});

test('AI Scan shell footer derives workspace readiness and runtime metadata truthfully without hardcoded fallbacks', () => {
  const leftRail = read('src/components/premium/LeftRail.tsx');
  const aiScan = read('src/components/pages/AIScanPage.tsx');

  // No hardcoded Windows 11 Pro fallback
  assert.doesNotMatch(app, /'Windows 11 Pro'/);
  assert.doesNotMatch(app, /"Windows 11 Pro"/);
  assert.doesNotMatch(aiScan, /'Windows 11'/);
  assert.doesNotMatch(aiScan, /"Windows 11"/);

  // No hardcoded build 22631.3155
  assert.doesNotMatch(app, /22631\.3155/);
  assert.doesNotMatch(aiScan, /22631\.3155/);

  // Workspace readiness is derived from runtime state (bridgeOnline), not hardcoded "System Workspace: Ready"
  assert.match(app, /bridgeOnline === true/);
  assert.match(app, /System Workspace: Ready/);
  assert.match(app, /System Workspace: Offline/);
  assert.doesNotMatch(app, /<span>System Workspace: Ready<\/span>/);

  // App version is derived from canonical package version, not conflicting v1.0.0
  assert.doesNotMatch(app, /v1\.0\.0/);
  assert.doesNotMatch(leftRail, /v1\.0\.0/);
  assert.match(app, /APP_VERSION/);
  assert.match(leftRail, /APP_VERSION/);
});
