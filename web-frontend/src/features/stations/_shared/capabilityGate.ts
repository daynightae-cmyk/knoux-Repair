/**
 * KNOUX REPAIR — runtime capability gate.
 *
 * The versioned product-gate snapshot is
 * `Docs/verification/TOOL-RUNTIME-VERIFICATION.csv`. It records the outcome
 * of the 2026-09-26 real-machine verification campaign: 139 of the 158
 * canonical ToolIds completed a verification run; 19 did not complete and are
 * recorded `UNVERIFIED`.
 *
 * The detailed generated campaign artifact remains
 * `Reports/100-Tool-Functional-Verification.csv` (Reports/ is intentionally
 * ignored). The versioned snapshot exists so clean GitHub/CI checkouts enforce
 * the same product gate instead of depending on an owner-machine artifact.
 *
 * `Docs/TOOLS-MANIFEST.json` carries a static `TestResult` declaration and is
 * not used as runtime-verification evidence.
 *
 * The contract this module encodes:
 *   - A tool the runtime has not proven may still be ANALYSED. Analysis changes
 *     nothing, so an unproven read-only capability is honest to expose.
 *   - A tool the runtime has not proven may NOT be MUTATED. Hiding the action
 *     is the only safe answer; the ToolId stays registered and discoverable.
 *
 * `capabilityGate.test.mjs` reads the versioned snapshot and fails if this set
 * or the canonical ToolId inventory drifts.
 */

import type { BridgeTool } from '../../../lib/api';

/**
 * ToolIds whose verification run did not complete. Kept in sync with the
 * versioned runtime-verification snapshot by a test — do not hand-edit without
 * re-running the verification campaign and refreshing that snapshot.
 */
export const UNVERIFIED_TOOL_IDS: readonly string[] = [
  'SC03', 'SC11', 'PA03',
  'DF01', 'DF02', 'DF04', 'DF06', 'DF07', 'DF08', 'DF09', 'DF10',
  'DS02', 'DS03', 'PF11', 'MO04', 'SW08',
  'PI01', 'PI03', 'PI06',
];

/** Risk levels that change something on the machine. */
const MUTATING_RISK = new Set(['SAFE_CLEANUP', 'SYSTEM_REPAIR', 'DESTRUCTIVE', 'REBOOT_REQUIRED']);

export type ExposureClass =
  /** Verified, safe, and exposed. */
  | 'implemented-and-exposed'
  /** Registered and analysis-only; its run could not be proven. */
  | 'implemented-but-runtime-unverified'
  /** Mutating action withheld because the runtime has not proven it. */
  | 'mutation-hidden-pending-proof';

export function isRuntimeVerified(toolId: string): boolean {
  return !UNVERIFIED_TOOL_IDS.includes(toolId);
}

export function isMutatingRisk(tool: Pick<BridgeTool, 'RiskLevel'>): boolean {
  return MUTATING_RISK.has(String(tool.RiskLevel).toUpperCase());
}

/**
 * One classification per tool, from the authoritative CSV.
 *
 * An unverified READ_ONLY tool is still exposed for analysis; only an
 * unverified tool that would change the machine is withheld.
 */
export function classifyExposure(
  tool: Pick<BridgeTool, 'ToolId' | 'RiskLevel'>
): ExposureClass {
  if (isRuntimeVerified(tool.ToolId)) return 'implemented-and-exposed';
  if (isMutatingRisk(tool)) return 'mutation-hidden-pending-proof';
  return 'implemented-but-runtime-unverified';
}

/**
 * May the customer start this tool in the given mode?
 *
 * Analysis and preview never change the machine, so they stay available for
 * every tool. `run` is withheld for an unproven mutating tool.
 */
export function canExposeAction(
  tool: Pick<BridgeTool, 'ToolId' | 'RiskLevel'>,
  mode: 'run' | 'analyze' | 'preview'
): boolean {
  if (mode !== 'run') return true;
  return classifyExposure(tool) !== 'mutation-hidden-pending-proof';
}

/**
 * Why an action is withheld, in words a customer can read. Returns null when
 * the action is available.
 */
export function exposureBlockReason(
  tool: Pick<BridgeTool, 'ToolId' | 'RiskLevel' | 'EnglishName' | 'ArabicName'>,
  mode: 'run' | 'analyze' | 'preview' = 'run'
): string | null {
  if (canExposeAction(tool, mode)) return null;
  const name = tool.ArabicName || tool.EnglishName || tool.ToolId;
  return `This repair has not completed a verified run on a real device, so its change action is withheld. Analysis is still available. (${name})`;
}

/**
 * Filter a registry down to the tools this station may actually show.
 *
 * A withheld tool is removed from the customer-visible catalog entirely; the
 * ToolId remains in the registry and in this module, so nothing is lost and
 * nothing is falsely offered.
 */
export function exposeTools<T extends Pick<BridgeTool, 'ToolId' | 'RiskLevel'>>(
  tools: T[]
): T[] {
  return tools.filter(tool => classifyExposure(tool) !== 'mutation-hidden-pending-proof');
}

/** Split a catalog into what is shown and what is withheld, for an honest count. */
export function partitionForExposure<T extends Pick<BridgeTool, 'ToolId' | 'RiskLevel'>>(
  tools: T[]
): { exposed: T[]; withheld: T[] } {
  const exposed: T[] = [];
  const withheld: T[] = [];
  for (const tool of tools) {
    if (classifyExposure(tool) === 'mutation-hidden-pending-proof') withheld.push(tool);
    else exposed.push(tool);
  }
  return { exposed, withheld };
}
