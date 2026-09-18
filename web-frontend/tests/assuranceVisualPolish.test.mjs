import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const main = readWeb('src/main.tsx');
const css = readWeb('src/assurance-visual-polish.css');
const network = readWeb('src/features/stations/station03/NetworkStation.tsx');
const security = readWeb('src/features/stations/station09/SecurityStation.tsx');
const privacy = readWeb('src/features/stations/station13/PrivacyStation.tsx');
const drivers = readWeb('src/features/stations/station14/DriversStation.tsx');

test('Assurance polish loads after Recovery visual authority', () => {
  const recovery = main.indexOf("./recovery-storage-polish.css");
  const assurance = main.indexOf("./assurance-visual-polish.css");
  assert.ok(recovery >= 0);
  assert.ok(assurance > recovery);
});

test('all four Assurance services own isolated visual scopes', () => {
  for (const service of ['03-Network-Internet', '09-Security', '13-Privacy', '14-Driver-Management']) {
    assert.match(css, new RegExp(`data-service='${service}'`));
  }
  assert.match(css, /data-family='assurance'/);
  assert.doesNotMatch(css, /\.knoux-home(?:\s|\{|__|-)/);
});

test('Network keeps measured layer evidence and operational cards', () => {
  assert.match(network, /network-landing-canvas/);
  assert.match(network, /network-layers/);
  assert.match(network, /network-op/);
  assert.match(network, /network-history/);
  assert.match(css, /network-landing-canvas[\s\S]*radial-gradient/);
  assert.match(css, /network-op[\s\S]*linear-gradient/);
});

test('Security stays evidence-backed and does not invent a security score', () => {
  assert.match(security, /security-evidence-station/);
  assert.match(security, /toolStatuses\[t\.ToolId\]/);
  assert.match(css, /security-evidence-station[\s\S]*radial-gradient/);
  assert.doesNotMatch(css, /--(?:security-)?score\s*:/i);
  assert.doesNotMatch(css, /secure\s*:\s*100/i);
});

test('Privacy polish remains scoped to the canonical privacy station', () => {
  assert.match(privacy, /privacy-control-station/);
  assert.match(css, /privacy-control-station/);
  assert.doesNotMatch(css, /privacy[^\n]*100% secure/i);
});

test('Driver Management preserves the proven responsive tab matrix', () => {
  assert.match(drivers, /driver-matrix-station/);
  assert.match(css, /driver-matrix-station/);
  const operational = readWeb('src/assurance-workspace.css');
  assert.match(operational, /grid-template-columns:\s*repeat\(auto-fit, minmax\(118px, 1fr\)\)/);
});

test('Assurance polish does not pull absolute stage chrome into document flow', () => {
  assert.match(css, /\.knoux-workspace-stage[\s\S]*isolation:\s*isolate/);
  assert.match(css, /\.knoux-workspace-stage::before[\s\S]*z-index:\s*-1/);
  assert.doesNotMatch(css, /\.knoux-workspace-stage\s*>\s*\*\s*\{[\s\S]*position:\s*relative/);
});

test('Assurance action catalogs expose stable premium card hooks', () => {
  assert.match(security, /security-tool-grid/);
  assert.match(security, /security-tool-card/);
  assert.match(privacy, /privacy-tool-grid/);
  assert.match(privacy, /privacy-tool-card/);
  assert.match(drivers, /driver-tool-grid/);
  assert.match(drivers, /driver-tool-card/);
  assert.match(css, /privacy-tool-card[\s\S]*linear-gradient/);
  assert.match(css, /driver-tool-card[\s\S]*linear-gradient/);
});

test('Assurance polish keeps responsive and reduced-motion fallbacks', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
