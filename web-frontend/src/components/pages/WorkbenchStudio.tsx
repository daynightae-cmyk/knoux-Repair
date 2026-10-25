import { useCallback, useEffect, useMemo, useState } from 'react';
import { Radar, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  AdvancedSoftwarePreview,
  BridgeTool,
  LocalFolderRoot,
  ProjectSonarAiStatus,
  SystemSnapshot,
} from '../../lib/api';
import { api } from '../../lib/api';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import { WorkbenchHoloVisual } from '../premium/HeroVisuals';
import StudioShell from '../studios/StudioShell';
import { StudioStationGrid, stationStateFor, useStudioProbes } from '../studios/studioStations';
import type { StudioReading, StudioStationView } from '../studios/studioStations';
import EmptyState from '../shell/EmptyState';
import './workbench-studio.css';

interface WorkbenchStudioProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  systemSnapshot?: SystemSnapshot | null;
  onSelectService: (id: ServiceId) => void;
  /** The owning action surface of the family, mounted under the stations. */
  children?: ReactNode;
}

type StationId = '12-Developer-Tools' | '18-Project-Sonar';

interface StationCopy {
  id: StationId;
  icon: typeof Terminal;
  en: string;
  ar: string;
  purposeEn: string;
  purposeAr: string;
}

const STATIONS: StationCopy[] = [
  {
    id: '12-Developer-Tools',
    icon: Terminal,
    en: 'Developer Tools',
    ar: 'أدوات التطوير',
    purposeEn: 'The runtimes installed on this machine and the caches the bridge can see — measured, not assumed.',
    purposeAr: 'بيئات التشغيل المثبّتة على هذا الجهاز والمخازن التي يراها الجسر — مقيسة، لا مقدرة.',
  },
  {
    id: '18-Project-Sonar',
    icon: Radar,
    en: 'Project Sonar',
    ar: 'سونار المشاريع',
    purposeEn: 'The workspaces this host offers and whether the AI analysis path is configured. Choosing a workspace is yours.',
    purposeAr: 'مساحات العمل التي يعرضها هذا الجهاز وهل مسار تحليل الذكاء الاصطناعي مُهيّأ. اختيار مساحة العمل من صلاحية المستخدم.',
  },
];

/**
 * KNOuX Engineering Workbench Studio.
 *
 * The workbench is where the product is built, so its landing page reads
 * the machine rather than decorating it: the developer runtimes that are
 * actually installed, and the workspace roots the Sonar can be pointed at.
 *
 * The existing workbench contract is untouched — the workbench station
 * still owns every service view of this family, and this landing page only
 * adds the family overview that was missing.
 */
export default function WorkbenchStudio({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  systemSnapshot,
  onSelectService,
  children,
}: WorkbenchStudioProps) {
  const ar = lang === 'ar';
  const t = useCallback((en: string, arLabel: string) => (ar ? arLabel : en), [ar]);

  const probes = useMemo(() => [
    { id: '12-Developer-Tools', read: api.advancedSoftwarePreview },
    { id: '18-Project-Sonar', read: api.folderRoots },
  ], []);

  const { results, status, probeState, failures } = useStudioProbes(probes, bridgeOnline);

  const familyTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );

  const developer = (results['12-Developer-Tools'] as { preview?: AdvancedSoftwarePreview } | null)?.preview ?? null;
  const roots = (results['18-Project-Sonar'] as { roots?: LocalFolderRoot[] } | null)?.roots ?? null;

  // The Sonar AI status is a separate small read; it says whether the
  // analysis path is configured, never that it will succeed.
  const [sonarAi, setSonarAi] = useState<ProjectSonarAiStatus | null>(null);
  useEffect(() => {
    if (bridgeOnline !== true) return;
    let cancelled = false;
    void api.sonarAiStatus().then(value => {
      if (!cancelled) setSonarAi(value);
    }).catch(() => {
      if (!cancelled) setSonarAi(null);
    });
    return () => { cancelled = true; };
  }, [bridgeOnline]);

  const headerMetrics = [
    { label: t('Stations', 'المحطات'), value: String(STATIONS.length), tone: 'neutral' as const },
    {
      label: t('Actions', 'الإجراءات'),
      value: bridgeOnline === true ? String(familyTools.length) : '—',
      tone: 'data' as const,
    },
    {
      label: t('Runtimes', 'بيئات التشغيل'),
      value: bridgeOnline === true && developer ? String(developer.DeveloperTools.length) : '—',
      tone: 'brand' as const,
    },
    {
      label: t('Bridge', 'الجسر'),
      value: bridgeOnline === true ? t('Online', 'متصل') : bridgeOnline === false ? t('Offline', 'غير متصل') : t('Checking', 'جارٍ الفحص'),
      tone: bridgeOnline === true ? ('positive' as const) : bridgeOnline === false ? ('danger' as const) : ('caution' as const),
    },
  ];

  const stations = useMemo<StudioStationView[]>(() => {
    const measured = bridgeOnline === true;
    const reading = (label: string, value: string, tone: StudioReading['tone'] = 'data'): StudioReading => ({ label, value, tone });

    const developerReadings = measured && developer ? [
      reading(t('Runtimes found', 'بيئات مكتشفة'), String(developer.DeveloperTools.length)),
      reading(t('Available', 'متاحة'), String(developer.DeveloperTools.filter(tool => tool.Available).length), 'positive'),
      reading(t('Missing', 'غير متاحة'), String(developer.DeveloperTools.filter(tool => !tool.Available).length), developer.DeveloperTools.some(tool => !tool.Available) ? 'caution' : 'positive'),
      reading(t('Chrome extensions', 'إضافة Chrome'), String(developer.ChromeExtensions.length)),
      reading(t('Caches observed', 'مخازن مرصودة'), String(developer.CacheEvidence.length)),
      reading(t('Winget', 'Winget'), developer.Winget.Available ? (developer.Winget.Version ?? t('Available', 'متاح')) : t('Unavailable', 'غير متاح'), developer.Winget.Available ? 'positive' : 'caution'),
    ] : [];

    const sonarReadings = measured && roots ? [
      reading(t('Workspace roots', 'جذور مساحات العمل'), String(roots.length)),
      reading(t('Home', 'المجلد الرئيسي'), String(roots.filter(root => root.kind === 'home').length)),
      reading(t('Drives', 'الأقراص'), String(roots.filter(root => root.kind === 'drive').length)),
      reading(t('AI analysis', 'تحليل الذكاء الاصطناعي'), sonarAi?.configured ? (sonarAi.model ?? t('Configured', 'مُهيّأ')) : t('Not configured', 'غير مُهيّأ'), sonarAi?.configured ? 'positive' : 'neutral'),
    ] : [];

    const byId: Record<StationId, StudioReading[]> = {
      '12-Developer-Tools': developerReadings,
      '18-Project-Sonar': sonarReadings,
    };

    const emptyById: Record<StationId, string> = {
      '12-Developer-Tools': t('No developer runtime reading yet — open the station to measure it.', 'لا توجد قراءة بيئات تطوير بعد — افتح المحطة لقياسها.'),
      '18-Project-Sonar': t('No workspace roots yet — open the station to choose a workspace.', 'لا توجد جذور لمساحات العمل بعد — افتح المحطة لاختيار مساحة عمل.'),
    };

    return STATIONS.map(station => {
      const readings = byId[station.id];
      const state = stationStateFor(measured, status[station.id] ?? 'idle', readings.length > 0);
      return {
        id: station.id,
        icon: station.icon,
        title: ar ? station.ar : station.en,
        purpose: ar ? station.purposeAr : station.purposeEn,
        state,
        readings,
        toolCount: measured ? tools.filter(tool => tool.Category === station.id).length : null,
        emptyText: state === 'loading'
          ? t('Reading the live evidence…', 'جارٍ قراءة الأدلة الحية…')
          : state === 'error'
            ? t('The reading failed, so nothing is shown.', 'فشلت القراءة، لذلك لا يُعرض شيء.')
            : emptyById[station.id],
      };
    });
  }, [ar, bridgeOnline, developer, roots, sonarAi, status, t, tools]);

  const liveContext = useMemo(() => {
    const unknown = t('Unavailable', 'غير متاح');
    return [
      { label: t('OS', 'نظام التشغيل'), value: systemSnapshot?.Os || unknown },
      { label: t('Machine', 'الجهاز'), value: systemSnapshot?.Machine || unknown },
      { label: t('Build', 'البنية'), value: systemSnapshot?.Build || unknown },
    ];
  }, [systemSnapshot, t]);

  return (
    <StudioShell
      className="knoux-workbench-studio"
      family="workbench"
      lang={lang}
      probeState={probeState}
      header={{
        kicker: t('KNOuX Workbench Studio', 'استوديو الورشة لدى كنوكس'),
        title: t('Engineering Workbench', 'ورشة الهندسة'),
        description: t(
          'Two stations read live from the local bridge: the developer runtimes installed on this machine and the workspace roots the Sonar can be pointed at. The workbench station itself is unchanged and still owns every service view.',
          'محطتان تُقرآن مباشرة من الجسر المحلي: بيئات التطوير المثبّتة على هذا الجهاز وجذور مساحات العمل التي يمكن توجيه السونار إليها. محطة الورشة نفسها لم تتغير وما زالت تملك كل عروض الخدمات.',
        ),
        icon: <Terminal size={20} aria-hidden="true" />,
        accent: 'var(--knoux-family-workbench)',
        metrics: headerMetrics,
      }}
      services={STATIONS.map(station => ({
        id: station.id,
        label: ar ? station.ar : station.en,
        icon: <station.icon size={14} aria-hidden="true" />,
        actionCount: bridgeOnline === true ? tools.filter(tool => tool.Category === station.id).length : null,
        title: ar ? station.purposeAr : station.purposeEn,
        onOpen: () => onSelectService(station.id as ServiceId),
      }))}
      servicesLabel={t('Workbench services', 'خدمات الورشة')}
      visual={<WorkbenchHoloVisual lang={lang} />}
      contextTitle={t('Live context', 'السياق المباشر')}
      contextBadge={bridgeElevated ? t('Elevated', 'صلاحيات مرتفعة') : t('Standard', 'صلاحيات قياسية')}
      context={liveContext}
      contextNote={t(
        'These three facts come from the current system snapshot. An empty reading stays empty.',
        'هذه الحقائق الثلاث تأتي من لقطة النظام الحالية، وتبقى القراءة الفارغة فارغة.',
      )}
      failures={failures}
      failureLabel={t('Some readings failed: ', 'بعض القراءات فشلت: ')}
      spotlight={children}
      truth={t(
        'Measurements come from the local bridge only. Selecting a station opens it; the workspace is chosen inside the Sonar, never for you.',
        'القياسات تأتي من الجسر المحلي فقط. اختيار المحطة يفتحها؛ ومساحة العمل تُختار داخل السونار، لا نيابةً عنك.',
      )}
    >
      {bridgeOnline === false ? (
        <EmptyState
          title={t('Not measured yet', 'لم يُقَس شيء بعد')}
          description={t(
            'The workbench stations read their evidence from the local bridge. It is offline, so nothing has been measured and no figure is shown.',
            'تقرأ محطات الورشة أدلتها من الجسر المحلي، وهو غير متصل، لذلك لم يُقَس شيء ولا يُعرض أي رقم.',
          )}
        />
      ) : (
        <StudioStationGrid
          stations={stations}
          lang={lang}
          onSelectService={id => onSelectService(id as ServiceId)}
          openLabel={t('Open station', 'افتح المحطة')}
          actionsLabel={t('actions', 'إجراءات')}
          notMeasuredLabel={t('Not measured', 'غير مقيس')}
        />
      )}
    </StudioShell>
  );
}
