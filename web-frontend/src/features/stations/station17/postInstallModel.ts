import type { BridgeTool, PostInstallPreview, PostInstallCatalogItem } from '../../../lib/api';

export type ProvisioningReadiness = 'ready' | 'attention' | 'pending_restart' | 'inconclusive';

export interface ProvisioningSummary {
  systemCaption: string;
  build: string;
  lastBoot: string | null;
  installedAppsCount: number;
  pendingRestartCount: number;
  pendingRestartSignals: string[];
  driverOffersCount: number;
  driverOffersAvailable: boolean;
  catalogTotal: number;
  catalogDetected: number;
  catalogMissing: number;
  wingetAvailable: boolean;
  wingetVersion: string | null;
  wingetSourcesCount: number;
  updateServicesHealthy: boolean;
  readiness: ProvisioningReadiness;
}

export interface ProvisioningSignal {
  id: string;
  level: 'info' | 'warning' | 'notice';
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  recommendedToolId?: string;
}

export function deriveProvisioningReadiness(preview: PostInstallPreview | null): ProvisioningReadiness {
  if (!preview) return 'inconclusive';

  if (preview.System.PendingRestartSignals && preview.System.PendingRestartSignals.length > 0) {
    return 'pending_restart';
  }

  if (preview.DriverOffers.Count && preview.DriverOffers.Count > 0) {
    return 'attention';
  }

  const missingApps = preview.Catalog.filter(c => !c.Detected).length;
  if (missingApps > 0 && !preview.Winget.Available) {
    return 'attention';
  }

  return 'ready';
}

export function summarizeProvisioning(preview: PostInstallPreview | null): ProvisioningSummary {
  if (!preview) {
    return {
      systemCaption: '—',
      build: '—',
      lastBoot: null,
      installedAppsCount: 0,
      pendingRestartCount: 0,
      pendingRestartSignals: [],
      driverOffersCount: 0,
      driverOffersAvailable: false,
      catalogTotal: 0,
      catalogDetected: 0,
      catalogMissing: 0,
      wingetAvailable: false,
      wingetVersion: null,
      wingetSourcesCount: 0,
      updateServicesHealthy: true,
      readiness: 'inconclusive',
    };
  }

  const catalogTotal = preview.Catalog.length;
  const catalogDetected = preview.Catalog.filter(c => c.Detected).length;
  const catalogMissing = catalogTotal - catalogDetected;

  const updateServicesHealthy = (preview.UpdateServices || []).every(s =>
    s.Status === 'Running' || s.StartType === 'Manual'
  );

  const readiness = deriveProvisioningReadiness(preview);

  return {
    systemCaption: preview.System.Caption,
    build: preview.System.Build,
    lastBoot: preview.System.LastBoot,
    installedAppsCount: preview.System.InstalledProgramCount,
    pendingRestartCount: preview.System.PendingRestartSignals?.length ?? 0,
    pendingRestartSignals: preview.System.PendingRestartSignals ?? [],
    driverOffersCount: preview.DriverOffers.Count ?? 0,
    driverOffersAvailable: Boolean(preview.DriverOffers.Available),
    catalogTotal,
    catalogDetected,
    catalogMissing,
    wingetAvailable: Boolean(preview.Winget.Available),
    wingetVersion: preview.Winget.Version ?? null,
    wingetSourcesCount: preview.Winget.SourceCount ?? 0,
    updateServicesHealthy,
    readiness,
  };
}

export function detectProvisioningSignals(preview: PostInstallPreview | null): ProvisioningSignal[] {
  if (!preview) return [];
  const signals: ProvisioningSignal[] = [];

  // 1. Pending Restart Signals
  if (preview.System.PendingRestartSignals && preview.System.PendingRestartSignals.length > 0) {
    signals.push({
      id: 'pi-pending-restart',
      level: 'warning',
      titleEn: 'Pending System Restart',
      titleAr: 'إعادة تشغيل معلقة للنظام',
      detailEn: `System detected ${preview.System.PendingRestartSignals.length} pending reboot signal(s) from component servicing or driver installation.`,
      detailAr: `رصد النظام ${preview.System.PendingRestartSignals.length} مؤشر لإعادة التشغيل المعلقة نتيجة تثبيت مكونات أو تعريفات.`,
    });
  }

  // 2. Driver Offers Signal
  if (preview.DriverOffers.Count && preview.DriverOffers.Count > 0) {
    signals.push({
      id: 'pi-driver-offers',
      level: 'notice',
      titleEn: 'Windows Update Driver Offers Available',
      titleAr: 'عروض تعريفات متاحة عبر Windows Update',
      detailEn: `${preview.DriverOffers.Count} driver update offer(s) discovered for installed hardware devices.`,
      detailAr: `تم العثور على ${preview.DriverOffers.Count} عرض تحديث تعريفات للأجهزة المثبتة.`,
      recommendedToolId: 'PI01',
    });
  }

  // 3. Essential Apps Readiness
  const missingApps = preview.Catalog.filter(c => !c.Detected);
  if (missingApps.length > 0) {
    signals.push({
      id: 'pi-catalog-missing',
      level: 'info',
      titleEn: 'Essential Apps Recommended',
      titleAr: 'تطبيقات أساسية موصى بتثبيتها',
      detailEn: `${missingApps.length} of ${preview.Catalog.length} recommended desktop utilities are not yet installed.`,
      detailAr: `${missingApps.length} من أصل ${preview.Catalog.length} أدوات وتطبيقات موصى بها غير مثبتة بعد.`,
      recommendedToolId: 'PI03',
    });
  }

  // 4. Winget Client Readiness
  if (!preview.Winget.Available) {
    signals.push({
      id: 'pi-winget-missing',
      level: 'warning',
      titleEn: 'Windows Package Manager Missing',
      titleAr: 'مدير حزم ويندوز غير متوفر',
      detailEn: 'Winget client is not detected on PATH. Manual package downloads or App Installer update required.',
      detailAr: 'أداة Winget غير مكتشفة في مسار النظام. يلزم تثبيت App Installer من المتجر لتفعيل التثبيت الآلي.',
    });
  } else if (preview.Winget.SourceCount !== null && preview.Winget.SourceCount === 0) {
    signals.push({
      id: 'pi-winget-sources-empty',
      level: 'warning',
      titleEn: 'Winget Package Sources Empty',
      titleAr: 'مصادر حزم Winget فارغة',
      detailEn: 'Winget package sources need refreshing to discover recent package manifests.',
      detailAr: 'تحتاج مصادر حزم Winget إلى تحديث لاكتشاف أحدث ملفات تعريف الحزم.',
      recommendedToolId: 'PI05',
    });
  }

  return signals;
}

export function filterCatalog(
  catalog: PostInstallCatalogItem[] = [],
  query: string = '',
  filter: 'all' | 'missing' | 'installed' = 'all'
): PostInstallCatalogItem[] {
  const q = query.trim().toLowerCase();
  return catalog.filter(item => {
    if (filter === 'missing' && item.Detected) return false;
    if (filter === 'installed' && !item.Detected) return false;
    if (!q) return true;
    return (
      item.Name.toLowerCase().includes(q) ||
      item.PackageId.toLowerCase().includes(q) ||
      item.Category.toLowerCase().includes(q)
    );
  });
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return tools.filter(
    (tool) => tool.Category === '17-PostInstall-Setup' || tool.ToolId.startsWith('PI')
  );
}
