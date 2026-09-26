/**
 * KNOUX REPAIR — Station 11: Backup & Recovery
 * Recovery Vault Domain Model
 * Pure deterministic functions for recovery readiness assessment,
 * restore point chronology, shadow copy parsing, local backup accounting,
 * and safety guardrails. Zero synthetic gamification.
 */

import type {
  BackupRecoveryPreview,
  BackupRecoveryRestorePoint,
  BridgeTool,
  KnouxRunResult,
} from '../../../lib/api';

export type RecoveryReadinessState = 'READY' | 'PARTIAL_COVERAGE' | 'UNPROTECTED' | 'INCONCLUSIVE';

/**
 * Whether a recovery mechanism could actually be read on this machine.
 *
 * `UNREADABLE` is deliberately distinct from an empty read: a restore-point query
 * that is unavailable tells us nothing about how many restore points exist, so it
 * must never be folded into a count of zero.
 */
export type RecoverySourceRead = 'READABLE' | 'READABLE_EMPTY' | 'UNREADABLE';

export interface RecoveryReadinessSummary {
  hasTelemetry: boolean;
  state: RecoveryReadinessState;
  restorePointsCount: number;
  shadowCopiesCount: number;
  localBackupsCount: number;
  /** Per-mechanism read state, so the UI never shows a zero it could not verify. */
  restorePointsRead: RecoverySourceRead;
  shadowCopiesRead: RecoverySourceRead;
  localBackupsRead: RecoverySourceRead;
  hasLatestLocalBackup: boolean;
  latestBackupName: string | null;
  latestBackupBytes: number;
  latestBackupFiles: number;
  sourcesVerifiedCount: number;
  totalSourcesCount: number;
  projectDriveFreeGB: number | null;
}

export interface RecoverySignal {
  code: string;
  level: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  messageEn: string;
  messageAr: string;
  suggestedTool: string;
  evidenceSource: string;
}

export interface StationHistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE';
  itemsProcessed: number | null;
  summary: string;
}

export const STATION11_TOOL_IDS = [
  'BR01', 'BR02', 'BR03', 'BR04', 'BR05',
] as const;

/**
 * Categorical recovery readiness derived truthfully from observed points
 */
export function deriveRecoveryReadiness(
  restorePoints: number,
  shadowCopies: number,
  localBackups: number,
  restorePointsRead: RecoverySourceRead = 'READABLE',
  shadowCopiesRead: RecoverySourceRead = 'READABLE',
  localBackupsRead: RecoverySourceRead = 'READABLE',
): RecoveryReadinessState {
  const reads = [restorePointsRead, shadowCopiesRead, localBackupsRead];

  // Nothing could be read. "We could not check" is not "you are unprotected",
  // and must never be reported as a safety judgement about the user's machine.
  if (reads.every(read => read === 'UNREADABLE')) {
    return 'INCONCLUSIVE';
  }

  const readableTotal = (count: number, read: RecoverySourceRead) =>
    read === 'UNREADABLE' ? null : count;

  const measured = [
    readableTotal(restorePoints, restorePointsRead),
    readableTotal(shadowCopies, shadowCopiesRead),
    readableTotal(localBackups, localBackupsRead),
  ].filter((value): value is number => value !== null);

  const hasCoverage = restorePoints > 0 || shadowCopies > 0 || localBackups > 0;

  // High readiness: system restore point available AND local backup exists
  if (restorePoints > 0 && localBackups > 0) {
    return 'READY';
  }

  // Partial coverage: has one readable mechanism with something in it
  if (hasCoverage) {
    return 'PARTIAL_COVERAGE';
  }

  // Every mechanism that could be read was read and held nothing. Only a genuinely
  // verified empty set may be called unprotected.
  if (measured.length > 0) {
    return 'UNPROTECTED';
  }

  return 'INCONCLUSIVE';
}

/**
 * Summarizes the recovery preview telemetry
 */
export function summarizeRecoveryVault(
  preview: BackupRecoveryPreview | null | undefined
): RecoveryReadinessSummary {
  if (!preview) {
    return {
      hasTelemetry: false,
      state: 'INCONCLUSIVE',
      restorePointsCount: 0,
      shadowCopiesCount: 0,
      localBackupsCount: 0,
      restorePointsRead: 'UNREADABLE',
      shadowCopiesRead: 'UNREADABLE',
      localBackupsRead: 'UNREADABLE',
      hasLatestLocalBackup: false,
      latestBackupName: null,
      latestBackupBytes: 0,
      latestBackupFiles: 0,
      sourcesVerifiedCount: 0,
      totalSourcesCount: 0,
      projectDriveFreeGB: null,
    };
  }

  // A source that could not be queried yields no count and no "empty" claim.
  const restorePointsRead: RecoverySourceRead = !preview.RestorePoints?.QueryAvailable
    ? 'UNREADABLE'
    : (preview.RestorePoints?.Count ?? 0) > 0 ? 'READABLE' : 'READABLE_EMPTY';
  const shadowCopiesRead: RecoverySourceRead = !preview.ShadowCopies?.QueryAvailable
    ? 'UNREADABLE'
    : (preview.ShadowCopies?.Count ?? 0) > 0 ? 'READABLE' : 'READABLE_EMPTY';
  const localBackupsRead: RecoverySourceRead = !preview.LocalBackups?.RootAvailable
    ? 'UNREADABLE'
    : (preview.LocalBackups?.Count ?? 0) > 0 ? 'READABLE' : 'READABLE_EMPTY';

  const restorePointsCount = restorePointsRead === 'UNREADABLE' ? 0 : (preview.RestorePoints?.Count ?? 0);
  const shadowCopiesCount = shadowCopiesRead === 'UNREADABLE' ? 0 : (preview.ShadowCopies?.Count ?? 0);
  const localBackupsCount = localBackupsRead === 'UNREADABLE' ? 0 : (preview.LocalBackups?.Count ?? 0);
  const latest = preview.LocalBackups?.Latest ?? null;
  const sources = preview.BackupSources ?? [];
  const sourcesVerified = sources.filter((s) => s.Exists).length;

  const state = deriveRecoveryReadiness(
    restorePointsCount,
    shadowCopiesCount,
    localBackupsCount,
    restorePointsRead,
    shadowCopiesRead,
    localBackupsRead,
  );

  return {
    hasTelemetry: true,
    state,
    restorePointsCount,
    shadowCopiesCount,
    localBackupsCount,
    restorePointsRead,
    shadowCopiesRead,
    localBackupsRead,
    hasLatestLocalBackup: Boolean(latest),
    latestBackupName: latest?.Name ?? null,
    latestBackupBytes: latest?.SizeBytes ?? 0,
    latestBackupFiles: latest?.FileCount ?? 0,
    sourcesVerifiedCount: sourcesVerified,
    totalSourcesCount: sources.length,
    projectDriveFreeGB: preview.Storage?.FreeGB ?? null,
  };
}

/**
 * Chronologically sorts restore points descending (newest first)
 */
export function sortRestorePoints(
  points: BackupRecoveryRestorePoint[] | null | undefined
): BackupRecoveryRestorePoint[] {
  if (!points || points.length === 0) return [];
  return [...points].sort((a, b) => b.SequenceNumber - a.SequenceNumber);
}

/**
 * Formats byte capacity for bilingual presentation
 */
export function formatBytes(bytes: number, lang: 'en' | 'ar'): string {
  if (bytes <= 0) return '0 B';
  const unitsEn = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitsAr = ['بايت', 'ك.ب', 'م.ب', 'ج.ب', 'ت.ب'];
  const units = lang === 'ar' ? unitsAr : unitsEn;

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

/**
 * Detects recovery risk signals with suggested tools
 */
export function detectRecoverySignals(summary: RecoveryReadinessSummary): RecoverySignal[] {
  if (summary.state === 'INCONCLUSIVE') return [];
  const signals: RecoverySignal[] = [];

  // A mechanism that could not be queried yields no signal at all: "no restore
  // points found" would be a HIGH-severity claim the evidence does not support.
  if (summary.restorePointsRead !== 'UNREADABLE' && summary.restorePointsCount === 0) {
    signals.push({
      code: 'NO_RESTORE_POINTS',
      level: 'HIGH',
      messageEn: 'No Windows System Restore Points detected on this machine.',
      messageAr: 'لم يتم العثور على أي نقطة استعادة لنظام ويندوز على هذا الجهاز.',
      suggestedTool: 'BR01',
      evidenceSource: 'Get-ComputerRestorePoint (VSS)',
    });
  }

  if (summary.localBackupsRead !== 'UNREADABLE' && summary.localBackupsCount === 0) {
    signals.push({
      code: 'NO_LOCAL_PROFILE_BACKUP',
      level: 'MEDIUM',
      messageEn: 'No local Knoux user profile backup found.',
      messageAr: 'لا توجد نسخة احتياطية محلية مسجلة لملفات المستخدم.',
      suggestedTool: 'BR02',
      evidenceSource: 'Local Backups directory',
    });
  }

  if (summary.projectDriveFreeGB !== null && summary.projectDriveFreeGB < 10) {
    signals.push({
      code: 'LOW_BACKUP_STORAGE',
      level: 'MEDIUM',
      messageEn: `Backup target drive has only ${summary.projectDriveFreeGB} GB free storage.`,
      messageAr: `المساحة المتبقية على قرص النسخ الاحتياطي هي ${summary.projectDriveFreeGB} ج.ب فقط.`,
      suggestedTool: 'BR04',
      evidenceSource: 'Drive storage capacity check',
    });
  }

  return signals;
}

/**
 * Filters registered tools to Station 11 tools
 */
export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  const ids = new Set<string>(STATION11_TOOL_IDS);
  return tools.filter((t) => ids.has(t.ToolId) && t.Category === '11-Backup-Recovery');
}

/**
 * Maps execution result to standardized history status
 */
export function outcomeFromRun(
  result: KnouxRunResult | null | undefined
): 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE' {
  if (!result) return 'INCONCLUSIVE';
  if (result.Status === 'Cancelled') return 'CANCELLED';
  if (result.Status === 'Success') return 'SUCCESS';
  if (result.Status === 'Warning') return 'WARNING';
  if (result.Status === 'Failed' || result.ExitCode !== 0) return 'FAILED';
  return 'INCONCLUSIVE';
}
