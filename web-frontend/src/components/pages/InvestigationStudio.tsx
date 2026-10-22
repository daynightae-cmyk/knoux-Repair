import { useCallback, useMemo } from 'react';
import { Activity, FileText, Radar } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  BridgeTool,
  DiagnosticsPreview,
  OperationsPreview,
  SystemSnapshot,
} from '../../lib/api';
import { api } from '../../lib/api';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import { InvestigationHoloVisual } from '../premium/HeroVisuals';
import StudioShell from '../studios/StudioShell';
import { StudioStationGrid, stationStateFor, useStudioProbes } from '../studios/studioStations';
import type { StudioReading, StudioStationView } from '../studios/studioStations';
import EmptyState from '../shell/EmptyState';
import './investigation-studio.css';

interface InvestigationStudioProps {
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

type StationId = '10-Diagnostics-Reports' | '07-Services-Processes';

interface StationCopy {
  id: StationId;
  icon: typeof FileText;
  en: string;
  ar: string;
  purposeEn: string;
  purposeAr: string;
}

const STATIONS: StationCopy[] = [
  {
    id: '10-Diagnostics-Reports',
    icon: FileText,
    en: 'Diagnostics & Reports',
    ar: 'التشخيص والتقارير',
    purposeEn: 'System, event, reliability, device and disk evidence collected read-only — never a guess.',
    purposeAr: 'أدلة النظام والأحداث والموثوقية والأجهزة والأقراص مجموعة للقراءة فقط — وليست تخمينًا.',
  },
  {
    id: '07-Services-Processes',
    icon: Activity,
    en: 'Services & Processes',
    ar: 'الخدمات والعمليات',
    purposeEn: 'What Windows reports about services and processes right now, including the ones that need review.',
    purposeAr: 'ما يبلّغ عنه ويندوز عن الخدمات والعمليات الآن، بما فيها ما يحتاج مراجعة.',
  },
];

/**
 * KNOuX Investigation Studio.
 *
 * Investigation observes; it does not repair. The landing page is therefore
 * a reading surface: two stations, each backed by one real bridge preview,
 * and every repair action stays inside the owning service behind its own
 * confirmation.
 */
export default function InvestigationStudio({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  systemSnapshot,
  onSelectService,
  children,
}: InvestigationStudioProps) {
  const ar = lang === 'ar';
  const t = useCallback((en: string, arLabel: string) => (ar ? arLabel : en), [ar]);

  const probes = useMemo(() => [
    { id: '10-Diagnostics-Reports', read: api.diagnosticsPreview },
    { id: '07-Services-Processes', read: api.operationsPreview },
  ], []);

  const { results, status, probeState, failures } = useStudioProbes(probes, bridgeOnline);

  const familyTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );

  const diagnostics = (results['10-Diagnostics-Reports'] as { preview?: DiagnosticsPreview } | null)?.preview ?? null;
  const operations = (results['07-Services-Processes'] as { preview?: OperationsPreview } | null)?.preview ?? null;

  const headerMetrics = [
    { label: t('Stations', 'المحطات'), value: String(STATIONS.length), tone: 'neutral' as const },
    {
      label: t('Actions', 'الإجراءات'),
      value: bridgeOnline === true ? String(familyTools.length) : '—',
      tone: 'data' as const,
    },
    {
      label: t('Critical events', 'أحداث حرجة'),
      value: bridgeOnline === true && diagnostics ? String(diagnostics.Events.CriticalCount) : '—',
      tone: bridgeOnline === true && diagnostics && diagnostics.Events.CriticalCount > 0 ? ('caution' as const) : ('brand' as const),
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

    const diagnosticsReadings = measured && diagnostics ? [
      reading(t('Error or critical', 'أخطاء أو حرجة'), String(diagnostics.Events.ErrorOrCriticalCount), diagnostics.Events.ErrorOrCriticalCount > 0 ? 'caution' : 'positive'),
      reading(t('Critical', 'حرجة'), String(diagnostics.Events.CriticalCount), diagnostics.Events.CriticalCount > 0 ? 'caution' : 'positive'),
      reading(t('Event window', 'نافذة الأحداث'), `${diagnostics.Events.WindowDays} ${t('days', 'يوم')}`),
      reading(t('Reliability records', 'سجلات الموثوقية'), String(diagnostics.Reliability.RecordsObserved)),
      reading(t('Device problems', 'مشاكل الأجهزة'), String(diagnostics.Devices.ProblemsObserved), diagnostics.Devices.ProblemsObserved > 0 ? 'caution' : 'positive'),
      reading(t('Disks observed', 'أقراص مرصودة'), String(diagnostics.Storage.DisksObserved)),
    ] : [];

    const operationsReadings = measured && operations ? [
      reading(t('Services running', 'خدمات تعمل'), `${operations.Services.Running}/${operations.Services.Total}`),
      reading(t('Services stopped', 'خدمات متوقفة'), String(operations.Services.Stopped), operations.Services.Stopped > 0 ? 'caution' : 'data'),
      reading(t('Automatic', 'تلقائية'), String(operations.Services.Automatic)),
      reading(t('Processes', 'العمليات'), String(operations.Processes.Total)),
      reading(t('Not responding', 'لا تستجيب'), String(operations.Processes.NotResponding), operations.Processes.NotResponding > 0 ? 'caution' : 'positive'),
      reading(t('For review', 'للماجعة'), String(operations.Services.AutomaticStoppedForReview.length + operations.Processes.NotRespondingForReview.length)),
    ] : [];

    const byId: Record<StationId, StudioReading[]> = {
      '10-Diagnostics-Reports': diagnosticsReadings,
      '07-Services-Processes': operationsReadings,
    };

    const emptyById: Record<StationId, string> = {
      '10-Diagnostics-Reports': t('No diagnostics reading yet — open the station to measure it.', 'لا توجد قراءة تشخيص بعد — افتح المحطة لقياسها.'),
      '07-Services-Processes': t('No services reading yet — open the station to measure it.', 'لا توجد قراءة خدمات بعد — افتح المحطة لقياسها.'),
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
  }, [ar, bridgeOnline, diagnostics, operations, status, t, tools]);

  const liveContext = useMemo(() => {
    const unknown = t('Unavailable', 'غير متاح');
    const uptimeHours = systemSnapshot ? Math.floor(systemSnapshot.UptimeSeconds / 3600) : null;
    return [
      { label: t('OS', 'نظام التشغيل'), value: systemSnapshot?.Os || unknown },
      { label: t('Machine', 'الجهاز'), value: systemSnapshot?.Machine || unknown },
      { label: t('Uptime', 'مدة التشغيل'), value: uptimeHours === null ? unknown : `${uptimeHours} ${t('h', 'س')}` },
    ];
  }, [systemSnapshot, t]);

  return (
    <StudioShell
      className="knoux-investigation-studio"
      family="investigation"
      lang={lang}
      probeState={probeState}
      header={{
        kicker: t('KNOuX Investigation Studio', 'استوديو التحقيق لدى كنوكس'),
        title: t('Investigation', 'التحقيق'),
        description: t(
          'Two stations read live from the local bridge: the diagnostics evidence it collected and the services and processes Windows reports right now. Observation only — every repair stays inside its own station.',
          'محطتان تُقرآن مباشرة من الجسر المحلي: أدلة التشخيص التي جمعها، والخدمات والعمليات التي يبلّغ عنها ويندوز الآن. ملاحظة فقط — كل إصلاح يبقى داخل محطته.',
        ),
        icon: <Radar size={20} aria-hidden="true" />,
        accent: 'var(--knoux-family-investigation)',
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
      servicesLabel={t('Investigation services', 'خدمات التحقيق')}
      visual={<InvestigationHoloVisual lang={lang} />}
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
        'Measurements come from the local bridge only. Selecting a station opens it; a repair is never executed from the landing page.',
        'القياسات تأتي من الجسر المحلي فقط. اختيار المحطة يفتحها؛ ولا يُنفَّذ أي إصلاح من صفحة الهبوط.',
      )}
    >
      {bridgeOnline === false ? (
        <EmptyState
          title={t('Not measured yet', 'لم يُقَس شيء بعد')}
          description={t(
            'The investigation stations read their evidence from the local bridge. It is offline, so nothing has been measured and no figure is shown.',
            'تقرأ محطات التحقيق أدلتها من الجسر المحلي، وهو غير متصل، لذلك لم يُقَس شيء ولا يُعرض أي رقم.',
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
