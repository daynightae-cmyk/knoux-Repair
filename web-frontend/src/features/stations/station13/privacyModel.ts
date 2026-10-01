/**
 * KNOUX REPAIR — Station 13: Privacy
 * Privacy Control Center Domain Model
 * Pure deterministic functions for Windows privacy telemetry,
 * app permission consent auditing, diagnostic data policy, and user footprint accounting.
 * Zero synthetic gamification.
 */

import type {
  BridgeTool,
  KnouxRunResult,
  PrivacyPreview,
  PrivacyPreviewSetting,
} from '../../../lib/api';
import { outcomeFromEnvelope, type EnvelopeOutcome } from '../_shared/executionSemantics.ts';

export type PrivacyStance = 'HARDENED' | 'BALANCED' | 'PERMISSIVE' | 'INCONCLUSIVE';

export interface PrivacySummary {
  stance: PrivacyStance;
  totalSettings: number;
  restrictedCount: number;
  allowedCount: number;
  unconfiguredCount: number;
  runHistoryCount: number;
  dnsCacheCount: number | null;
  hasActivityTraces: boolean;
  hardwareSensorsAudited: number;
}

export interface PrivacySignal {
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

export const STATION13_TOOL_IDS = ['PR01', 'PR02', 'PR03', 'PR04'] as const;

/**
 * Categorical privacy stance truthfully derived from Windows privacy settings
 */
export function derivePrivacyStance(
  settings: PrivacyPreviewSetting[] = []
): PrivacyStance {
  if (!settings || settings.length === 0) {
    return 'INCONCLUSIVE';
  }

  const restricted = settings.filter((s) => {
    const st = (s.State || '').toLowerCase();
    return st === 'restricted' || st === 'disabled' || st === 'denied';
  }).length;

  const allowed = settings.filter((s) => {
    const st = (s.State || '').toLowerCase();
    return st === 'enabled' || st === 'allowed';
  }).length;

  // If majority of sensitive tracking/sensors are restricted -> Hardened
  if (restricted >= allowed && restricted >= 3) {
    return 'HARDENED';
  }

  // If some restricted, some allowed -> Balanced
  if (restricted > 0 && allowed > 0) {
    return 'BALANCED';
  }

  // If almost everything is allowed/enabled -> Permissive
  if (allowed > 0) {
    return 'PERMISSIVE';
  }

  return 'INCONCLUSIVE';
}

/**
 * Summarizes privacy telemetry from the live preview
 */
export function summarizePrivacy(
  preview: PrivacyPreview | null | undefined
): PrivacySummary {
  if (!preview || !preview.Settings) {
    return {
      stance: 'INCONCLUSIVE',
      totalSettings: 0,
      restrictedCount: 0,
      allowedCount: 0,
      unconfiguredCount: 0,
      runHistoryCount: 0,
      dnsCacheCount: null,
      hasActivityTraces: false,
      hardwareSensorsAudited: 0,
    };
  }

  const settings = preview.Settings;
  const restrictedCount = settings.filter((s) => {
    const st = (s.State || '').toLowerCase();
    return st === 'restricted' || st === 'disabled' || st === 'denied';
  }).length;

  const allowedCount = settings.filter((s) => {
    const st = (s.State || '').toLowerCase();
    return st === 'enabled' || st === 'allowed';
  }).length;

  const unconfiguredCount = settings.filter((s) => {
    const st = (s.State || '').toLowerCase();
    return st === 'notconfigured' || st === 'unknown';
  }).length;

  const runHistoryCount = preview.ActivityEvidence?.RunHistoryEntryCount || 0;
  const dnsCacheCount = preview.ActivityEvidence?.DnsCacheEntryCount ?? null;
  const hasActivityTraces = runHistoryCount > 0 || (dnsCacheCount !== null && dnsCacheCount > 0);

  const hardwareSensors = settings.filter((s) =>
    ['locationAccess', 'microphoneAccess', 'cameraAccess'].includes(s.Id)
  );

  return {
    stance: derivePrivacyStance(settings),
    totalSettings: settings.length,
    restrictedCount,
    allowedCount,
    unconfiguredCount,
    runHistoryCount,
    dnsCacheCount,
    hasActivityTraces,
    hardwareSensorsAudited: hardwareSensors.length,
  };
}

/**
 * Detects privacy concerns and actionable vectors
 */
export function detectPrivacySignals(
  preview: PrivacyPreview | null | undefined
): PrivacySignal[] {
  if (!preview) return [];
  const signals: PrivacySignal[] = [];

  // Run dialog history footprint
  const runHistoryCount = preview.ActivityEvidence?.RunHistoryEntryCount || 0;
  if (runHistoryCount > 0) {
    signals.push({
      code: 'PRIVACY_RUN_HISTORY_TRACE',
      level: 'MEDIUM',
      messageEn: `Windows Explorer RunMRU history contains ${runHistoryCount} executed command line traces.`,
      messageAr: `يحتوي سجل أوامر نافذة التشغيل (RunMRU) على ${runHistoryCount} أثر لأوامر تم تنفيذها سابقاً.`,
      suggestedTool: 'PR02',
      evidenceSource: 'RunMRU Registry (PR02/PR04)',
    });
  }

  // DNS cache footprint
  const dnsCount = preview.ActivityEvidence?.DnsCacheEntryCount;
  if (dnsCount !== null && dnsCount !== undefined && dnsCount > 0) {
    signals.push({
      code: 'PRIVACY_DNS_CACHE_TRACE',
      level: 'INFO',
      messageEn: `Local DNS resolver cache contains ${dnsCount} cached domain resolution entries revealing recent network destinations.`,
      messageAr: `تحتوي ذاكرة مخزن DNS المؤقت المحلي على ${dnsCount} استعلام لنطاقات ومواقع تمت زيارتها مؤخراً.`,
      suggestedTool: 'PR03',
      evidenceSource: 'Get-DnsClientCache (PR03/PR04)',
    });
  }

  // Advertising ID enabled
  const adId = preview.Settings?.find((s) => s.Id === 'advertisingId');
  if (adId && (adId.State || '').toLowerCase() === 'enabled') {
    signals.push({
      code: 'PRIVACY_AD_ID_ENABLED',
      level: 'INFO',
      messageEn: 'Windows advertising identifier is enabled for apps and personalization targeting.',
      messageAr: 'المعرّف الإعلاني لنظام ويندوز مفعّل للتطبيقات وتخصيص الإعلانات.',
      suggestedTool: 'PR01',
      evidenceSource: 'HKCU AdvertisingInfo (PR01/PR04)',
    });
  }

  return signals;
}

/**
 * Every distinct category present in the measured settings, in a stable order.
 *
 * The station used four hard-coded category literals. A setting whose backend
 * `Category` string differed - a new category, a plural, extra whitespace -
 * matched nothing and disappeared from every tab with no trace. Deriving the
 * list from the data means nothing read can be hidden by a string mismatch.
 *
 * Normalisation is the same one `filterSettingsByCategory` already uses.
 * Without it the tab list and the filter disagreed: two settings whose
 * categories differed only by case or trailing space appeared as two
 * near-identical tabs that each showed BOTH settings, so the same control was
 * listed twice and the user had to guess which tab was real.
 */
export function privacyCategories(settings: PrivacyPreviewSetting[]): string[] {
  // Key is the normalised comparison form, value is a cleaned display label.
  const byKey = new Map<string, string>();
  for (const setting of settings) {
    const raw = String(setting.Category ?? '').trim();
    if (raw === '') continue;
    const key = raw.toLowerCase();
    if (byKey.has(key)) continue;
    byKey.set(key, titleCaseCategory(raw));
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Turn a backend category string into something a person would accept as a tab
 * label: collapsed whitespace, and no trailing space left over from the source.
 */
function titleCaseCategory(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  // Preserve an all-caps registry token rather than turning "UAC" into "Uac".
  if (collapsed === collapsed.toUpperCase() && /[A-Z]/.test(collapsed)) return collapsed;
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}

/**
 * Filter settings by one of the categories actually present in the data.
 * Matching is whitespace-tolerant; an unknown category yields an empty list
 * rather than silently matching nothing while appearing to have matched some.
 */
export function filterSettingsByCategory(
  settings: PrivacyPreviewSetting[],
  category: string
): PrivacyPreviewSetting[] {
  if (!category || category === 'ALL') return settings;
  const wanted = category.trim().toLowerCase();
  return settings.filter((s) => String(s.Category ?? '').trim().toLowerCase() === wanted);
}

/**
 * Filter tools belonging to Station 13
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '13-Privacy' || (STATION13_TOOL_IDS as readonly string[]).includes(t.ToolId)
  );
}

/**
 * Extracts normalized execution outcome from Knoux run result
 */
export function outcomeFromRun(
  result: KnouxRunResult | null | undefined
): EnvelopeOutcome {
  return outcomeFromEnvelope(result);
}
