import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isTerminalRunStatus,
  outcomeLabelForStatus,
  historyMessageForTerminal,
  rememberRun,
  recallRun,
  forgetRun,
} from '../src/features/stations/_shared/executionSemantics.ts';

// A prior run must never be presented as current live state: terminal runs
// are forgotten on settle, and terminal labels never read as running.
test('settled runs are forgotten and never re-surface as live running state', () => {
  const key = 'station-history-gate';
  forgetRun(key);
  assert.equal(recallRun(key), null);
  rememberRun({ runId: 'run-prior', toolId: 'SM01', toolName: 'Verify System Files', stationKey: key, startedAt: Date.now() });
  assert.equal(recallRun(key)?.runId, 'run-prior');
  forgetRun(key);
  assert.equal(recallRun(key), null, 'a settled/forgotten run must not leak into the next session as live state');
});

test('terminal outcomes keep their identity and never label as running', () => {
  for (const status of ['success', 'error', 'cancelled', 'inconclusive']) {
    assert.equal(isTerminalRunStatus(status), true);
    assert.doesNotMatch(outcomeLabelForStatus(status), /running/i, `${status} must not be labeled running`);
    assert.doesNotMatch(historyMessageForTerminal(status), /running/i, `${status} history must not claim running`);
  }
  assert.equal(isTerminalRunStatus('running'), false);
});

test('cancel and failure keep distinct attribution (never rewritten to success)', () => {
  assert.notEqual(outcomeLabelForStatus('cancelled'), outcomeLabelForStatus('success'));
  assert.notEqual(outcomeLabelForStatus('error'), outcomeLabelForStatus('success'));
  assert.notEqual(historyMessageForTerminal('cancelled'), historyMessageForTerminal('success'));
});
