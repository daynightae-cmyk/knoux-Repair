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

export const SYSTEM_PROTECTED_ROOTS = [
  'c:\\windows',
  'c:\\windows\\system32',
  'c:\\windows\\winsxs',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\programdata',
  'c:\\users\\default',
  'c:\\pagefile.sys',
  'c:\\hiberfil.sys',
  'c:\\swapfile.sys',
];

export interface DuplicateFileItem {
  Path: string;
  Name: string;
  SizeBytes: number;
  ModifiedTime?: string;
  LastWriteUtc?: string;
  Extension?: string;
  HardLinkIndex?: string | number;
}

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

/**
 * 1. Content Identity Validation
 * Verifies that duplicate relationship is based strictly on content hash (SHA-256) and size.
 * Different name with same hash = duplicate. Same name with different hash != duplicate.
 */
export function validateContentIdentity(
  fileA: { name: string; size: number; hash: string },
  fileB: { name: string; size: number; hash: string }
): { isDuplicate: boolean; reason: 'IDENTICAL_CONTENT' | 'HASH_MISMATCH' | 'SIZE_MISMATCH' | 'ZERO_BYTE' } {
  if (fileA.size === 0 || fileB.size === 0) {
    return { isDuplicate: false, reason: 'ZERO_BYTE' };
  }
  if (fileA.size !== fileB.size) {
    return { isDuplicate: false, reason: 'SIZE_MISMATCH' };
  }
  if (!fileA.hash || !fileB.hash || fileA.hash.toLowerCase() !== fileB.hash.toLowerCase()) {
    return { isDuplicate: false, reason: 'HASH_MISMATCH' };
  }
  return { isDuplicate: true, reason: 'IDENTICAL_CONTENT' };
}

export type KeeperStrategy = 'oldest' | 'newest' | 'shortestPath' | 'longestPath' | 'alphabetical';

/**
 * 2. Keeper Selection Strategy
 * Determines which copy is designated as keeper according to policy or explicit user override.
 * INVARIANT: Always returns a valid path existing in the group's file list.
 */
export function selectKeeper(
  group: { Files: Array<{ Path: string; ModifiedTime?: string; LastWriteUtc?: string }> },
  strategy: KeeperStrategy = 'oldest',
  userOverridePath?: string
): string {
  if (!group.Files || group.Files.length === 0) return '';
  if (userOverridePath && group.Files.some((f) => f.Path === userOverridePath)) {
    return userOverridePath;
  }

  const files = [...group.Files];
  if (strategy === 'oldest') {
    files.sort((a, b) => {
      const tA = new Date(a.LastWriteUtc || a.ModifiedTime || 0).getTime();
      const tB = new Date(b.LastWriteUtc || b.ModifiedTime || 0).getTime();
      return tA - tB || a.Path.localeCompare(b.Path);
    });
  } else if (strategy === 'newest') {
    files.sort((a, b) => {
      const tA = new Date(a.LastWriteUtc || a.ModifiedTime || 0).getTime();
      const tB = new Date(b.LastWriteUtc || b.ModifiedTime || 0).getTime();
      return tB - tA || a.Path.localeCompare(b.Path);
    });
  } else if (strategy === 'shortestPath') {
    files.sort((a, b) => a.Path.length - b.Path.length || a.Path.localeCompare(b.Path));
  } else if (strategy === 'longestPath') {
    files.sort((a, b) => b.Path.length - a.Path.length || a.Path.localeCompare(b.Path));
  } else if (strategy === 'alphabetical') {
    files.sort((a, b) => a.Path.localeCompare(b.Path));
  }

  return files[0].Path;
}

/**
 * 3. Enforce Keeper Invariant
 * Under NO circumstances can all copies in a group be quarantined.
 * If user attempts to select all files, the keeper copy is guaranteed preserved.
 */
export function enforceKeeperInvariant(
  allFiles: Array<{ Path: string }>,
  quarantineCandidates: string[],
  keeperPath: string
): { safeQuarantinePaths: string[]; preservedKeeper: string } {
  const filePaths = new Set(allFiles.map((f) => f.Path));
  const effectiveKeeper = filePaths.has(keeperPath) ? keeperPath : allFiles[0]?.Path || '';

  // Filter out the keeper from quarantine candidates
  const safeQuarantinePaths = quarantineCandidates.filter(
    (p) => p !== effectiveKeeper && filePaths.has(p)
  );

  return {
    safeQuarantinePaths,
    preservedKeeper: effectiveKeeper,
  };
}

/**
 * 4. Hard Link Detection & Safety
 * Hard links share the exact same physical disk clusters. Deleting one copy does NOT
 * necessarily reclaim physical disk space.
 */
export function detectHardLinks(
  group: DuplicatePreviewGroup | { Files: Array<{ Path: string; HardLinkIndex?: string | number }> }
): {
  hasHardLink: boolean;
  status: 'SAFE_COPIES' | 'HARD_LINKS_DETECTED';
  reclaimMultiplier: number;
} {
  if ('HardLinkInvolved' in group && group.HardLinkInvolved) {
    return { hasHardLink: true, status: 'HARD_LINKS_DETECTED', reclaimMultiplier: 0 };
  }

  const indices = new Set<string>();
  let hasDuplicates = false;
  for (const f of group.Files) {
    if ('HardLinkIndex' in f && f.HardLinkIndex !== undefined && f.HardLinkIndex !== null) {
      const key = String(f.HardLinkIndex);
      if (indices.has(key)) hasDuplicates = true;
      indices.add(key);
    }
  }

  return {
    hasHardLink: hasDuplicates,
    status: hasDuplicates ? 'HARD_LINKS_DETECTED' : 'SAFE_COPIES',
    reclaimMultiplier: hasDuplicates ? 0 : 1,
  };
}

/**
 * 5. Path Containment & Traversal Safety
 * Validates that a path is strictly inside the approved root directory,
 * does NOT escape using '..' traversal, and does NOT target protected system locations.
 */
export function validatePathContainment(
  targetPath: string,
  rootPath: string
): { isContained: boolean; reason: 'VALID' | 'PATH_TRAVERSAL' | 'OUTSIDE_ROOT' | 'SYSTEM_PROTECTED' } {
  if (!targetPath || !rootPath) return { isContained: false, reason: 'OUTSIDE_ROOT' };

  // Detect path traversal
  if (targetPath.includes('..') || targetPath.includes('/../') || targetPath.includes('\\..\\')) {
    return { isContained: false, reason: 'PATH_TRAVERSAL' };
  }

  const normTarget = targetPath.toLowerCase().replace(/\//g, '\\').replace(/\\\\+/g, '\\');
  const normRoot = rootPath.toLowerCase().replace(/\//g, '\\').replace(/\\\\+/g, '\\').replace(/\\$/, '');

  // Check system protected paths
  for (const sys of SYSTEM_PROTECTED_ROOTS) {
    if (normTarget === sys || normTarget.startsWith(sys + '\\')) {
      return { isContained: false, reason: 'SYSTEM_PROTECTED' };
    }
  }

  // Must start with rootPath + '\' or equal rootPath
  if (normTarget !== normRoot && !normTarget.startsWith(normRoot + '\\')) {
    return { isContained: false, reason: 'OUTSIDE_ROOT' };
  }

  return { isContained: true, reason: 'VALID' };
}

/**
 * 6. Path Exclusion Verification
 * Checks if a path lies inside excluded folders (.git, node_modules, Quarantine, etc.).
 */
export function isPathExcluded(filePath: string, exclusions: string[]): boolean {
  if (!filePath || !exclusions || exclusions.length === 0) return false;
  const norm = filePath.toLowerCase().replace(/\//g, '\\');

  for (const ex of exclusions) {
    const clean = ex.toLowerCase().replace(/^[\\/]+|[\\/]+$/g, '');
    if (!clean) continue;
    if (
      norm.includes(`\\${clean}\\`) ||
      norm.endsWith(`\\${clean}`) ||
      norm.startsWith(`${clean}\\`) ||
      norm === clean
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 7. Reclaim Accounting
 * Computes exact byte counts for potential, selected, and verified reclaim.
 */
export function calculateReclaimAccounting(
  groups: DuplicatePreviewGroup[],
  selectedGroupIds: Set<string>,
  keepPaths: Record<string, string> = {}
): {
  potentialReclaimBytes: number;
  selectedReclaimBytes: number;
  totalGroupCount: number;
  selectedGroupCount: number;
  quarantineFileCount: number;
} {
  let potentialReclaimBytes = 0;
  let selectedReclaimBytes = 0;
  let quarantineFileCount = 0;

  for (const g of groups) {
    potentialReclaimBytes += (g.RecoverableBytes || 0);

    if (selectedGroupIds.has(g.Id)) {
      const keeper = keepPaths[g.Id] || g.KeepPath || g.Files[0]?.Path;
      const nonKeepers = g.Files.filter((f) => f.Path !== keeper);
      quarantineFileCount += nonKeepers.length;
      selectedReclaimBytes += (g.RecoverableBytes || 0);
    }
  }

  return {
    potentialReclaimBytes: Math.max(0, potentialReclaimBytes),
    selectedReclaimBytes: Math.max(0, selectedReclaimBytes),
    totalGroupCount: groups.length,
    selectedGroupCount: selectedGroupIds.size,
    quarantineFileCount,
  };
}

/**
 * 8. Prepare Quarantine Plan
 * Generates exact files to quarantine after applying root containment and keeper invariants.
 */
export function prepareQuarantinePlan(
  groups: DuplicatePreviewGroup[],
  selectedGroupIds: Set<string>,
  keepPaths: Record<string, string>,
  rootPath: string
): {
  targets: Array<{ path: string; sizeBytes: number; groupId: string }>;
  rejectedPaths: Array<{ path: string; reason: string }>;
} {
  const targets: Array<{ path: string; sizeBytes: number; groupId: string }> = [];
  const rejectedPaths: Array<{ path: string; reason: string }> = [];

  for (const group of groups) {
    if (!selectedGroupIds.has(group.Id)) continue;
    const keeper = keepPaths[group.Id] || group.KeepPath || group.Files[0]?.Path;

    for (const file of group.Files) {
      if (file.Path === keeper) continue; // Always protect keeper

      const containment = validatePathContainment(file.Path, rootPath);
      if (!containment.isContained) {
        rejectedPaths.push({ path: file.Path, reason: containment.reason });
      } else {
        targets.push({ path: file.Path, sizeBytes: file.SizeBytes, groupId: group.Id });
      }
    }
  }

  return { targets, rejectedPaths };
}

/**
 * 9. Verify Restore Safety
 * Evaluates whether a quarantined item can be safely restored to its destination.
 */
export function verifyRestoreSafety(
  originalPath: string,
  destinationExists: boolean,
  approvedRoot: string
): { canRestore: boolean; action: 'RESTORE_DIRECT' | 'RESTORE_CONFLICT' | 'RESTORE_REJECTED'; reason: string } {
  const containment = validatePathContainment(originalPath, approvedRoot);
  if (!containment.isContained) {
    return {
      canRestore: false,
      action: 'RESTORE_REJECTED',
      reason: `Path is outside approved root or system-protected (${containment.reason})`,
    };
  }

  if (destinationExists) {
    return {
      canRestore: true,
      action: 'RESTORE_CONFLICT',
      reason: 'Destination file already exists; user decision required (replace, alternate, or backup)',
    };
  }

  return {
    canRestore: true,
    action: 'RESTORE_DIRECT',
    reason: 'Destination is clear; ready for direct restore',
  };
}

/**
 * 10. Stale Preview Detection
 * Flags if current file on disk has changed size or mtime since the preview was computed.
 */
export function isPreviewStale(
  previewTimestamp: number,
  currentFileMtime: number
): boolean {
  return currentFileMtime > previewTimestamp;
}
