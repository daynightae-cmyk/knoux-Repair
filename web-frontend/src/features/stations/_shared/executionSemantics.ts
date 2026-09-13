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
