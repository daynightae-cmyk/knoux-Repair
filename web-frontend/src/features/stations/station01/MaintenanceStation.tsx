import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, CircleAlert, Clock, Download,
  FileText, HeartPulse, History, LoaderCircle, LockKeyhole, Play, RefreshCw, ScanSearch,
  Square, X,
} from 'lucide-react';
import type { BridgeRun, BridgeTool, ExecutionMode, SystemSnapshot, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api, BridgeError } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import {
  StationErrorBoundary, StationOfflineState, StationPermissionGate,
} from '../_shared';
import {
  decideExecution, startExecution, pollExecution, cancelExecution, runStatusToState,
} from '../_shared/StationExecutionController';
import {
  appendHistory, buildMaintenanceReport, buildRecommendations, deriveHealthState, derivePhaseState,
  evidenceFromRun, loadHistory, PIPELINE_PHASES, quickDiagnosePlan, stationTools,
  STATION01_TOOL_IDS,
  type EvidenceMap, type HealthState, type HistoryEntry, type PhaseState, type ToolEvidence,
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

interface ActiveRun {
  runId: string;
  toolId: string;
  mode: ExecutionMode;
  startedAt: number;
}

const COPY = {
  en: {
    eyebrow: 'HEALTH STUDIO', title: 'Device Health', subtitle: 'Windows integrity & repair center — real checks, real evidence.',
    checkHealth: 'Check Windows Health', checking: 'Checking…', cancel: 'Cancel',
    pipelineTitle: 'Integrity pipeline', pipelineSub: 'Each phase maps to the real registered tool that measures it.',
    findingsTitle: 'Findings', recommendTitle: 'Recommended actions', opsTitle: 'Specialized operations',
    evidenceTitle: 'Evidence center', historyTitle: 'Station history', reportDownload: 'Download maintenance report',
    notScanned: 'Not scanned', unavailable: 'Unavailable', retry: 'Retry', close: 'Close',
    analyze: 'Analyze', preview: 'What-if', run: 'Run', reviewRun: 'Review & run',
    rawLog: 'Raw log', hideRaw: 'Hide raw log', elapsed: 'Elapsed',
    emptyHistory: 'No station runs yet. Evidence from real runs will appear here.',
    confirmPlan: 'Review the diagnose plan', planBody: 'Two safe steps, in order. Nothing is repaired by this plan.',
    planPhrase: 'Type CONFIRM to authorize the verify step', planConfirm: 'Start diagnosis', planCancel: 'Go back',
    permissionTitle: 'Administrator permission required', elevationRetry: 'Re-check permission',
    elevateHelp: 'Most integrity checks read protected Windows state. Restart the local bridge elevated (start-bridge-admin.cmd), then re-check.',
    modeLabel: 'Mode', lastResult: 'Last result', risk: 'Risk', admin: 'Admin', restart: 'Restart',
    changedSystem: 'Changed system', verification: 'Verification', report: 'Report',
    repairVerified: 'Repair verified', commandFinished: 'Command finished — verification pending', stepOf: 'Step',
    toolMissing: 'Registered tool is missing from the runtime registry.',
    errInProgress: 'Another tool is currently running. Wait for it to finish or cancel it first.',
    errElevation: 'This operation requires Administrator privileges.',
    errConfirmation: 'Explicit confirmation is required before execution.',
    errMode: 'This mode is not supported by the selected tool.',
    errUnknown: 'Unknown tool. Only registered manifest tools can run.',
    errOffline: 'The local execution bridge is unavailable.',
    errTimeout: 'The operation exceeded its time limit.',
    errGeneric: 'The operation could not complete.',
    winreBlocked: 'This tool requires WinRE and cannot run as a normal online repair.',
    historyCols: { when: 'When', tool: 'Tool', mode: 'Mode', result: 'Result', changed: 'Changed', restart: 'Restart', verify: 'Verify', report: 'Report' },
    yes: 'Yes', no: 'No',
  },
  ar: {
    eyebrow: 'استوديو الصحة', title: 'صحة الجهاز', subtitle: 'مركز سلامة ويندوز وإصلاحه — فحوص حقيقية وأدلة حقيقية.',
    checkHealth: 'فحص صحة ويندوز', checking: 'جارٍ الفحص…', cancel: 'إيقاف',
    pipelineTitle: 'مسار السلامة', pipelineSub: 'كل مرحلة مرتبطة بالأداة المسجلة التي تقيسها فعلاً.',
    findingsTitle: 'النتائج', recommendTitle: 'إجراءات مقترحة', opsTitle: 'عمليات متخصصة',
    evidenceTitle: 'مركز الأدلة', historyTitle: 'سجل المحطة', reportDownload: 'تنزيل تقرير الصيانة',
    notScanned: 'لم يُفحص بعد', unavailable: 'غير متاح', retry: 'إعادة المحاولة', close: 'إغلاق',
    analyze: 'تحليل', preview: 'معاينة', run: 'تشغيل', reviewRun: 'مراجعة وتشغيل',
    rawLog: 'السجل الخام', hideRaw: 'إخفاء السجل', elapsed: 'المدة',
    emptyHistory: 'لا توجد تشغيلات بعد. ستظهر هنا أدلة التشغيل الحقيقي.',
    confirmPlan: 'مراجعة خطة الفحص', planBody: 'خطوتان آمنتان بالترتيب. هذه الخطة لا تُصلح شيئاً.',
    planPhrase: 'اكتب تأكيد لتفويض خطوة التحقق', planConfirm: 'بدء الفحص', planCancel: 'رجوع',
    permissionTitle: 'تتطلب صلاحية المدير', elevationRetry: 'إعادة التحقق من الصلاحية',
    elevateHelp: 'معظم فحوص السلامة تقرأ حالة ويندوز المحمية. أعد تشغيل الجسر المحلي بصلاحية المدير ثم أعد التحقق.',
    modeLabel: 'الوضع', lastResult: 'آخر نتيجة', risk: 'المخاطر', admin: 'المدير', restart: 'إعادة التشغيل',
    changedSystem: 'غيّر النظام', verification: 'التحقق', report: 'التقرير',
    repairVerified: 'تم التحقق من الإصلاح', commandFinished: 'انتهى الأمر — التحقق معلّق', stepOf: 'خطوة',
    toolMissing: 'الأداة المسجلة غير موجودة في سجل التشغيل.',
    errInProgress: 'هناك أداة تعمل حالياً. انتظر انتهاءها أو أوقفها أولاً.',
    errElevation: 'تتطلب هذه العملية صلاحيات المدير.',
    errConfirmation: 'يلزم تأكيد صريح قبل التنفيذ.',
    errMode: 'هذا الوضع غير مدعوم للأداة المختارة.',
    errUnknown: 'أداة غير معروفة. تعمل فقط الأدوات المسجلة.',
    errOffline: 'الجسر المحلي غير متاح.',
    errTimeout: 'تجاوزت العملية الحد الزمني.',
    errGeneric: 'تعذر إكمال العملية.',
    winreBlocked: 'تتطلب هذه الأداة بيئة WinRE ولا تعمل كإصلاح عادي.',
    historyCols: { when: 'الوقت', tool: 'الأداة', mode: 'الوضع', result: 'النتيجة', changed: 'غيّر', restart: 'إعادة', verify: 'التحقق', report: 'التقرير' },
    yes: 'نعم', no: 'لا',
  },
} as const;

const PHASE_COPY: Record<string, { en: string; ar: string }> = {
  files: { en: 'System Files', ar: 'ملفات النظام' },
  store: { en: 'Component Store', ar: 'مخزن المكونات' },
  image: { en: 'Windows Image', ar: 'صورة ويندوز' },
  disk: { en: 'Disk / Filesystem', ar: 'القرص / نظام الملفات' },
  servicing: { en: 'Servicing & Update', ar: 'الخدمة والتحديث' },
};

const HEALTH_COPY: Record<HealthState, { en: string; ar: string }> = {
  NOT_SCANNED: { en: 'Not scanned', ar: 'لم يُفحص بعد' },
  CHECKING: { en: 'Checking', ar: 'جارٍ الفحص' },
  HEALTHY: { en: 'Healthy', ar: 'سليم' },
  ATTENTION: { en: 'Attention required', ar: 'يتطلب انتباهاً' },
  REPAIR_RECOMMENDED: { en: 'Repair recommended', ar: 'يُنصح بالإصلاح' },
  REPAIR_IN_PROGRESS: { en: 'Repair in progress', ar: 'الإصلاح جارٍ' },
  RESTART_REQUIRED: { en: 'Restart required', ar: 'يلزم إعادة التشغيل' },
  INCONCLUSIVE: { en: 'Inconclusive', ar: 'غير حاسم' },
  PERMISSION_REQUIRED: { en: 'Permission required', ar: 'يلزم إذن' },
  ENGINE_OFFLINE: { en: 'Engine offline', ar: 'المحرك مفصول' },
};

const PHASE_STATE_COPY: Record<PhaseState, { en: string; ar: string }> = {
  NOT_CHECKED: { en: 'Not checked', ar: 'لم تُفحص' },
  CHECKING: { en: 'Checking', ar: 'جارٍ الفحص' },
  PASSED: { en: 'Passed', ar: 'اجتاز' },
  WARNING: { en: 'Warning', ar: 'تحذير' },
  FAILED: { en: 'Failed', ar: 'فشل' },
  INCONCLUSIVE: { en: 'Inconclusive', ar: 'غير حاسم' },
  REPAIR_AVAILABLE: { en: 'Repair available', ar: 'إصلاح متاح' },
  REPAIR_COMPLETED: { en: 'Repair completed', ar: 'اكتمل الإصلاح' },
  RESTART_REQUIRED: { en: 'Restart required', ar: 'يلزم إعادة التشغيل' },
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
      case 'WINRE_ONLY_ONLINE_BLOCKED': return text.winreBlocked;
      default: return `${text.errGeneric} [${error.code}]`;
    }
  }
  return error instanceof Error ? error.message : text.errGeneric;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function MaintenanceStation({
  lang, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus,
}: MaintenanceStationProps) {
  const text = COPY[lang];
  const station = useMemo(() => stationTools(tools), [tools]);
  const byId = useMemo(() => new Map(station.map((tool) => [tool.ToolId, tool])), [station]);
  const [evidence, setEvidence] = useState<EvidenceMap>({});
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [lines, setLines] = useState<Array<{ t: string; s: string; text: string }>>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [pending, setPending] = useState<{ tool: BridgeTool; mode: ExecutionMode; options?: ToolRunOptions } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planPhrase, setPlanPhrase] = useState('');
  const [banner, setBanner] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [elevated, setElevated] = useState(bridgeElevated);
  const pollTimer = useRef<number | null>(null);
  const lastCount = useRef(0);

  useEffect(() => { setElevated(bridgeElevated); }, [bridgeElevated]);
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

  const runningIds = useMemo(() => (activeRun ? [activeRun.toolId] : []), [activeRun]);
  const health = useMemo(() => deriveHealthState(evidence, runningIds, bridgeOnline), [evidence, runningIds, bridgeOnline]);
  const recommendations = useMemo(() => buildRecommendations(evidence, station), [evidence, station]);
  const plan = useMemo(() => quickDiagnosePlan(station), [station]);

  const recordEvidence = useCallback((run: BridgeRun) => {
    const item = evidenceFromRun(run);
    setEvidence((current) => ({ ...current, [item.toolId]: item }));
    setHistory((current) => appendHistory(current, item));
    const state = runStatusToState(run.status);
    onToolStatus(run.toolId, state === 'SUCCESS' ? 'success' : state === 'FAILED' ? 'error' : state === 'CANCELLED' ? 'cancelled' : state === 'INCONCLUSIVE' ? 'inconclusive' : 'error');
  }, [onToolStatus]);

  const executeStep = useCallback(async (toolId: string, mode: ExecutionMode, confirmation?: ToolRunConfirmation): Promise<ToolEvidence> => {
    const tool = byId.get(toolId);
    if (!tool) throw new BridgeError(404, 'UNKNOWN_TOOL', text.toolMissing);
    const decision = decideExecution({ tool, mode, confirmation }, elevated);
    if (!decision.ok) {
      if (decision.nextState === 'WAITING_FOR_CONFIRMATION') throw new BridgeError(403, 'CONFIRMATION_REQUIRED', decision.reason || text.errConfirmation);
      if (decision.nextState === 'WAITING_FOR_ELEVATION') throw new BridgeError(403, 'ELEVATION_REQUIRED', decision.reason || text.errElevation);
      throw new BridgeError(423, 'WINRE_ONLY_ONLINE_BLOCKED', decision.reason || text.winreBlocked);
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

  const runSingle = useCallback(async (toolId: string, mode: ExecutionMode, confirmation?: ToolRunConfirmation) => {
    setBanner('');
    try {
      await executeStep(toolId, mode, confirmation);
    } catch (error) {
      setBanner(errorMessage(error, lang));
      if (toolId) onToolStatus(toolId, 'error');
    }
  }, [executeStep, lang, onToolStatus]);

  const runDiagnosePlan = useCallback(async (phrase: string) => {
    setBanner('');
    setPlanOpen(false);
    const confirmation: ToolRunConfirmation = { confirmed: true, phrase, confirmedAt: new Date().toISOString() };
    for (let index = 0; index < plan.length; index += 1) {
      const step = plan[index];
      try {
        await executeStep(step.toolId, step.mode, confirmation);
      } catch (error) {
        setBanner(`[${step.toolId}] ${errorMessage(error, lang)}`);
      }
    }
  }, [executeStep, lang, plan]);

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
    const report = buildMaintenanceReport({
      evidence, history, health,
      osCaption: system?.Os || '', osBuild: system?.Build || '', lang,
    });
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knoux-maintenance-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [evidence, health, history, lang, system]);

  if (bridgeOnline === false) {
    return <StationOfflineState lang={lang} reason={text.errOffline} onRetry={onRetryBridge} />;
  }

  const healthTone = health === 'HEALTHY' ? 'is-healthy' : health === 'NOT_SCANNED' || health === 'CHECKING' ? 'is-idle' : health === 'INCONCLUSIVE' ? 'is-warning' : 'is-attention';
  const activeTool = activeRun ? byId.get(activeRun.toolId) : null;

  return (
    <StationErrorBoundary>
      <div className="maint-station" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {banner && (
          <div className="maint-banner" role="alert">
            <CircleAlert size={15} />
            <span dir="auto">{banner}</span>
            <button type="button" onClick={() => setBanner('')} aria-label={text.close}><X size={13} /></button>
          </div>
        )}

        {/* ── Hero: categorical health from evidence ── */}
        <section className={`maint-hero ${healthTone}`} aria-live="polite">
          <div className="maint-hero-copy">
            <p className="eyebrow"><HeartPulse size={13} />{text.eyebrow}</p>
            <h2>{text.title}</h2>
            <p className="maint-state" role="status">
              <span className={`maint-state-dot ${healthTone}`} aria-hidden="true" />
              {HEALTH_COPY[health][lang]}
            </p>
            <p className="maint-sub" dir="auto">
              {system ? `${system.Os || text.unavailable} · build ${system.Build || text.unavailable}` : text.unavailable}
            </p>
            <div className="maint-hero-actions">
              <button
                type="button" className="maint-primary" onClick={() => { setPlanPhrase(''); setPlanOpen(true); }}
                disabled={activeRun !== null || plan.length === 0}
                aria-label={text.checkHealth}
              >
                {activeRun ? <LoaderCircle size={15} className="animate-spin" /> : <ScanSearch size={15} />}
                {activeRun ? text.checking : text.checkHealth}
              </button>
              {activeRun && (
                <button type="button" className="maint-ghost" onClick={() => void cancelActive()}>
                  <Square size={13} />{text.cancel}
                </button>
              )}
            </div>
          </div>
          <dl className="maint-hero-facts">
            <div><dt>{lang === 'ar' ? 'آخر فحص' : 'Last scan'}</dt><dd dir="auto">{evidence.SM01 ? `${evidence.SM01.status}${evidence.SM01.verificationResult ? ` · ${evidence.SM01.verificationResult}` : ''}` : text.notScanned}</dd></div>
            <div><dt>{lang === 'ar' ? 'مخزن المكونات' : 'Component store'}</dt><dd dir="auto">{evidence.SM04 ? evidence.SM04.status : evidence.SM03 ? evidence.SM03.status : text.notScanned}</dd></div>
            <div><dt>{lang === 'ar' ? 'القرص' : 'Disk'}</dt><dd dir="auto">{evidence.SM06 ? evidence.SM06.status : text.notScanned}</dd></div>
            <div><dt>{lang === 'ar' ? 'إعادة التشغيل' : 'Restart'}</dt><dd>{Object.values(evidence).some((item) => item.restartNeeded) ? (lang === 'ar' ? 'مطلوبة' : 'Required') : (lang === 'ar' ? 'غير مطلوبة' : 'Not required')}</dd></div>
          </dl>
        </section>

        {/* ── Integrity pipeline ── */}
        <section aria-label={text.pipelineTitle}>
          <div className="app-section-title"><div><p>{text.eyebrow}</p><h2>{text.pipelineTitle}</h2></div></div>
          <p className="maint-section-sub">{text.pipelineSub}</p>
          <div className="maint-pipeline">
            {PIPELINE_PHASES.map((phase, index) => {
              const state = derivePhaseState(phase, evidence, runningIds);
              return (
                <article key={phase.id} className={`maint-phase is-${state.toLowerCase().replace(/_/g, '-')}`}>
                  <span className="maint-phase-index" aria-hidden="true">{index + 1}</span>
                  <div><strong>{PHASE_COPY[phase.id][lang]}</strong><small>{PHASE_STATE_COPY[state][lang]}</small></div>
                  <div className="maint-phase-tools">
                    {phase.toolIds.map((id) => (
                      <span key={id} className={`maint-tool-chip ${evidence[id] ? `is-${evidence[id].status.toLowerCase()}` : ''}`} title={id}>{id}</span>
                    ))}
                  </div>
                  {index < PIPELINE_PHASES.length - 1 && <ChevronRight size={14} className="maint-phase-arrow rtl:rotate-180" aria-hidden="true" />}
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Live execution ── */}
        {activeRun && activeTool && (
          <section className="maint-live" role="status" aria-live="polite">
            <div className="maint-live-head">
              <LoaderCircle size={16} className="animate-spin" />
              <strong dir="auto">{activeRun.toolId} · {activeRun.mode}</strong>
              <span><Clock size={12} />{text.elapsed} {formatElapsed(elapsedMs)}</span>
              <button type="button" className="maint-ghost" onClick={() => void cancelActive()}><Square size={12} />{text.cancel}</button>
              <button type="button" className="maint-ghost" onClick={() => setShowRaw((value) => !value)}>{showRaw ? text.hideRaw : text.rawLog}</button>
            </div>
            <div className="maint-progress" role="progressbar" aria-valuetext={`${activeRun.toolId} ${activeRun.mode}`}>
              <i className="is-indeterminate" />
            </div>
            {showRaw && (
              <div className="maint-rawlog">
                {lines.slice(-200).map((line, index) => (
                  <p key={index} className={line.s === 'err' ? 'is-error' : ''} dir="auto">{line.text}</p>
                ))}
                {lines.length === 0 && <p className="is-empty">…</p>}
              </div>
            )}
          </section>
        )}

        {/* ── Recommendations (deterministic) ── */}
        {recommendations.length > 0 && (
          <section aria-label={text.recommendTitle}>
            <div className="app-section-title"><div><p>{text.findingsTitle}</p><h2>{text.recommendTitle}</h2></div></div>
            <div className="maint-recs">
              {recommendations.map((rec) => {
                const tool = byId.get(rec.toolId);
                if (!tool) return null;
                const blocked = tool.RequiresAdmin && !elevated;
                return (
                  <article key={rec.id} className="maint-rec">
                    <AlertTriangle size={18} />
                    <div>
                      <strong dir="auto">{lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName}</strong>
                      <p dir="auto">{lang === 'ar' ? rec.reasonAr : rec.reason}</p>
                      <small dir="auto">{lang === 'ar' ? rec.impactAr : rec.impact}</small>
                      {blocked && <small className="is-permission"><LockKeyhole size={11} />{text.permissionTitle}</small>}
                    </div>
                    <button
                      type="button" className="maint-primary" disabled={blocked || activeRun !== null}
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

        {/* ── Specialized operations (all 10 tools) ── */}
        <section aria-label={text.opsTitle}>
          <div className="app-section-title"><div><p>{STATION01_TOOL_IDS.length} · 01</p><h2>{text.opsTitle}</h2></div></div>
          <div className="maint-ops">
            {station.map((tool) => {
              const item = evidence[tool.ToolId];
              const status = toolStatuses[tool.ToolId];
              const runBlocked = tool.RequiresAdmin && !elevated;
              return (
                <article key={tool.ToolId} className="maint-op">
                  <header>
                    <span className="maint-op-id">{tool.ToolId}</span>
                    <strong dir="auto">{pickName(tool, lang)}</strong>
                    <span className={`maint-risk is-${tool.RiskLevel.toLowerCase().replace(/_/g, '-')}`}>{tool.RiskLevel}</span>
                  </header>
                  <p dir="auto">{tool.Purpose}</p>
                  <dl className="maint-op-meta">
                    <div><dt>{text.admin}</dt><dd>{tool.RequiresAdmin ? text.yes : text.no}</dd></div>
                    <div><dt>{text.restart}</dt><dd>{tool.RequiresRestart ? text.yes : text.no}</dd></div>
                    <div><dt>{text.lastResult}</dt><dd dir="auto">{item ? `${item.status}${item.verificationResult ? ` · ${item.verificationResult}` : ''}` : status ? status.toUpperCase() : text.notScanned}</dd></div>
                  </dl>
                  {item?.changedSystem && (
                    <p className="maint-changed"><CheckCircle2 size={12} />{text.changedSystem} · {item.verificationResult === 'OK' || item.verificationResult === 'REPAIRED_VERIFIED' ? text.repairVerified : text.commandFinished}</p>
                  )}
                  {runBlocked ? (
                    <StationPermissionGate lang={lang} requiresAdmin bridgeElevated={elevated}>
                      <span />
                    </StationPermissionGate>
                  ) : null}
                  <div className="maint-op-actions">
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
          {station.length === 0 && (
            <p className="maint-empty" role="status">{bridgeOnline === true ? text.toolMissing : text.unavailable}</p>
          )}
          {(!elevated) && (
            <div className="maint-permission">
              <LockKeyhole size={16} />
              <div><strong>{text.permissionTitle}</strong><p>{text.elevateHelp}</p></div>
              <button type="button" className="maint-ghost" onClick={() => void recheckElevation()}><RefreshCw size={12} />{text.elevationRetry}</button>
            </div>
          )}
        </section>

        {/* ── Evidence center ── */}
        <section aria-label={text.evidenceTitle}>
          <div className="app-section-title"><div><p>{text.findingsTitle}</p><h2>{text.evidenceTitle}</h2></div></div>
          {Object.keys(evidence).length === 0 ? (
            <p className="maint-empty">{text.notScanned}</p>
          ) : (
            <div className="maint-evidence-grid">
              {STATION01_TOOL_IDS.filter((id) => evidence[id]).map((id) => (
                <article key={id} className="maint-finding">
                  <header><strong>{id}</strong><span className={`is-${evidence[id].status.toLowerCase()}`}>{evidence[id].status}</span></header>
                  <dl>
                    <div><dt>{text.modeLabel}</dt><dd>{evidence[id].mode}</dd></div>
                    <div><dt>{text.verification}</dt><dd dir="auto">{evidence[id].verificationResult || text.unavailable}</dd></div>
                    <div><dt>{text.report}</dt><dd dir="ltr" className="is-path">{evidence[id].reportPath || text.unavailable}</dd></div>
                  </dl>
                  {evidence[id].errorMessage && <p className="is-error" dir="auto">{evidence[id].errorMessage}</p>}
                </article>
              ))}
            </div>
          )}
          {activeRun === null && lines.length > 0 && (
            <div className="maint-rawlog is-settled">
              {lines.slice(-200).map((line, index) => (
                <p key={index} className={line.s === 'err' ? 'is-error' : ''} dir="auto">{line.text}</p>
              ))}
            </div>
          )}
        </section>

        {/* ── History + report ── */}
        <section aria-label={text.historyTitle}>
          <div className="app-section-title">
            <div><p><History size={13} />{text.historyTitle}</p><h2>{text.historyTitle}</h2></div>
            <button type="button" className="maint-ghost" onClick={downloadReport} disabled={history.length === 0 && Object.keys(evidence).length === 0}>
              <Download size={13} />{text.reportDownload}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="maint-empty">{text.emptyHistory}</p>
          ) : (
            <div className="maint-history-wrap">
              <table className="maint-history">
                <thead><tr>
                  <th>{text.historyCols.when}</th><th>{text.historyCols.tool}</th><th>{text.historyCols.mode}</th>
                  <th>{text.historyCols.result}</th><th>{text.historyCols.changed}</th><th>{text.historyCols.restart}</th>
                  <th>{text.historyCols.verify}</th><th>{text.historyCols.report}</th>
                </tr></thead>
                <tbody>
                  {history.slice(0, 30).map((entry, index) => (
                    <tr key={`${entry.toolId}-${entry.finishedAt}-${index}`}>
                      <td dir="ltr">{entry.finishedAt || '—'}</td><td><strong>{entry.toolId}</strong></td><td>{entry.mode}</td>
                      <td><span className={`is-${entry.status.toLowerCase()}`}>{entry.status}</span></td>
                      <td>{entry.changedSystem ? text.yes : text.no}</td><td>{entry.restartNeeded ? text.yes : text.no}</td>
                      <td dir="auto">{entry.verificationResult || '—'}</td>
                      <td dir="ltr" className="is-path">{entry.reportPath ? <span title={entry.reportPath}><FileText size={11} /></span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Diagnose plan dialog ── */}
        {planOpen && (
          <div className="execution-dialog-backdrop" role="presentation" onMouseDown={() => setPlanOpen(false)}>
            <section role="dialog" aria-modal="true" aria-labelledby="maint-plan-title" className="execution-dialog platform-confirmation" onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" className="execution-dialog-close" onClick={() => setPlanOpen(false)} aria-label={text.close}><X size={17} /></button>
              <div className="execution-dialog-icon"><ScanSearch size={22} /></div>
              <h2 id="maint-plan-title">{text.confirmPlan}</h2>
              <p className="execution-dialog-purpose">{text.planBody}</p>
              <ol className="maint-plan-steps">
                {plan.map((step, index) => {
                  const tool = byId.get(step.toolId);
                  return (
                    <li key={step.toolId}>
                      <span>{text.stepOf} {index + 1}</span>
                      <strong dir="auto">{step.toolId} · {tool ? pickName(tool, lang) : ''}</strong>
                      <small>[{step.mode}] · {tool?.RiskLevel}{tool?.RequiresAdmin ? ' · Admin' : ''}</small>
                    </li>
                  );
                })}
              </ol>
              <label className="execution-dialog-field">
                <span><AlertTriangle size={14} />{text.planPhrase}</span>
                <input value={planPhrase} onChange={(event) => setPlanPhrase(event.target.value)} placeholder="CONFIRM" autoFocus />
              </label>
              <div className="execution-dialog-actions">
                <button type="button" className="execution-dialog-cancel" onClick={() => setPlanOpen(false)}>{text.planCancel}</button>
                <button
                  type="button" className="execution-dialog-confirm"
                  disabled={planPhrase.trim().length === 0 || activeRun !== null}
                  onClick={() => void runDiagnosePlan(planPhrase.trim())}
                >
                  {text.planConfirm}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ── Single-operation confirmation ── */}
        {pending && (
          <ExecutionConfirmDialog
            tool={pending.tool} mode={pending.mode} lang={lang} initialOptions={pending.options}
            onCancel={() => setPending(null)}
            onConfirm={(_options, confirmation) => { setPending(null); void runSingle(pending.tool.ToolId, pending.mode, confirmation); }}
          />
        )}
      </div>
    </StationErrorBoundary>
  );
}
