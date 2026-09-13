import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeExecutionMode,
  isTerminalRunStatus,
  pollUntilTerminalRun,
  requestConfirmedCancel,
  outcomeLabelForStatus,
  historyMessageForTerminal,
  rememberRun,
  recallRun,
  forgetRun,
} from '../src/features/stations/_shared/executionSemantics.ts';

function stubRun(status, extra = {}) {
  return { status, lines: [], toolId: 'PI03', error: null, result: null, ...extra };
}

function sequenceFetcher(statuses) {
  const calls = [];
  return {
    calls,
    fetchRun: async (runId) => {
      calls.push(runId);
      const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
      return { run: stubRun(status) };
    },
  };
}

test('running responses are never treated as completion', async () => {
  const stub = sequenceFetcher(['running', 'running', 'success']);
  const ticks = [];
  const run = await pollUntilTerminalRun('run-1', {
    intervalMs: 1,
    fetchRun: stub.fetchRun,
    onTick: (r) => ticks.push(r.status),
  });
  assert.equal(run.status, 'success');
  assert.equal(stub.calls.length, 3, 'must keep polling while the backend reports running');
  assert.deepEqual(ticks, ['running', 'running', 'success']);
});

test('terminal success / failed / inconclusive states resolve as-is', async () => {
  for (const status of ['success', 'error', 'cancelled', 'inconclusive']) {
    const stub = sequenceFetcher([status]);
    const run = await pollUntilTerminalRun('run-x', { intervalMs: 1, fetchRun: stub.fetchRun });
    assert.equal(run.status, status);
    assert.equal(stub.calls.length, 1);
  }
});

test('isTerminalRunStatus distinguishes running from every terminal state', () => {
  assert.equal(isTerminalRunStatus('running'), false);
  for (const status of ['success', 'error', 'cancelled', 'inconclusive']) {
    assert.equal(isTerminalRunStatus(status), true, `${status} must be terminal`);
  }
});

test('outcome labels never promote non-success to success', () => {
  assert.equal(outcomeLabelForStatus('success'), 'success');
  assert.equal(outcomeLabelForStatus('error'), 'error');
  assert.equal(outcomeLabelForStatus('cancelled'), 'cancelled');
  assert.equal(outcomeLabelForStatus('inconclusive'), 'inconclusive');
  assert.equal(outcomeLabelForStatus('running'), 'inconclusive');
  assert.equal(outcomeLabelForStatus('queued'), 'inconclusive');
  assert.equal(outcomeLabelForStatus(undefined), 'inconclusive');
});

test('missing result/evidence becomes inconclusive or error, never success', () => {
  const message = historyMessageForTerminal('inconclusive', 'DS01', null);
  assert.match(message, /inconclusive/i);
  assert.doesNotMatch(message, /successfully|completed/i);
  const failed = historyMessageForTerminal('error', 'DS01', null);
  assert.match(failed, /failed/i);
  const cancelled = historyMessageForTerminal('cancelled', 'DS01', null);
  assert.match(cancelled, /cancelled/i);
});

test('aborting client polling claims nothing about the backend run', async () => {
  const stub = sequenceFetcher(['running', 'running', 'running']);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    pollUntilTerminalRun('run-abort', { intervalMs: 1, fetchRun: stub.fetchRun, signal: controller.signal }),
    (error) => {
      assert.equal(error.code, 'POLL_CANCELLED');
      return true;
    }
  );
  assert.equal(stub.calls.length, 0, 'a pre-aborted poll must not even observe, let alone conclude');
});

test('cancel request followed by backend-confirmed cancellation resolves cancelled', async () => {
  let cancelCalls = 0;
  const stub = sequenceFetcher(['running', 'cancelled']);
  const run = await requestConfirmedCancel('run-cancel', {
    intervalMs: 1,
    requestCancel: async () => {
      cancelCalls += 1;
    },
    fetchRun: stub.fetchRun,
  });
  assert.equal(cancelCalls, 1, 'exactly one real cancellation request must be sent');
  assert.equal(run.status, 'cancelled');
});

test('a tool that finishes first is reported as finished, never rewritten to cancelled', async () => {
  const stub = sequenceFetcher(['success']);
  const run = await requestConfirmedCancel('run-late-cancel', {
    intervalMs: 1,
    requestCancel: async () => {},
    fetchRun: stub.fetchRun,
  });
  assert.equal(run.status, 'success', 'a late cancel must not rewrite a terminal success');
  assert.equal(outcomeLabelForStatus(run.status), 'success');
});

test('unconfirmed cancellation throws CANCEL_FAILED instead of reporting CANCELLED', async () => {
  const stub = sequenceFetcher(['running', 'running', 'running']);
  await assert.rejects(
    requestConfirmedCancel('run-no-confirm', {
      intervalMs: 1,
      timeoutMs: 5,
      requestCancel: async () => {},
      fetchRun: stub.fetchRun,
    }),
    (error) => {
      assert.equal(error.code, 'CANCEL_FAILED');
      assert.ok(error.run, 'the last observed run must travel with the failure for continued monitoring');
      assert.equal(error.run.status, 'running');
      return true;
    }
  );
});

test('rejected cancellation request throws CANCEL_FAILED without claiming anything', async () => {
  const stub = sequenceFetcher(['running']);
  await assert.rejects(
    requestConfirmedCancel('run-rejected', {
      intervalMs: 1,
      requestCancel: async () => {
        throw new Error('RUN_NOT_FOUND');
      },
      fetchRun: stub.fetchRun,
    }),
    (error) => {
      assert.equal(error.code, 'CANCEL_FAILED');
      return true;
    }
  );
  assert.equal(stub.calls.length, 0, 'a rejected cancel must not be followed by fabricated observation claims');
});

test('execution mode aliases normalize to canonical bridge modes', () => {
  assert.equal(normalizeExecutionMode('analyze'), 'analyze');
  assert.equal(normalizeExecutionMode('AnalyzeOnly'), 'analyze');
  assert.equal(normalizeExecutionMode('preview'), 'preview');
  assert.equal(normalizeExecutionMode('WhatIf'), 'preview');
  assert.equal(normalizeExecutionMode('run'), 'run');
  assert.equal(normalizeExecutionMode('Execute'), 'run');
  assert.equal(normalizeExecutionMode('repair'), 'run');
  assert.equal(normalizeExecutionMode('unexpected-future-mode'), 'run');
});

test('orphan-run registry remembers, recalls, and forgets per station', () => {
  forgetRun('station-test');
  assert.equal(recallRun('station-test'), null);
  rememberRun({ runId: 'run-orphan', toolId: 'PI03', toolName: 'Essential Apps Catalog', stationKey: 'station-test', startedAt: 1 });
  const recalled = recallRun('station-test');
  assert.equal(recalled.runId, 'run-orphan');
  assert.equal(recalled.toolId, 'PI03');
  forgetRun('station-test');
  assert.equal(recallRun('station-test'), null, 'settled runs must leave no orphan behind');
});
