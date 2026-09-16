/**
 * KNOUX Repair — StationExecutionController (Phase 00 foundation).
 *
 * Owns the execution-state machine for a station tool run:
 * IDLE -> PREPARING -> WAITING_FOR_CONFIRMATION -> WAITING_FOR_ELEVATION
 *   -> RUNNING -> VERIFYING -> SUCCESS | WARNING | FAILED | CANCELLED | SKIPPED | INCONCLUSIVE
 *
 * INCONCLUSIVE is terminal and distinct: it is never mapped to SUCCESS.
 */
import { api, type BridgeRun, type BridgeTool, type ExecutionMode, type ToolRunConfirmation, type ToolRunOptions } from '../../../lib/api';
import { isOnlineExecutionBlocked, requiresTypedPhrase, type ExecutionState } from './contracts';
import {
  forgetRun as forgetRememberedRun,
  historyMessageForTerminal,
  normalizeExecutionMode as normalizeCanonicalMode,
  outcomeLabelForStatus,
  pollUntilTerminalRun,
  recallRun as recallRememberedRun,
  rememberRun as rememberRememberedRun,
  requestConfirmedCancel as requestBackendConfirmedCancel,
  type RememberedRun,
} from './executionSemantics';

export type { RememberedRun };
export { forgetRememberedRun as forgetRun, recallRememberedRun as recallRun, rememberRememberedRun as rememberRun };

export interface ExecutionRequestInput {
  tool: BridgeTool;
  mode: ExecutionMode;
  options?: ToolRunOptions;
  confirmation?: ToolRunConfirmation;
}

/**
 * Canonical bridge execution modes are run | analyze | preview.
 * Legacy UI aliases are normalized here so a caller can never send a mode
 * the bridge rejects with MODE_NOT_SUPPORTED:
 *   AnalyzeOnly -> analyze, WhatIf -> preview, Execute -> run, repair -> run.
 */
export function normalizeExecutionMode(mode: ExecutionMode): 'run' | 'analyze' | 'preview' {
  return normalizeCanonicalMode(mode);
}

export interface ExecutionDecision {
  ok: boolean;
  nextState: ExecutionState;
  reason?: string;
}

/** Pre-flight gate: confirmation, elevation, and WinRE policy before any run starts. */
export function decideExecution(input: ExecutionRequestInput, bridgeElevated: boolean): ExecutionDecision {
  const { tool, mode, confirmation } = input;
  if (isOnlineExecutionBlocked(tool.RiskLevel)) {
    return { ok: false, nextState: 'SKIPPED', reason: 'This tool requires WinRE and cannot run as a normal online repair.' };
  }
  if (mode === 'run' && requiresTypedPhrase(tool.RiskLevel, mode)) {
    if (!confirmation || confirmation.confirmed !== true || !confirmation.phrase) {
      return { ok: false, nextState: 'WAITING_FOR_CONFIRMATION', reason: 'Explicit typed confirmation is required before execution.' };
    }
  }
  if (tool.RequiresAdmin && !bridgeElevated) {
    return { ok: false, nextState: 'WAITING_FOR_ELEVATION', reason: 'Administrator permission required.' };
  }
  return { ok: true, nextState: 'PREPARING' };
}

/*
 * The local bridge intentionally permits one active tool run at a time and
 * returns RUN_IN_PROGRESS (HTTP 409) for a second POST /api/runs. A few
 * station bootstrap flows collect more than one read-only evidence source.
 * React StrictMode may also replay their mount effects in development.
 *
 * Serialize only those background evidence starts that explicitly identify
 * themselves as analyze + analyzeOnly=true. User-confirmed repair execution
 * keeps the normal fail-fast bridge contract; this queue is not a general
 * hidden execution queue.
 *
 * Duplicate StrictMode requests for the same ToolId share the same runId.
 * Distinct background probes wait for the preceding probe to reach a real
 * backend terminal state before their POST is issued.
 */
let backgroundAnalyzeTail: Promise<void> = Promise.resolve();
const backgroundAnalyzeStarts = new Map<string, Promise<string>>();

function shouldSerializeBackgroundAnalyze(
  mode: 'run' | 'analyze' | 'preview',
  options: ToolRunOptions | undefined,
  confirmation: ToolRunConfirmation | undefined,
): boolean {
  return mode === 'analyze' && options?.analyzeOnly === true && !confirmation;
}

function startSerializedBackgroundAnalyze(
  toolId: string,
  options: ToolRunOptions | undefined,
): Promise<string> {
  const duplicate = backgroundAnalyzeStarts.get(toolId);
  if (duplicate) return duplicate;

  let resolveStart!: (runId: string) => void;
  let rejectStart!: (error: unknown) => void;
  const startPromise = new Promise<string>((resolve, reject) => {
    resolveStart = resolve;
    rejectStart = reject;
  });
  backgroundAnalyzeStarts.set(toolId, startPromise);

  const predecessor = backgroundAnalyzeTail.catch(() => undefined);
  const lifecycle = (async () => {
    let runStarted = false;
    try {
      await predecessor;
      const { runId } = await api.startRun(toolId, 'analyze', options || {}, undefined);
      runStarted = true;
      resolveStart(runId);

      // The caller also observes its run for UI state. This lightweight shared
      // observer exists only to release the single-run gate from backend truth,
      // even when StrictMode cleanup aborts a component-local observer.
      await pollUntilTerminalRun(runId, {
        intervalMs: 300,
        timeoutMs: 630000,
        fetchRun: (id: string) => api.getRun(id),
      });
    } catch (error) {
      if (!runStarted) rejectStart(error);
      // When a started run cannot be reconciled, fail closed by allowing the
      // next real POST to meet the bridge's own RUN_IN_PROGRESS guard rather
      // than inventing a terminal state here.
    } finally {
      backgroundAnalyzeStarts.delete(toolId);
    }
  })();

  backgroundAnalyzeTail = lifecycle.then(() => undefined, () => undefined);
  return startPromise;
}

export async function startExecution(
  inputOrTool: ExecutionRequestInput | BridgeTool,
  mode?: ExecutionMode,
  options?: ToolRunOptions,
  confirmation?: ToolRunConfirmation
): Promise<string> {
  if ('ToolId' in inputOrTool) {
    const canonicalMode = normalizeExecutionMode(mode || 'run');
    if (shouldSerializeBackgroundAnalyze(canonicalMode, options, confirmation)) {
      return startSerializedBackgroundAnalyze(inputOrTool.ToolId, options);
    }
    const { runId } = await api.startRun(inputOrTool.ToolId, canonicalMode, options || {}, confirmation);
    return runId;
  }

  const canonicalMode = normalizeExecutionMode(inputOrTool.mode);
  if (shouldSerializeBackgroundAnalyze(canonicalMode, inputOrTool.options, inputOrTool.confirmation)) {
    return startSerializedBackgroundAnalyze(inputOrTool.tool.ToolId, inputOrTool.options);
  }
  const { runId } = await api.startRun(inputOrTool.tool.ToolId, canonicalMode, inputOrTool.options || {}, inputOrTool.confirmation);
  return runId;
}

/**
 * Backward-compatible station polling entrypoint.
 *
 * Older stations still call pollExecution(). It must therefore inherit the
 * same honesty guarantees as the newer pollUntilTerminal() path: RUNNING is
 * never returned as a completed outcome, and only a bridge-confirmed terminal
 * record may escape this function.
 */
export async function pollExecution(runId: string, intervalMs = 800): Promise<BridgeRun> {
  return pollUntilTerminal(runId, { intervalMs });
}

export interface PollUntilTerminalOptions {
  /** Delay between status probes. Defaults to 800ms. */
  intervalMs?: number;
  /** Maximum time to wait for a terminal state. Defaults to 630000ms (bridge kills runs at 10min). */
  timeoutMs?: number;
  /** When aborted, the last observed run is thrown with the abort error. */
  signal?: AbortSignal;
  /** Test seam / live line streaming: override the run fetcher. Defaults to api.getRun. */
  fetchRun?: (runId: string) => Promise<{ run: BridgeRun }>;
  /** Called with every observed run, including intermediate running states. */
  onTick?: (run: BridgeRun) => void;
}

/**
 * Poll a run until the bridge reports a terminal state
 * (success | error | cancelled | inconclusive).
 *
 * Single-fetch callers mislabel slow tools: the first GET usually returns
 * `running` with a null result, which must never be recorded as an outcome.
 * Stations awaiting a user-visible result must use this helper so RUNNING is
 * shown while running and only terminal states reach history/evidence.
 */
export async function pollUntilTerminal(runId: string, options: PollUntilTerminalOptions = {}): Promise<BridgeRun> {
  const run = await pollUntilTerminalRun(runId, {
    intervalMs: options.intervalMs,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    fetchRun: options.fetchRun ?? ((id: string) => api.getRun(id)),
    onTick: options.onTick as ((run: { status: string }) => void) | undefined,
  });
  return run as BridgeRun;
}

export interface ConfirmedCancelOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onTick?: (run: BridgeRun) => void;
}

/**
 * Cancel honesty: sends the real bridge cancellation, then reconciles by
 * observing the backend until it reports a terminal state. Resolves with
 * the confirmed terminal run (cancelled — or success/error if the tool
 * finished first). Throws CANCEL_FAILED when confirmation cannot be
 * obtained; the caller must keep monitoring, never report CANCELLED.
 */
export async function requestConfirmedCancel(
  runId: string,
  options: ConfirmedCancelOptions = {}
): Promise<BridgeRun> {
  const run = await requestBackendConfirmedCancel(runId, {
    intervalMs: options.intervalMs,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    requestCancel: () => api.cancelRun(runId),
    fetchRun: (id: string) => api.getRun(id),
    onTick: options.onTick as ((run: { status: string }) => void) | undefined,
  });
  return run as BridgeRun;
}

/** Terminal outcome label for history entries. Never claims success without a terminal success. */
export function outcomeLabelForRun(run: BridgeRun): 'success' | 'error' | 'cancelled' | 'inconclusive' {
  return outcomeLabelForStatus(run.status);
}

/** Honest one-line history message derived from the terminal run — no fabricated success. */
export function historyMessageForRun(run: BridgeRun): string {
  return historyMessageForTerminal(
    run.status,
    run.toolId,
    run.error || run.result?.errorMessage || run.result?.ErrorMessage || null
  );
}

export async function cancelExecution(runId: string): Promise<void> {
  await api.cancelRun(runId);
}

export function runStatusToState(status: BridgeRun['status']): ExecutionState {
  switch (status) {
    case 'running': return 'RUNNING';
    case 'success': return 'SUCCESS';
    case 'error': return 'FAILED';
    case 'cancelled': return 'CANCELLED';
    case 'inconclusive': return 'INCONCLUSIVE';
    default: return 'INCONCLUSIVE';
  }
}
