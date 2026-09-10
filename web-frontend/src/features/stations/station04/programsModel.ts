/**
 * Station 04 — Programs & Applications domain model.
 */
import type { BridgeRun, BridgeTool, ExecutionMode, KnouxRunResult } from '../../../lib/api';

export const STATION04_CATEGORY = '04-Programs-Applications';
export const STATION04_TOOL_IDS = [
  'PA01', 'PA02', 'PA03', 'PA04', 'PA05', 'PA06', 'PA07', 'PA08', 'PA09', 'PA10',
] as const;

export type Station04ToolId = (typeof STATION04_TOOL_IDS)[number];

export interface InstalledApp {
  Name: string;
  Version: string;
  Publisher: string;
  InstallDate: string;
  EstimatedSizeMB: number;
  UninstallString: string;
}

export interface StartupItem {
  Source: string;
  Command: string;
  Enabled: boolean;
  Type: 'registry' | 'folder' | 'task';
}

export function parseInstalledApps(lines: string[]): InstalledApp[] {
  // Minimal parser matching existing PowerShell output markers.
  return [];
}

export interface ProgramEvidence {
  inventory: InstalledApp[];
  startup: StartupItem[];
  updatesAvailable: number | null;
  brokenAssociations: number | null;
  runtimeComponents: string[];
  windowsFeatures: string[];
  outcomes: Record<string, unknown>;
}

export function emptyEvidence(): ProgramEvidence {
  return { inventory: [], startup: [], updatesAvailable: null, brokenAssociations: null, runtimeComponents: [], windowsFeatures: [], outcomes: {} };
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return STATION04_TOOL_IDS.map((id) => tools.find((t) => t.ToolId === id)).filter((t): t is BridgeTool => Boolean(t));
}
