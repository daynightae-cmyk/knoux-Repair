import type { BridgeTool, SoftwarePreview, AdvancedSoftwarePreview, SoftwarePreviewItem } from '../../../lib/api';
import type { Lang } from '../../../types';

export type SoftwareCondition = 'optimal' | 'attention' | 'needs_maintenance' | 'inconclusive';

export interface SoftwareHubSummary {
  installedTotal: number;
  desktopCount: number;
  appxCount: number;
  detectedRuntimes: number;
  missingRuntimes: number;
  totalCacheBytes: number;
  extensionCount: number;
  wingetAvailable: boolean;
  wingetVersion: string | null;
  wingetUpgradeCandidates: number;
  condition: SoftwareCondition;
}

export interface SoftwareSignal {
  id: string;
  level: 'info' | 'warning' | 'notice';
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  recommendedToolId?: string;
}

export function deriveSoftwareHubCondition(
  software: SoftwarePreview | null,
  advanced: AdvancedSoftwarePreview | null
): SoftwareCondition {
  if (!software && !advanced) return 'inconclusive';

  let attentionNeeded = false;

  if (advanced) {
    const totalCache = advanced.CacheEvidence.reduce((sum, c) => sum + (c.SizeBytes || 0), 0);
    // Over 2GB in caches signals routine maintenance candidate
    if (totalCache > 2 * 1024 * 1024 * 1024) {
      attentionNeeded = true;
    }
    // If winget reports upgrade lines
    if (advanced.Winget?.UpgradeLines && advanced.Winget.UpgradeLines.length > 2) {
      attentionNeeded = true;
    }
  }

  if (attentionNeeded) return 'attention';
  return 'optimal';
}

export function parseWingetUpgradeCount(lines: string[] = []): number {
  if (!lines || lines.length <= 2) return 0;
  // Winget output usually has header rows and separator lines
  const dataLines = lines.filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !trimmed.startsWith('Name') && !trimmed.startsWith('---') && !trimmed.startsWith('No installed');
  });
  return dataLines.length;
}

export function summarizeSoftwareHub(
  software: SoftwarePreview | null,
  advanced: AdvancedSoftwarePreview | null
): SoftwareHubSummary {
  const installedTotal = software?.Total ?? 0;
  const desktopCount = software?.DesktopCount ?? 0;
  const appxCount = software?.AppxCount ?? 0;

  const runtimes = advanced?.DeveloperTools ?? [];
  const detectedRuntimes = runtimes.filter(r => r.Available).length;
  const missingRuntimes = runtimes.filter(r => !r.Available).length;

  const totalCacheBytes = advanced?.CacheEvidence?.reduce((sum, c) => sum + (c.SizeBytes || 0), 0) ?? 0;
  const extensionCount = advanced?.ChromeExtensions?.length ?? 0;

  const wingetAvailable = Boolean(advanced?.Winget?.Available);
  const wingetVersion = advanced?.Winget?.Version ?? null;
  const wingetUpgradeCandidates = parseWingetUpgradeCount(advanced?.Winget?.UpgradeLines ?? []);

  const condition = deriveSoftwareHubCondition(software, advanced);

  return {
    installedTotal,
    desktopCount,
    appxCount,
    detectedRuntimes,
    missingRuntimes,
    totalCacheBytes,
    extensionCount,
    wingetAvailable,
    wingetVersion,
    wingetUpgradeCandidates,
    condition,
  };
}

export function detectSoftwareSignals(
  software: SoftwarePreview | null,
  advanced: AdvancedSoftwarePreview | null
): SoftwareSignal[] {
  const signals: SoftwareSignal[] = [];

  if (software && software.Total > 0) {
    signals.push({
      id: 'sw-catalog-ready',
      level: 'info',
      titleEn: 'Installed Software Inventory',
      titleAr: 'جرد البرامج المثبتة',
      detailEn: `${software.Total} software applications registered (${software.DesktopCount} desktop, ${software.AppxCount} store packages).`,
      detailAr: `تم جرد ${software.Total} تطبيقاً مسجلاً (${software.DesktopCount} سطح مكتب، ${software.AppxCount} حزم متجر).`,
      recommendedToolId: 'SW01',
    });
  }

  if (advanced) {
    const detectedRuntimes = advanced.DeveloperTools.filter(r => r.Available);
    if (detectedRuntimes.length > 0) {
      signals.push({
        id: 'sw-runtimes-detected',
        level: 'info',
        titleEn: 'Development Runtimes Resolved',
        titleAr: 'بيئات وأطر التطوير المحلولة',
        detailEn: `${detectedRuntimes.length} toolchains active on system PATH (${detectedRuntimes.map(r => r.Command).slice(0, 4).join(', ')}).`,
        detailAr: `${detectedRuntimes.length} بيئة تطوير نشطة في مسار النظام (${detectedRuntimes.map(r => r.Command).slice(0, 4).join(', ')}).`,
        recommendedToolId: 'SW02',
      });
    }

    const totalCacheBytes = advanced.CacheEvidence.reduce((sum, c) => sum + (c.SizeBytes || 0), 0);
    if (totalCacheBytes > 500 * 1024 * 1024) {
      signals.push({
        id: 'sw-cache-size',
        level: 'warning',
        titleEn: 'Accumulated Software Caches',
        titleAr: 'تراكم ذاكرة التخزين المؤقت للبرامج',
        detailEn: `Detected ${formatBytes(totalCacheBytes, 'en')} across package and browser cache folders. Safe quarantine available.`,
        detailAr: `تم رصد ${formatBytes(totalCacheBytes, 'ar')} عبر مجلدات التخزين المؤقت. العزل الآمن متاح.`,
        recommendedToolId: 'SW04',
      });
    }

    if (advanced.Winget?.Available) {
      const upgradeCount = parseWingetUpgradeCount(advanced.Winget.UpgradeLines);
      if (upgradeCount > 0) {
        signals.push({
          id: 'sw-winget-upgrades',
          level: 'notice',
          titleEn: 'Winget Updates Available',
          titleAr: 'تحديثات Winget متوفرة',
          detailEn: `${upgradeCount} package updates detected via Windows Package Manager.`,
          detailAr: `تم رصد ${upgradeCount} تحديثات للحزم عبر مدير حزم ويندوز.`,
          recommendedToolId: 'SW05',
        });
      }
    }

    if (advanced.ChromeExtensions && advanced.ChromeExtensions.length > 0) {
      signals.push({
        id: 'sw-extensions-audit',
        level: 'info',
        titleEn: 'Chrome Extensions Inventoried',
        titleAr: 'إضافات Chrome المرصودة',
        detailEn: `${advanced.ChromeExtensions.length} browser extension manifests inspected across user profiles.`,
        detailAr: `تم فحص ملفات تعريف ${advanced.ChromeExtensions.length} إضافة متصفح عبر ملفات المستخدم.`,
        recommendedToolId: 'SW03',
      });
    }
  }

  return signals;
}

export function filterSoftwareItems(
  items: SoftwarePreviewItem[] = [],
  query: string = '',
  kind: 'all' | 'Desktop' | 'Appx' = 'all'
): SoftwarePreviewItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    if (kind !== 'all' && item.Kind !== kind) return false;
    if (!q) return true;
    return (
      (item.Name && item.Name.toLowerCase().includes(q)) ||
      (item.Publisher && item.Publisher.toLowerCase().includes(q)) ||
      (item.Version && item.Version.toLowerCase().includes(q))
    );
  });
}

export function filterDeveloperTools(
  tools: AdvancedSoftwarePreview['DeveloperTools'] = [],
  query: string = ''
): AdvancedSoftwarePreview['DeveloperTools'] {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter(tool =>
    tool.Command.toLowerCase().includes(q) ||
    (tool.Source && tool.Source.toLowerCase().includes(q)) ||
    (tool.Version && tool.Version.toLowerCase().includes(q))
  );
}

export function filterChromeExtensions(
  extensions: AdvancedSoftwarePreview['ChromeExtensions'] = [],
  query: string = ''
): AdvancedSoftwarePreview['ChromeExtensions'] {
  const q = query.trim().toLowerCase();
  if (!q) return extensions;
  return extensions.filter(ext =>
    ext.Name.toLowerCase().includes(q) ||
    ext.Description.toLowerCase().includes(q) ||
    ext.Profile.toLowerCase().includes(q) ||
    ext.ExtensionId.toLowerCase().includes(q)
  );
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return tools.filter(
    (tool) => tool.Category === '16-Software-Environment' || tool.ToolId.startsWith('SW')
  );
}

export function formatBytes(bytes: number, lang: Lang): string {
  if (!bytes || bytes <= 0) return lang === 'ar' ? '0 بايت' : '0 B';
  const unitsEn = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitsAr = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${lang === 'ar' ? unitsAr[i] : unitsEn[i]}`;
}
