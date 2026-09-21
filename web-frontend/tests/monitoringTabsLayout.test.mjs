import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspace = fs.readFileSync(path.resolve(__dirname, '../src/vitality-workspace.css'), 'utf8');

test('System Monitoring keeps all eight station tabs inside the desktop workspace', () => {
  const scope = /data-service='15-System-Monitoring'[\s\S]*monitoring-observatory-station > div\[style\*='border-bottom: 1px solid'\]/;
  assert.match(workspace, scope);
  assert.match(workspace, /grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(workspace, /overflow-x:\s*visible\s*!important/);
  assert.match(workspace, /white-space:\s*normal\s*!important/);
  assert.match(workspace, /min-width:\s*0/);
});

test('System Monitoring collapses the tab grid before the station becomes cramped', () => {
  assert.match(workspace, /@media \(max-width: 1180px\)[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});
