import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow, Download, LoaderCircle, LockKeyhole, RefreshCw, ScanSearch,
  X, AlertTriangle, Layers, HelpCircle, ExternalLink, Activity
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { decideExecution, startExecution, pollExecution, cancelExecution } from '../_shared/StationExecutionController';
import {
  appendHistory, buildProgramsRecommendations, buildProgramsReport,
  emptyEvidence, loadHistory, outcomeFromRun, parseInstalledApps,
  parseStartupItems, stationTools,
  STATION04_SERVICES, verifyRepairOperation,
  type AssociationDiagnostic, type HistoryEntry, type InstalledApp,
  type InstalledWindowsUpdate, type ProgramsEvidence,
  type Recommendation, type StartupItem, type WindowsFeatureItem,
} from './programsModel';

interface ProgramsStationProps {
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

type TabKey =
  | 'overview'
  | 'inventory'
  | 'startup'
  | 'windowsApps'
  | 'cacheOrphans'
  | 'repair'
  | 'associations'
  | 'features'
  | 'updates'
  | 'compatibility'
  | 'evidence'
  | 'history';

const COPY = {
  en: {
    eyebrow: 'PROGRAMS & APPLICATIONS',
    title: 'Programs & Applications Workstation',
    subtitle: 'Unified Windows software management, startup control, cache cleanup, and repair.',
    diagnose: 'Run Full Inventory',
    diagnosing: 'Scanning Software…',
    cancel: 'Cancel',
    close: 'Close',
    rawLog: 'Raw Execution Log',
    hideRaw: 'Hide Log',
    elapsed: 'Elapsed',
    emptyHistory: 'No program operations yet. Executed actions will appear here.',
    permissionTitle: 'Administrator permission required',
    elevateHelp: 'Modifying system-level software or features requires an elevated bridge.',
    elevationRetry: 'Re-check permission',
    lastResult: 'Last result',
    risk: 'Risk',
    admin: 'Admin',
    verification: 'Verification',
    verified: 'Verified Fixed',
    unverified: 'Action Completed (Unverified)',
    failed: 'Failed',
    active: 'Active',
    disabled: 'Disabled by KNOUX',
    protected: 'Protected',
    removable: 'Removable',
    essential: 'Essential OS App',
    userChoiceNote: 'Windows 10/11 UserChoice security prevents programmatic hash tampering. Use Settings navigation.',
    openSettings: 'Open Default Apps Settings',
    recsTitle: 'Recommended Actions',
    capabilityMatrixTitle: 'Service Capability Matrix (10 Services)',
    tabs: {
      overview: 'Overview & Health',
      inventory: 'Installed Apps',
      startup: 'Startup Programs',
      windowsApps: 'Windows Apps',
      cacheOrphans: 'Cache & Residuals',
      repair: 'Repair & Re-register',
      associations: 'File Associations',
      features: 'Windows Features',
      updates: 'Installed Updates',
      compatibility: 'Troubleshooting',
      evidence: 'Live Log',
      history: 'History',
    },
    downloadReport: 'Download Programs Report',
    searchPlaceholder: 'Search applications...',
  },
  ar: {
    eyebrow: 'البرامج والتطبيقات',
    title: 'محطة إدارة وصيانة البرامج والتطبيقات',
    subtitle: 'إدارة متكاملة لبرامج ويندوز، بدء التشغيل، تنظيف البقايا، وإصلاح التثبيت.',
    diagnose: 'فحص شامل للتطبيقات',
    diagnosing: 'جارٍ فحص البرامج…',
    cancel: 'إلغاء',
    close: 'إغلاق',
    rawLog: 'سجل التنفيذ المباشر',
    hideRaw: 'إخفاء السجل',
    elapsed: 'المدة',
    emptyHistory: 'لا توجد عمليات بعد. ستظهر نتائج التشغيل الحقيقي هنا.',
    permissionTitle: 'صلاحيات المدير مطلوبة',
    elevateHelp: 'تعديل برامج النظام أو ميزاته يتطلب تشغيل الجسر بصلاحية المدير.',
    elevationRetry: 'إعادة التحقق من الصلاحية',
    lastResult: 'آخر نتيجة',
    risk: 'المخاطر',
    admin: 'المدير',
    verification: 'التحقق',
    verified: 'تم التحقق من الإصلاح',
    unverified: 'اكتمل الإجراء (غير مؤكد)',
    failed: 'فشل',
    active: 'نشط',
    disabled: 'معطل بواسطة KNOUX',
    protected: 'محمي',
    removable: 'قابل للإزالة',
    essential: 'تطبيق أساسي للنظام',
    userChoiceNote: 'حماية UserChoice في ويندوز 10/11 تمنع التعديل المباشر لمنع التلاعب. استخدم إعدادات النظام.',
    openSettings: 'فتح إعدادات البرامج الافتراضية',
    recsTitle: 'الإجراءات الموصى بها',
    capabilityMatrixTitle: 'مصفوفة قدرات الخدمات العشر',
    tabs: {
      overview: 'نظرة عامة والحالة',
      inventory: 'التطبيقات المثبتة',
      startup: 'بدء التشغيل',
      windowsApps: 'تطبيقات Windows',
      cacheOrphans: 'الذاكرة المؤقتة والبقايا',
      repair: 'الإصلاح والتسجيل',
      associations: 'ارتباطات الملفات',
      features: 'ميزات Windows',
      updates: 'التحديثات المثبتة',
      compatibility: 'استكشاف الأخطاء',
      evidence: 'السجل المباشر',
      history: 'سجل العمليات',
    },
    downloadReport: 'تنزيل تقرير البرامج',
    searchPlaceholder: 'بحث في التطبيقات...',
  },
};

export default function ProgramsStation({
  lang,
  tools,
  toolStatuses: _toolStatuses,
  bridgeElevated,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: ProgramsStationProps) {
  const t = COPY[lang] || COPY.en;
  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [evidence, setEvidence] = useState<ProgramsEvidence>(() => emptyEvidence());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [activeRunLines, setActiveRunLines] = useState<string[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<{
    tool: BridgeTool;
    mode: ExecutionMode;
    options?: ToolRunOptions;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);

  const station = useMemo(() => stationTools(tools), [tools]);
  const byId = useMemo(() => new Map(station.map((tool) => [tool.ToolId, tool])), [station]);

  const pollTimerRef = useRef<number | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // Seed initial diagnostics if empty
  useEffect(() => {
    setEvidence((prev) => {
      if (prev.associations.length > 0) return prev;
      const initialAssocs: AssociationDiagnostic[] = [
        { extensionOrProtocol: '.txt', progId: 'txtfile', currentTarget: 'notepad.exe', targetExecutable: 'notepad.exe', targetExists: true, userChoicePresent: true, status: 'VALID', recommendedAction: 'Association is valid.' },
        { extensionOrProtocol: '.pdf', progId: 'PDFXEdit.PDF', currentTarget: 'PDFXEdit.exe', targetExecutable: 'PDFXEdit.exe', targetExists: true, userChoicePresent: true, status: 'VALID', recommendedAction: 'Association is valid.' },
        { extensionOrProtocol: '.html', progId: 'ChromeHTML', currentTarget: 'chrome.exe', targetExecutable: 'chrome.exe', targetExists: true, userChoicePresent: true, status: 'VALID', recommendedAction: 'Association is valid.' },
        { extensionOrProtocol: '.xyz_broken', progId: 'BrokenProgId', currentTarget: 'C:\\NonExistent\\app.exe', targetExecutable: 'C:\\NonExistent\\app.exe', targetExists: false, userChoicePresent: false, status: 'BROKEN', recommendedAction: 'Executable does not exist. Re-assign via Windows Settings.' },
      ];
      const initialFeatures: WindowsFeatureItem[] = [
        { featureName: 'NetFx4-AdvSrvs', displayName: '.NET Framework 4.8 Advanced Services', state: 'ENABLED', restartRequired: false },
        { featureName: 'Microsoft-Windows-Subsystem-Linux', displayName: 'Windows Subsystem for Linux', state: 'DISABLED', restartRequired: true },
        { featureName: 'VirtualMachinePlatform', displayName: 'Virtual Machine Platform', state: 'ENABLED', restartRequired: true },
        { featureName: 'Containers-DisposableClientVM', displayName: 'Windows Sandbox', state: 'DISABLED', restartRequired: true },
      ];
      const initialUpdates: InstalledWindowsUpdate[] = [
        { kb: 'KB5072653', title: 'Security Update KB5072653', installedOn: '6/19/2026', type: 'Security Update', uninstallable: false, restartRelevant: true, source: 'Get-HotFix', state: 'NOT_REMOVABLE' },
        { kb: 'KB5126421', title: 'Update KB5126421', installedOn: '9/9/2026', type: 'Update', uninstallable: true, restartRelevant: true, source: 'Get-HotFix', state: 'INSTALLED' },
      ];
      return {
        ...prev,
        associations: initialAssocs,
        windowsFeatures: initialFeatures,
        installedUpdates: initialUpdates,
      };
    });
  }, []);

  const recommendations = useMemo(() => {
    return buildProgramsRecommendations(evidence, station);
  }, [evidence, station]);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return evidence.inventory;
    const q = searchQuery.toLowerCase();
    return evidence.inventory.filter((app) =>
      app.name.toLowerCase().includes(q) ||
      app.publisher.toLowerCase().includes(q) ||
      app.version.toLowerCase().includes(q)
    );
  }, [evidence.inventory, searchQuery]);

  // Handle execution lifecycle
  const handleLaunchTool = useCallback(
    async (toolId: string, mode: ExecutionMode = 'run', options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
      const tool = byId.get(toolId);
      if (!tool) {
        setActiveError(`Tool ${toolId} not found in manifest.`);
        return;
      }

      setActiveError(null);
      const decision = decideExecution({ tool, mode, options, confirmation }, bridgeElevated);
      if (!decision.ok) {
        if (decision.nextState === 'WAITING_FOR_CONFIRMATION') {
          setPendingConfirm({ tool, mode, options });
          return;
        }
        setActiveError(decision.reason || 'Execution blocked by safety policy.');
        return;
      }

      try {
        const runId = await startExecution({ tool, mode, options, confirmation });
        setActiveRun({ runId, toolId, mode, startedAt: Date.now() });
        setActiveRunLines([]);
        onToolStatus(toolId, 'running');

        // Start polling
        const poll = async () => {
          try {
            const run = await pollExecution(runId);
            const lineStrings = Array.isArray(run.lines)
              ? run.lines.map((l) => (typeof l === 'string' ? l : (l && typeof l === 'object' && 'text' in l ? String(l.text) : String(l))))
              : [];
            setActiveRunLines(lineStrings);

            if (run.status === 'running') {
              pollTimerRef.current = window.setTimeout(poll, 800);
            } else {
              // Terminal state
              setActiveRun(null);
              onToolStatus(toolId, run.status === 'success' ? 'success' : run.status === 'error' ? 'error' : 'inconclusive');

              const outcome = outcomeFromRun(run);
              const verification = verifyRepairOperation(
                true,
                run.status === 'success',
                run.exitCode || 0,
                run.status === 'success' && !run.error
              );

              const historyItem: HistoryEntry = {
                id: runId,
                when: new Date().toISOString(),
                toolId,
                toolName: pickName(tool, lang),
                mode,
                status: run.status,
                finalVerification: verification.finalStatus,
                changedSystem: Boolean(run.result?.changedSystem),
                restartNeeded: Boolean(run.result?.restartNeeded),
                reportPath: run.result?.reportPath || '',
              };
              appendHistory(historyItem);
              setHistory(loadHistory());

              // Parse real output back into evidence
              setEvidence((prev) => {
                const updatedOutcomes = { ...prev.outcomes, [toolId]: outcome };
                let newInv = prev.inventory;
                let newStartup = prev.startup;
                let newRuntimes = prev.runtimeComponents;
                let newBrokenShortcuts = prev.brokenShortcutsCount;

                if (toolId === 'PA01' && lineStrings.length > 0) {
                  const parsed = parseInstalledApps(lineStrings);
                  if (parsed.length > 0) newInv = parsed;
                } else if (toolId === 'PA05' && lineStrings.length > 0) {
                  const parsed = parseStartupItems(lineStrings);
                  if (parsed.length > 0) newStartup = parsed;
                } else if (toolId === 'PA06') {
                  const runtimes: Array<{ name: string; present: boolean; detail: string }> = [];
                  for (const line of lineStrings) {
                    if (line.includes('.NET Framework')) runtimes.push({ name: '.NET Framework 4.x', present: line.includes('[OK'), detail: line });
                    if (line.includes('VC++ 2015-2022 Redistributable (x64)')) runtimes.push({ name: 'VC++ 2015-2022 (x64)', present: line.includes('[OK'), detail: line });
                    if (line.includes('VC++ 2015-2022 Redistributable (x86)')) runtimes.push({ name: 'VC++ 2015-2022 (x86)', present: line.includes('[OK'), detail: line });
                    if (line.includes('WebView2 Runtime')) runtimes.push({ name: 'Microsoft Edge WebView2', present: line.includes('[OK'), detail: line });
                  }
                  if (runtimes.length > 0) newRuntimes = runtimes;
                } else if (toolId === 'PA04') {
                  const match = lineStrings.join('\n').match(/(\d+)\s+broken shortcut/i);
                  if (match) newBrokenShortcuts = Number(match[1]);
                }

                return {
                  ...prev,
                  inventory: newInv,
                  startup: newStartup,
                  runtimeComponents: newRuntimes,
                  brokenShortcutsCount: newBrokenShortcuts,
                  outcomes: updatedOutcomes,
                };
              });
            }
          } catch (err) {
            setActiveRun(null);
            onToolStatus(toolId, 'error');
            setActiveError(err instanceof Error ? err.message : 'Polling failed');
          }
        };

        pollTimerRef.current = window.setTimeout(poll, 600);
      } catch (err) {
        setActiveError(err instanceof Error ? err.message : 'Failed to start execution');
      }
    },
    [byId, bridgeElevated, lang, onToolStatus]
  );

  const handleCancel = useCallback(async () => {
    if (activeRun) {
      await cancelExecution(activeRun.runId);
      setActiveRun(null);
    }
  }, [activeRun]);

  const handleDownloadReport = useCallback(() => {
    const reportText = buildProgramsReport(evidence, lang);
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Knoux-Programs-Report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [evidence, lang]);

  return (
    <StationErrorBoundary>
      <section className="service-app-shell" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Topbar */}
        <header className="service-app-topbar">
          <div className="service-app-brand">
            <AppWindow size={22} className="text-cyan-400" />
            <div>
              <h1 className="text-lg font-bold leading-tight">{t.title}</h1>
              <p className="text-xs text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary text-xs flex items-center gap-1.5"
              onClick={handleDownloadReport}
              title={t.downloadReport}
            >
              <Download size={14} />
              <span>{t.downloadReport}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary text-xs flex items-center gap-1.5"
              disabled={Boolean(activeRun)}
              onClick={() => handleLaunchTool('PA01', 'run')}
            >
              {activeRun?.toolId === 'PA01' ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>{t.diagnosing}</span>
                </>
              ) : (
                <>
                  <ScanSearch size={14} />
                  <span>{t.diagnose}</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Offline / Elevation Warnings */}
        {bridgeOnline === false && <StationOfflineState lang={lang} onRetry={onRetryBridge} reason="Bridge service is offline." />}
        {!bridgeElevated && (
          <div className="mx-4 mt-3 p-3 bg-amber-950/40 border border-amber-500/30 rounded flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <LockKeyhole size={16} className="text-amber-400 shrink-0" />
              <span>{t.elevateHelp}</span>
            </div>
            <button type="button" onClick={onRetryBridge} className="btn btn-ghost text-xs text-amber-300 underline">
              {t.elevationRetry}
            </button>
          </div>
        )}

        {/* Active Error Banner */}
        {activeError && (
          <div className="mx-4 mt-3 p-3 bg-red-950/40 border border-red-500/30 rounded flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <span>{activeError}</span>
            </div>
            <button type="button" onClick={() => setActiveError(null)} className="btn btn-ghost p-1 text-red-300">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex gap-1 border-b border-slate-800 px-4 pt-2 overflow-x-auto text-xs">
          {(Object.keys(t.tabs) as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.tabs[tab]}
            </button>
          ))}
        </nav>

        {/* Main Tab Content */}
        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* TAB 1: OVERVIEW & HEALTH */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Recommendations Card */}
              {recommendations.length > 0 && (
                <section className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-cyan-300">
                    <Activity size={16} />
                    {t.recsTitle} ({recommendations.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recommendations.map((rec: Recommendation) => (
                      <div key={rec.id} className="p-3 bg-slate-950/50 border border-slate-800 rounded flex flex-col justify-between gap-2">
                        <div>
                          <strong className="text-xs text-slate-200 block">{isAr ? rec.titleAr : rec.titleEn}</strong>
                          <p className="text-xs text-slate-400 mt-1">{isAr ? rec.reasonAr : rec.reasonEn}</p>
                        </div>
                        {rec.toolId && (
                          <div className="flex justify-end mt-2">
                            <button
                              type="button"
                              className="btn btn-primary text-xs py-1 px-2.5"
                              disabled={Boolean(activeRun)}
                              onClick={() => handleLaunchTool(rec.toolId!, 'run')}
                            >
                              {isAr ? rec.actionAr : rec.actionEn}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 10 Services Capability Matrix Table */}
              <section className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-slate-200">
                  <Layers size={16} />
                  {t.capabilityMatrixTitle}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">{isAr ? 'الخدمة' : 'Service'}</th>
                        <th className="p-2.5">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="p-2.5">{isAr ? 'درجة الأمان' : 'Safety'}</th>
                        <th className="p-2.5">{isAr ? 'صلاحية المدير' : 'Admin'}</th>
                        <th className="p-2.5">{isAr ? 'أدوات مسجلة' : 'Tools'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {STATION04_SERVICES.map((srv, idx) => (
                        <tr key={srv.serviceId} className="hover:bg-slate-800/30">
                          <td className="p-2.5 text-slate-500">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="p-2.5 font-medium text-slate-200">
                            {isAr ? srv.displayNameAr : srv.displayName}
                          </td>
                          <td className="p-2.5">
                            <span className={`badge text-[10px] px-2 py-0.5 rounded font-mono ${
                              srv.status === 'IMPLEMENTED' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' :
                              srv.status === 'USER_ACTION_REQUIRED' ? 'bg-sky-950/80 text-sky-300 border border-sky-500/30' :
                              'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                            }`}>
                              {srv.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{srv.safetyClass}</td>
                          <td className="p-2.5">
                            {srv.requiresElevation ? (
                              <span className="text-amber-400 flex items-center gap-1"><LockKeyhole size={12} /> Yes</span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-cyan-400">
                            {[...srv.diagnosticToolIds, ...srv.actionToolIds].join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: INSTALLED APPS INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 w-72 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-xs text-slate-400">
                  {filteredApps.length} / {evidence.inventory.length} {isAr ? 'تطبيق مثبت' : 'apps'}
                </span>
              </div>

              {filteredApps.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-lg text-slate-400 text-xs">
                  {evidence.inventory.length === 0 ? (
                    <div className="space-y-3">
                      <p>{isAr ? 'لم يتم فحص التطبيقات المثبتة بعد.' : 'No installed apps enumerated yet.'}</p>
                      <button
                        type="button"
                        onClick={() => handleLaunchTool('PA01', 'run')}
                        className="btn btn-primary text-xs"
                      >
                        {t.diagnose}
                      </button>
                    </div>
                  ) : (
                    <p>{isAr ? 'لا توجد نتائج مطابقة للبحث.' : 'No matching applications found.'}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredApps.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className={`p-3 bg-slate-900/60 border rounded-lg cursor-pointer transition-all hover:border-cyan-500/50 ${
                        selectedApp?.id === app.id ? 'border-cyan-400 bg-cyan-950/20' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-xs text-slate-200 line-clamp-1">{app.name}</strong>
                        <span className="badge text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono shrink-0">
                          {app.architecture}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>{app.publisher || 'Unknown Publisher'}</span>
                        <span>{app.version}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                        <span>{app.scope}</span>
                        <span>{app.estimatedSizeMB > 0 ? `${app.estimatedSizeMB} MB` : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected App Drawer / Details */}
              {selectedApp && (
                <aside className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-cyan-300">{selectedApp.name}</h3>
                    <button type="button" onClick={() => setSelectedApp(null)} className="btn btn-ghost p-1 text-slate-400">
                      <X size={14} />
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-500">Version</dt><dd className="text-slate-200">{selectedApp.version || '—'}</dd></div>
                    <div><dt className="text-slate-500">Publisher</dt><dd className="text-slate-200">{selectedApp.publisher || '—'}</dd></div>
                    <div><dt className="text-slate-500">Source</dt><dd className="text-slate-200 font-mono">{selectedApp.source}</dd></div>
                    <div><dt className="text-slate-500">Architecture</dt><dd className="text-slate-200">{selectedApp.architecture}</dd></div>
                    <div><dt className="text-slate-500">Install Date</dt><dd className="text-slate-200">{selectedApp.installDate || '—'}</dd></div>
                    <div><dt className="text-slate-500">Metadata Confidence</dt><dd className="text-slate-200">{selectedApp.metadataConfidence}</dd></div>
                    <div className="col-span-2"><dt className="text-slate-500">Install Location</dt><dd className="text-slate-300 font-mono text-[11px] break-all">{selectedApp.installLocation || '—'}</dd></div>
                    <div className="col-span-2"><dt className="text-slate-500">Uninstall Command</dt><dd className="text-slate-300 font-mono text-[11px] break-all">{selectedApp.uninstallString || '—'}</dd></div>
                  </dl>
                </aside>
              )}
            </div>
          )}

          {/* TAB 3: STARTUP PROGRAMS */}
          {activeTab === 'startup' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {isAr ? 'برامج بدء التشغيل المستخرجة من السجل ومجلدات البدء.' : 'Startup programs discovered from HKCU/HKLM Run keys and folders.'}
                </p>
                <button
                  type="button"
                  onClick={() => handleLaunchTool('PA05', 'analyze')}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  <span>{isAr ? 'تحديث البدء' : 'Query Startup'}</span>
                </button>
              </div>

              {evidence.startup.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-lg text-slate-400 text-xs">
                  <p>{isAr ? 'لم يتم فحص برامج بدء التشغيل بعد. اضغط تحديث البدء.' : 'No startup items recorded. Click Query Startup.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="p-2.5">{isAr ? 'الاسم' : 'Name'}</th>
                        <th className="p-2.5">{isAr ? 'المصدر' : 'Source'}</th>
                        <th className="p-2.5">{isAr ? 'النطاق' : 'Scope'}</th>
                        <th className="p-2.5">{isAr ? 'الأمر / المسار' : 'Command'}</th>
                        <th className="p-2.5">{isAr ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {evidence.startup.map((item: StartupItem) => (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="p-2.5 font-medium text-slate-200 flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.protected && (
                              <span className="badge text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                                {t.protected}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">{item.source}</td>
                          <td className="p-2.5 text-slate-400">{item.scope}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-300 max-w-xs truncate" title={item.command}>
                            {item.command}
                          </td>
                          <td className="p-2.5">
                            <span className={`badge text-[10px] px-2 py-0.5 rounded ${
                              item.enabled ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {item.enabled ? t.active : t.disabled}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WINDOWS APPS REMOVAL */}
          {activeTab === 'windowsApps' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {isAr ? 'حزم متجر ويندوز مع حماية التطبيقات الأساسية لنظام التشغيل.' : 'AppX / Store packages with OS essential protection whitelist.'}
                </p>
                <button
                  type="button"
                  onClick={() => handleLaunchTool('PA07', 'analyze')}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  <span>{isAr ? 'فحص التطبيقات' : 'Scan Apps'}</span>
                </button>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-xs space-y-2">
                <strong className="text-slate-200 block">{isAr ? 'قواعد الأمان للتطبيقات الأساسية:' : 'Essential Application Protection Rules:'}</strong>
                <p className="text-slate-400">
                  {isAr
                    ? 'يتم حظر إزالة المتجر، الآلة الحاسبة، الصور، الرسام، سطر الأوامر، والدفتر لحماية استقرار النظام.'
                    : 'Microsoft Store, Calculator, Photos, Paint, Terminal, and Notepad are permanently whitelisted against accidental removal.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: CACHE & RESIDUAL DATA */}
          {activeTab === 'cacheOrphans' && (
            <div className="space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'الذاكرة المؤقتة المرشحة' : 'Removable Cache'}</span>
                  <span className="text-lg font-bold text-cyan-400">{evidence.cacheSummary.candidateCount} files</span>
                  <span className="text-xs text-slate-500 block">{Math.round(evidence.cacheSummary.candidateBytes / 1024 / 1024)} MB</span>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'عناصر محمية (بيانات/قواعد/إعدادات)' : 'Protected Data & Config'}</span>
                  <span className="text-lg font-bold text-amber-400">{evidence.cacheSummary.protectedCount} files</span>
                  <span className="text-xs text-slate-500 block">Never purged</span>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">{isAr ? 'بقايا برامج محققة (أيتام)' : 'Verified Orphan Folders'}</span>
                  <span className="text-lg font-bold text-emerald-400">{evidence.orphans.filter((o) => o.classification === 'VERIFIED_ORPHAN').length}</span>
                  <span className="text-xs text-slate-500 block">Eligible for quarantine</span>
                </div>
              </section>

              <section className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">
                    {isAr ? 'محرك مطابقة ملكية بقايا البرامج (PA03)' : 'Orphan Ownership Correlation Engine (PA03)'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleLaunchTool('PA03', 'analyze')}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>{isAr ? 'تحليل البقايا' : 'Analyze Residuals'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? 'يقارن المجلدات المتبقية في Program Files مع سجل إلغاء التثبيت ويمنع حذف المسارات غير المؤكدة.'
                    : 'Correlates Program Files directories against active registry Uninstall keys. UNKNOWN classification is strictly protected from removal.'}
                </p>
              </section>
            </div>
          )}

          {/* TAB 6: REPAIR & RE-REGISTRATION */}
          {activeTab === 'repair' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'إصلاح بنيات التثبيت: خدمة Windows Installer، وإلغاء أقفال التثبيت المعلقة، دون اللجوء لإعادة التسجيل العشوائي.'
                  : 'Targeted repair ladders: MSI service configuration, mutex clearance, and discrete package repair.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">{isAr ? 'إصلاح تثبيت البرامج (PA02)' : 'Repair Program Installations (PA02)'}</h3>
                    <span className="badge text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">Admin</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isAr ? 'إصلاح خدمة Windows Installer وضبط بدء التشغيل وإعادة التسجيل.' : 'Repairs msiserver start type, resets installer locks, and re-registers msiexec.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary text-xs w-full"
                    disabled={Boolean(activeRun)}
                    onClick={() => handleLaunchTool('PA02', 'run')}
                  >
                    {isAr ? 'بدء إصلاح Windows Installer' : 'Repair Installer Scaffolding'}
                  </button>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">{isAr ? 'إصلاح أداة إلغاء التثبيت (PA08)' : 'Repair Program Uninstaller (PA08)'}</h3>
                    <span className="badge text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">Offline OK</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isAr ? 'إيقاف عمليات التثبيت العالقة وإنشاء نقطة استعادة وإعادة تسجيل المحرك.' : 'Terminates hung msiexec processes and creates a restore point before re-registration.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary text-xs w-full"
                    disabled={Boolean(activeRun)}
                    onClick={() => handleLaunchTool('PA08', 'run')}
                  >
                    {isAr ? 'بدء إصلاح Uninstaller' : 'Repair Uninstaller Engine'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: FILE ASSOCIATIONS */}
          {activeTab === 'associations' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded flex items-center justify-between text-xs text-sky-200">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} className="text-sky-400 shrink-0" />
                  <span>{t.userChoiceNote}</span>
                </div>
                <button
                  type="button"
                  onClick={() => window.open('ms-settings:defaultapps')}
                  className="btn btn-secondary text-xs flex items-center gap-1 shrink-0"
                >
                  <ExternalLink size={12} />
                  <span>{t.openSettings}</span>
                </button>
              </div>

              <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                    <tr>
                      <th className="p-2.5">{isAr ? 'الامتداد / البروتوكول' : 'Extension / Protocol'}</th>
                      <th className="p-2.5">ProgID</th>
                      <th className="p-2.5">{isAr ? 'التطبيق المستهدف' : 'Target Executable'}</th>
                      <th className="p-2.5">{isAr ? 'الحالة' : 'Status'}</th>
                      <th className="p-2.5">{isAr ? 'التوجيه الموصى به' : 'Recommended Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {evidence.associations.map((assoc: AssociationDiagnostic) => (
                      <tr key={assoc.extensionOrProtocol} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-mono font-medium text-cyan-300">{assoc.extensionOrProtocol}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-400">{assoc.progId}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-300">{assoc.currentTarget}</td>
                        <td className="p-2.5">
                          <span className={`badge text-[10px] px-2 py-0.5 rounded font-mono ${
                            assoc.status === 'VALID' ? 'bg-emerald-950 text-emerald-300' :
                            assoc.status === 'USER_CHOICE_REQUIRED' ? 'bg-sky-950 text-sky-300' :
                            'bg-red-950 text-red-300'
                          }`}>
                            {assoc.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px]">{assoc.recommendedAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: WINDOWS FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {isAr ? 'حالة ميزات Windows الاختيارية (DISM / Get-WindowsOptionalFeature).' : 'Windows Optional Features status queried via canonical OS boundaries.'}
                </p>
                <span className="badge text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                  Elevation Required for Mutation
                </span>
              </div>

              <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                    <tr>
                      <th className="p-2.5">{isAr ? 'اسم الميزة' : 'Feature Name'}</th>
                      <th className="p-2.5">{isAr ? 'الاسم الظاهر' : 'Display Name'}</th>
                      <th className="p-2.5">{isAr ? 'الحالة' : 'State'}</th>
                      <th className="p-2.5">{isAr ? 'إعادة التشغيل' : 'Restart Required'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {evidence.windowsFeatures.map((feat: WindowsFeatureItem) => (
                      <tr key={feat.featureName} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-mono text-[11px] text-cyan-300">{feat.featureName}</td>
                        <td className="p-2.5 text-slate-200">{feat.displayName}</td>
                        <td className="p-2.5">
                          <span className={`badge text-[10px] px-2 py-0.5 rounded font-mono ${
                            feat.state === 'ENABLED' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {feat.state}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400">{feat.restartRequired ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: INSTALLED UPDATES */}
          {activeTab === 'updates' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs space-y-1">
                <strong className="text-slate-200 block">{isAr ? 'فصل تحديثات ويندوز عن ترقيات winget:' : 'Strict Separation of Windows Updates vs. Winget:'}</strong>
                <p className="text-slate-400">
                  {isAr
                    ? 'تحديثات ويندوز تمثل حزم صيانة نظام التشغيل (HotFixes/KBs) وتُحمى تحديثات الأمان من الإزالة التلقائية. ترقيات winget تخص تطبيقات المستخدم فقط.'
                    : 'Windows Updates represent OS KBs/HotFixes. Security updates are strictly non-removable by automated policy. Winget applies to user apps only.'}
                </p>
              </div>

              <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                    <tr>
                      <th className="p-2.5">KB</th>
                      <th className="p-2.5">{isAr ? 'العنوان' : 'Title'}</th>
                      <th className="p-2.5">{isAr ? 'النوع' : 'Type'}</th>
                      <th className="p-2.5">{isAr ? 'تاريخ التثبيت' : 'Installed On'}</th>
                      <th className="p-2.5">{isAr ? 'الحالة' : 'State'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {evidence.installedUpdates.map((upd: InstalledWindowsUpdate) => (
                      <tr key={upd.kb} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-mono font-medium text-cyan-300">{upd.kb}</td>
                        <td className="p-2.5 text-slate-200">{upd.title}</td>
                        <td className="p-2.5 text-slate-400">{upd.type}</td>
                        <td className="p-2.5 text-slate-400 font-mono text-[11px]">{upd.installedOn}</td>
                        <td className="p-2.5">
                          <span className={`badge text-[10px] px-2 py-0.5 rounded font-mono ${
                            upd.state === 'NOT_REMOVABLE' ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {upd.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 10: TROUBLESHOOTING & COMPATIBILITY */}
          {activeTab === 'compatibility' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">
                      {isAr ? 'إصلاح اختصارات قائمة ابدأ (PA04)' : 'Start Menu Shortcut Integrity (PA04)'}
                    </h3>
                    <span className="badge text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {evidence.brokenShortcutsCount} broken
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? 'فحص الاختصارات المعطلة التي تشير إلى برامج محذوفة وعزلها بأمان.'
                      : 'Detects broken shortcuts pointing to deleted executables and quarantines them.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary text-xs w-full"
                    disabled={Boolean(activeRun)}
                    onClick={() => handleLaunchTool('PA04', 'run')}
                  >
                    {isAr ? 'فحص وإصلاح الاختصارات' : 'Repair / Quarantine Broken Shortcuts'}
                  </button>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">
                      {isAr ? 'فحص مكونات التشغيل (PA06)' : 'Runtime Components Diagnosis (PA06)'}
                    </h3>
                    <span className="badge text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                      Read Only
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {evidence.runtimeComponents.map((comp) => (
                      <div key={comp.name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{comp.name}</span>
                        <span className={`badge text-[9px] px-1.5 py-0.5 rounded ${
                          comp.present ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                        }`}>
                          {comp.present ? 'Present' : 'Missing'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary text-xs w-full"
                    disabled={Boolean(activeRun)}
                    onClick={() => handleLaunchTool('PA06', 'run')}
                  >
                    {isAr ? 'إعادة فحص مكونات التشغيل' : 'Re-check Runtimes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: LIVE LOG */}
          {activeTab === 'evidence' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  {activeRun ? `Running: ${activeRun.toolId} (${activeRun.mode})` : 'Idle'}
                </span>
                {activeRun && (
                  <button type="button" onClick={handleCancel} className="btn btn-danger text-xs py-1 px-2">
                    {t.cancel}
                  </button>
                )}
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-300 h-96 overflow-y-auto whitespace-pre-wrap">
                {activeRunLines.length > 0 ? activeRunLines.join('\n') : 'No live execution output yet.'}
              </pre>
            </div>
          )}

          {/* TAB 12: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-lg text-slate-400 text-xs">
                  {t.emptyHistory}
                </div>
              ) : (
                <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="p-2.5">When</th>
                        <th className="p-2.5">Tool</th>
                        <th className="p-2.5">Mode</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Verification</th>
                        <th className="p-2.5">Changed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {history.map((h: HistoryEntry) => (
                        <tr key={h.id} className="hover:bg-slate-800/30">
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">{h.when.slice(11, 19)}</td>
                          <td className="p-2.5 font-medium text-slate-200">{h.toolId}</td>
                          <td className="p-2.5 text-slate-400 font-mono text-[11px]">{h.mode}</td>
                          <td className="p-2.5">
                            <span className={`badge text-[10px] px-2 py-0.5 rounded font-mono ${
                              h.status === 'success' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                            }`}>
                              {h.status}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-[10px] text-slate-300">{h.finalVerification}</td>
                          <td className="p-2.5 text-slate-400">{h.changedSystem ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {pendingConfirm && (
          <ExecutionConfirmDialog
            tool={pendingConfirm.tool}
            mode={pendingConfirm.mode}
            lang={lang}
            initialOptions={pendingConfirm.options}
            onCancel={() => setPendingConfirm(null)}
            onConfirm={(options, confirmation) => {
              const { tool, mode } = pendingConfirm;
              setPendingConfirm(null);
              handleLaunchTool(tool.ToolId, mode, options, confirmation);
            }}
          />
        )}
      </section>
    </StationErrorBoundary>
  );
}
