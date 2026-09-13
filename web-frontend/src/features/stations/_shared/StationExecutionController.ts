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

export async function startExecution(
  inputOrTool: ExecutionRequestInput | BridgeTool,
  mode?: ExecutionMode,
  options?: ToolRunOptions,
  confirmation?: ToolRunConfirmation
): Promise<string> {
  if ('ToolId' in inputOrTool) {
    const { runId } = await api.startRun(inputOrTool.ToolId, normalizeExecutionMode(mode || 'run'), options || {}, confirmation);
    return runId;
  }
  const { runId } = await api.startRun(inputOrTool.tool.ToolId, normalizeExecutionMode(inputOrTool.mode), inputOrTool.options || {}, inputOrTool.confirmation);
  return runId;
}

export async function pollExecution(runId: string, _intervalMs?: number): Promise<BridgeRun> {
  const { run } = await api.getRun(runId);
  return run;
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
