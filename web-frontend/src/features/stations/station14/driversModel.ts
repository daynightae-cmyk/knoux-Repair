/**
 * KNOUX REPAIR — Station 14: Driver Management
 * Driver Lab Domain Model
 * Pure deterministic functions for Windows device drivers,
 * digital signature verification, problem device codes, and third-party driver exports.
 * Zero synthetic gamification.
 */

import type {
  BridgeTool,
  DriverPreviewDeviceProblem,
  DriverPreviewItem,
  DriversPreview,
  KnouxRunResult,
} from '../../../lib/api';

export type DriverCondition = 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL' | 'INCONCLUSIVE';

export interface DriverSummary {
  condition: DriverCondition;
  totalDrivers: number;
  signedDrivers: number;
  unsignedDrivers: number;
  thirdPartyDrivers: number;
  deviceProblemsCount: number;
  olderDateSignals: number;
  classesCount: number;
}

export interface DriverSignal {
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

export const STATION14_TOOL_IDS = ['DV01', 'DV02', 'DV03', 'DV04'] as const;

/**
 * Categorical condition derived truthfully from device problem codes and unsigned drivers
 */
export function deriveDriverCondition(
  deviceProblemsCount: number,
  unsignedCount: number
): DriverCondition {
  if (deviceProblemsCount > 0) {
    return 'CRITICAL';
  }
  if (unsignedCount > 0) {
    return 'NEEDS_ATTENTION';
  }
  return 'HEALTHY';
}

/**
 * Summarizes the drivers preview telemetry
 */
export function summarizeDrivers(
  preview: DriversPreview | null | undefined
): DriverSummary {
  if (!preview || !preview.Summary) {
    return {
      condition: 'INCONCLUSIVE',
      totalDrivers: 0,
      signedDrivers: 0,
      unsignedDrivers: 0,
      thirdPartyDrivers: 0,
      deviceProblemsCount: 0,
      olderDateSignals: 0,
      classesCount: 0,
    };
  }

  const s = preview.Summary;
  const problems = preview.DeviceProblems?.length || s.DeviceProblems || 0;
  const unsigned = s.UnsignedDrivers || 0;

  return {
    condition: deriveDriverCondition(problems, unsigned),
    totalDrivers: s.TotalDrivers || 0,
    signedDrivers: s.SignedDrivers || 0,
    unsignedDrivers: unsigned,
    thirdPartyDrivers: s.ThirdPartyDrivers || 0,
    deviceProblemsCount: problems,
    olderDateSignals: s.OlderDateSignals || 0,
    classesCount: preview.ClassSummary?.length || 0,
  };
}

/**
 * Detects driver signals and actionable items
 */
export function detectDriverSignals(
  preview: DriversPreview | null | undefined
): DriverSignal[] {
  if (!preview) return [];
  const signals: DriverSignal[] = [];

  // Device problems in Device Manager
  if (preview.DeviceProblems && preview.DeviceProblems.length > 0) {
    signals.push({
      code: 'DRIVER_DEVICE_PROBLEM',
      level: 'CRITICAL',
      messageEn: `Detected ${preview.DeviceProblems.length} physical device(s) with Windows problem codes (e.g. ${preview.DeviceProblems[0].Name}, code ${preview.DeviceProblems[0].ErrorCode}).`,
      messageAr: `تم اكتشاف ${preview.DeviceProblems.length} جهاز بمشاكل تشغيلية في إدارة الأجهزة (مثل ${preview.DeviceProblems[0].Name}، رمز الخطأ ${preview.DeviceProblems[0].ErrorCode}).`,
      suggestedTool: 'DV01',
      evidenceSource: 'Device Problems (DV04/DV01)',
    });
  }

  // Unsigned drivers
  const unsignedCount = preview.Summary?.UnsignedDrivers || 0;
  if (unsignedCount > 0) {
    signals.push({
      code: 'DRIVER_UNSIGNED',
      level: 'MEDIUM',
      messageEn: `Found ${unsignedCount} device driver package(s) without valid digital signatures.`,
      messageAr: `تم العثور على ${unsignedCount} حزمة تعريف بدون توقيع رقمي معتمد.`,
      suggestedTool: 'DV02',
      evidenceSource: 'Driver Signature Audit (DV02)',
    });
  }

  // Third-party drivers export recommendation
  const thirdParty = preview.Summary?.ThirdPartyDrivers || 0;
  if (thirdParty > 0) {
    signals.push({
      code: 'DRIVER_EXPORT_CANDIDATE',
      level: 'INFO',
      messageEn: `${thirdParty} OEM/third-party driver package(s) available for offline system backup via pnputil.`,
      messageAr: `يتوفر ${thirdParty} تعريف من جهات خارجية/مصنعي العتاد مؤهل للنسخ الاحتياطي عبر pnputil.`,
      suggestedTool: 'DV03',
      evidenceSource: 'Third-Party Driver Store (DV03)',
    });
  }

  return signals;
}

/**
 * Filters drivers by query
 */
export function filterDriversByQuery(
  drivers: DriverPreviewItem[],
  query: string
): DriverPreviewItem[] {
  if (!query) return drivers;
  const q = query.toLowerCase();
  return drivers.filter(
    (d) =>
      d.DeviceName.toLowerCase().includes(q) ||
      d.Provider.toLowerCase().includes(q) ||
      d.InfName.toLowerCase().includes(q) ||
      d.DeviceClass.toLowerCase().includes(q)
  );
}

/**
 * Filters drivers by device class
 */
export function filterDriversByClass(
  drivers: DriverPreviewItem[],
  className: string
): DriverPreviewItem[] {
  if (!className || className === 'ALL') return drivers;
  return drivers.filter((d) => d.DeviceClass.toLowerCase() === className.toLowerCase());
}

/**
 * Filter tools belonging to Station 14
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '14-Driver-Management' || (STATION14_TOOL_IDS as readonly string[]).includes(t.ToolId)
  );
}

/**
 * Extracts normalized execution outcome from Knoux run result
 */
export function outcomeFromRun(
  result: KnouxRunResult | null | undefined
): 'SUCCESS' | 'WARNING' | 'FAILED' | 'INCONCLUSIVE' {
  if (!result) return 'INCONCLUSIVE';
  const status = (result.status || result.Status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'OK') {
    return result.exitCode === 0 ? 'SUCCESS' : 'WARNING';
  }
  if (status === 'FAILED' || status === 'ERROR') return 'FAILED';
  if (status === 'CANCELLED') return 'INCONCLUSIVE';
  return result.exitCode === 0 ? 'SUCCESS' : 'WARNING';
}
