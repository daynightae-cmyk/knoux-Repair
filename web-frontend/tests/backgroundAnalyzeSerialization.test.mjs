import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(HERE, '..', 'src', 'features', 'stations', '_shared', 'StationExecutionController.ts'),
  'utf8',
);

test('background analyze starts are serialized against the bridge single-run contract', () => {
  assert.match(source, /let backgroundAnalyzeTail: Promise<void> = Promise\.resolve\(\)/);
  assert.match(source, /await predecessor;/);
  assert.match(source, /await pollUntilTerminalRun\(runId,/);
  assert.match(source, /backgroundAnalyzeTail = lifecycle\.then/);
});

test('StrictMode duplicate background probes share the same ToolId start promise', () => {
  assert.match(source, /const backgroundAnalyzeStarts = new Map<string, Promise<string>>\(\)/);
  assert.match(source, /const duplicate = backgroundAnalyzeStarts\.get\(toolId\);/);
  assert.match(source, /if \(duplicate\) return duplicate;/);
  assert.match(source, /backgroundAnalyzeStarts\.delete\(toolId\);/);
});

test('serialization is limited to explicit read-only background analysis', () => {
  assert.match(source, /mode === 'analyze' && options\?\.analyzeOnly === true && !confirmation/);
  assert.match(source, /api\.startRun\(inputOrTool\.ToolId, canonicalMode, options \|\| \{\}, confirmation\)/);
  assert.match(source, /api\.startRun\(inputOrTool\.tool\.ToolId, canonicalMode, inputOrTool\.options \|\| \{\}, inputOrTool\.confirmation\)/);
});
