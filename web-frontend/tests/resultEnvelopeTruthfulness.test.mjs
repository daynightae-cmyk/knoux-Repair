/**
 * KNOUX REPAIR — result-envelope truthfulness contract.
 *
 * Nine stations each grew their own `outcomeFromRun`. Four read only the
 * PascalCase aliases, two read only the canonical lowercase keys, and three
 * synthesised SUCCESS from a bare `exitCode === 0`. Every one of those turned a
 * successful run into a FAILED, a WARNING, or a fabricated count in the audit
 * trail. One tolerant reader now backs all of them; these tests hold it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  normalizeEnvelopeStatus,
  outcomeFromEnvelope,
  outcomeFromRunEnvelope,
  readEnvelopeField,
  readEnvelopeNumber,
  readEnvelopeBoolean,
  readEnvelopeText,
  buildStationHistoryRow,
} from '../src/features/stations/_shared/executionSemantics.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(resolve(here, '..', rel), 'utf8');

test('a canonical lowercase envelope never becomes a failure', () => {
  // The exact case that logged a successful recovery run as FAILED: `Status`
  // and `ExitCode` are undefined, so `ExitCode !== 0` was true.
  assert.equal(outcomeFromEnvelope({ status: 'Success', exitCode: 0 }), 'SUCCESS');
  assert.equal(outcomeFromEnvelope({ status: 'Warning', exitCode: 0 }), 'WARNING');
  assert.equal(outcomeFromEnvelope({ status: 'Cancelled', exitCode: 1 }), 'CANCELLED');
  assert.equal(outcomeFromEnvelope({ status: 'Failed', exitCode: 1 }), 'FAILED');
});

test('a legacy PascalCase envelope never becomes a warning', () => {
  // The exact case that logged a successful driver export as WARNING: status
  // resolved through its alias but `exitCode` was read from the lowercase key.
  assert.equal(outcomeFromEnvelope({ Status: 'Success', ExitCode: 0 }), 'SUCCESS');
  assert.equal(outcomeFromEnvelope({ Status: 'Warning', ExitCode: 0 }), 'WARNING');
  assert.equal(outcomeFromEnvelope({ Status: 'Cancelled', ExitCode: 1 }), 'CANCELLED');
  assert.equal(outcomeFromEnvelope({ Status: 'Failed', ExitCode: 2 }), 'FAILED');
});

test('an absent status is decided by a reported exit code, never guessed', () => {
  assert.equal(outcomeFromEnvelope({ exitCode: 0 }), 'SUCCESS');
  assert.equal(outcomeFromEnvelope({ exitCode: 3 }), 'FAILED');
  // No status AND no exit code is the one case that must not invent a result.
  assert.equal(outcomeFromEnvelope({}), 'INCONCLUSIVE');
  assert.equal(outcomeFromEnvelope(null), 'INCONCLUSIVE');
  assert.equal(outcomeFromEnvelope(undefined), 'INCONCLUSIVE');
});

test('cancelled is never collapsed into inconclusive', () => {
  for (const raw of ['Cancelled', 'CANCELED', 'cancelled', 'Aborted', 'Terminated']) {
    assert.equal(normalizeEnvelopeStatus(raw), 'CANCELLED', raw);
  }
});

test('an unreported count is null, never a fabricated zero', () => {
  assert.equal(readEnvelopeNumber({}, 'itemsProcessed'), null);
  assert.equal(readEnvelopeNumber({ status: 'Success' }, 'itemsProcessed'), null);
  assert.equal(readEnvelopeNumber({ itemsProcessed: 0 }, 'itemsProcessed'), 0);
  assert.equal(readEnvelopeNumber({ ItemsProcessed: 12 }, 'itemsProcessed'), 12);
  assert.equal(readEnvelopeNumber({ itemsProcessed: '7' }, 'itemsProcessed'), 7);
  assert.equal(readEnvelopeNumber({ itemsProcessed: 'not a number' }, 'itemsProcessed'), null);
  // A measured zero is a real fact and must survive the round trip.
  assert.notEqual(readEnvelopeNumber({ itemsProcessed: 0 }, 'itemsProcessed'), null);
});

test('boolean and text fields are equally tolerant and equally honest', () => {
  assert.equal(readEnvelopeBoolean({ changedSystem: false }, 'changedSystem'), false);
  assert.equal(readEnvelopeBoolean({ ChangedSystem: true }, 'changedSystem'), true);
  assert.equal(readEnvelopeBoolean({}, 'changedSystem'), null);
  assert.equal(readEnvelopeText({ reportPath: 'C:\\out\\report.md' }, 'reportPath'), 'C:\\out\\report.md');
  assert.equal(readEnvelopeText({ ReportPath: '' }, 'reportPath'), null);
  assert.equal(readEnvelopeText({}, 'reportPath'), null);
});

test('a field present only under its legacy alias is still found', () => {
  assert.equal(readEnvelopeField({ VerificationResult: 'verified' }, 'verificationResult'), 'verified');
  assert.equal(readEnvelopeField({ verificationResult: 'canonical' }, 'verificationResult'), 'canonical');
  // Canonical wins when both are present.
  assert.equal(readEnvelopeField({ status: 'canonical', Status: 'legacy' }, 'status'), 'canonical');
});

test('a run that never reached a terminal state is inconclusive regardless of its payload', () => {
  assert.equal(outcomeFromRunEnvelope({ status: 'running', result: { status: 'Success' } }), 'INCONCLUSIVE');
  assert.equal(outcomeFromRunEnvelope({ status: '' }), 'INCONCLUSIVE');
  assert.equal(outcomeFromRunEnvelope(null), 'INCONCLUSIVE');
  assert.equal(outcomeFromRunEnvelope({ status: 'success' }), 'SUCCESS');
  assert.equal(outcomeFromRunEnvelope({ status: 'success', result: { status: 'Warning', exitCode: 0 } }), 'WARNING');
  assert.equal(outcomeFromRunEnvelope({ status: 'success', result: { status: 'Inconclusive', exitCode: 0 } }), 'INCONCLUSIVE');
  assert.equal(outcomeFromRunEnvelope({ status: 'cancelled' }), 'CANCELLED');
  // A bridge-reported error with no usable result must not read as success.
  assert.equal(outcomeFromRunEnvelope({ status: 'error' }), 'INCONCLUSIVE');
  assert.equal(outcomeFromRunEnvelope({ status: 'error', result: { status: 'Failed', exitCode: 1 } }), 'FAILED');
  // Contradictory/stale payloads cannot promote a failed run back to success.
  assert.equal(outcomeFromRunEnvelope({ status: 'error', result: { status: 'Success', exitCode: 0 } }), 'FAILED');
});

test('the shared history row reports an unreported count as null and a real error verbatim', () => {
  const row = buildStationHistoryRow({
    toolId: 'BR01',
    toolName: 'Create Restore Point',
    result: { status: 'Success', ItemsProcessed: 3, ErrorMessage: 'Shadow copy storage nearly full' },
    successSummary: 'ok',
    failureSummary: 'failed',
    now: 1_700_000_000_000,
  });
  assert.equal(row.status, 'SUCCESS');
  assert.equal(row.itemsProcessed, 3);
  // A tool's own error message must not be replaced by a success sentence.
  assert.equal(row.summary, 'Shadow copy storage nearly full');
  assert.equal(row.timestamp, new Date(1_700_000_000_000).toISOString());
});

test('the shared history row is deterministic for the same injected instant', () => {
  const input = {
    toolId: 'DS01',
    toolName: 'Analyze Disk Space',
    result: { status: 'Success' },
    successSummary: 'ok',
    failureSummary: 'failed',
    now: 1_700_000_000_000,
  };
  assert.deepEqual(buildStationHistoryRow(input), buildStationHistoryRow(input));
});

test('no station model re-implements a single-casing envelope reader', () => {
  // The regression this file exists to prevent: a new station copying one of
  // the nine original readers.
  const models = [
    'station02/cleanupModel.ts',
    'station06/diskSpaceModel.ts',
    'station07/servicesModel.ts',
    'station08/performanceModel.ts',
    'station09/securityModel.ts',
    'station10/diagnosticsModel.ts',
    'station11/recoveryModel.ts',
    'station13/privacyModel.ts',
    'station14/driversModel.ts',
  ];
  for (const rel of models) {
    const source = read(`src/features/stations/${rel}`);
    assert.doesNotMatch(
      source,
      /result\.ExitCode !== 0/,
      `${rel} reads only the legacy ExitCode alias`
    );
    assert.doesNotMatch(
      source,
      /res\.exitCode === 0 \? 'SUCCESS'/,
      `${rel} synthesises SUCCESS from a bare exit code`
    );
    assert.doesNotMatch(
      source,
      /itemsProcessed \|\| 0/,
      `${rel} turns an unreported count into a fabricated zero`
    );
  }
});
