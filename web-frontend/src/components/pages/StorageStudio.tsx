import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Copy,
  Database,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
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
import StudioHeader from '../shell/StudioHeader';
import StatusIndicator from '../shell/StatusIndicator';
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

type StationState = 'loading' | 'error' | 'measured' | 'empty' | 'offline';

/** The state of one bridge reading. Each station owns its own probe, so a
 *  failed reading is never blamed on a station that reads another source. */
type ProbeStatus = 'idle' | 'loading' | 'ready' | 'error';

type StationCopy = {
  id: StationId;
  icon: ElementType;
  en: string;
  ar: string;
  purposeEn: string;
  purposeAr: string;
};

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
  // A stable translator keeps the memos below from recomputing on every
  // render for a value that only changes with the language.
  const t = useCallback((en: string, arLabel: string) => (ar ? arLabel : en), [ar]);

  const [cleanup, setCleanup] = useState<CleanupPreview | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicatePreview | null>(null);
  const [duplicateScan, setDuplicateScan] = useState<Record<string, string | number | null> | null>(null);
  const [backup, setBackup] = useState<BackupRecoveryPreview | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<ProbeStatus>('idle');
  const [duplicatesStatus, setDuplicatesStatus] = useState<ProbeStatus>('idle');
  const [backupStatus, setBackupStatus] = useState<ProbeStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const measured = bridgeOnline === true;

  const load = useCallback(async () => {
    if (bridgeOnline !== true) return;
    setLoading(true);
    setError(null);
    setCleanupStatus('loading');
    setDuplicatesStatus('loading');
    setBackupStatus('loading');
    // Each station is independent: one failing reading must not blank the
    // others, so the failures are settled separately and reported apart.
    const [cleanupResult, duplicatesResult, backupResult] = await Promise.allSettled([
      api.cleanupPreview(),
      api.duplicatesLatestScan(),
      api.backupRecoveryPreview(),
    ]);

    setCleanup(cleanupResult.status === 'fulfilled' ? cleanupResult.value.preview : null);
    setCleanupStatus(cleanupResult.status === 'fulfilled' ? 'ready' : 'error');
    if (duplicatesResult.status === 'fulfilled') {
      setDuplicates(duplicatesResult.value.preview);
      setDuplicateScan(duplicatesResult.value.scan);
      setDuplicatesStatus('ready');
    } else {
      setDuplicates(null);
      setDuplicateScan(null);
      setDuplicatesStatus('error');
    }
    setBackup(backupResult.status === 'fulfilled' ? backupResult.value.preview : null);
    setBackupStatus(backupResult.status === 'fulfilled' ? 'ready' : 'error');

    const failures = [cleanupResult, duplicatesResult, backupResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    setError(
      failures.length === 0
        ? null
        : failures.map(failure => (failure.reason instanceof Error ? failure.reason.message : String(failure.reason))).join(' · '),
    );
    setLoading(false);
  }, [bridgeOnline]);

  useEffect(() => {
    if (bridgeOnline !== true) return;
    if (cleanup === null && backup === null && duplicates === null && !loading && error === null) {
      void load();
    }
  }, [backup, bridgeOnline, cleanup, duplicates, error, load, loading]);

  const familyTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );

  const drives = useMemo(() => systemSnapshot?.Drives ?? [], [systemSnapshot]);

  // The live context strip carries the same three facts the family overview
  // showed — volumes, system drive, machine — and it is read from the same
  // system snapshot. Nothing here is defaulted to a plausible value.
  const liveContext = useMemo(() => {
    const unknown = t('Unavailable', 'غير متاح');
    return [
      { label: t('Volumes', 'الأقراص'), value: systemSnapshot ? String(systemSnapshot.Drives?.length ?? 0) : unknown },
      { label: t('System drive', 'قرص النظام'), value: systemSnapshot?.SystemDrive || unknown },
      { label: t('Machine', 'الجهاز'), value: systemSnapshot?.Machine || unknown },
    ];
  }, [systemSnapshot, t]);

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
      value: measured ? String(familyTools.length) : '—',
      tone: 'data' as const,
    },
    {
      label: t('Reclaimable', 'قابل للاسترداد'),
      value: measured ? formatBytes(reclaimableBytes) : '—',
      tone: 'brand' as const,
    },
    {
      label: t('Bridge', 'الجسر'),
      value: bridgeOnline === true ? t('Online', 'متصل') : bridgeOnline === false ? t('Offline', 'غير متصل') : t('Checking', 'جارٍ الفحص'),
      tone: bridgeOnline === true ? ('positive' as const) : bridgeOnline === false ? ('danger' as const) : ('caution' as const),
    },
  ];

  const stationReadings = useMemo(() => {
    const map = new Map<StationId, { label: string; value: string; tone: 'data' | 'positive' | 'caution' | 'neutral' }[]>();

    map.set('02-System-Cleanup', measured && cleanup ? [
      { label: t('Targets', 'الأهداف'), value: `${cleanup.Summary.ExistingTargetCount}/${cleanup.Summary.TargetCount}`, tone: 'data' },
      { label: t('Files', 'الملفات'), value: String(cleanup.Summary.TotalFiles), tone: 'data' },
      { label: t('Reclaimable', 'قابل للاسترداد'), value: formatBytes(cleanup.Summary.EstimatedReclaimableBytes), tone: 'positive' },
      { label: t('Quarantine', 'العزل'), value: formatBytes(cleanup.Summary.QuarantineBytes), tone: 'caution' },
    ] : []);

    map.set('05-Duplicate-Files', measured && duplicates ? [
      { label: t('Groups', 'المجموعات'), value: String(duplicates.GroupCount), tone: 'data' },
      { label: t('Extra copies', 'نسخ زائدة'), value: String(duplicates.DuplicateCopies), tone: 'data' },
      { label: t('Reclaimable', 'قابل للاسترداد'), value: formatBytes(duplicates.RecoverableBytes), tone: 'positive' },
      { label: t('Observed', 'المرصود'), value: String(duplicates.FilesObserved), tone: 'neutral' },
      { label: t('Last scan', 'آخر فحص'), value: scanStatus ?? t('Unknown', 'غير معروف'), tone: scanStatus === 'COMPLETED' ? 'positive' : 'caution' },
      { label: t('Scan finished', 'انتهى الفحص'), value: scanCompletedAt ?? '—', tone: 'neutral' },
    ] : []);

    map.set('06-Disk-Space', measured && drives.length > 0 ? drives.slice(0, 4).map(drive => ({
      label: drive.Name,
      value: `${formatGb(drive.FreeGB)} free / ${formatGb(drive.TotalGB)}`,
      tone: drive.FreeGB !== null && drive.TotalGB !== null && drive.TotalGB > 0 && drive.FreeGB / drive.TotalGB < 0.1
        ? ('caution' as const)
        : ('data' as const),
    })) : []);

    map.set('11-Backup-Recovery', measured && backup ? [
      { label: t('Restore points', 'نقاط الاستعادة'), value: backup.RestorePoints.QueryAvailable ? String(backup.RestorePoints.Count) : t('Unavailable', 'غير متاح'), tone: 'data' },
      { label: t('Shadow copies', 'النسخ الظلري'), value: backup.ShadowCopies.QueryAvailable ? String(backup.ShadowCopies.Count) : t('Unavailable', 'غير متاح'), tone: 'data' },
      { label: t('Local backups', 'نسخ محلية'), value: String(backup.LocalBackups.Count), tone: 'data' },
      { label: t('Backup drive free', 'المساحة الحرة'), value: formatGb(backup.Storage.FreeGB), tone: 'neutral' },
    ] : []);

    return map;
  }, [backup, cleanup, drives, duplicates, measured, scanCompletedAt, scanStatus, t]);

  const stationState = useMemo(() => {
    const map = new Map<StationId, StationState>();
    const probeState = (status: ProbeStatus, hasReading: boolean): StationState => {
      if (status === 'error') return 'error';
      if (status === 'ready') return hasReading ? 'measured' : 'empty';
      if (status === 'loading') return 'loading';
      return 'empty';
    };
    map.set('02-System-Cleanup', probeState(cleanupStatus, cleanup !== null));
    map.set('05-Duplicate-Files', probeState(duplicatesStatus, duplicates !== null));
    // The volume list comes from the system snapshot, not from a preview
    // probe, so it is judged by that snapshot alone.
    map.set('06-Disk-Space', drives.length > 0 ? 'measured' : systemSnapshot ? 'empty' : 'loading');
    map.set('11-Backup-Recovery', probeState(backupStatus, backup !== null));
    if (bridgeOnline !== true) {
      for (const station of STATIONS) map.set(station.id, 'offline');
    }
    return map;
  }, [backup, backupStatus, bridgeOnline, cleanup, cleanupStatus, drives.length, duplicates, duplicatesStatus, systemSnapshot]);

  // The state of the measurement pass itself. The surface publishes it so a
  // rendered capture can tell "not started yet" apart from "read and found
  // nothing" — the two look identical on screen but mean different things.
  const probeState = useMemo<'idle' | 'loading' | 'settled'>(() => {
    const statuses = [cleanupStatus, duplicatesStatus, backupStatus];
    if (statuses.every(status => status === 'idle')) return 'idle';
    if (statuses.some(status => status === 'loading')) return 'loading';
    return 'settled';
  }, [backupStatus, cleanupStatus, duplicatesStatus]);

  return (
    <section className="knoux-storage-studio" data-family="recovery" data-probe={probeState} dir={ar ? 'rtl' : 'ltr'}>
      <StudioHeader
        kicker={t('KNOuX Storage Studio', 'استوديو التخزين لدى كنوكس')}
        title={t('Recovery & Storage', 'الاستعادة والتخزين')}
        description={t(
          'Four storage stations read live from the local bridge. Cleanup, duplicates, disk capacity and backups are measured here; every destructive path stays inside its own station behind an explicit confirmation.',
          'أربع محطات تخزين تُقرأ مباشرة من الجسر المحلي. التنظيف والتكرارات وسعة الأقراص والنسخ الاحتياطي تُقاس هنا؛ وكل مسار تدميري يبقى داخل محطته خلف تأكيد صريح.',
        )}
        icon={<Database size={20} aria-hidden="true" />}
        accent="var(--knoux-family-recovery)"
        metrics={headerMetrics}
      />

      <div className="knoux-storage-studio__masthead">
        <div className="knoux-storage-studio__visual" aria-hidden="true">
          <RecoveryHoloVisual lang={lang} />
        </div>
        <div className="knoux-storage-studio__context">
          <header>
            <span>{t('Live context', 'السياق المباشر')}</span>
            <b>{bridgeElevated ? t('Elevated', 'صلاحيات مرتفعة') : t('Standard', 'صلاحيات قياسية')}</b>
          </header>
          <div className="knoux-storage-studio__context-items">
            {liveContext.map(item => (
              <div key={item.label}>
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
          <p>{t(
            'These three facts come from the current system snapshot. An empty reading stays empty.',
            'هذه الحقائق الثلاث تأتي من لقطة النظام الحالية، وتبقى القراءة الفارغة فارغة.',
          )}</p>
        </div>
      </div>

      {bridgeOnline === false ? (
        <EmptyState
          title={t('Not measured yet', 'لم يُقَس شيء بعد')}
          description={t(
            'The storage stations read their evidence from the local bridge. It is offline, so nothing has been measured and no figure is shown.',
            'تقرأ محطات التخزين أدلتها من الجسر المحلي، وهو غير متصل، لذلك لم يُقَس شيء ولا يُعرض أي رقم.',
          )}
          action={
            <button type="button" className="knoux-studio-btn" onClick={() => void load()}>
              <RefreshCw size={13} aria-hidden="true" />
              <span>{t('Retry connection', 'إعادة المحاولة')}</span>
            </button>
          }
        />
      ) : (
        <div className="knoux-storage-studio__stations">
          {STATIONS.map(station => {
            const Icon = station.icon;
            const readings = stationReadings.get(station.id) ?? [];
            const state = stationState.get(station.id) ?? 'empty';
            const service = family.services.find(entry => entry.id === station.id);
            return (
              <article key={station.id} className="knoux-storage-station" data-service-id={station.id} data-state={state}>
                <header className="knoux-storage-station__head">
                  <span className="knoux-storage-station__icon"><Icon size={18} aria-hidden="true" /></span>
                  <div className="knoux-storage-station__titles">
                    <h3>{ar ? station.ar : station.en}</h3>
                    <p>{ar ? station.purposeAr : station.purposeEn}</p>
                  </div>
                  <StatusIndicator
                    tone={state === 'measured' ? 'data' : state === 'error' ? 'danger' : state === 'loading' ? 'caution' : 'neutral'}
                    label={state === 'measured' ? t('Measured', 'مقيس') : state === 'loading' ? t('Reading', 'جارٍ القراءة') : state === 'error' ? t('Unavailable', 'غير متاح') : t('Not measured', 'غير مقيس')}
                  />
                </header>

                <div className="knoux-storage-station__readings">
                  {readings.length === 0 ? (
                    <p className="knoux-storage-station__empty">
                      {state === 'loading'
                        ? t('Reading the live evidence…', 'جارٍ قراءة الأدلة الحية…')
                        : state === 'error'
                          ? t('The reading failed, so nothing is shown.', 'فشلت القراءة، لذلك لا يُعرض شيء.')
                          : station.id === '06-Disk-Space'
                            ? t('Windows reported no volumes.', 'لم يبلّغ ويندوز عن أي وحدات.')
                            : t('No reading yet — open the station to measure it.', 'لا توجد قراءة بعد — افتح المحطة لقياسها.')}
                    </p>
                  ) : readings.map(reading => (
                    <div key={reading.label} className="knoux-storage-station__reading">
                      <span>{reading.label}</span>
                      <b>{reading.value}</b>
                    </div>
                  ))}
                </div>

                <footer className="knoux-storage-station__foot">
                  <span className="knoux-storage-station__actions">
                    {measured ? String(tools.filter(tool => tool.Category === station.id).length) : '—'} {t('actions', 'إجراءات')}
                  </span>
                  <button
                    type="button"
                    className="knoux-studio-btn knoux-studio-btn--secondary"
                    data-tool-id={service?.id}
                    onClick={() => onSelectService(station.id)}
                  >
                    <ShieldCheck size={13} aria-hidden="true" />
                    <span>{t('Open station', 'افتح المحطة')}</span>
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {error ? (
        <p className="knoux-storage-studio__notice" role="status">
          {t('Some readings failed: ', 'بعض القراءات فشلت: ')}{error}
        </p>
      ) : null}

      {children ? <div className="knoux-storage-studio__spotlight">{children}</div> : null}

      <p className="knoux-storage-studio__truth">
        {t(
          'Measurements come from the local bridge only. Selecting a station opens it; quarantining, restoring and deleting always require an explicit confirmation inside the station itself.',
          'القياسات تأتي من الجسر المحلي فقط. اختيار المحطة يفتحها؛ أما العزل والاستعادة والحذف فتتطلب دائمًا تأكيدًا صريحًا داخل المحطة نفسها.',
        )}
        <span className="knoux-storage-studio__elevation">
          {bridgeElevated
            ? t('The bridge is elevated, so destructive tools can ask for administrator rights.', 'الجسر مرتفع الصلاحية، لذا يمكن لأدوات التدمير طلب صلاحيات المسؤول.')
            : t('The bridge runs with standard rights; destructive tools will say so instead of pretending.', 'يعمل الجسر بصلاحيات قياسية؛ وستذكر الأدوات المدمرة ذلك بدل الادعاء.')}
        </span>
      </p>
    </section>
  );
}
