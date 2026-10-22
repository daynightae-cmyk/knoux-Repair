import { useCallback, useMemo } from 'react';
import { Cpu, Eye, Lock, Shield, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  BridgeTool,
  DriversPreview,
  NetworkPreview,
  PrivacyPreview,
  SystemSnapshot,
} from '../../lib/api';
import { api } from '../../lib/api';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import { AssuranceHoloVisual } from '../premium/HeroVisuals';
import StudioShell from '../studios/StudioShell';
import { StudioStationGrid, stationStateFor, useStudioProbes } from '../studios/studioStations';
import type { StudioReading, StudioStationView } from '../studios/studioStations';
import EmptyState from '../shell/EmptyState';
import './assurance-studio.css';

interface AssuranceStudioProps {
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

type StationId = '03-Network-Internet' | '09-Security' | '13-Privacy' | '14-Driver-Management';

interface StationCopy {
  id: StationId;
  icon: typeof Wifi;
  en: string;
  ar: string;
  purposeEn: string;
  purposeAr: string;
}

const STATIONS: StationCopy[] = [
  {
    id: '03-Network-Internet',
    icon: Wifi,
    en: 'Network & Internet',
    ar: 'الشبكة والإنترنت',
    purposeEn: 'Adapters, gateways and DNS as the machine reports them — connectivity is never assumed.',
    purposeAr: 'المحولات والبوابات وDNS كما يبلّغ عنها الجهاز — لا يُفترض وجود اتصال.',
  },
  {
    id: '09-Security',
    icon: Shield,
    en: 'Security',
    ar: 'الحماية',
    purposeEn: 'Defender and firewall state read from the live system snapshot, including the states that are off.',
    purposeAr: 'حالة Defender والجدار الناري مقروءة من لقطة النظام الحية، بما فيها الحالات المعطّلة.',
  },
  {
    id: '13-Privacy',
    icon: Eye,
    en: 'Privacy',
    ar: 'الخصوصية',
    purposeEn: 'The privacy settings this host actually exposes and the activity that was observed.',
    purposeAr: 'إعدادات الخصوصية التي يعرضها هذا الجهاز فعليًا والنشاط المرصود.',
  },
  {
    id: '14-Driver-Management',
    icon: Cpu,
    en: 'Driver Management',
    ar: 'إدارة السائقين',
    purposeEn: 'Installed drivers, their signature state and the devices that reported problems.',
    purposeAr: 'السائقون المثبّتون وحالة توقيعهم والأجهزة التي أبلغت عن مشاكل.',
  },
];

/**
 * KNOuX Assurance Studio.
 *
 * Assurance reports what protection the machine actually has. The landing
 * page is a reading surface: four stations, each backed by one real bridge
 * reading or by the live system snapshot, and every protection *action*
 * stays inside the owning service behind its own confirmation.
 */
export default function AssuranceStudio({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  systemSnapshot,
  onSelectService,
  children,
}: AssuranceStudioProps) {
  const ar = lang === 'ar';
  const t = useCallback((en: string, arLabel: string) => (ar ? arLabel : en), [ar]);

  const probes = useMemo(() => [
    { id: '03-Network-Internet', read: api.networkPreview },
    { id: '13-Privacy', read: api.privacyPreview },
    { id: '14-Driver-Management', read: api.driversPreview },
  ], []);

  const { results, status, probeState, failures } = useStudioProbes(probes, bridgeOnline);

  const familyTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );

  const network = (results['03-Network-Internet'] as { preview?: NetworkPreview } | null)?.preview ?? null;
  const privacy = (results['13-Privacy'] as { preview?: PrivacyPreview } | null)?.preview ?? null;
  const drivers = (results['14-Driver-Management'] as { preview?: DriversPreview } | null)?.preview ?? null;

  // The security station reads the live system snapshot: Windows protection
  // state is not a separate preview, and pretending otherwise would invent a
  // number.
  const firewall = systemSnapshot?.Firewall ?? null;
  const firewallEnabled = firewall === null ? null : firewall.filter(profile => profile.Enabled).length;
  const securityReadings = bridgeOnline === true && systemSnapshot ? [
    { label: t('Defender', 'Defender'), value: systemSnapshot.DefenderRunning ? t('Running', 'يعمل') : t('Not running', 'لا يعمل'), tone: systemSnapshot.DefenderRunning ? 'positive' as const : 'caution' as const },
    { label: t('Realtime', 'الحماية الفورية'), value: systemSnapshot.DefenderRealtime ? t('Enabled', 'مفعّلة') : t('Disabled', 'معطّلة'), tone: systemSnapshot.DefenderRealtime ? 'positive' as const : 'caution' as const },
    { label: t('Signatures', 'التوقيعات'), value: systemSnapshot.DefenderSignatures || '—', tone: 'data' as const },
    { label: t('Firewall profiles', 'أنماط الجدار الناري'), value: firewall === null ? t('Unavailable', 'غير متاح') : `${firewallEnabled}/${firewall.length}`, tone: firewall === null ? 'neutral' as const : firewallEnabled === firewall.length ? 'positive' as const : 'caution' as const },
  ] : [];

  const headerMetrics = [
    { label: t('Stations', 'المحطات'), value: String(STATIONS.length), tone: 'neutral' as const },
    {
      label: t('Actions', 'الإجراءات'),
      value: bridgeOnline === true ? String(familyTools.length) : '—',
      tone: 'data' as const,
    },
    {
      label: t('Defender', 'Defender'),
      value: bridgeOnline === true && systemSnapshot ? (systemSnapshot.DefenderRunning ? t('Running', 'يعمل') : t('Not running', 'لا يعمل')) : '—',
      tone: bridgeOnline === true && systemSnapshot ? (systemSnapshot.DefenderRunning ? ('positive' as const) : ('caution' as const)) : ('brand' as const),
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

    const networkReadings = measured && network ? [
      reading(t('Adapters', 'المحولات'), String(network.Adapters.length)),
      reading(t('Active', 'نشطة'), String(network.ActiveAdapters)),
      reading(t('With gateway', 'ببوابة'), String(network.WithGateway), network.WithGateway === 0 ? 'caution' : 'positive'),
      reading(t('With DNS', 'مع DNS'), String(network.WithDns), network.WithDns === 0 ? 'caution' : 'positive'),
    ] : [];

    const privacyReadings = measured && privacy ? [
      reading(t('Settings', 'الإعدادات'), String(privacy.Settings.length)),
      reading(t('Available', 'متاحة'), String(privacy.Settings.filter(setting => setting.Available).length)),
      reading(t('Run history', 'سجل التشغيل'), privacy.ActivityEvidence.RunHistoryAvailable ? String(privacy.ActivityEvidence.RunHistoryEntryCount) : t('Unavailable', 'غير متاح')),
      reading(t('DNS cache', 'ذاكرة DNS'), privacy.ActivityEvidence.DnsCacheAvailable ? String(privacy.ActivityEvidence.DnsCacheEntryCount ?? 0) : t('Unavailable', 'غير متاح')),
    ] : [];

    const driverReadings = measured && drivers ? [
      reading(t('Drivers', 'السائقون'), String(drivers.Summary.TotalDrivers)),
      reading(t('Signed', 'موقّعة'), String(drivers.Summary.SignedDrivers), 'positive'),
      reading(t('Unsigned', 'غير موقّعة'), String(drivers.Summary.UnsignedDrivers), drivers.Summary.UnsignedDrivers > 0 ? 'caution' : 'positive'),
      reading(t('Third party', 'طرف ثالث'), String(drivers.Summary.ThirdPartyDrivers)),
      reading(t('Device problems', 'مشاكل الأجهزة'), String(drivers.Summary.DeviceProblems), drivers.Summary.DeviceProblems > 0 ? 'caution' : 'positive'),
    ] : [];

    const byId: Record<StationId, StudioReading[]> = {
      '03-Network-Internet': networkReadings,
      '09-Security': securityReadings,
      '13-Privacy': privacyReadings,
      '14-Driver-Management': driverReadings,
    };

    const emptyById: Record<StationId, string> = {
      '03-Network-Internet': t('No network reading yet — open the station to measure it.', 'لا توجد قراءة شبكة بعد — افتح المحطة لقياسها.'),
      '09-Security': t('No system snapshot has been received yet, so protection state is unknown.', 'لم تصل لقطة نظام بعد، فحالة الحماية غير معروفة.'),
      '13-Privacy': t('No privacy reading yet — open the station to measure it.', 'لا توجد قراءة خصوصية بعد — افتح المحطة لقياسها.'),
      '14-Driver-Management': t('No driver reading yet — open the station to measure it.', 'لا توجد قراءة سائقين بعد — افتح المحطة لقياسها.'),
    };

    return STATIONS.map(station => {
      const readings = byId[station.id];
      // The security station is judged by the system snapshot, not by a
      // preview probe, so it never borrows another station's state.
      const state = station.id === '09-Security'
        ? (!measured ? 'offline' as const : systemSnapshot ? (securityReadings.length > 0 ? 'measured' as const : 'empty' as const) : 'loading' as const)
        : stationStateFor(measured, status[station.id] ?? 'idle', readings.length > 0);
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
  }, [ar, bridgeOnline, drivers, network, privacy, securityReadings, status, systemSnapshot, t, tools]);

  const liveContext = useMemo(() => {
    const unknown = t('Unavailable', 'غير متاح');
    return [
      { label: t('OS', 'نظام التشغيل'), value: systemSnapshot?.Os || unknown },
      { label: t('Machine', 'الجهاز'), value: systemSnapshot?.Machine || unknown },
      { label: t('Firewall', 'الجدار الناري'), value: systemSnapshot?.Firewall ? t('Reported', 'مبلَّغ') : unknown },
    ];
  }, [systemSnapshot, t]);

  return (
    <StudioShell
      className="knoux-assurance-studio"
      family="assurance"
      lang={lang}
      probeState={probeState}
      header={{
        kicker: t('KNOuX Assurance Studio', 'استوديو الضمان لدى كنوكس'),
        title: t('Assurance', 'الضمان والحماية'),
        description: t(
          'Four stations read live from the local bridge: connectivity, the protection Windows actually has, the privacy settings this host exposes, and the drivers it installed. Observation only — every protection action stays inside its own station.',
          'أربع محطات تُقرأ مباشرة من الجسر المحلي: الاتصال، والحماية التي لدى ويندوز فعليًا، وإعدادات الخصوصية التي يعرضها الجهاز، والسائقين المثبّتين. ملاحظة فقط — كل إجراء حماية يبقى داخل محطته.',
        ),
        icon: <Lock size={20} aria-hidden="true" />,
        accent: 'var(--knoux-family-assurance)',
        metrics: headerMetrics,
      }}
      visual={<AssuranceHoloVisual lang={lang} systemSnapshot={systemSnapshot} />}
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
        'Measurements come from the local bridge and the live system snapshot only. Selecting a station opens it; a protection change is never executed from the landing page.',
        'القياسات تأتي من الجسر المحلي ولقطة النظام الحية فقط. اختيار المحطة يفتحها؛ ولا يُنفَّذ أي تغيير حماية من صفحة الهبوط.',
      )}
    >
      {bridgeOnline === false ? (
        <EmptyState
          title={t('Not measured yet', 'لم يُقَس شيء بعد')}
          description={t(
            'The assurance stations read their evidence from the local bridge. It is offline, so nothing has been measured and no figure is shown.',
            'تقرأ محطات الضمان أدلتها من الجسر المحلي، وهو غير متصل، لذلك لم يُقَس شيء ولا يُعرض أي رقم.',
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
