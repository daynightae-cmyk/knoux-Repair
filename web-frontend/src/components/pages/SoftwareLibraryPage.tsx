import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppWindow, Cpu, Download, Package, RefreshCw, Settings2,
  Terminal, Wrench,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import type {
  AdvancedSoftwarePreview, BridgeTool, PostInstallPreview, SoftwarePreview,
} from '../../lib/api';
import { api } from '../../lib/api';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import { buildProgramInventory, STATION04_SERVICES } from '../../features/stations/station04/programsModel';
import { SERVICE_ICONS } from '../../data/studio-icons';
import { summarizeSoftwareHub } from '../../features/stations/station16/softwareModel';
import { summarizeProvisioning } from '../../features/stations/station17/postInstallModel';
import StudioHeader from '../shell/StudioHeader';
import StudioNavigation from '../shell/StudioNavigation';
import StatusIndicator from '../shell/StatusIndicator';
import EntityInventory from '../shell/EntityInventory';
import EmptyState from '../shell/EmptyState';
import OperationToolbar from '../shell/OperationToolbar';
import type { StatusTone } from '../shell/StatusIndicator';
import type { InventoryColumn } from '../workspace/StationInventorySurface';
import '../shell/studioServiceStrip.css';
import './software-studio.css';

interface SoftwareLibraryPageProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onSelectService: (id: ServiceId) => void;
  /** Tool-level selection, threaded from the App shell. The library
      spotlight below calls this with a canonical ToolId; it is the same
      handler the library deck uses, so no parallel registry is created. */
  onSelectTool: (id: string) => void;
}

type WorkspaceId = 'applications' | 'runtime' | 'setup' | 'maintenance';

type ProgramInventoryRow = ReturnType<typeof buildProgramInventory>[number];
type RuntimeToolRow = NonNullable<AdvancedSoftwarePreview>['DeveloperTools'][number];
type ExtensionRow = NonNullable<AdvancedSoftwarePreview>['ChromeExtensions'][number];
type CatalogRow = NonNullable<PostInstallPreview>['Catalog'][number];

const WORKSPACES: { id: WorkspaceId; en: string; ar: string; icon: ElementType }[] = [
  { id: 'applications', en: 'Applications', ar: 'التطبيقات', icon: AppWindow },
  { id: 'runtime', en: 'Runtime & Environment', ar: 'بيئة التشغيل', icon: Cpu },
  { id: 'setup', en: 'Installation & Setup', ar: 'التثبيت والإعداد', icon: Settings2 },
  { id: 'maintenance', en: 'Maintenance', ar: 'الصيانة', icon: Wrench },
];

const RISK_TONE: Record<string, StatusTone> = {
  READ_ONLY: 'positive',
  SAFE_CLEANUP: 'data',
  SYSTEM_REPAIR: 'caution',
  DESTRUCTIVE: 'danger',
  REBOOT_REQUIRED: 'danger',
  WINRE_ONLY: 'caution',
};

function formatSizeMB(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${Math.round(value)} MB`;
}

/**
 * KNOuX Application Studio.
 *
 * The Software Library is not a card grid, a counter wall or a slider
 * panel. It is four real workspaces over live bridge data:
 *
 *   Applications  — the installed inventory, as measured by the bridge
 *   Runtime       — the detected toolchain, extensions and cache evidence
 *   Setup         — the provisioning catalog, baseline and pending restarts
 *   Maintenance   — the registered actions of the three owning services,
 *                   with their real risk, elevation and recovery contract
 *
 * Nothing here counts what has not been measured: the bridge state decides
 * between "not checked yet" and a real number, and selection is never
 * execution — the owning station performs every operation.
 */
export default function SoftwareLibraryPage({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  onSelectService,
  onSelectTool,
}: SoftwareLibraryPageProps) {
  const ar = lang === 'ar';
  const t = (en: string, arLabel: string) => (ar ? arLabel : en);

  const [workspace, setWorkspace] = useState<WorkspaceId>('applications');

  const [software, setSoftware] = useState<SoftwarePreview | null>(null);
  const [softwareError, setSoftwareError] = useState<string | null>(null);
  const [softwareLoading, setSoftwareLoading] = useState(false);

  const [advanced, setAdvanced] = useState<AdvancedSoftwarePreview | null>(null);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);

  const [provisioning, setProvisioning] = useState<PostInstallPreview | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningLoading, setProvisioningLoading] = useState(false);

  const measured = bridgeOnline === true;

  const loadSoftware = useCallback(async () => {
    if (bridgeOnline !== true) return;
    setSoftwareLoading(true);
    setSoftwareError(null);
    try {
      const { preview } = await api.softwarePreview();
      setSoftware(preview);
    } catch (error: unknown) {
      setSoftwareError(error instanceof Error ? error.message : String(error));
    } finally {
      setSoftwareLoading(false);
    }
  }, [bridgeOnline]);

  const loadAdvanced = useCallback(async () => {
    if (bridgeOnline !== true) return;
    setAdvancedLoading(true);
    setAdvancedError(null);
    try {
      const { preview } = await api.advancedSoftwarePreview();
      setAdvanced(preview);
    } catch (error: unknown) {
      setAdvancedError(error instanceof Error ? error.message : String(error));
    } finally {
      setAdvancedLoading(false);
    }
  }, [bridgeOnline]);

  const loadProvisioning = useCallback(async () => {
    if (bridgeOnline !== true) return;
    setProvisioningLoading(true);
    setProvisioningError(null);
    try {
      const { preview } = await api.postInstallPreview();
      setProvisioning(preview);
    } catch (error: unknown) {
      setProvisioningError(error instanceof Error ? error.message : String(error));
    } finally {
      setProvisioningLoading(false);
    }
  }, [bridgeOnline]);

  useEffect(() => {
    if (workspace === 'applications' && software === null && !softwareLoading && softwareError === null) {
      void loadSoftware();
    }
  }, [loadSoftware, software, softwareError, softwareLoading, workspace]);

  useEffect(() => {
    if (workspace === 'runtime' && advanced === null && !advancedLoading && advancedError === null) {
      void loadAdvanced();
    }
  }, [advanced, advancedError, advancedLoading, loadAdvanced, workspace]);

  useEffect(() => {
    if (workspace === 'setup' && provisioning === null && !provisioningLoading && provisioningError === null) {
      void loadProvisioning();
    }
  }, [loadProvisioning, provisioning, provisioningError, provisioningLoading, workspace]);

  const libraryTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );
  const byService = useMemo(() => {
    const map = new Map<string, BridgeTool[]>();
    for (const service of family.services) {
      map.set(service.id, tools.filter(tool => tool.Category === service.id));
    }
    return map;
  }, [family.services, tools]);

  const inventory = useMemo(
    () => (software ? buildProgramInventory(software.Items, []) : null),
    [software],
  );

  const hub = useMemo(
    () => summarizeSoftwareHub(software, advanced),
    [advanced, software],
  );
  const provisioningSummary = useMemo(
    () => summarizeProvisioning(provisioning),
    [provisioning],
  );

  const applicationColumns = useMemo<InventoryColumn<ProgramInventoryRow>[]>(
    () => [
      {
        key: 'name',
        label: { en: 'Application', ar: 'التطبيق' },
        width: 'minmax(180px, 2.1fr)',
        sortValue: row => row.name,
        render: (row, lang) => (
          <span className="knoux-studio-cell-title">
            <strong>{lang === 'ar' ? row.name : row.name}</strong>
            {row.publisher && row.publisher !== '-' ? <small>{row.publisher}</small> : null}
          </span>
        ),
      },
      {
        key: 'version',
        label: { en: 'Version', ar: 'الإصدار' },
        width: 'minmax(84px, 0.8fr)',
        sortValue: row => row.version,
        render: row => <span className="knoux-studio-mono">{row.version}</span>,
      },
      {
        key: 'kind',
        label: { en: 'Kind', ar: 'النوع' },
        width: 'minmax(72px, 0.7fr)',
        sortValue: row => row.kind ?? '',
        render: row => <span className="knoux-studio-mono">{row.kind ?? '—'}</span>,
      },
      {
        key: 'source',
        label: { en: 'Source', ar: 'المصدر' },
        width: 'minmax(96px, 1fr)',
        sortValue: row => row.source,
        render: row => <span className="knoux-studio-mono">{row.source}</span>,
      },
      {
        key: 'scope',
        label: { en: 'Scope', ar: 'النطاق' },
        width: 'minmax(78px, 0.7fr)',
        sortValue: row => row.scope,
        render: row => <span className="knoux-studio-mono">{row.scope}</span>,
      },
      {
        key: 'size',
        label: { en: 'Size', ar: 'الحجم' },
        width: 'minmax(72px, 0.7fr)',
        align: 'end',
        sortValue: row => row.estimatedSizeMB,
        render: row => <span className="knoux-studio-mono">{formatSizeMB(row.estimatedSizeMB)}</span>,
      },
      {
        key: 'actions',
        label: { en: 'Actions', ar: 'الإجراءات' },
        width: 'minmax(150px, 1.5fr)',
        render: row => (
          <span className="knoux-studio-chip-row">
            {row.removable ? <StatusIndicator tone="data" label={t('Uninstall', 'إزالة')} /> : null}
            {row.repairable ? <StatusIndicator tone="caution" label={t('Repair', 'إصلاح')} /> : null}
            {row.updatable ? <StatusIndicator tone="positive" label={t('Update', 'تحديث')} /> : null}
            {!row.removable && !row.repairable && !row.updatable ? (
              <StatusIndicator tone="neutral" label={t('None proven', 'لا إجراء مثبت')} />
            ) : null}
          </span>
        ),
      },
    ],
    [t],
  );

  const runtimeColumns = useMemo<InventoryColumn<RuntimeToolRow>[]>(
    () => [
      {
        key: 'command',
        label: { en: 'Runtime', ar: 'بيئة التشغيل' },
        sortValue: row => row.Command,
        render: row => <span className="knoux-studio-cell-title"><strong>{row.Command}</strong></span>,
      },
      {
        key: 'available',
        label: { en: 'Detected', ar: 'مكتشف' },
        width: '120px',
        sortValue: row => (row.Available ? 1 : 0),
        render: row => (
          <StatusIndicator
            tone={row.Available ? 'positive' : 'caution'}
            label={row.Available ? t('Available', 'متاح') : t('Not found', 'غير موجود')}
          />
        ),
      },
      {
        key: 'source',
        label: { en: 'Source', ar: 'المصدر' },
        width: '168px',
        sortValue: row => row.Source ?? '',
        render: row => <span className="knoux-studio-mono">{row.Source ?? '—'}</span>,
      },
      {
        key: 'version',
        label: { en: 'Version', ar: 'الإصدار' },
        width: '120px',
        sortValue: row => row.Version ?? '',
        render: row => <span className="knoux-studio-mono">{row.Version ?? '—'}</span>,
      },
    ],
    [t],
  );

  const extensionColumns = useMemo<InventoryColumn<ExtensionRow>[]>(
    () => [
      {
        key: 'name',
        label: { en: 'Extension', ar: 'الامتداد' },
        sortValue: row => row.Name,
        render: row => <span className="knoux-studio-cell-title"><strong>{row.Name}</strong></span>,
      },
      {
        key: 'version',
        label: { en: 'Version', ar: 'الإصدار' },
        width: '110px',
        sortValue: row => row.Version,
        render: row => <span className="knoux-studio-mono">{row.Version}</span>,
      },
      {
        key: 'profile',
        label: { en: 'Profile', ar: 'الملف الشخصي' },
        width: '190px',
        sortValue: row => row.Profile,
        render: row => <span className="knoux-studio-mono">{row.Profile}</span>,
      },
    ],
    [],
  );

  const catalogColumns = useMemo<InventoryColumn<CatalogRow>[]>(
    () => [
      {
        key: 'name',
        label: { en: 'Package', ar: 'الحزمة' },
        sortValue: row => row.Name,
        render: row => <span className="knoux-studio-cell-title"><strong>{row.Name}</strong>{row.Publisher ? <small>{row.Publisher}</small> : null}</span>,
      },
      {
        key: 'category',
        label: { en: 'Category', ar: 'الفئة' },
        width: '180px',
        sortValue: row => row.Category,
        render: row => <span className="knoux-studio-mono">{row.Category}</span>,
      },
      {
        key: 'detected',
        label: { en: 'State', ar: 'الحالة' },
        width: '150px',
        sortValue: row => (row.Detected ? 1 : 0),
        render: row => (
          <StatusIndicator
            tone={row.Detected ? 'positive' : 'data'}
            label={row.Detected ? t('Installed', 'مثبّت') : t('Available', 'متاح')}
          />
        ),
      },
      {
        key: 'package',
        label: { en: 'Package id', ar: 'معرّف الحزمة' },
        width: '220px',
        sortValue: row => row.PackageId,
        render: row => <span className="knoux-studio-mono">{row.PackageId}</span>,
      },
    ],
    [t],
  );

  const catalogRows = useMemo(
    () => (provisioning ? provisioning.Catalog : null),
    [provisioning],
  );

  const bridgeLabel = bridgeOnline === true
    ? t('Online', 'متصل')
    : bridgeOnline === false
      ? t('Offline', 'غير متصل')
      : t('Checking', 'جارٍ الفحص');
  const bridgeTone: StatusTone = bridgeOnline === true ? 'positive' : bridgeOnline === false ? 'danger' : 'caution';

  const headerMetrics = [
    {
      label: t('Installed', 'المثبّت'),
      value: measured ? String(software?.Total ?? 0) : '—',
      tone: measured ? ('data' as StatusTone) : ('neutral' as StatusTone),
    },
    {
      label: t('Runtimes', 'بيئات التشغيل'),
      value: measured && advanced ? `${hub.detectedRuntimes}/${hub.detectedRuntimes + hub.missingRuntimes}` : '—',
      tone: measured && advanced ? ('data' as StatusTone) : ('neutral' as StatusTone),
    },
    {
      label: t('Registered', 'المسجّل'),
      value: measured ? String(libraryTools.length) : '—',
      tone: measured ? ('brand' as StatusTone) : ('neutral' as StatusTone),
    },
    {
      label: t('Bridge', 'الجسر'),
      value: bridgeLabel,
      tone: bridgeTone,
    },
  ];

  const workspaceBody = (): ReactNode => {
    if (workspace === 'applications') {
      if (bridgeOnline !== true) {
        return (
          <EmptyState
            title={t('Not checked yet', 'لم يتم الفحص بعد')}
            description={t(
              'The installed application inventory is read from the local execution bridge. It is offline, so nothing has been measured.',
              'جرد التطبيقات المثبَّت يُقرأ من جسر التنفيذ المحلي، وهو غير متصل، لذلك لم يُقَس شيء.',
            )}
            action={
              <button type="button" className="knoux-studio-btn" onClick={() => void loadSoftware()}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{t('Retry connection', 'إعادة المحاولة')}</span>
              </button>
            }
          />
        );
      }
      if (softwareError) {
        return (
          <EmptyState
            title={t('The inventory could not be read', 'تعذّرت قراءة الجرد')}
            description={softwareError}
            action={
              <button type="button" className="knoux-studio-btn" onClick={() => void loadSoftware()}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{t('Retry', 'إعادة المحاولة')}</span>
              </button>
            }
          />
        );
      }
      return (
        <EntityInventory
          lang={lang}
          title={t('Installed applications', 'التطبيقات المثبَّتة')}
          rows={inventory}
          loading={softwareLoading}
          rowKey={row => row.id}
          columns={applicationColumns}
          searchFields={row => [row.name, row.publisher, row.version, row.installLocation]}
          searchPlaceholder={{ en: 'Search applications, publishers, versions', ar: 'ابحث في التطبيقات والناشرون والإصدارات' }}
          empty={{
            notChecked: { en: 'Not checked yet', ar: 'لم يتم الفحص بعد' },
            checking: { en: 'Reading the installed inventory…', ar: 'جارٍ قراءة الجرد المثبَّت…' },
            noneFound: { en: 'No applications were returned by the bridge', ar: 'لم يُرجع الجسر أي تطبيق' },
            noMatch: { en: 'No application matches this search', ar: 'لا يوجد تطبيق يطابق هذا البحث' },
            noMatchHint: { en: 'Clear the search to see the full inventory', ar: 'امسح البحث لعرض الجرد كاملاً' },
          }}
          header={software ? (
            <StatusIndicator tone="data" label={`${software.DesktopCount} · ${software.AppxCount}`} />
          ) : null}
          inspector={(row, close, language) => (
            <div className="knoux-studio-inspector-card">
              <header>
                <strong>{row.name}</strong>
                <button type="button" className="knoux-studio-btn" onClick={close}>{language === 'ar' ? 'إغلاق' : 'Close'}</button>
              </header>
              <dl className="knoux-inspector-facts">
                <dt>{language === 'ar' ? 'المعرّف' : 'Id'}</dt>
                <dd>{row.id}</dd>
                <dt>{language === 'ar' ? 'الإصدار' : 'Version'}</dt>
                <dd>{row.version}</dd>
                <dt>{language === 'ar' ? 'الناشر' : 'Publisher'}</dt>
                <dd>{row.publisher}</dd>
                <dt>{language === 'ar' ? 'المصدر' : 'Source'}</dt>
                <dd>{row.source}</dd>
                <dt>{language === 'ar' ? 'المعمارية' : 'Architecture'}</dt>
                <dd>{row.architecture}</dd>
                <dt>{language === 'ar' ? 'النطاق' : 'Scope'}</dt>
                <dd>{row.scope}</dd>
                <dt>{language === 'ar' ? 'تاريخ التثبيت' : 'Installed'}</dt>
                <dd>{row.installDate || '—'}</dd>
                <dt>{language === 'ar' ? 'الحجم' : 'Size'}</dt>
                <dd>{formatSizeMB(row.estimatedSizeMB)}</dd>
                <dt>{language === 'ar' ? 'المسار' : 'Location'}</dt>
                <dd>{row.installLocation || '—'}</dd>
                <dt>{language === 'ar' ? 'إزالة' : 'Uninstall'}</dt>
                <dd>{row.uninstallCapability === null ? '—' : row.uninstallCapability ? t('Proven', 'مثبت') : t('Not proven', 'غير مثبت')}</dd>
                <dt>{language === 'ar' ? 'إصلاح' : 'Repair'}</dt>
                <dd>{row.repairCapability === null ? '—' : row.repairCapability ? t('Proven', 'مثبت') : t('Not proven', 'غير مثبت')}</dd>
                <dt>{language === 'ar' ? 'تحديث' : 'Update'}</dt>
                <dd>{row.updateCapability === null ? '—' : row.updateCapability ? t('Proven', 'مثبت') : t('Not proven', 'غير مثبت')}</dd>
                <dt>{language === 'ar' ? 'الدليل' : 'Evidence'}</dt>
                <dd>{row.evidence || '—'}</dd>
                <dt>{language === 'ar' ? 'قيد القراءة' : 'Captured'}</dt>
                <dd>{row.capturedAt || '—'}</dd>
              </dl>
            </div>
          )}
        />
      );
    }

    if (workspace === 'runtime') {
      if (bridgeOnline !== true) {
        return (
          <EmptyState
            title={t('Not checked yet', 'لم يتم الفحص بعد')}
            description={t(
              'Runtime detection runs against the local bridge. It is offline, so no environment has been measured.',
              'كشف بيئات التشغيل يعمل عبر الجسر المحلي، وهو غير متصل، لذلك لم تُقَس أي بيئة.',
            )}
            action={
              <button type="button" className="knoux-studio-btn" onClick={() => void loadAdvanced()}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{t('Retry connection', 'إعادة المحاولة')}</span>
              </button>
            }
          />
        );
      }
      if (advancedError) {
        return (
          <EmptyState
            title={t('The environment could not be read', 'تعذّرت قراءة البيئة')}
            description={advancedError}
            action={
              <button type="button" className="knoux-studio-btn" onClick={() => void loadAdvanced()}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{t('Retry', 'إعادة المحاولة')}</span>
              </button>
            }
          />
        );
      }
      return (
        <div className="knoux-studio-grid-2">
          <EntityInventory
            lang={lang}
            title={t('Developer runtimes', 'بيئات تشغيل المطورين')}
            rows={advanced ? advanced.DeveloperTools : null}
            loading={advancedLoading}
            rowKey={row => row.Command}
            columns={runtimeColumns}
            searchFields={row => [row.Command, row.Source ?? '', row.Version ?? '']}
            searchPlaceholder={{ en: 'Search runtimes', ar: 'ابحث في بيئات التشغيل' }}
            empty={{
              notChecked: { en: 'Not checked yet', ar: 'لم يتم الفحص بعد' },
              checking: { en: 'Detecting runtimes…', ar: 'جارٍ كشف بيئات التشغيل…' },
              noneFound: { en: 'The bridge returned no runtime entries', ar: 'لم يُرجع الجسر أي بيئة تشغيل' },
              noMatch: { en: 'No runtime matches this search', ar: 'لا توجد بيئة تشغيل مطابقة' },
              noMatchHint: { en: 'Clear the search to see every detected runtime', ar: 'امسح البحث لعرض كل البيئات المكتشفة' },
            }}
          />
          <EntityInventory
            lang={lang}
            title={t('Browser extensions', 'امتدادات المتصفح')}
            rows={advanced ? advanced.ChromeExtensions : null}
            loading={advancedLoading}
            rowKey={row => row.ExtensionId}
            columns={extensionColumns}
            searchFields={row => [row.Name, row.ExtensionId, row.Profile]}
            searchPlaceholder={{ en: 'Search extensions', ar: 'ابحث في الامتدادات' }}
            empty={{
              notChecked: { en: 'Not checked yet', ar: 'لم يتم الفحص بعد' },
              checking: { en: 'Reading extensions…', ar: 'جارٍ قراءة الامتدادات…' },
              noneFound: { en: 'No extensions were found in the scanned profiles', ar: 'لم يُعثر على امتدادات في الملفات الممسوحة' },
              noMatch: { en: 'No extension matches this search', ar: 'لا يوجد امتداد يطابق هذا البحث' },
              noMatchHint: { en: 'Clear the search to see every extension', ar: 'امسح البحث لعرض كل الامتدادات' },
            }}
          />
          <section className="knoux-panel" data-role="cache-evidence">
            <header>
              <h3>{t('Cache evidence', 'أدلة الذاكرة المؤقتة')}</h3>
              <StatusIndicator tone="data" label={formatSizeMB(Math.round(hub.totalCacheBytes / (1024 * 1024)))} />
            </header>
            <div className="knoux-panel-body">
              {advanced && advanced.CacheEvidence.length > 0 ? (
                <ul className="knoux-studio-evidence-list">
                  {advanced.CacheEvidence.map(entry => (
                    <li key={entry.Path}>
                      <strong>{entry.Name}</strong>
                      <span className="knoux-studio-mono">{entry.Path}</span>
                      <em>{entry.Exists ? formatSizeMB(Math.round(entry.SizeBytes / (1024 * 1024))) : t('Absent', 'غير موجود')}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t('Not checked yet', 'لم يتم الفحص بعد')} />
              )}
            </div>
          </section>
          <section className="knoux-panel" data-role="winget-state">
            <header>
              <h3>{t('Package manager', 'مدير الحزم')}</h3>
              <StatusIndicator
                tone={hub.wingetAvailable ? 'positive' : 'caution'}
                label={hub.wingetAvailable ? t('Available', 'متاح') : t('Not available', 'غير متاح')}
              />
            </header>
            <div className="knoux-panel-body">
              <dl className="knoux-inspector-facts">
                <dt>{t('Version', 'الإصدار')}</dt>
                <dd>{hub.wingetVersion ?? '—'}</dd>
                <dt>{t('Upgrade candidates', 'ترقيات مرشحة')}</dt>
                <dd>{hub.wingetAvailable ? String(hub.wingetUpgradeCandidates) : '—'}</dd>
              </dl>
            </div>
          </section>
        </div>
      );
    }

    if (workspace === 'setup') {
      if (bridgeOnline !== true) {
        return (
          <EmptyState
            title={t('Not checked yet', 'لم يتم الفحص بعد')}
            description={t(
              'The provisioning baseline is read from the local bridge. It is offline, so the system baseline is unknown.',
              'خط أساس التهيئة يُقرأ من الجسر المحلي، وهو غير متصل، لذلك حالة النظام غير معروفة.',
            )}
            action={
              <button type="button" className="knoux-studio-btn" onClick={() => void loadProvisioning()}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{t('Retry connection', 'إعادة المحاولة')}</span>
              </button>
            }
          />
        );
      }
      if (provisioningError) {
        return (
          <EmptyState
            title={t('The provisioning baseline could not be read', 'تعذّرت قراءة خط الأساس')}
            description={provisioningError}
            action={
              <button type="button" className="knoux-studio-btn" onClick={() => void loadProvisioning()}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{t('Retry', 'إعادة المحاولة')}</span>
              </button>
            }
          />
        );
      }
      return (
        <div className="knoux-studio-grid-2">
          <section className="knoux-panel" data-role="system-baseline">
            <header>
              <h3>{t('System baseline', 'خط أساس النظام')}</h3>
              <StatusIndicator
                tone={provisioningSummary.readiness === 'ready' ? 'positive' : provisioningSummary.readiness === 'pending_restart' ? 'caution' : 'neutral'}
                label={provisioningSummary.readiness.replace('_', ' ')}
              />
            </header>
            <div className="knoux-panel-body">
              {provisioning ? (
                <dl className="knoux-inspector-facts">
                  <dt>{t('System', 'النظام')}</dt>
                  <dd>{provisioning.System.Caption || '—'}</dd>
                  <dt>{t('Build', 'البناء')}</dt>
                  <dd>{provisioning.System.Build || '—'}</dd>
                  <dt>{t('Last boot', 'آخر إقلاع')}</dt>
                  <dd>{provisioning.System.LastBoot || '—'}</dd>
                  <dt>{t('Installed programs', 'برامج مثبَّتة')}</dt>
                  <dd>{provisioning.System.InstalledProgramCount}</dd>
                  <dt>{t('Pending restart', 'إعادة تشغيل معلّقة')}</dt>
                  <dd>{provisioning.System.PendingRestartSignals.length > 0
                    ? provisioning.System.PendingRestartSignals.join(', ')
                    : t('None observed', 'لا شيء مرصود')}</dd>
                </dl>
              ) : (
                <EmptyState title={t('Not checked yet', 'لم يتم الفحص بعد')} />
              )}
            </div>
          </section>
          <EntityInventory
            lang={lang}
            title={t('Essential software catalog', 'كتالوج البرامج الأساسية')}
            rows={catalogRows}
            loading={provisioningLoading}
            rowKey={row => row.PackageId || String(row.Selection)}
            columns={catalogColumns}
            searchFields={row => [row.Name, row.PackageId, row.Category, row.Publisher ?? '']}
            searchPlaceholder={{ en: 'Search the catalog', ar: 'ابحث في الكتالوج' }}
            empty={{
              notChecked: { en: 'Not checked yet', ar: 'لم يتم الفحص بعد' },
              checking: { en: 'Reading the catalog…', ar: 'جارٍ قراءة الكتالوج…' },
              noneFound: { en: 'The catalog returned no packages', ar: 'لم يُرجع الكتالوج أي حزمة' },
              noMatch: { en: 'No package matches this search', ar: 'لا توجد حزمة مطابقة' },
              noMatchHint: { en: 'Clear the search to see the whole catalog', ar: 'امسح البحث لعرض الكتالوج كاملاً' },
            }}
          />
        </div>
      );
    }

    return (
      <div className="knoux-studio-stack">
        <OperationToolbar
          label={t('Registered actions', 'الإجراءات المسجَّلة')}
          trailing={
            <StatusIndicator
              tone={bridgeElevated ? 'positive' : 'caution'}
              label={bridgeElevated ? t('Elevated', 'مرتفع') : t('Standard session', 'جلسة قياسية')}
            />
          }
          actions={[
            {
              id: 'open-programs',
              label: t('Open Programs & Applications', 'فتح البرامج والتطبيقات'),
              icon: <AppWindow size={13} aria-hidden="true" />,
              onClick: () => onSelectService('04-Programs-Applications'),
            },
            {
              id: 'open-environment',
              label: t('Open Software Environment', 'فتح بيئة البرمجيات'),
              icon: <Terminal size={13} aria-hidden="true" />,
              onClick: () => onSelectService('16-Software-Environment'),
            },
            {
              id: 'open-postinstall',
              label: t('Open Post-Install Setup', 'فتح إعداد ما بعد التثبيت'),
              icon: <Download size={13} aria-hidden="true" />,
              onClick: () => onSelectService('17-PostInstall-Setup'),
            },
          ]}
        />

        {family.services.map(service => {
          const serviceTools = byService.get(service.id) ?? [];
          const capability = STATION04_SERVICES.find(entry => entry.serviceId === service.id);
          return (
            <section className="knoux-panel" key={service.id} data-role="maintenance-service" data-service-id={service.id}>
              <header>
                <h3>{ar ? service.name.ar : service.name.en}</h3>
                <div className="knoux-studio-chip-row">
                  {capability ? (
                    <StatusIndicator
                      tone={capability.status === 'IMPLEMENTED' ? 'positive' : capability.status === 'PARTIAL' ? 'caution' : 'neutral'}
                      label={capability.status.replace(/_/g, ' ')}
                    />
                  ) : null}
                  <StatusIndicator tone="data" label={measured ? String(serviceTools.length) : '—'} />
                </div>
              </header>
              <div className="knoux-panel-body">
                {capability ? (
                  <dl className="knoux-inspector-facts">
                    <dt>{t('Safety class', 'فئة الأمان')}</dt>
                    <dd>{capability.safetyClass}</dd>
                    <dt>{t('Elevation', 'الصلاحية')}</dt>
                    <dd>{capability.requiresElevation ? t('Required', 'مطلوبة') : t('Not required', 'غير مطلوبة')}</dd>
                    <dt>{t('Analyze only', 'تحليل فقط')}</dt>
                    <dd>{capability.supportsAnalyzeOnly ? t('Supported', 'مدعوم') : t('Not supported', 'غير مدعوم')}</dd>
                    <dt>{t('Post-verify', 'تحقق لاحق')}</dt>
                    <dd>{capability.supportsPostVerify ? t('Supported', 'مدعوم') : t('Not supported', 'غير مدعوم')}</dd>
                    <dt>{t('Data sources', 'مصادر البيانات')}</dt>
                    <dd>{capability.dataSources.join(', ') || '—'}</dd>
                    {capability.missingCapabilities.length > 0 ? (
                      <>
                        <dt>{t('Missing', 'ناقص')}</dt>
                        <dd>{capability.missingCapabilities.join(', ')}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}

                <div className="knoux-studio-action-table">
                  {serviceTools.length === 0 ? (
                    <EmptyState
                      title={measured ? t('No loaded actions for this service', 'لا توجد إجراءات محمّلة لهذه الخدمة') : t('Not checked yet', 'لم يتم الفحص بعد')}
                    />
                  ) : (
                    serviceTools.map(tool => (
                      <button
                        key={tool.ToolId}
                        type="button"
                        className="knoux-studio-action-row"
                        data-tool-id={tool.ToolId}
                        onClick={() => onSelectTool(tool.ToolId)}
                      >
                        <span className="knoux-studio-action-identity">
                          <strong>{ar ? tool.ArabicName : tool.EnglishName}</strong>
                          <code>{tool.ToolId}</code>
                        </span>
                        <span className="knoux-studio-chip-row">
                          <StatusIndicator tone={RISK_TONE[tool.RiskLevel] ?? 'neutral'} label={tool.RiskLevel} />
                          {tool.RequiresAdmin ? <StatusIndicator tone="caution" label={t('Elevation', 'صلاحية')} /> : null}
                          {tool.AnalyzeOnlySupported ? <StatusIndicator tone="data" label={t('Analyze', 'تحليل')} /> : null}
                          {tool.WhatIfSupported ? <StatusIndicator tone="data" label={t('What-if', 'معاينة')} /> : null}
                          {tool.RequiresRestart ? <StatusIndicator tone="caution" label={t('Reboot', 'إعادة تشغيل')} /> : null}
                          {tool.ReportsEvidence ? <StatusIndicator tone="brand" label={t('Evidence', 'دليل')} /> : null}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="knoux-studio-page knoux-software-studio" data-family="software" dir={ar ? 'rtl' : 'ltr'}>
      <StudioHeader
        kicker={t('KNOuX Application Studio', 'استوديو تطبيقات كنوكس')}
        title={t('Software Library', 'مكتبة البرامج')}
        description={t(
          'Installed inventory, runtime readiness and controlled setup — measured by the local bridge, never assumed.',
          'جرد المثبَّت وجاهزية بيئة التشغيل والإعداد المحكوم — مقيسة بالجسر المحلي، لا مقدَّرة.',
        )}
        icon={<Package size={20} aria-hidden="true" />}
        accent="var(--knoux-family-software)"
        metrics={headerMetrics}
      />

      <StudioNavigation
        items={WORKSPACES.map(entry => ({
          id: entry.id,
          label: ar ? entry.ar : entry.en,
          icon: <entry.icon size={14} aria-hidden="true" />,
        }))}
        activeId={workspace}
        onSelect={id => setWorkspace(id as WorkspaceId)}
        accent="var(--knoux-family-software)"
        label={t('Application studio workspaces', 'مساحات عمل استوديو التطبيقات')}
      />

      <nav className="knoux-studio-service-strip" aria-label={t('Software services', 'خدمات البرمجيات')}>
        {family.services.map(service => {
          const Icon = SERVICE_ICONS[service.id];
          const serviceName = ar ? service.name.ar : service.name.en;
          return (
            <button
              key={service.id}
              type="button"
              className="knoux-studio-service-chip"
              data-service-id={service.id}
              onClick={() => onSelectService(service.id)}
              aria-label={t(`Open ${serviceName}`, `فتح ${serviceName}`)}
              title={ar ? service.purpose.ar : service.purpose.en}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{serviceName}</span>
              <em>{measured ? String(byService.get(service.id)?.length ?? 0) : '—'}</em>
            </button>
          );
        })}
      </nav>

      <div className="knoux-studio-surface-body">
        {workspaceBody()}
        <p className="knoux-studio-note">
          {t('Selection is not execution.', 'الاختيار ليس تنفيذًا.')}
          {' '}
          {t(
            'Every operation runs in the owning station, under the bridge confirmation and elevation contract.',
            'كل عملية تُنفَّذ في الخدمة المالكة، ضمن عقد التأكيد والصلاحية الذي يفرضه الجسر.',
          )}
        </p>
      </div>
    </div>
  );
}
