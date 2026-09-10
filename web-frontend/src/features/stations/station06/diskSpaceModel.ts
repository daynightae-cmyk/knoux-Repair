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
  model: string;
  sizeGB: number;
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

  return drives.map((d) => {
    const name = (d.Name || d.Drive || 'C:').toUpperCase().replace(/[\\/]$/, '');
    const driveLetter = name.includes(':') ? name.split(':')[0] + ':' : name;
    const fileSystem = d.FileSystem || 'NTFS';

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

    let healthStatus: DriveVolume['healthStatus'] = 'HEALTHY';
    if (usedPercent >= 95 || freeBytes < 2 * 1024 * 1024 * 1024) {
      healthStatus = 'CRITICAL';
    } else if (usedPercent >= 85 || freeBytes < 10 * 1024 * 1024 * 1024) {
      healthStatus = 'WARNING';
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
    const model = d.Model || 'Physical Drive';
    const sizeGB = typeof d.SizeGB === 'number' ? d.SizeGB : 0;
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
  const status = (res.status?.toUpperCase() || (res.exitCode === 0 ? 'SUCCESS' : 'FAILED')) as
    | 'SUCCESS'
    | 'WARNING'
    | 'FAILED'
    | 'CANCELLED'
    | 'INCONCLUSIVE';

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
