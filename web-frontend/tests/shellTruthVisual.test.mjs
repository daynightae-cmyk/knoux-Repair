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
