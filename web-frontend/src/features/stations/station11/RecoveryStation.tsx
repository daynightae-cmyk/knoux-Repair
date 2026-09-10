import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore, HardDrive, RefreshCw, Play,
  CheckCircle2, AlertTriangle, XCircle, FileText,
  DatabaseZap, Lock, History, FolderCheck, ShieldAlert
} from 'lucide-react';
import type {
  BackupRecoveryPreview, BridgeTool, ExecutionMode,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type RecoveryReadinessSummary, type RecoverySignal, type StationHistoryEntry,
  summarizeRecoveryVault, sortRestorePoints, formatBytes,
  detectRecoverySignals, stationTools, outcomeFromRun
} from './recoveryModel';
import RecoveryHeroVisual from './RecoveryHeroVisual';

export interface RecoveryStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'restorePoints' | 'shadowCopies' | 'localBackups' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'RECOVERY VAULT & CONTINUITY',
    title: 'System Recovery Vault & Protection',
    subtitle: 'System Restore Points, Volume Shadow Copies (VSS), and localized user profile archives.',
    tabOverview: 'Overview',
    tabRestorePoints: 'Restore Points',
    tabShadowCopies: 'Shadow Copies',
    tabLocalBackups: 'User Backups',
    tabActions: 'Recovery Tools',
    tabReport: 'Vault Audit',
    tabHistory: 'History',
    refresh: 'Query Vault',
    refreshing: 'Reading recovery records...',
    readinessLabel: 'Continuity & Recovery Readiness',
    readyDesc: 'Protected — System restore points and local user backups available',
    partialDesc: 'Partial Coverage — One recovery line active, secondary backup missing',
    unprotectedDesc: 'Unprotected — No system restore points or local backups found',
    unknownDesc: 'Vault Telemetry Pending',
    restorePoints: 'System Restore Points',
    shadowCopies: 'Volume Shadow Copies',
    localBackups: 'Local Archives',
    latestBackup: 'Latest Local Archive',
    sourcesVerified: 'User Folders Verified',
    quickRestorePoint: 'Create Restore Point (BR01)',
    quickBackupProfile: 'Backup Profile (BR02)',
    quickVerifyBackup: 'Verify Latest (BR03)',
    signalsTitle: 'Recovery Findings & Continuity Signals',
    noSignals: 'System recovery mechanisms and local archives are operating within nominal thresholds.',
    restorePointsTitle: 'Windows System Restore Point History',
    restorePointsSubtitle: 'Recorded snapshots managed by Windows Volume Shadow Service (VSS).',
    shadowCopiesTitle: 'Volume Shadow Copy Snapshots',
    shadowCopiesSubtitle: 'Hardware and volume-level snapshots for point-in-time state recovery.',
    localBackupsTitle: 'Local Knoux User Profile Archives',
    localBackupsSubtitle: 'Safe, non-destructive archives of Documents, Desktop, Pictures, and personal data.',
    backupSourcesTitle: 'Target Profile Directories',
    emptyHistory: 'No recovery operations executed yet during this session.',
    noRestorePoints: 'No System Restore Points found on this Windows installation.',
    noShadowCopies: 'No Volume Shadow Copies discovered on monitored volumes.',
    noLocalBackups: 'No local user profile backups have been generated yet.',
    adminNote: 'Creating a system restore point requires administrator elevation.',
  },
  ar: {
    eyebrow: 'خزنة الاستعادة واستمرارية النظام',
    title: 'مركز الحماية واستعادة النظام',
    subtitle: 'نقاط استعادة نظام ويندوز، نسخ الظل (VSS)، والأرشيفات المحلية لملفات المستخدم.',
    tabOverview: 'نظرة عامة',
    tabRestorePoints: 'نقاط الاستعادة',
    tabShadowCopies: 'نسخ الظل VSS',
    tabLocalBackups: 'نسخ المستخدم',
    tabActions: 'أدوات الاستعادة',
    tabReport: 'تدقيق الخزنة',
    tabHistory: 'السجل',
    refresh: 'فحص الخزنة',
    refreshing: 'جارٍ قراءة بيانات الاستعادة...',
    readinessLabel: 'جاهزية الاستعادة والأمان',
    readyDesc: 'محمي — تتوفر نقاط استعادة للنظام ونسخ احتياطية للمستخدم',
    partialDesc: 'تغطية جزئية — يتوفر خط استعادة واحد مع غياب الآخر',
    unprotectedDesc: 'غير محمي — لم يتم العثور على نقاط استعادة أو نسخ محلية',
    unknownDesc: 'بانتظار قراءة الخزنة',
    restorePoints: 'نقاط استعادة النظام',
    shadowCopies: 'نسخ الظل الفيزيائية',
    localBackups: 'النسخ المحلية',
    latestBackup: 'أحدث نسخة محلية',
    sourcesVerified: 'المجلدات التي تم التحقق منها',
    quickRestorePoint: 'إنشاء نقطة استعادة (BR01)',
    quickBackupProfile: 'نسخ ملف المستخدم (BR02)',
    quickVerifyBackup: 'التحقق من النسخة (BR03)',
    signalsTitle: 'ملاحظات وإشارات الاستعادة',
    noSignals: 'خطوط الاستعادة والنسخ الاحتياطي في حالة سليمة وضمن الحدود الطبيعية.',
    restorePointsTitle: 'سجل نقاط استعادة نظام ويندوز',
    restorePointsSubtitle: 'لقطات النظام المسجلة والمدارة بواسطة خدمة VSS في ويندوز.',
    shadowCopiesTitle: 'لقطات نسخ الظل للأقراص (VSS)',
    shadowCopiesSubtitle: 'لقطات فيزيائية على مستوى الأقراص لاستعادة حالات سابقة للنظام.',
    localBackupsTitle: 'أرشيفات ملفات المستخدم المحلية',
    localBackupsSubtitle: 'نسخ آمنة وغير تدميرية لمجلدات المستندات وسطح المكتب والصور.',
    backupSourcesTitle: 'مجلدات ملف المستخدم المستهدفة',
    emptyHistory: 'لم يتم تنفيذ أي إجراء استعادة بعد خلال هذه الجلسة.',
    noRestorePoints: 'لا توجد أي نقاط استعادة مسجلة لنظام ويندوز حالياً.',
    noShadowCopies: 'لا توجد أي نسخ ظل مكتشفة على الأقراص المراقبة.',
    noLocalBackups: 'لم يتم إنشاء أي نسخة احتياطية محلية لملفات المستخدم بعد.',
    adminNote: 'إنشاء نقطة استعادة للنظام يتطلب تشغيل البرنامج بصلاحيات المسؤول.',
  },
};

export default function RecoveryStation(props: RecoveryStationProps) {
  return (
    <StationErrorBoundary>
      <RecoveryStationContent {...props} />
    </StationErrorBoundary>
  );
}

function RecoveryStationContent({
  lang,
  tools,
  toolStatuses,
  bridgeElevated,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: RecoveryStationProps) {
  const text = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [preview, setPreview] = useState<BackupRecoveryPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{
    tool: BridgeTool;
    mode: ExecutionMode;
    options?: ToolRunOptions;
  } | null>(null);

  // Filter tools strictly belonging to Station 11
  const stTools = useMemo(() => stationTools(tools), [tools]);

  // Load recovery preview from bridge
  const refreshVault = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.backupRecoveryPreview();
      setPreview(res.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshVault();
  }, [refreshVault]);

  // Domain computations
  const summary: RecoveryReadinessSummary = useMemo(() => summarizeRecoveryVault(preview), [preview]);
  const restorePoints = useMemo(() => sortRestorePoints(preview?.RestorePoints?.Items), [preview?.RestorePoints?.Items]);
  const shadowCopies = useMemo(() => preview?.ShadowCopies?.Items ?? [], [preview?.ShadowCopies?.Items]);
  const localBackups = useMemo(() => preview?.LocalBackups?.Items ?? [], [preview?.LocalBackups?.Items]);
  const backupSources = useMemo(() => preview?.BackupSources ?? [], [preview?.BackupSources]);
  const signals: RecoverySignal[] = useMemo(() => detectRecoverySignals(summary), [summary]);

  // Execution trigger
  const executeTool = useCallback(
    async (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
      onToolStatus(tool.ToolId, 'running');
      try {
        const runId = await startExecution({
          tool,
          mode,
          options,
          confirmation,
        });

        const completedRun = await pollExecution(runId);
        const status = outcomeFromRun(completedRun.result);
        onToolStatus(tool.ToolId, status === 'SUCCESS' ? 'success' : status === 'WARNING' ? 'inconclusive' : 'error');

        const newEntry: StationHistoryEntry = {
          id: runId || `run-${Date.now()}`,
          toolId: tool.ToolId,
          toolName: pickName(tool, lang),
          timestamp: new Date().toLocaleTimeString(lang),
          status,
          itemsProcessed: completedRun.result?.ItemsProcessed ?? 1,
          summary: completedRun.result?.Status === 'Success'
            ? (lang === 'ar' ? 'اكتملت عملية الاستعادة بنجاح' : 'Recovery operation completed successfully')
            : (completedRun.result?.ErrorMessage || 'Completed with warnings'),
        };
        setHistory((prev) => [newEntry, ...prev.slice(0, 19)]);
        void refreshVault();
      } catch (err) {
        onToolStatus(tool.ToolId, 'error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [lang, onToolStatus, refreshVault]
  );

  const launchAction = useCallback(
    (toolId: string, defaultMode: ExecutionMode = 'run') => {
      const tool = stTools.find((t) => t.ToolId === toolId);
      if (!tool) return;
      const mode = tool.AnalyzeOnlySupported ? 'analyze' : defaultMode;
      setPendingTool({ tool, mode });
    },
    [stTools]
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
    <div className="flex flex-col w-full min-h-[680px] p-4 lg:p-6 text-slate-100 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800/60 shadow-2xl">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <ArchiveRestore size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                {text.eyebrow}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                <DatabaseZap size={10} />
                BR01–BR05
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
                summary.state === 'READY'
                  ? 'bg-emerald-400'
                  : summary.state === 'PARTIAL_COVERAGE'
                  ? 'bg-amber-400'
                  : summary.state === 'UNPROTECTED'
                  ? 'bg-rose-500'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-200">
              {summary.state === 'READY'
                ? text.readyDesc
                : summary.state === 'PARTIAL_COVERAGE'
                ? text.partialDesc
                : summary.state === 'UNPROTECTED'
                ? text.unprotectedDesc
                : text.unknownDesc}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void refreshVault()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition shadow-lg shadow-sky-900/30"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? text.refreshing : text.refresh}
          </button>
        </div>
      </header>

      {/* Mini-Nav Tabs */}
      <nav className="flex items-center gap-1.5 mt-4 pb-2 overflow-x-auto border-b border-slate-800/60 no-scrollbar">
        {[
          { key: 'overview', label: text.tabOverview, icon: ArchiveRestore },
          { key: 'restorePoints', label: text.tabRestorePoints, icon: History },
          { key: 'shadowCopies', label: text.tabShadowCopies, icon: HardDrive },
          { key: 'localBackups', label: text.tabLocalBackups, icon: FolderCheck },
          { key: 'actions', label: text.tabActions, icon: Play },
          { key: 'report', label: text.tabReport, icon: FileText },
          { key: 'history', label: text.tabHistory, icon: RefreshCw },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as TabKey)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              activeTab === key
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold'
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

      {/* Tab Contents */}
      <main className="flex-1 mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Vault Dial Visual */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80">
              <RecoveryHeroVisual
                state={summary.state}
                restorePointsCount={summary.restorePointsCount}
                shadowCopiesCount={summary.shadowCopiesCount}
                localBackupsCount={summary.localBackupsCount}
              />
              <div className="mt-4 text-center">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  {text.readinessLabel}
                </span>
                <p className="text-base font-bold text-sky-300">
                  {summary.state === 'READY'
                    ? text.readyDesc
                    : summary.state === 'PARTIAL_COVERAGE'
                    ? text.partialDesc
                    : text.unprotectedDesc}
                </p>
                <small className="text-[11px] text-slate-400 block mt-1">
                  {preview?.Storage?.ProjectDrive
                    ? `${preview.Storage.ProjectDrive} (${summary.projectDriveFreeGB ?? '—'} GB free)`
                    : 'Local Drive'}
                </small>
              </div>
            </div>

            {/* Right Metrics & Signals */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.restorePoints}</span>
                    <History size={16} className={summary.restorePointsCount > 0 ? 'text-emerald-400' : 'text-rose-400'} />
                  </div>
                  <strong className="text-lg font-bold text-white block">
                    {summary.restorePointsCount.toLocaleString(lang)}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {summary.restorePointsCount > 0
                      ? (lang === 'ar' ? 'نقطة استعادة نشطة' : 'Active system point(s)')
                      : (lang === 'ar' ? 'لا توجد نقطة استعادة' : 'No restore point')}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.shadowCopies}</span>
                    <HardDrive size={16} className={summary.shadowCopiesCount > 0 ? 'text-sky-400' : 'text-slate-400'} />
                  </div>
                  <strong className="text-lg font-bold text-white block">
                    {summary.shadowCopiesCount.toLocaleString(lang)}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {lang === 'ar' ? 'لقطات VSS فيزيائية' : 'VSS snapshots'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.localBackups}</span>
                    <FolderCheck size={16} className={summary.localBackupsCount > 0 ? 'text-emerald-400' : 'text-amber-400'} />
                  </div>
                  <strong className="text-lg font-bold text-white block">
                    {summary.localBackupsCount.toLocaleString(lang)}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {summary.latestBackupBytes > 0
                      ? formatBytes(summary.latestBackupBytes, lang)
                      : (lang === 'ar' ? 'لا توجد ملفات' : '0 B saved')}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 mr-2">
                  {lang === 'ar' ? 'إجراءات الحماية السريعة:' : 'Quick Actions:'}
                </span>
                <button
                  type="button"
                  onClick={() => launchAction('BR01')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600/80 hover:bg-sky-500 text-white transition"
                >
                  <History size={13} />
                  {text.quickRestorePoint}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('BR02')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                >
                  <FolderCheck size={13} />
                  {text.quickBackupProfile}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('BR03')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                >
                  <CheckCircle2 size={13} />
                  {text.quickVerifyBackup}
                </button>
              </div>

              {/* Signals */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-sky-400" />
                  {text.signalsTitle}
                </h3>
                {signals.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {signals.map((sig) => (
                      <div
                        key={sig.code}
                        className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
                          sig.level === 'HIGH'
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
                            {sig.suggestedTool}
                          </button>
                        )}
                      </div>
                    ))}
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

        {activeTab === 'restorePoints' && (
          <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{text.restorePointsTitle}</h3>
                <p className="text-xs text-slate-400">{text.restorePointsSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => launchAction('BR01')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
              >
                <History size={13} />
                <span>{text.quickRestorePoint}</span>
              </button>
            </div>

            {restorePoints.length > 0 ? (
              <div className="flex flex-col gap-2">
                {restorePoints.map((rp) => (
                  <div
                    key={rp.SequenceNumber}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 text-sky-300 font-mono font-bold">
                        #{rp.SequenceNumber}
                      </span>
                      <div>
                        <strong className="text-white text-sm block">{rp.Description}</strong>
                        <span className="text-[11px] text-slate-400">
                          {rp.CreatedAt || 'Timestamp unavailable'} · Type {rp.RestorePointType}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-emerald-300">
                      VSS Point Verified
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800/60 text-slate-400 text-xs">
                {text.noRestorePoints}
              </div>
            )}
          </div>
        )}

        {activeTab === 'shadowCopies' && (
          <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{text.shadowCopiesTitle}</h3>
                <p className="text-xs text-slate-400">{text.shadowCopiesSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => launchAction('BR04')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
              >
                <RefreshCw size={13} />
                <span>{lang === 'ar' ? 'تحديث الفحص (BR04)' : 'Refresh VSS (BR04)'}</span>
              </button>
            </div>

            {shadowCopies.length > 0 ? (
              <div className="flex flex-col gap-2">
                {shadowCopies.map((sc) => (
                  <div
                    key={sc.Id}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div>
                      <strong className="text-white text-sm block">{sc.Volume}</strong>
                      <span className="font-mono text-[11px] text-slate-400 block truncate">
                        ID: {sc.Id}
                      </span>
                      <small className="text-[10px] text-slate-400">{sc.CreatedAt}</small>
                    </div>
                    <div className="flex items-center gap-2">
                      {sc.Persistent && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                          Persistent
                        </span>
                      )}
                      {sc.ClientAccessible && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Accessible
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800/60 text-slate-400 text-xs">
                {text.noShadowCopies}
              </div>
            )}
          </div>
        )}

        {activeTab === 'localBackups' && (
          <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{text.localBackupsTitle}</h3>
                <p className="text-xs text-slate-400">{text.localBackupsSubtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => launchAction('BR02')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
                >
                  <FolderCheck size={13} />
                  <span>{text.quickBackupProfile}</span>
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('BR05')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  <ArchiveRestore size={13} />
                  <span>{lang === 'ar' ? 'استعادة المفقود (BR05)' : 'Restore Missing (BR05)'}</span>
                </button>
              </div>
            </div>

            {/* Target Profile Sources */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <h4 className="text-xs font-bold text-slate-300 mb-3">{text.backupSourcesTitle}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {backupSources.map((s) => (
                  <div
                    key={s.Name}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs"
                  >
                    <FolderCheck
                      size={18}
                      className={`mx-auto mb-1.5 ${s.Exists ? 'text-sky-400' : 'text-slate-500'}`}
                    />
                    <strong className="text-white block">{s.Name}</strong>
                    <span className="text-[10px] text-slate-400">
                      {s.Exists ? (lang === 'ar' ? 'متاح' : 'Available') : (lang === 'ar' ? 'غير موجود' : 'Missing')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Backups List */}
            {localBackups.length > 0 ? (
              <div className="flex flex-col gap-2">
                {localBackups.map((b) => (
                  <div
                    key={b.Name}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div>
                      <strong className="text-white text-sm block">{b.Name}</strong>
                      <span className="text-[11px] text-slate-400">
                        {formatBytes(b.SizeBytes, lang)} · {b.FileCount.toLocaleString(lang)} {lang === 'ar' ? 'ملف' : 'files'}
                      </span>
                      <small className="text-[10px] text-slate-400 block">{b.LastWriteAt}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => launchAction('BR03')}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    >
                      {lang === 'ar' ? 'تدقيق' : 'Verify'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800/60 text-slate-400 text-xs">
                {text.noLocalBackups}
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl">
            {stTools.map((t) => {
              const status = toolStatuses[t.ToolId];
              const isRunning = status === 'running';
              const needsAdmin = t.RequiresAdmin && !bridgeElevated;

              return (
                <article
                  key={t.ToolId}
                  className="flex flex-col justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-sky-400">{t.ToolId}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            t.RiskLevel === 'READ_ONLY'
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-sky-950 text-sky-300 border border-sky-800/60'
                          }`}
                        >
                          {t.RiskLevel}
                        </span>
                      </div>
                      {t.RequiresAdmin && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400">
                          <Lock size={10} />
                          Admin
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white">{pickName(t, lang)}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">{t.Purpose}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400">
                      {t.AnalyzeOnlySupported ? 'Analyze supported' : 'Execution'}
                    </span>
                    <button
                      type="button"
                      disabled={isRunning || needsAdmin}
                      onClick={() => launchAction(t.ToolId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition"
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
                  {lang === 'ar' ? 'تقرير تدقيق خزنة الاستعادة' : 'Recovery Vault Audit & Continuity Report'}
                </h3>
                <p className="text-xs text-slate-400">
                  {preview?.Safety?.Notice || 'State observations derived truthfully from VSS and file system.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => launchAction('BR04')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
              >
                {lang === 'ar' ? 'فحص شامل (BR04)' : 'Audit Vault (BR04)'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">{lang === 'ar' ? 'خط الاستعادة' : 'Recovery Vector'}</th>
                    <th className="pb-2">{lang === 'ar' ? 'الحالة الحالية' : 'Observed State'}</th>
                    <th className="pb-2 text-right">{lang === 'ar' ? 'التقييم' : 'Readiness'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Windows System Restore Points</td>
                    <td className="py-2.5 text-slate-300">{summary.restorePointsCount} active snapshots</td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">
                      {summary.restorePointsCount > 0 ? 'READY' : 'EXPOSED'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Volume Shadow Copies (VSS)</td>
                    <td className="py-2.5 text-slate-300">{summary.shadowCopiesCount} VSS snapshots</td>
                    <td className="py-2.5 text-right font-bold text-sky-400">
                      {summary.shadowCopiesCount > 0 ? 'ACTIVE' : 'NONE'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Local User Profile Archives</td>
                    <td className="py-2.5 text-slate-300">
                      {summary.localBackupsCount} archive(s) ({formatBytes(summary.latestBackupBytes, lang)})
                    </td>
                    <td className="py-2.5 text-right font-bold text-cyan-400">
                      {summary.localBackupsCount > 0 ? 'READY' : 'UNARCHIVED'}
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

      {/* Confirmation Dialog */}
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
