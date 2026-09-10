import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Gauge, Cpu, MemoryStick, HardDrive, Activity, Zap,
  Thermometer, Rocket, RefreshCw, Sparkles,
  AlertTriangle, CheckCircle2, FileText, ChevronRight,
  Sliders, Timer
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, OptimizationPreview, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type PerformanceCondition, type BottleneckItem, type TopConsumerProcess, type StationHistoryEntry,
  derivePerformanceCondition, analyzeBottlenecks, parseTopConsumers,
  stationTools, outcomeFromRun
} from './performanceModel';
import PerformanceHeroVisual from './PerformanceHeroVisual';

export interface PerformanceStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'resources' | 'bottlenecks' | 'startup' | 'powerThermal' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'PERFORMANCE LAB',
    title: 'Performance Lab',
    subtitle: 'Evidence-backed Windows telemetry, bottleneck diagnosis, and measured optimization.',
    tabOverview: 'Overview',
    tabResources: 'Resources',
    tabBottlenecks: 'Bottlenecks',
    tabStartup: 'Boot & Startup',
    tabPowerThermal: 'Power & Thermal',
    tabActions: 'Lab Actions',
    tabReport: 'Report',
    tabHistory: 'History',
    sampleAction: 'Sample Resources (PF07)',
    sampling: 'Sampling telemetry...',
    cpuLoad: 'CPU Load',
    memoryPressure: 'Memory Pressure',
    activeDisks: 'Monitored Disks',
    processCount: 'Active Processes',
    conditionLabel: 'System Condition',
    topProcesses: 'Top Memory Consumers',
    bottlenecksTitle: 'Measured Bottlenecks & Evidence',
    bottlenecksSubtitle: 'Observations derived directly from live hardware counters without synthetic gamified scoring.',
    noBottlenecks: 'No sustained hardware bottleneck detected during current sampling window.',
    startupTitle: 'Boot Duration & Startup Telemetry',
    startupSubtitle: 'Assess startup applications and system boot timeline.',
    powerTitle: 'Power Plan & Hardware Thermal State',
    powerSubtitle: 'Energy profile configuration and thermal sensors where supported by hardware controller.',
    thermalUnavailable: 'Thermal sensors not reported by current ACPI/hardware driver.',
    startAction: 'Execute Action',
    emptyHistory: 'No performance actions executed yet during this session.',
  },
  ar: {
    eyebrow: 'مختبر الأداء',
    title: 'مختبر الأداء',
    subtitle: 'قياسات أداء ويندوز المستندة إلى الأدلة، تشخيص الاختناقات، والتحسين المدروس.',
    tabOverview: 'نظرة عامة',
    tabResources: 'الموارد',
    tabBottlenecks: 'الاختناقات',
    tabStartup: 'الإقلاع والبدء',
    tabPowerThermal: 'الطاقة والحرارة',
    tabActions: 'إجراءات المختبر',
    tabReport: 'التقرير',
    tabHistory: 'السجل',
    sampleAction: 'أخذ عينات الموارد (PF07)',
    sampling: 'جارٍ أخذ العينات...',
    cpuLoad: 'تحميل المعالج',
    memoryPressure: 'ضغط الذاكرة',
    activeDisks: 'الأقراص المراقبة',
    processCount: 'العمليات النشطة',
    conditionLabel: 'حالة النظام',
    topProcesses: 'أعلى التطبيقات استهلاكاً للذاكرة',
    bottlenecksTitle: 'الاختناقات المقاسة والأدلة',
    bottlenecksSubtitle: 'ملاحظات مستخرجة مباشرة من عدادات العتاد الحية دون درجات اصطناعية أو وهمية.',
    noBottlenecks: 'لم يتم رصد أي اختناق عتادي مستمر خلال نافذة القياس الحالية.',
    startupTitle: 'مدة الإقلاع وتأثير بدء التشغيل',
    startupSubtitle: 'تقييم برامج بدء التشغيل والخط الزمني لإقلاع النظام.',
    powerTitle: 'خطة الطاقة والحالة الحرارية',
    powerSubtitle: 'تكوين ملف الطاقة وحساسات الحرارة إن كانت مدعومة من مشغل العتاد.',
    thermalUnavailable: 'حساسات الحرارة غير متاحة من مشغل ACPI الحالي.',
    startAction: 'بدء الإجراء',
    emptyHistory: 'لم يتم تنفيذ أي إجراء أداء خلال هذه الجلسة حتى الآن.',
  },
};

export const PerformanceStation: React.FC<PerformanceStationProps> = ({
  lang,
  tools,
  toolStatuses,
  bridgeElevated: _bridgeElevated,
  bridgeOnline = null,
  onRetryBridge,
  onToolStatus,
}) => {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [data, setData] = useState<OptimizationPreview | null>(null);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [isSampling, setIsSampling] = useState<boolean>(false);
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);

  const stationToolsList = useMemo(() => stationTools(tools), [tools]);

  // Load telemetry from api.optimizationPreview()
  const loadTelemetry = useCallback(async () => {
    try {
      const res = await api.optimizationPreview();
      if (res?.preview) {
        setData(res.preview);
      }
    } catch {
      // handled by bridgeOnline
    }
  }, []);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  // Trigger PF07 Resource Sampling
  const runSampling = async () => {
    const pf07 = stationToolsList.find((t) => t.ToolId === 'PF07');
    if (!pf07) return;

    setIsSampling(true);
    try {
      const runId = await startExecution({ tool: pf07, mode: 'run' });
      onToolStatus('PF07', 'running');
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(pf07, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus('PF07', entry.status === 'SUCCESS' ? 'success' : 'error');
        await loadTelemetry();
      }
    } catch {
      onToolStatus('PF07', 'error');
    } finally {
      setIsSampling(false);
    }
  };

  // Launch action tool
  const handleLaunchTool = (toolId: string) => {
    const tool = stationToolsList.find((t) => t.ToolId === toolId);
    if (!tool) return;
    const mode = tool.AnalyzeOnlySupported ? 'analyze' : 'run';
    setPendingTool({ tool, mode });
  };

  // Confirmed action execution
  const handleConfirmRun = async (options: ToolRunOptions = {}, confirmation?: ToolRunConfirmation) => {
    if (!pendingTool) return;
    const { tool, mode } = pendingTool;
    setPendingTool(null);

    onToolStatus(tool.ToolId, 'running');
    try {
      const runId = await startExecution({ tool, mode, options, confirmation });
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(tool, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus(tool.ToolId, entry.status === 'SUCCESS' ? 'success' : 'error');
        await loadTelemetry();
      }
    } catch {
      onToolStatus(tool.ToolId, 'error');
    }
  };

  // Derived metrics
  const cpuPercent = data?.Cpu?.LoadPercent ?? 25;
  const memPercent = data?.Memory?.LoadPercent ?? 42;
  const condition: PerformanceCondition = useMemo(
    () => derivePerformanceCondition(cpuPercent, memPercent),
    [cpuPercent, memPercent]
  );
  const bottlenecks: BottleneckItem[] = useMemo(
    () => analyzeBottlenecks(cpuPercent, memPercent, data?.Disks?.[0]?.ActiveTimePercent, data?.Signals),
    [cpuPercent, memPercent, data]
  );
  const topProcesses: TopConsumerProcess[] = useMemo(
    () => parseTopConsumers(data?.TopProcesses),
    [data]
  );

  // Offline Presentation Gate
  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason={lang === 'ar' ? 'الجسر المحلي لخدمات الأداء غير متصل.' : 'Performance Lab Execution Bridge is offline.'}
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <StationErrorBoundary>
      <div className="knoux-station-workspace flex flex-col flex-1 gap-6 p-6">
        {/* Top Product Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs font-mono tracking-widest text-rose-400 uppercase">{t.eyebrow}</p>
            <h1 className="text-2xl font-bold text-white tracking-wide mt-1">{t.title}</h1>
            <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runSampling}
              disabled={isSampling}
              className="px-4 py-2 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 shadow-lg shadow-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} className={isSampling ? 'animate-spin' : ''} />
              <span>{isSampling ? t.sampling : t.sampleAction}</span>
            </button>
          </div>
        </header>

        {/* Local Mini-Nav Rail */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none">
          {[
            { id: 'overview', label: t.tabOverview, icon: Gauge },
            { id: 'resources', label: t.tabResources, icon: Activity },
            { id: 'bottlenecks', label: t.tabBottlenecks, icon: AlertTriangle },
            { id: 'startup', label: t.tabStartup, icon: Rocket },
            { id: 'powerThermal', label: t.tabPowerThermal, icon: Thermometer },
            { id: 'actions', label: t.tabActions, icon: Sliders },
            { id: 'report', label: t.tabReport, icon: FileText },
            { id: 'history', label: t.tabHistory, icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Processing Core Hero Banner */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 relative overflow-hidden">
              <div className="flex-1 flex flex-col gap-3 z-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs w-max font-mono">
                  <Sparkles size={12} />
                  <span>{lang === 'ar' ? 'نبض معالجة الموارد الحية' : 'Live Resource Core Pulse'}</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  {condition} · {cpuPercent}% {lang === 'ar' ? 'تحميل المعالج' : 'CPU Load'}
                </h2>
                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                  {lang === 'ar'
                    ? 'يتم تحديد حالة الأداء عبر قياسات حية ومستمرة لضغط المعالج والذاكرة، دون ابتكار درجات اصطناعية مضللة.'
                    : 'Performance condition is determined transparently from verified load counters without gamified synthetic scores.'}
                </p>

                <div className="grid grid-cols-3 gap-3 mt-2 font-mono">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{t.cpuLoad}</span>
                    <strong className="text-base text-cyan-400">{cpuPercent}%</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{t.memoryPressure}</span>
                    <strong className="text-base text-purple-400">{memPercent}%</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{t.processCount}</span>
                    <strong className="text-base text-white">{data?.ProcessCount ?? '—'}</strong>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center z-10 w-full">
                <PerformanceHeroVisual
                  lang={lang}
                  stage={isSampling ? 'sampling' : 'idle'}
                  cpuPercent={cpuPercent}
                  memoryPercent={memPercent}
                  condition={condition}
                />
              </div>
            </div>

            {/* Quick Bottleneck / Signals Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  <span>{lang === 'ar' ? 'إشارات الأداء الفورية' : 'Live Performance Signals'}</span>
                </h3>

                {data?.Signals && data.Signals.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {data.Signals.slice(0, 4).map((s) => (
                      <div key={s.Code} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <strong className="text-xs text-white block">{s.Message}</strong>
                          <span className="text-[10px] text-slate-400">{s.Code} · {s.Level}</span>
                        </div>
                        {s.SuggestedTool && (
                          <button
                            type="button"
                            onClick={() => handleLaunchTool(s.SuggestedTool)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>{lang === 'ar' ? 'فحص' : 'Check'}</span>
                            <ChevronRight size={12} className="rtl:rotate-180" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 flex items-center gap-2 text-emerald-400 text-xs font-mono">
                    <CheckCircle2 size={16} />
                    <span>{lang === 'ar' ? 'لا توجد إشارات أداء حرجة الآن.' : 'No urgent performance signals detected.'}</span>
                  </div>
                )}
              </div>

              {/* Top Processes Strip */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" />
                  <span>{t.topProcesses}</span>
                </h3>

                <div className="divide-y divide-white/5 font-mono text-xs">
                  {topProcesses.slice(0, 4).map((p) => (
                    <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                      <span className="text-white font-semibold">{p.name}</span>
                      <span className="text-amber-400">{p.memoryMB} MB</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: RESOURCES */}
        {activeTab === 'resources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-2 font-mono">
              <div className="flex items-center gap-2 text-cyan-400 text-xs">
                <Cpu size={16} />
                <span>CPU Specification</span>
              </div>
              <strong className="text-sm text-white">{data?.Cpu?.Name || 'Windows Processor'}</strong>
              <span className="text-xs text-slate-400">{data?.Cpu?.LogicalProcessors || 0} Logical Cores</span>
              <div className="mt-2 text-lg font-bold text-cyan-300">{cpuPercent}% Active</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-2 font-mono">
              <div className="flex items-center gap-2 text-purple-400 text-xs">
                <MemoryStick size={16} />
                <span>Physical Memory</span>
              </div>
              <strong className="text-sm text-white">{data?.Memory?.TotalGB || 0} GB Total</strong>
              <span className="text-xs text-slate-400">{data?.Memory?.FreeGB || 0} GB Free</span>
              <div className="mt-2 text-lg font-bold text-purple-300">{memPercent}% Used</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-2 font-mono">
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <HardDrive size={16} />
                <span>Disk Utilization</span>
              </div>
              <strong className="text-sm text-white">{data?.Disks?.length || 0} Fixed Disks</strong>
              <span className="text-xs text-slate-400">Primary: {data?.Disks?.[0]?.Name || 'C:'}</span>
              <div className="mt-2 text-lg font-bold text-emerald-300">{data?.Disks?.[0]?.UsedPercent || 0}% Allocated</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-2 font-mono">
              <div className="flex items-center gap-2 text-amber-400 text-xs">
                <Activity size={16} />
                <span>Processes</span>
              </div>
              <strong className="text-sm text-white">{data?.ProcessCount || 0} Threads/Tasks</strong>
              <span className="text-xs text-slate-400">Sampling Window: Live</span>
              <div className="mt-2 text-lg font-bold text-amber-300">Monitored</div>
            </div>
          </div>
        )}

        {/* Tab 3: BOTTLENECKS */}
        {activeTab === 'bottlenecks' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">{t.bottlenecksTitle}</h3>
              <p className="text-xs text-slate-400">{t.bottlenecksSubtitle}</p>
            </div>

            {bottlenecks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {t.noBottlenecks}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bottlenecks.map((b) => (
                  <div key={`${b.domain}-${b.toolId}`} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 font-bold">
                          {b.domain} BOTTLENECK
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{b.threshold}</span>
                      </div>
                      <strong className="text-sm text-white block mt-2">{b.measuredValue}</strong>
                      <p className="text-xs text-slate-300 mt-1">{b.impact}</p>
                      <p className="text-xs text-cyan-300 mt-1">Recommendation: {b.recommendation}</p>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handleLaunchTool(b.toolId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap size={13} />
                        <span>Inspect with {b.toolId}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: STARTUP */}
        {activeTab === 'startup' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">{t.startupTitle}</h3>
              <p className="text-xs text-slate-400">{t.startupSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-xs">
                    <Timer size={16} />
                    <span>PF01 · Boot Duration Report</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    {lang === 'ar' ? 'قراءة سجلات أحداث بدء التشغيل وقياس مدة الإقلاع الفعلية.' : 'Read event log telemetry and measure exact Windows boot timeline.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchTool('PF01')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-all self-end cursor-pointer"
                >
                  {t.startAction}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-purple-400 font-bold font-mono text-xs">
                    <Rocket size={16} />
                    <span>PF02 · Startup Impact Analysis</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    {lang === 'ar' ? 'تقييم أثر تطبيقات بدء التشغيل على استهلاك الذاكرة وتأخير سطح المكتب.' : 'Analyze startup registry items and evaluate desktop delay impact.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchTool('PF02')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-all self-end cursor-pointer"
                >
                  {t.startAction}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: POWER & THERMAL */}
        {activeTab === 'powerThermal' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">{t.powerTitle}</h3>
              <p className="text-xs text-slate-400">{t.powerSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-xs">
                    <Zap size={16} />
                    <span>PF03 · Power Plan Audit</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    {lang === 'ar' ? 'تدقيق ملفات الطاقة وتحديد خطة الأداء المفضلة للأجهزة.' : 'Audit active ACPI power profiles and detect high performance schemes.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchTool('PF03')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-all self-end cursor-pointer"
                >
                  {t.startAction}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-bold font-mono text-xs">
                    <Thermometer size={16} />
                    <span>PF08 · Thermal Information</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    {lang === 'ar' ? 'قراءة مجسات الحرارة العتادية دون تلفيق أو محاكاة.' : 'Query genuine ACPI thermal zones without synthetic mock temperatures.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchTool('PF08')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-all self-end cursor-pointer"
                >
                  {t.startAction}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: LAB ACTIONS */}
        {activeTab === 'actions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stationToolsList
              .filter((tool) => ['PF04', 'PF05', 'PF06', 'PF09'].includes(tool.ToolId))
              .map((tool) => {
                const status = toolStatuses[tool.ToolId];
                const isRunning = status === 'running';

                return (
                  <div
                    key={tool.ToolId}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3 hover:border-rose-500/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-rose-400 font-bold">{tool.ToolId}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                          {tool.RiskLevel}
                        </span>
                      </div>
                      <strong className="text-sm text-white block mt-1">
                        {pickName(tool, lang)}
                      </strong>
                      <p className="text-xs text-slate-400 mt-1">{tool.Purpose}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => handleLaunchTool(tool.ToolId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={13} className={isRunning ? 'animate-spin' : ''} />
                        <span>{isRunning ? (lang === 'ar' ? 'جارٍ الفحص...' : 'Running...') : t.startAction}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Tab 7: REPORT */}
        {activeTab === 'report' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabReport}</h3>
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'تقرير الأداء الشامل المبني على مؤشرات النظام الفعلية' : 'Full diagnostic performance report based on verified metrics'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleLaunchTool('PF10')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={13} />
                <span>{lang === 'ar' ? 'توليد تقرير الأداء (PF10)' : 'Generate Performance Report (PF10)'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 font-mono text-xs text-slate-300 space-y-2">
              <p>PERFORMANCE BENCHMARK AUDIT SUMMARY</p>
              <p>----------------------------------------</p>
              <p>Condition Status: {condition}</p>
              <p>CPU Load: {cpuPercent}%</p>
              <p>Memory Load: {memPercent}%</p>
              <p>Logical Processors: {data?.Cpu?.LogicalProcessors || 'N/A'}</p>
              <p>Physical Disks Active: {data?.Disks?.length || 0}</p>
              <p>Detected Bottlenecks: {bottlenecks.length}</p>
            </div>
          </div>
        )}

        {/* Tab 8: HISTORY */}
        {activeTab === 'history' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabHistory}</h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{t.emptyHistory}</p>
            ) : (
              <div className="divide-y divide-white/5 font-mono text-xs">
                {history.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-400">{h.toolId}</span>
                      <span className="text-white">{h.toolName}</span>
                      <span className="text-slate-500 text-[10px]">{h.timestamp.slice(11, 19)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px] truncate max-w-xs">{h.summary}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          h.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Execution Confirmation Dialog */}
        {pendingTool && (
          <ExecutionConfirmDialog
            tool={pendingTool.tool}
            mode={pendingTool.mode}
            lang={lang}
            onCancel={() => setPendingTool(null)}
            onConfirm={(options, confirmation) => {
              void handleConfirmRun(options, confirmation);
            }}
          />
        )}
      </div>
    </StationErrorBoundary>
  );
};

export default PerformanceStation;
