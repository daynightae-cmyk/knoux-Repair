import { useCallback, useMemo } from 'react';
import { Boxes, Copy, Database, HardDrive, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  BackupRecoveryPreview,
  BridgeTool,
  CleanupPreview,
  DuplicatePreview,
  SystemSnapshot,
} from '../../lib/api';
import { api } from '../../lib/api';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import { RecoveryHoloVisual } from '../premium/HeroVisuals';
import StudioShell from '../studios/StudioShell';
import { StudioStationGrid, useStudioProbes } from '../studios/studioStations';
import type { StudioStationView } from '../studios/studioStations';
import EmptyState from '../shell/EmptyState';
import './storage-studio.css';

interface StorageStudioProps {
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

type StationId = '02-System-Cleanup' | '05-Duplicate-Files' | '06-Disk-Space' | '11-Backup-Recovery';

interface StationCopy {
  id: StationId;
  icon: typeof Boxes;
  en: string;
  ar: string;
  purposeEn: string;
  purposeAr: string;
}

const STATIONS: StationCopy[] = [
  {
    id: '02-System-Cleanup',
    icon: Boxes,
    en: 'System Cleanup',
    ar: 'تنظيف النظام',
    purposeEn: 'Approved cleanup targets, reclaimable bytes and the current quarantine — measured, never assumed.',
    purposeAr: 'أهداف التنظيف المعتمدة والبايتات القابلة للاسترداد والعزل الحالي — مقيسة، لا مقدرة.',
  },
  {
    id: '05-Duplicate-Files',
    icon: Copy,
    en: 'Duplicate Files',
    ar: 'الملفات المكررة',
    purposeEn: 'The latest duplicate scan: groups, extra copies and reclaimable bytes, with the keeper kept visible.',
    purposeAr: 'آخر فحص للملفات المكررة: المجموعات والنسخ الزائدة والبايتات القابلة للاسترداد، مع إبقاء المحتفظ ظاهرًا.',
  },
  {
    id: '06-Disk-Space',
    icon: HardDrive,
    en: 'Disk Space',
    ar: 'مساحة القرص',
    purposeEn: 'Real volume capacity read from Windows, so free space is never a placeholder number.',
    purposeAr: 'سعة الأقراص الحقيقية المقروءة من ويندوز، فلا يكون المجاني رقمًا بديلًا.',
  },
  {
    id: '11-Backup-Recovery',
    icon: RotateCcw,
    en: 'Backup & Recovery',
    ar: 'النسخ الاحتياطي والاستعادة',
    purposeEn: 'Restore points, shadow copies and local backups as Windows actually reports them.',
    purposeAr: 'نقاط الاستعادة والنسخ الظلري والنسخ المحلية كما يبلّغ عنها ويندوز فعليًا.',
  },
];

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${Math.round(value)} B`;
}

function formatGb(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} GB`;
}

/**
 * KNOuX Storage Studio.
 *
 * The Recovery & Storage family is the only family that can destroy user
 * data, so this studio is deliberately a *measurement* surface: four
 * stations, each backed by one real bridge reading.
 *
 *   Cleanup        — approved targets, reclaimable bytes, quarantine
 *   Duplicate Files— the latest scan the engine actually produced
 *   Disk Space     — volume capacity as Windows reports it
 *   Backup & Recovery — restore points, shadow copies, local backups
 *
 * Every number here is a bridge reading. Nothing is estimated, no station
 * fabricates a count, and an offline bridge produces "not measured" rather
 * than a plausible figure. Selecting a station opens the owning service —
 * selection is never execution, and quarantine/restore stay behind the
 * station's own confirm step.
 *
 * The recovery family's own visual identity — the holo storage stack and
 * the live context strip — is carried over from the family overview, so
 * replacing that surface never deletes shipped work.
 */
export default function StorageStudio({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  systemSnapshot,
  onSelectService,
  children,
}: StorageStudioProps) {
  const ar = lang === 'ar';
  const t = useCallback((en: string, arLabel: string) => (ar ? arLabel : en), [ar]);

  const probes = useMemo(() => [
    { id: '02-System-Cleanup', read: api.cleanupPreview },
    { id: '05-Duplicate-Files', read: api.duplicatesLatestScan },
    { id: '11-Backup-Recovery', read: api.backupRecoveryPreview },
  ], []);

  const { results, status, probeState, failures } = useStudioProbes(probes, bridgeOnline);

  const familyTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );

  const drives = useMemo(() => systemSnapshot?.Drives ?? [], [systemSnapshot]);

  const cleanup = (results['02-System-Cleanup'] as { preview?: CleanupPreview } | null)?.preview ?? null;
  const duplicateRead = results['05-Duplicate-Files'] as { preview?: DuplicatePreview | null; scan?: Record<string, string | number | null> | null } | null;
  const duplicates = duplicateRead?.preview ?? null;
  const duplicateScan = duplicateRead?.scan ?? null;
  const backup = (results['11-Backup-Recovery'] as { preview?: BackupRecoveryPreview } | null)?.preview ?? null;

  const reclaimableBytes = cleanup?.Summary?.EstimatedReclaimableBytes ?? null;
  const scanStatus = typeof duplicateScan?.status === 'string' ? duplicateScan.status : null;
  const scanCompletedAt = typeof duplicateScan?.completedAt === 'string' ? duplicateScan.completedAt : null;

  const headerMetrics = [
    {
      label: t('Stations', 'المحطات'),
      value: String(STATIONS.length),
      tone: 'neutral' as const,
    },
    {
      label: t('Actions', 'الإجراءات'),
      value: bridgeOnline === true ? String(familyTools.length) : '—',
      tone: 'data' as const,
    },
    {
      label: t('Reclaimable', 'قابل للاسترداد'),
      value: bridgeOnline === true ? formatBytes(reclaimableBytes) : '—',
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
    const reading = (label: string, value: string, tone: 'data' | 'positive' | 'caution' | 'neutral' = 'data') => ({ label, value, tone });

    const cleanupReadings = measured && cleanup ? [
      reading(t('Targets', 'الأهداف'), `${cleanup.Summary.ExistingTargetCount}/${cleanup.Summary.TargetCount}`),
      reading(t('Files', 'الملفات'), String(cleanup.Summary.TotalFiles)),
      reading(t('Reclaimable', 'قابل للاسترداد'), formatBytes(cleanup.Summary.EstimatedReclaimableBytes), 'positive'),
      reading(t('Quarantine', 'العزل'), formatBytes(cleanup.Summary.QuarantineBytes), 'caution'),
    ] : [];

    const duplicateReadings = measured && duplicates ? [
      reading(t('Groups', 'المجموعات'), String(duplicates.GroupCount)),
      reading(t('Extra copies', 'نسخ زائدة'), String(duplicates.DuplicateCopies)),
      reading(t('Reclaimable', 'قابل للاسترداد'), formatBytes(duplicates.RecoverableBytes), 'positive'),
      reading(t('Observed', 'المرصود'), String(duplicates.FilesObserved), 'neutral'),
      reading(t('Last scan', 'آخر فحص'), scanStatus ?? t('Unknown', 'غير معروف'), scanStatus === 'COMPLETED' ? 'positive' : 'caution'),
      reading(t('Scan finished', 'انتهى الفحص'), scanCompletedAt ?? '—', 'neutral'),
    ] : [];

    const diskReadings = measured && drives.length > 0 ? drives.slice(0, 4).map(drive => reading(
      drive.Name,
      `${formatGb(drive.FreeGB)} free / ${formatGb(drive.TotalGB)}`,
      drive.FreeGB !== null && drive.TotalGB !== null && drive.TotalGB > 0 && drive.FreeGB / drive.TotalGB < 0.1 ? 'caution' : 'data',
    )) : [];

    const backupReadings = measured && backup ? [
      reading(t('Restore points', 'نقاط الاستعادة'), backup.RestorePoints.QueryAvailable ? String(backup.RestorePoints.Count) : t('Unavailable', 'غير متاح')),
      reading(t('Shadow copies', 'النسخ الظلري'), backup.ShadowCopies.QueryAvailable ? String(backup.ShadowCopies.Count) : t('Unavailable', 'غير متاح')),
      reading(t('Local backups', 'نسخ محلية'), String(backup.LocalBackups.Count)),
      reading(t('Backup drive free', 'المساحة الحرة'), formatGb(backup.Storage.FreeGB), 'neutral'),
    ] : [];

    const byId: Record<StationId, StudioStationView['readings']> = {
      '02-System-Cleanup': cleanupReadings,
      '05-Duplicate-Files': duplicateReadings,
      '06-Disk-Space': diskReadings,
      '11-Backup-Recovery': backupReadings,
    };

    const emptyById: Record<StationId, string> = {
      '02-System-Cleanup': t('No cleanup reading yet — open the station to measure it.', 'لا توجد قراءة تنظيف بعد — افتح المحطة لقياسها.'),
      '05-Duplicate-Files': t('No duplicate scan has been produced yet.', 'لم يُنتج أي فحص تكرارات بعد.'),
      '06-Disk-Space': t('Windows reported no volumes.', 'لم يبلّغ ويندوز عن أي وحدات.'),
      '11-Backup-Recovery': t('No backup reading yet — open the station to measure it.', 'لا توجد قراءة نسخ احتياطي بعد — افتح المحطة لقياسها.'),
    };

    return STATIONS.map(station => {
      const readings = byId[station.id];
      let state: StudioStationView['state'];
      if (!measured) {
        state = 'offline';
      } else if (station.id === '06-Disk-Space') {
        // The volume list comes from the system snapshot, not from a preview
        // probe, so it is judged by that snapshot alone.
        state = drives.length > 0 ? 'measured' : systemSnapshot ? 'empty' : 'loading';
      } else {
        const probe = status[station.id] ?? 'idle';
        if (probe === 'error') state = 'error';
        else if (probe === 'ready') state = readings.length > 0 ? 'measured' : 'empty';
        else if (probe === 'loading') state = 'loading';
        else state = 'empty';
      }
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
  }, [ar, bridgeOnline, cleanup, duplicates, drives.length, duplicateScan, scanCompletedAt, scanStatus, status, systemSnapshot, t, tools]);

  const liveContext = useMemo(() => {
    const unknown = t('Unavailable', 'غير متاح');
    return [
      { label: t('Volumes', 'الأقراص'), value: systemSnapshot ? String(systemSnapshot.Drives?.length ?? 0) : unknown },
      { label: t('System drive', 'قرص النظام'), value: systemSnapshot?.SystemDrive || unknown },
      { label: t('Machine', 'الجهاز'), value: systemSnapshot?.Machine || unknown },
    ];
  }, [systemSnapshot, t]);

  return (
    <StudioShell
      className="knoux-storage-studio"
      family="recovery"
      lang={lang}
      probeState={probeState}
      header={{
        kicker: t('KNOuX Storage Studio', 'استوديو التخزين لدى كنوكس'),
        title: t('Recovery & Storage', 'الاستعادة والتخزين'),
        description: t(
          'Four storage stations read live from the local bridge. Cleanup, duplicates, disk capacity and backups are measured here; every destructive path stays inside its own station behind an explicit confirmation.',
          'أربع محطات تخزين تُقرأ مباشرة من الجسر المحلي. التنظيف والتكرارات وسعة الأقراص والنسخ الاحتياطي تُقاس هنا؛ وكل مسار تدميري يبقى داخل محطته خلف تأكيد صريح.',
        ),
        icon: <Database size={20} aria-hidden="true" />,
        accent: 'var(--knoux-family-recovery)',
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
      servicesLabel={t('Recovery services', 'خدمات الاستعادة')}
      visual={<RecoveryHoloVisual lang={lang} />}
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
      truth={
        <>
          {t(
            'Measurements come from the local bridge only. Selecting a station opens it; quarantining, restoring and deleting always require an explicit confirmation inside the station itself.',
            'القياسات تأتي من الجسر المحلي فقط. اختيار المحطة يفتحها؛ أما العزل والاستعادة والحذف فتتطلب دائمًا تأكيدًا صريحًا داخل المحطة نفسها.',
          )}
          <span className="knoux-storage-studio__elevation">
            {bridgeElevated
              ? t('The bridge is elevated, so destructive tools can ask for administrator rights.', 'الجسر مرتفع الصلاحية، لذا يمكن لأدوات التدمير طلب صلاحيات المسؤول.')
              : t('The bridge runs with standard rights; destructive tools will say so instead of pretending.', 'يعمل الجسر بصلاحيات قياسية؛ وستذكر الأدوات المدمرة ذلك بدل الادعاء.')}
          </span>
        </>
      }
    >
      {bridgeOnline === false ? (
        <EmptyState
          title={t('Not measured yet', 'لم يُقَس شيء بعد')}
          description={t(
            'The storage stations read their evidence from the local bridge. It is offline, so nothing has been measured and no figure is shown.',
            'تقرأ محطات التخزين أدلتها من الجسر المحلي، وهو غير متصل، لذلك لم يُقَس شيء ولا يُعرض أي رقم.',
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
