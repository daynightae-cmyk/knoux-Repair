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
  // Real parser: tries JSON from PA01 output (installed-programs.json); falls back to line parsing.
  try {
    const jsonText = lines.join('\n');
    if (jsonText.includes('installed-programs')) {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown) => {
          const i = item as Record<string, unknown>;
          return {
            Name: String(i.Name || i.DisplayName || 'Unknown'),
            Version: String(i.Version || i.DisplayVersion || ''),
            Publisher: String(i.Publisher || ''),
            InstallDate: String(i.InstallDate || ''),
            EstimatedSizeMB: Number(i.EstimatedSizeMB || 0),
            UninstallString: String(i.UninstallString || ''),
          };
        });
      }
    }
  } catch {
    // Not JSON: attempt simple line parsing.
    const out: InstalledApp[] = [];
    const nameRe = /Name\s*=[^;]+/;
    for (const line of lines) {
      const match = line.match(/Name=([^;]+)/);
      if (match) {
        out.push({
          Name: match[1].trim(),
          Version: '',
          Publisher: '',
          InstallDate: '',
          EstimatedSizeMB: 0,
          UninstallString: '',
        });
      }
    }
    return out;
  }
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
