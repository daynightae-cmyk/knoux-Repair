/**
 * AI Scan ask-flow integration tests (pure reducer layer).
 *
 * Covers the true consent path with a mocked provider:
 *   - entering consent, choosing a provider, sending the snapshot question
 *   - successful answer displayed with real text / model / provider / duration
 *   - editing the question revokes consent (no resend under stale consent)
 *   - provider not configured → unconfigured
 *   - provider 502 → failed with real code and duration
 *   - provider abort / bridge timeout → timeout
 *   - bridge Origin or Bridge Token rejection → failed (never silently retried)
 *   - retry resends the same snapshot question (never a new question)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ASK_INITIAL,
  askConsentSnapshot,
  askReduce,
  askStateFromError,
  aiAskAvailable,
  buildConsentPlan,
  consentedModelId,
  formatDuration,
  normalizeAnswer,
} from '../src/lib/aiAskState.ts';

const catalog = [
  { id: 'gemini-3.8-flash', provider: 'google', label: 'Gemini 3.8 Flash (Google AI Studio)' },
  { id: 'deepseek/deepseek-r1:free', provider: 'openrouter', label: 'DeepSeek R1 (OpenRouter)' },
];

const flags = { hasGeminiKey: true, hasOpenRouterKey: true };

test('askConsentSnapshot gates on configured provider and server catalog', () => {
  const ok = askConsentSnapshot(catalog, flags, 'google', 'why is my disk full');
  assert.equal(ok.error, undefined);
  assert.equal(ok.ok.question, 'why is my disk full');
  assert.equal(ok.ok.provider, 'google');
  assert.equal(ok.ok.modelId, 'gemini-3.8-flash');

  // Empty question cannot be consented.
  assert.equal(askConsentSnapshot(catalog, flags, 'google', '').error, 'emptyQuestion');

  // No configured key → unconfigured.
  assert.equal(askConsentSnapshot(catalog, { hasGeminiKey: false, hasOpenRouterKey: false }, 'google', 'q').error, 'unconfigured');

  // Provider without a key → unconfigured.
  assert.equal(askConsentSnapshot(catalog, { hasGeminiKey: false, hasOpenRouterKey: true }, 'google', 'q').error, 'unconfigured');

  // Catalog has no entry for the provider → refuses instead of inventing a model id.
  assert.equal(askConsentSnapshot([], flags, 'openrouter', 'q').error, 'noModel');
});

test('consent → choose provider → generating, snapshot holds question + provider + model', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'slow RAM' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  assert.equal(state.status, 'needs-consent');

  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  assert.equal(state.status, 'generating');
  assert.equal(state.snapshot?.question, 'slow RAM');
  assert.equal(state.snapshot?.provider, 'google');
  assert.equal(state.snapshot?.modelId, 'gemini-3.8-flash');
});

test('editing the question revokes consent (no stale resend)', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'first question' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  assert.equal(state.status, 'generating');

  // Editing mid-flight revokes consent; its late response must be ignored.
  const obsoleteRequestId = state.requestId;
  state = askReduce(state, { type: 'SET_QUESTION', question: 'edited question' });
  assert.equal(state.status, 'idle');
  assert.equal(state.question, 'edited question');
  assert.equal(state.snapshot, null);
  state = askReduce(state, { type: 'RECEIVE_ANSWER', requestId: obsoleteRequestId, answer: normalizeAnswer({ text: 'obsolete answer' }, 50) });
  assert.equal(state.status, 'idle');
  assert.equal(state.answer, null);

  // Editing while waiting for consent revokes consent entirely.
  const revoked = askReduce(askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'q' }), { type: 'ENTER_CONSENT' });
  const afterEdit = askReduce(revoked, { type: 'SET_QUESTION', question: 'q2' });
  assert.equal(afterEdit.status, 'idle');
  assert.equal(afterEdit.snapshot, null);
  assert.equal(afterEdit.question, 'q2');
});

test('successful mock provider response → answered with real fields', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'RAM usage' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  const started = Date.now();
  const res = { ok: true, model: 'gemini-3.8-flash', provider: 'google', text: 'Close browser tabs.', codeSnippets: [], executionTimeMs: 800 };
  state = askReduce(state, { type: 'RECEIVE_ANSWER', requestId: state.requestId, answer: normalizeAnswer(res, Date.now() - started) });
  assert.equal(state.status, 'answered');
  assert.equal(state.answer.text, 'Close browser tabs.');
  assert.equal(state.answer.model, 'gemini-3.8-flash');
  assert.equal(state.answer.provider, 'google');
  assert.equal(state.snapshot?.question, 'RAM usage');
});

test('mock provider returning no text → failed honestly, no fabricated answer', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'RAM usage' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  state = askReduce(state, { type: 'RECEIVE_ANSWER', requestId: state.requestId, answer: normalizeAnswer({ model: 'x', provider: 'google', text: '', codeSnippets: [], executionTimeMs: 10 }, 40) });
  assert.equal(state.status, 'failed');
  assert.equal(state.failure.code, 'AI_EMPTY_RESPONSE');
  assert.equal(state.answer, null);
});

test('provider 502 → failed with real code and duration', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'RAM usage' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'openrouter', modelId: 'deepseek/deepseek-r1:free' });
  state = askReduce(state, {
    type: 'RECEIVE_ERROR',
    requestId: state.requestId,
    failure: { code: 'AI_PROVIDER_ERROR', message: 'Provider returned error', durationMs: 903 },
    status: 'failed',
  });
  assert.equal(state.status, 'failed');
  assert.equal(state.failure.code, 'AI_PROVIDER_ERROR');
  assert.equal(state.failure.message, 'Provider returned error');
  assert.equal(state.failure.durationMs, 903);
  assert.equal(state.answer, null);
});

test('abort / timeout → timeout state (not a fabricated answer)', () => {
  const mapped = askStateFromError({ code: 'TIMEOUT', message: 'aborted', durationMs: 60000 });
  assert.equal(mapped.state, 'timeout');
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'diagnose network' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  state = askReduce(state, { type: 'RECEIVE_ERROR', requestId: state.requestId, failure: { code: mapped.code, message: mapped.message, durationMs: 60000 }, status: mapped.state });
  assert.equal(state.status, 'timeout');

  const byMessage = askStateFromError({ code: 'AI_PROVIDER_ERROR', message: 'The operation was aborted due to timeout', durationMs: 45000 });
  assert.equal(byMessage.state, 'timeout');
  state = askReduce(state, { type: 'RETRY' });
  assert.equal(state.status, 'generating');
  state = askReduce(state, { type: 'RECEIVE_ERROR', requestId: state.requestId, failure: { code: byMessage.code, message: byMessage.message, durationMs: 45000 }, status: byMessage.state });
  assert.equal(state.status, 'timeout');

  const byError = askStateFromError({ code: 'BRIDGE_UNREACHABLE', message: 'Failed to fetch' });
  assert.equal(byError.state, 'failed');
});

test('Origin or Bridge Token rejection → failed honestly (security boundary intact)', () => {
  const origin = askStateFromError({ code: 'ORIGIN_FORBIDDEN', message: 'The request origin is not an approved local KNOUX origin.', durationMs: 0 });
  assert.equal(origin.state, 'failed');
  assert.equal(origin.code, 'ORIGIN_FORBIDDEN');

  const token = askStateFromError({ code: 'BRIDGE_TOKEN_INVALID', message: 'A valid local bridge capability token is required.', durationMs: 0 });
  assert.equal(token.state, 'failed');
  assert.equal(token.code, 'BRIDGE_TOKEN_INVALID');
});

test('unconfigured provider → unconfigured state', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'is it working?' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  state = askReduce(state, {
    type: 'RECEIVE_ERROR',
    requestId: state.requestId,
    failure: { code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'no Google AI key', durationMs: 0 },
    status: 'unconfigured',
  });
  assert.equal(state.status, 'unconfigured');
});

test('aiAskAvailable is driven only by bridge provider state', () => {
  assert.equal(aiAskAvailable('CONFIGURED'), true);
  assert.equal(aiAskAvailable('UNCONFIGURED'), false);
  assert.equal(aiAskAvailable('ERROR'), false);
  assert.equal(aiAskAvailable('CHECKING'), false);
  assert.equal(aiAskAvailable('UNAVAILABLE'), false);
});

test('consent plan mirrors live catalog flags (model ids come from catalog)', () => {
  const plan = buildConsentPlan(catalog, flags);
  assert.deepEqual(plan.choices.map(c => [c.id, c.enabled]), [['google', true], ['openrouter', true]]);
  const onlyGoogle = buildConsentPlan(catalog, { hasGeminiKey: true, hasOpenRouterKey: false });
  assert.equal(onlyGoogle.choices[0].enabled, true);
  assert.equal(onlyGoogle.choices[1].enabled, false);
});

test('consentedModelId never invents an id outside the catalog', () => {
  assert.equal(consentedModelId(catalog, 'google'), 'gemini-3.8-flash');
  assert.equal(consentedModelId(catalog, 'openrouter'), 'deepseek/deepseek-r1:free');
  assert.equal(consentedModelId([], 'google'), null);
});

test('retry resends the same snapshot question', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'disk space' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  state = askReduce(state, {
    type: 'RECEIVE_ERROR',
    requestId: state.requestId,
    failure: { code: 'AI_PROVIDER_ERROR', message: 'Provider returned error', durationMs: 329 },
    status: 'failed',
  });
  assert.equal(state.status, 'failed');
  const original = structuredClone(state.snapshot);
  const obsoleteRequestId = state.requestId;
  state = askReduce(state, { type: 'RETRY' });
  assert.equal(state.status, 'generating');
  assert.deepEqual(state.snapshot, original); // exact question + provider + model survive retry
  assert.ok(state.requestId > obsoleteRequestId);
  state = askReduce(state, { type: 'RECEIVE_ANSWER', requestId: obsoleteRequestId, answer: normalizeAnswer({ text: 'stale' }, 100) });
  assert.equal(state.status, 'generating'); // previous request cannot overwrite a retry
});

test('formatDuration is honest for real and invalid durations', () => {
  assert.equal(formatDuration(0), '0.0s');
  assert.equal(formatDuration(1234), '1.2s');
  assert.equal(formatDuration(-5), '0.0s');
  assert.equal(formatDuration(Number.NaN), '0.0s');
});

test('consent is mandatory and retry cannot substitute a changed question', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'original' });
  assert.equal(askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' }), state);
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'google', modelId: 'gemini-3.8-flash' });
  const previousId = state.requestId;
  state = askReduce(state, { type: 'RECEIVE_ERROR', requestId: previousId, failure: { code: 'AI_PROVIDER_ERROR', message: 'failed', durationMs: 10 }, status: 'failed' });
  state = askReduce(state, { type: 'SET_QUESTION', question: 'different' });
  assert.equal(state.status, 'idle');
  assert.equal(state.snapshot, null);
  assert.equal(askReduce(state, { type: 'RETRY' }), state);
});

test('reset clears question, invalidates running request, and ignores late answer/error', () => {
  let state = askReduce(ASK_INITIAL, { type: 'SET_QUESTION', question: 'reset me' });
  state = askReduce(state, { type: 'ENTER_CONSENT' });
  state = askReduce(state, { type: 'CHOOSE_PROVIDER', provider: 'openrouter', modelId: 'deepseek/deepseek-r1:free' });
  const staleId = state.requestId;
  state = askReduce(state, { type: 'RESET' });
  assert.equal(state.question, '');
  assert.equal(state.snapshot, null);
  assert.equal(state.status, 'idle');
  assert.ok(state.requestId > staleId);
  state = askReduce(state, { type: 'RECEIVE_ANSWER', requestId: staleId, answer: normalizeAnswer({ text: 'late' }, 300) });
  state = askReduce(state, { type: 'RECEIVE_ERROR', requestId: staleId, status: 'failed', failure: { code: 'STALE', message: 'late', durationMs: 300 } });
  assert.equal(state.status, 'idle');
  assert.equal(state.answer, null);
  assert.equal(state.failure, null);
});
