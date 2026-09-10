/**
 * KNOUX Repair — bridgeLifecycle (Phase 00 foundation).
 *
 * Desktop lifecycle contract:
 *   Electron starts -> bridge starts -> readiness probe
 *   -> manifest loads -> registry validates -> renderer receives READY.
 * READY is never reported before the registry validates. When the bridge
 * is unreachable the state is UNAVAILABLE with a reason, never "0 tools".
 */
import { api, BridgeError, type BridgeHealth } from '../../../lib/api';
import { snapshotFromTools, type RegistrySnapshot } from './StationToolRegistry';

export type BridgeLifecycleState =
  | { kind: 'PROBING' }
  | { kind: 'READY'; health: BridgeHealth; registry: RegistrySnapshot }
  | { kind: 'UNAVAILABLE'; reason: string; technical: string };

export interface ProbeResult {
  health: BridgeHealth | null;
  toolCount: number | null;
  reason: string;
  technical: string;
}

export async function probeBridge(): Promise<ProbeResult> {
  let health: BridgeHealth | null = null;
  let healthTechnical = '';
  try {
    health = await api.health();
  } catch (error) {
    healthTechnical = error instanceof BridgeError ? `[${error.code}] ${error.message}` : String(error);
  }
  if (!health) {
    return {
      health: null,
      toolCount: null,
      reason: 'Execution bridge offline',
      technical: healthTechnical || 'Health probe failed.',
    };
  }
  try {
    const { tools } = await api.tools();
    return { health, toolCount: tools.length, reason: '', technical: '' };
  } catch (error) {
    const technical = error instanceof BridgeError ? `[${error.code}] ${error.message}` : String(error);
    return {
      health,
      toolCount: null,
      reason: 'Tool registry unavailable',
      technical,
    };
  }
}

/** Poll the readiness probe until READY or the timeout elapses. */
export async function waitForBridgeReady(options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<BridgeLifecycleState> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let last: ProbeResult | null = null;
  while (Date.now() < deadline) {
    last = await probeBridge();
    if (last.health && last.toolCount !== null) {
      const { tools } = await api.tools();
      return { kind: 'READY', health: last.health, registry: snapshotFromTools(tools) };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return {
    kind: 'UNAVAILABLE',
    reason: last?.reason || 'Execution bridge offline',
    technical: last?.technical || 'Readiness probe timed out.',
  };
}

export function copyTechnicalDetails(reason: string, technical: string): string {
  return `KNOUX Repair bridge state: ${reason}\nTechnical details: ${technical}\nTime: ${new Date().toISOString()}`;
}
