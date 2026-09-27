import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Activity, Cpu, HardDrive, RefreshCw, Play,
  CheckCircle2, AlertTriangle, X,
  History, FileText, Server, AlertOctagon, Zap
} from 'lucide-react';
import type {
  BridgeRun, BridgeTool, ExecutionMode,
  OperationsPreview,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationInventorySurface, type InventoryColumn } from '../../../components/workspace/StationInventorySurface';
import { StationErrorBoundary, StationOfflineState, StationActiveRunBanner } from '../_shared';
import { startExecution, pollUntilTerminal, requestConfirmedCancel, rememberRun, recallRun, forgetRun, historyMessageForRun } from '../_shared/StationExecutionController';
import type { FamilyId, ServiceId } from '../../../data/family-map';
import {
  type ObservatorySummary, type ObservatorySignal, type StationHistoryEntry,
  summarizeObservatory, detectObservatorySignals, stationTools,
  outcomeFromRun
} from './monitoringModel';
import MonitoringHeroVisual from './MonitoringHeroVisual';
import type { OperationsPreviewProcess, OperationsPreviewService } from '../../../lib/api';

export interface MonitoringStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
  /**
   * Process and service ownership belongs to Station 07. The observatory reads
   * its own live sample for observation, and hands investigation over rather
   * than duplicating a second process engine.
   */
  onNavigateService?: (family: FamilyId, serviceId: ServiceId) => void;
}

type TabKey = 'overview' | 'processes' | 'memory' | 'services' | 'unresponsive' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'REAL-TIME OBSERVATORY & PROCESS TELEMETRY',
    title: 'System Monitoring Observatory',
    subtitle: 'Inspect live Windows processes, memory working sets, unresponsive task states, and Windows services.',
    tabOverview: 'Overview',
    tabProcesses: 'Active Processes',
    tabMemory: 'Memory Watch',
    tabServices: 'Services State',
    tabUnresponsive: 'Unresponsive Tasks',
    tabActions: 'Observatory Tools',
    tabReport: 'Diagnostics Report',
    tabHistory: 'History',
    refresh: 'Query Observatory',
    refreshing: 'Sampling system processes...',
    totalProcesses: 'Active Processes',
    unresponsiveTasks: 'Unresponsive Tasks',
    topMemoryConsumer: 'Top Memory Task',
    runningServices: 'Running Services',
    stoppedAutoServices: 'Stopped Auto Services',
    quickSnapshot: 'Resource Snapshot',
    quickTopProcesses: 'Top Processes',
    quickProcessWatch: 'Process & Memory Watch',
    signalsTitle: 'Observatory Findings & Process Signals',
    noSignals: 'The observed sample returned no unresponsive process and no memory figure above the monitoring threshold. Signals are only drawn from a live sample.',
    processesTitle: 'Active Windows Processes',
    processesSubtitle: 'Real-time telemetry of process IDs, working set memory, and responsiveness status.',
    memoryTitle: 'Process Memory Consumption Hierarchy',
    memorySubtitle: 'Working set allocations sorted descending to isolate heavy background workloads.',
    servicesTitle: 'Windows Services Operational Telemetry',
    servicesSubtitle: 'Overview of Windows services state with special focus on Automatic stopped services.',
    unresponsiveTitle: 'Unresponsive Processes (Hanging)',
    unresponsiveSubtitle: 'Processes that are currently not responding to Windows message queues.',
    noUnresponsive: 'Zero processes currently flagged as unresponsive.',
    actionsTitle: 'Station 15 Tool Catalog',
    emptyHistory: 'No monitoring operations executed yet in this session.',
    notCheckedYet: 'Not checked yet',
    countNotReported: 'Count not reported',
    activeTasks: 'Active tasks running',
    notResponding: 'Not responding to OS',
    allResponding: 'All sampled processes responding',
    workingSetMb: (mb: number) => `${mb} MB working set`,
    ofTotalServices: (total: number) => `of ${total} total services`,
    noDescription: 'No description available.',
    userExecution: 'User Execution',
    adminRequired: 'Admin Required',
    searchPlaceholder: 'Search processes by name or PID...',
    runTool: 'Execute Tool',
    processName: 'Process Name',
    pid: 'PID',
    memoryMB: 'Memory MB',
    cpuTime: 'CPU Seconds',
    status: 'Status',
    responding: 'Responding',
    hanging: 'Not Responding',
    serviceName: 'Service Name',
    startMode: 'Start Mode',
    processId: 'Process ID',
    searchProcesses: 'Search processes by name, PID, or state...',
    searchServices: 'Search services by name, display name, state, or start mode...',
    filterResponding: 'Responding',
    filterHanging: 'Not responding',
    notCheckedHint: 'Run a resource snapshot or top-process query to measure this machine.',
    noUnresponsiveMeasured: 'Measured: no sampled process is flagged as unresponsive.',
    unmeasuredUnresponsive: 'Not checked yet — no live sample has been taken, so nothing can be claimed either way.',
    sampleFailed: 'The observatory read failed. This is not the same as zero processes.',
    showing: 'Showing',
    ofTotal: 'of',
    countLabel: 'processes',
    serviceCountLabel: 'services',
    notReported: 'Not reported',
    whatIsThis: 'What is this?',
    whereFrom: 'Where did it come from?',
    whyMatters: 'Why does it matter?',
    evidence: 'Evidence',
    whatCanIDo: 'What can I do?',
    processSource: 'Live process telemetry from the observatory snapshot.',
    serviceSource: 'Live Windows service inventory from the observatory snapshot.',
    processWhy: 'Working set is the memory currently held by this process. A process that is not responding has stopped servicing Windows message queues.',
    serviceWhy: 'A stopped Automatic service will start on demand only if something asks it to, which frequently breaks a dependent application.',
    processAction: 'Open full process and service evidence to review the dependency and ownership view.',
    serviceAction: 'Open full service evidence to review the complete inventory and blast radius.',
    openProcessEvidence: 'Open process and service evidence',
    capturedAt: 'Sample captured at',
    noStopAutoServices: 'No stopped Automatic service in the review set.',
    stopAutoUnmeasured: 'Not checked yet — the service state has not been sampled.',
    noProcessesMeasured: 'The live sample returned no top-memory process rows.',
    noProcessMatch: 'No process matches your search and filters',
    noServiceMatch: 'No service matches your search and filters',
  },
  ar: {
    eyebrow: 'مرصد العمليات والذاكرة الحي',
    title: 'مرصد مراقبة النظام والعمليات',
    subtitle: 'مراقبة حية لعمليات ويندوز النشطة، استهلاك الذاكرة الفعلية، كشف البرامج المتوقفة عن الاستجابة، وحالة الخدمات.',
    tabOverview: 'نظرة عامة',
    tabProcesses: 'العمليات النشطة',
    tabMemory: 'مراقبة الذاكرة',
    tabServices: 'حالة الخدمات',
    tabUnresponsive: 'المهام المعلقة',
    tabActions: 'أدوات المراقبة',
    tabReport: 'تقرير التشخيص',
    tabHistory: 'السجل',
    refresh: 'تحديث المرصد',
    refreshing: 'جارٍ أخذ عينة العمليات...',
    totalProcesses: 'العمليات النشطة',
    unresponsiveTasks: 'العمليات المعلقة',
    topMemoryConsumer: 'أعلى عملية استهلاكاً',
    runningServices: 'الخدمات قيد التشغيل',
    stoppedAutoServices: 'خدمات تلقائية متوقفة',
    quickSnapshot: 'لقطة الموارد',
    quickTopProcesses: 'أعلى العمليات استهلاكاً',
    quickProcessWatch: 'مراقبة العمليات والذاكرة',
    signalsTitle: 'إشارات المرصد وتنبيهات الأداء',
    noSignals: 'العينة المرصودة لم تُرجع أي عملية غير مستجيبة ولا رقماً للذاكرة يتجاوز حد المراقبة. الإشارات تُستمد فقط من عينة حقيقية.',
    processesTitle: 'عمليات ويندوز النشطة',
    processesSubtitle: 'سجل حي لمعرفات العمليات، حجم الذاكرة المستهلكة، وحالة الاستجابة لرسائل النظام.',
    memoryTitle: 'تسلسل استهلاك الذاكرة حسب العمليات',
    memorySubtitle: 'ترتيب العمليات تنازلياً حسب استهلاك الذاكرة لعزل المهام الخلفية الثقيلة.',
    servicesTitle: 'حالة خدمات ويندوز التشغيلية',
    servicesSubtitle: 'نظرة عامة على الخدمات مع تسليط الضوء على الخدمات التلقائية المتوقفة للمراجعة.',
    unresponsiveTitle: 'العمليات المتوقفة عن الاستجابة (معلقة)',
    unresponsiveSubtitle: 'العمليات التي لا تستجيب حالياً لرتل رسائل ويندوز.',
    noUnresponsive: 'لا توجد عمليات معلقة أو متوقفة عن الاستجابة حالياً.',
    actionsTitle: 'فهرس أدوات المحطة 15',
    emptyHistory: 'لم يتم تنفيذ أي أدوات مراقبة خلال هذه الجلسة بعد.',
    notCheckedYet: 'لم يتم الفحص بعد',
    countNotReported: 'لم يتم الإبلاغ عن العدد',
    activeTasks: 'المهام النشطة قيد التشغيل',
    notResponding: 'لا تستجيب لنظام التشغيل',
    allResponding: 'كل العمليات في العينة تستجيب',
    workingSetMb: (mb: number) => `${mb} ميغابايت مجموعة عمل`,
    ofTotalServices: (total: number) => `من ${total} خدمة إجمالاً`,
    noDescription: 'لا يوجد وصف متاح.',
    userExecution: 'تنفيذ المستخدم',
    adminRequired: 'يتطلب صلاحية المسؤول',
    searchPlaceholder: 'بحث باسم العملية أو رقم PID...',
    runTool: 'تنفيذ الأداة',
    processName: 'اسم العملية',
    pid: 'المعرّف',
    memoryMB: 'الذاكرة (م.ب)',
    cpuTime: 'ثواني المعالج',
    status: 'الحالة',
    responding: 'يستجيب',
    hanging: 'لا يستجيب',
    serviceName: 'اسم الخدمة',
    startMode: 'نمط البدء',
    processId: 'معرّف العملية',
    searchProcesses: 'ابحث في العمليات بالاسم أو المعرّف أو الحالة...',
    searchServices: 'ابحث في الخدمات بالاسم أو الحالة أو نمط البدء...',
    filterResponding: 'يستجيب',
    filterHanging: 'لا يستجيب',
    notCheckedHint: 'نفّذ لقطة موارد أو استعلام أعلى العمليات لقياس هذا الجهاز.',
    noUnresponsiveMeasured: 'تم القياس: لا توجد عملية معلَّمة كغير مستجيبة.',
    unmeasuredUnresponsive: 'لم يتم الفحص بعد — لم تُؤخذ أي عينة حيّة، لذا لا يمكن الجزم بأي حالة.',
    sampleFailed: 'فشلت قراءة المرصد. هذا ليس معناه صفر عمليات.',
    showing: 'المعروض',
    ofTotal: 'من',
    countLabel: 'عمليات',
    serviceCountLabel: 'خدمات',
    notReported: 'غير مُبلَّغ عنه',
    whatIsThis: 'ما هذا؟',
    whereFrom: 'من أين جاء؟',
    whyMatters: 'لماذا يهم؟',
    evidence: 'الأدلة',
    whatCanIDo: 'ماذا يمكنني أن أفعل؟',
    processSource: 'قياسات حيّة للعمليات من لقطة المرصد.',
    serviceSource: 'جرد حيّ لخدمات ويندوز من لقطة المرصد.',
    processWhy: 'مجموعة العمل هي الذاكرة التي تحتجزها العملية حالياً. العملية غير المستجيبة توقفت عن خدمة قوائم رسائل ويندوز.',
    serviceWhy: 'خدمة تلقائية متوقفة لن تعمل إلا عند الطلب، وهذا غالباً يعطّل تطبيقاً يعتمد عليها.',
    processAction: 'افتح أدلة العمليات والخدمات الكاملة لمراجعة التبعيات.',
    serviceAction: 'افتح أدلة الخدمات الكاملة لمراجعة الجرد ونطاق التأثير.',
    openProcessEvidence: 'افتح أدلة العمليات والخدمات',
    capturedAt: 'وقت أخذ العينة',
    noStopAutoServices: 'لا توجد خدمة تلقائية متوقفة ضمن قائمة المراجعة.',
    stopAutoUnmeasured: 'لم يتم الفحص بعد — لم تُقاس حالة الخدمات.',
    noProcessesMeasured: 'أعادت العينة الحيّة بلا صفوف أعلى العمليات.',
    noProcessMatch: 'لا توجد عملية مطابقة لبحثك ومرشّحاتك',
    noServiceMatch: 'لا توجد خدمة مطابقة لبحثك ومرشّحاتك',
  },
};

const STATION_KEY = 'station15';

const INSPECTOR_ACTION_STYLE: CSSProperties = {
  background: 'rgba(56, 189, 248, 0.1)',
  border: '1px solid rgba(56, 189, 248, 0.5)',
  color: '#7dd3fc',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'start',
};

/**
 * One label/answer pair. The inspector exists for depth, so an unreported
 * value prints "not reported" instead of an empty cell or a fabricated zero.
 */
function InspectorFact({
  label,
  value,
  mono = false,
  ltr = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ltr?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b' }}>{label}</span>
      <span
        dir={ltr ? 'ltr' : 'auto'}
        style={{
          fontSize: 12,
          color: '#e2e8f0',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function MonitoringStation(props: MonitoringStationProps) {
  return (
    <StationErrorBoundary lang={props.lang}>
      <MonitoringStationContent {...props} />
    </StationErrorBoundary>
  );
}

function MonitoringStationContent({
  lang,
  tools,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
  onNavigateService,
}: MonitoringStationProps) {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<OperationsPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);
  // Active run tracking: selection and execution are separate concepts.
  // CANCELLED is recorded only after the backend confirms a terminal state;
  // aborting local observation never fabricates cancellation.
  const [activeRun, setActiveRun] = useState<{ runId: string; toolId: string; phase: 'running' | 'cancelling'; lineCount: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
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

  const availableStationTools = useMemo(() => stationTools(tools), [tools]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setPreviewError(null);
    try {
      const res = await api.operationsPreview();
      if (res?.preview) {
        setPreview(res.preview);
      } else {
        // The read completed but carried no snapshot. That is a failure to
        // measure, not a measurement of zero.
        setPreviewError(
          lang === 'ar'
            ? 'أعادت غرفة المراقبة رداً دون أي بيانات قياس.'
            : 'The observatory returned a response with no measured snapshot.'
        );
      }
    } catch (error) {
      setPreviewError(
        error instanceof Error && error.message
          ? error.message
          : (lang === 'ar'
              ? 'تعذّر الوصول إلى بيانات المرصد.'
              : 'The observatory data could not be read.')
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    if (bridgeOnline) {
      void loadPreview();
    }
  }, [bridgeOnline, loadPreview]);

  const summary = useMemo<ObservatorySummary>(() => {
    return summarizeObservatory(preview);
  }, [preview]);

  const signals = useMemo<ObservatorySignal[]>(() => {
    return detectObservatorySignals(preview);
  }, [preview]);

  // A monitoring figure may only be printed once a live sample was actually read.
  const sampleMeasured = summary.condition !== 'INCONCLUSIVE';

  // rows === null means "never sampled". [] means "sampled and genuinely empty".
  // Collapsing the two is how a monitoring station claims an all-clear it never earned.
  const processRows = useMemo<OperationsPreviewProcess[] | null>(
    () => (preview ? preview.Processes.TopMemory : null),
    [preview]
  );

  const serviceRows = useMemo<OperationsPreviewService[] | null>(
    () => (preview ? preview.Services.AutomaticStoppedForReview : null),
    [preview]
  );

  // null means "never sampled", not "zero services". Collapsing the two here
  // would make every consumer of this summary able to print a measured zero
  // for a machine nothing has been read from.
  const servicesSummary = useMemo(
    (): { running: number | null; stopped: number | null; total: number | null } => {
      if (!preview?.Services) return { running: null, stopped: null, total: null };
      return {
        running: preview.Services.Running ?? 0,
        stopped: preview.Services.Stopped ?? 0,
        total: preview.Services.Total ?? 0,
      };
    },
    [preview]
  );

  const stoppedAutoCount = serviceRows?.length ?? 0;

  const isSampling = loading;

  const unresponsiveProcesses = useMemo(() => {
    return preview?.Processes?.NotRespondingForReview || [];
  }, [preview]);

  const processColumns = useMemo<InventoryColumn<OperationsPreviewProcess>[]>(
    () => [
      {
        key: 'name',
        label: { en: t.processName, ar: t.processName },
        width: 'minmax(0, 2fr)',
        sortValue: proc => proc.Name,
        render: proc => (
          <span style={{ fontWeight: 600, color: '#f8fafc', direction: 'ltr', display: 'inline-block' }} dir="ltr">
            {proc.Name}
          </span>
        ),
      },
      {
        key: 'pid',
        label: { en: t.pid, ar: t.pid },
        width: 'minmax(0, 0.7fr)',
        sortValue: proc => proc.ProcessId,
        render: proc => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{proc.ProcessId}</span>,
      },
      {
        key: 'memory',
        label: { en: t.memoryMB, ar: t.memoryMB },
        width: 'minmax(0, 0.9fr)',
        align: 'end',
        sortValue: proc => (Number.isFinite(proc.MemoryMB) ? proc.MemoryMB : null),
        render: proc => (
          <span style={{ color: '#38bdf8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {Number.isFinite(proc.MemoryMB) ? `${proc.MemoryMB}` : '—'}
          </span>
        ),
      },
      {
        key: 'cpu',
        label: { en: t.cpuTime, ar: t.cpuTime },
        width: 'minmax(0, 0.8fr)',
        align: 'end',
        sortValue: proc => (Number.isFinite(proc.CpuSeconds) && proc.CpuSeconds > 0 ? proc.CpuSeconds : null),
        render: proc => (
          <span style={{ color: '#94a3b8' }}>{proc.CpuSeconds > 0 ? proc.CpuSeconds : '—'}</span>
        ),
      },
      {
        key: 'state',
        label: { en: t.status, ar: t.status },
        width: 'minmax(0, 1fr)',
        render: proc => (
          <span style={{ color: proc.Responding === false ? '#ef4444' : proc.Responding === true ? '#10b981' : '#64748b', fontWeight: 600 }}>
            {proc.Responding === false ? t.hanging : proc.Responding === true ? t.responding : t.notReported}
          </span>
        ),
      },
    ],
    [t]
  );

  const processFilters = useMemo(
    () => [
      { key: 'responding', label: { en: t.filterResponding, ar: t.filterResponding }, test: (proc: OperationsPreviewProcess) => proc.Responding === true },
      { key: 'hanging', label: { en: t.filterHanging, ar: t.filterHanging }, test: (proc: OperationsPreviewProcess) => proc.Responding === false },
    ],
    [t]
  );

  const serviceColumns = useMemo<InventoryColumn<OperationsPreviewService>[]>(
    () => [
      {
        key: 'name',
        label: { en: t.serviceName, ar: t.serviceName },
        width: 'minmax(0, 2fr)',
        sortValue: svc => svc.DisplayName || svc.Name,
        render: svc => (
          <span style={{ fontWeight: 600, color: '#f8fafc' }} dir="auto">{svc.DisplayName || svc.Name}</span>
        ),
      },
      {
        key: 'status',
        label: { en: t.status, ar: t.status },
        width: 'minmax(0, 1fr)',
        sortValue: svc => svc.Status,
        render: svc => <span dir="auto">{svc.Status || t.notReported}</span>,
      },
      {
        key: 'startMode',
        label: { en: t.startMode, ar: t.startMode },
        width: 'minmax(0, 1fr)',
        sortValue: svc => svc.StartMode,
        render: svc => (
          <span style={{ color: '#f59e0b' }} dir="auto">{svc.StartMode || t.notReported}</span>
        ),
      },
      {
        key: 'pid',
        label: { en: t.processId, ar: t.processId },
        width: 'minmax(0, 0.7fr)',
        align: 'end',
        sortValue: svc => (Number.isFinite(svc.ProcessId) ? svc.ProcessId : null),
        render: svc => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number.isFinite(svc.ProcessId) ? svc.ProcessId : '—'}</span>
        ),
      },
    ],
    [t]
  );

  const serviceFilters = useMemo(
    () => [
      { key: 'stopped', label: { en: 'Stopped', ar: 'متوقفة' }, test: (svc: OperationsPreviewService) => String(svc.Status).toLowerCase().includes('stop') },
      { key: 'automatic', label: { en: 'Automatic', ar: 'تلقائية' }, test: (svc: OperationsPreviewService) => String(svc.StartMode).toLowerCase().includes('auto') },
    ],
    []
  );

  const renderProcessInspector = useCallback(
    (proc: OperationsPreviewProcess, close: () => void) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 13, color: '#f8fafc' }} dir="ltr">{proc.Name}</strong>
          <button type="button" onClick={close} aria-label="close" style={{ background: 'transparent', border: 0, color: '#64748b', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        <InspectorFact label={t.whatIsThis} value={proc.Name} mono ltr />
        <InspectorFact label={t.whereFrom} value={t.processSource} />
        <InspectorFact label={t.pid} value={String(proc.ProcessId)} />
        <InspectorFact label={t.memoryMB} value={Number.isFinite(proc.MemoryMB) ? t.workingSetMb(proc.MemoryMB) : t.notReported} />
        <InspectorFact label={t.cpuTime} value={proc.CpuSeconds > 0 ? String(proc.CpuSeconds) : t.notReported} />
        <InspectorFact
          label={t.status}
          value={proc.Responding === false ? t.hanging : proc.Responding === true ? t.responding : t.notReported}
        />
        <InspectorFact label={t.whyMatters} value={t.processWhy} />
        {preview?.CapturedAt && <InspectorFact label={t.capturedAt} value={preview.CapturedAt} ltr />}
        {onNavigateService && (
          <button type="button" onClick={() => { close(); onNavigateService('investigation', '07-Services-Processes'); }} style={INSPECTOR_ACTION_STYLE}>
            {t.openProcessEvidence}
          </button>
        )}
      </div>
    ),
    [onNavigateService, preview?.CapturedAt, t]
  );

  const renderServiceInspector = useCallback(
    (svc: OperationsPreviewService, close: () => void) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 13, color: '#f8fafc' }} dir="auto">{svc.DisplayName || svc.Name}</strong>
          <button type="button" onClick={close} aria-label="close" style={{ background: 'transparent', border: 0, color: '#64748b', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        <InspectorFact label={t.whatIsThis} value={svc.DisplayName || svc.Name} />
        <InspectorFact label={t.whereFrom} value={t.serviceSource} />
        <InspectorFact label={t.serviceName} value={svc.Name} mono ltr />
        <InspectorFact label={t.status} value={svc.Status || t.notReported} />
        <InspectorFact label={t.startMode} value={svc.StartMode || t.notReported} />
        <InspectorFact label={t.processId} value={Number.isFinite(svc.ProcessId) ? String(svc.ProcessId) : t.notReported} />
        <InspectorFact label={t.whyMatters} value={t.serviceWhy} />
        {preview?.CapturedAt && <InspectorFact label={t.capturedAt} value={preview.CapturedAt} ltr />}
        {onNavigateService && (
          <button type="button" onClick={() => { close(); onNavigateService('investigation', '07-Services-Processes'); }} style={INSPECTOR_ACTION_STYLE}>
            {t.openProcessEvidence}
          </button>
        )}
      </div>
    ),
    [onNavigateService, preview?.CapturedAt, t]
  );

  const handleLaunchTool = (tool: BridgeTool, mode: ExecutionMode = 'analyze') => {
    if (activeRun) {
      setRunError(lang === 'ar'
        ? 'أداة أخرى قيد التنفيذ حالياً. انتظر انتهاءها أو ألغها أولاً.'
        : 'Another tool is currently running. Wait for it to finish or cancel it first.');
      return;
    }
    setPendingTool({ tool, mode });
  };

  // Records ONLY backend-terminal outcomes. A backend-confirmed cancelled
  // run stays CANCELLED; anything else follows the result evidence.
  const settleTerminalRun = useCallback((toolId: string, toolName: string, terminal: BridgeRun) => {
    forgetRun(STATION_KEY);
    const outcome = terminal.status === 'cancelled' ? 'CANCELLED' as const : outcomeFromRun(terminal.result);
    onToolStatus(
      toolId,
      outcome === 'SUCCESS' ? 'success' : outcome === 'WARNING' ? 'inconclusive' : outcome === 'FAILED' ? 'error' : outcome === 'CANCELLED' ? 'cancelled' : 'inconclusive'
    );
    const newEntry: StationHistoryEntry = {
      id: `${toolId}-${Date.now()}`,
      toolId,
      toolName,
      timestamp: new Date().toLocaleTimeString(),
      status: outcome,
      itemsProcessed: terminal.result?.itemsProcessed || 0,
      summary: terminal.result?.output?.slice(0, 180) || historyMessageForRun(terminal),
    };
    if (mountedRef.current) {
      setHistory((prev) => [newEntry, ...prev]);
      setActiveRun(null);
    }
    void loadPreview();
  }, [onToolStatus, lang, loadPreview]);

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
      if (code === 'POLL_CANCELLED') return;
      const msg = err instanceof Error ? err.message : String(err);
      onToolStatus(toolId, 'error');
      setRunError(msg);
      setActiveRun(null);
    }
  }, [settleTerminalRun, onToolStatus, lang]);

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

  const handleConfirmRun = async (options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
    if (!pendingTool) return;
    if (activeRun) {
      setRunError(lang === 'ar'
        ? 'أداة أخرى قيد التنفيذ حالياً. انتظر انتهاءها أو ألغها أولاً.'
        : 'Another tool is currently running. Wait for it to finish or cancel it first.');
      return;
    }
    const { tool, mode } = pendingTool;
    setPendingTool(null);
    setRunError(null);
    settledRef.current = false;
    const toolName = pickName(tool, lang);
    try {
      onToolStatus(tool.ToolId, 'running');
      const runId = await startExecution({ tool, mode, options, confirmation });
      rememberRun({ runId, toolId: tool.ToolId, toolName, stationKey: STATION_KEY, startedAt: Date.now() });
      if (!mountedRef.current) return;
      const aborter = new AbortController();
      pollAbortRef.current?.abort();
      pollAbortRef.current = aborter;
      setActiveRun({ runId, toolId: tool.ToolId, phase: 'running', lineCount: 0 });
      await observeRun(runId, tool.ToolId, toolName, aborter);
    } catch {
      // startExecution itself failed: no backend run exists.
      if (!mountedRef.current) return;
      onToolStatus(tool.ToolId, 'error');
      setRunError(lang === 'ar' ? 'تعذر بدء التنفيذ.' : 'Execution could not be started.');
      setActiveRun(null);
    }
  };

  // Cancel honesty: CANCELLED is recorded only after the backend confirms a
  // terminal state. If confirmation fails, monitoring continues.
  const handleCancelRun = async () => {
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
      setRunError(msg);
    }
  };

  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason="BRIDGE_DISCONNECTED"
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <div className="monitoring-observatory-station" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            <Activity size={14} />
            <span>{t.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 6px 0', color: '#f8fafc' }}>
            {t.title}
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, maxWidth: 680, lineHeight: 1.5 }}>
            {t.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            backgroundColor: '#0284c7',
            border: '1px solid #38bdf8',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? t.refreshing : t.refresh}</span>
        </button>
      </div>

      {/* A failed read is a state of its own. Swallowing it made an unreadable
          observatory permanently indistinguishable from an unmeasured one. */}
      {previewError && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 10, color: '#fcd34d', fontSize: 12 }} role="alert">
          <AlertTriangle size={15} />
          <span>{previewError}</span>
          <button type="button" onClick={() => void loadPreview()} style={{ marginInlineStart: 'auto', background: 'transparent', border: 0, color: '#fcd34d', textDecoration: 'underline', cursor: 'pointer', fontSize: 11.5 }}>
            {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {runError && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.35)', borderRadius: 10, color: '#fda4af', fontSize: 12 }} role="alert">
          <span>{runError}</span>
        </div>
      )}

      {activeRun && (
        <StationActiveRunBanner
          lang={lang}
          toolId={activeRun.toolId}
          lineCount={activeRun.lineCount}
          accent="sky"
          phase={activeRun.phase}
          onCancel={() => void handleCancelRun()}
        />
      )}

      {/* Hero Visual Block */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.12), transparent 70%), rgba(15, 23, 42, 0.65)',
          borderRadius: 14,
          padding: 16,
          border: '1px solid rgba(56, 189, 248, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <MonitoringHeroVisual
          condition={summary.condition}
          totalProcesses={summary.totalProcesses}
          unresponsiveCount={summary.unresponsiveCount}
          topMemoryProcessName={summary.topMemoryProcessName}
          topMemoryMB={summary.topMemoryMB}
          lang={lang}
        />
      </div>

      {/* Metric Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.totalProcesses}</div>
          <div style={{ fontSize: sampleMeasured ? 24 : 13, fontWeight: 800, color: sampleMeasured ? '#38bdf8' : '#94a3b8', marginTop: 4 }}>
            {sampleMeasured ? summary.totalProcesses : t.notCheckedYet}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {sampleMeasured ? t.activeTasks : t.countNotReported}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.unresponsiveTasks}</div>
          <div style={{ fontSize: sampleMeasured ? 24 : 13, fontWeight: 800, color: !sampleMeasured ? '#94a3b8' : summary.unresponsiveCount > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
            {sampleMeasured ? summary.unresponsiveCount : t.notCheckedYet}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {!sampleMeasured
              ? t.countNotReported
              : summary.unresponsiveCount > 0
                ? t.notResponding
                : t.allResponding}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.topMemoryConsumer}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary.topMemoryProcessName || '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {sampleMeasured && summary.topMemoryMB > 0 ? t.workingSetMb(summary.topMemoryMB) : t.countNotReported}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.runningServices}</div>
          <div style={{ fontSize: sampleMeasured ? 24 : 13, fontWeight: 800, color: sampleMeasured ? '#10b981' : '#94a3b8', marginTop: 4 }}>
            {sampleMeasured ? summary.runningServices : t.notCheckedYet}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {sampleMeasured ? t.ofTotalServices(summary.totalServices) : t.countNotReported}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #1e293b', gap: 6, paddingBottom: 4 }}>
        {[
          { key: 'overview', label: t.tabOverview, icon: Activity },
          { key: 'processes', label: t.tabProcesses, icon: Cpu },
          { key: 'memory', label: t.tabMemory, icon: HardDrive },
          { key: 'services', label: t.tabServices, icon: Server },
          { key: 'unresponsive', label: t.tabUnresponsive, icon: AlertOctagon },
          { key: 'actions', label: t.tabActions, icon: Play },
          { key: 'report', label: t.tabReport, icon: FileText },
          { key: 'history', label: t.tabHistory, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {tools.find((t) => t.ToolId === 'MO01') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'MO01')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#0369a1',
                  border: '1px solid #0284c7',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickSnapshot}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'MO02') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'MO02')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#0f766e',
                  border: '1px solid #14b8a6',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickTopProcesses}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'MO04') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'MO04')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#4338ca',
                  border: '1px solid #6366f1',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Zap size={13} />
                <span>{t.quickProcessWatch}</span>
              </button>
            )}
          </div>

          {/* Signals */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: '#e2e8f0' }}>
              {t.signalsTitle}
            </h3>
            {signals.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: summary.condition === 'INCONCLUSIVE' ? '#94a3b8' : '#10b981', fontSize: 13 }}>
                {summary.condition === 'INCONCLUSIVE' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                <span>{summary.condition === 'INCONCLUSIVE' ? (lang === 'ar' ? 'لم يتم جمع عينة المراقبة بعد.' : 'A live monitoring sample has not been collected yet.') : t.noSignals}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {signals.map((sig) => (
                  <div
                    key={sig.code}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 12,
                      background: 'rgba(2, 6, 23, 0.6)',
                      borderRadius: 8,
                      borderInlineStart: `4px solid ${sig.level === 'CRITICAL' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#38bdf8'}`,
                    }}
                  >
                    <AlertTriangle size={16} color={sig.level === 'CRITICAL' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#38bdf8'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                        {lang === 'ar' ? sig.messageAr : sig.messageEn}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Source: {sig.evidenceSource} • Suggested Tool: {sig.suggestedTool}
                      </div>
                    </div>
                    {tools.find((t) => t.ToolId === sig.suggestedTool) && (
                      <button
                        type="button"
                        onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === sig.suggestedTool)!, 'analyze')}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid #38bdf8',
                          color: '#38bdf8',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t.runTool}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Active Processes — a real searchable, filterable, sortable
          inventory with a contextual inspector, not a capped card grid. */}
      {activeTab === 'processes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.processesTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.processesSubtitle}</p>
          </div>
          <StationInventorySurface<OperationsPreviewProcess>
            lang={lang}
            rows={processRows}
            loading={isSampling}
            rowKey={proc => `pid-${proc.ProcessId}`}
            columns={processColumns}
            filters={processFilters}
            searchFields={proc => [
              proc.Name,
              String(proc.ProcessId),
              proc.Responding === false ? t.hanging : proc.Responding === true ? t.responding : '',
            ]}
            searchPlaceholder={{ en: t.searchProcesses, ar: t.searchProcesses }}
            empty={{
              notChecked: { en: t.notCheckedYet, ar: t.notCheckedYet },
              checking: { en: t.refreshing, ar: t.refreshing },
              noneFound: { en: t.noProcessesMeasured, ar: t.noProcessesMeasured },
              noMatch: { en: t.noProcessMatch, ar: t.noProcessMatch },
              noMatchHint: { en: t.notCheckedHint, ar: t.notCheckedHint },
            }}
            inspector={renderProcessInspector}
            sortInitial={{ key: 'memory', direction: 'desc' }}
            pageSize={150}
          />
        </div>
      )}

      {/* Tab 3: Memory Watch — the same measured list, ordered by working set.
          The page copy claimed a descending order it never applied. */}
      {activeTab === 'memory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.memoryTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.memorySubtitle}</p>
          </div>
          <StationInventorySurface<OperationsPreviewProcess>
            lang={lang}
            rows={processRows}
            loading={isSampling}
            rowKey={proc => `pid-${proc.ProcessId}`}
            columns={processColumns}
            filters={processFilters}
            searchFields={proc => [proc.Name, String(proc.ProcessId), t.workingSetMb(proc.MemoryMB)]}
            searchPlaceholder={{ en: t.searchProcesses, ar: t.searchProcesses }}
            empty={{
              notChecked: { en: t.notCheckedYet, ar: t.notCheckedYet },
              checking: { en: t.refreshing, ar: t.refreshing },
              noneFound: { en: t.noProcessesMeasured, ar: t.noProcessesMeasured },
              noMatch: { en: t.noProcessMatch, ar: t.noProcessMatch },
              noMatchHint: { en: t.notCheckedHint, ar: t.notCheckedHint },
            }}
            inspector={renderProcessInspector}
            sortInitial={{ key: 'memory', direction: 'desc' }}
            pageSize={150}
          />
        </div>
      )}

      {/* Tab 4: Services State — counts are guarded by the sample. The old
          `preview?.Services?.Running || 0` printed a measured 0 for a machine
          that had never been sampled. */}
      {activeTab === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.servicesTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.servicesSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.runningServices}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: sampleMeasured ? '#10b981' : '#64748b', marginTop: 4 }}>
                {sampleMeasured ? servicesSummary.running : '—'}
              </div>
              {!sampleMeasured && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{t.notCheckedYet}</div>}
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.stoppedAutoServices}</div>
              <div style={{
                fontSize: 24,
                fontWeight: 800,
                marginTop: 4,
                color: !sampleMeasured ? '#64748b' : stoppedAutoCount > 0 ? '#f59e0b' : '#10b981',
              }}>
                {sampleMeasured ? stoppedAutoCount : '—'}
              </div>
              {!sampleMeasured && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{t.notCheckedYet}</div>}
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.serviceCountLabel}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: sampleMeasured ? '#e2e8f0' : '#64748b', marginTop: 4 }}>
                {sampleMeasured ? servicesSummary.total : '—'}
              </div>
              {!sampleMeasured && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{t.notCheckedYet}</div>}
            </div>
          </div>

          <StationInventorySurface<OperationsPreviewService>
            lang={lang}
            rows={serviceRows}
            loading={isSampling}
            rowKey={svc => svc.Name || String(svc.ProcessId)}
            columns={serviceColumns}
            filters={serviceFilters}
            searchFields={svc => [svc.Name, svc.DisplayName, svc.Status, svc.StartMode, String(svc.ProcessId)]}
            searchPlaceholder={{ en: t.searchServices, ar: t.searchServices }}
            empty={{
              notChecked: { en: t.notCheckedYet, ar: t.notCheckedYet },
              checking: { en: t.refreshing, ar: t.refreshing },
              noneFound: { en: t.noStopAutoServices, ar: t.noStopAutoServices },
              noMatch: { en: t.noServiceMatch, ar: t.noServiceMatch },
              noMatchHint: { en: t.stopAutoUnmeasured, ar: t.stopAutoUnmeasured },
            }}
            inspector={renderServiceInspector}
            sortInitial={{ key: 'name', direction: 'asc' }}
            pageSize={150}
          />
        </div>
      )}

      {/* Tab 5: Unresponsive Tasks — an all-clear is only allowed once a sample
          was actually taken. Before that this claimed zero hangs. */}
      {activeTab === 'unresponsive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.unresponsiveTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.unresponsiveSubtitle}</p>
          </div>

          {!sampleMeasured ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155', borderRadius: 8, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 8px auto' }} />
              <div>{t.unmeasuredUnresponsive}</div>
            </div>
          ) : unresponsiveProcesses.length === 0 ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: 8, padding: 24, textAlign: 'center', color: '#10b981', fontSize: 13 }}>
              <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto' }} />
              <div>{t.noUnresponsiveMeasured}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
              {unresponsiveProcesses.map((proc) => (
                <div
                  key={proc.ProcessId}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fca5a5' }}>{proc.Name}</h4>
                    <span style={{ fontSize: 10, background: '#7f1d1d', color: '#fca5a5', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      PID {proc.ProcessId}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.workingSetMb(proc.MemoryMB)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Actions */}
      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.actionsTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>Category: 15-System-Monitoring ({availableStationTools.length} tools)</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
            {availableStationTools.map((tool) => (
              <div
                key={tool.ToolId}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: '2px 0 0 0', fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                      {pickName(tool, lang)}
                    </h4>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                    }}
                  >
                    {tool.RiskLevel}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  {tool.Purpose || t.noDescription}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>{tool.RequiresAdmin ? t.adminRequired : t.userExecution}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {tool.AnalyzeOnlySupported && (
                      <button
                        type="button"
                        onClick={() => handleLaunchTool(tool, 'analyze')}
                        style={{
                          padding: '5px 10px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid #38bdf8',
                          borderRadius: 6,
                          color: '#38bdf8',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Analyze
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLaunchTool(tool, 'run')}
                      style={{
                        padding: '5px 10px',
                        background: '#0284c7',
                        border: '1px solid #38bdf8',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Execute
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Report */}
      {activeTab === 'report' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#f8fafc' }}>{t.tabReport}</h3>
          <pre
            style={{
              background: '#030712',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: 12,
              color: '#38bdf8',
              fontFamily: 'monospace',
              fontSize: 11,
              overflowX: 'auto',
              maxHeight: 340,
            }}
          >
            {JSON.stringify(
              {
                station: '15-System-Monitoring',
                summary,
                signals,
                preview,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* Tab 8: History */}
      {activeTab === 'history' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#f8fafc' }}>{t.tabHistory}</h3>
          {history.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 12 }}>{t.emptyHistory}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.5)',
                    padding: 10,
                    borderRadius: 6,
                    borderInlineStart: `3px solid ${entry.status === 'SUCCESS' ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                      {entry.toolId} — {entry.toolName}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{entry.summary}</div>
                  </div>
                  <div style={{ textAlign: 'start' }}>
                    <span style={{ fontSize: 10, color: entry.status === 'SUCCESS' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {entry.status}
                    </span>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{entry.timestamp}</div>
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
  );
}
