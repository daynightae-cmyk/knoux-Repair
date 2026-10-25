/**
 * Pure decision logic for the AI Scan free-text "ask KNOUX" flow.
 *
 * Two distinct user-facing actions are intentionally separated here:
 *  1. Local keyword routing — offline, deterministic, routes the typed issue
 *     to a known diagnostic target. It never claims anything about AI.
 *  2. The real AI answer flow — requires an explicit per-provider consent from
 *     the user, then a genuine bridge generate call. Its outcome is honestly
 *     reported as answered / failed / timeout / unconfigured; nothing is
 *     fabricated on failure.
 */

export type AiAskState = 'idle' | 'needs-consent' | 'generating' | 'answered' | 'failed' | 'timeout' | 'unconfigured';
export type AiProviderId = 'google' | 'openrouter';
export type AiProviderAvailability = 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';

export interface AiAskAnswer {
  text: string;
  model: string;
  provider: string;
  codeSnippets: string[];
  executionTimeMs: number;
  durationMs: number;
}

export interface AiAskFailure {
  code: string;
  message: string;
  durationMs: number;
}

export interface AiCatalogEntry {
  id: string;
  provider: AiProviderId;
  label: string;
}

export interface AiCatalogFlags {
  hasGeminiKey: boolean;
  hasOpenRouterKey: boolean;
}
/** Local keyword → diagnostic target routing (deterministic, offline). */
export function routeQueryToTarget(query: string): TargetId {
  const q = query.toLowerCase().trim();
  if (q.includes('ram') || q.includes('perf') || q.includes('slow') || q.includes('memory')) return 'performance';
  if (q.includes('disk') || q.includes('clean') || q.includes('space') || q.includes('junk')) return 'storage';
  if (q.includes('sec') || q.includes('virus') || q.includes('defender') || q.includes('protect')) return 'security';
  if (q.includes('soft') || q.includes('app') || q.includes('program')) return 'software';
  if (q.includes('dev') || q.includes('code') || q.includes('git') || q.includes('repo')) return 'workbench';
  return 'system';
}

export type TargetId = 'system' | 'performance' | 'storage' | 'security' | 'software' | 'workbench';

/**
 * Whether the free-text AI flow may be offered at all. AI provider state from
 * the bridge decides it; no key-related inference leaks into the UI itself.
 */
export function aiAskAvailable(aiProviderState: AiProviderAvailability): boolean {
  return aiProviderState === 'CONFIGURED';
}

/** The provider the user must have explicitly consented to before a send. */
export interface ConsentPlan {
  choices: Array<{ id: AiProviderId; label: string; enabled: boolean }>;
}

/**
 * Build the consent choices from the live catalog + bridge key flags.
 * The model id is always read from the server catalog (no UI hardcoding).
 * An empty catalog yields generic labels and no usable model id — the flow
 * then stays in needs-consent but refuses to send until the catalog loads.
 */
export function buildConsentPlan(catalog: AiCatalogEntry[], flags: AiCatalogFlags): ConsentPlan {
  const first = (provider: AiProviderId): string => {
    const entry = catalog.find(e => e.provider === provider);
    if (entry) return entry.label;
    return provider === 'google' ? 'Gemini (Google AI Studio)' : 'OpenRouter free models';
  };
  return {
    choices: [
      { id: 'google', label: first('google'), enabled: flags.hasGeminiKey },
      { id: 'openrouter', label: first('openrouter'), enabled: flags.hasOpenRouterKey },
    ],
  };
}

/** Which live-catalog entry backs a chosen provider (server-owned ids). */
export function firstCatalogModel(catalog: AiCatalogEntry[], provider: AiProviderId): string | undefined {
  return catalog.find(e => e.provider === provider)?.id;
}

/**
 * Truthful model id resolution. Never invents a model: without a catalog
 * entry the ask flow refuses to send at all.
 */
export function consentedModelId(catalog: AiCatalogEntry[], provider: AiProviderId): string | null {
  const entry = catalog.find(e => e.provider === provider);
  return entry && entry.id ? entry.id : null;
}

/** Normalize a successful bridge AiGenerateResponse into the ask answer card. */
export function normalizeAnswer(raw: { model?: string; provider?: string; text?: string; codeSnippets?: string[]; executionTimeMs?: number }, clientDurationMs: number): AiAskAnswer {
  const text = typeof raw?.text === 'string' ? raw.text : '';
  return {
    text: text.trim(),
    model: String(raw?.model || ''),
    provider: String(raw?.provider || ''),
    codeSnippets: Array.isArray(raw?.codeSnippets) ? raw.codeSnippets.filter(s => typeof s === 'string' && s.length > 0) : [],
    executionTimeMs: Number.isFinite(raw?.executionTimeMs) ? Number(raw?.executionTimeMs) : 0,
    durationMs: Number.isFinite(clientDurationMs) ? clientDurationMs : 0,
  };
}

/** Map a rejected generate call to an ask state. Timeout and abort are distinguished from plain failure. */
export function askStateFromError(err: { code?: string; message?: string } | null): { state: AiAskState; code: string; message: string } {
  const code = String(err?.code || 'AI_ASK_FAILED');
  const message = String(err?.message || 'The AI provider returned an error.');
  if (code === 'TIMEOUT' || code === 'AI_TIMEOUT' || /timeout|aborted|timed out|did not respond/i.test(message)) {
    return { state: 'timeout', code, message };
  }
  if (code === 'AI_PROVIDER_NOT_CONFIGURED') {
    return { state: 'unconfigured', code, message };
  }
  // ORIGIN_FORBIDDEN / BRIDGE_TOKEN_INVALID / AI_PROVIDER_ERROR / anything
  // else is an honest failure: no text is fabricated.
  return { state: 'failed', code, message };
}

/** Elapsed-time display for the frontier of honesty: real durations only. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Snapshot captured at the moment the user gives explicit consent. */
export interface AskSnapshot {
  question: string;
  provider: AiProviderId;
  modelId: string;
}

/** Pure ask-flow state. The component owns side effects (timer, fetch); this
 * reducer owns every state transition honestly: nothing is sent without a
 * consent snapshot, and a changed question revokes consent. */
export interface AskFlowState {
  status: AiAskState;
  question: string;
  snapshot: AskSnapshot | null;
  answer: AiAskAnswer | null;
  failure: AiAskFailure | null;
  /** Incremented for every new request or consent revocation; stale completions are ignored. */
  requestId: number;
}

export const ASK_INITIAL: AskFlowState = { status: 'idle', question: '', snapshot: null, answer: null, failure: null, requestId: 0 };

export type AskAction =
  | { type: 'SET_QUESTION'; question: string }
  | { type: 'ENTER_CONSENT' }
  | { type: 'REVOKE_CONSENT' }
  | { type: 'CHOOSE_PROVIDER'; provider: AiProviderId; modelId: string }
  | { type: 'RETRY' }
  | { type: 'RECEIVE_ANSWER'; answer: AiAskAnswer; requestId: number }
  | { type: 'RECEIVE_ERROR'; failure: AiAskFailure; status: AiAskState; requestId: number }
  | { type: 'RESET' };

export function askReduce(state: AskFlowState, action: AskAction): AskFlowState {
  switch (action.type) {
    case 'SET_QUESTION':
      if (action.question === state.question) return state;
      // Any edit revokes consent, including while a request is still running.
      // Its server request may complete, but it cannot update this question's UI.
      return { status: 'idle', question: action.question, snapshot: null, answer: null, failure: null, requestId: state.requestId + 1 };
    case 'ENTER_CONSENT':
      return state.status === 'idle' && state.question.trim()
        ? { ...state, status: 'needs-consent' }
        : state;
    case 'REVOKE_CONSENT':
      return { ...ASK_INITIAL, question: state.question, requestId: state.requestId + 1 };
    case 'CHOOSE_PROVIDER':
      if (state.status !== 'needs-consent' || !state.question.trim() || !action.modelId) return state;
      return {
        ...state,
        status: 'generating',
        snapshot: { question: state.question.trim(), provider: action.provider, modelId: action.modelId },
        answer: null,
        failure: null,
        requestId: state.requestId + 1,
      };
    case 'RETRY':
      // Retrying is a fresh user action for precisely the previously consented snapshot.
      // Never silently re-resolve the model from a changed catalog.
      if (!['failed', 'timeout'].includes(state.status) || !state.snapshot || state.snapshot.question !== state.question.trim()) return state;
      return { ...state, status: 'generating', answer: null, failure: null, requestId: state.requestId + 1 };
    case 'RECEIVE_ANSWER':
      if (state.status !== 'generating' || state.requestId !== action.requestId) return state;
      return {
        ...state,
        status: action.answer.text ? 'answered' : 'failed',
        answer: action.answer.text ? action.answer : null,
        failure: action.answer.text ? null : { code: 'AI_EMPTY_RESPONSE', message: 'The provider returned no text.', durationMs: action.answer.durationMs },
      };
    case 'RECEIVE_ERROR':
      if (state.status !== 'generating' || state.requestId !== action.requestId) return state;
      return { ...state, status: action.status, failure: action.failure, answer: null };
    case 'RESET':
      return { ...ASK_INITIAL, requestId: state.requestId + 1 };
    default:
      return state;
  }
}

/** Truthful consent gate: the chosen provider must be enabled (key
 * configured) and must have a model id in the server catalog. */
export function askConsentSnapshot(catalog: AiCatalogEntry[], flags: AiCatalogFlags, provider: AiProviderId, question: string): { ok: AskSnapshot } | { error: 'unconfigured' | 'emptyQuestion' | 'noModel' } {
  if (!question.trim()) return { error: 'emptyQuestion' };
  if (!flags.hasGeminiKey && !flags.hasOpenRouterKey) return { error: 'unconfigured' };
  const modelId = consentedModelId(catalog, provider);
  if (!modelId) return { error: 'noModel' };
  const enabled = provider === 'google' ? flags.hasGeminiKey : flags.hasOpenRouterKey;
  if (!enabled) return { error: 'unconfigured' };
  return { ok: { question: question.trim(), provider, modelId } };
}
