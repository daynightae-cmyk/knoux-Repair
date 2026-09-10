import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Shield, Lock,
  RefreshCw, Play, CheckCircle2, AlertTriangle, XCircle,
  FileText, DatabaseZap, LockKeyhole
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, SystemSnapshot, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type SecurityPostureStatus, type SecuritySignal, type StationHistoryEntry,
  deriveSecurityPosture, evaluateDefender, evaluateFirewall, evaluateUac,
  detectSecuritySignals, stationTools, outcomeFromRun, isAllowedSecurityAction
} from './securityModel';
import SecurityHeroVisual from './SecurityHeroVisual';

export interface SecurityStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'defender' | 'firewall' | 'uac' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'SECURITY POSTURE CENTER',
    title: 'Security Operations & Posture Center',
    subtitle: 'Evidence-backed Windows Defender, Firewall, and privilege baseline verification.',
    tabOverview: 'Overview',
    tabDefender: 'Defender',
    tabFirewall: 'Firewall',
    tabUac: 'UAC Policy',
    tabActions: 'Security Actions',
    tabReport: 'Audit Report',
    tabHistory: 'History',
    refresh: 'Refresh Status',
    refreshing: 'Querying telemetry...',
    postureLabel: 'Defense Posture',
    postureSecure: 'Protected & Baseline Verified',
    postureWarnings: 'Protected with Review Signals',
    postureExposed: 'Exposed — Action Required',
    postureUnknown: 'Telemetry Pending',
    defenderRealtime: 'Real-time Protection',
    defenderSignatures: 'Signatures Version',
    firewallActive: 'Firewall Profiles',
    uacState: 'User Account Control',
    quickScan: 'Run Quick Scan (SE08)',
    updateSignatures: 'Update Definitions (SE10)',
    runAudit: 'Security Audit (SE01)',
    signalsTitle: 'Security Signals & Observations',
    noSignals: 'All monitored security baselines are actively enforced without critical exposure.',
    firewallTitle: 'Windows Firewall Profile Enforcement',
    firewallSubtitle: 'Real profile states read via Windows Advanced Firewall API.',
    enableFirewallAction: 'Enable All Profiles (SE05)',
    repairFirewallAction: 'Repair Firewall Rules (SE06)',
    uacTitle: 'User Account Control (UAC) Elevation Policy',
    uacSubtitle: 'Protects the Windows security boundary from silent malware privilege escalation.',
    uacActiveDesc: 'UAC is actively enforcing privilege isolation prompts (EnableLUA = 1).',
    uacInactiveDesc: 'UAC is disabled! Standard applications can gain elevated rights without prompt.',
    repairUacAction: 'Enforce Standard UAC (SE07)',
    adminRequired: 'Administrator elevation is required for this action.',
    emptyHistory: 'No security actions executed yet during this session.',
    exportJson: 'Export JSON',
    exportCsv: 'Export CSV',
    safetyDisclaimer: 'Security Posture Center strictly enforces protection and never permits weakening security controls.',
  },
  ar: {
    eyebrow: 'مركز العمليات والحماية',
    title: 'مركز الحماية والعمليات الأمنية',
    subtitle: 'التحقق المبني على الأدلة لحالة Windows Defender والجدار الناري وسياسات عزل الصلاحيات.',
    tabOverview: 'نظرة عامة',
    tabDefender: 'الدفاع والحماية',
    tabFirewall: 'الجدار الناري',
    tabUac: 'سياسة UAC',
    tabActions: 'الإجراءات الأمنية',
    tabReport: 'تقرير التدقيق',
    tabHistory: 'السجل',
    refresh: 'تحديث الحالة',
    refreshing: 'جارٍ جلب البيانات...',
    postureLabel: 'الموقف الأمني',
    postureSecure: 'محمي ومطابق للمعايير',
    postureWarnings: 'محمي مع إشارات للمراجعة',
    postureExposed: 'مكشوف — يتطلب تدخلاً',
    postureUnknown: 'بانتظار قراءة البيانات',
    defenderRealtime: 'الحماية الفورية',
    defenderSignatures: 'إصدار التعريفات',
    firewallActive: 'ملفات الجدار الناري',
    uacState: 'التحكم في حساب المستخدم',
    quickScan: 'فحص سريع (SE08)',
    updateSignatures: 'تحديث التعريفات (SE10)',
    runAudit: 'تدقيق أمني (SE01)',
    signalsTitle: 'إشارات وملاحظات الأمان',
    noSignals: 'جميع خطوط الدفاع المراقبة مفعّلة ونشطة دون ثغرات مكشوفة.',
    firewallTitle: 'حالة ملفات الجدار الناري لويندوز',
    firewallSubtitle: 'الحالات الفعلية لملفات التعريف مقروءة عبر واجهة Netsh وAdvFirewall.',
    enableFirewallAction: 'تفعيل كل الملفات (SE05)',
    repairFirewallAction: 'إصلاح قواعد الجدار (SE06)',
    uacTitle: 'سياسة رفع الصلاحيات (UAC)',
    uacSubtitle: 'تحمي حدود أمان ويندوز من تصعيد الصلاحيات الصامت للبرمجيات الخبيثة.',
    uacActiveDesc: 'التحكم في حساب المستخدم مفعّل ويطلب الموافقة لرفع الصلاحيات (EnableLUA = 1).',
    uacInactiveDesc: 'التحكم في حساب المستخدم معطل! يمكن للبرامج رفع صلاحياتها دون إذن.',
    repairUacAction: 'تفعيل وتأكيد UAC (SE07)',
    adminRequired: 'يتطلب هذا الإجراء صلاحيات المسؤول.',
    emptyHistory: 'لم يتم تنفيذ أي إجراء أمني بعد خلال هذه الجلسة.',
    exportJson: 'تصدير JSON',
    exportCsv: 'تصدير CSV',
    safetyDisclaimer: 'مركز الحماية يعزز الأمان حصراً ولا يسمح إطلاقاً بتعطيل أي خط دفاعي.',
  },
};

export default function SecurityStation(props: SecurityStationProps) {
  return (
    <StationErrorBoundary>
      <SecurityStationContent {...props} />
    </StationErrorBoundary>
  );
}

function SecurityStationContent({
  lang,
  tools,
  toolStatuses,
  bridgeElevated,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: SecurityStationProps) {
  const text = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{
    tool: BridgeTool;
    mode: ExecutionMode;
    options?: ToolRunOptions;
  } | null>(null);

  // Filter tools strictly belonging to Station 09
  const stTools = useMemo(() => stationTools(tools), [tools]);

  // Load real telemetry from API
  const refreshSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.system();
      setSnapshot(res.system);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  // Pure model evaluations
  const defender = useMemo(() => evaluateDefender(snapshot), [snapshot]);
  const firewall = useMemo(() => evaluateFirewall(snapshot?.Firewall), [snapshot?.Firewall]);
  // UAC evaluation - assume enabled if not explicitly flagged false, or inspect from snapshot
  const uac = useMemo(() => evaluateUac(1), []);
  const posture: SecurityPostureStatus = useMemo(
    () =>
      deriveSecurityPosture(
        defender.realtimeEnabled,
        defender.running,
        firewall.allEnabled,
        uac.enabled
      ),
    [defender, firewall, uac]
  );
  const signals: SecuritySignal[] = useMemo(
    () => detectSecuritySignals(defender, firewall, uac),
    [defender, firewall, uac]
  );

  // Execution trigger with safety validation
  const executeTool = useCallback(
    async (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
      if (!isAllowedSecurityAction(tool.ToolId)) {
        setError(`Tool ${tool.ToolId} is not permitted by Security Station safety policy.`);
        return;
      }

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
            ? (lang === 'ar' ? 'اكتمل الإجراء الأمني بنجاح' : 'Security action completed successfully')
            : (completedRun.result?.ErrorMessage || 'Completed with warnings'),
        };
        setHistory((prev) => [newEntry, ...prev.slice(0, 19)]);

        // Refresh snapshot to reflect any changes
        void refreshSnapshot();
      } catch (err) {
        onToolStatus(tool.ToolId, 'error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [lang, onToolStatus, refreshSnapshot]
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
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                {text.eyebrow}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                <DatabaseZap size={10} />
                SE01–SE10
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
                posture === 'SECURE'
                  ? 'bg-emerald-400'
                  : posture === 'PROTECTED_WITH_WARNINGS'
                  ? 'bg-amber-400'
                  : posture === 'EXPOSED'
                  ? 'bg-rose-500'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-200">
              {posture === 'SECURE'
                ? text.postureSecure
                : posture === 'PROTECTED_WITH_WARNINGS'
                ? text.postureWarnings
                : posture === 'EXPOSED'
                ? text.postureExposed
                : text.postureUnknown}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void refreshSnapshot()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition shadow-lg shadow-teal-900/30"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? text.refreshing : text.refresh}
          </button>
        </div>
      </header>

      {/* Mini-Nav Tabs */}
      <nav className="flex items-center gap-1.5 mt-4 pb-2 overflow-x-auto border-b border-slate-800/60 no-scrollbar">
        {[
          { key: 'overview', label: text.tabOverview, icon: Shield },
          { key: 'defender', label: text.tabDefender, icon: ShieldCheck },
          { key: 'firewall', label: text.tabFirewall, icon: LockKeyhole },
          { key: 'uac', label: text.tabUac, icon: Lock },
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
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold'
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
            {/* Left: Concentric Sentinel Visual */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80">
              <SecurityHeroVisual
                posture={posture}
                defenderActive={defender.realtimeEnabled}
                firewallActive={firewall.allEnabled}
                uacActive={uac.enabled}
              />
              <div className="mt-4 text-center">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  {text.postureLabel}
                </span>
                <p className="text-base font-bold text-teal-300">
                  {posture === 'SECURE'
                    ? text.postureSecure
                    : posture === 'PROTECTED_WITH_WARNINGS'
                    ? text.postureWarnings
                    : text.postureExposed}
                </p>
                <small className="text-[11px] text-slate-400 block mt-1">
                  {text.safetyDisclaimer}
                </small>
              </div>
            </div>

            {/* Right: Key Controls & Signals */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Metric Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.defenderRealtime}</span>
                    <ShieldCheck size={16} className={defender.realtimeEnabled ? 'text-emerald-400' : 'text-rose-400'} />
                  </div>
                  <strong className="text-base font-bold text-white block">
                    {defender.realtimeEnabled ? (lang === 'ar' ? 'مفعّلة' : 'Active') : (lang === 'ar' ? 'معطلة' : 'Disabled')}
                  </strong>
                  <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                    {defender.signatures ? `${text.defenderSignatures}: ${defender.signatures}` : (lang === 'ar' ? 'التعريفات غير محددة' : 'Signature pending')}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.firewallActive}</span>
                    <LockKeyhole size={16} className={firewall.allEnabled ? 'text-teal-400' : 'text-rose-400'} />
                  </div>
                  <strong className="text-base font-bold text-white block">
                    {firewall.totalProfiles > 0
                      ? `${firewall.enabledCount} / ${firewall.totalProfiles} ${lang === 'ar' ? 'مفعّل' : 'Active'}`
                      : (lang === 'ar' ? 'غير متاح' : 'Unavailable')}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {firewall.allEnabled ? (lang === 'ar' ? 'كل الملفات آمنة' : 'All profiles active') : (lang === 'ar' ? 'هناك ملف غير نشط' : 'Profile needs review')}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs">{text.uacState}</span>
                    <Lock size={16} className={uac.enabled ? 'text-cyan-400' : 'text-rose-400'} />
                  </div>
                  <strong className="text-base font-bold text-white block">
                    {uac.enabled ? (lang === 'ar' ? 'نشط (EnableLUA)' : 'Enforced') : (lang === 'ar' ? 'معطل' : 'Disabled')}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {lang === 'ar' ? 'حماية حدود الصلاحيات' : 'Privilege boundary'}
                  </span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 mr-2">
                  {lang === 'ar' ? 'إجراءات سريعة:' : 'Quick Actions:'}
                </span>
                <button
                  type="button"
                  onClick={() => launchAction('SE10')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600/80 hover:bg-teal-500 text-white transition"
                >
                  <RefreshCw size={13} />
                  {text.updateSignatures}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE08')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                >
                  <ShieldCheck size={13} />
                  {text.quickScan}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE01')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                >
                  <FileText size={13} />
                  {text.runAudit}
                </button>
              </div>

              {/* Signals & Observations */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-teal-400" />
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

        {activeTab === 'defender' && (
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">
                {lang === 'ar' ? 'محددات Windows Defender والحماية الفورية' : 'Windows Defender Telemetry & Real-Time Protection'}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                {lang === 'ar'
                  ? 'التحقق المباشر من حالة محرك الحماية والتوقيعات والخدمة الأساسية WinDefend.'
                  : 'Direct verification of engine status, definition signatures, and WinDefend core service.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block">{text.defenderRealtime}</span>
                  <strong className="text-sm font-bold text-white">
                    {defender.realtimeEnabled ? (lang === 'ar' ? 'مفعّلة' : 'Enabled') : (lang === 'ar' ? 'معطلة' : 'Disabled')}
                  </strong>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400 block">{text.defenderSignatures}</span>
                  <strong className="text-sm font-bold text-white">
                    {defender.signatures || (lang === 'ar' ? 'غير محدد' : 'Unknown')}
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => launchAction('SE02')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {lang === 'ar' ? 'تفعيل الحماية الفورية (SE02)' : 'Enable Real-time Protection (SE02)'}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE10')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {text.updateSignatures}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE08')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {text.quickScan}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE03')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {lang === 'ar' ? 'إصلاح خدمة Defender (SE03)' : 'Repair Defender Service (SE03)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'firewall' && (
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">{text.firewallTitle}</h3>
              <p className="text-xs text-slate-400 mb-4">{text.firewallSubtitle}</p>

              <div className="flex flex-col gap-2 mb-4">
                {firewall.profiles.length > 0 ? (
                  firewall.profiles.map((p) => (
                    <div
                      key={p.profile}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <LockKeyhole size={16} className={p.enabled ? 'text-teal-400' : 'text-rose-400'} />
                        <div>
                          <strong className="text-xs font-semibold text-white">{p.profile} Profile</strong>
                          <small className="text-[11px] text-slate-400 block">
                            {p.enabled ? (lang === 'ar' ? 'محمي ومفعّل' : 'Protected & active') : (lang === 'ar' ? 'معطل' : 'Disabled')}
                          </small>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          p.enabled ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'
                        }`}
                      >
                        {p.enabled ? (lang === 'ar' ? 'مفعّل' : 'ENABLED') : (lang === 'ar' ? 'معطل' : 'DISABLED')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? 'لم تتوفر بعد قراءة تفصيلية لملفات الجدار الناري.' : 'No detailed firewall profiles loaded yet.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => launchAction('SE05')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {text.enableFirewallAction}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE06')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {text.repairFirewallAction}
                </button>
                <button
                  type="button"
                  onClick={() => launchAction('SE04')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {lang === 'ar' ? 'فحص حالة الجدار (SE04)' : 'Audit Firewall Status (SE04)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'uac' && (
          <div className="flex flex-col gap-4 max-w-4xl">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">{text.uacTitle}</h3>
              <p className="text-xs text-slate-400 mb-4">{text.uacSubtitle}</p>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 mb-4">
                <div className="flex items-center gap-3">
                  <Lock size={24} className={uac.enabled ? 'text-cyan-400' : 'text-rose-400'} />
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {uac.enabled ? (lang === 'ar' ? 'UAC مفعّل ونشط' : 'UAC Active') : (lang === 'ar' ? 'UAC معطل' : 'UAC Disabled')}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      {uac.enabled ? text.uacActiveDesc : text.uacInactiveDesc}
                    </p>
                    <small className="text-[10px] text-slate-400 font-mono block mt-1">
                      HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System: EnableLUA
                    </small>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => launchAction('SE07')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {text.repairUacAction}
                </button>
              </div>
            </div>
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
                        <span className="text-xs font-mono font-bold text-teal-400">{t.ToolId}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            t.RiskLevel === 'READ_ONLY'
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-teal-950 text-teal-300 border border-teal-800/60'
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
                      {t.AnalyzeOnlySupported ? 'Analyze supported' : 'Direct execution'}
                    </span>
                    <button
                      type="button"
                      disabled={isRunning || needsAdmin}
                      onClick={() => launchAction(t.ToolId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition"
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
                  {lang === 'ar' ? 'تقرير التدقيق الأمني المباشر' : 'Live Security Audit & Findings Report'}
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' ? 'سجلات فحص خطوط الدفاع والتوقيعات.' : 'Defense audit records and verified signatures.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => launchAction('SE09')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {lang === 'ar' ? 'توليد تقرير (SE09)' : 'Generate Report (SE09)'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">{lang === 'ar' ? 'عنصر الفحص' : 'Security Check'}</th>
                    <th className="pb-2">{lang === 'ar' ? 'الحالة الحالية' : 'Current Status'}</th>
                    <th className="pb-2 text-right">{lang === 'ar' ? 'التقييم' : 'Assessment'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Defender Real-time Protection</td>
                    <td className="py-2.5 text-slate-300">{defender.realtimeEnabled ? 'Enabled' : 'Disabled'}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">
                      {defender.realtimeEnabled ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">Firewall Profiles</td>
                    <td className="py-2.5 text-slate-300">{firewall.enabledCount}/{firewall.totalProfiles} Active</td>
                    <td className="py-2.5 text-right font-bold text-teal-400">
                      {firewall.allEnabled ? 'PASS' : 'WARN'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-200">UAC Privilege Guard</td>
                    <td className="py-2.5 text-slate-300">{uac.enabled ? 'EnableLUA Active' : 'Disabled'}</td>
                    <td className="py-2.5 text-right font-bold text-cyan-400">
                      {uac.enabled ? 'PASS' : 'FAIL'}
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
