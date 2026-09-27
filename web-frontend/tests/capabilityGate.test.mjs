/**
 * KNOUX REPAIR — runtime capability gate.
 *
 * `Reports/100-Tool-Functional-Verification.csv` is the authoritative record of
 * what actually ran. 19 of the 158 canonical ToolIds timed out in AnalyzeOnly
 * and are recorded UNVERIFIED. An unverified tool may still be analysed — that
 * changes nothing — but its change action must not be offered, because the
 * product cannot prove it works.
 *
 * These tests keep `UNVERIFIED_TOOL_IDS` from drifting away from the CSV, and
 * prove the gate has no loophole: the run itself is refused, not just the
 * button.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  UNVERIFIED_TOOL_IDS,
  isRuntimeVerified,
  isMutatingRisk,
  classifyExposure,
  canExposeAction,
  exposureBlockReason,
  exposeTools,
  partitionForExposure,
} from '../src/features/stations/_shared/capabilityGate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(resolve(here, '..', '..', rel), 'utf8');

/** Minimal RFC4180 reader — the CSV has quoted fields with embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
  return body.filter(r => r.length > 0).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const csvPath = 'Reports/100-Tool-Functional-Verification.csv';

test('the gate constant matches the authoritative CSV exactly', () => {
  const rows = parseCsv(read(csvPath));
  assert.equal(rows.length, 158, 'the verification CSV must still cover all 158 canonical tools');
  const unverified = rows.filter(r => r.Status === 'UNVERIFIED').map(r => r.ToolId).sort();
  assert.deepEqual(
    [...UNVERIFIED_TOOL_IDS].sort(),
    unverified,
    'UNVERIFIED_TOOL_IDS drifted from the authoritative verification CSV'
  );
});

test('every canonical ToolId is either verified or explicitly unverified', () => {
  const rows = parseCsv(read(csvPath));
  const statuses = new Set(rows.map(r => r.Status));
  for (const row of rows) {
    assert.ok(
      row.Status === 'PASS' || row.Status === 'UNVERIFIED',
      `${row.ToolId} has an unknown verification status: ${row.Status}`
    );
  }
  assert.equal(statuses.size, 2, `unexpected verification statuses: ${[...statuses].join(', ')}`);
});

test('an unproven READ_ONLY tool stays available for analysis', () => {
  const tool = { ToolId: 'SW08', RiskLevel: 'READ_ONLY' };
  assert.equal(isRuntimeVerified('SW08'), false);
  assert.equal(isMutatingRisk(tool), false);
  assert.equal(classifyExposure(tool), 'implemented-but-runtime-unverified');
  // Analysis and preview change nothing, so hiding them would be over-caution.
  assert.equal(canExposeAction(tool, 'analyze'), true);
  assert.equal(canExposeAction(tool, 'preview'), true);
  assert.equal(canExposeAction(tool, 'run'), true, 'a read-only run changes nothing');
  assert.equal(exposeTools([tool]).length, 1);
});

test('an unproven mutating tool has its change action withheld', () => {
  for (const [id, risk] of [['DF02', 'DESTRUCTIVE'], ['PA03', 'DESTRUCTIVE'], ['SC03', 'SAFE_CLEANUP'], ['DF10', 'SAFE_CLEANUP']]) {
    const tool = { ToolId: id, RiskLevel: risk };
    assert.equal(classifyExposure(tool), 'mutation-hidden-pending-proof', id);
    assert.equal(canExposeAction(tool, 'run'), false, `${id} run must be withheld`);
    assert.equal(canExposeAction(tool, 'analyze'), true, `${id} analysis must remain available`);
    assert.equal(canExposeAction(tool, 'preview'), true, `${id} preview must remain available`);
    assert.ok(exposureBlockReason(tool, 'run'), `${id} must explain why it is withheld`);
    assert.equal(exposureBlockReason(tool, 'analyze'), null);
  }
});

test('a verified tool is never withheld, whatever its risk', () => {
  for (const [id, risk] of [['SM02', 'SYSTEM_REPAIR'], ['BR05', 'DESTRUCTIVE'], ['DV03', 'SYSTEM_REPAIR'], ['SW06', 'DESTRUCTIVE']]) {
    const tool = { ToolId: id, RiskLevel: risk };
    assert.equal(isRuntimeVerified(id), true, id);
    assert.equal(classifyExposure(tool), 'implemented-and-exposed', id);
    assert.equal(canExposeAction(tool, 'run'), true, id);
    assert.equal(exposureBlockReason(tool, 'run'), null);
  }
});

test('a withheld tool disappears from every customer-visible catalog', () => {
  const tools = [
    { ToolId: 'DF01', RiskLevel: 'READ_ONLY' },
    { ToolId: 'DF02', RiskLevel: 'DESTRUCTIVE' },
    { ToolId: 'DF10', RiskLevel: 'SAFE_CLEANUP' },
    { ToolId: 'DF09', RiskLevel: 'READ_ONLY' },
  ];
  const { exposed, withheld } = partitionForExposure(tools);
  assert.deepEqual(exposed.map(t => t.ToolId), ['DF01', 'DF09']);
  assert.deepEqual(withheld.map(t => t.ToolId), ['DF02', 'DF10']);
  assert.equal(exposeTools(tools).length, 2);
});

test('the run itself is refused, so no code path can bypass the hidden button', async () => {
  const controller = read('web-frontend/src/features/stations/_shared/StationExecutionController.ts');
  // A hidden button is a UI convention. The guarantee has to live at the
  // execution boundary, where every station, rail, catalog and shortcut funnels.
  assert.match(controller, /import \{ exposureBlockReason \} from '\.\/capabilityGate'/);
  assert.match(controller, /assertExposurePermits\(inputOrTool, canonicalMode\)/);
  assert.match(controller, /assertExposurePermits\(inputOrTool\.tool, canonicalMode\)/);
  assert.match(controller, /error\.code = 'CAPABILITY_WITHHELD'/);
  assert.match(controller, /if \(!reason\) return;/);
});

test('the global action rail and launch path honour the gate', () => {
  const serviceApps = read('web-frontend/src/components/ServiceApps.tsx');
  // The explicit .ts extension is required so Node's strip-types loader can
  // resolve this module from a test without a bundler.
  assert.match(serviceApps, /import \{ canExposeAction, exposeTools \} from '\.\.\/features\/stations\/_shared\/capabilityGate(?:\.ts)?'/);
  assert.match(serviceApps, /const actions = exposeTools\(tools\)\.slice\(0, 4\)/);
  // The launch path must consult the gate, not just the rail.
  assert.match(serviceApps, /if \(!canExposeAction\(tool, normalizeExecutionMode\(mode\)\)\) return;/);
});

test('a blocked run reports a distinct code, not a generic failure', () => {
  const reason = exposureBlockReason(
    { ToolId: 'DF02', RiskLevel: 'DESTRUCTIVE', EnglishName: 'Quarantine Duplicates', ArabicName: '' },
    'run'
  );
  assert.ok(reason);
  assert.match(reason, /Quarantine Duplicates/);
  assert.match(reason, /withheld/);
  // A user must be able to tell "we are protecting you" from "it broke".
  assert.doesNotMatch(reason, /error|failed|exception/i);
});
