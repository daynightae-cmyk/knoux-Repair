import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Cpu, HardDrive, RefreshCw, Play,
  CheckCircle2, AlertTriangle, XCircle, FileText,
Wrench, Clock, FileWarning
} from 'lucide-react';
import type { BridgeRun, BridgeTool, DiagnosticsPreview, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState, StationActiveRunBanner } from '../_shared';
import { startExecution, pollUntilTerminal, requestConfirmedCancel, rememberRun, recallRun, forgetRun, historyMessageForRun } from '../_shared/StationExecutionController';
import {
  type DiagnosticSignal, type StationHistoryEntry,
  summarizeDiagnostics, parseProblemDevices, parseEventLog, parseDiskSmart,
  detectDiagnosticSignals, stationTools, outcomeFromRun
} from './diagnosticsModel';
import DiagnosticsHeroVisual from './DiagnosticsHeroVisual';

export interface DiagnosticsStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'events' | 'devices' | 'hardware' | 'storage' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'DIAGNOSTIC EVIDENCE CENTER',
    title: 'Diagnostic Evidence & System Telemetry',
    subtitle: 'Comprehensive Windows hardware diagnostics, event log analysis, and SMART telemetry.',
    tabOverview: 'Overview',
    tabEvents: 'Event Log',
    tabDevices: 'Device Manager',
    tabHardware: 'Hardware & OS',
    tabStorage: 'Storage SMART',
    tabActions: 'Diagnostic Tools',
    tabReport: 'Evidence Report',
    tabHistory: 'History',
    refresh: 'Run Checkup',
    refreshing: 'Collecting diagnostics...',
    conditionLabel: 'System Health Baseline',
    healthyDesc: 'Healthy — No critical hardware or event alerts observed',
    attentionDesc: 'Review Recommended — Non-critical alerts detected',
    criticalDesc: 'Critical Findings — Immediate hardware/system attention required',
    unknownDesc: 'Diagnostics Pending',
    eventErrors: 'Errors & Critical Events',
    problemDevices: 'Device Manager Problems',
    smartFailures: 'SMART Failure Warnings',
    bootTime: 'Last Boot Duration',
    uptime: 'System Uptime',
    quickFullReport: 'Full Report',
    quickHardware: 'Hardware Summary',
    quickEvents: 'Audit Events',
    signalsTitle: 'Diagnostic Findings & Observations',
    noSignals: 'All monitored hardware subsystems and event logs report nominal operation.',
    eventsTitle: 'Observed System & Application Errors',
    eventsSubtitle: 'Real events queried directly from the Windows Event Log.',
    devicesTitle: 'Device Manager Problem Entities',
    devicesSubtitle: 'Physical and virtual devices reporting non-zero ConfigManagerErrorCode.',
    storageTitle: 'Physical Disk SMART Health',
    storageSubtitle: 'Storage health counters queried via Windows Storage Management Provider.',
    hardwareTitle: 'Hardware Architecture & Memory Configuration',
    hardwareSubtitle: 'Processor, physical memory capacity, and Windows OS build details.',
    emptyHistory: 'No diagnostic tools executed yet during this session.',
    noProblemDevices: 'No hardware device problems detected in Device Manager.',
    noEventsRecorded: 'No critical errors recorded in the monitored window.',
    adminRequired: 'Administrator elevation is required for this action.',
    notCheckedYet: 'Not checked yet',
    countNotReported: 'Count not reported',
    noTerminalResult: 'No terminal result was returned.',
    noSuccessEvidence: 'The action ended without a verified successful result.',
  },
  ar: {
    eyebrow: 'مركز أدلة الفحص والتشخيص',
    title: 'مركز الفحص الشامل وأدلة النظام',
    subtitle: 'تشخيص دقيق لعتاد ويندوز، وسجلات الأحداث الحرجة، وسلامة أقراص التخزين SMART.',
    tabOverview: 'نظرة عامة',
    tabEvents: 'سجل الأحداث',
    tabDevices: 'إدارة الأجهزة',
    tabHardware: 'العتاد والنظام',
    tabStorage: 'صحة التخزين SMART',
    tabActions: 'أدوات الفحص',
    tabReport: 'تقرير الأدلة',
    tabHistory: 'السجل',
    refresh: 'إجراء الفحص',
    refreshing: 'جارٍ جمع بيانات الفحص...',
    conditionLabel: 'مؤشر سلامة النظام',
    healthyDesc: 'سليم — لم يتم رصد أي مشكلة عتادية أو أحداث حرجة',
    attentionDesc: 'تنبيه للمراجعة — توجد ملاحظات غير حرجة تستحق المتابعة',
    criticalDesc: 'ملاحظات حرجة — يتطلب تدخلاً عتادياً أو برمجياً عاجلاً',
    unknownDesc: 'بانتظار نتائج الفحص',
    eventErrors: 'الأخطاء والأحداث الحرجة',
    problemDevices: 'أجهزة تحتاج مراجعة',
    smartFailures: 'تحذيرات فشل SMART',
    bootTime: 'مدة آخر إقلاع',
    uptime: 'مدة تشغيل الجهاز',
    quickFullReport: 'تقرير كامل',
    quickHardware: 'ملخص العتاد',
    quickEvents: 'تدقيق الأحداث',
    signalsTitle: 'الملاحظات والنتائج التشخيصية',
    noSignals: 'جميع المكونات والعتاد تعمل بشكل طبيعي وموثق دون أي إنذار.',
    eventsTitle: 'الأخطاء المرصودة في سجل ويندوز',
    eventsSubtitle: 'أحداث حقيقية مقروءة مباشرة من سجل أحداث نظام ويندوز.',
    devicesTitle: 'الأجهزة التي أبلغت عن أخطاء تشغيل',
    devicesSubtitle: 'الأجهزة العتادية والافتراضية التي تعيد رمز خطأ في إدارة الأجهزة.',
    storageTitle: 'الصحة التنبؤية لأقراص التخزين SMART',
    storageSubtitle: 'مؤشرات سلامة الأقراص الفيزيائية عبر واجهة موفر إدارة التخزين.',
    hardwareTitle: 'بنية العتاد وتكوين الذاكرة',
    hardwareSubtitle: 'المعالج، سعة الذاكرة الفيزيائية المتاحة، وإصدار بنية ويندوز.',
    emptyHistory: 'لم يتم تشغيل أدوات فحص بعد خلال هذه الجلسة.',
    noProblemDevices: 'لم يتم رصد أي جهاز به عطل في إدارة الأجهزة.',
    noEventsRecorded: 'لا توجد أخطاء حرجة مسجلة خلال نافذة المراقبة.',
    adminRequired: 'يتطلب هذا الإجراء صلاحيات المسؤول.',
    notCheckedYet: 'لم يتم الفحص بعد',
    countNotReported: 'لم يتم الإبلاغ عن العدد',
    noTerminalResult: 'لم تُرجع نتيجة نهائية.',
    noSuccessEvidence: 'انتهى الإجراء دون نتيجة ناجحة موثقة.',
  },
};

const STATION_KEY = 'station10';

export default function DiagnosticsStation(props: DiagnosticsStationProps) {
  return (
    <StationErrorBoundary>
      <DiagnosticsStationContent {...props} />
    </StationErrorBoundary>
  );
}

function DiagnosticsStationContent({
  lang,
  tools,
  toolStatuses,
  bridgeElevated,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: DiagnosticsStationProps) {
  const text = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [preview, setPreview] = useState<DiagnosticsPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{
    tool: BridgeTool;
    mode: ExecutionMode;
    options?: ToolRunOptions;
  } | null>(null);
  // Active run tracking: selection and execution are separate concepts.
  // CANCELLED is recorded only after the backend confirms a terminal state;
  // aborting local observation never fabricates cancellation.
  const [activeRun, setActiveRun] = useState<{ runId: string; toolId: string; phase: 'running' | 'cancelling'; lineCount: number } | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const settledRef = useRef(false);
  const reconcileInflightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollAbortRef.current?.abort();
    };
  }, []);

  // Filter tools strictly belonging to Station 10
  const stTools = useMemo(() => stationTools(tools), [tools]);

  // Load diagnostics telemetry from bridge
  const refreshDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.diagnosticsPreview();
      setPreview(res.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  // Domain model computations
  const summary = useMemo(() => summarizeDiagnostics(preview), [preview]);
  const problemDevices = useMemo(() => parseProblemDevices(preview?.Devices?.Problems), [preview?.Devices?.Problems]);
  const eventLogs = useMemo(() => parseEventLog(preview?.Events?.Recent), [preview?.Events?.Recent]);
  const disksSmart = useMemo(() => parseDiskSmart(preview?.Storage?.Disks), [preview?.Storage?.Disks]);
  const signals: DiagnosticSignal[] = useMemo(() => detectDiagnosticSignals(summary), [summary]);

  // Execution handler. mode is passed through untouched: analyze stays
  // analyze and is never silently promoted to run.
  // Records ONLY backend-terminal outcomes.
  const settleTerminalRun = useCallback((toolId: string, toolName: string, terminal: BridgeRun) => {
    forgetRun(STATION_KEY);
    const status = terminal.status === 'cancelled' ? 'CANCELLED' as const : outcomeFromRun(terminal.result);
    onToolStatus(toolId, status === 'SUCCESS' ? 'success' : status === 'WARNING' ? 'inconclusive' : status === 'FAILED' ? 'error' : status === 'CANCELLED' ? 'cancelled' : 'inconclusive');
    const newEntry: StationHistoryEntry = {
      id: `${toolId}-${Date.now()}`,
      toolId,
      toolName,
      timestamp: new Date().toLocaleTimeString(lang),
      status,
      itemsProcessed: terminal.result?.itemsProcessed ?? terminal.result?.ItemsProcessed ?? 0,
      summary: terminal.result?.Status === 'Success' || terminal.result?.status === 'success'
        ? (lang === 'ar' ? 'اكتمل الفحص التشخيصي بنجاح' : 'Diagnostic scan completed successfully')
        : historyMessageForRun(terminal),
    };
    if (mountedRef.current) {
      setHistory((prev) => [newEntry, ...prev.slice(0, 19)]);
      setActiveRun(null);
    }
    void refreshDiagnostics();
  }, [lang, onToolStatus, refreshDiagnostics]);

  // Observes one backend run to a terminal state. Local observation stops
  // record NOTHING: the run stays remembered so a remount reconciles it.
  const observeRun = useCallback(async (runId: string, toolId: string, toolName: string, aborter: AbortController) => {
    try {
      const terminal = await pollUntilTerminal(runId, {
        signal: aborter.signal,
        onTick: (run) => {
          if (mountedRef.current) {
            setActiveRun((prev) => (prev && prev.runId === runId ? { ...prev, lineCount: run.lines?.length ?? 0 } : prev));
          }
        },
      });
      if (!mountedRef.current || settledRef.current) return;
      settledRef.current = true;
      settleTerminalRun(toolId, toolName, terminal);
    } catch (err: unknown) {
      if (settledRef.current || !mountedRef.current) return;
      const code = (err as Error & { code?: string })?.code;
      // POLL_CANCELLED means local observation stopped (unmount). The backend
      // run may still be executing and stays remembered — never mark CANCELLED.
      if (code === 'POLL_CANCELLED') return;
      onToolStatus(toolId, 'error');
      setError(err instanceof Error ? err.message : String(err));
      setActiveRun(null);
    }
  }, [settleTerminalRun, onToolStatus]);

  // Remount rediscovery: a remembered run is re-observed to its real
  // terminal state instead of being orphaned.
  useEffect(() => {
    const orphan = recallRun(STATION_KEY);
    if (orphan && !reconcileInflightRef.current) {
      reconcileInflightRef.current = true;
      settledRef.current = false;
      const aborter = new AbortController();
      pollAbortRef.current = aborter;
      setActiveRun({ runId: orphan.runId, toolId: orphan.toolId, phase: 'running', lineCount: 0 });
      void observeRun(orphan.runId, orphan.toolId, orphan.toolName || orphan.toolId, aborter)
        .finally(() => { reconcileInflightRef.current = false; });
    }
  }, [observeRun]);

  const executeTool = useCallback(
    async (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
      if (activeRun) {
        setError(lang === 'ar'
          ? 'أداة أخرى قيد التنفيذ حالياً. انتظر انتهاءها أو ألغها أولاً.'
          : 'Another tool is currently running. Wait for it to finish or cancel it first.');
        return;
      }
      settledRef.current = false;
      const toolName = pickName(tool, lang);
      onToolStatus(tool.ToolId, 'running');
      try {
        const runId = await startExecution({
          tool,
          mode,
          options,
          confirmation,
        });
        rememberRun({ runId, toolId: tool.ToolId, toolName, stationKey: STATION_KEY, startedAt: Date.now() });
        if (!mountedRef.current) return;
        const aborter = new AbortController();
        pollAbortRef.current?.abort();
        pollAbortRef.current = aborter;
        setActiveRun({ runId, toolId: tool.ToolId, phase: 'running', lineCount: 0 });
        await observeRun(runId, tool.ToolId, toolName, aborter);
      } catch (err) {
        // startExecution itself failed: no backend run exists.
        if (!mountedRef.current) return;
        onToolStatus(tool.ToolId, 'error');
        setError(err instanceof Error ? err.message : String(err));
        setActiveRun(null);
      }
    },
    [activeRun, observeRun, lang, onToolStatus]
  );

  // Cancel honesty: CANCELLED is recorded only after the backend confirms a
  // terminal state. If confirmation fails, monitoring continues.
  const handleCancelRun = useCallback(async () => {
    const current = activeRun;
    if (!current || current.phase === 'cancelling') return;
    const remembered = recallRun(STATION_KEY);
    const toolName = (remembered && remembered.runId === current.runId && remembered.toolName) || current.toolId;
    setActiveRun({ ...current, phase: 'cancelling' });
    try {
      const terminal = await requestConfirmedCancel(current.runId, {
        onTick: (run) => {
          if (mountedRef.current) {
            setActiveRun((prev) => (prev && prev.runId === current.runId ? { ...prev, lineCount: run.lines?.length ?? 0 } : prev));
          }
        },
      });
      settledRef.current = true;
      pollAbortRef.current?.abort();
      if (!mountedRef.current) {
        forgetRun(STATION_KEY);
        return;
      }
      settleTerminalRun(current.toolId, toolName, terminal);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const code = (err as Error & { code?: string })?.code;
      if (code === 'POLL_CANCELLED') return;
      // CANCEL_FAILED (or any reconcile failure): the backend did NOT confirm
      // cancellation, so monitoring continues via the original observer.
      const msg = err instanceof Error ? err.message : String(err);
      setActiveRun({ ...current, phase: 'running' });
      onToolStatus(current.toolId, 'running');
      setError(msg);
    }
  }, [activeRun, settleTerminalRun, onToolStatus]);

  const launchAction = useCallback(
    (toolId: string, defaultMode: ExecutionMode = 'run') => {
      if (activeRun) {
        setError(lang === 'ar'
          ? 'أداة أخرى قيد التنفيذ حالياً. انتظر انتهاءها أو ألغها أولاً.'
          : 'Another tool is currently running. Wait for it to finish or cancel it first.');
        return;
      }
      const tool = stTools.find((t) => t.ToolId === toolId);
      if (!tool) return;
      const mode = tool.AnalyzeOnlySupported ? 'analyze' : defaultMode;
      setPendingTool({ tool, mode });
    },
    [stTools, activeRun, lang]
  );

  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason={lang === 'ar' ? 'الجسر المحلي غير متصل' : 'Local execution bridge is offline'}
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <div className="diagnostic-evidence-station flex flex-col w-full min-h-[680px] p-4 lg:p-6 text-slate-100 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800/60 shadow-2xl">
      {/* Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Activity size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                {text.eyebrow}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">{text.title}</h1>
            <p className="text-xs text-slate-400 max-w-xl">{text.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                summary.condition === 'HEALTHY'
                  ? 'bg-emerald-400'
                  : summary.condition === 'ATTENTION_RECOMMENDED'
                  ? 'bg-amber-400'
                  : summary.condition === 'CRITICAL_FINDINGS'
                  ? 'bg-rose-500'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-200">
              {summary.condition === 'HEALTHY'
                ? text.healthyDesc
                : summary.condition === 'ATTENTION_RECOMMENDED'
                ? text.attentionDesc
                : summary.condition === 'CRITICAL_FINDINGS'
                ? text.criticalDesc
                : text.unknownDesc}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void refreshDiagnostics()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition shadow-lg shadow-indigo-900/30"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? text.refreshing : text.refresh}
          </button>
        </div>
      </header>

      {activeRun && (
        <div className="mt-4">
          <StationActiveRunBanner
            lang={lang}
            toolId={activeRun.toolId}
            lineCount={activeRun.lineCount}
            phase={activeRun.phase}
            onCancel={() => void handleCancelRun()}
          />
        </div>
      )}

      {/* Mini-Nav Tabs */}
      <nav className="flex items-center gap-1.5 mt-4 pb-2 overflow-x-auto border-b border-slate-800/60 no-scrollbar">
        {[
          { key: 'overview', label: text.tabOverview, icon: Activity },
          { key: 'events', label: text.tabEvents, icon: FileWarning },
          { key: 'devices', label: text.tabDevices, icon: Wrench },
          { key: 'hardware', label: text.tabHardware, icon: Cpu },
          { key: 'storage', label: text.tabStorage, icon: HardDrive },
          { key: 'actions', label: text.tabActions, icon: Play },
          { key: 'report', label: text.tabReport, icon: FileText },
          { key: 'history', label: text.tabHistory, icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as TabKey)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              activeTab === key
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="flex items-center gap-2 p-3 mt-4 text-xs font-medium rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Hero Visual */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80">
              <DiagnosticsHeroVisual
                condition={summary.condition}
                errorCount={summary.errorOrCriticalEvents}
                problemDevices={summary.problemDevices}
                smartFailures={summary.smartPredictedFailures}
              />
              <div className="mt-4 text-center">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  {text.conditionLabel}
                </span>
                <p className="text-base font-bold text-indigo-300">
                  {summary.condition === 'HEALTHY'
                    ? text.healthyDesc
                    : summary.condition === 'ATTENTION_RECOMMENDED'
                    ? text.attentionDesc
                    : text.criticalDesc}
                </p>
                <small className="text-[11px] text-slate-400 block mt-1">
                  {preview?.System?.Os || 'Windows'} · Build {preview?.System?.Build || '—'}
                </small>
              </div>
            </div>

            {/* Right Telemetry & Signals */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.eventErrors}</span>
                    <FileWarning size={16} className={summary.criticalEvents > 0 ? 'text-rose-400' : 'text-slate-400'} />
                  </div>
                  <strong className="text-lg font-bold text-white block">
                    {summary.errorOrCriticalEvents.toLocaleString(lang)}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {summary.criticalEvents > 0
                      ? `${summary.criticalEvents} ${lang === 'ar' ? 'حرجة' : 'critical'}`
                      : (lang === 'ar' ? 'لا توجد أخطاء حرجة' : 'No critical level events')}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.problemDevices}</span>
                    <Wrench size={16} className={summary.problemDevices > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                  </div>
                  <strong className="text-lg font-bold text-white block">
                    {summary.problemDevices.toLocaleString(lang)}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {summary.problemDevices > 0
                      ? (lang === 'ar' ? 'تحتاج فحص التعريف' : 'Needs driver check')
                      : (lang === 'ar' ? 'كل الأجهزة سليمة' : 'All devices operational')}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.smartFailures}</span>
                    <HardDrive size={16} className={summary.smartPredictedFailures > 0 ? 'text-rose-400' : 'text-emerald-400'} />
                  </div>
                  <strong className="text-lg font-bold text-white block">
                    {summary.smartPredictedFailures.toLocaleString(lang)}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {summary.disksMonitored} {lang === 'ar' ? 'أقراص مراقبة' : 'monitored disks'}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 mr-2">
                  {lang === 'ar' ? 'إجراءات تشخيص سريعة:' : 'Quick Diagnostics:'}
                </span>
                <button
                  type="button"
                  onClick={() => launchAction('DR10')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white transition"
                >
                  <FileText size={13} />
                  {text.quickFullReport}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('DR02')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                >
                  <Cpu size={13} />
                  {text.quickHardware}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('DR03')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                >
                  <FileWarning size={13} />
                  {text.quickEvents}
                </button>
              </div>

              {/* Signals and Observations */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-400" />
                  {text.signalsTitle}
                </h3>
                {signals.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {signals.map((sig) => (
                      <div
                        key={sig.code}
                        className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
                          sig.level === 'CRITICAL'
                            ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                            : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold">
                              {lang === 'ar' ? sig.messageAr : sig.messageEn}
                            </p>
                            <small className="text-[10px] text-slate-400">
                              {sig.evidenceSource}
                            </small>
                          </div>
                        </div>
                        {sig.suggestedTool && (
                          <button
                            type="button"
                            onClick={() => launchAction(sig.suggestedTool)}
                            className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                          >
                            {lang === 'ar' ? 'مراجعة الإجراء' : 'Review action'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : summary.condition === 'INCONCLUSIVE' ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-300 text-xs">
                    <AlertTriangle size={16} className="text-slate-400" />
                    <span>{lang === 'ar' ? 'لم يتم تشغيل الفحص التشخيصي بعد.' : 'Diagnostic evidence has not been collected yet.'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{text.noSignals}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{text.eventsTitle}</h3>
                <p className="text-xs text-slate-400">{text.eventsSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => launchAction('DR03')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <RefreshCw size={13} />
                <span>{lang === 'ar' ? 'فحص الأحداث' : 'Audit Events'}</span>
              </button>
            </div>

            {eventLogs.length > 0 ? (
              <div className="flex flex-col gap-2">
                {eventLogs.slice(0, 15).map((ev, idx) => (
                  <div
                    key={`${ev.source}-${ev.eventId}-${idx}`}
                    className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ev.isCritical
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {ev.entryType}
                        </span>
                        <strong className="text-white">{ev.source}</strong>
                        <span className="font-mono text-[11px] text-slate-400">ID: {ev.eventId}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{ev.timeGenerated}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] line-clamp-2">{ev.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800/60 text-slate-400 text-xs">
                {text.noEventsRecorded}
              </div>
            )}
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{text.devicesTitle}</h3>
                <p className="text-xs text-slate-400">{text.devicesSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => launchAction('DR05')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Wrench size={13} />
                <span>{lang === 'ar' ? 'تقرير التعريفات' : 'Driver Report'}</span>
              </button>
            </div>

            {problemDevices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {problemDevices.map((dev) => (
                  <div
                    key={dev.deviceId}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white text-sm">{dev.name}</strong>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          dev.isCritical ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'
                        }`}
                      >
                        Error {dev.errorCode}
                      </span>
                    </div>
                    <p className="text-slate-300 mb-2">{dev.errorDescription}</p>
                    <span className="font-mono text-[10px] text-slate-400 block truncate">
                      {dev.deviceId}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800/60 text-slate-400 text-xs">
                {text.noProblemDevices}
              </div>
            )}
          </div>
        )}

        {activeTab === 'hardware' && (
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">{text.hardwareTitle}</h3>
              <p className="text-xs text-slate-400 mb-4">{text.hardwareSubtitle}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Processor</span>
                  <strong className="text-sm font-bold text-white">{preview?.System?.Cpu || '—'}</strong>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Physical Memory</span>
                  <strong className="text-sm font-bold text-white">
                    {preview?.System?.MemoryTotalGB ? `${preview.System.MemoryTotalGB} GB Total` : '—'}
                  </strong>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Operating System</span>
                  <strong className="text-sm font-bold text-white">
                    {preview?.System?.Os} ({preview?.System?.Build})
                  </strong>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Computer Name</span>
                  <strong className="text-sm font-bold text-white">{preview?.System?.Machine || '—'}</strong>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => launchAction('DR02')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {text.quickHardware}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('DR07')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {lang === 'ar' ? 'فحص الذاكرة' : 'Memory Diagnostics'}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('DR06')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {lang === 'ar' ? 'أداء الإقلاع' : 'Boot Performance'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">{text.storageTitle}</h3>
              <p className="text-xs text-slate-400 mb-4">{text.storageSubtitle}</p>

              <div className="flex flex-col gap-2 mb-4">
                {disksSmart.length > 0 ? (
                  disksSmart.map((disk) => (
                    <div
                      key={`${disk.index}-${disk.model}`}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <HardDrive
                          size={18}
                          className={disk.status === 'PREDICTED_FAILURE' ? 'text-rose-400' : 'text-indigo-400'}
                        />
                        <div>
                          <strong className="text-xs font-bold text-white block">{disk.model}</strong>
                          <span className="text-[11px] text-slate-400">
                            Drive {disk.index} · {disk.sizeGB} GB
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded ${
                          disk.status === 'HEALTHY'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                            : disk.status === 'PREDICTED_FAILURE'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {disk.status === 'HEALTHY'
                          ? (lang === 'ar' ? 'سليم (SMART OK)' : 'SMART OK')
                          : disk.status === 'PREDICTED_FAILURE'
                          ? (lang === 'ar' ? 'فشل متوقع!' : 'FAILURE PREDICTED')
                          : (lang === 'ar' ? 'غير متاح' : 'UNAVAILABLE')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? 'لا توجد بيانات SMART متاحة حالياً للأقراص.' : 'No SMART disk telemetry available currently.'}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => launchAction('DR08')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {lang === 'ar' ? 'تقرير تفصيلي لسلامة الأقراص' : 'Disk SMART Report'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="diagnostic-tool-grid grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl">
            {stTools.map((t) => {
              const status = toolStatuses[t.ToolId];
              const isRunning = status === 'running';
              const needsAdmin = t.RequiresAdmin && !bridgeElevated;

              return (
                <article
                  key={t.ToolId}
                  className="diagnostic-tool-card flex flex-col justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {t.RiskLevel}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white">{pickName(t, lang)}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">{t.Purpose}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400">
                      {t.AnalyzeOnlySupported ? 'Analyze supported' : 'Read-only telemetry'}
                    </span>
                    <button
                      type="button"
                      disabled={isRunning || needsAdmin}
                      onClick={() => launchAction(t.ToolId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition"
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>...</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          <span>{lang === 'ar' ? 'تشغيل' : 'Run'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {activeTab === 'report' && (
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'سجل الأدلة والتقارير الشاملة' : 'Comprehensive Evidence & Diagnostics'}
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' ? 'توليد تقرير تشخيصي شامل للنظام.' : 'Generate a comprehensive diagnostic report.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => launchAction('DR10')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {lang === 'ar' ? 'توليد تقرير كامل' : 'Generate Full Report'}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('DR11')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {lang === 'ar' ? 'معاينة تفاعلية' : 'Interactive Preview'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">{lang === 'ar' ? 'مؤشر الفحص' : 'Diagnostic Dimension'}</th>
                    <th className="pb-2">{lang === 'ar' ? 'القيمة المرصودة' : 'Observed Value'}</th>
                    <th className="pb-2 text-right">{lang === 'ar' ? 'التقييم' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">System Event Log</td>
                    <td className="py-2.5 text-slate-300">{summary.errorOrCriticalEvents} Errors / Critical</td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">
                      {summary.criticalEvents === 0 ? 'PASS' : 'REVIEW'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Device Manager Hardware</td>
                    <td className="py-2.5 text-slate-300">{summary.problemDevices} Problem Devices</td>
                    <td className="py-2.5 text-right font-bold text-indigo-400">
                      {summary.problemDevices === 0 ? 'PASS' : 'WARN'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Physical Storage SMART</td>
                    <td className="py-2.5 text-slate-300">{summary.smartPredictedFailures} Failure Predictions</td>
                    <td className="py-2.5 text-right font-bold text-cyan-400">
                      {summary.smartPredictedFailures === 0 ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-3 max-w-4xl">
            {history.length > 0 ? (
              history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`p-1.5 rounded-lg ${
                        h.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : h.status === 'WARNING'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {h.status === 'SUCCESS' ? (
                        <CheckCircle2 size={16} />
                      ) : h.status === 'WARNING' ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                    </span>
                    <div>
                      <strong className="text-white block">
                        {h.toolId} · {h.toolName}
                      </strong>
                      <span className="text-slate-400 text-[11px]">{h.summary}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] block">{h.timestamp}</span>
                    <span className="text-[10px] text-slate-400">
                      {h.itemsProcessed} {lang === 'ar' ? 'عنصر' : 'items'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 p-6 text-center">
                {text.emptyHistory}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Execution Confirmation Dialog */}
      {pendingTool && (
        <ExecutionConfirmDialog
          tool={pendingTool.tool}
          mode={pendingTool.mode}
          lang={lang}
          initialOptions={pendingTool.options}
          onCancel={() => setPendingTool(null)}
          onConfirm={(opts, conf) => {
            void executeTool(pendingTool.tool, pendingTool.mode, opts, conf);
            setPendingTool(null);
          }}
        />
      )}
    </div>
  );
}
