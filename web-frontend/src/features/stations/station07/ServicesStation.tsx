import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Cpu, Sparkles, RefreshCw, Layers,
  FileText, Search, Play, Square,
  Network, ShieldCheck
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions, OperationsPreview } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type ServiceItem, type ProcessItem, type ServiceTopology, type StationHistoryEntry,
  parseServicesInventory, parseProcessesInventory, calculateServiceTopology,
  filterServices, filterProcesses, stationTools, outcomeFromRun
} from './servicesModel';
import ServicesHeroVisual from './ServicesHeroVisual';

export interface ServicesStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'services' | 'processes' | 'dependencies' | 'report' | 'history';
type ServiceEvidence = { source: 'SP11' | 'SP01'; topology: ServiceTopology; attentionKnown: boolean };
type BaselineState = { serviceEvidence: ServiceEvidence | null; processTotal: number | null };

const COPY = {
  en: {
    eyebrow: 'SERVICE OPERATIONS CENTER',
    title: 'Service Operations Center',
    subtitle: 'Read-only Windows service inventories, process monitoring, and dependency evidence.',
    tabOverview: 'Overview',
    tabServices: 'Services',
    tabProcesses: 'Processes',
    tabDependencies: 'Dependencies',
    tabReport: 'Report',
    tabHistory: 'History',
    scanAction: 'Scan Service Inventory',
    scanning: 'Querying service states...',
    runningServices: 'Running Services',
    stoppedServices: 'Stopped Services',
    automaticServices: 'Automatic Start',
    attentionCount: 'Needs Review',
    totalProcesses: 'Active Processes',
    protectedService: 'Protected System Service',
    protectedProcess: 'Protected System Process',
    searchServices: 'Search services by name or description...',
    searchProcesses: 'Search processes by name or PID...',
    allFilter: 'All',
    runningFilter: 'Running',
    stoppedFilter: 'Stopped',
    automaticFilter: 'Automatic',
    disabledFilter: 'Disabled',
    notRespondingFilter: 'Not Responding',
    highMemoryFilter: 'High Memory',
    userFilter: 'User Apps',
    blastRadius: 'Blast Radius',
    emptyHistory: 'No read-only inventory or report actions executed yet during this session.',
    dependenciesTitle: 'Service Dependency Graph & Blast Radius',
    dependenciesSubtitle: 'Analyze what other services depend on a target before stopping or restarting.',
    queryDependencies: 'Inspect Service Dependencies',
  },
  ar: {
    eyebrow: 'مركز عمليات الخدمات والعمليات',
    title: 'مركز عمليات الخدمات والعمليات',
    subtitle: 'جرد خدمات ويندوز للقراءة فقط، مراقبة العمليات، وأدلة التبعيات.',
    tabOverview: 'نظرة عامة',
    tabServices: 'الخدمات',
    tabProcesses: 'العمليات',
    tabDependencies: 'التبعيات والارتباطات',
    tabReport: 'التقرير',
    tabHistory: 'السجل',
    scanAction: 'تحديث بيانات العمليات',
    scanning: 'جارٍ قراءة حالات الخدمات...',
    runningServices: 'خدمات تعمل',
    stoppedServices: 'خدمات متوقفة',
    automaticServices: 'بدء تلقائي',
    attentionCount: 'تحتاج مراجعة',
    totalProcesses: 'العمليات النشطة',
    protectedService: 'خدمة نظام محمية',
    protectedProcess: 'عملية نظام محمية',
    searchServices: 'بحث في الخدمات بالاسم أو الوصف...',
    searchProcesses: 'بحث في العمليات بالاسم أو المعرف (PID)...',
    allFilter: 'الكل',
    runningFilter: 'قيد التشغيل',
    stoppedFilter: 'متوقفة',
    automaticFilter: 'تلقائي',
    disabledFilter: 'معطلة',
    notRespondingFilter: 'لا تستجيب',
    highMemoryFilter: 'استهلاك ذاكرة مرتفع',
    userFilter: 'تطبيقات المستخدم',
    blastRadius: 'نطاق الأثر',
    emptyHistory: 'لم يتم تنفيذ أي جرد أو تقرير للقراءة فقط خلال هذه الجلسة حتى الآن.',
    dependenciesTitle: 'مخطط تبعيات الخدمات ونطاق الأثر',
    dependenciesSubtitle: 'تحليل الخدمات التي تعتمد على خدمة معينة قبل إيقافها أو إعادة تشغيلها لمنع انقطاع النظام.',
    queryDependencies: 'فحص تبعيات الخدمات',
  },
};

export const ServicesStation: React.FC<ServicesStationProps> = ({
  lang,
  tools,
  bridgeOnline = null,
  onRetryBridge,
  onToolStatus,
}) => {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [serviceQuery, setServiceQuery] = useState<string>('');
  const [processQuery, setProcessQuery] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'running' | 'stopped' | 'automatic' | 'disabled'>('all');
  const [processFilter, setProcessFilter] = useState<'all' | 'notResponding' | 'highMemory' | 'user'>('all');
  const [baseline, setBaseline] = useState<BaselineState>({ serviceEvidence: null, processTotal: null });
  const [hasServiceInventory, setHasServiceInventory] = useState(false);
  const [hasProcessInventory, setHasProcessInventory] = useState(false);
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);

  const stationToolsList = useMemo(() => stationTools(tools), [tools]);

  const loadBaseline = useCallback(async () => {
    try {
      const res = await api.operationsPreview();
      const preview: OperationsPreview | undefined = res?.preview;
      if (!preview) return;
      const serviceCounts = preview.Services;
      const countsAreValid = [serviceCounts?.Total, serviceCounts?.Running, serviceCounts?.Stopped, serviceCounts?.Automatic]
        .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
        && serviceCounts.Running <= serviceCounts.Total
        && serviceCounts.Stopped <= serviceCounts.Total
        && serviceCounts.Running + serviceCounts.Stopped <= serviceCounts.Total
        && serviceCounts.Automatic <= serviceCounts.Total;
      const serviceEvidence = countsAreValid
        ? {
            source: 'SP11' as const,
            topology: {
              total: serviceCounts.Total,
              running: serviceCounts.Running,
              stopped: serviceCounts.Stopped,
              automatic: serviceCounts.Automatic,
              manual: 0,
              disabled: 0,
              attentionCount: Array.isArray(serviceCounts.AutomaticStoppedForReview)
                ? serviceCounts.AutomaticStoppedForReview.length
                : 0,
            },
            attentionKnown: false,
          }
        : null;
      setBaseline({
        serviceEvidence,
        processTotal: typeof preview.Processes?.Total === 'number' && Number.isFinite(preview.Processes.Total) && preview.Processes.Total >= 0
          ? preview.Processes.Total
          : null,
      });
    } catch {
    }
  }, []);

  useEffect(() => {
    void loadBaseline();
  }, [loadBaseline]);

  // Trigger SP01 Live Services Inventory
  const runServicesScan = async () => {
    const sp01 = stationToolsList.find((tool) => tool.ToolId === 'SP01');
    if (!sp01) return;

    setIsScanning(true);
    try {
      const runId = await startExecution({ tool: sp01, mode: 'run' });
      onToolStatus('SP01', 'running');
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(sp01, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus('SP01', entry.status === 'SUCCESS' ? 'success' : 'error');
        const rawItems = (poll.result.evidence as any)?.Items || (poll.result.rawOutput as any)?.Items;
        if (Array.isArray(rawItems)) {
          const inventory = parseServicesInventory(rawItems);
          setServices(inventory);
          setHasServiceInventory(true);
          setBaseline((current) => ({
            ...current,
            serviceEvidence: { source: 'SP01', topology: calculateServiceTopology(inventory), attentionKnown: true },
          }));
        } else {
          await loadBaseline();
        }
      }
    } catch {
      onToolStatus('SP01', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger SP02 Live Processes Inventory
  const runProcessesScan = async () => {
    const sp02 = stationToolsList.find((tool) => tool.ToolId === 'SP02');
    if (!sp02) return;

    setIsScanning(true);
    try {
      const runId = await startExecution({ tool: sp02, mode: 'run' });
      onToolStatus('SP02', 'running');
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(sp02, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus('SP02', entry.status === 'SUCCESS' ? 'success' : 'error');
        const rawItems = (poll.result.evidence as any)?.Items || (poll.result.rawOutput as any)?.Items;
        if (Array.isArray(rawItems)) {
          setProcesses(parseProcessesInventory(rawItems));
          setHasProcessInventory(true);
          setBaseline((current) => ({ ...current, processTotal: rawItems.length }));
        } else {
          await loadBaseline();
        }
      }
    } catch {
      onToolStatus('SP02', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Action launcher
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
      }
    } catch {
      onToolStatus(tool.ToolId, 'error');
    }
  };

  const topology = hasServiceInventory
    ? calculateServiceTopology(services)
    : baseline.serviceEvidence?.topology ?? calculateServiceTopology(services);
  const hasServiceEvidence = hasServiceInventory || baseline.serviceEvidence !== null;
  const filteredServicesList = useMemo(() => filterServices(services, serviceQuery, serviceFilter), [services, serviceQuery, serviceFilter]);
  const filteredProcessesList = useMemo(() => filterProcesses(processes, processQuery, processFilter), [processes, processQuery, processFilter]);

  // Offline Presentation Gate
  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason={lang === 'ar' ? 'الجسر المحلي لخدمات وعمليات النظام غير متصل.' : 'Service Operations Execution Bridge is offline.'}
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <StationErrorBoundary>
      <div className="knoux-station-workspace services-topology-station flex flex-col flex-1 gap-6 p-6">
        {/* Top Product Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs font-mono tracking-widest text-amber-400 uppercase">{t.eyebrow}</p>
            <h1 className="text-2xl font-bold text-white tracking-wide mt-1">{t.title}</h1>
            <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runServicesScan}
              disabled={isScanning}
              className="px-4 py-2 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? t.scanning : t.scanAction}</span>
            </button>
          </div>
        </header>

        {/* Local Mini-Nav Rail */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none">
          {[
            { id: 'overview', label: t.tabOverview, icon: Activity },
            { id: 'services', label: t.tabServices, icon: Layers },
            { id: 'processes', label: t.tabProcesses, icon: Cpu },
            { id: 'dependencies', label: t.tabDependencies, icon: Network },
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
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
            {/* Constellation Hero Banner */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 relative overflow-hidden">
              <div className="flex-1 flex flex-col gap-3 z-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs w-max font-mono">
                  <Sparkles size={12} />
                  <span>{lang === 'ar' ? 'كوكبة الخدمات والعمليات' : 'Service Topology Constellation'}</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-wide" data-services-evidence={baseline.serviceEvidence?.source ?? (hasServiceInventory ? 'SP01' : 'unchecked')}>
                  {hasServiceEvidence ? topology.running : '—'} {hasServiceEvidence
                    ? (lang === 'ar' ? 'خدمة تعمل حالياً' : 'Services Active')
                    : (lang === 'ar' ? 'لم يتم التحقق بعد' : 'Not checked yet')}
                </h2>
                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                  {hasServiceEvidence
                    ? (baseline.serviceEvidence?.source === 'SP01'
                      ? (lang === 'ar' ? 'جرد خدمات كامل للقراءة فقط من الفحص الصريح.' : 'Complete read-only service inventory from the explicit scan.')
                      : (lang === 'ar' ? 'ملخص للقراءة فقط من لقطة SP11. الجرد الكامل متاح بعد فحص الخدمات.' : 'Read-only aggregate snapshot from SP11. A full inventory is available after an explicit service scan.'))
                    : (lang === 'ar'
                      ? 'لم يتم فحص حالة الخدمات على هذا الجهاز بعد.'
                      : 'Service state has not been checked on this machine yet.')}
                </p>

                <div className="grid grid-cols-3 gap-3 mt-2 font-mono" data-services-summary={hasServiceInventory ? 'full-inventory' : hasServiceEvidence ? 'aggregate' : 'unchecked'}>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{t.runningServices}</span>
                    <strong className="text-base text-emerald-400">{hasServiceEvidence ? topology.running : '—'}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{t.stoppedServices}</span>
                    <strong className="text-base text-slate-300">{hasServiceEvidence ? topology.stopped : '—'}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{t.attentionCount}</span>
                    <strong className={`text-base ${hasServiceEvidence && baseline.serviceEvidence?.attentionKnown && topology.attentionCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {hasServiceEvidence && baseline.serviceEvidence?.attentionKnown ? topology.attentionCount : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center z-10 w-full">
                <ServicesHeroVisual lang={lang} stage={isScanning ? 'scanning' : 'idle'} topology={topology} hasEvidence={hasServiceEvidence} attentionKnown={baseline.serviceEvidence?.attentionKnown ?? hasServiceInventory} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">READ ONLY</span>
                  </div>
                  <strong className="text-sm text-white block mt-1">
                    {lang === 'ar' ? 'جرد الخدمات الكامل' : 'Scan Full Service Inventory'}
                  </strong>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'ar' ? 'قراءة حالة كل خدمة دون تغيير إعدادات النظام.' : 'Read every service status and start mode without changing system settings.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-readonly-tool="SP01"
                  onClick={runServicesScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 transition-all self-end cursor-pointer"
                >
                  {lang === 'ar' ? 'فحص الخدمات' : 'Scan Services'}
                </button>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">READ ONLY</span>
                  </div>
                  <strong className="text-sm text-white block mt-1">
                    {lang === 'ar' ? 'جرد العمليات الكامل' : 'Scan Full Process Inventory'}
                  </strong>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'ar' ? 'قراءة بيانات المعالجة والذاكرة دون إنهاء أي عملية.' : 'Read CPU and memory telemetry without terminating any process.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-readonly-tool="SP02"
                  onClick={runProcessesScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 transition-all self-end cursor-pointer"
                >
                  {lang === 'ar' ? 'فحص العمليات' : 'Scan Processes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: SERVICES */}
        {activeTab === 'services' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabServices}</h3>
              <button
                type="button"
                onClick={runServicesScan}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
                <span>{lang === 'ar' ? 'جرد الخدمات بالكامل' : 'Scan All Services'}</span>
              </button>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder={t.searchServices}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: t.allFilter },
                  { id: 'running', label: t.runningFilter },
                  { id: 'stopped', label: t.stoppedFilter },
                  { id: 'automatic', label: t.automaticFilter },
                  { id: 'disabled', label: t.disabledFilter },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setServiceFilter(cat.id as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      serviceFilter === cat.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400" data-service-inventory-state={hasServiceInventory ? 'complete' : 'preview'}>
              {hasServiceInventory
                ? (lang === 'ar' ? 'جرد كامل من فحص SP01 للقراءة فقط.' : 'Complete read-only inventory from the explicit SP01 scan.')
                : (lang === 'ar'
                  ? 'لم يتم جرد الخدمات. تعروض SP11 إجمالياً للقراءة فقط ومجموعة مراجعة جزئية وليست قائمة كاملة.'
                  : 'Services have not been inventoried. SP11 is a read-only aggregate snapshot with a partial review subset, not a complete service list.')}
            </p>

            {/* Services Table */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto font-mono text-xs">
              <table className="w-full text-left text-slate-300">
                <thead className="border-b border-white/10 text-slate-400 uppercase text-[10px] sticky top-0 bg-slate-950/90 backdrop-blur-sm">
                  <tr>
                    <th className="py-2 px-3">Service</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Startup</th>
                    <th className="py-2 px-3">{t.blastRadius}</th>
                    <th className="py-2 px-3">PID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {!hasServiceInventory && (
                    <tr>
                      <td colSpan={5} className="py-8 px-3 text-center text-slate-400">
                        {lang === 'ar' ? 'لم يتم فحص الخدمات بعد. اضغط فحص الخدمات لجرد كامل.' : 'Services not checked yet. Run the full service scan to populate this inventory.'}
                      </td>
                    </tr>
                  )}
                  {hasServiceInventory && filteredServicesList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 px-3 text-center text-slate-400">No services match this filter.</td>
                    </tr>
                  )}
                  {filteredServicesList.map((s) => (
                    <tr key={s.name} className="hover:bg-white/5">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-xs">{s.name}</strong>
                          {s.isProtected && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[9px]">
                              SYSTEM
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate max-w-xs">{s.displayName}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 w-max ${
                            s.status === 'Running'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {s.status === 'Running' ? <Play size={10} /> : <Square size={10} />}
                          <span>{s.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{s.startType}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            s.blastRadius === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : s.blastRadius === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {s.blastRadius}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{s.processId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: PROCESSES */}
        {activeTab === 'processes' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabProcesses}</h3>
              <button
                type="button"
                onClick={runProcessesScan}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
                <span>{lang === 'ar' ? 'جرد العمليات الحية' : 'Scan Active Processes'}</span>
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={processQuery}
                  onChange={(e) => setProcessQuery(e.target.value)}
                  placeholder={t.searchProcesses}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: t.allFilter },
                  { id: 'notResponding', label: t.notRespondingFilter },
                  { id: 'highMemory', label: t.highMemoryFilter },
                  { id: 'user', label: t.userFilter },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setProcessFilter(cat.id as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      processFilter === cat.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400" data-process-inventory-state={hasProcessInventory ? 'complete' : 'preview'}>
              {hasProcessInventory
                ? (lang === 'ar' ? 'جرد كامل من فحص SP02 للقراءة فقط.' : 'Complete read-only inventory from the explicit SP02 scan.')
                : (lang === 'ar'
                  ? `لقطة SP11 للقراءة فقط: ${baseline.processTotal ?? '—'} عملية. لم يتم تحميل قائمة العمليات الكاملة.`
                  : `Read-only SP11 snapshot: ${baseline.processTotal ?? '—'} processes. The full process list has not been loaded.`)}
            </p>

            <div className="overflow-x-auto max-h-96 overflow-y-auto font-mono text-xs">
              <table className="w-full text-left text-slate-300">
                <thead className="border-b border-white/10 text-slate-400 uppercase text-[10px] sticky top-0 bg-slate-950/90 backdrop-blur-sm">
                  <tr>
                    <th className="py-2 px-3">PID</th>
                    <th className="py-2 px-3">Process Name</th>
                    <th className="py-2 px-3">Memory (MB)</th>
                    <th className="py-2 px-3">CPU (s)</th>
                    <th className="py-2 px-3">Responding</th>
                    <th className="py-2 px-3">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {!hasProcessInventory && (
                    <tr>
                      <td colSpan={6} className="py-8 px-3 text-center text-slate-400">
                        {lang === 'ar' ? 'لم يتم فحص العمليات بعد. اضغط فحص العمليات لجرد كامل.' : 'Processes not checked yet. Run the full process scan to populate this inventory.'}
                      </td>
                    </tr>
                  )}
                  {hasProcessInventory && filteredProcessesList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 px-3 text-center text-slate-400">No processes match this filter.</td>
                    </tr>
                  )}
                  {filteredProcessesList.map((p) => (
                    <tr key={`${p.name}-${p.pid}`} className="hover:bg-white/5">
                      <td className="py-2.5 px-3 text-slate-500">{p.pid}</td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.isProtected && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[9px]">
                              PROTECTED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-amber-400">{p.memoryMB} MB</td>
                      <td className="py-2.5 px-3 text-slate-400">{p.cpuSeconds}s</td>
                      <td className="py-2.5 px-3">
                        {p.responding === false ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                            HUNG
                          </span>
                        ) : p.responding === true ? (
                          <span className="text-emerald-400 text-[11px]">OK</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unknown</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 capitalize">{p.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: DEPENDENCIES */}
        {activeTab === 'dependencies' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{t.dependenciesTitle}</h3>
                <p className="text-xs text-slate-400">{t.dependenciesSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => handleLaunchTool('SP07')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Network size={13} />
                <span>{t.queryDependencies}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/5 font-mono text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                <ShieldCheck size={16} />
                <span>BLAST RADIUS & SYSTEM INTEGRITY POLICY</span>
              </div>
              <p>Critical services (RPCSS, DcomLaunch, PlugPlay, EventLog, CryptSvc) carry CRITICAL blast radius.</p>
              <p>Stopping or disabling critical services is strictly blocked to maintain system stability.</p>
              <p>Use SP07 to trace nested dependencies before modifying non-critical background services.</p>
            </div>
          </div>
        )}

        {/* Tab 5: REPORT */}
        {activeTab === 'report' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabReport}</h3>
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'تقرير حالة العمليات والخدمات والتبعيات المبني على قياسات الجهاز' : 'Operations & services diagnostic report based on measured evidence'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleLaunchTool('SP10')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={13} />
                <span>{lang === 'ar' ? 'توليد تقرير العمليات' : 'Generate Operations Report'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 font-mono text-xs text-slate-300 space-y-2" data-report-evidence={hasServiceInventory ? 'full-inventory' : hasServiceEvidence ? 'read-only-aggregate' : 'unchecked'}>
              <p>SERVICE OPERATIONS EVIDENCE SUMMARY</p>
              <p>----------------------------------------</p>
              {hasServiceInventory ? (
                <>
                  <p>Full SP01 service inventory: {topology.total} enumerated</p>
                  <p>Running Services: {topology.running}</p>
                  <p>Stopped Services: {topology.stopped}</p>
                  <p>Automatic Start Services: {topology.automatic}</p>
                  <p>Automatic Stopped (Needs Review): {topology.attentionCount}</p>
                </>
              ) : (
                <>
                  <p>Read-only SP11 service aggregates: {hasServiceEvidence ? topology.total : 'not checked'}</p>
                  <p>Running Services: {hasServiceEvidence ? topology.running : '—'}</p>
                  <p>Stopped Services: {hasServiceEvidence ? topology.stopped : '—'}</p>
                  <p>Automatic Start Services: {hasServiceEvidence ? topology.automatic : '—'}</p>
                  <p>Automatic Stopped (Review Subset): {hasServiceEvidence && baseline.serviceEvidence?.attentionKnown ? topology.attentionCount : '—'}</p>
                </>
              )}
              <p>{hasProcessInventory ? `Full SP02 process inventory: ${processes.length}` : `Read-only SP11 process aggregate: ${baseline.processTotal ?? '—'}`}</p>
            </div>
          </div>
        )}

        {/* Tab 7: HISTORY */}
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
                      <span className="font-bold text-amber-400">{h.toolId}</span>
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

export default ServicesStation;
