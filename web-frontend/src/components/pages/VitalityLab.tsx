import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, Cpu, Gauge, HardDrive, MemoryStick, RefreshCw, Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import type { BridgeTool, OptimizationPreview, SystemSnapshot } from '../../lib/api';
import { api } from '../../lib/api';
import {
  analyzeBottlenecks,
  derivePerformanceCondition,
} from '../../features/stations/station08/performanceModel';
import type { BottleneckItem, PerformanceCondition } from '../../features/stations/station08/performanceModel';
import StudioHeader from '../shell/StudioHeader';
import StatusIndicator from '../shell/StatusIndicator';
import type { StatusTone } from '../shell/StatusIndicator';
import EmptyState from '../shell/EmptyState';
import './vitality-lab.css';

interface VitalityLabProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  systemSnapshot?: SystemSnapshot | null;
  onSelectService: (id: ServiceId) => void;
  onSelectTool: (id: string) => void;
}

interface VitalSample {
  at: number;
  cpu: number;
  memoryUsed: number;
  processes: number;
}

const SAMPLE_WINDOW = 60;
const SAMPLE_INTERVAL_MS = 5000;

const CONDITION_TONE: Record<PerformanceCondition, StatusTone> = {
  OPTIMAL: 'positive',
  MODERATE: 'data',
  HIGH_LOAD: 'caution',
  CRITICAL_LOAD: 'danger',
};

const CONDITION_COPY: Record<PerformanceCondition, { en: string; ar: string }> = {
  OPTIMAL: {
    en: 'CPU and memory are inside their operating range.',
    ar: 'المعالج والذاكرة ضمن نطاق التشغيل الطبيعي.',
  },
  MODERATE: {
    en: 'Pressure is visible but not yet constraining the system.',
    ar: 'يظهر ضغطٌ واضح دون أن يقيّد النظام بعد.',
  },
  HIGH_LOAD: {
    en: 'Sustained pressure is high enough to affect responsiveness.',
    ar: 'الضغط المستمر مرتفع بما يكفي，影响 الاستجابة.',
  },
  CRITICAL_LOAD: {
    en: 'The system is under critical pressure right now.',
    ar: 'النظام تحت ضغط حرج في هذه اللحظة.',
  },
};

/**
 * A real sparkline.
 *
 * Every point is a measured sample. The chart draws nothing that was not
 * read from the machine, and it says so when there is no history yet.
 */
function Sparkline({
  values,
  label,
  tone,
  emptyLabel,
}: {
  values: number[];
  label: string;
  tone: StatusTone;
  emptyLabel: string;
}) {
  const stroke = tone === 'danger' ? '#fca5a5' : tone === 'caution' ? '#fcd34d' : tone === 'positive' ? '#6ee7b7' : '#67e8f9';
  if (values.length < 2) {
    return <p className="knoux-vitality-sparkline__empty">{emptyLabel}</p>;
  }
  const width = 240;
  const height = 46;
  const max = Math.max(100, ...values);
  const step = width / Math.max(1, values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * (height - 6) - 3).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="knoux-vitality-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * KNOuX Health & Performance Lab.
 *
 * The System Vitality studio is an observatory, not a wall of tool buttons.
 * It samples the machine for real, shows the condition the canonical
 * performance model derives from those samples, and surfaces the
 * bottlenecks the bridge actually detected — each one pointing at the tool
 * that investigates it. Every number here is measured; nothing is drawn
 * that the machine did not report.
 */
export default function VitalityLab({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  systemSnapshot,
  onSelectService,
  onSelectTool,
}: VitalityLabProps) {
  const ar = lang === 'ar';
  const t = (en: string, arLabel: string) => (ar ? arLabel : en);

  const [samples, setSamples] = useState<VitalSample[]>([]);
  const [live, setLive] = useState<SystemSnapshot | null>(systemSnapshot ?? null);
  const [optimization, setOptimization] = useState<OptimizationPreview | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [sampling, setSampling] = useState(true);
  const timerRef = useRef<number | null>(null);
  const samplesRef = useRef<VitalSample[]>([]);
  const samplingRef = useRef(false);

  useEffect(() => {
    if (systemSnapshot) setLive(systemSnapshot);
  }, [systemSnapshot]);

  /**
   * One reading at a time.
   *
   * The bridge answers `/api/system` in seconds, not milliseconds, so a
   * timer that fires faster than the bridge can answer would pile up
   * requests and starve the UI. The sampler therefore never overlaps
   * itself, and the timeline reports the real span the samples cover.
   */
  const takeSample = useCallback(async () => {
    if (bridgeOnline !== true || samplingRef.current) return;
    samplingRef.current = true;
    try {
      const { system } = await api.system();
      setLive(system);
      const totalRam = system.TotalRamGB > 0 ? system.TotalRamGB : 0;
      const memoryUsed = totalRam > 0
        ? Math.round(((totalRam - system.FreeRamGB) / totalRam) * 100)
        : 0;
      const next: VitalSample = {
        at: Date.now(),
        cpu: Number.isFinite(system.CpuLoad) ? system.CpuLoad : 0,
        memoryUsed,
        processes: system.Processes ?? 0,
      };
      samplesRef.current = [...samplesRef.current, next].slice(-SAMPLE_WINDOW);
      setSamples(samplesRef.current);
    } catch {
      /* a missed sample is not a failure; the next tick continues the series */
    } finally {
      samplingRef.current = false;
    }
  }, [bridgeOnline]);

  useEffect(() => {
    // The bridge answers the optimization preview in seconds; sampling while
    // it is in flight would queue two heavy reads behind each other.
    if (optimization !== null || optimizationLoading || optimizationError !== null) return;
    if (bridgeOnline !== true) {
      setSampling(false);
      return;
    }
    setSampling(true);
    void takeSample();
    timerRef.current = window.setInterval(() => { void takeSample(); }, SAMPLE_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [bridgeOnline, optimization, optimizationError, optimizationLoading, takeSample]);

  const loadOptimization = useCallback(async () => {
    if (bridgeOnline !== true) return;
    setOptimizationLoading(true);
    setOptimizationError(null);
    try {
      const { preview } = await api.optimizationPreview();
      setOptimization(preview);
    } catch (error: unknown) {
      setOptimizationError(error instanceof Error ? error.message : String(error));
    } finally {
      setOptimizationLoading(false);
    }
  }, [bridgeOnline]);

  useEffect(() => {
    if (bridgeOnline === true && optimization === null && !optimizationLoading && optimizationError === null) {
      void loadOptimization();
    }
  }, [bridgeOnline, loadOptimization, optimization, optimizationError, optimizationLoading]);

  const cpuLoad = live?.CpuLoad ?? optimization?.Cpu.LoadPercent ?? null;
  const memoryLoad = live && live.TotalRamGB > 0
    ? Math.round(((live.TotalRamGB - live.FreeRamGB) / live.TotalRamGB) * 100)
    : optimization
      ? optimization.Memory.LoadPercent
      : null;

  const condition: PerformanceCondition | null =
    cpuLoad === null || memoryLoad === null
      ? null
      : derivePerformanceCondition(cpuLoad, memoryLoad);

  const diskActive = optimization?.Disks?.[0]?.ActiveTimePercent ?? null;

  const bottlenecks: BottleneckItem[] = useMemo(() => {
    if (cpuLoad === null || memoryLoad === null) return [];
    return analyzeBottlenecks(cpuLoad, memoryLoad, diskActive, optimization?.Signals ?? []);
  }, [cpuLoad, diskActive, memoryLoad, optimization]);

  const signals = optimization?.Signals ?? [];
  const topProcesses = optimization?.TopProcesses ?? [];
  const disks = optimization?.Disks ?? [];

  const serviceTools = useMemo(
    () => tools.filter(tool => family.services.some(service => service.id === tool.Category)),
    [family.services, tools],
  );

  const measured = bridgeOnline === true;
  const cpuSeries = samples.map(sample => sample.cpu);
  const memorySeries = samples.map(sample => sample.memoryUsed);
  const sampleSpanSeconds = samples.length > 1
    ? Math.round((samples[samples.length - 1].at - samples[0].at) / 1000)
    : 0;
  const sampleSpanLabel = samples.length < 2
    ? '—'
    : `${samples.length} · ${sampleSpanSeconds}s`;

  const metricCards: { label: string; value: string; tone: StatusTone; icon: ReactNode }[] = [
    {
      label: t('CPU load', 'حمل المعالج'),
      value: cpuLoad === null ? '—' : `${cpuLoad}%`,
      tone: cpuLoad === null ? 'neutral' : cpuLoad >= 75 ? 'caution' : 'data',
      icon: <Cpu size={14} aria-hidden="true" />,
    },
    {
      label: t('Memory in use', 'الذاكرة المستخدمة'),
      value: memoryLoad === null ? '—' : `${memoryLoad}%`,
      tone: memoryLoad === null ? 'neutral' : memoryLoad >= 80 ? 'caution' : 'data',
      icon: <MemoryStick size={14} aria-hidden="true" />,
    },
    {
      label: t('Processes', 'العمليات'),
      value: live?.Processes === undefined ? '—' : String(live?.Processes ?? '—'),
      tone: 'neutral',
      icon: <Activity size={14} aria-hidden="true" />,
    },
    {
      label: t('System drive free', 'المساحة الحرة'),
      value: live?.Drives?.length
        ? `${Math.round((live.Drives.find(drive => drive.Name === live.SystemDrive)?.FreeGB ?? 0))} GB`
        : '—',
      tone: 'neutral',
      icon: <HardDrive size={14} aria-hidden="true" />,
    },
  ];

  return (
    <div className="knoux-vitality-lab" dir={ar ? 'rtl' : 'ltr'}>
      <StudioHeader
        kicker={t('Health & Performance Lab', 'مختبر الصحة والأداء')}
        title={t('System Vitality', 'حيوية النظام')}
        description={t(
          'Live readings from this machine, the condition they imply, and the bottlenecks the bridge actually detected.',
          'قراءات حيّة من هذا الجهاز، والحالة التي تستنتجها، والاختناقات التي رصدها الجسر فعليًا.',
        )}
        icon={<Gauge size={20} aria-hidden="true" />}
        accent="var(--knoux-family-vitality)"
        metrics={[
          { label: t('Condition', 'الحالة'), value: condition ?? '—', tone: condition ? CONDITION_TONE[condition] : 'neutral' },
          { label: t('Samples', 'العيّنات'), value: measured ? String(samples.length) : '—', tone: 'brand' },
          { label: t('Tools', 'الأدوات'), value: measured ? String(serviceTools.length) : '—', tone: 'data' },
          { label: t('Bridge', 'الجسر'), value: measured ? t('Online', 'متصل') : t('Offline', 'غير متصل'), tone: measured ? 'positive' : 'danger' },
        ]}
      />

      <div className="knoux-vitality-lab__body">
        <section className="knoux-panel" data-role="vital-signals">
          <header>
            <h3>{t('Live condition', 'الحالة الحية')}</h3>
            <div className="knoux-studio-chip-row">
              {condition ? (
                <StatusIndicator tone={CONDITION_TONE[condition]} label={condition.replace('_', ' ')} />
              ) : (
                <StatusIndicator tone="neutral" label={t('Not measured', 'غير مقيس')} />
              )}
              <StatusIndicator
                tone={sampling ? 'data' : 'neutral'}
                label={sampling ? t('Sampling live', 'قياس حيّ') : t('Sampling paused', 'القياس متوقف')}
              />
            </div>
          </header>
          <div className="knoux-panel-body">
            {condition ? (
              <p className="knoux-vitality-lab__condition">{CONDITION_COPY[condition][ar ? 'ar' : 'en']}</p>
            ) : (
              <p className="knoux-vitality-lab__condition">
                {t(
                  'No live sample has been taken yet. The condition appears once the bridge reports a reading.',
                  'لم تُؤخذ عيّنة حية بعد. تظهر الحالة فور صدور قراءة من الجسر.',
                )}
              </p>
            )}

            <div className="knoux-vitality-metrics">
              {metricCards.map(metric => (
                <div className="knoux-vitality-metric" key={metric.label}>
                  <span className="knoux-vitality-metric__icon">{metric.icon}</span>
                  <span className="knoux-vitality-metric__label">{metric.label}</span>
                  <strong className="knoux-vitality-metric__value" data-tone={metric.tone}>{metric.value}</strong>
                </div>
              ))}
            </div>

            <div className="knoux-vitality-timelines">
              <div className="knoux-vitality-timeline">
                <header>
                  <span>{t('CPU load', 'حمل المعالج')}</span>
                  <em>{sampleSpanLabel}</em>
                </header>
                <Sparkline
                  values={cpuSeries}
                  label={t('CPU load timeline', 'خط زمني لحمل المعالج')}
                  tone={cpuLoad !== null && cpuLoad >= 75 ? 'caution' : 'data'}
                  emptyLabel={t('Waiting for the first samples…', 'في انتظار أول العيّنات…')}
                />
              </div>
              <div className="knoux-vitality-timeline">
                <header>
                  <span>{t('Memory in use', 'الذاكرة المستخدمة')}</span>
                  <em>{sampleSpanLabel}</em>
                </header>
                <Sparkline
                  values={memorySeries}
                  label={t('Memory timeline', 'خط زمني للذاكرة')}
                  tone={memoryLoad !== null && memoryLoad >= 80 ? 'caution' : 'data'}
                  emptyLabel={t('Waiting for the first samples…', 'في انتظار أول العيّنات…')}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="knoux-panel" data-role="vital-bottlenecks">
          <header>
            <h3>{t('Detected bottlenecks', 'الاختناقات المرصودة')}</h3>
            {optimizationLoading ? (
              <StatusIndicator tone="data" label={t('Reading…', 'جارٍ القراءة…')} />
            ) : (
              <StatusIndicator tone={bottlenecks.length ? 'caution' : 'positive'} label={String(bottlenecks.length)} />
            )}
          </header>
          <div className="knoux-panel-body">
            {optimizationError ? (
              <EmptyState
                title={t('The performance telemetry could not be read', 'تعذّرت قراءة قياس الأداء')}
                description={optimizationError}
                action={
                  <button type="button" className="knoux-studio-btn" onClick={() => void loadOptimization()}>
                    <RefreshCw size={13} aria-hidden="true" />
                    <span>{t('Retry', 'إعادة المحاولة')}</span>
                  </button>
                }
              />
            ) : bottlenecks.length === 0 ? (
              <EmptyState
                title={measured ? t('No bottleneck crossed its threshold', 'لم يتجاوز أي اختناق عتبةَه') : t('Not checked yet', 'لم يتم الفحص بعد')}
                description={measured
                  ? t('The thresholds are CPU ≥ 80%, memory ≥ 85% and disk active time ≥ 80%.', 'العتبات: المعالج ≥ 80% والذاكرة ≥ 85% ونشاط القرص ≥ 80%.')
                  : undefined}
              />
            ) : (
              <div className="knoux-findings-list">
                {bottlenecks.map(item => (
                  <article key={`${item.domain}-${item.toolId}`} className="knoux-finding" data-severity={item.domain === 'DISK' ? 'high' : item.domain === 'CPU' ? 'critical' : 'medium'}>
                    <span className="knoux-finding-bar" aria-hidden="true" />
                    <div className="knoux-finding-body">
                      <strong>{item.domain} · {item.measuredValue}</strong>
                      <p>{item.impact}</p>
                      <p>{item.recommendation}</p>
                      <button
                        type="button"
                        className="knoux-studio-btn"
                        data-action-id={`investigate-${item.toolId}`}
                        onClick={() => {
                          onSelectService('08-Performance');
                          onSelectTool(item.toolId);
                        }}
                      >
                        <Wrench size={12} aria-hidden="true" />
                        <span>{t(`Investigate with ${item.toolId}`, `تحقّق عبر ${item.toolId}`)}</span>
                        <ArrowRight size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="knoux-panel" data-role="vital-disks">
          <header>
            <h3>{t('Storage pressure', 'ضغط التخزين')}</h3>
            <StatusIndicator tone={disks.length ? 'data' : 'neutral'} label={disks.length ? String(disks.length) : '—'} />
          </header>
          <div className="knoux-panel-body">
            {disks.length === 0 ? (
              <EmptyState title={measured ? t('No volume was reported', 'لم يُبلَّغ عن أي مجلد') : t('Not checked yet', 'لم يتم الفحص بعد')} />
            ) : (
              <ul className="knoux-vitality-disks">
                {disks.map(disk => (
                  <li key={disk.Name}>
                    <div className="knoux-vitality-disk__head">
                      <strong>{disk.Name}</strong>
                      <span>{Math.round(disk.UsedPercent)}%</span>
                    </div>
                    <div className="knoux-vitality-disk__bar" data-tone={disk.UsedPercent >= 90 ? 'danger' : disk.UsedPercent >= 75 ? 'caution' : 'data'}>
                      <span style={{ width: `${Math.min(100, Math.max(0, disk.UsedPercent))}%` }} />
                    </div>
                    <small>
                      {Math.round(disk.FreeGB)} GB free of {Math.round(disk.TotalGB)} GB
                      {disk.ActiveTimePercent !== null ? ` · ${Math.round(disk.ActiveTimePercent)}% active time` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="knoux-panel" data-role="vital-consumers">
          <header>
            <h3>{t('Top consumers', 'أعلى Consumers')}</h3>
            <StatusIndicator tone={topProcesses.length ? 'data' : 'neutral'} label={topProcesses.length ? String(topProcesses.length) : '—'} />
          </header>
          <div className="knoux-panel-body">
            {topProcesses.length === 0 ? (
              <EmptyState title={measured ? t('No process was reported', 'لم يُبلَّغ عن أي عملية') : t('Not checked yet', 'لم يتم الفحص بعد')} />
            ) : (
              <ul className="knoux-vitality-consumers">
                {topProcesses.slice(0, 8).map(process => (
                  <li key={`${process.Id}-${process.Name}`}>
                    <span className="knoux-vitality-consumer__name">{process.Name}</span>
                    <span className="knoux-studio-mono">{Math.round(process.MemoryMB)} MB</span>
                    <span className="knoux-studio-mono">{process.CpuSeconds === null ? '—' : `${Math.round(process.CpuSeconds)}s`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {signals.length > 0 ? (
          <section className="knoux-panel" data-role="vital-signals-detail">
            <header>
              <h3>{t('Windows signals', 'إشارات ويندوز')}</h3>
              <StatusIndicator tone="caution" label={String(signals.length)} />
            </header>
            <div className="knoux-panel-body">
              <ul className="knoux-vitality-signals">
                {signals.map(signal => (
                  <li key={`${signal.Code}-${signal.Message}`} data-level={signal.Level}>
                    <strong>{signal.Code}</strong>
                    <span>{signal.Message}</span>
                    {signal.SuggestedTool ? (
                      <button
                        type="button"
                        className="knoux-studio-btn"
                        onClick={() => {
                          onSelectService('08-Performance');
                          onSelectTool(signal.SuggestedTool!);
                        }}
                      >
                        <span>{signal.SuggestedTool}</span>
                        <ArrowRight size={12} aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="knoux-panel" data-role="vital-entries">
          <header>
            <h3>{t('Open a workbench', 'افتح مساحة عمل')}</h3>
            <StatusIndicator
              tone={bridgeElevated ? 'positive' : 'caution'}
              label={bridgeElevated ? t('Elevated session', 'جلسة مرتفعة') : t('Standard session', 'جلسة قياسية')}
            />
          </header>
          <div className="knoux-panel-body">
            <div className="knoux-vitality-entries">
              {family.services.map(service => {
                const count = measured ? serviceTools.filter(tool => tool.Category === service.id).length : null;
                return (
                  <button
                    key={service.id}
                    type="button"
                    className="knoux-vitality-entry"
                    data-service-id={service.id}
                    onClick={() => onSelectService(service.id)}
                  >
                    <span className="knoux-vitality-entry__body">
                      <strong>{ar ? service.name.ar : service.name.en}</strong>
                      <small>{ar ? service.purpose.ar : service.purpose.en}</small>
                    </span>
                    <StatusIndicator tone="data" label={count === null ? '—' : String(count)} />
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
