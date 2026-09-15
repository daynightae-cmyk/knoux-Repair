import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const ai = read('src/components/pages/AIScanPage.tsx');
const app = read('src/App.tsx');
const context = read('src/components/pages/HomeContextPanel.tsx');

test('AI provider status is configuration truth, not a bridge-online readiness claim', () => {
  assert.match(app, /api\.aiModels\(\)/);
  assert.match(app, /hasGeminiKey \|\| models\.hasOpenRouterKey \? 'CONFIGURED' : 'UNCONFIGURED'/);
  assert.match(app, /bridgeOnline === false[\s\S]*setAiProviderState\('UNAVAILABLE'\)/);
  assert.match(context, /live availability is verified on use/);
  assert.doesNotMatch(context, /AI scan is available/);
});

test('AI scan keeps canonical ToolIds internal while showing human action labels', () => {
  for (const id of ['PF01', 'DS01', 'SE04', 'SC01', 'DM02']) {
    assert.match(ai, new RegExp(`toolId: '${id}'`));
    assert.doesNotMatch(ai, new RegExp(`actionLabel(?:En|Ar):[^\\n]*\\(${id}\\)`));
  }
});

test('AI scan findings remain evidence-driven without random or timer-generated results', () => {
  for (const call of ['api.system()', 'api.cleanupPreview()', 'api.driversPreview()']) assert.match(ai, new RegExp(call.replace(/[()]/g, '\\$&')));
  assert.doesNotMatch(ai, /Math\.random|setTimeout\([^)]*(?:finding|success|progress)/i);
});
