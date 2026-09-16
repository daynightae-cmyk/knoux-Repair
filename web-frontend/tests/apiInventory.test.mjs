import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const read = (p) => fs.readFileSync(p, 'utf8');

const INVENTORY = path.join(repoRoot, 'Docs', 'API-INVENTORY.md');

function apiLiterals(source) {
  const found = new Set();
  const re = /['"`](\/api\/[A-Za-z0-9/_${}.-]+)(?:\?[^'"`]*)?['"`]/g;
  let m;
  while ((m = re.exec(source))) {
    let route = m[1];
    // Normalize dynamic segments: /api/tools/${...} -> /api/tools/:id ; strip template tails
    route = route.replace(/\$\{[^}]*\}/g, ':id');
    route = route.replace(/\/:id(\/:id)+/g, '/:id');
    // Drop trailing /:id/cancel -> keep full shape (cancel is a distinct route)
    found.add(route);
  }
  return [...found];
}

test('API inventory document exists and classifies the full bridge surface', () => {
  assert.ok(fs.existsSync(INVENTORY), 'Docs/API-INVENTORY.md must exist');
  const doc = read(INVENTORY);
  const routeHits = doc.match(/^\| (GET|POST|PUT|DELETE|PATCH|OPTIONS) \| `\/api\//gm) ?? [];
  assert.ok(routeHits.length >= 48, `inventory must classify >=48 routes, found ${routeHits.length}`);
  for (const must of [
    '`/api/health`',
    '`/api/tools`',
    '`/api/runs`',
    '`/api/runs/:id`',
    '`/api/runs/:id/cancel`',
    '`/api/duplicates/jobs`',
    '`/api/duplicates/engine-quarantine`',
    '`/api/sonar/export`',
    '`/api/ai/generate`',
    '`/api/mcp/contract`',
    '`/api/mcp/verify`',
    '`/api/auth/status`',
    'RENDERER_KEY_NOT_ACCEPTED',
  ]) {
    assert.ok(doc.includes(must), `inventory must document ${must}`);
  }
});

test('every /api/* route consumed by the renderer is inventory-classified', () => {
  const doc = read(INVENTORY);
  const consumers = [
    read(path.join(webRoot, 'src', 'lib', 'api.ts')),
    read(path.join(webRoot, 'src', 'lib', 'mcp.ts')),
  ].join('\n');
  const routes = apiLiterals(consumers);
  assert.ok(routes.length >= 30, `expected >=30 renderer-consumed routes, found ${routes.length}`);
  const missing = routes.filter((r) => {
    const base = r.replace(/\/:id$/, '');
    // inventory documents parametric routes with :id placeholders or the literal prefix
    return !doc.includes(`\`${r}\``) && !doc.includes(`\`${base}\``) && !doc.includes(r.split('/:id')[0]);
  });
  assert.deepEqual(missing, [], `renderer consumes unclassified routes: ${missing.join(', ')}`);
});

test('renderer secret boundary holds: no renderer-supplied provider keys', () => {
  const srcFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.(tsx?|mjs|mts)$/.test(entry.name)) srcFiles.push(full);
    }
  };
  walk(path.join(webRoot, 'src'));
  const hits = [];
  for (const file of srcFiles) {
    const text = read(file);
    if (/customApiKey/.test(text)) hits.push(`${path.relative(webRoot, file)}:customApiKey`);
    if (/localStorage\s*\.\s*setItem\s*\(\s*['"][^'"]*(api[_-]?key|secret|token)[^'"]*['"]/i.test(text)) {
      hits.push(`${path.relative(webRoot, file)}:secret-in-localStorage`);
    }
  }
  assert.deepEqual(hits, [], `renderer secret boundary violated: ${hits.join(', ')}`);
  const bridgeCore = read(path.join(webRoot, 'server', 'bridge-core.mjs'));
  assert.match(bridgeCore, /RENDERER_KEY_NOT_ACCEPTED/, 'bridge must reject renderer-supplied keys');
});

test('no static proven-availability claims for AI catalog', () => {
  const hub = read(path.join(webRoot, 'src', 'components', 'OpenCodeZenHub.tsx'));
  assert.doesNotMatch(hub, /FREE PRODUCTION AI MODELS/);
  assert.match(hub, /CATALOG ONLY|Catalog only/);
  assert.match(hub, /Configured does not mean available/);
});
