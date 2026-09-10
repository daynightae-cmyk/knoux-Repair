import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CircleAlert, Clock, Download, FileText,
  LoaderCircle, LockKeyhole, Play, RefreshCw, ScanSearch, ShieldCheck, Sparkles, Square, Trash2, X,
} from 'lucide-react';
import type { BridgeRun, BridgeTool, CleanupPreview, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api, BridgeError } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { decideExecution, startExecution, pollExecution, cancelExecution, runStatusToState } from '../_shared/StationExecutionController';
import {
  appendHistory, actualRecoveredBytes, buildCleanupPlan, buildCleanupReport, CLEANUP_GROUPS, classifyPreview,
  deriveCleanupState, formatBytes, loadHistory, outcomeFromRun, selectedBytes, selectedFiles, stationTools,
  STATION02_TOOL_IDS,
  type CleanupGroup, type HistoryEntry, type ToolOutcome,
} from './cleanupModel';

interface CleanupStationProps {
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
    eyebrow: 'CLEANUP PLAN', title: 'Space Cleaner', subtitle: 'Safe Windows cleanup center — scan first, review, then clean.',
    scan: 'Scan for Cleanup', scanning: 'Scanning…', cancel: 'Cancel', close: 'Close',
    summaryTitle: 'Cleanup summary', groupsTitle: 'Cleanup groups', reviewTitle: 'Review workspace',
    protectTitle: 'Protected items', execTitle: 'Execution', beforeAfterTitle: 'Before / after',
    evidenceTitle: 'Evidence center', historyTitle: 'Station history', reportDownload: 'Download cleanup report',
    potential: 'Potentially recoverable', selected: 'Selected', recovered: 'Actually recovered',
    lastCleanup: 'Last cleanup', protectedNote: 'Protected paths are never touched. Exclusions are enforced by the shared safety core.',
    notScanned: 'Not scanned', unavailable: 'Unavailable', nothingSafe: 'Nothing safe to clean',
    analyze: 'Analyze', preview: 'What-if', run: 'Run', reviewRun: 'Review & run',
    selectSafe: 'Select all safe', clearSelection: 'Clear selection',
    rawLog: 'Raw log', hideRaw: 'Hide raw log', elapsed: 'Elapsed',
    emptyHistory: 'No cleanup runs yet. Evidence from real runs will appear here.',
    planTitle: 'Review the cleanup plan', planConfirm: 'Start cleanup', planCancel: 'Go back',
    planPhrase: 'Type CONFIRM to authorize permanent deletion', quarantineNote: 'Quarantine: restorable',
    deleteNote: 'Permanent delete: cannot be restored',
    permissionTitle: 'Administrator permission required',
    elevateHelp: 'System locations need an elevated bridge. Restart the local bridge elevated (start-bridge-admin.cmd), then re-check.',
    elevationRetry: 'Re-check permission',
    lastResult: 'Last result', risk: 'Risk', admin: 'Admin', verification: 'Verification',
    quarantined: 'Quarantined', deleted: 'Deleted', skipped: 'Skipped', failed: 'Failed',
    diskBefore: 'Disk free before', diskAfter: 'Disk free after',
    noOverclaim: 'Disk free space moves for many reasons. Only executed results count as recovered.',
    toolMissing: 'Registered tool is missing from the runtime registry.',
    errInProgress: 'Another tool is currently running. Wait for it to finish or cancel it first.',
    errElevation: 'This operation requires Administrator privileges.',
    errConfirmation: 'Explicit confirmation is required before execution.',
    errMode: 'This mode is not supported by the selected tool.',
    errUnknown: 'Unknown tool. Only registered manifest tools can run.',
    errOffline: 'Cleanup engine unavailable.',
    errTimeout: 'The operation exceeded its time limit.',
    errGeneric: 'The operation could not complete.',
    devCachesNote: 'Measured by the preview. Cleaned by Software & Environments tools, not here.',
    yes: 'Yes', no: 'No',
    historyCols: { when: 'When', kind: 'Kind', tool: 'Tool', mode: 'Mode', result: 'Result', candidate: 'Candidate', selectedCol: 'Selected', recoveredCol: 'Recovered', verify: 'Verify', report: 'Report' },
  },
  ar: {
    eyebrow: 'خطة التنظيف', title: 'منظف المساحة', subtitle: 'مركز تنظيف ويندوز الآمن — افحص أولاً، راجع، ثم نظّف.',
    scan: 'فحص الملفات القابلة للتنظيف', scanning: 'جارٍ الفحص…', cancel: 'إيقاف', close: 'إغلاق',
    summaryTitle: 'ملخص التنظيف', groupsTitle: 'مجموعات التنظيف', reviewTitle: 'مساحة المراجعة',
    protectTitle: 'عناصر محمية', execTitle: 'التنفيذ', beforeAfterTitle: 'قبل / بعد',
    evidenceTitle: 'مركز الأدلة', historyTitle: 'سجل المحطة', reportDownload: 'تنزيل تقرير التنظيف',
    potential: 'مساحة محتمل استردادها', selected: 'المحدد', recovered: 'المساحة المستردة فعليًا',
    lastCleanup: 'آخر تنظيف', protectedNote: 'المسارات المحمية لا تُمس أبدًا. الاستثناءات يفرضها نواة الأمان المشتركة.',
    notScanned: 'لم يُفحص بعد', unavailable: 'غير متاح', nothingSafe: 'لا يوجد ما يمكن تنظيفه بأمان',
    analyze: 'تحليل', preview: 'معاينة', run: 'تشغيل', reviewRun: 'مراجعة وتشغيل',
    selectSafe: 'تحديد الآمن فقط', clearSelection: 'مسح التحديد',
    rawLog: 'السجل الخام', hideRaw: 'إخفاء السجل', elapsed: 'المدة',
    emptyHistory: 'لا توجد عمليات تنظيف بعد. ستظهر هنا أدلة التشغيل الحقيقي.',
    planTitle: 'مراجعة خطة التنظيف', planConfirm: 'بدء التنظيف', planCancel: 'رجوع',
    planPhrase: 'اكتب تأكيد لتفويض الحذف النهائي', quarantineNote: 'العزل: قابل للاستعادة',
    deleteNote: 'الحذف النهائي: لا يمكن استعادته',
    permissionTitle: 'تتطلب صلاحية المدير',
    elevateHelp: 'مواقع النظام تحتاج جسرًا بصلاحية المدير. أعد تشغيل الجسر المحلي بصلاحية المدير ثم أعد التحقق.',
    elevationRetry: 'إعادة التحقق من الصلاحية',
    lastResult: 'آخر نتيجة', risk: 'المخاطر', admin: 'المدير', verification: 'التحقق',
    quarantined: 'تم نقله إلى العزل', deleted: 'تم حذفه', skipped: 'تم التخطي', failed: 'فشل',
    diskBefore: 'مساحة القرص قبل', diskAfter: 'مساحة القرص بعد',
    noOverclaim: 'تتغير مساحة القرص لأسباب كثيرة. المسترد هو ما أثبته التنفيذ فقط.',
    toolMissing: 'الأداة المسجلة غير موجودة في سجل التشغيل.',
    errInProgress: 'هناك أداة تعمل حالياً. انتظر انتهاءها أو أوقفها أولاً.',
    errElevation: 'تتطلب هذه العملية صلاحيات المدير.',
    errConfirmation: 'يلزم تأكيد صريح قبل التنفيذ.',
    errMode: 'هذا الوضع غير مدعوم للأداة المختارة.',
    errUnknown: 'أداة غير معروفة. تعمل فقط الأدوات المسجلة.',
    errOffline: 'محرك التنظيف غير متاح.',
    errTimeout: 'تجاوزت العملية الحد الزمني.',
    errGeneric: 'تعذر إكمال العملية.',
    devCachesNote: 'يقيسها الفحص. تنظفها أدوات البرامج والبيئات، وليس هنا.',
    yes: 'نعم', no: 'لا',
    historyCols: { when: 'الوقت', kind: 'النوع', tool: 'الأداة', mode: 'الوضع', result: 'النتيجة', candidate: 'المرشح', selectedCol: 'المحدد', recoveredCol: 'المسترد', verify: 'التحقق', report: 'التقرير' },
  },
} as const;

const GROUP_COPY: Record<string, { en: string; ar: string; hintEn: string; hintAr: string }> = {
  'user-temp': { en: 'User temp files', ar: 'ملفات المؤقتة للمستخدم', hintEn: 'Per-user temp folders. Quarantined, restorable.', hintAr: 'مجلدات المؤقتة للمستخدم. تُعزل وقابلة للاستعادة.' },
  'browser-cache': { en: 'Browser cache', ar: 'ذاكرة المتصفح المؤقتة', hintEn: 'Cache folders only. No history, cookies, or credentials.', hintAr: 'مجلدات الكاش فقط. لا سجل ولا كوكيز ولا بيانات اعتماد.' },
  thumbnails: { en: 'Thumbnail cache', ar: 'مصغرات المستكشف', hintEn: 'Regenerates automatically when folders are browsed.', hintAr: 'تُعاد تلقائيًا عند تصفح المجلدات.' },
  'system-temp': { en: 'System temp', ar: 'مؤقتات النظام', hintEn: 'Windows Temp. Files in use are skipped. Admin required.', hintAr: 'مجلد Temp لويندوز. الملفات المستخدمة تُتخطى. يلزم المدير.' },
  'error-reports': { en: 'Error reports', ar: 'تقارير الأخطاء', hintEn: 'Windows Error Reporting files. CBS/DISM logs never touched.', hintAr: 'ملفات تقارير الأخطاء. سجلات CBS/DISM لا تُمس.' },
  'large-temp': { en: 'Large temp files', ar: 'ملفات مؤقتة كبيرة', hintEn: 'Temp files ≥100 MB only. Size alone never marks other files.', hintAr: 'ملفات مؤقتة ≥100 م.ب فقط. الحجم وحده لا يصف ملفات أخرى.' },
  'update-cache': { en: 'Update download cache', ar: 'ذاكرة التحديثات', hintEn: 'Download cache only, never DataStore. Services stop and restore around it.', hintAr: 'ذاكرة التنزيل فقط وليس DataStore. الخدمات تتوقف وتُستعاد حولها.' },
  'recycle-bin': { en: 'Recycle Bin', ar: 'سلة المحذوفات', hintEn: 'Permanent deletion for all drives. Cannot be restored.', hintAr: 'حذف نهائي لكل الأقراص. لا يمكن استعادته.' },
  comprehensive: { en: 'Comprehensive cleanup', ar: 'تنظيف شامل', hintEn: 'Temp, system temp, update cache, thumbnails, error reports in one pass. Quarantined.', hintAr: 'المؤقتات ومؤقتات النظام وذاكرة التحديث والمصغرات والتقارير دفعة واحدة. تُعزل.' },
  'dev-caches': { en: 'Developer caches', ar: 'ذاكرات المطورين', hintEn: 'npm / Yarn / pip caches. Measured here, cleaned elsewhere.', hintAr: 'ذاكرات npm وYarn وpip. تُقاس هنا وتُنظف في مكان آخر.' },
};

const TIER_COPY: Record<CleanupGroup['tier'], { en: string; ar: string }> = {
  safe: { en: 'Safe', ar: 'آمن' },
  review: { en: 'Review recommended', ar: 'يُنصح بالمراجعة' },
  sensitive: { en: 'System sensitive', ar: 'حساس للنظام' },
  destructive: { en: 'Destructive', ar: 'مدمر' },
};

const STATE_COPY: Record<string, { en: string; ar: string }> = {
  NOT_SCANNED: { en: 'Not scanned', ar: 'لم يُفحص بعد' },
  SCANNING: { en: 'Scanning', ar: 'جارٍ الفحص' },
  CANDIDATES_FOUND: { en: 'Candidates found', ar: 'توجد مرشحات' },
  NOTHING_SAFE: { en: 'Nothing safe to clean', ar: 'لا يوجد ما يمكن تنظيفه بأمان' },
  REVIEW_REQUIRED: { en: 'Review required', ar: 'المراجعة مطلوبة' },
  READY: { en: 'Ready', ar: 'جاهز' },
  CLEANING: { en: 'Cleaning', ar: 'جارٍ التنظيف' },
  VERIFIED: { en: 'Verified', ar: 'تم التحقق' },
  PARTIAL: { en: 'Partial', ar: 'جزئي' },
  FAILED: { en: 'Failed', ar: 'فشل' },
  INCONCLUSIVE: { en: 'Inconclusive', ar: 'غير حاسم' },
  ENGINE_OFFLINE: { en: 'Engine offline', ar: 'المحرك مفصول' },
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

export default function CleanupStation({
  lang, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus,
}: CleanupStationProps) {
  const text = COPY[lang];
  const station = useMemo(() => stationTools(tools), [tools]);
  const byId = useMemo(() => new Map(station.map((tool) => [tool.ToolId, tool])), [station]);
  const groupDefs = useMemo(() => {
    const map: Record<string, CleanupGroup> = {};
    for (const def of CLEANUP_GROUPS) map[def.id] = def;
    return map;
  }, []);

  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => CLEANUP_GROUPS.filter((g) => g.defaultSelected).map((g) => g.id));
  const [outcomes, setOutcomes] = useState<ToolOutcome[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [lines, setLines] = useState<Array<{ t: string; s: string; text: string }>>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [pending, setPending] = useState<{ tool: BridgeTool; mode: ExecutionMode; options?: ToolRunOptions } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planPhrase, setPlanPhrase] = useState('');
  const [banner, setBanner] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [elevated, setElevated] = useState(bridgeElevated);
  const [diskFreeBefore, setDiskFreeBefore] = useState<number | null>(null);
  const [diskFreeAfter, setDiskFreeAfter] = useState<number | null>(null);
  const pollTimer = useRef<number | null>(null);
  const lastCount = useRef(0);

  useEffect(() => { setElevated(bridgeElevated); }, [bridgeElevated]);
  useEffect(() => () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); }, []);
  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - activeRun.startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [activeRun]);

  const classified = useMemo(() => classifyPreview(preview), [preview]);
  const state = useMemo(
    () => deriveCleanupState({ bridgeOnline, scanning, cleaning: activeRun !== null, preview, groups: classified.groups, outcomes }),
    [bridgeOnline, scanning, preview, classified, outcomes, activeRun],
  );

  const potentialBytes = useMemo(() => preview?.Summary?.EstimatedReclaimableBytes ?? null, [preview]);
  const selectedByteCount = useMemo(() => (preview ? selectedBytes(selected, classified.groups) : null), [preview, selected, classified]);
  const recoveredBytes = useMemo(() => outcomes.reduce((sum, o) => sum + actualRecoveredBytes(o), 0), [outcomes]);
  const quarantinedTotal = useMemo(() => outcomes.reduce((sum, o) => sum + o.quarantinedCount, 0), [outcomes]);
  const lastCleanupAt = useMemo(() => {
    const cleanups = history.filter((h) => h.kind === 'cleanup');
    return cleanups.length > 0 ? cleanups[0].finishedAt : '';
  }, [history]);

  const diskFree = useCallback((snapshot: CleanupPreview | null): number | null => {
    if (!snapshot || !Array.isArray(snapshot.Drives)) return null;
    return snapshot.Drives.reduce((sum, d) => sum + Number(d.FreeBytes || 0), 0);
  }, []);

  const runScan = useCallback(async () => {
    setBanner('');
    setScanning(true);
    try {
      const { preview: snapshot } = await api.cleanupPreview();
      setPreview(snapshot);
      setDiskFreeBefore((before) => (before === null ? diskFree(snapshot) : before));
      setOutcomes([]);
      setHistory((current) =>
        appendHistory(current, {
          kind: 'scan', toolId: 'SC11', mode: 'run', status: 'SUCCESS',
          candidateBytes: Number(snapshot.Summary?.EstimatedReclaimableBytes || 0),
          selectedBytes: 0, recoveredBytes: 0, quarantined: 0, deleted: 0, skipped: 0, failed: 0,
          verification: '', reportPath: '', finishedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      setBanner(errorMessage(error, lang));
    } finally {
      setScanning(false);
    }
  }, [diskFree, lang]);

  const recordOutcome = useCallback((run: BridgeRun) => {
    const outcome = outcomeFromRun(run);
    setOutcomes((current) => [...current, outcome]);
    setHistory((current) =>
      appendHistory(current, {
        kind: 'cleanup', toolId: outcome.toolId, mode: outcome.mode, status: outcome.status,
        candidateBytes: outcome.bytesPotentiallyRecoverable, selectedBytes: 0,
        recoveredBytes: actualRecoveredBytes(outcome), quarantined: outcome.quarantinedCount,
        deleted: outcome.bytesPermanentlyDeleted, skipped: outcome.skippedCount,
        failed: outcome.status === 'FAILED' ? 1 : 0,
        verification: outcome.verificationResult, reportPath: outcome.reportPath, finishedAt: outcome.finishedAt,
      }),
    );
    const mapped = runStatusToState(run.status);
    onToolStatus(run.toolId, mapped === 'SUCCESS' ? 'success' : mapped === 'FAILED' ? 'error' : mapped === 'CANCELLED' ? 'cancelled' : mapped === 'INCONCLUSIVE' ? 'inconclusive' : 'error');
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
        if (run.status !== 'running') {
          recordOutcome(run);
          return outcomeFromRun(run);
        }
        await new Promise((resolve) => { pollTimer.current = window.setTimeout(resolve, 700); });
      }
    } finally {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      setActiveRun(null);
    }
  }, [byId, elevated, onToolStatus, recordOutcome, text]);

  const runSingle = useCallback(async (toolId: string, mode: ExecutionMode, confirmation?: ToolRunConfirmation) => {
    setBanner('');
    try {
      await executeStep(toolId, mode, confirmation);
      try {
        const { preview: after } = await api.cleanupPreview();
        setPreview(after);
        setDiskFreeAfter(diskFree(after));
      } catch { /* after-scan is best-effort */ }
    } catch (error) {
      setBanner(errorMessage(error, lang));
      onToolStatus(toolId, 'error');
    }
  }, [diskFree, executeStep, lang, onToolStatus]);

  const planSteps = useMemo(() => buildCleanupPlan(selected, groupDefs), [selected, groupDefs]);
  const planDestructive = useMemo(
    () => planSteps.some((step) => groupDefs[step.groupId]?.destructive),
    [planSteps, groupDefs],
  );

  const runPlan = useCallback(async (phrase: string) => {
    setBanner('');
    setPlanOpen(false);
    const confirmation: ToolRunConfirmation | undefined = planDestructive
      ? { confirmed: true, phrase, confirmedAt: new Date().toISOString() }
      : { confirmed: true, confirmedAt: new Date().toISOString() };
    for (const step of planSteps) {
      try {
        await executeStep(step.toolId, step.mode, confirmation);
      } catch (error) {
        setBanner(`[${step.toolId}] ${errorMessage(error, lang)}`);
        break;
      }
    }
    try {
      const { preview: after } = await api.cleanupPreview();
      setPreview(after);
      setDiskFreeAfter(diskFree(after));
    } catch { /* after-scan is best-effort */ }
  }, [diskFree, executeStep, lang, planDestructive, planSteps]);

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

  const toggleGroup = useCallback((groupId: string) => {
    setSelected((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  }, []);

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
    return global ? global.toUpperCase() : text.notScanned;
  }, [lastOutcomeByTool, toolStatuses, text]);

  const downloadReport = useCallback(() => {
    const report = buildCleanupReport({
      groups: classified.groups, unmatched: classified.unmatched, selected, outcomes, history,
      diskFreeBefore, diskFreeAfter,
      protectedExclusions: preview?.Safety?.Excluded || [],
      lang,
    });
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knoux-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [classified, selected, outcomes, history, diskFreeBefore, diskFreeAfter, preview, lang]);

  if (bridgeOnline === false) {
    return <StationOfflineState lang={lang} reason={text.errOffline} onRetry={onRetryBridge} />;
  }

  const activeTool = activeRun ? byId.get(activeRun.toolId) : null;

  return (
    <StationErrorBoundary>
      <div className="cleanup-station" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {banner && (
          <div className="cleanup-banner" role="alert">
            <CircleAlert size={15} />
            <span dir="auto">{banner}</span>
            <button type="button" onClick={() => setBanner('')} aria-label={text.close}><X size={13} /></button>
          </div>
        )}

        {/* ── Summary hero: three separate byte roles ── */}
        <section className="cleanup-hero" aria-live="polite">
          <div className="cleanup-hero-copy">
            <p className="eyebrow"><Sparkles size={13} />{text.eyebrow}</p>
            <h2>{text.title}</h2>
            <p className="cleanup-state" role="status">
              <span className="cleanup-state-dot" aria-hidden="true" />
              {STATE_COPY[state][lang]}
            </p>
            <p className="cleanup-sub">{text.subtitle}</p>
            <div className="cleanup-hero-actions">
              <button
                type="button" className="cleanup-primary" onClick={() => void runScan()}
                disabled={scanning || activeRun !== null} aria-label={text.scan}
              >
                {scanning || activeRun ? <LoaderCircle size={15} className="animate-spin" /> : <ScanSearch size={15} />}
                {scanning ? text.scanning : text.scan}
              </button>
              {activeRun && (
                <button type="button" className="cleanup-ghost" onClick={() => void cancelActive()}>
                  <Square size={13} />{text.cancel}
                </button>
              )}
            </div>
          </div>
          <dl className="cleanup-hero-figures">
            <div><dt>{text.potential}</dt><dd dir="auto">{preview ? formatBytes(potentialBytes, lang) : text.notScanned}</dd></div>
            <div><dt>{text.selected}</dt><dd dir="auto">{preview ? formatBytes(selectedByteCount, lang) : text.notScanned}</dd></div>
            <div><dt>{text.recovered}</dt><dd dir="auto">{outcomes.length > 0 ? formatBytes(recoveredBytes, lang) : text.notScanned}</dd></div>
            <div><dt>{text.lastCleanup}</dt><dd dir="auto">{lastCleanupAt || text.notScanned}</dd></div>
          </dl>
        </section>

        {/* ── Groups ── */}
        <section aria-label={text.groupsTitle}>
          <div className="app-section-title">
            <div><p>{STATION02_TOOL_IDS.length} · 02</p><h2>{text.groupsTitle}</h2></div>
            <div className="cleanup-select-actions">
              <button type="button" className="cleanup-ghost" disabled={!preview || activeRun !== null} onClick={() => setSelected(CLEANUP_GROUPS.filter((g) => g.tier === 'safe').map((g) => g.id))}>{text.selectSafe}</button>
              <button type="button" className="cleanup-ghost" disabled={activeRun !== null} onClick={() => setSelected([])}>{text.clearSelection}</button>
            </div>
          </div>
          {!preview ? (
            <p className="cleanup-empty">{scanning ? text.scanning : text.notScanned}</p>
          ) : (
            <div className="cleanup-groups">
              {CLEANUP_GROUPS.map((def) => {
                const item = classified.groups[def.id];
                const tool = def.toolId ? byId.get(def.toolId) : null;
                const checked = selected.includes(def.id);
                const copy = GROUP_COPY[def.id];
                return (
                  <article key={def.id} className={`cleanup-group is-${def.tier}`}>
                    <header>
                      <label className="cleanup-check">
                        <input
                          type="checkbox" checked={checked} disabled={activeRun !== null || !tool}
                          onChange={() => toggleGroup(def.id)}
                          aria-label={lang === 'ar' ? copy.ar : copy.en}
                        />
                        <strong dir="auto">{lang === 'ar' ? copy.ar : copy.en}</strong>
                      </label>
                      <span className={`cleanup-tier is-${def.tier}`}>{TIER_COPY[def.tier][lang]}</span>
                    </header>
                    <p dir="auto">{lang === 'ar' ? copy.hintAr : copy.hintEn}</p>
                    <dl className="cleanup-group-meta">
                      <div><dt>{lang === 'ar' ? 'الملفات' : 'Files'}</dt><dd dir="auto">{item.exists ? item.files.toLocaleString(lang) : text.unavailable}</dd></div>
                      <div><dt>{lang === 'ar' ? 'الحجم' : 'Size'}</dt><dd dir="auto">{item.exists ? formatBytes(item.bytes, lang) : text.unavailable}</dd></div>
                      <div><dt>{text.lastResult}</dt><dd dir="auto">{globalStatus(tool)}</dd></div>
                      <div><dt>{text.risk}</dt><dd dir="auto">{tool ? tool.RiskLevel : '—'}</dd></div>
                    </dl>
                    {def.id === 'dev-caches' && <p className="cleanup-dev-note"><FileText size={12} />{text.devCachesNote}</p>}
                    {def.toolId && !tool && <p className="cleanup-dev-note"><CircleAlert size={12} />{text.toolMissing}</p>}
                    {tool && (
                      <div className="cleanup-op-actions">
                        {tool.AnalyzeOnlySupported && (
                          <button type="button" disabled={activeRun !== null} onClick={() => setPending({ tool, mode: 'analyze' })}>{text.analyze}</button>
                        )}
                        {tool.WhatIfSupported && (
                          <button type="button" disabled={activeRun !== null} onClick={() => setPending({ tool, mode: 'preview' })}>{text.preview}</button>
                        )}
                        <button
                          type="button" className="is-run" disabled={activeRun !== null || (tool.RequiresAdmin && !elevated)}
                          onClick={() => setPending({ tool, mode: 'run' })}
                          title={tool.RequiresAdmin && !elevated ? text.permissionTitle : undefined}
                        >
                          <Play size={11} />{text.run}
                        </button>
                      </div>
                    )}
                    {item.paths.slice(0, 3).map((p) => (
                      <small key={p} className="cleanup-path" dir="ltr" title={p}>{p}</small>
                    ))}
                  </article>
                );
              })}
            </div>
          )}
          {!elevated && (
            <div className="cleanup-permission">
              <LockKeyhole size={16} />
              <div><strong>{text.permissionTitle}</strong><p>{text.elevateHelp}</p></div>
              <button type="button" className="cleanup-ghost" onClick={() => void recheckElevation()}><RefreshCw size={12} />{text.elevationRetry}</button>
            </div>
          )}
        </section>

        {/* ── Review workspace ── */}
        {preview && (
          <section aria-label={text.reviewTitle}>
            <div className="app-section-title"><div><p>{text.reviewTitle}</p><h2>{text.reviewTitle}</h2></div></div>
            <div className="cleanup-review">
              <dl>
                <div><dt>{text.selected}</dt><dd dir="auto">{selectedFiles(selected, classified.groups).toLocaleString(lang)} · {formatBytes(selectedByteCount, lang)}</dd></div>
                <div><dt>{text.potential}</dt><dd dir="auto">{formatBytes(potentialBytes, lang)}</dd></div>
                <div><dt>{text.protectTitle}</dt><dd dir="auto">{(preview.Safety?.Excluded || []).length} · {text.protectedNote}</dd></div>
              </dl>
              <button
                type="button" className="cleanup-primary" disabled={activeRun !== null || planSteps.length === 0}
                onClick={() => { setPlanPhrase(''); setPlanOpen(true); }}
              >
                {text.planConfirm}<ArrowRight size={13} className="rtl:rotate-180" />
              </button>
            </div>
            <ul className="cleanup-excluded">
              {(preview.Safety?.Excluded || []).map((item) => (
                <li key={item} dir="auto"><ShieldCheck size={12} />{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Live execution ── */}
        {activeRun && activeTool && (
          <section className="cleanup-live" role="status" aria-live="polite" aria-label={text.execTitle}>
            <div className="cleanup-live-head">
              <LoaderCircle size={16} className="animate-spin" />
              <strong dir="auto">{activeRun.toolId} · {activeRun.mode}</strong>
              <span><Clock size={12} />{text.elapsed} {formatElapsed(elapsedMs)}</span>
              <button type="button" className="cleanup-ghost" onClick={() => void cancelActive()}><Square size={12} />{text.cancel}</button>
              <button type="button" className="cleanup-ghost" onClick={() => setShowRaw((v) => !v)}>{showRaw ? text.hideRaw : text.rawLog}</button>
            </div>
            <div className="cleanup-progress" role="progressbar" aria-valuetext={`${activeRun.toolId} ${activeRun.mode}`}>
              <i className="is-indeterminate" />
            </div>
            {showRaw && (
              <div className="cleanup-rawlog">
                {lines.slice(-200).map((line, index) => (
                  <p key={index} className={line.s === 'err' ? 'is-error' : ''} dir="auto">{line.text}</p>
                ))}
                {lines.length === 0 && <p className="is-empty">…</p>}
              </div>
            )}
          </section>
        )}

        {/* ── Before / after ── */}
        {(diskFreeBefore !== null || outcomes.length > 0) && (
          <section aria-label={text.beforeAfterTitle}>
            <div className="app-section-title"><div><p>{text.beforeAfterTitle}</p><h2>{text.beforeAfterTitle}</h2></div></div>
            <div className="cleanup-before-after">
              <dl>
                <div><dt>{text.diskBefore}</dt><dd dir="auto">{formatBytes(diskFreeBefore, lang)}</dd></div>
                <div><dt>{text.diskAfter}</dt><dd dir="auto">{formatBytes(diskFreeAfter, lang)}</dd></div>
                <div><dt>{text.recovered}</dt><dd dir="auto">{formatBytes(recoveredBytes, lang)}</dd></div>
                <div><dt>{text.quarantined}</dt><dd dir="auto">{quarantinedTotal.toLocaleString(lang)}</dd></div>
              </dl>
              <p className="cleanup-no-overclaim">{text.noOverclaim}</p>
              {outcomes.map((outcome, index) => (
                <article key={`${outcome.toolId}-${index}`} className="cleanup-outcome">
                  <header><strong dir="auto">{outcome.toolId} [{outcome.mode}]</strong><span className={`is-${outcome.status.toLowerCase()}`}>{outcome.status}</span></header>
                  <small dir="auto">
                    {text.quarantined}: {outcome.quarantinedCount} · {text.deleted}: {formatBytes(outcome.bytesPermanentlyDeleted, lang)} · {text.skipped}: {outcome.skippedCount} · {text.failed}: {outcome.status === 'FAILED' ? text.yes : text.no} · {text.verification}: {outcome.verificationResult || text.unavailable}
                  </small>
                  {outcome.errorMessage && <p className="is-error" dir="auto">{outcome.errorMessage}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Evidence + history ── */}
        <section aria-label={text.evidenceTitle}>
          <div className="app-section-title">
            <div><p>{text.historyTitle}</p><h2>{text.evidenceTitle}</h2></div>
            <button type="button" className="cleanup-ghost" onClick={downloadReport} disabled={history.length === 0 && outcomes.length === 0}>
              <Download size={13} />{text.reportDownload}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="cleanup-empty">{text.emptyHistory}</p>
          ) : (
            <div className="cleanup-history-wrap">
              <table className="cleanup-history">
                <thead><tr>
                  <th>{text.historyCols.when}</th><th>{text.historyCols.kind}</th><th>{text.historyCols.tool}</th>
                  <th>{text.historyCols.mode}</th><th>{text.historyCols.result}</th><th>{text.historyCols.candidate}</th>
                  <th>{text.historyCols.selectedCol}</th><th>{text.historyCols.recoveredCol}</th>
                  <th>{text.historyCols.verify}</th><th>{text.historyCols.report}</th>
                </tr></thead>
                <tbody>
                  {history.slice(0, 30).map((entry, index) => (
                    <tr key={`${entry.toolId}-${entry.finishedAt}-${index}`}>
                      <td dir="ltr">{entry.finishedAt || '—'}</td><td>{entry.kind}</td>
                      <td><strong>{entry.toolId}</strong></td><td>{entry.mode}</td>
                      <td><span className={`is-${entry.status.toLowerCase()}`}>{entry.status}</span></td>
                      <td dir="auto">{formatBytes(entry.candidateBytes, lang)}</td>
                      <td dir="auto">{formatBytes(entry.selectedBytes, lang)}</td>
                      <td dir="auto">{formatBytes(entry.recoveredBytes, lang)}</td>
                      <td dir="auto">{entry.verification || '—'}</td>
                      <td dir="ltr">{entry.reportPath ? <FileText size={11} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Cleanup plan dialog ── */}
        {planOpen && (
          <div className="execution-dialog-backdrop" role="presentation" onMouseDown={() => setPlanOpen(false)}>
            <section role="dialog" aria-modal="true" aria-labelledby="cleanup-plan-title" className="execution-dialog platform-confirmation" onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" className="execution-dialog-close" onClick={() => setPlanOpen(false)} aria-label={text.close}><X size={17} /></button>
              <div className="execution-dialog-icon"><Trash2 size={22} /></div>
              <h2 id="cleanup-plan-title">{text.planTitle}</h2>
              <ol className="cleanup-plan-steps">
                {planSteps.map((step) => {
                  const def = groupDefs[step.groupId];
                  const tool = byId.get(step.toolId);
                  return (
                    <li key={step.groupId}>
                      <strong dir="auto">{step.toolId} · {tool ? pickName(tool, lang) : ''}</strong>
                      <small dir="auto">
                        {formatBytes(classified.groups[step.groupId]?.bytes, lang)} ·{' '}
                        {def?.destructive ? text.deleteNote : text.quarantineNote}
                        {tool?.RequiresAdmin ? ' · Admin' : ''}
                      </small>
                    </li>
                  );
                })}
              </ol>
              {planDestructive && (
                <label className="execution-dialog-field">
                  <span><AlertTriangle size={14} />{text.planPhrase}</span>
                  <input value={planPhrase} onChange={(event) => setPlanPhrase(event.target.value)} placeholder="CONFIRM" autoFocus />
                </label>
              )}
              <p className="execution-dialog-contract"><ShieldCheck size={14} />{text.protectedNote}</p>
              <div className="execution-dialog-actions">
                <button type="button" className="execution-dialog-cancel" onClick={() => setPlanOpen(false)}>{text.planCancel}</button>
                <button
                  type="button" className="execution-dialog-confirm"
                  disabled={(!planDestructive ? false : planPhrase.trim().length === 0) || activeRun !== null}
                  onClick={() => void runPlan(planPhrase.trim())}
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

        {/* ── Protected items note ── */}
        <p className="cleanup-protected-foot"><ShieldCheck size={12} />{text.protectedNote}</p>
      </div>
    </StationErrorBoundary>
  );
}
