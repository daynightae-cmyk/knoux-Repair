/**
 * Station 05 — Duplicate Files domain model (KNOUX Duplicate Studio / ذكاء الملفات المكررة).
 *
 * Everything here derives from real evidence: the registered 05-Duplicate-Files tools,
 * real content hashes (SHA-256), exact byte counts, and quarantine-verified outcomes.
 * No fake scores, no fabricated reclaimable space before scan.
 */
import type { BridgeTool, DuplicatePreviewGroup } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';

export const STATION05_CATEGORY = '05-Duplicate-Files';

export const STATION05_TOOL_IDS = [
  'DF01', 'DF02', 'DF03', 'DF04', 'DF05',
  'DF06', 'DF07', 'DF08', 'DF09', 'DF10', 'DF11'
] as const;

export type Station05ToolId = (typeof STATION05_TOOL_IDS)[number];

export type DuplicateWorkflowTab = 'scan' | 'duplicates' | 'quarantine' | 'recovery' | 'system-review';

export type DuplicateAppState =
  | 'LANDING'
  | 'CONFIG'
  | 'SCANNING'
  | 'RESULTS'
  | 'QUARANTINE_REVIEW'
  | 'CLEANING'
  | 'VERIFIED'
  | 'ERROR';

export interface DuplicateGroupChronology {
  dates: Array<{ path: string; time: number; isValid: boolean }>;
  maxTime: number | null;
  minTime: number | null;
}

export function computeGroupChronology(group: DuplicatePreviewGroup): DuplicateGroupChronology {
  const dates = group.Files.map((file) => {
    const raw = file.LastWriteUtc || file.ModifiedTime;
    const time = raw ? new Date(raw).getTime() : NaN;
    return { path: file.Path, time, isValid: !isNaN(time) && time > 0 };
  });
  const validTimes = dates.filter((d) => d.isValid).map((d) => d.time);
  const maxTime = validTimes.length > 0 ? Math.max(...validTimes) : null;
  const minTime = validTimes.length > 1 ? Math.min(...validTimes) : null;
  return { dates, maxTime, minTime };
}

export function formatBytes(value: number, lang: Lang): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString(lang, { maximumFractionDigits: 2 })} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toLocaleString(lang, { maximumFractionDigits: 1 })} MB`;
  if (value >= 1024) return `${(value / 1024).toLocaleString(lang, { maximumFractionDigits: 1 })} KB`;
  return `${value.toLocaleString(lang)} B`;
}

export function formatLastModified(utcStr?: string, lang: Lang = 'en'): string {
  if (!utcStr) return '—';
  try {
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function filterGroupsByQuery(groups: DuplicatePreviewGroup[], query: string): DuplicatePreviewGroup[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return groups;
  return groups.filter((group) =>
    group.Files.some(
      (file) =>
        file.Name.toLowerCase().includes(trimmed) ||
        file.Path.toLowerCase().includes(trimmed)
    )
  );
}

export function calculatePotentialReclaim(groups: DuplicatePreviewGroup[]): number {
  return groups.reduce((acc, g) => acc + (g.RecoverableBytes || 0), 0);
}

export function calculateSelectedCopies(
  groups: DuplicatePreviewGroup[],
  selectedGroupIds: Set<string>,
  _keepPaths?: Record<string, string>
): { keepingCount: number; quarantineCount: number; selectedBytes: number } {
  let keepingCount = 0;
  let quarantineCount = 0;
  let selectedBytes = 0;

  for (const group of groups) {
    if (selectedGroupIds.has(group.Id)) {
      keepingCount += 1;
      const copies = group.Files.length;
      quarantineCount += Math.max(0, copies - 1);
      selectedBytes += (group.RecoverableBytes || 0);
    }
  }

  return { keepingCount, quarantineCount, selectedBytes };
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return tools.filter((tool) => tool.Category === STATION05_CATEGORY);
}
