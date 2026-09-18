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
const css = readWeb('src/engineering-visual-polish.css');
const developer = readWeb('src/features/stations/station12/DeveloperStation.tsx');
const sonar = readWeb('src/features/stations/station18/ProjectSonarStation.tsx');
const operational = readWeb('src/workbench-developer-operational.css');

test('Engineering polish loads after Software Library authority', () => {
  const software = main.indexOf("./software-library-visual-polish.css");
  const engineering = main.indexOf("./engineering-visual-polish.css");
  assert.ok(software >= 0);
  assert.ok(engineering > software);
});

test('Developer Tools and Project Sonar own isolated visual scopes', () => {
  assert.match(css, /data-service-id='12-Developer-Tools'/);
  assert.match(css, /data-service-id='18-Project-Sonar'/);
  assert.doesNotMatch(css, /\.knoux-home(?:\s|\{|__|-)/);
});

test('Engineering polish preserves Explorer and RUN STATE ownership', () => {
  assert.match(css, /Explorer and RUN STATE are station-owned engineering controls/);
  assert.match(css, /\.knoux-deck-explorer/);
  assert.match(css, /\.knoux-deck-side/);
  assert.doesNotMatch(css, /\.knoux-deck-explorer[^\{]*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css, /\.knoux-deck-side[^\{]*\{[^}]*display:\s*none/);
  assert.match(operational, /grid-template-columns:\s*11rem minmax\(0, 1fr\) 12\.5rem/);
});

test('Developer Tools exposes premium action card hooks without changing execution ownership', () => {
  assert.match(developer, /developer-tool-grid/);
  assert.match(developer, /developer-tool-card/);
  assert.match(developer, /handleLaunchTool\(tool, 'analyze'\)/);
  assert.match(developer, /handleLaunchTool\(tool, 'run'\)/);
  assert.match(css, /developer-tool-card[\s\S]*linear-gradient/);
});

test('Project Sonar preserves evidence-backed radar and tool cards', () => {
  assert.match(sonar, /project-sonar-station-root/);
  assert.match(sonar, /SonarHeroVisual/);
  assert.match(sonar, /tools-list-grid/);
  assert.match(sonar, /tool-run-status/);
  assert.match(css, /overview-hero-layout[\s\S]*radial-gradient/);
  assert.match(css, /project-sonar-station-root[\s\S]*tool-card:hover/);
});

test('Engineering polish does not fabricate project or developer health values', () => {
  assert.doesNotMatch(css, /(?:score|health|readiness)\s*:\s*100/i);
  assert.doesNotMatch(css, /--(?:health|score|readiness)/i);
});

test('Engineering polish keeps responsive and reduced-motion fallbacks', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
