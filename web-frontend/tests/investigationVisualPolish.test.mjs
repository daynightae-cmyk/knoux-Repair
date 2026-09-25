import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = relative => fs.readFileSync(path.join(webRoot, relative), 'utf8');

const main = readWeb('src/main.tsx');
const css = readWeb('src/investigation-visual-polish.css');
const diagnostics = readWeb('src/features/stations/station10/DiagnosticsStation.tsx');
const services = readWeb('src/features/stations/station07/ServicesStation.tsx');
const operational = readWeb('src/investigation-workspace.css');

test('Investigation polish loads after Engineering authority', () => {
  const engineering = main.indexOf("./engineering-visual-polish.css");
  const investigation = main.indexOf("./investigation-visual-polish.css");
  assert.ok(engineering >= 0);
  assert.ok(investigation > engineering);
});

test('both Investigation stations own isolated visual scopes', () => {
  for (const service of ['10-Diagnostics-Reports', '07-Services-Processes']) {
    assert.match(css, new RegExp(`data-service='${service}'`));
  }
  assert.match(css, /data-family='investigation'/);
  assert.doesNotMatch(css, /\.knoux-home(?:\s|\{|__|-)/);
});

test('Investigation polish preserves absolute workspace chrome', () => {
  assert.match(css, /\.knoux-workspace-stage[\s\S]*isolation:\s*isolate/);
  assert.match(css, /\.knoux-workspace-stage::before[\s\S]*z-index:\s*-1/);
  assert.doesNotMatch(css, /\.knoux-workspace-stage\s*>\s*\*\s*\{[\s\S]*position:\s*relative/);
});

test('Diagnostics keeps evidence lab tabs and stable tool-card hooks', () => {
  assert.match(diagnostics, /diagnostic-evidence-station/);
  assert.match(diagnostics, /diagnostic-tool-grid/);
  assert.match(diagnostics, /diagnostic-tool-card/);
  assert.match(css, /diagnostic-tool-card[\s\S]*linear-gradient/);
  assert.match(operational, /flex-wrap:\s*wrap\s*!important/);
});

test('Services keeps topology and stable read-only evidence hooks', () => {
  assert.match(services, /services-topology-station/);
  assert.match(services, /data-readonly-tool="SP01"/);
  assert.match(services, /data-readonly-tool="SP02"/);
  assert.match(services, /data-services-evidence=/);
  assert.doesNotMatch(services, /services-operation-tool-grid|services-operation-tool-card/);
});

test('Investigation visual layer does not fabricate health or service values', () => {
  assert.doesNotMatch(css, /(?:health|score|running|stopped|critical)\s*:\s*100/i);
  assert.doesNotMatch(css, /--(?:health|score|service-count)/i);
});

test('Investigation polish keeps responsive and reduced-motion fallbacks', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
