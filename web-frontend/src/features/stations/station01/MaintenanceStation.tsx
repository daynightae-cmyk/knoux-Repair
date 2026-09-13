import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, Check, CheckCircle2, ChevronDown, CircleAlert, Clock, Cpu,
  Download, FileSearch, HardDrive, History, Layers3, LoaderCircle, LockKeyhole,
  Play, RefreshCw, ScanSearch, ShieldCheck, Square, Wrench, X,
} from 'lucide-react';
import type { BridgeRun, BridgeTool, ExecutionMode, SystemSnapshot, ToolRunConfirmation } from '../../../lib/api';
import { api, BridgeError } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { cancelExecution, decideExecution, pollExecution, runStatusToState, startExecution } from '../_shared/StationExecutionController';
import {
  appendHistory, availableScanChecks, buildMaintenanceReport, buildRecommendations, buildScanPlan,
  deriveCheckState, deriveHealthState, evidenceFromRun, loadHistory, stationTools,
  type EvidenceMap, type HistoryEntry, type MaintenanceCheckState, type MaintenanceScanGroupId,
  type Recommendation, type ToolEvidence,
} from './maintenanceModel';

interface MaintenanceStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

interface ActiveRun { runId: string; toolId: string; mode: ExecutionMode; startedAt: number }
interface QueueItem { toolId: string; state: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' }
interface RepairResult { recommendation: Recommendation; before: ToolEvidence | null; after: ToolEvidence }
type Workflow = 'CONFIGURE' | 'SCANNING' | 'REVIEW' | 'APPLYING' | 'COMPLETE' | 'PARTIAL';

const COPY = {
  en: {
    eyebrow: 'HEALTH STUDIO', title: 'KNOUX Care', subtitle: 'Windows diagnostic and repair center',
    configure: 'Configure scan', scanning: 'Scanning', review: 'Review findings', applying: 'Applying selected', complete: 'Maintenance complete', partial: 'Completed with attention',
    machine: 'Machine', bridge: 'Bridge', admin: 'Administrator', ai: 'KNOUX AI', lastScan: 'Last real scan', online: 'ONLINE', offline: 'OFFLINE', elevated: 'ELEVATED', standard: 'STANDARD',
    aiOff: 'OFF', aiAvailable: 'AVAILABLE', aiUnavailable: 'UNAVAILABLE', aiChecking: 'CHECKING',
    selectTitle: 'Select what to scan', selectSub: 'Only registered read-only checks are listed. Repairs never start from the scan button.',
    selectAll: 'Select all', clearAll: 'Clear all', recommended: 'Recommended', selected: 'checks selected',
    start: 'START SCAN', runAgain: 'RUN AGAIN', cancel: 'Cancel', elapsed: 'Elapsed', completedChecks: 'completed checks', findings: 'findings', errors: 'errors',
    noSelection: 'Select at least one real check.', permission: 'Selected checks require an elevated local bridge.', recheck: 'Re-check permission',
    scanPlan: 'Real scan plan', scanPlanBody: 'KNOUX will execute these registered read-only checks in order. No repair or cleanup is included.', begin: 'Begin scan', back: 'Go back',
    clear: 'No issue detected', ready: 'Ready', running: 'Scanning', failed: 'Failed', inconclusive: 'Inconclusive', cancelled: 'Cancelled', finding: 'Finding',
    reviewTitle: 'Review every finding', reviewSub: 'Risky changes are never pre-selected. Choose the repairs you approve.',
    noFindings: 'The selected checks returned no deterministic repair finding.', operationalErrors: 'Checks requiring attention',
    applySelected: 'APPLY SELECTED', selectedActions: 'selected actions', nothingSelected: 'Select at least one supported repair.',
    confirmRepair: 'Confirm selected repairs', confirmBody: 'These actions modify Windows. Review the exact order, risk, administrator and restart requirements.',
    typeConfirm: 'Type CONFIRM to authorize these changes', confirm: 'Confirm and apply',
    why: 'Why it was flagged', changes: 'What will change', evidence: 'Raw evidence', rollback: 'Rollback', report: 'Report', askAi: 'Ask KNOUX AI',
    queue: 'Operation queue', beforeAfter: 'Before / action / after', before: 'Before', action: 'Action', after: 'After',
    verified: 'VERIFIED', verificationRequired: 'VERIFICATION REQUIRED', restartRequired: 'RESTART REQUIRED',
    history: 'Real station history', download: 'Export evidence report',
    errInProgress: 'Another tool is currently running.', errElevation: 'Administrator permission is required.', errConfirmation: 'Explicit confirmation is required.', errMode: 'This execution mode is unsupported.', errUnknown: 'The registered tool is unavailable.', errOffline: 'The local execution bridge is unavailable.', errTimeout: 'The operation timed out.', errGeneric: 'The operation could not complete.',
    aiUnavailableBody: 'KNOUX AI is unavailable in this runtime. Diagnostics continue normally.',
  },
  ar: {
    eyebrow: 'استوديو الصحة', title: 'عناية KNOUX', subtitle: 'مركز تشخيص Windows وإصلاحه',
    configure: 'إعداد الفحص', scanning: 'جارٍ الفحص', review: 'مراجعة النتائج', applying: 'تطبيق المحدد', complete: 'اكتملت الصيانة', partial: 'اكتمل مع ملاحظات',
    machine: 'الجهاز', bridge: 'الجسر', admin: 'صلاحية المدير', ai: 'KNOUX AI', lastScan: 'آخر فحص حقيقي', online: 'متصل', offline: 'غير متصل', elevated: 'مدير', standard: 'عادي',
    aiOff: 'متوقف', aiAvailable: 'متاح', aiUnavailable: 'غير متاح', aiChecking: 'جارٍ التحقق',
    selectTitle: 'اختر ما تريد فحصه', selectSub: 'تظهر فقط فحوص القراءة المسجلة. زر الفحص لا يبدأ أي إصلاح.',
    selectAll: 'تحديد الكل', clearAll: 'مسح الكل', recommended: 'المقترح', selected: 'فحوص محددة',
    start: 'ابدأ الفحص', runAgain: 'فحص جديد', cancel: 'إيقاف', elapsed: 'المدة', completedChecks: 'فحوص مكتملة', findings: 'نتائج', errors: 'أخطاء',
    noSelection: 'اختر فحصًا حقيقيًا واحدًا على الأقل.', permission: 'الفحوص المحددة تحتاج الجسر المحلي بصلاحية المدير.', recheck: 'إعادة فحص الصلاحية',
    scanPlan: 'خطة الفحص الحقيقية', scanPlanBody: 'سينفذ KNOUX فحوص القراءة المسجلة بالترتيب. لا يوجد إصلاح أو تنظيف ضمن هذه الخطوة.', begin: 'بدء الفحص', back: 'رجوع',
    clear: 'لا توجد مشكلة', ready: 'جاهز', running: 'جارٍ الفحص', failed: 'فشل', inconclusive: 'غير حاسم', cancelled: 'ملغي', finding: 'نتيجة',
    reviewTitle: 'راجع كل نتيجة', reviewSub: 'لا يتم تحديد التغييرات الحساسة تلقائيًا. اختر الإصلاحات التي توافق عليها.',
    noFindings: 'لم تُرجع الفحوص المحددة نتيجة إصلاح حتمية.', operationalErrors: 'فحوص تحتاج انتباهًا',
    applySelected: 'تطبيق المحدد', selectedActions: 'إجراءات محددة', nothingSelected: 'اختر إصلاحًا مدعومًا واحدًا على الأقل.',
    confirmRepair: 'تأكيد الإصلاحات المحددة', confirmBody: 'هذه الإجراءات تغيّر Windows. راجع الترتيب الدقيق والمخاطر وصلاحية المدير وإعادة التشغيل.',
    typeConfirm: 'اكتب CONFIRM لتفويض هذه التغييرات', confirm: 'تأكيد وتطبيق',
    why: 'سبب الرصد', changes: 'ما الذي سيتغير', evidence: 'الدليل الخام', rollback: 'الاستعادة', report: 'التقرير', askAi: 'اسأل KNOUX AI',
    queue: 'طابور التنفيذ', beforeAfter: 'قبل / الإجراء / بعد', before: 'قبل', action: 'الإجراء', after: 'بعد',
    verified: 'تم التحقق', verificationRequired: 'التحقق مطلوب', restartRequired: 'إعادة التشغيل مطلوبة',
    history: 'سجل المحطة الحقيقي', download: 'تصدير تقرير الأدلة',
    errInProgress: 'توجد أداة أخرى قيد التشغيل.', errElevation: 'صلاحية المدير مطلوبة.', errConfirmation: 'يلزم تأكيد صريح.', errMode: 'وضع التنفيذ غير مدعوم.', errUnknown: 'الأداة المسجلة غير متاحة.', errOffline: 'جسر التنفيذ المحلي غير متاح.', errTimeout: 'انتهت مهلة العملية.', errGeneric: 'تعذر إكمال العملية.',
    aiUnavailableBody: 'KNOUX AI غير متاح في هذا التشغيل. يستمر التشخيص بصورة طبيعية.',
  },
} as const;

const GROUPS: Array<{ id: MaintenanceScanGroupId; icon: typeof ShieldCheck; label: { en: string; ar: string }; hint: { en: string; ar: string } }> = [
  { id: 'system-files', icon: FileSearch, label: { en: 'System files', ar: 'ملفات النظام' }, hint: { en: 'SFC and CBS integrity evidence', ar: 'أدلة سلامة SFC وCBS' } },
  { id: 'windows-image', icon: Layers3, label: { en: 'Windows health', ar: 'صحة Windows' }, hint: { en: 'DISM component-store checks', ar: 'فحوص مخزن مكونات DISM' } },
  { id: 'disk', icon: HardDrive, label: { en: 'Storage integrity', ar: 'سلامة التخزين' }, hint: { en: 'Online filesystem verification', ar: 'تحقق مباشر من نظام الملفات' } },
  { id: 'system-context', icon: Cpu, label: { en: 'System context', ar: 'سياق النظام' }, hint: { en: 'OS, uptime, drive and CBS facts', ar: 'النظام والتشغيل والقرص وCBS' } },
];

const CHECK_STATE_COPY: Record<MaintenanceCheckState, keyof typeof COPY.en> = {
  READY: 'ready', RUNNING: 'running', CLEAR: 'clear', FINDING: 'finding', FAILED: 'failed', INCONCLUSIVE: 'inconclusive', CANCELLED: 'cancelled',
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function errorMessage(error: unknown, lang: Lang): string {
  const text = COPY[lang];
  if (error instanceof BridgeError) {
    if (error.code === 'RUN_IN_PROGRESS') return text.errInProgress;
    if (error.code === 'ELEVATION_REQUIRED') return text.errElevation;
    if (error.code === 'CONFIRMATION_REQUIRED' || error.code === 'CONFIRMATION_PHRASE_REQUIRED') return text.errConfirmation;
    if (error.code === 'MODE_NOT_SUPPORTED') return text.errMode;
    if (error.code === 'UNKNOWN_TOOL') return text.errUnknown;
    if (error.code === 'BRIDGE_UNREACHABLE' || error.code === 'BRIDGE_UNAVAILABLE') return text.errOffline;
    if (error.code === 'TIMEOUT') return text.errTimeout;
    return `${text.errGeneric} [${error.code}]`;
  }
  return error instanceof Error ? error.message : text.errGeneric;
}

function resultTone(status: string): string {
  if (status === 'SUCCESS') return 'is-success';
  if (status === 'FAILED') return 'is-failed';
  if (status === 'WARNING' || status === 'INCONCLUSIVE') return 'is-warning';
  return 'is-neutral';
}

export default function MaintenanceStation({
  lang, tools, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus,
}: MaintenanceStationProps) {
  const text = COPY[lang];
  const station = useMemo(() => stationTools(tools), [tools]);
  const checks = useMemo(() => availableScanChecks(station), [station]);
  const byId = useMemo(() => new Map(station.map((tool) => [tool.ToolId, tool])), [station]);
  const recommendedIds = useMemo(() => checks.filter((check) => check.defaultSelected).map((check) => check.id), [checks]);
  const [selectedChecks, setSelectedChecks] = useState<string[]>(recommendedIds);
  const [expandedGroups, setExpandedGroups] = useState<MaintenanceScanGroupId[]>(GROUPS.map((group) => group.id));
  const [workflow, setWorkflow] = useState<Workflow>('CONFIGURE');
  const [evidence, setEvidence] = useState<EvidenceMap>({});
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [repairResults, setRepairResults] = useState<RepairResult[]>([]);
  const [selectedRepairs, setSelectedRepairs] = useState<string[]>([]);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [lines, setLines] = useState<Array<{ t: string; s: string; text: string }>>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [banner, setBanner] = useState('');
  const [scanPlanOpen, setScanPlanOpen] = useState(false);
  const [repairPlanOpen, setRepairPlanOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [elevated, setElevated] = useState(bridgeElevated);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiState, setAiState] = useState<'OFF' | 'CHECKING' | 'AVAILABLE' | 'UNAVAILABLE'>('OFF');
  const pollTimer = useRef<number | null>(null);
  const lastLineCount = useRef(0);
  const cancelRequested = useRef(false);
  const selectionInitialized = useRef(false);

  useEffect(() => { setElevated(bridgeElevated); }, [bridgeElevated]);
  useEffect(() => {
    if (!selectionInitialized.current && checks.length) {
      selectionInitialized.current = true;
      setSelectedChecks(recommendedIds);
    }
  }, [checks.length, recommendedIds]);
  useEffect(() => () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); }, []);
  useEffect(() => {
    let mounted = true;
    api.system().then(({ system: snapshot }) => { if (mounted) setSystem(snapshot); }).catch(() => { if (mounted) setSystem(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - activeRun.startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [activeRun]);

  const runningIds = useMemo(() => activeRun ? [activeRun.toolId] : [], [activeRun]);
  const recommendations = useMemo(() => buildRecommendations(evidence, station), [evidence, station]);
  const health = useMemo(() => deriveHealthState(evidence, runningIds, bridgeOnline), [evidence, runningIds, bridgeOnline]);
  const selectedPlan = useMemo(() => buildScanPlan(selectedChecks, station), [selectedChecks, station]);
  const selectedRecommendationList = useMemo(() => recommendations.filter((item) => selectedRepairs.includes(item.id)), [recommendations, selectedRepairs]);
  const completedCount = queue.filter((item) => item.state === 'COMPLETED' || item.state === 'FAILED' || item.state === 'CANCELLED').length;
  const failedChecks = checks.filter((check) => ['FAILED', 'INCONCLUSIVE'].includes(deriveCheckState(check, evidence, runningIds)));
  const lastScan = useMemo(() => [
    ...Object.values(evidence).map((item) => item.finishedAt),
    ...history.map((item) => item.finishedAt),
  ].filter(Boolean).sort().at(-1) || '', [evidence, history]);
  const currentCheck = activeRun ? checks.find((check) => check.toolId === activeRun.toolId) : null;
  const progress = queue.length ? Math.round((completedCount / queue.length) * 100) : 0;

  const recordEvidence = useCallback((run: BridgeRun) => {
    const item = evidenceFromRun(run);
    setEvidence((current) => ({ ...current, [item.toolId]: item }));
    setHistory((current) => appendHistory(current, item));
    const state = runStatusToState(run.status);
    onToolStatus(run.toolId, state === 'SUCCESS' ? 'success' : state === 'FAILED' ? 'error' : state === 'CANCELLED' ? 'cancelled' : state === 'INCONCLUSIVE' ? 'inconclusive' : 'error');
  }, [onToolStatus]);

  const executeStep = useCallback(async (toolId: string, mode: ExecutionMode, confirmation?: ToolRunConfirmation): Promise<ToolEvidence> => {
    const tool = byId.get(toolId);
    if (!tool) throw new BridgeError(404, 'UNKNOWN_TOOL', text.errUnknown);
    const decision = decideExecution({ tool, mode, confirmation }, elevated);
    if (!decision.ok) {
      if (decision.nextState === 'WAITING_FOR_CONFIRMATION') throw new BridgeError(403, 'CONFIRMATION_REQUIRED', decision.reason || text.errConfirmation);
      if (decision.nextState === 'WAITING_FOR_ELEVATION') throw new BridgeError(403, 'ELEVATION_REQUIRED', decision.reason || text.errElevation);
      throw new BridgeError(423, 'WINRE_ONLY_ONLINE_BLOCKED', decision.reason || text.errMode);
    }
    const runId = await startExecution({ tool, mode, options: {}, confirmation });
    setActiveRun({ runId, toolId, mode, startedAt: Date.now() });
    setElapsedMs(0);
    setLines([]);
    lastLineCount.current = 0;
    onToolStatus(toolId, 'running');
    try {
      for (;;) {
        const run = await pollExecution(runId);
        const fresh = run.lines.slice(lastLineCount.current);
        if (fresh.length) {
          lastLineCount.current = run.lines.length;
          setLines((current) => [...current, ...fresh].slice(-500));
        }
        if (run.status !== 'running') {
          recordEvidence(run);
          return evidenceFromRun(run);
        }
        await new Promise((resolve) => { pollTimer.current = window.setTimeout(resolve, 700); });
      }
    } finally {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      setActiveRun(null);
    }
  }, [byId, elevated, onToolStatus, recordEvidence, text]);

  const runScan = useCallback(async () => {
    setScanPlanOpen(false);
    setBanner('');
    setEvidence({});
    setRepairResults([]);
    setSelectedRepairs([]);
    cancelRequested.current = false;
    setQueue(selectedPlan.map((step) => ({ toolId: step.toolId, state: 'QUEUED' as const })));
    setWorkflow('SCANNING');
    for (const step of selectedPlan) {
      if (cancelRequested.current) break;
      setQueue((current) => current.map((item) => item.toolId === step.toolId ? { ...item, state: 'RUNNING' } : item));
      try {
        const result = await executeStep(step.toolId, step.mode);
        const state = result.status === 'CANCELLED' ? 'CANCELLED' : result.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
        setQueue((current) => current.map((item) => item.toolId === step.toolId ? { ...item, state } : item));
      } catch (error) {
        setQueue((current) => current.map((item) => item.toolId === step.toolId ? { ...item, state: 'FAILED' } : item));
        setBanner(`[${step.toolId}] ${errorMessage(error, lang)}`);
      }
    }
    setQueue((current) => current.map((item) => item.state === 'QUEUED' ? { ...item, state: 'CANCELLED' } : item));
    setWorkflow('REVIEW');
  }, [executeStep, lang, selectedPlan]);

  const applyRepairs = useCallback(async () => {
    setRepairPlanOpen(false);
    setBanner('');
    setRepairResults([]);
    setWorkflow('APPLYING');
    const confirmation: ToolRunConfirmation = { confirmed: true, phrase: confirmPhrase.trim(), acknowledgedRecovery: true, confirmedAt: new Date().toISOString() };
    const results: RepairResult[] = [];
    for (const recommendation of selectedRecommendationList) {
      const sourceId = recommendation.toolId === 'SM02' ? 'SM01' : recommendation.toolId === 'SM05' ? (evidence.SM04 ? 'SM04' : 'SM03') : 'SM06';
      try {
        const after = await executeStep(recommendation.toolId, recommendation.mode, confirmation);
        results.push({ recommendation, before: evidence[sourceId] || null, after });
        setRepairResults([...results]);
      } catch (error) { setBanner(`[${recommendation.toolId}] ${errorMessage(error, lang)}`); }
    }
    const hasFailure = results.length !== selectedRecommendationList.length || results.some(({ after }) => after.status === 'FAILED' || after.status === 'INCONCLUSIVE' || (after.status === 'WARNING' && after.verificationResult !== 'SCHEDULED'));
    setWorkflow(hasFailure ? 'PARTIAL' : 'COMPLETE');
  }, [confirmPhrase, evidence, executeStep, lang, selectedRecommendationList]);

  const cancelActive = useCallback(async () => {
    cancelRequested.current = true;
    if (!activeRun) return;
    try { await cancelExecution(activeRun.runId); } catch (error) { setBanner(errorMessage(error, lang)); }
  }, [activeRun, lang]);

  const recheckElevation = useCallback(async () => {
    setBanner('');
    try {
      const status = await api.health();
      setElevated(status.elevated);
      if (!status.elevated) setBanner(text.permission);
    } catch (error) { setBanner(errorMessage(error, lang)); }
  }, [lang, text.permission]);

  const toggleAi = useCallback(async () => {
    if (aiEnabled) { setAiEnabled(false); setAiState('OFF'); return; }
    setAiState('CHECKING');
    try {
      const response = await fetch('/api/knoux-ai/status', { headers: { Accept: 'application/json' } });
      const body = await response.json().catch(() => ({})) as { available?: boolean };
      if (response.ok && body.available === true) { setAiEnabled(true); setAiState('AVAILABLE'); }
      else { setAiEnabled(false); setAiState('UNAVAILABLE'); setBanner(text.aiUnavailableBody); }
    } catch { setAiEnabled(false); setAiState('UNAVAILABLE'); setBanner(text.aiUnavailableBody); }
  }, [aiEnabled, text.aiUnavailableBody]);

  const askAi = useCallback((recommendation: Recommendation) => {
    if (!aiEnabled) return;
    const sourceId = recommendation.toolId === 'SM02' ? 'SM01' : recommendation.toolId === 'SM05' ? (evidence.SM04 ? 'SM04' : 'SM03') : 'SM06';
    const source = evidence[sourceId];
    window.dispatchEvent(new CustomEvent('knoux:ai-open', { detail: {
      prompt: lang === 'ar' ? `اشرح نتيجة ${sourceId} ومخاطر الإجراء ${recommendation.toolId}.` : `Explain the ${sourceId} finding and the risks of ${recommendation.toolId}.`,
      context: { familyId: 'system-vitality', serviceId: 'maintenance', sourceToolId: sourceId, proposedToolId: recommendation.toolId, evidence: source || null },
    } }));
  }, [aiEnabled, evidence, lang]);

  const downloadReport = useCallback(() => {
    const report = buildMaintenanceReport({ evidence, history, health, osCaption: system?.Os || '', osBuild: system?.Build || '', lang });
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knoux-care-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [evidence, health, history, lang, system]);

  const resetScan = useCallback(() => {
    cancelRequested.current = false;
    setWorkflow('CONFIGURE');
    setEvidence({});
    setQueue([]);
    setRepairResults([]);
    setSelectedRepairs([]);
    setLines([]);
    setBanner('');
  }, []);

  if (bridgeOnline === false) return <StationOfflineState lang={lang} reason={text.errOffline} onRetry={onRetryBridge} />;

  const phaseLabel = workflow === 'CONFIGURE' ? text.configure : workflow === 'SCANNING' ? text.scanning : workflow === 'REVIEW' ? text.review : workflow === 'APPLYING' ? text.applying : workflow === 'COMPLETE' ? text.complete : text.partial;
  const selectedNeedsAdmin = selectedPlan.some((step) => byId.get(step.toolId)?.RequiresAdmin) && !elevated;

  return (
    <StationErrorBoundary>
      <div className="care-center" dir={lang === 'ar' ? 'rtl' : 'ltr'} data-workflow={workflow.toLowerCase()}>
        {banner && <div className="care-banner" role="alert"><CircleAlert size={15}/><span dir="auto">{banner}</span><button type="button" onClick={() => setBanner('')} aria-label="Close"><X size={13}/></button></div>}

        <header className="care-header">
          <div className="care-brand"><span><Wrench size={19}/></span><div><p>{text.eyebrow}</p><h1>{text.title}</h1><small>{text.subtitle}</small></div></div>
          <div className="care-runtime-strip">
            <span><Cpu size={12}/><small>{text.machine}</small><b dir="auto">{system?.Machine || system?.Os || '—'}</b></span>
            <span className={bridgeOnline ? 'is-good' : 'is-bad'}><ShieldCheck size={12}/><small>{text.bridge}</small><b>{bridgeOnline ? text.online : text.offline}</b></span>
            <button type="button" onClick={() => void recheckElevation()} className={elevated ? 'is-good' : 'is-warn'}><LockKeyhole size={12}/><small>{text.admin}</small><b>{elevated ? text.elevated : text.standard}</b></button>
            <button type="button" onClick={() => void toggleAi()} className={aiEnabled ? 'is-ai-on' : aiState === 'UNAVAILABLE' ? 'is-bad' : ''} aria-pressed={aiEnabled}><Bot size={12}/><small>{text.ai}</small><b>{aiState === 'OFF' ? text.aiOff : aiState === 'CHECKING' ? text.aiChecking : aiState === 'AVAILABLE' ? text.aiAvailable : text.aiUnavailable}</b></button>
            <span><History size={12}/><small>{text.lastScan}</small><b>{lastScan ? new Date(lastScan).toLocaleString(lang) : '—'}</b></span>
          </div>
        </header>

        <section className="care-workspace" aria-live="polite">
          <div className="care-scan-stage">
            <div className="care-phase"><i/><span>{phaseLabel}</span></div>
            <button type="button" className={`care-scan-control is-${workflow.toLowerCase()}`} style={{ '--care-progress': `${progress * 3.6}deg` } as React.CSSProperties} disabled={workflow === 'SCANNING' || workflow === 'APPLYING' || selectedPlan.length === 0 || selectedNeedsAdmin} onClick={() => workflow === 'CONFIGURE' ? setScanPlanOpen(true) : resetScan()}>
              <span className="care-scan-rings" aria-hidden="true"><i/><i/><i/></span>
              <span className="care-scan-copy">{workflow === 'SCANNING' || workflow === 'APPLYING' ? <LoaderCircle size={27}/> : workflow === 'COMPLETE' ? <CheckCircle2 size={29}/> : <ScanSearch size={29}/>}<strong>{workflow === 'CONFIGURE' ? text.start : workflow === 'SCANNING' ? text.scanning : workflow === 'APPLYING' ? text.applying : text.runAgain}</strong><small>{workflow === 'SCANNING' ? `${completedCount} / ${queue.length}` : workflow === 'CONFIGURE' ? `${selectedPlan.length} ${text.selected}` : phaseLabel}</small></span>
            </button>
            {(workflow === 'SCANNING' || workflow === 'APPLYING') && activeRun && <div className="care-current-operation"><b>{currentCheck ? currentCheck.label[lang] : pickName(byId.get(activeRun.toolId)!, lang)}</b><span><Clock size={12}/>{text.elapsed} {formatElapsed(elapsedMs)}</span><button type="button" onClick={() => void cancelActive()}><Square size={11}/>{text.cancel}</button></div>}
            {selectedNeedsAdmin && workflow === 'CONFIGURE' && <button type="button" className="care-permission-callout" onClick={() => void recheckElevation()}><LockKeyhole size={14}/><span>{text.permission}</span><b>{text.recheck}</b></button>}
            {selectedPlan.length === 0 && workflow === 'CONFIGURE' && <div className="care-selection-note" role="status"><CircleAlert size={13}/>{text.noSelection}</div>}
          </div>

          <div className="care-context-panel">
            {workflow === 'CONFIGURE' && <>
              <div className="care-section-head"><div><p>{text.configure}</p><h2>{text.selectTitle}</h2><span>{text.selectSub}</span></div><div><button type="button" onClick={() => setSelectedChecks(checks.map((check) => check.id))}>{text.selectAll}</button><button type="button" onClick={() => setSelectedChecks(recommendedIds)}>{text.recommended}</button><button type="button" onClick={() => setSelectedChecks([])}>{text.clearAll}</button></div></div>
              <div className="care-groups">
                {GROUPS.map((group) => {
                  const groupChecks = checks.filter((check) => check.groupId === group.id);
                  if (!groupChecks.length) return null;
                  const selectedCount = groupChecks.filter((check) => selectedChecks.includes(check.id)).length;
                  const expanded = expandedGroups.includes(group.id);
                  const Icon = group.icon;
                  return <article className="care-group" key={group.id} data-selected={selectedCount > 0}>
                    <header><button type="button" className="care-group-toggle" onClick={() => setExpandedGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} aria-expanded={expanded}><span><Icon size={17}/></span><div><strong>{group.label[lang]}</strong><small>{group.hint[lang]}</small></div><b>{selectedCount}/{groupChecks.length}</b><ChevronDown size={14}/></button><input type="checkbox" checked={selectedCount === groupChecks.length} ref={(node) => { if (node) node.indeterminate = selectedCount > 0 && selectedCount < groupChecks.length; }} onChange={(event) => setSelectedChecks((current) => event.target.checked ? [...new Set([...current, ...groupChecks.map((check) => check.id)])] : current.filter((id) => !groupChecks.some((check) => check.id === id)))} aria-label={group.label[lang]}/></header>
                    {expanded && <div className="care-check-list">{groupChecks.map((check) => <label key={check.id}><input type="checkbox" checked={selectedChecks.includes(check.id)} onChange={(event) => setSelectedChecks((current) => event.target.checked ? [...current, check.id] : current.filter((id) => id !== check.id))}/><span><strong>{check.label[lang]}</strong><small>{check.description[lang]}</small></span>{byId.get(check.toolId)?.RequiresAdmin && <em><LockKeyhole size={10}/>{text.admin}</em>}</label>)}</div>}
                  </article>;
                })}
              </div>
            </>}

            {workflow === 'SCANNING' && <>
              <div className="care-scan-summary"><div><strong>{completedCount}</strong><span>{text.completedChecks}</span></div><div><strong>{recommendations.length}</strong><span>{text.findings}</span></div><div><strong>{failedChecks.length}</strong><span>{text.errors}</span></div></div>
              <div className="care-queue">{queue.map((item, index) => { const check = checks.find((candidate) => candidate.toolId === item.toolId); return <div key={item.toolId} data-state={item.state.toLowerCase()}><span>{index + 1}</span><div><strong>{check?.label[lang] || item.toolId}</strong><small>{item.toolId}</small></div><b>{item.state}</b></div>; })}</div>
              <button type="button" className="care-log-toggle" onClick={() => setShowRaw((value) => !value)}>{text.evidence} ({lines.length})</button>
              {showRaw && <pre className="care-raw-log">{lines.length ? lines.slice(-200).map((line) => line.text).join('\n') : '…'}</pre>}
            </>}

            {(workflow === 'REVIEW' || workflow === 'APPLYING') && <>
              <div className="care-section-head"><div><p>{text.review}</p><h2>{text.reviewTitle}</h2><span>{text.reviewSub}</span></div><div><b>{recommendations.length} {text.findings}</b></div></div>
              {recommendations.length === 0 ? <div className="care-clean-result"><CheckCircle2 size={28}/><strong>{text.noFindings}</strong></div> : <div className="care-findings">{recommendations.map((recommendation) => {
                const tool = byId.get(recommendation.toolId)!;
                const sourceId = recommendation.toolId === 'SM02' ? 'SM01' : recommendation.toolId === 'SM05' ? (evidence.SM04 ? 'SM04' : 'SM03') : 'SM06';
                const source = evidence[sourceId];
                return <details key={recommendation.id} className="care-finding" open><summary><input type="checkbox" checked={selectedRepairs.includes(recommendation.id)} disabled={workflow === 'APPLYING'} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedRepairs((current) => event.target.checked ? [...current, recommendation.id] : current.filter((id) => id !== recommendation.id))}/><span><AlertTriangle size={16}/></span><div><strong>{pickName(tool, lang)}</strong><small>{sourceId} · {source?.verificationResult || source?.status}</small></div><em className={`maint-risk is-${tool.RiskLevel.toLowerCase().replace(/_/g, '-')}`}>{tool.RiskLevel}</em><ChevronDown size={14}/></summary><div className="care-finding-details"><dl><div><dt>{text.why}</dt><dd>{lang === 'ar' ? recommendation.reasonAr : recommendation.reason}</dd></div><div><dt>{text.changes}</dt><dd>{lang === 'ar' ? recommendation.impactAr : recommendation.impact}</dd></div><div><dt>{text.rollback}</dt><dd>{tool.RollbackMethod || '—'}</dd></div><div><dt>{text.report}</dt><dd dir="ltr">{source?.reportPath || '—'}</dd></div></dl>{aiEnabled && <button type="button" onClick={() => askAi(recommendation)}><Bot size={13}/>{text.askAi}</button>}</div></details>;
              })}</div>}
              {failedChecks.length > 0 && <details className="care-errors"><summary><CircleAlert size={14}/>{text.operationalErrors} · {failedChecks.length}<ChevronDown size={13}/></summary><div>{failedChecks.map((check) => <p key={check.id}><b>{check.label[lang]}</b><span>{evidence[check.toolId]?.errorMessage || evidence[check.toolId]?.verificationResult}</span></p>)}</div></details>}
              {selectedRecommendationList.some((item) => byId.get(item.toolId)?.RequiresAdmin) && !elevated && workflow === 'REVIEW' && <button type="button" className="care-permission-callout" onClick={() => void recheckElevation()}><LockKeyhole size={14}/><span>{text.permission}</span><b>{text.recheck}</b></button>}
              {recommendations.length > 0 && <div className="care-apply-bar"><span><b>{selectedRecommendationList.length}</b> {text.selectedActions}</span><button type="button" disabled={selectedRecommendationList.length === 0 || workflow === 'APPLYING' || selectedRecommendationList.some((item) => byId.get(item.toolId)?.RequiresAdmin && !elevated)} onClick={() => { setConfirmPhrase(''); setRepairPlanOpen(true); }}><Wrench size={15}/>{text.applySelected}</button></div>}
            </>}

            {(workflow === 'COMPLETE' || workflow === 'PARTIAL') && <>
              <div className={`care-final-head ${workflow === 'PARTIAL' ? 'is-partial' : ''}`}>{workflow === 'PARTIAL' ? <AlertTriangle size={27}/> : <CheckCircle2 size={27}/>}<div><p>{phaseLabel}</p><h2>{repairResults.length} {text.selectedActions}</h2></div><button type="button" onClick={resetScan}><RefreshCw size={13}/>{text.runAgain}</button></div>
              <div className="care-before-after">{repairResults.map(({ recommendation, before, after }) => <article key={recommendation.id}><header><strong>{recommendation.toolId}</strong><span className={resultTone(after.status)}>{after.restartNeeded ? text.restartRequired : after.status === 'SUCCESS' && after.verificationResult ? text.verified : text.verificationRequired}</span></header><div><section><small>{text.before}</small><b>{before?.verificationResult || before?.status || '—'}</b></section><section><small>{text.action}</small><b>{recommendation.toolId}</b></section><section><small>{text.after}</small><b>{after.verificationResult || after.status}</b></section></div>{after.errorMessage && <p>{after.errorMessage}</p>}</article>)}</div>
            </>}
          </div>
        </section>

        {(workflow === 'REVIEW' || workflow === 'COMPLETE' || workflow === 'PARTIAL') && <section className="care-result-groups">{GROUPS.map((group) => { const groupChecks = checks.filter((check) => check.groupId === group.id && evidence[check.toolId]); if (!groupChecks.length) return null; const Icon = group.icon; return <article key={group.id}><header><Icon size={16}/><strong>{group.label[lang]}</strong><span>{groupChecks.length}</span></header><div>{groupChecks.map((check) => { const state = deriveCheckState(check, evidence, runningIds); return <p key={check.id} data-state={state.toLowerCase()}><span>{state === 'CLEAR' ? <Check size={13}/> : state === 'FINDING' ? <AlertTriangle size={13}/> : <CircleAlert size={13}/>}</span><b>{check.label[lang]}</b><small>{text[CHECK_STATE_COPY[state]]}</small></p>; })}</div></article>; })}</section>}

        {history.length > 0 && <details className="care-history"><summary><History size={14}/><strong>{text.history}</strong><span>{history.length}</span><ChevronDown size={13}/></summary><div><button type="button" onClick={downloadReport}><Download size={13}/>{text.download}</button><table><thead><tr><th>{text.lastScan}</th><th>Tool</th><th>Status</th><th>{text.evidence}</th></tr></thead><tbody>{history.slice(0, 30).map((entry, index) => <tr key={`${entry.toolId}-${entry.finishedAt}-${index}`}><td>{entry.finishedAt || '—'}</td><td>{entry.toolId}</td><td>{entry.status}</td><td>{entry.verificationResult || '—'}</td></tr>)}</tbody></table></div></details>}

        {scanPlanOpen && <div className="care-dialog-backdrop" onMouseDown={() => setScanPlanOpen(false)}><section role="dialog" aria-modal="true" className="care-dialog" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="care-dialog-close" onClick={() => setScanPlanOpen(false)}><X size={16}/></button><ScanSearch size={24}/><h2>{text.scanPlan}</h2><p>{text.scanPlanBody}</p><ol>{selectedPlan.map((step, index) => <li key={step.toolId}><span>{index + 1}</span><div><strong>{pickName(byId.get(step.toolId)!, lang)}</strong><small>{step.toolId} · READ ONLY{byId.get(step.toolId)?.RequiresAdmin ? ` · ${text.admin}` : ''}</small></div></li>)}</ol><footer><button type="button" onClick={() => setScanPlanOpen(false)}>{text.back}</button><button type="button" onClick={() => void runScan()} disabled={selectedPlan.length === 0 || selectedNeedsAdmin}><Play size={13}/>{text.begin}</button></footer></section></div>}

        {repairPlanOpen && <div className="care-dialog-backdrop" onMouseDown={() => setRepairPlanOpen(false)}><section role="dialog" aria-modal="true" className="care-dialog is-repair" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="care-dialog-close" onClick={() => setRepairPlanOpen(false)}><X size={16}/></button><AlertTriangle size={24}/><h2>{text.confirmRepair}</h2><p>{text.confirmBody}</p><ol>{selectedRecommendationList.map((item, index) => { const tool = byId.get(item.toolId)!; return <li key={item.id}><span>{index + 1}</span><div><strong>{pickName(tool, lang)}</strong><small>{tool.RiskLevel} · {tool.RequiresAdmin ? text.admin : '—'} · {tool.RequiresRestart ? text.restartRequired : 'NO RESTART'}</small></div></li>; })}</ol><label><span>{text.typeConfirm}</span><input value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder="CONFIRM" autoFocus/></label><footer><button type="button" onClick={() => setRepairPlanOpen(false)}>{text.back}</button><button type="button" onClick={() => void applyRepairs()} disabled={confirmPhrase.trim().toUpperCase() !== 'CONFIRM'}><Wrench size={13}/>{text.confirm}</button></footer></section></div>}
      </div>
    </StationErrorBoundary>
  );
}
