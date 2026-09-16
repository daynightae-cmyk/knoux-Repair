import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { server } from '../server/bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (p) => fs.readFileSync(path.join(webRoot, p), 'utf8');

let baseUrl = '';
before(async () => {
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});
after(async () => {
  await new Promise((resolve) => server.close(() => resolve()));
});

test('renderer never holds cloud secrets: no browser key storage or key field', () => {
  const zen = readWeb('src/components/OpenCodeZenHub.tsx');
  assert.equal(/localStorage\s*\.\s*(getItem|setItem)/.test(zen), false, 'renderer must not use browser storage for keys');
  assert.equal(/sessionStorage\s*\.\s*(getItem|setItem)/.test(zen), false, 'renderer must not use session storage for keys');
  assert.equal(zen.includes('customApiKey'), false, 'renderer must not send a customApiKey field');
  assert.equal(zen.includes('knoux-openrouter-key'), false, 'renderer must not reference the legacy browser key slot');
  assert.equal(zen.includes('sk-or-v1-...'), false, 'renderer must not render a key placeholder input');
  assert.match(zen, /Server key only/, 'provider UI must state server-only key ownership');
  assert.match(zen, /UNCONFIGURED/, 'provider UI must expose honest unconfigured state');
});

test('typed AI contract carries no renderer key field', () => {
  const api = readWeb('src/lib/api.ts');
  assert.equal(api.includes('customApiKey'), false, 'AiGenerateRequest must not carry a key field');
});

test('bridge rejects renderer-supplied keys and keeps secrets server-side', async () => {
  const core = readWeb('server/bridge-core.mjs');
  assert.equal(/customApiKey\s*\?\s*\.\s*trim|typeof customApiKey/.test(core), false, 'bridge must not honor a caller-supplied key');
  assert.match(core, /RENDERER_KEY_NOT_ACCEPTED/);

  const res = await fetch(`${baseUrl}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId: 'deepseek/deepseek-r1:free', prompt: 'ping', customApiKey: 'sk-or-v1-testkey123' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'RENDERER_KEY_NOT_ACCEPTED');
});
