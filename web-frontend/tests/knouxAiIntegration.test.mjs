import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(WEB, relativePath), 'utf8');
}

test('TopBar exposes KNOUX AI through the global assistant event', () => {
  const source = read('src/components/premium/TopBar.tsx');
  assert.match(source, /KNOUX AI/);
  assert.match(source, /knoux:ai-open/);
});

test('application root mounts the KNOUX AI overlay host', () => {
  const source = read('src/main.tsx');
  assert.match(source, /KnouxAiOverlayHost/);
});

test('web gateway registers dedicated KNOUX AI routes before bridge fallback', () => {
  const source = read('server.ts');
  assert.match(source, /registerKnouxAiRoutes\(customRouter\)/);
  assert.ok(source.indexOf('registerKnouxAiRoutes(customRouter)') < source.indexOf("app.use('/api', proxyApi)"));
});

test('Agent Runtime adapter uses bounded A2A messages and explicit application context', () => {
  const source = read('server/knouxAiRuntime.ts');
  assert.match(source, /\/knoux-ai\/status/);
  assert.match(source, /\/knoux-ai\/message/);
  assert.match(source, /ROLE_USER/);
  assert.match(source, /slice\(0, 8\)/);
  assert.match(source, /Evidence unavailable/);
  assert.match(source, /Local KNOUX policy controls execution/);
});

test('React assistant calls only the local KNOUX web gateway', () => {
  const source = read('src/components/KnouxAiOverlayHost.tsx');
  assert.match(source, /\/api\/knoux-ai\/status/);
  assert.match(source, /\/api\/knoux-ai\/message/);
  assert.doesNotMatch(source, /aiplatform\.googleapis\.com/);
  assert.doesNotMatch(source, /reasoningEngines\/374423291676327936/);
});
