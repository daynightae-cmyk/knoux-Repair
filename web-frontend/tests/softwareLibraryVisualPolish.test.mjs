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
const css = readWeb('src/software-library-visual-polish.css');
const programs = readWeb('src/features/stations/station04/ProgramsStation.tsx');
const software = readWeb('src/features/stations/station16/SoftwareStation.tsx');
const postInstall = readWeb('src/features/stations/station17/PostInstallStation.tsx');
const evidenceScript = readWeb('scripts/capture-software-library-polish-evidence.mjs');

test('Software Library polish loads after Assurance authority', () => {
  const assurance = main.indexOf("./assurance-visual-polish.css");
  const softwarePolish = main.indexOf("./software-library-visual-polish.css");
  assert.ok(assurance >= 0);
  assert.ok(softwarePolish > assurance);
});

test('all Software Library services own isolated visual scopes', () => {
  for (const service of ['04-Programs-Applications', '16-Software-Environment', '17-PostInstall-Setup']) {
    assert.match(css, new RegExp(`data-service='${service}'`));
  }
  assert.match(css, /data-family='software'/);
  assert.doesNotMatch(css, /\.knoux-home(?:\s|\{|__|-)/);
});

test('Software polish preserves absolute workspace chrome', () => {
  assert.match(css, /\.knoux-workspace-stage[\s\S]*isolation:\s*isolate/);
  assert.match(css, /\.knoux-workspace-stage::before[\s\S]*z-index:\s*-1/);
  assert.doesNotMatch(css, /\.knoux-workspace-stage\s*>\s*\*\s*\{[\s\S]*position:\s*relative/);
});

test('Programs remains the canonical Application Studio', () => {
  assert.match(programs, /programs-station/);
  assert.match(programs, /programs-landing-canvas/);
  assert.match(programs, /programs-landing-primary-cta/);
  assert.match(css, /programs-landing-canvas[\s\S]*radial-gradient/);
});

test('Software Environment keeps runtime metrics and execution cards', () => {
  assert.match(software, /software-station-root/);
  assert.match(software, /metrics-grid/);
  assert.match(software, /tools-list-grid/);
  assert.match(software, /tool-run-status/);
  assert.match(css, /software-station-root[\s\S]*overview-hero-layout/);
  assert.match(css, /software-station-root[\s\S]*tool-card:hover/);
});

test('Post-Install keeps provisioning telemetry and action cards', () => {
  assert.match(postInstall, /post-install-station-root/);
  assert.match(postInstall, /metrics-grid/);
  assert.match(postInstall, /tools-list-grid/);
  assert.match(postInstall, /tool-run-status/);
  assert.match(css, /post-install-station-root[\s\S]*overview-hero-layout/);
  assert.match(css, /post-install-station-root[\s\S]*tool-card:hover/);
});

test('Software Library polish does not fabricate readiness or inventory values', () => {
  assert.doesNotMatch(css, /(?:score|readiness|installed|runtime)\s*:\s*100/i);
  assert.doesNotMatch(css, /--(?:health|score|readiness)/i);
});

test('Software Library action surfaces expose stable card hooks', () => {
  assert.match(programs, /program-repair-grid/);
  assert.match(programs, /program-repair-card/);
  assert.match(software, /tools-list-grid/);
  assert.match(software, /tool-card/);
  assert.match(postInstall, /tools-list-grid/);
  assert.match(postInstall, /tool-card/);
  assert.match(css, /program-repair-card[\s\S]*linear-gradient/);
});

test('Software Library evidence matches tab labels with numeric badge suffixes only', () => {
  assert.match(evidenceScript, /text === normalizedLabel/);
  assert.match(evidenceScript, /text\.startsWith\(normalizedLabel\)/);
  assert.match(evidenceScript, /\^\\d\+\$\/\.test\(suffix\)/);
  assert.doesNotMatch(evidenceScript, /text\.includes\(normalizedLabel\)/);
});

test('Software Library polish keeps responsive and reduced-motion fallbacks', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
