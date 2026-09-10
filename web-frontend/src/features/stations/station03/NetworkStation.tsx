import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CircleAlert, Clock, Download, FileText,
  LoaderCircle, LockKeyhole, Play, RefreshCw, ScanSearch, ShieldCheck, Square, Waypoints, Wifi, X,
} from 'lucide-react';
import type { BridgeRun, BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api, BridgeError } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { decideExecution, startExecution, pollExecution, cancelExecution } from '../_shared/StationExecutionController';
import {
  appendHistory, buildNetworkReport, buildRecommendations, classifyAdapter, deriveLayerStates, diagnosePlan,
  emptyEvidence, firstFailedLayer, loadHistory, outcomeFromRun, parseNi01Lines, parseNi06Lines, REPAIR_LADDER,
  stationTools, STATION03_TOOL_IDS, formatMs,
  type ConnectionLayerId, type DiagnoseEvidence, type HistoryEntry, type LayerState, type PreviewAdapter, type ToolOutcome,
} from './networkModel';

interface NetworkStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

interface ActiveRun {
  runId: string;
  toolId: string;
  mode: ExecutionMode;
  startedAt: number;
}

const COPY = {
  en: {
    eyebrow: 'CONNECTION MAP', title: 'Network Diagnostic Workstation', subtitle: 'Real adapters, gateways, DNS, and reachability — measured layer by layer.',
    diagnose: 'Diagnose Connection', diagnosing: 'Diagnosing…', cancel: 'Cancel', close: 'Close',
    pathTitle: 'Connection path', adaptersTitle: 'Adapters & IP', layersTitle: 'Layer evidence',
    findingsTitle: 'Findings', ladderTitle: 'Repair ladder', opsTitle: 'Network operations',
    verifyTitle: 'Before / after verification', evidenceTitle: 'Evidence center', historyTitle: 'Station history',
    reportDownload: 'Download network report',
    notChecked: 'Not checked', unavailable: 'Unavailable', notMeasured: 'Not measured',
    analyze: 'Analyze', preview: 'What-if', run: 'Run', reviewRun: 'Review & run', retest: 'Re-test now',
    rawLog: 'Raw log', hideRaw: 'Hide raw log', elapsed: 'Elapsed',
    emptyHistory: 'No network runs yet. Evidence from real runs will appear here.',
    permissionTitle: 'Administrator permission required',
    elevateHelp: 'Repairs that change Windows networking need an elevated bridge. Restart the local bridge elevated, then re-check.',
    elevationRetry: 'Re-check permission',
    lastResult: 'Last result', risk: 'Risk', admin: 'Admin', restart: 'Restart',
    changedNote: 'Changed system', verification: 'Verification',
    bridgeVsInternet: 'Bridge offline is not internet offline. The execution bridge state and your internet state are independent.',
    engineOffline: 'Execution bridge offline',
    commandVsRestored: 'Command completed is not connectivity restored. Restoration is proven by re-test only.',
    restartToVerify: 'Restart required before this repair can be verified.',
    toolMissing: 'Registered tool is missing from the runtime registry.',
    errInProgress: 'Another tool is currently running. Wait for it to finish or cancel it first.',
    errElevation: 'This operation requires Administrator privileges.',
    errConfirmation: 'Explicit confirmation is required before execution.',
    errMode: 'This mode is not supported by the selected tool.',
    errUnknown: 'Unknown tool. Only registered manifest tools can run.',
    errOffline: 'Execution bridge offline.',
    errTimeout: 'The operation exceeded its time limit.',
    errGeneric: 'The operation could not complete.',
    lastResort: 'Last resort', level: 'Level',
    yes: 'Yes', no: 'No',
    historyCols: { when: 'When', kind: 'Kind', tool: 'Tool', mode: 'Mode', result: 'Result', finding: 'Finding', changed: 'Changed', restart: 'Restart', verify: 'Verify', report: 'Report' },
  },
  ar: {
    eyebrow: 'خريطة الاتصال', title: 'محطة تشخيص الشبكة', subtitle: 'محولات وبوابات وDNS ووصول حقيقي — يُقاس طبقة طبقة.',
    diagnose: 'تشخيص الاتصال', diagnosing: 'جارٍ التشخيص…', cancel: 'إيقاف', close: 'إغلاق',
    pathTitle: 'مسار الاتصال', adaptersTitle: 'المحولات وعناوين IP', layersTitle: 'أدلة الطبقات',
    findingsTitle: 'النتائج', ladderTitle: 'سلم الإصلاح', opsTitle: 'عمليات الشبكة',
    verifyTitle: 'التحقق قبل / بعد', evidenceTitle: 'مركز الأدلة', historyTitle: 'سجل المحطة',
    reportDownload: 'تنزيل تقرير الشبكة',
    notChecked: 'لم تُفحص', unavailable: 'غير متاح', notMeasured: 'لم يُقس',
    analyze: 'تحليل', preview: 'معاينة', run: 'تشغيل', reviewRun: 'مراجعة وتشغيل', retest: 'إعادة الاختبار الآن',
    rawLog: 'السجل الخام', hideRaw: 'إخفاء السجل', elapsed: 'المدة',
    emptyHistory: 'لا توجد عمليات شبكة بعد. ستظهر هنا أدلة التشغيل الحقيقي.',
    permissionTitle: 'تتطلب صلاحية المدير',
    elevateHelp: 'إصلاحات الشبكة تحتاج جسرًا بصلاحية المدير. أعد تشغيل الجسر المحلي بصلاحية المدير ثم أعد التحقق.',
    elevationRetry: 'إعادة التحقق من الصلاحية',
    lastResult: 'آخر نتيجة', risk: 'المخاطر', admin: 'المدير', restart: 'إعادة التشغيل',
    changedNote: 'غيّر النظام', verification: 'التحقق',
    bridgeVsInternet: 'تعطل الجسر ليس تعطل الإنترنت. حالة جسر التنفيذ وحالة الإنترنت مستقلتان.',
    engineOffline: 'جسر التنفيذ مفصول',
    commandVsRestored: 'اكتمال الأمر ليس استعادة الاتصال. الاستعادة تُثبت بإعادة الاختبار فقط.',
    restartToVerify: 'يلزم إعادة التشغيل قبل التحقق من هذا الإصلاح.',
    toolMissing: 'الأداة المسجلة غير موجودة في سجل التشغيل.',
    errInProgress: 'هناك أداة تعمل حالياً. انتظر انتهاءها أو أوقفها أولاً.',
    errElevation: 'تتطلب هذه العملية صلاحيات المدير.',
    errConfirmation: 'يلزم تأكيد صريح قبل التنفيذ.',
    errMode: 'هذا الوضع غير مدعوم للأداة المختارة.',
    errUnknown: 'أداة غير معروفة. تعمل فقط الأدوات المسجلة.',
    errOffline: 'جسر التنفيذ مفصول.',
    errTimeout: 'تجاوزت العملية الحد الزمني.',
    errGeneric: 'تعذر إكمال العملية.',
    lastResort: 'الملاذ الأخير', level: 'المستوى',
    yes: 'نعم', no: 'لا',
    historyCols: { when: 'الوقت', kind: 'النوع', tool: 'الأداة', mode: 'الوضع', result: 'النتيجة', finding: 'النتيجة', changed: 'غيّر', restart: 'إعادة', verify: 'التحقق', report: 'التقرير' },
  },
} as const;

const LAYER_COPY: Record<ConnectionLayerId, { en: string; ar: string }> = {
  adapter: { en: 'Adapter', ar: 'المحول' },
  ip: { en: 'IP config', ar: 'إعداد IP' },
  gateway: { en: 'Gateway', ar: 'البوابة' },
  dns: { en: 'DNS', ar: 'حل أسماء DNS' },
  internet: { en: 'Internet', ar: 'الإنترنت' },
  quality: { en: 'Quality', ar: 'الجودة' },
  routing: { en: 'Routing', ar: 'التوجيه' },
};

const LAYER_STATE_COPY: Record<LayerState, { en: string; ar: string }> = {
  NOT_CHECKED: { en: 'Not checked', ar: 'لم تُفحص' },
  CHECKING: { en: 'Checking', ar: 'جارٍ الفحص' },
  CONNECTED: { en: 'Connected', ar: 'متصل' },
  DEGRADED: { en: 'Degraded', ar: 'متدهور' },
  UNREACHABLE: { en: 'Unreachable', ar: 'غير reachable' },
  MISCONFIGURED: { en: 'Misconfigured', ar: 'خطأ في الإعداد' },
  BLOCKED: { en: 'Blocked', ar: 'محظور' },
  ATTENTION: { en: 'Attention', ar: 'انتباه' },
  CONFIGURED: { en: 'Configured', ar: 'تم الإعداد' },
  REPAIR_AVAILABLE: { en: 'Repair available', ar: 'إصلاح متاح' },
  REPAIR_IN_PROGRESS: { en: 'Repair in progress', ar: 'الإصلاح جارٍ' },
  REPAIR_VERIFIED: { en: 'Repair verified', ar: 'تم التحقق من الإصلاح' },
  INCONCLUSIVE: { en: 'Inconclusive', ar: 'النتيجة غير حاسمة' },
  ADMIN_REQUIRED: { en: 'Admin required', ar: 'يلزم المدير' },
  ENGINE_OFFLINE: { en: 'Engine offline', ar: 'المحرك مفصول' },
};

const KIND_COPY: Record<string, { en: string; ar: string }> = {
  ethernet: { en: 'Ethernet', ar: 'إيثرنت' },
  wifi: { en: 'Wi-Fi', ar: 'واي فاي' },
  virtual: { en: 'Virtual / VPN', ar: 'افتراضي / VPN' },
  loopback: { en: 'Loopback', ar: 'حلقي' },
  other: { en: 'Other', ar: 'أخرى' },
};

function errorMessage(error: unknown, lang: Lang): string {
  const text = COPY[lang];
  if (error instanceof BridgeError) {
    switch (error.code) {
      case 'RUN_IN_PROGRESS': return text.errInProgress;
      case 'ELEVATION_REQUIRED': return text.errElevation;
      case 'CONFIRMATION_REQUIRED':
      case 'CONFIRMATION_PHRASE_REQUIRED': return text.errConfirmation;
      case 'MODE_NOT_SUPPORTED': return text.errMode;
      case 'UNKNOWN_TOOL': return text.errUnknown;
      case 'BRIDGE_UNREACHABLE':
      case 'BRIDGE_UNAVAILABLE': return text.errOffline;
      case 'TIMEOUT': return text.errTimeout;
      default: return `${text.errGeneric} [${error.code}]`;
    }
  }
  return error instanceof Error ? error.message : text.errGeneric;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function NetworkStation({
  lang, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus,
}: NetworkStationProps) {
  const text = COPY[lang];
  const station = useMemo(() => stationTools(tools), [tools]);
  const byId = useMemo(() => new Map(station.map((tool) => [tool.ToolId, tool])), [station]);

  const [evidence, setEvidence] = useState<DiagnoseEvidence>(() => emptyEvidence());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [lines, setLines] = useState<Array<{ t: string; s: string; text: string }>>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [pending, setPending] = useState<{ tool: BridgeTool; mode: ExecutionMode; options?: ToolRunOptions } | null>(null);
  const [banner, setBanner] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [elevated, setElevated] = useState(bridgeElevated);
  const [verifyPair, setVerifyPair] = useState<{
    toolId: string;
    before: { gateway: string; dnsOk: boolean | null; internetOk: boolean | null };
    after: { gateway: string; dnsOk: boolean | null; internetOk: boolean | null } | null;
  } | null>(null);
  const pollTimer = useRef<number | null>(null);
  const lastCount = useRef(0);

  useEffect(() => { setElevated(bridgeElevated); }, [bridgeElevated]);
  useEffect(() => () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); }, []);
  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - activeRun.startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [activeRun]);

  const runningIds = useMemo(() => (activeRun ? [activeRun.toolId] : []), [activeRun]);
  const layers = useMemo(() => deriveLayerStates(evidence, runningIds), [evidence, runningIds]);
  const failingLayer = useMemo(() => firstFailedLayer(layers), [layers]);
  const recommendations = useMemo(() => buildRecommendations(evidence, station), [evidence, station]);
  const outcomes = useMemo(() => Object.values(evidence.outcomes), [evidence]);

  const recordOutcome = useCallback((outcome: ToolOutcome, kind: HistoryEntry['kind'], finding: string) => {
    setEvidence((current) => {
      const next: DiagnoseEvidence = { ...current, outcomes: { ...current.outcomes, [outcome.toolId]: outcome } };
      if (outcome.toolId === 'NI01') next.ni01 = parseNi01Lines(outcome.lines);
      if (outcome.toolId === 'NI06') next.ni06 = parseNi06Lines(outcome.lines);
      return next;
    });
    setHistory((current) =>
      appendHistory(current, {
        kind, toolId: outcome.toolId, mode: outcome.mode, status: outcome.status, finding,
        changedSystem: outcome.changedSystem, restartNeeded: outcome.restartNeeded,
        verification: outcome.verificationResult, reportPath: outcome.reportPath, finishedAt: outcome.finishedAt,
      }),
    );
    const mapped = outcome.status === 'SUCCESS' ? 'success' : outcome.status === 'FAILED' ? 'error' : outcome.status === 'CANCELLED' ? 'cancelled' : outcome.status === 'INCONCLUSIVE' ? 'inconclusive' : 'error';
    onToolStatus(outcome.toolId, mapped as 'success' | 'error' | 'cancelled' | 'inconclusive');
  }, [onToolStatus]);

  const executeStep = useCallback(async (toolId: string, mode: ExecutionMode, confirmation?: ToolRunConfirmation): Promise<ToolOutcome> => {
    const tool = byId.get(toolId);
    if (!tool) throw new BridgeError(404, 'UNKNOWN_TOOL', text.toolMissing);
    const decision = decideExecution({ tool, mode, confirmation }, elevated);
    if (!decision.ok) {
      if (decision.nextState === 'WAITING_FOR_CONFIRMATION') throw new BridgeError(403, 'CONFIRMATION_REQUIRED', decision.reason || text.errConfirmation);
      if (decision.nextState === 'WAITING_FOR_ELEVATION') throw new BridgeError(403, 'ELEVATION_REQUIRED', decision.reason || text.errElevation);
      throw new BridgeError(423, 'WINRE_ONLY_ONLINE_BLOCKED', decision.reason || text.errMode);
    }
    const runId = await startExecution({ tool, mode, options: {}, confirmation });
    const startedAt = Date.now();
    setActiveRun({ runId, toolId, mode, startedAt });
    setElapsedMs(0);
    setLines([]);
    lastCount.current = 0;
    onToolStatus(toolId, 'running');
    try {
      for (;;) {
        const run: BridgeRun = await pollExecution(runId);
        const fresh = run.lines.slice(lastCount.current);
        if (fresh.length > 0) {
          lastCount.current = run.lines.length;
          setLines((current) => [...current, ...fresh].slice(-500));
        }
        if (run.status !== 'running') return outcomeFromRun(run);
        await new Promise((resolve) => { pollTimer.current = window.setTimeout(resolve, 700); });
      }
    } finally {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      setActiveRun(null);
    }
  }, [byId, elevated, onToolStatus, text]);

  const runDiagnose = useCallback(async () => {
    setBanner('');
    setDiagnosing(true);
    try {
      // Layer 1-2: structured adapter evidence (read-only, no confirmation needed).
      try {
        const { preview } = await api.networkPreview();
        const adapters = (preview.Adapters || []) as PreviewAdapter[];
        setEvidence((current) => ({ ...current, adapters }));
        setHistory((current) =>
          appendHistory(current, {
            kind: 'diagnose', toolId: 'NI11', mode: 'run', status: 'SUCCESS',
            finding: `${adapters.length} adapters`, changedSystem: false, restartNeeded: false,
            verification: '', reportPath: '', finishedAt: new Date().toISOString(),
          }),
        );
        onToolStatus('NI11', 'success');
      } catch (error) {
        setBanner(errorMessage(error, lang));
      }
      // Layers 3-6: measurement tools in path order (single source: diagnosePlan).
      const steps: Array<{ toolId: string; kind: HistoryEntry['kind'] }> = diagnosePlan(station)
        .filter((step) => step.toolId !== 'NI11')
        .map((step) => ({ toolId: step.toolId, kind: 'diagnose' as const }));
      for (const step of steps) {
        if (!byId.has(step.toolId)) continue;
        try {
          const outcome = await executeStep(step.toolId, 'run');
          recordOutcome(outcome, step.kind, outcome.status);
        } catch (error) {
          setBanner(`[${step.toolId}] ${errorMessage(error, lang)}`);
        }
      }
    } finally {
      setDiagnosing(false);
    }
  }, [byId, executeStep, lang, onToolStatus, recordOutcome]);

  const runSingle = useCallback(async (toolId: string, mode: ExecutionMode, confirmation?: ToolRunConfirmation, verify = false) => {
    setBanner('');
    const beforeSnapshot = evidence.ni01
      ? { gateway: evidence.ni01.gateway, dnsOk: evidence.ni01.dnsOk, internetOk: evidence.ni01.internetOk }
      : null;
    try {
      const outcome = await executeStep(toolId, mode, confirmation);
      recordOutcome(outcome, outcome.changedSystem ? 'repair' : 'diagnose', outcome.status);
      if (verify && beforeSnapshot && ['NI02', 'NI03', 'NI05'].includes(toolId) && byId.has('NI01')) {
        try {
          const retest = await executeStep('NI01', 'run');
          const facts = parseNi01Lines(retest.lines);
          setVerifyPair({
            toolId,
            before: beforeSnapshot,
            after: { gateway: facts.gateway, dnsOk: facts.dnsOk, internetOk: facts.internetOk },
          });
          recordOutcome(retest, 'verify', retest.status);
        } catch (error) {
          setBanner(`[NI01 re-test] ${errorMessage(error, lang)}`);
        }
      } else if (verify && beforeSnapshot) {
        setVerifyPair({ toolId, before: beforeSnapshot, after: null });
      }
    } catch (error) {
      setBanner(errorMessage(error, lang));
      onToolStatus(toolId, 'error');
    }
  }, [evidence, byId, executeStep, lang, onToolStatus, recordOutcome]);

  const cancelActive = useCallback(async () => {
    if (!activeRun) return;
    try { await cancelExecution(activeRun.runId); } catch (error) { setBanner(errorMessage(error, lang)); }
  }, [activeRun, lang]);

  const recheckElevation = useCallback(async () => {
    setBanner('');
    try {
      const healthCheck = await api.health();
      setElevated(healthCheck.elevated);
      if (!healthCheck.elevated) setBanner(text.errElevation);
    } catch (error) {
      setBanner(errorMessage(error, lang));
    }
  }, [lang, text]);

  const downloadReport = useCallback(() => {
    const report = buildNetworkReport({
      adapters: evidence.adapters, ni01: evidence.ni01, ni06: evidence.ni06,
      outcomes, history,
      before: verifyPair ? verifyPair.before : null,
      after: verifyPair ? verifyPair.after : null,
      lang,
    });
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knoux-network-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [evidence, outcomes, history, verifyPair, lang]);

  const lastOutcomeByTool = useMemo(() => {
    const map: Record<string, ToolOutcome> = {};
    for (const outcome of outcomes) map[outcome.toolId] = outcome;
    return map;
  }, [outcomes]);

  const globalStatus = useCallback((tool: BridgeTool | null | undefined): string => {
    if (!tool) return text.unavailable;
    const outcome = lastOutcomeByTool[tool.ToolId];
    if (outcome) return `${outcome.status}${outcome.verificationResult ? ` · ${outcome.verificationResult}` : ''}`;
    const global = toolStatuses[tool.ToolId];
    return global ? global.toUpperCase() : text.notChecked;
  }, [lastOutcomeByTool, toolStatuses, text]);

  if (bridgeOnline === false) {
    return <StationOfflineState lang={lang} reason={text.engineOffline} onRetry={onRetryBridge} />;
  }

  const activeTool = activeRun ? byId.get(activeRun.toolId) : null;
  const primaryAdapter = evidence.adapters.find((a) => a.Gateway && a.IPv4) || evidence.adapters[0] || null;

  return (
    <StationErrorBoundary>
      <div className="network-station" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {banner && (
          <div className="network-banner" role="alert">
            <CircleAlert size={15} />
            <span dir="auto">{banner}</span>
            <button type="button" onClick={() => setBanner('')} aria-label={text.close}><X size={13} /></button>
          </div>
        )}
        <p className="network-scope-note"><ShieldCheck size={12} />{text.bridgeVsInternet}</p>

        {/* ── Connection path hero ── */}
        <section className="network-hero" aria-live="polite" aria-label={text.pathTitle}>
          <div className="network-hero-copy">
            <p className="eyebrow"><Waypoints size={13} />{text.eyebrow}</p>
            <h2>{text.title}</h2>
            <p className="network-failing" role="status" dir="auto">
              {failingLayer
                ? `${LAYER_COPY[failingLayer][lang]}: ${LAYER_STATE_COPY[layers[failingLayer]][lang]}`
                : evidence.adapters.length > 0 || evidence.ni01
                  ? (lang === 'ar' ? 'لا توجد طبقة فاشلة مؤكدة' : 'No confidently failed layer')
                  : text.notChecked}
            </p>
            <p className="network-sub">{text.subtitle}</p>
            <div className="network-hero-actions">
              <button
                type="button" className="network-primary" onClick={() => void runDiagnose()}
                disabled={diagnosing || activeRun !== null} aria-label={text.diagnose}
              >
                {diagnosing || activeRun ? <LoaderCircle size={15} className="animate-spin" /> : <ScanSearch size={15} />}
                {diagnosing ? text.diagnosing : text.diagnose}
              </button>
              {activeRun && (
                <button type="button" className="network-ghost" onClick={() => void cancelActive()}>
                  <Square size={13} />{text.cancel}
                </button>
              )}
            </div>
          </div>
          <ol className="network-path">
            {(['adapter', 'ip', 'gateway', 'dns', 'internet'] as const).map((layer, index, list) => (
              <li key={layer} className={`network-node is-${layers[layer].toLowerCase().replace(/_/g, '-')}`}>
                <span className="network-node-index" aria-hidden="true">{index + 1}</span>
                <strong>{LAYER_COPY[layer][lang]}</strong>
                <small>{LAYER_STATE_COPY[layers[layer]][lang]}</small>
                {index < list.length - 1 && <i className="network-link" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Adapters & IP ── */}
        <section aria-label={text.adaptersTitle}>
          <div className="app-section-title"><div><p>{text.eyebrow}</p><h2>{text.adaptersTitle}</h2></div></div>
          {evidence.adapters.length === 0 ? (
            <p className="network-empty">{text.notChecked}</p>
          ) : (
            <div className="network-adapters">
              {evidence.adapters.map((adapter, index) => {
                const kind = classifyAdapter(adapter.Description);
                const isPrimary = primaryAdapter === adapter;
                return (
                  <article key={`${adapter.MacAddress || index}-${index}`} className={`network-adapter is-${kind}${isPrimary ? ' is-primary' : ''}`}>
                    <header>
                      <Wifi size={16} />
                      <strong dir="auto">{adapter.Description || `Adapter ${index + 1}`}</strong>
                      <span className="network-kind">{KIND_COPY[kind][lang]}</span>
                      {isPrimary && <span className="network-primary-tag">{lang === 'ar' ? 'محول الشبكة النشط' : 'Active adapter · primary path'}</span>}
                    </header>
                    <dl>
                      <div><dt>IPv4</dt><dd dir="ltr">{adapter.IPv4 || text.unavailable}</dd></div>
                      <div><dt>{lang === 'ar' ? 'البوابة' : 'Gateway'}</dt><dd dir="ltr">{adapter.Gateway || text.unavailable}</dd></div>
                      <div><dt>DNS</dt><dd dir="ltr">{(adapter.DNS || []).join(', ') || text.unavailable}</dd></div>
                      <div><dt>DHCP</dt><dd>{adapter.DHCP ? text.yes : text.no}</dd></div>
                      <div><dt>MAC</dt><dd dir="ltr">{adapter.MacAddress || text.unavailable}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Layer evidence ── */}
        <section aria-label={text.layersTitle}>
          <div className="app-section-title"><div><p>{text.pathTitle}</p><h2>{text.layersTitle}</h2></div></div>
          <div className="network-layers">
            <article>
              <strong>{LAYER_COPY.gateway[lang]}</strong>
              <p dir="ltr">{evidence.ni01?.gateway || text.unavailable}</p>
              <small>{evidence.ni01 ? LAYER_STATE_COPY[layers.gateway][lang] : text.notChecked}</small>
            </article>
            <article>
              <strong>{LAYER_COPY.dns[lang]}</strong>
              <p dir="ltr">
                {evidence.ni01 && evidence.ni01.dnsOk !== null
                  ? (evidence.ni01.dnsOk ? (lang === 'ar' ? 'يُحَل' : 'Resolves') : (lang === 'ar' ? 'يفشل' : 'Fails'))
                  : text.notMeasured}
              </p>
              <small>{evidence.ni01 ? LAYER_STATE_COPY[layers.dns][lang] : text.notChecked}</small>
            </article>
            <article>
              <strong>{LAYER_COPY.internet[lang]}</strong>
              <p dir="ltr">
                {evidence.ni01 && evidence.ni01.internetOk !== null
                  ? (evidence.ni01.internetOk ? '8.8.8.8 reachable' : '8.8.8.8 unreachable')
                  : text.notMeasured}
              </p>
              <small>{evidence.ni01 ? LAYER_STATE_COPY[layers.internet][lang] : text.notChecked}</small>
            </article>
            <article>
              <strong>{LAYER_COPY.quality[lang]}</strong>
              <p dir="ltr">
                {evidence.ni06 && evidence.ni06.measured
                  ? `loss ${evidence.ni06.lossPercent}% · avg ${formatMs(evidence.ni06.avgMs, lang)} · n=${evidence.ni06.attempts}`
                  : text.notMeasured}
              </p>
              <small>{evidence.ni06 ? LAYER_STATE_COPY[layers.quality][lang] : text.notChecked} · {lang === 'ar' ? 'فقد الحزم' : 'Packet loss'}</small>
            </article>
            <article>
              <strong>{LAYER_COPY.routing[lang]}</strong>
              <p dir="ltr">{evidence.ni01?.gateway || primaryAdapter?.Gateway || text.unavailable}</p>
              <small>
                {layers.routing === 'CONFIGURED'
                  ? (lang === 'ar' ? 'بوابة افتراضية مهيأة — لم تُتحقق بعد' : 'Default route configured — not verified by measurement')
                  : (lang === 'ar' ? 'البوابة الافتراضية فقط' : 'Default gateway only')}
              </small>
            </article>
            <article>
              <strong>Proxy</strong>
              <p>{lang === 'ar' ? 'غير مدعوم من الأدوات' : 'Unsupported by tools'}</p>
              <small>{text.notMeasured}</small>
            </article>
          </div>
        </section>

        {/* ── Live execution ── */}
        {activeRun && activeTool && (
          <section className="network-live" role="status" aria-live="polite">
            <div className="network-live-head">
              <LoaderCircle size={16} className="animate-spin" />
              <strong dir="auto">{activeRun.toolId} · {activeRun.mode}</strong>
              <span><Clock size={12} />{text.elapsed} {formatElapsed(elapsedMs)}</span>
              <button type="button" className="network-ghost" onClick={() => void cancelActive()}><Square size={12} />{text.cancel}</button>
              <button type="button" className="network-ghost" onClick={() => setShowRaw((v) => !v)}>{showRaw ? text.hideRaw : text.rawLog}</button>
            </div>
            <div className="network-progress" role="progressbar" aria-valuetext={`${activeRun.toolId} ${activeRun.mode}`}>
              <i className="is-indeterminate" />
            </div>
            {showRaw && (
              <div className="network-rawlog">
                {lines.slice(-200).map((line, index) => (
                  <p key={index} className={line.s === 'err' ? 'is-error' : ''} dir="auto">{line.text}</p>
                ))}
                {lines.length === 0 && <p className="is-empty">…</p>}
              </div>
            )}
          </section>
        )}

        {/* ── Findings + recommendations ── */}
        {(failingLayer || recommendations.length > 0) && (
          <section aria-label={text.findingsTitle}>
            <div className="app-section-title"><div><p>{text.findingsTitle}</p><h2>{text.findingsTitle}</h2></div></div>
            <div className="network-recs">
              {recommendations.map((rec) => {
                const tool = byId.get(rec.toolId);
                if (!tool) return null;
                const blocked = tool.RequiresAdmin && !elevated;
                return (
                  <article key={rec.id} className="network-rec">
                    <AlertTriangle size={18} />
                    <div>
                      <strong dir="auto">{lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName}</strong>
                      <p dir="auto">{lang === 'ar' ? rec.reasonAr : rec.reasonEn}</p>
                      {blocked && <small className="is-permission"><LockKeyhole size={11} />{text.permissionTitle}</small>}
                    </div>
                    <button
                      type="button" className="network-primary" disabled={blocked || activeRun !== null}
                      onClick={() => setPending({ tool, mode: rec.mode })}
                    >
                      {text.reviewRun}<ArrowRight size={13} className="rtl:rotate-180" />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Repair ladder ── */}
        <section aria-label={text.ladderTitle}>
          <div className="app-section-title"><div><p>{text.ladderTitle}</p><h2>{text.ladderTitle}</h2></div></div>
          <p className="network-sub">{lang === 'ar' ? 'إصلاح الاتصال بتدرج مثبت بالأدلة: تحديث، ثم DNS، ثم DHCP، ثم Winsock، ثم الشامل.' : 'Evidence-graded connection repair: refresh, then DNS, then DHCP, then Winsock, then full reset.'}</p>
          <ol className="network-ladder">
            {REPAIR_LADDER.map((step) => {
              const tool = byId.get(step.toolId);
              if (!tool) return null;
              const blocked = tool.RequiresAdmin && !elevated;
              const lastResort = step.level === 5;
              return (
                <li key={`${step.level}-${step.toolId}`} className={`network-rung${lastResort ? ' is-last-resort' : ''}`}>
                  <span className="network-level">{text.level} {step.level}</span>
                  <div>
                    <strong dir="auto">{lang === 'ar' ? step.titleAr : step.titleEn} · {step.toolId}</strong>
                    <p dir="auto">{lang === 'ar' ? step.impactAr : step.impactEn}</p>
                    <small dir="auto">
                      {tool.RiskLevel}{tool.RequiresAdmin ? ' · Admin' : ''}{tool.RequiresRestart ? ` · ${text.restart}` : ''}
                      {lastResort ? ` · ${text.lastResort}` : ''}
                    </small>
                    {blocked && <small className="is-permission"><LockKeyhole size={11} />{text.permissionTitle}</small>}
                  </div>
                  <button
                    type="button" className="network-ghost" disabled={blocked || activeRun !== null}
                    onClick={() => setPending({ tool, mode: 'run' })}
                  >
                    <Play size={11} />{text.run}
                  </button>
                </li>
              );
            })}
          </ol>
          {!elevated && (
            <div className="network-permission">
              <LockKeyhole size={16} />
              <div><strong>{text.permissionTitle}</strong><p>{text.elevateHelp}</p></div>
              <button type="button" className="network-ghost" onClick={() => void recheckElevation()}><RefreshCw size={12} />{text.elevationRetry}</button>
            </div>
          )}
        </section>

        {/* ── Operations (all 11) ── */}
        <section aria-label={text.opsTitle}>
          <div className="app-section-title"><div><p>{STATION03_TOOL_IDS.length} · 03</p><h2>{text.opsTitle}</h2></div></div>
          <div className="network-ops">
            {station.map((tool) => {
              const runBlocked = tool.RequiresAdmin && !elevated;
              return (
                <article key={tool.ToolId} className="network-op">
                  <header>
                    <span className="network-op-id">{tool.ToolId}</span>
                    <strong dir="auto">{pickName(tool, lang)}</strong>
                    <span className={`network-risk is-${tool.RiskLevel.toLowerCase().replace(/_/g, '-')}`}>{tool.RiskLevel}</span>
                  </header>
                  <p dir="auto">{tool.Purpose}</p>
                  <dl className="network-op-meta">
                    <div><dt>{text.lastResult}</dt><dd dir="auto">{globalStatus(tool)}</dd></div>
                    <div><dt>{text.risk}</dt><dd dir="auto">{tool.RiskLevel}</dd></div>
                    <div><dt>{text.admin}</dt><dd>{tool.RequiresAdmin ? text.yes : text.no}</dd></div>
                  </dl>
                  <div className="network-op-actions">
                    {tool.AnalyzeOnlySupported && (
                      <button type="button" disabled={activeRun !== null} onClick={() => setPending({ tool, mode: 'analyze' })}>{text.analyze}</button>
                    )}
                    {tool.WhatIfSupported && (
                      <button type="button" disabled={activeRun !== null} onClick={() => setPending({ tool, mode: 'preview' })}>{text.preview}</button>
                    )}
                    <button
                      type="button" className="is-run" disabled={activeRun !== null || runBlocked}
                      onClick={() => setPending({ tool, mode: 'run' })}
                      title={runBlocked ? text.permissionTitle : undefined}
                    >
                      <Play size={11} />{text.run}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {station.length === 0 && <p className="network-empty" role="status">{text.unavailable}</p>}
        </section>

        {/* ── Before / after verification ── */}
        {verifyPair && (
          <section aria-label={text.verifyTitle}>
            <div className="app-section-title">
              <div><p>{text.verifyTitle}</p><h2>{text.verifyTitle}</h2></div>
              <button type="button" className="network-ghost" onClick={() => void runSingle('NI01', 'run')} disabled={activeRun !== null}>
                <RefreshCw size={12} />{text.retest}
              </button>
            </div>
            <div className="network-verify">
              <dl>
                <div><dt>gw {lang === 'ar' ? 'قبل' : 'before'}</dt><dd dir="ltr">{verifyPair.before.gateway || '—'}</dd></div>
                <div><dt>dns {lang === 'ar' ? 'قبل' : 'before'}</dt><dd dir="ltr">{String(verifyPair.before.dnsOk)}</dd></div>
                <div><dt>net {lang === 'ar' ? 'قبل' : 'before'}</dt><dd dir="ltr">{String(verifyPair.before.internetOk)}</dd></div>
                <div><dt>gw {lang === 'ar' ? 'بعد' : 'after'}</dt><dd dir="ltr">{verifyPair.after?.gateway || text.notMeasured}</dd></div>
                <div><dt>dns {lang === 'ar' ? 'بعد' : 'after'}</dt><dd dir="ltr">{verifyPair.after ? String(verifyPair.after.dnsOk) : text.notMeasured}</dd></div>
                <div><dt>net {lang === 'ar' ? 'بعد' : 'after'}</dt><dd dir="ltr">{verifyPair.after ? String(verifyPair.after.internetOk) : text.notMeasured}</dd></div>
              </dl>
              <p className="network-verify-note">
                {verifyPair.after
                  ? (verifyPair.after.internetOk === true && verifyPair.before.internetOk !== true
                    ? (lang === 'ar' ? 'تمت استعادة الاتصال' : 'Connection restored')
                    : text.commandVsRestored)
                  : text.restartToVerify}
              </p>
            </div>
          </section>
        )}

        {/* ── Evidence + history ── */}
        <section aria-label={text.evidenceTitle}>
          <div className="app-section-title">
            <div><p>{text.historyTitle}</p><h2>{text.evidenceTitle}</h2></div>
            <button type="button" className="network-ghost" onClick={downloadReport} disabled={history.length === 0 && outcomes.length === 0}>
              <Download size={13} />{text.reportDownload}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="network-empty">{text.emptyHistory}</p>
          ) : (
            <div className="network-history-wrap">
              <table className="network-history">
                <thead><tr>
                  <th>{text.historyCols.when}</th><th>{text.historyCols.kind}</th><th>{text.historyCols.tool}</th>
                  <th>{text.historyCols.mode}</th><th>{text.historyCols.result}</th><th>{text.historyCols.finding}</th>
                  <th>{text.historyCols.changed}</th><th>{text.historyCols.restart}</th>
                  <th>{text.historyCols.verify}</th><th>{text.historyCols.report}</th>
                </tr></thead>
                <tbody>
                  {history.slice(0, 30).map((entry, index) => (
                    <tr key={`${entry.toolId}-${entry.finishedAt}-${index}`}>
                      <td dir="ltr">{entry.finishedAt || '—'}</td><td>{entry.kind}</td>
                      <td><strong>{entry.toolId}</strong></td><td>{entry.mode}</td>
                      <td><span className={`is-${entry.status.toLowerCase()}`}>{entry.status}</span></td>
                      <td dir="auto">{entry.finding || '—'}</td>
                      <td>{entry.changedSystem ? text.yes : text.no}</td><td>{entry.restartNeeded ? text.yes : text.no}</td>
                      <td dir="auto">{entry.verification || '—'}</td>
                      <td dir="ltr">{entry.reportPath ? <FileText size={11} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activeRun === null && lines.length > 0 && (
            <div className="network-rawlog is-settled">
              {lines.slice(-200).map((line, index) => (
                <p key={index} className={line.s === 'err' ? 'is-error' : ''} dir="auto">{line.text}</p>
              ))}
            </div>
          )}
        </section>

        {/* ── Single-operation confirmation ── */}
        {pending && (
          <ExecutionConfirmDialog
            tool={pending.tool} mode={pending.mode} lang={lang} initialOptions={pending.options}
            onCancel={() => setPending(null)}
            onConfirm={(_options, confirmation) => {
              setPending(null);
              const needsVerify = ['NI02', 'NI03', 'NI05'].includes(pending.tool.ToolId) && pending.mode === 'run';
              void runSingle(pending.tool.ToolId, pending.mode, confirmation, needsVerify);
            }}
          />
        )}
      </div>
    </StationErrorBoundary>
  );
}
