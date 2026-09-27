/**
 * KNOUX Repair — executionSemantics (shared honesty primitives).
 *
 * Zero-dependency pure logic so it stays unit-testable outside Vite:
 * no imports from lib/api or any module with environment side effects.
 *
 * Hard rules encoded here:
 * - running != success. Only a terminal backend state is an outcome.
 * - A local poll abort is NEVER a backend cancellation.
 * - CANCELLED is reported only after the backend confirms a terminal
 *   cancelled state (or another terminal state, reported as-is).
 * - Missing result/evidence is inconclusive/error, never success.
 */

export interface MinimalRun {
  status: string;
  lines?: unknown;
  toolId?: string;
  error?: string | null;
  result?: {
    status?: string | null;
    errorMessage?: string | null;
  } | null;
}

/**
 * Canonical bridge execution modes are run | analyze | preview.
 * Legacy UI aliases normalize here so callers can never send a mode
 * the bridge rejects with MODE_NOT_SUPPORTED.
 */
export function normalizeExecutionMode(mode: unknown): 'run' | 'analyze' | 'preview' {
  const value = String(mode || '').toLowerCase();
  if (value === 'analyze' || value === 'analyzeonly') return 'analyze';
  if (value === 'preview' || value === 'whatif') return 'preview';
  return 'run';
}

/** Terminal means anything the backend will not advance further. */
export function isTerminalRunStatus(status: unknown): boolean {
  return String(status || '') !== 'running';
}

export interface PollLoopOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchRun: (runId: string) => Promise<{ run: MinimalRun }>;
  onTick?: (run: MinimalRun) => void;
}

export interface CodedErrorOptions {
  code: string;
  run?: MinimalRun;
}

function codedError(message: string, options: CodedErrorOptions): Error {
  const error = new Error(message) as Error & { code?: string; run?: MinimalRun };
  error.code = options.code;
  if (options.run) error.run = options.run;
  return error;
}

function abortError(): Error {
  // Aborting local observation claims NOTHING about the backend run,
  // which may still be executing. Callers must reconcile, not record.
  return codedError('Local run observation stopped. The backend run may still be executing.', {
    code: 'POLL_CANCELLED',
  });
}

/**
 * Observe a run until the backend reports a terminal state.
 * Resolves ONLY with terminal runs. Rejects with POLL_TIMEOUT
 * (backend still running) or POLL_CANCELLED (local observation stopped).
 */
export async function pollUntilTerminalRun(
  runId: string,
  options: PollLoopOptions
): Promise<MinimalRun> {
  const intervalMs = options.intervalMs ?? 800;
  const timeoutMs = options.timeoutMs ?? 630000;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (options.signal?.aborted) throw abortError();
    const { run } = await options.fetchRun(runId);
    options.onTick?.(run);
    if (isTerminalRunStatus(run.status)) return run;
    if (Date.now() >= deadline) {
      throw codedError(
        `The tool is still running after ${Math.round(timeoutMs / 1000)}s of observation. The run continues on the bridge; no outcome is recorded.`,
        { code: 'POLL_TIMEOUT', run }
      );
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, intervalMs);
      if (options.signal) {
        options.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(abortError());
          },
          { once: true }
        );
      }
    });
  }
}

/* ------------------------------------------------------------------------- *
 * Result envelope reader
 *
 * The bridge emits a canonical lowercase envelope (lib/api.ts KnouxRunResult)
 * but reports written by older tools carry PascalCase aliases for the same
 * fields. Stations each grew their own reader and four of them read only one
 * casing, which turned a successful run into FAILED or WARNING. This is the
 * single tolerant reader every station must use.
 *
 * Hard rules:
 * - An unmeasured count is null, never 0.
 * - A status is only read when the envelope actually carries one.
 * - exitCode alone decides an outcome only when a status is absent.
 * - CANCELLED is never collapsed into INCONCLUSIVE, and never into FAILED.
 * ------------------------------------------------------------------------- */

export type EnvelopeOutcome = 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE';

/** Anything a result envelope can look like, canonical or legacy. */
export type ResultEnvelopeLike = object | null | undefined;

function asRecord(value: ResultEnvelopeLike): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * Read one logical field, preferring the canonical lowercase key and falling
 * back to its legacy PascalCase alias. Returns undefined when neither exists,
 * so callers can distinguish "absent" from "present but zero/empty".
 */
export function readEnvelopeField(result: ResultEnvelopeLike, canonical: string): unknown {
  const record = asRecord(result);
  if (!record) return undefined;
  const canonicalValue = record[canonical];
  if (canonicalValue !== undefined && canonicalValue !== null) return canonicalValue;
  const legacy = record[canonical.charAt(0).toUpperCase() + canonical.slice(1)];
  return legacy === undefined ? undefined : legacy;
}

/** Numeric field, or null when the envelope did not report it. Never 0-as-default. */
export function readEnvelopeNumber(result: ResultEnvelopeLike, canonical: string): number | null {
  const value = readEnvelopeField(result, canonical);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Boolean field, or null when the envelope did not report it. */
export function readEnvelopeBoolean(result: ResultEnvelopeLike, canonical: string): boolean | null {
  const value = readEnvelopeField(result, canonical);
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/** Text field, or null when absent or blank. */
export function readEnvelopeText(result: ResultEnvelopeLike, canonical: string): string | null {
  const value = readEnvelopeField(result, canonical);
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

const SUCCESS_WORDS = new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'OK', 'DONE', 'FINISHED']);
const FAILURE_WORDS = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED']);
const WARNING_WORDS = new Set(['WARNING', 'WARN', 'PARTIAL', 'PARTIALLY_COMPLETED', 'COMPLETED_WITH_WARNINGS']);
const CANCEL_WORDS = new Set(['CANCELLED', 'CANCELED', 'ABORTED', 'TERMINATED', 'STOPPED']);
const INCONCLUSIVE_WORDS = new Set(['INCONCLUSIVE', 'UNKNOWN', 'PENDING', 'RUNNING', 'STARTED', 'SKIPPED']);

/** Map one raw status word onto the station outcome vocabulary. null = unusable. */
export function normalizeEnvelopeStatus(raw: unknown): EnvelopeOutcome | null {
  const word = String(raw ?? '').trim().toUpperCase();
  if (word === '') return null;
  if (CANCEL_WORDS.has(word)) return 'CANCELLED';
  if (FAILURE_WORDS.has(word)) return 'FAILED';
  if (WARNING_WORDS.has(word)) return 'WARNING';
  if (SUCCESS_WORDS.has(word)) return 'SUCCESS';
  if (INCONCLUSIVE_WORDS.has(word)) return 'INCONCLUSIVE';
  return null;
}

/**
 * Terminal outcome for a result envelope, tolerant of both casings.
 *
 * Precedence: an explicit status always wins. Only when the envelope carries
 * no usable status does a reported exit code decide. When neither is present
 * the outcome is INCONCLUSIVE — a missing field never becomes a success.
 */
export function outcomeFromEnvelope(result: ResultEnvelopeLike): EnvelopeOutcome {
  const explicit = normalizeEnvelopeStatus(readEnvelopeField(result, 'status'));
  if (explicit) return explicit;
  const exitCode = readEnvelopeNumber(result, 'exitCode');
  if (exitCode === null) return 'INCONCLUSIVE';
  if (exitCode === 0) return 'SUCCESS';
  return 'FAILED';
}

/**
 * Outcome for a bridge run, preferring the run-level status the bridge
 * already normalized. A run that never reached a terminal state is
 * INCONCLUSIVE regardless of what its result payload claims.
 */
export function outcomeFromRunEnvelope(
  run: { status?: string | null; result?: ResultEnvelopeLike } | null | undefined
): EnvelopeOutcome {
  if (!run) return 'INCONCLUSIVE';
  const runStatus = String(run.status ?? '').trim().toLowerCase();
  if (runStatus === '') return 'INCONCLUSIVE';
  if (runStatus === 'running') return 'INCONCLUSIVE';
  if (runStatus === 'success') return 'SUCCESS';
  if (runStatus === 'cancelled') return 'CANCELLED';
  if (runStatus === 'error') return outcomeFromEnvelope(run.result);
  return 'INCONCLUSIVE';
}

/* ------------------------------------------------------------------------- *
 * Shared history row
 *
 * Stations 06, 07 and 08 each kept a private copy of the same builder. All
 * three synthesised SUCCESS from a bare `exitCode === 0` and wrote a fabricated
 * `0` into itemsProcessed. One builder, one honest contract.
 * ------------------------------------------------------------------------- */

export interface StationHistoryRow {
  id: string;
  toolId: string;
  toolName: string;
  /** Full ISO timestamp. Time-of-day only makes entries ambiguous across days. */
  timestamp: string;
  status: EnvelopeOutcome;
  /** null when the envelope did not report a count. Never 0-as-default. */
  itemsProcessed: number | null;
  summary: string;
}

export interface BuildHistoryRowInput {
  toolId: string;
  toolName: string;
  result?: ResultEnvelopeLike;
  /** Lets each station say what "succeeded" meant without duplicating the rest. */
  successSummary: string;
  failureSummary: string;
  /** Injected so history ids are unique and reproducible in tests. */
  now?: number;
}

/**
 * Build one honest history row. The summary is the tool's own error message
 * when it reported one, so a warning never reads as a clean success.
 */
export function buildStationHistoryRow(input: BuildHistoryRowInput): StationHistoryRow {
  const status = outcomeFromEnvelope(input.result);
  const errorMessage = readEnvelopeText(input.result, 'errorMessage');
  return {
    id: `${input.toolId}-${input.now ?? Date.now()}`,
    toolId: input.toolId,
    toolName: input.toolName,
    timestamp: new Date(input.now ?? Date.now()).toISOString(),
    status,
    itemsProcessed: readEnvelopeNumber(input.result, 'itemsProcessed'),
    summary:
      errorMessage ?? (status === 'SUCCESS' ? input.successSummary : input.failureSummary),
  };
}

export interface ConfirmedCancelOptions {
  intervalMs?: number;
  /** Time to wait for backend confirmation. Defaults to 30s. */
  timeoutMs?: number;
  signal?: AbortSignal;
  requestCancel: (runId: string) => Promise<unknown>;
  fetchRun: (runId: string) => Promise<{ run: MinimalRun }>;
  onTick?: (run: MinimalRun) => void;
}

/**
 * Request backend cancellation, then RECONCILE: keep observing until the
 * backend reaches a terminal state and return exactly that state.
 * - Backend confirms cancelled -> resolves the cancelled run.
 * - Backend finished first (success/error/...) -> resolves that run as-is.
 *   A cancel request that arrives too late must never rewrite success.
 * - Cancel request rejected, or no terminal state in time -> throws
 *   CANCEL_FAILED carrying the last observed run. The caller must keep
 *   monitoring instead of reporting CANCELLED.
 */
export async function requestConfirmedCancel(
  runId: string,
  options: ConfirmedCancelOptions
): Promise<MinimalRun> {
  try {
    await options.requestCancel(runId);
  } catch (error) {
    throw codedError(
      `The cancellation request was rejected: ${error instanceof Error ? error.message : String(error)}. The run may still be executing.`,
      { code: 'CANCEL_FAILED' }
    );
  }
  try {
    return await pollUntilTerminalRun(runId, {
      intervalMs: options.intervalMs ?? 800,
      timeoutMs: options.timeoutMs ?? 30000,
      signal: options.signal,
      fetchRun: options.fetchRun,
      onTick: options.onTick,
    });
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'POLL_CANCELLED') {
      throw error;
    }
    const lastRun = (error as Error & { run?: MinimalRun })?.run;
    throw codedError(
      'Cancellation was requested but the backend did not confirm a terminal state in time. The run may still be executing — monitoring continues.',
      { code: 'CANCEL_FAILED', ...(lastRun ? { run: lastRun } : {}) }
    );
  }
}

/** Terminal outcome label. Never claims success without a terminal success. */
export function outcomeLabelForStatus(
  status: unknown
): 'success' | 'error' | 'cancelled' | 'inconclusive' {
  switch (String(status || '')) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'inconclusive';
  }
}

/**
 * Honest one-line history message for a TERMINAL run.
 * Missing evidence is inconclusive/error, never fabricated success.
 */
export function historyMessageForTerminal(
  status: unknown,
  toolId: string,
  error?: string | null
): string {
  const id = toolId || 'tool';
  switch (String(status || '')) {
    case 'success':
      return error
        ? `${id} finished with warnings: ${error}`
        : `${id} completed. See evidence for verified results.`;
    case 'error':
      return error || `${id} failed. See evidence for details.`;
    case 'cancelled':
      return `${id} was cancelled before completion. No further changes were applied after cancellation.`;
    default:
      return `${id} finished without conclusive evidence. Verification inconclusive — see evidence before retrying.`;
  }
}

export interface RememberedRun {
  runId: string;
  toolId: string;
  /** Display name captured at launch; falls back to toolId when absent. */
  toolName?: string;
  stationKey: string;
  startedAt: number;
}

const RUN_REGISTRY_KEY_PREFIX = 'knoux:station-run:';
const memoryRegistry = new Map<string, RememberedRun>();

function webStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // Storage unavailable (privacy mode, SSR): memory fallback below.
  }
  return null;
}

/**
 * Orphan-run registry: every started run is remembered so a remount can
 * rediscover and reconcile it instead of silently losing backend ownership.
 * sessionStorage primary (survives remounts within the tab), memory fallback.
 */
export function rememberRun(record: RememberedRun): void {
  memoryRegistry.set(record.stationKey, record);
  const storage = webStorage();
  if (storage) {
    try {
      storage.setItem(RUN_REGISTRY_KEY_PREFIX + record.stationKey, JSON.stringify(record));
    } catch {
      // Quota/privacy: memory copy above still applies.
    }
  }
}

export function recallRun(stationKey: string): RememberedRun | null {
  const storage = webStorage();
  if (storage) {
    try {
      const raw = storage.getItem(RUN_REGISTRY_KEY_PREFIX + stationKey);
      if (raw) {
        const parsed = JSON.parse(raw) as RememberedRun;
        if (parsed && typeof parsed.runId === 'string' && typeof parsed.toolId === 'string') {
          return parsed;
        }
      }
    } catch {
      // Corrupt entry: fall through to memory.
    }
  }
  return memoryRegistry.get(stationKey) ?? null;
}

export function forgetRun(stationKey: string): void {
  memoryRegistry.delete(stationKey);
  const storage = webStorage();
  if (storage) {
    try {
      storage.removeItem(RUN_REGISTRY_KEY_PREFIX + stationKey);
    } catch {
      // Non-critical cleanup.
    }
  }
}
