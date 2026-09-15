import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const main = read('src/main.tsx');
const css = read('src/workbench-developer-operational.css');
const workbench = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');
const serviceApps = read('src/components/ServiceApps.tsx');

test('Developer operational finish loads after Anima so entered-workspace rules win the cascade', () => {
  const anima = main.indexOf("import './workbench-anima-finish.css'");
  const operational = main.indexOf("import './workbench-developer-operational.css'");
  assert.ok(anima >= 0, 'Anima finish import missing');
  assert.ok(operational > anima, 'Developer operational CSS must load after Anima');
});

test('Developer Tools removes repeated landing and generic outer chrome at the operational surface', () => {
  assert.match(css, /data-service-id='12-Developer-Tools'[\s\S]*?> \.knoux-deck-services[\s\S]*?display:\s*none/s);
  assert.match(css, /data-family='workbench'\]\[data-service='12-Developer-Tools'\][\s\S]*?> \.knoux-command-tool-rail[\s\S]*?display:\s*none/s);
  assert.match(css, /data-service-id='12-Developer-Tools'[\s\S]*?> \.knoux-deck-tabs[\s\S]*?display:\s*none/s);
});

test('Developer Tools keeps the canonical station embedded as the center runtime owner', () => {
  assert.match(serviceApps, /embedded\?: boolean/);
  assert.match(workbench, /<ServiceApps[\s\S]*activeSection=\{activeService\.legacySection\}[\s\S]*embedded/);
  assert.match(workbench, /data-zone="explorer"/);
  assert.match(workbench, /data-zone="center"/);
  assert.match(workbench, /data-zone="context"/);
});

test('Developer primary explorer is human-first and preserves ToolIds only as metadata', () => {
  assert.match(css, /data-service-id='12-Developer-Tools'[\s\S]*\.knoux-deck-explorer__tool-id\s*\{[\s\S]*?display:\s*none/s);
  assert.match(workbench, /data-tool-id=\{tool\.ToolId\}/);
});

test('1366-class desktop budget keeps the engineering center dominant', () => {
  assert.match(css, /@media \(max-width: 1450px\)[\s\S]*grid-template-columns:\s*9\.5rem minmax\(0, 1fr\) 11rem/s);
  assert.match(css, /@container knoux-deck \(max-width: 900px\)[\s\S]*grid-template-columns:\s*9rem minmax\(0, 1fr\)/s);
});
