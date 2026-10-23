/**
 * AI Scan ask-flow contract tests.
 *
 * Covers the pure decision layer (src/lib/aiAskState.ts) for:
 *   - local keyword routing (offline, deterministic)
 *   - ask-state gating by bridge AI provider availability
 *   - consent plan construction (model ids come from the catalog only)
 *   - successful-answer normalization (wrap a mock provider response)
 *   - failure mapping: failure vs timeout vs unconfigured
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aiAskAvailable,
  askStateFromError,
  buildConsentPlan,
  consentedModelId,
  formatDuration,
  normalizeAnswer,
  routeQueryToTarget,
} from '../src/lib/aiAskState.ts';

test('routeQueryToTarget keeps the deterministic offline keyword contract', () => {
  assert.equal(routeQueryToTarget('my pc feels slow'), 'performance');
  assert.equal(routeQueryToTarget('high memory usage'), 'performance');
  assert.equal(routeQueryToTarget('perf regressions everywhere'), 'performance');
  assert.equal(routeQueryToTarget('disk space is running low'), 'storage');
  assert.equal(routeQueryToTarget('clean junk files'), 'storage');
  assert.equal(routeQueryToTarget('is my defender on'), 'security');
  assert.equal(routeQueryToTarget('apps keep crashing'), 'software');
  assert.equal(routeQueryToTarget('my git repo build fails'), 'workbench');
  assert.equal(routeQueryToTarget('Something unclassifiable'), 'system');
  assert.equal(routeQueryToTarget('   '), 'system');
  assert.equal(routeQueryToTarget('الذاكرة ممتلئة'), 'system');
});

test('aiAskAvailable honors the bridge AI provider state', () => {
  assert.equal(aiAskAvailable('CONFIGURED'), true);
  assert.equal(aiAskAvailable('CHECKING'), false);
  assert.equal(aiAskAvailable('UNCONFIGURED'), false);
  assert.equal(aiAskAvailable('UNAVAILABLE'), false);
  assert.equal(aiAskAvailable('ERROR'), false);
});

test('buildConsentPlan only enables providers with configured keys', () => {
  const catalog = [
    { id: 'gemini-3.8-flash', provider: 'google', label: 'Gemini Flash (Google AI Studio)' },
    { id: 'google/gemma-4-31b-it:free', provider: 'openrouter', label: 'Gemma 4 31B IT (OpenRouter free)' },
  ];
  const both = buildConsentPlan(catalog, { hasGeminiKey: true, hasOpenRouterKey: true });
  assert.deepEqual(both.choices.map(c => [c.id, c.enabled]), [
    ['google', true],
    ['openrouter', true],
  ]);
  const geminiOnly = buildConsentPlan(catalog, { hasGeminiKey: true, hasOpenRouterKey: false });
  assert.deepEqual(geminiOnly.choices.map(c => c.enabled), [true, false]);
});

test('buildConsentPlan does not invent catalog labels', () => {
  const empty = buildConsentPlan([], { hasGeminiKey: true, hasOpenRouterKey: true });
  assert.equal(empty.choices[0].label, 'Gemini (Google AI Studio)');
  assert.equal(empty.choices[1].label, 'OpenRouter free models');
});

test('consentedModelId comes only from the server catalog', () => {
  const catalog = [{ id: 'gemini-3.8-flash', provider: 'google', label: 'Gemini Flash' }];
  assert.equal(consentedModelId(catalog, 'google'), 'gemini-3.8-flash');
  assert.equal(consentedModelId(catalog, 'openrouter'), null);
  assert.equal(consentedModelId([], 'google'), null);
});

test('normalizeAnswer wraps a mock successful provider response', () => {
  const mock = {
    ok: true,
    model: 'gemini-3.8-flash',
    provider: 'google',
    text: '  READY  ',
    codeSnippets: ['', 'Sub Test()\nEnd Sub'],
    executionTimeMs: 1234,
  };
  const answer = normalizeAnswer(mock, 2400);
  assert.equal(answer.text, 'READY');
  assert.equal(answer.model, 'gemini-3.8-flash');
  assert.equal(answer.provider, 'google');
  assert.deepEqual(answer.codeSnippets, ['Sub Test()\nEnd Sub']);
  assert.equal(answer.executionTimeMs, 1234);
  assert.equal(answer.durationMs, 2400);
});

test('normalizeAnswer degrades a null-text provider response to an empty answer', () => {
  const answer = normalizeAnswer({ model: 'x', provider: 'openrouter', text: null, codeSnippets: null }, 999);
  assert.equal(answer.text, '');
  assert.deepEqual(answer.codeSnippets, []);
  assert.equal(answer.durationMs, 999);
});

test('askStateFromError keeps failure, timeout and unconfigured distinct', () => {
  const plain = askStateFromError({ code: 'AI_PROVIDER_ERROR', message: 'Provider returned error' });
  assert.equal(plain.state, 'failed');
  assert.equal(plain.code, 'AI_PROVIDER_ERROR');

  const timeoutCode = askStateFromError({ code: 'TIMEOUT', message: 'aborted' });
  assert.equal(timeoutCode.state, 'timeout');

  const bridgeTimeout = askStateFromError({ code: 'AI_TIMEOUT', message: 'The AI provider did not respond within 110 seconds.' });
  assert.equal(bridgeTimeout.state, 'timeout');
  assert.equal(bridgeTimeout.code, 'AI_TIMEOUT');

  const abortedMsg = askStateFromError({ code: 'HTTP_ERROR', message: 'The operation was aborted due to timeout' });
  assert.equal(abortedMsg.state, 'timeout');

  const unreachable = askStateFromError({ code: 'BRIDGE_UNREACHABLE', message: 'Failed to fetch' });
  assert.equal(unreachable.state, 'failed');

  const notReady = askStateFromError({ code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'no Google AI key' });
  assert.equal(notReady.state, 'unconfigured');

  const nullish = askStateFromError(null);
  assert.equal(nullish.state, 'failed');
  assert.equal(nullish.code, 'AI_ASK_FAILED');
});

test('formatDuration is honest for real and invalid durations', () => {
  assert.equal(formatDuration(0), '0.0s');
  assert.equal(formatDuration(1234), '1.2s');
  assert.equal(formatDuration(60499), '60.5s');
  assert.equal(formatDuration(-5), '0.0s');
  assert.equal(formatDuration(Number.NaN), '0.0s');
});
