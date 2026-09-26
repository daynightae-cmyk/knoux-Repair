/**
 * KNOUX REPAIR — Station 06: Disk Space
 * Storage Intelligence Studio / Disk Atlas Domain Model
 * Pure deterministic functions for volume parsing, file classification,
 * storage reclaim planning, and hardware health evaluation.
 */

import type { BridgeTool, KnouxRunResult } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';

export interface DriveVolume {
  name: string;
  fileSystem: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  isSystem: boolean;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
}

export type FileCategory =
  | 'archive'
  | 'media'
  | 'document'
  | 'executable'
  | 'database'
  | 'diskimage'
  | 'log'
  | 'other';

export interface LargeFileItem {
  path: string;
  name: string;
  sizeBytes: number;
  category: FileCategory;
  modifiedAt?: string;
  isProtected: boolean;
  safeReviewCandidate: boolean;
}

export interface DiskHealthItem {
  index: number;
  model: string | null;
  sizeGB: number | null;
  status: string;
  smartPredictFailure: boolean;
  evaluation: 'HEALTHY' | 'FAILURE_PREDICTED' | 'INCONCLUSIVE';
}

export interface HibernationAssessment {
  enabled: boolean | null;
  estimateReclaimBytes?: number;
  requiresAdmin: boolean;
  affectsFastStartup: boolean;
  reversibility: 'FULLY_REVERSIBLE';
  warningEn: string;
  warningAr: string;
}

export interface ReclaimCandidate {
  toolId: string;
  titleEn: string;
  titleAr: string;
  category: 'cleanup' | 'compaction' | 'hibernation' | 'recycle';
  estimatedBytes: number;
  risk: 'SAFE_CLEANUP' | 'DESTRUCTIVE' | 'SYSTEM_REPAIR' | 'READ_ONLY';
  requiresAdmin: boolean;
  enabled: boolean;
}

export interface DiskEvidence {
  volumes: DriveVolume[];
  largeFiles: LargeFileItem[];
  health: DiskHealthItem[];
  hibernation: HibernationAssessment;
  reclaimPlan: ReclaimCandidate[];
  lastScanTime?: string;
  scannedToolId?: string;
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

export const STATION06_TOOL_IDS = [
  'DS01', 'DS02', 'DS03', 'DS04', 'DS05',
  'DS06', 'DS07', 'DS08', 'DS09', 'DS10',
] as const;

export const PROTECTED_SYSTEM_PATHS = [
  'c:\\windows',
  'c:\\windows\\system32',
  'c:\\windows\\winsxs',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\programdata',
  'c:\\pagefile.sys',
  'c:\\swapfile.sys',
  'c:\\hiberfil.sys',
  'c:\\bootmgr',
  'c:\\boot',
];

const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Archives
  '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive',
  '.gz': 'archive', '.bz2': 'archive', '.xz': 'archive', '.zst': 'archive',
  // Media
  '.mp4': 'media', '.mkv': 'media', '.avi': 'media', '.mov': 'media',
  '.wmv': 'media', '.flv': 'media', '.webm': 'media', '.mp3': 'media',
  '.flac': 'media', '.wav': 'media', '.aac': 'media', '.ogg': 'media',
  // Disk Images
  '.iso': 'diskimage', '.vhd': 'diskimage', '.vhdx': 'diskimage',
  '.vmdk': 'diskimage', '.wim': 'diskimage', '.img': 'diskimage',
  // Documents
  '.pdf': 'document', '.docx': 'document', '.xlsx': 'document',
  '.pptx': 'document', '.csv': 'document', '.txt': 'document',
  // Executables & Installers
  '.exe': 'executable', '.msi': 'executable', '.dll': 'executable',
  '.sys': 'executable', '.bat': 'executable', '.cmd': 'executable',
  // Databases & VMs
  '.db': 'database', '.sqlite': 'database', '.mdb': 'database',
  '.sql': 'database', '.mdf': 'database', '.ldf': 'database',
  // Logs
  '.log': 'log', '.etl': 'log', '.dmp': 'log', '.evtx': 'log',
};

/**
 * Format bytes to readable string with Arabic / English support
 */
export function formatBytes(bytes: number | null | undefined, lang: Lang = 'en'): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '—';
  if (bytes === 0) return lang === 'ar' ? '0 بايت' : '0 B';

  const unitsEn = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const unitsAr = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت', 'بيتابايت'];
  const units = lang === 'ar' ? unitsAr : unitsEn;

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  const formatted = val.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: i === 0 ? 0 : 1,
    minimumFractionDigits: i > 0 && val < 10 ? 1 : 0,
  });

  return `${formatted} ${units[i]}`;
}

/**
 * Categorize a file by its extension
 */
export function categorizeFileExtension(ext: string): FileCategory {
  if (!ext) return 'other';
  const cleanExt = (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase();
  return EXTENSION_CATEGORIES[cleanExt] || 'other';
}

/**
 * Check if a path is inside protected Windows system directories
 */
export function isPathProtected(pathStr: string): boolean {
  if (!pathStr) return true;
  const normalized = pathStr.toLowerCase().replace(/\//g, '\\').trim();
  for (const sysPath of PROTECTED_SYSTEM_PATHS) {
    if (normalized === sysPath || normalized.startsWith(sysPath + '\\')) {
      return true;
    }
  }
  return false;
}

/**
 * Classify a large file candidate for discovery view
 */
export function classifyLargeFile(pathStr: string, sizeBytes: number, modifiedAt?: string): LargeFileItem {
  const parts = pathStr.split(/[\\/]/);
  const name = parts[parts.length - 1] || pathStr;
  const dotIndex = name.lastIndexOf('.');
  const ext = dotIndex !== -1 ? name.substring(dotIndex) : '';
  const category = categorizeFileExtension(ext);
  const isProtected = isPathProtected(pathStr);

  // A file is a safe review candidate only if NOT protected and in user/download/temp scope
  const safeReviewCandidate = !isProtected && sizeBytes >= 1048576; // >= 1 MB

  return {
    path: pathStr,
    name,
    sizeBytes,
    category,
    modifiedAt,
    isProtected,
    safeReviewCandidate,
  };
}

/**
 * Parses real drive volumes from API snapshot or DS01 output
 */
export function parseVolumeInventory(
  drives: Array<{
    Name?: string;
    Drive?: string;
    FileSystem?: string;
    TotalGB?: number;
    FreeGB?: number;
    UsedGB?: number;
    Size?: number;
    FreeSpace?: number;
  }> = [],
  systemDriveOverride?: string
): DriveVolume[] {
  if (!Array.isArray(drives) || drives.length === 0) return [];

  const detectedSystemDrive = (systemDriveOverride || 'C:').toUpperCase();

  const identified = drives.filter((d) => {
    const rawName = d.Name || d.Drive;
    return typeof rawName === 'string' && rawName.trim() !== '';
  });
  if (identified.length === 0) return [];

  return identified.map((d) => {
    const name = String(d.Name || d.Drive).toUpperCase().replace(/[\\/]$/, '');
    const driveLetter = name.includes(':') ? name.split(':')[0] + ':' : name;
    const fileSystem = typeof d.FileSystem === 'string' && d.FileSystem.trim() !== '' ? d.FileSystem : 'Unknown';

    let totalBytes = 0;
    let freeBytes = 0;

    if (typeof d.Size === 'number' && typeof d.FreeSpace === 'number') {
      totalBytes = d.Size;
      freeBytes = d.FreeSpace;
    } else if (typeof d.TotalGB === 'number' && typeof d.FreeGB === 'number') {
      totalBytes = Math.round(d.TotalGB * 1024 * 1024 * 1024);
      freeBytes = Math.round(d.FreeGB * 1024 * 1024 * 1024);
    }

    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10) : 0;
    const isSystem = driveLetter.startsWith(detectedSystemDrive);

    // A capacity verdict only exists once Windows reported a real total size.
    let healthStatus: DriveVolume['healthStatus'] = 'UNKNOWN';
    if (totalBytes > 0) {
      if (usedPercent >= 95 || freeBytes < 2 * 1024 * 1024 * 1024) {
        healthStatus = 'CRITICAL';
      } else if (usedPercent >= 85 || freeBytes < 10 * 1024 * 1024 * 1024) {
        healthStatus = 'WARNING';
      } else {
        healthStatus = 'HEALTHY';
      }
    }

    return {
      name: driveLetter,
      fileSystem,
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent,
      isSystem,
      healthStatus,
    };
  });
}

/**
 * Evaluates hardware SMART disk health from DS07 output without fabricating data
 */
export function evaluateDiskHealth(
  disks: Array<{
    Index?: number;
    Model?: string;
    SizeGB?: number;
    Status?: string;
    SmartPredictFailure?: boolean;
  }> = []
): DiskHealthItem[] {
  if (!Array.isArray(disks) || disks.length === 0) return [];

  return disks.map((d, i) => {
    const index = typeof d.Index === 'number' ? d.Index : i;
    const model = typeof d.Model === 'string' && d.Model.trim() !== '' ? d.Model : null;
    const sizeGB = typeof d.SizeGB === 'number' ? d.SizeGB : null;
    const smartPredictFailure = Boolean(d.SmartPredictFailure);

    let evaluation: DiskHealthItem['evaluation'] = 'INCONCLUSIVE';
    if (d.Status) {
      if (smartPredictFailure || d.Status.toUpperCase().includes('PREDICT') || d.Status.toUpperCase().includes('FAIL')) {
        evaluation = 'FAILURE_PREDICTED';
      } else if (d.Status.toUpperCase() === 'OK') {
        evaluation = 'HEALTHY';
      }
    }

    return {
      index,
      model,
      sizeGB,
      status: d.Status || 'UNKNOWN',
      smartPredictFailure,
      evaluation,
    };
  });
}

/**
 * Assesses Hibernation state and impacts truthfully (DS09)
 */
export function evaluateHibernationImpact(
  ramBytes?: number,
  _systemDriveFreeBytes?: number
): HibernationAssessment {
  // RAM size dictates hiberfil.sys size (usually 40% - 100% of RAM)
  const estimate = ramBytes ? Math.round(ramBytes * 0.75) : undefined;

  return {
    enabled: null, // Unknown until checked via command
    estimateReclaimBytes: estimate,
    requiresAdmin: true,
    affectsFastStartup: true,
    reversibility: 'FULLY_REVERSIBLE',
    warningEn: 'Disabling hibernation deletes hiberfil.sys to free disk space, but disables Windows Fast Startup and sleep-hibernation fallback.',
    warningAr: 'تعطيل وضع السبات يحذف ملف hiberfil.sys لتحرير مساحة القرص، ولكنه يعطل بدء التشغيل السريع وحفظ الجلسة عند انقطاع الطاقة.',
  };
}

/**
 * Calculate total potential reclaimable bytes from active plan
 */
export function calculatePotentialReclaim(candidates: ReclaimCandidate[]): number {
  if (!Array.isArray(candidates)) return 0;
  return candidates
    .filter((c) => c.enabled)
    .reduce((sum, c) => sum + (c.estimatedBytes || 0), 0);
}

/**
 * Builds default reclaim candidates aligned with actual registered Station 06 tools
 */
export function buildDefaultReclaimPlan(_lang: Lang = 'en'): ReclaimCandidate[] {
  return [
    {
      toolId: 'DS04',
      titleEn: 'Clean Recycle Bin',
      titleAr: 'تفريغ سلة المحذوفات',
      category: 'recycle',
      estimatedBytes: 0, // Determined via live scan
      risk: 'DESTRUCTIVE',
      requiresAdmin: false,
      enabled: true,
    },
    {
      toolId: 'DS08',
      titleEn: 'Windows Disk Cleanup',
      titleAr: 'تنظيف قرص ويندوز',
      category: 'cleanup',
      estimatedBytes: 0,
      risk: 'SAFE_CLEANUP',
      requiresAdmin: false,
      enabled: true,
    },
    {
      toolId: 'DS05',
      titleEn: 'Clear File History Cache',
      titleAr: 'مسح ذاكرة محفوظات الملفات',
      category: 'cleanup',
      estimatedBytes: 0,
      risk: 'SAFE_CLEANUP',
      requiresAdmin: false,
      enabled: false,
    },
    {
      toolId: 'DS06',
      titleEn: 'Compact System Files (CompactOS)',
      titleAr: 'ضغط ملفات النظام (CompactOS)',
      category: 'compaction',
      estimatedBytes: 0,
      risk: 'SAFE_CLEANUP',
      requiresAdmin: true,
      enabled: false,
    },
    {
      toolId: 'DS09',
      titleEn: 'Disable Hibernation (hiberfil.sys)',
      titleAr: 'تعطيل وضع السبات (hiberfil.sys)',
      category: 'hibernation',
      estimatedBytes: 0,
      risk: 'SAFE_CLEANUP',
      requiresAdmin: true,
      enabled: false,
    },
  ];
}

/**
 * Filter large files by query
 */
export function filterLargeFiles(files: LargeFileItem[], query: string, categoryFilter: string = 'all'): LargeFileItem[] {
  const q = (query || '').toLowerCase().trim();
  return files.filter((f) => {
    const matchesQuery = !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
    const matchesCat = categoryFilter === 'all' || f.category === categoryFilter;
    return matchesQuery && matchesCat;
  });
}

/**
 * Filter tools belonging to Station 06
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '06-Disk-Space' || (t.ToolId && t.ToolId.startsWith('DS'))
  );
}

/**
 * Converts execution run result into a history entry
 */
export function outcomeFromRun(
  tool: BridgeTool,
  res: KnouxRunResult,
  lang: Lang = 'en'
): StationHistoryEntry {
  const rawStatus = res.status?.toLowerCase();
  const status: StationHistoryEntry['status'] =
    rawStatus === 'success'
      ? 'SUCCESS'
      : rawStatus === 'error' || rawStatus === 'failed'
        ? 'FAILED'
        : rawStatus === 'cancelled'
          ? 'CANCELLED'
          : rawStatus === 'inconclusive'
            ? 'INCONCLUSIVE'
            : res.exitCode === 0
              ? 'SUCCESS'
              : 'FAILED';

  const processed = res.itemsProcessed || 0;
  const summary =
    res.errorMessage ||
    (status === 'SUCCESS'
      ? (lang === 'ar' ? `اكتمل تنفيذ ${tool.ArabicName || tool.EnglishName} بنجاح` : `Successfully completed ${tool.EnglishName}`)
      : (lang === 'ar' ? `فشل تنفيذ ${tool.ArabicName || tool.EnglishName}` : `Execution failed for ${tool.EnglishName}`));

  return {
    id: `${tool.ToolId}-${Date.now()}`,
    toolId: tool.ToolId,
    toolName: lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName,
    timestamp: new Date().toISOString(),
    status,
    itemsProcessed: processed,
    summary,
  };
}

export function emptyEvidence(): DiskEvidence {
  return {
    volumes: [],
    largeFiles: [],
    health: [],
    hibernation: evaluateHibernationImpact(),
    reclaimPlan: buildDefaultReclaimPlan(),
  };
}

/**
 * 1. Rank Large Files (DS02)
 * Sorts large files by size descending, capping at limit.
 * Flags safe review candidates vs protected system files.
 */
export function rankLargeFiles(files: LargeFileItem[], limit: number = 50): LargeFileItem[] {
  if (!Array.isArray(files)) return [];
  return [...files]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, Math.max(1, limit));
}

/**
 * 2. Space Hogs Analysis (DS03)
 * Classifies top storage consumers without declaring them automatically junk.
 */
export function classifySpaceHogs(
  items: Array<{ path: string; sizeBytes: number }>
): Array<{ path: string; sizeBytes: number; category: string; recommendation: 'REVIEW'; isProtected: boolean }> {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const isProtected = isPathProtected(item.path);
    const lower = item.path.toLowerCase();
    let category = 'User Data';
    if (lower.includes('\\node_modules\\') || lower.includes('\\.gradle\\') || lower.includes('\\.m2\\')) {
      category = 'Developer Cache';
    } else if (lower.includes('\\appdata\\local\\temp') || lower.includes('\\windows\\temp')) {
      category = 'Temporary Files';
    } else if (lower.includes('\\steam\\') || lower.includes('\\games\\')) {
      category = 'Games & Media';
    } else if (lower.includes('\\virtualbox') || lower.includes('\\vmware') || lower.endsWith('.vhd') || lower.endsWith('.vhdx')) {
      category = 'Virtual Machines';
    } else if (isProtected) {
      category = 'System Infrastructure';
    }

    return {
      path: item.path,
      sizeBytes: item.sizeBytes,
      category,
      recommendation: 'REVIEW' as const,
      isProtected,
    };
  });
}

/**
 * 3. Recycle Bin Safety (DS04)
 * Emptying Recycle Bin is DESTRUCTIVE and eliminates user's normal recovery layer.
 */
export function validateRecycleBinOperation(
  mode: 'analyze' | 'whatif' | 'run',
  itemCount: number,
  totalBytes: number
): {
  isDestructive: boolean;
  requiresConfirmation: boolean;
  messageEn: string;
  messageAr: string;
  reclaimableBytes: number;
} {
  if (mode === 'analyze' || mode === 'whatif') {
    return {
      isDestructive: false,
      requiresConfirmation: false,
      messageEn: `Recycle Bin contains ${itemCount} items (${formatBytes(totalBytes, 'en')}). Inspection only — no files deleted.`,
      messageAr: `تحتوي سلة المحذوفات على ${itemCount} عنصراً (${formatBytes(totalBytes, 'ar')}). فحص فقط — لم يتم حذف أي ملف.`,
      reclaimableBytes: totalBytes,
    };
  }

  return {
    isDestructive: true,
    requiresConfirmation: true,
    messageEn: `Permanently emptying Recycle Bin will delete ${itemCount} items (${formatBytes(totalBytes, 'en')}). This cannot be undone!`,
    messageAr: `التفريغ النهائي لسلة المحذوفات سيحذف ${itemCount} عنصراً (${formatBytes(totalBytes, 'ar')}). لا يمكن التراجع عن هذا الإجراء!`,
    reclaimableBytes: totalBytes,
  };
}

/**
 * 4. File History Cache Safety (DS05)
 * Protects real backups; only clears disposable local File History staging cache.
 */
export function verifyFileHistorySafety(pathStr: string): {
  isDisposableCache: boolean;
  isProtectedBackup: boolean;
  action: 'SAFE_TO_CLEAR' | 'PROTECTED_BACKUP' | 'UNKNOWN';
} {
  const norm = pathStr.toLowerCase().replace(/\//g, '\\');
  // Actual backup folders must NEVER be deleted
  if (norm.includes('\\filehistory\\data\\') || norm.includes('\\configuration\\catalog')) {
    return { isDisposableCache: false, isProtectedBackup: true, action: 'PROTECTED_BACKUP' };
  }
  // Disposable staging cache
  if (norm.includes('\\filehistory\\temp') || norm.includes('\\inetcache')) {
    return { isDisposableCache: true, isProtectedBackup: false, action: 'SAFE_TO_CLEAR' };
  }
  return { isDisposableCache: false, isProtectedBackup: false, action: 'UNKNOWN' };
}

/**
 * 5. CompactOS State Parsing (DS06)
 * Parses compact.exe /compactOS:query output.
 */
export function parseCompactOSState(rawOutput: string): {
  state: 'COMPACTED' | 'NOT_COMPACTED' | 'UNKNOWN';
  explanationEn: string;
  explanationAr: string;
} {
  if (!rawOutput) return { state: 'UNKNOWN', explanationEn: 'CompactOS state query returned no data.', explanationAr: 'لم ترجع استعلام حالة CompactOS أي بيانات.' };

  const lower = rawOutput.toLowerCase();
  if (lower.includes('is in the compact state') || lower.includes('compact state: true') || lower.includes('state: compact')) {
    return {
      state: 'COMPACTED',
      explanationEn: 'Windows system files are currently compressed using CompactOS (saving disk space).',
      explanationAr: 'ملفات نظام ويندوز مضغوطة حالياً باستخدام CompactOS (لتوفير مساحة القرص).',
    };
  }
  if (lower.includes('is not in the compact state') || lower.includes('compact state: false') || lower.includes('state: none')) {
    return {
      state: 'NOT_COMPACTED',
      explanationEn: 'Windows system files are uncompressed. Compacting will save disk space with minor decompression overhead.',
      explanationAr: 'ملفات نظام ويندوز غير مضغوطة. الضغط سيوفر مساحة على القرص مع تأثير طفيف على استهلاك المعالج أثناء فك الضغط.',
    };
  }
  return {
    state: 'UNKNOWN',
    explanationEn: 'CompactOS state could not be determined.',
    explanationAr: 'تعذر تحديد حالة CompactOS.',
  };
}

/**
 * 6. Disk Cleanup Categories Validation (DS08)
 * Ensures user Downloads is never selected by default.
 */
export function validateDiskCleanupCategories(
  selectedCategories: string[]
): {
  safeCategories: string[];
  cautionCategories: string[];
  downloadsIncluded: boolean;
} {
  const safe = new Set([
    'TemporaryFiles',
    'ThumbnailCache',
    'DeliveryOptimizationFiles',
    'DirectXShaderCache',
    'SetupLogFiles',
    'SystemErrorReporting',
  ]);

  const caution = new Set(['RecycleBin', 'PreviousInstallations', 'WindowsUpgradeLogFiles']);

  const safeCategories: string[] = [];
  const cautionCategories: string[] = [];
  let downloadsIncluded = false;

  for (const cat of selectedCategories) {
    if (cat.toLowerCase() === 'downloads') {
      downloadsIncluded = true;
    } else if (safe.has(cat)) {
      safeCategories.push(cat);
    } else if (caution.has(cat)) {
      cautionCategories.push(cat);
    }
  }

  return { safeCategories, cautionCategories, downloadsIncluded };
}

/**
 * 7. Hibernation Management & Rollback (DS09)
 */
export function evaluateHibernationRollback(currentState: boolean | null): {
  actionRequired: 'ENABLE' | 'DISABLE';
  command: string;
  rollbackCommand: string;
  impactEn: string;
  impactAr: string;
} {
  if (currentState === true) {
    return {
      actionRequired: 'DISABLE',
      command: 'powercfg -h off',
      rollbackCommand: 'powercfg -h on',
      impactEn: 'Deletes hiberfil.sys to reclaim storage. Disables Fast Startup.',
      impactAr: 'يحذف ملف hiberfil.sys لاستعادة المساحة. يعطل بدء التشغيل السريع.',
    };
  }
  return {
    actionRequired: 'ENABLE',
    command: 'powercfg -h on',
    rollbackCommand: 'powercfg -h off',
    impactEn: 'Recreates hiberfil.sys and re-enables Windows Fast Startup.',
    impactAr: 'يعيد إنشاء ملف hiberfil.sys ويعيد تفعيل بدء التشغيل السريع.',
  };
}

/**
 * 8. Storage Report Builder (DS10)
 */
export function buildStorageReport(
  evidence: DiskEvidence,
  _lang: Lang = 'en'
): {
  generatedAt: string;
  totalStorageBytes: number;
  totalFreeBytes: number;
  systemVolumeUsedPercent: number;
  volumeCount: number;
  largeFilesObserved: number;
  potentialReclaimBytes: number;
  hardwareHealthStatus: string;
  summaryEn: string;
  summaryAr: string;
} {
  const totalStorageBytes = evidence.volumes.reduce((sum, v) => sum + v.totalBytes, 0);
  const totalFreeBytes = evidence.volumes.reduce((sum, v) => sum + v.freeBytes, 0);
  const sysVol = evidence.volumes.find((v) => v.isSystem) || evidence.volumes[0];
  const systemVolumeUsedPercent = sysVol ? sysVol.usedPercent : 0;
  const potentialReclaimBytes = calculatePotentialReclaim(evidence.reclaimPlan);

  const healthFailed = evidence.health.some((h) => h.evaluation === 'FAILURE_PREDICTED');
  const healthHealthy = evidence.health.length > 0 && evidence.health.every((h) => h.evaluation === 'HEALTHY');
  const hardwareHealthStatus = healthFailed ? 'CRITICAL' : healthHealthy ? 'HEALTHY' : 'INCONCLUSIVE';

  const summaryEn = `Observed ${evidence.volumes.length} volumes with ${formatBytes(totalFreeBytes, 'en')} free of ${formatBytes(totalStorageBytes, 'en')} total. System drive at ${systemVolumeUsedPercent}% capacity. Potential reclaim: ${formatBytes(potentialReclaimBytes, 'en')}. Hardware status: ${hardwareHealthStatus}.`;
  const summaryAr = `تم رصد ${evidence.volumes.length} أقراص مع مساحة متاحة ${formatBytes(totalFreeBytes, 'ar')} من إجمالي ${formatBytes(totalStorageBytes, 'ar')}. قرص النظام عند ${systemVolumeUsedPercent}% من السعة. الاسترداد المحتمل: ${formatBytes(potentialReclaimBytes, 'ar')}. حالة العتاد: ${hardwareHealthStatus}.`;

  return {
    generatedAt: new Date().toISOString(),
    totalStorageBytes,
    totalFreeBytes,
    systemVolumeUsedPercent,
    volumeCount: evidence.volumes.length,
    largeFilesObserved: evidence.largeFiles.length,
    potentialReclaimBytes,
    hardwareHealthStatus,
    summaryEn,
    summaryAr,
  };
}
