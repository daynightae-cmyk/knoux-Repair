/**
 * KNOUX Repair — Station foundation contracts (Phase 00).
 *
 * Shared runtime envelope for all 18 stations and 158 tools.
 * Individual stations build their OWN domain UI above this foundation;
 * they must not duplicate Safety, Reporting, or execution logic.
 */
import type {
  BridgeTool,
  ExecutionMode,
  KnouxRunResult,
  ToolRunConfirmation,
  ToolRunOptions,
} from '../../../lib/api';

export type ExecutionState =
  | 'IDLE'
  | 'PREPARING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'WAITING_FOR_ELEVATION'
  | 'RUNNING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'WARNING'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED'
  | 'INCONCLUSIVE';

export type RiskLevel =
  | 'READ_ONLY'
  | 'SAFE_CLEANUP'
  | 'SYSTEM_REPAIR'
  | 'DESTRUCTIVE'
  | 'REBOOT_REQUIRED'
  | 'WINRE_ONLY';

export interface ExecutionRequest {
  runId: string;
  toolId: string;
  mode: ExecutionMode;
  parameters: ToolRunOptions;
  confirmation?: ToolRunConfirmation;
  requestedAt: string;
}

const TERMINAL_RUN_STATES = new Set(['SUCCESS', 'WARNING', 'FAILED', 'CANCELLED', 'SKIPPED', 'INCONCLUSIVE']);

/** Normalize a structured result status. INCONCLUSIVE is never collapsed into SUCCESS. */
export function normalizeResultStatus(status: unknown): ExecutionState {
  const value = String(status || '').toUpperCase();
  if (value === 'SUCCESS' || value === 'WARNING' || value === 'FAILED' || value === 'CANCELLED' || value === 'SKIPPED' || value === 'INCONCLUSIVE') {
    return value as ExecutionState;
  }
  return 'INCONCLUSIVE';
}

export function isTerminalState(state: ExecutionState): boolean {
  return TERMINAL_RUN_STATES.has(state);
}

/** Risk levels that require high-friction typed-phrase confirmation for run mode. */
export function requiresTypedPhrase(riskLevel: string, mode: ExecutionMode): boolean {
  if (mode !== 'run') return false;
  return riskLevel === 'SYSTEM_REPAIR' || riskLevel === 'REBOOT_REQUIRED' || riskLevel === 'DESTRUCTIVE';
}

/** WINRE_ONLY tools must never execute as a normal online repair. */
export function isOnlineExecutionBlocked(riskLevel: string): boolean {
  return riskLevel === 'WINRE_ONLY';
}

/** Build immutable confirmation evidence collected by the high-friction dialog. */
export function buildConfirmationEvidence(input: {
  typedPhrase: string;
  recoveryAcknowledged: boolean;
  requiresPhrase: boolean;
  requiresRecoveryAcknowledgement: boolean;
}): ToolRunConfirmation {
  return {
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    ...(input.requiresPhrase ? { phrase: input.typedPhrase.trim() } : {}),
    ...(input.requiresRecoveryAcknowledgement ? { acknowledgedRecovery: input.recoveryAcknowledged } : {}),
  };
}

export interface CategoryCount {
  id: string;
  tools: number;
}

/**
 * Category counts computed from the live runtime registry.
 * The UI must never use hard-coded per-category numbers.
 */
export function countByCategory(tools: BridgeTool[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const tool of tools) counts.set(tool.Category, (counts.get(tool.Category) || 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({ id, tools: count }));
}

/**
 * Offline guard: when the bridge is unavailable the registry is UNKNOWN,
 * never zero. Callers must render UNAVAILABLE/OFFLINE, not "0 tools".
 */
export function registryCountOrNull(bridgeOnline: boolean | null, tools: BridgeTool[]): number | null {
  if (bridgeOnline !== true) return null;
  return tools.length;
}

function pick<T>(result: KnouxRunResult | null | undefined, lower: string, upper: string): T | null {
  if (!result) return null;
  const record = result as unknown as Record<string, unknown>;
  const value = record[lower] ?? record[upper];
  return (value === undefined ? null : value) as T | null;
}

/** Read a structured result tolerantly across the canonical and legacy shapes. */
export function readResultField<T>(result: KnouxRunResult | null | undefined, lower: string, upper: string): T | null {
  return pick<T>(result, lower, upper);
}
