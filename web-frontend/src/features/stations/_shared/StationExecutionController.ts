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

export interface ExecutionRequestInput {
  tool: BridgeTool;
  mode: ExecutionMode;
  options?: ToolRunOptions;
  confirmation?: ToolRunConfirmation;
}

export interface ExecutionDecision {
  ok: boolean;
  nextState: ExecutionState;
  reason?: string;
}

const DEFAULT_POLL_INTERVAL_MS = 600;
const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 5_000;

function normalizePollInterval(intervalMs?: number): number {
  if (!Number.isFinite(intervalMs)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.trunc(intervalMs as number)));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const { runId } = await api.startRun(inputOrTool.ToolId, mode || 'run', options || {}, confirmation);
    return runId;
  }
  const { runId } = await api.startRun(inputOrTool.tool.ToolId, inputOrTool.mode, inputOrTool.options || {}, inputOrTool.confirmation);
  return runId;
}

/**
 * Wait until the bridge reports a terminal run record.
 *
 * The previous implementation performed one GET and returned immediately,
 * which allowed station UIs to inspect a still-running record as if it were
 * final. Keep the bridge as the source of truth and never synthesize success,
 * failure, cancellation, or inconclusive outcomes client-side.
 */
export async function pollExecution(runId: string, intervalMs = DEFAULT_POLL_INTERVAL_MS): Promise<BridgeRun> {
  const delayMs = normalizePollInterval(intervalMs);

  for (;;) {
    const { run } = await api.getRun(runId);
    if (run.status !== 'running') return run;
    await wait(delayMs);
  }
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
