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

export interface RecoveryReadinessSummary {
  state: RecoveryReadinessState;
  restorePointsCount: number;
  shadowCopiesCount: number;
  localBackupsCount: number;
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
  itemsProcessed: number;
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
  localBackups: number
): RecoveryReadinessState {
  if (restorePoints === 0 && shadowCopies === 0 && localBackups === 0) {
    return 'UNPROTECTED';
  }

  // High readiness: system restore point available AND local backup exists
  if (restorePoints > 0 && localBackups > 0) {
    return 'READY';
  }

  // Partial coverage: has one mechanism but missing the other
  if (restorePoints > 0 || shadowCopies > 0 || localBackups > 0) {
    return 'PARTIAL_COVERAGE';
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
      state: 'INCONCLUSIVE',
      restorePointsCount: 0,
      shadowCopiesCount: 0,
      localBackupsCount: 0,
      hasLatestLocalBackup: false,
      latestBackupName: null,
      latestBackupBytes: 0,
      latestBackupFiles: 0,
      sourcesVerifiedCount: 0,
      totalSourcesCount: 0,
      projectDriveFreeGB: null,
    };
  }

  const restorePointsCount = preview.RestorePoints?.Count ?? 0;
  const shadowCopiesCount = preview.ShadowCopies?.Count ?? 0;
  const localBackupsCount = preview.LocalBackups?.Count ?? 0;
  const latest = preview.LocalBackups?.Latest ?? null;
  const sources = preview.BackupSources ?? [];
  const sourcesVerified = sources.filter((s) => s.Exists).length;

  const state = deriveRecoveryReadiness(
    restorePointsCount,
    shadowCopiesCount,
    localBackupsCount
  );

  return {
    state,
    restorePointsCount,
    shadowCopiesCount,
    localBackupsCount,
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
  const signals: RecoverySignal[] = [];

  if (summary.restorePointsCount === 0) {
    signals.push({
      code: 'NO_RESTORE_POINTS',
      level: 'HIGH',
      messageEn: 'No Windows System Restore Points detected on this machine.',
      messageAr: 'لم يتم العثور على أي نقطة استعادة لنظام ويندوز على هذا الجهاز.',
      suggestedTool: 'BR01',
      evidenceSource: 'Get-ComputerRestorePoint (VSS)',
    });
  }

  if (summary.localBackupsCount === 0) {
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
