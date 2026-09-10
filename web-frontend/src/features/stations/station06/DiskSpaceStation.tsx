import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HardDrive, Database, ShieldAlert, Sparkles, AlertTriangle,
  Trash2, RefreshCw, FileText, Search, Activity,
  LockKeyhole, FileSpreadsheet
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type DriveVolume, type LargeFileItem, type DiskHealthItem, type StationHistoryEntry,
  parseVolumeInventory, classifyLargeFile, filterLargeFiles,
  formatBytes, evaluateDiskHealth, stationTools, outcomeFromRun
} from './diskSpaceModel';
import DiskSpaceHeroVisual from './DiskSpaceHeroVisual';

export interface DiskSpaceStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'volumes' | 'largeFiles' | 'recovery' | 'health' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'STORAGE INTELLIGENCE STUDIO',
    title: 'Storage Intelligence Studio',
    subtitle: 'High-precision Windows disk analysis, volume topology atlas, and deterministic reclaim.',
    tabOverview: 'Overview',
    tabVolumes: 'Volumes',
    tabLargeFiles: 'Large Files',
    tabRecovery: 'Recovery Actions',
    tabHealth: 'Disk Health',
    tabReport: 'Report',
    tabHistory: 'History',
    scanAction: 'Analyze Disk Space',
    scanning: 'Analyzing drives...',
    totalCapacity: 'Total Capacity',
    totalFree: 'Total Free Space',
    primaryVolume: 'System Drive',
    volumesCount: 'Active Volumes',
    used: 'Used',
    free: 'Free',
    healthStatus: 'Health Status',
    safeCandidate: 'Safe Candidate',
    protectedFile: 'Protected System File',
    searchFiles: 'Filter files or paths...',
    allCategories: 'All Categories',
    archives: 'Archives',
    media: 'Media',
    documents: 'Documents',
    executables: 'Executables',
    diskimages: 'Disk Images',
    startAction: 'Execute Action',
    adminRequired: 'Administrator elevation required for this action',
    destructiveNotice: 'Destructive action — requires explicit typed confirmation',
    emptyHistory: 'No actions executed yet during this session.',
    refreshStatus: 'Refresh Data',
    noVolumes: 'No local fixed volumes detected.',
    healthyDrives: 'Healthy Volumes',
    attentionDrives: 'Volumes Needing Attention',
    reclaimTitle: 'Available Reclaim Mechanisms',
    reclaimSubtitle: 'Targeted Windows cleanup and compaction operations with rollback safety.',
    reclaimPotential: 'Potential Reclaim',
    healthTitle: 'Physical Storage Diagnostics',
    healthSubtitle: 'S.M.A.R.T. predictive failure indicators and hardware device telemetry.',
    smartOk: 'No predicted hardware failure signal observed',
    smartWarn: 'Hardware failure predicted by drive controller!',
    smartUnavailable: 'SMART device telemetry not exposed by controller',
  },
  ar: {
    eyebrow: 'استوديو ذكاء التخزين',
    title: 'استوديو ذكاء التخزين',
    subtitle: 'تحليل دقيق لأقراص ويندوز، أطلس طوبولوجيا المساحة، وإجراءات استعادة المساحة المضمونة.',
    tabOverview: 'نظرة عامة',
    tabVolumes: 'الأقراص والأقسام',
    tabLargeFiles: 'الملفات الكبيرة',
    tabRecovery: 'إجراءات الاستعادة',
    tabHealth: 'صحة الأقراص',
    tabReport: 'التقرير',
    tabHistory: 'السجل',
    scanAction: 'تحليل مساحة القرص',
    scanning: 'جارٍ تحليل الأقراص...',
    totalCapacity: 'السعة الكلية',
    totalFree: 'المساحة المتاحة الكلية',
    primaryVolume: 'قرص النظام',
    volumesCount: 'الأقراص النشطة',
    used: 'مستخدم',
    free: 'متاح',
    healthStatus: 'حالة القرص',
    safeCandidate: 'مرشح آمن للمراجعة',
    protectedFile: 'ملف نظام محمي',
    searchFiles: 'تصفية الملفات أو المسارات...',
    allCategories: 'جميع الفئات',
    archives: 'الأرشيفات',
    media: 'الوسائط',
    documents: 'المستندات',
    executables: 'التطبيقات',
    diskimages: 'صور الأقراص',
    startAction: 'بدء الإجراء',
    adminRequired: 'يتطلب هذا الإجراء صلاحيات المدير (Administrator)',
    destructiveNotice: 'إجراء حاسم — يتطلب تأكيداً كتابياً صريحاً',
    emptyHistory: 'لم يتم تنفيذ أي إجراء خلال هذه الجلسة حتى الآن.',
    refreshStatus: 'تحديث البيانات',
    noVolumes: 'لم يتم اكتشاف أقراص محلية متصلة.',
    healthyDrives: 'أقراص بحالة جيدة',
    attentionDrives: 'أقراص تحتاج انتباهاً',
    reclaimTitle: 'آليات استعادة المساحة المتاحة',
    reclaimSubtitle: 'عمليات تنظيف وضغط معتمدة لنظام ويندوز مع ضمانات التراجع والأمان.',
    reclaimPotential: 'المساحة القابلة للاسترداد',
    healthTitle: 'فحص التخزين الفيزيائي',
    healthSubtitle: 'مؤشرات S.M.A.R.T التنبؤية وبيانات أجهزة التخزين الحقيقية.',
    smartOk: 'لم تظهر أي إشارة فشل عتادي متوقعة من وحدة التحكم',
    smartWarn: 'تم التنبؤ بفشل عتادي وشيك من وحدة التحكم!',
    smartUnavailable: 'بيانات SMART غير متاحة من مشغل وحدة التخزين',
  },
};

export const DiskSpaceStation: React.FC<DiskSpaceStationProps> = ({
  lang,
  tools,
  toolStatuses,
  bridgeElevated,
  bridgeOnline = null,
  onRetryBridge,
  onToolStatus,
}) => {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [volumes, setVolumes] = useState<DriveVolume[]>([]);
  const [largeFiles, setLargeFiles] = useState<LargeFileItem[]>([]);
  const [healthItems, setHealthItems] = useState<DiskHealthItem[]>([]);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);

  // Filter tools belonging to Station 06
  const stationToolsList = useMemo(() => stationTools(tools), [tools]);

  // Load baseline volume state from api.system()
  const loadBaseline = useCallback(async () => {
    try {
      const snap = await api.system();
      if (snap?.system?.Drives) {
        const parsed = parseVolumeInventory(snap.system.Drives);
        setVolumes(parsed);
      }
    } catch {
      // offline state handled by bridgeOnline check
    }
  }, []);

  useEffect(() => {
    void loadBaseline();
  }, [loadBaseline]);

  // Trigger DS01 live analysis
  const runAnalysis = async () => {
    const ds01 = stationToolsList.find((tool) => tool.ToolId === 'DS01');
    if (!ds01) return;

    setIsScanning(true);
    try {
      const runId = await startExecution({ tool: ds01, mode: 'run' });
      onToolStatus('DS01', 'running');
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(ds01, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus('DS01', entry.status === 'SUCCESS' ? 'success' : 'error');
        // Refresh drives
        await loadBaseline();
      }
    } catch {
      onToolStatus('DS01', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger DS02 Large Files Scan
  const runLargeFilesScan = async () => {
    const ds02 = stationToolsList.find((tool) => tool.ToolId === 'DS02');
    if (!ds02) return;

    setIsScanning(true);
    try {
      const runId = await startExecution({ tool: ds02, mode: 'run' });
      onToolStatus('DS02', 'running');
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(ds02, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus('DS02', entry.status === 'SUCCESS' ? 'success' : 'error');
        // If evidence contains items
        const rawItems = (poll.result.evidence as any)?.Items || (poll.result.rawOutput as any)?.Items;
        if (Array.isArray(rawItems)) {
          const files = rawItems.map((item: any) =>
            classifyLargeFile(item.FullName || item.Path, item.Length || item.Size || 0, item.LastWriteTime)
          );
          setLargeFiles(files);
        }
      }
    } catch {
      onToolStatus('DS02', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger DS07 Disk Health Check
  const runHealthCheck = async () => {
    const ds07 = stationToolsList.find((tool) => tool.ToolId === 'DS07');
    if (!ds07) return;

    setIsScanning(true);
    try {
      const runId = await startExecution({ tool: ds07, mode: 'run' });
      onToolStatus('DS07', 'running');
      const poll = await pollExecution(runId);
      if (poll.result) {
        const entry = outcomeFromRun(ds07, poll.result, lang);
        setHistory((prev) => [entry, ...prev]);
        onToolStatus('DS07', entry.status === 'SUCCESS' ? 'success' : 'error');
        const rawItems = (poll.result.evidence as any)?.Items || (poll.result.rawOutput as any)?.Items;
        if (Array.isArray(rawItems)) {
          setHealthItems(evaluateDiskHealth(rawItems));
        }
      }
    } catch {
      onToolStatus('DS07', 'error');
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

  // Execute confirmed action
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
        await loadBaseline();
      }
    } catch {
      onToolStatus(tool.ToolId, 'error');
    }
  };

  // Metrics
  const totalCapacity = useMemo(() => volumes.reduce((acc, v) => acc + v.totalBytes, 0), [volumes]);
  const totalFree = useMemo(() => volumes.reduce((acc, v) => acc + v.freeBytes, 0), [volumes]);
  const primaryVolume = useMemo(() => volumes.find((v) => v.isSystem) || volumes[0], [volumes]);
  const filteredFiles = useMemo(() => filterLargeFiles(largeFiles, searchQuery, categoryFilter), [largeFiles, searchQuery, categoryFilter]);

  // Offline Presentation Gate
  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason={lang === 'ar' ? 'الجسر المحلي لخدمات التخزين غير متصل.' : 'Storage Execution Bridge is offline.'}
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <StationErrorBoundary>
      <div className="knoux-station-workspace flex flex-col flex-1 gap-6 p-6">
        {/* Top Product Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs font-mono tracking-widest text-cyan-400 uppercase">{t.eyebrow}</p>
            <h1 className="text-2xl font-bold text-white tracking-wide mt-1">{t.title}</h1>
            <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={isScanning}
              className="px-4 py-2 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? t.scanning : t.scanAction}</span>
            </button>
          </div>
        </header>

        {/* Local Mini-Nav Rail */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none">
          {[
            { id: 'overview', label: t.tabOverview, icon: HardDrive },
            { id: 'volumes', label: t.tabVolumes, icon: Database },
            { id: 'largeFiles', label: t.tabLargeFiles, icon: FileSpreadsheet },
            { id: 'recovery', label: t.tabRecovery, icon: Trash2 },
            { id: 'health', label: t.tabHealth, icon: ShieldAlert },
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
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
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
            {/* Hero Visualization Banner */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 relative overflow-hidden">
              <div className="flex-1 flex flex-col gap-3 z-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs w-max font-mono">
                  <Sparkles size={12} />
                  <span>{lang === 'ar' ? 'طوبولوجيا التخزين الحية' : 'Live Storage Atlas Topology'}</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  {primaryVolume
                    ? `${primaryVolume.name} · ${primaryVolume.usedPercent}% ${t.used}`
                    : (lang === 'ar' ? 'جاهز لفحص الأقراص' : 'Ready to analyze drives')}
                </h2>
                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                  {lang === 'ar'
                    ? 'يعتمد هذا العرض على السعات المقاسة فعلياً عبر واجهة نظام ويندوز للأقراص الثابتة.'
                    : 'This atlas reflects actual measured volume capacities directly from Windows storage interfaces.'}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block">{t.totalCapacity}</span>
                    <strong className="text-base text-white font-mono">{formatBytes(totalCapacity, lang)}</strong>
                  </div>
                  <div className="w-[1px] h-6 bg-white/10" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">{t.totalFree}</span>
                    <strong className="text-base text-emerald-400 font-mono">{formatBytes(totalFree, lang)}</strong>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center z-10 w-full">
                <DiskSpaceHeroVisual lang={lang} stage={isScanning ? 'scanning' : 'idle'} volumes={volumes} />
              </div>
            </div>

            {/* Volume Quick Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {volumes.map((vol) => (
                <div
                  key={vol.name}
                  className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-3 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <HardDrive size={18} />
                      </div>
                      <div>
                        <strong className="text-sm text-white font-mono">{vol.name}</strong>
                        {vol.isSystem && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                            SYSTEM
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        vol.healthStatus === 'HEALTHY'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : vol.healthStatus === 'WARNING'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      {vol.healthStatus}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        vol.usedPercent > 90 ? 'bg-rose-500' : vol.usedPercent > 75 ? 'bg-amber-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${vol.usedPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>{formatBytes(vol.freeBytes, lang)} {t.free}</span>
                    <span>{vol.usedPercent}% {t.used}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Action Recommender */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <span>{lang === 'ar' ? 'الإجراءات الموصى بها لإدارة التخزين' : 'Recommended Storage Actions'}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <strong className="text-xs text-white block">DS02 · {lang === 'ar' ? 'العثور على الملفات الكبيرة' : 'Find Large Files'}</strong>
                    <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'كشف مستهلكي المساحة في مجلدات المستخدم' : 'Detect space hogs in user directories'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('largeFiles'); void runLargeFilesScan(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer"
                  >
                    {t.startAction}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <strong className="text-xs text-white block">DS08 · {lang === 'ar' ? 'تشغيل تنظيف القرص' : 'Run Disk Cleanup'}</strong>
                    <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'تنظيف آمن لملفات النظام المؤقتة' : 'Safe cleanup of system temporary files'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchTool('DS08')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer"
                  >
                    {t.startAction}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: VOLUMES */}
        {activeTab === 'volumes' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabVolumes}</h3>
            {volumes.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{t.noVolumes}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-white/10 text-slate-400 font-mono uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Volume</th>
                      <th className="py-2.5 px-3">File System</th>
                      <th className="py-2.5 px-3">Total Capacity</th>
                      <th className="py-2.5 px-3">Used Space</th>
                      <th className="py-2.5 px-3">Free Space</th>
                      <th className="py-2.5 px-3">Usage %</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {volumes.map((vol) => (
                      <tr key={vol.name} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                          <HardDrive size={14} className="text-cyan-400" />
                          <span>{vol.name}</span>
                          {vol.isSystem && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">
                              OS
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">{vol.fileSystem}</td>
                        <td className="py-3 px-3">{formatBytes(vol.totalBytes, lang)}</td>
                        <td className="py-3 px-3">{formatBytes(vol.usedBytes, lang)}</td>
                        <td className="py-3 px-3 text-emerald-400">{formatBytes(vol.freeBytes, lang)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${vol.usedPercent > 90 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                                style={{ width: `${vol.usedPercent}%` }}
                              />
                            </div>
                            <span>{vol.usedPercent}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              vol.healthStatus === 'HEALTHY'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {vol.healthStatus}
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

        {/* Tab 3: LARGE FILES */}
        {activeTab === 'largeFiles' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabLargeFiles}</h3>
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'فحص واستكشاف الملفات الكبيرة دون حذف تلقائي متهور' : 'Inspect large files safely with protected path safeguards'}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runLargeFilesScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
                  <span>{lang === 'ar' ? 'فحص الملفات الكبيرة (DS02)' : 'Scan Large Files (DS02)'}</span>
                </button>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchFiles}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: t.allCategories },
                  { id: 'archive', label: t.archives },
                  { id: 'media', label: t.media },
                  { id: 'document', label: t.documents },
                  { id: 'executable', label: t.executables },
                  { id: 'diskimage', label: t.diskimages },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      categoryFilter === cat.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Files List */}
            {filteredFiles.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {largeFiles.length === 0
                  ? (lang === 'ar' ? 'اضغط "فحص الملفات الكبيرة" للبدء عبر أداة DS02.' : 'Click "Scan Large Files" to inspect user folders using DS02.')
                  : (lang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك.' : 'No files match your filter.')}
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-96 overflow-y-auto font-mono text-xs">
                {filteredFiles.map((file) => (
                  <div key={file.path} className="py-2.5 flex items-center justify-between gap-3 hover:bg-white/5 px-2 rounded-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileSpreadsheet size={15} className="text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <strong className="text-white text-xs block truncate">{file.name}</strong>
                        <span className="text-[10px] text-slate-400 block truncate">{file.path}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-white font-semibold">{formatBytes(file.sizeBytes, lang)}</span>
                      {file.isProtected ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px]">
                          {t.protectedFile}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]">
                          {t.safeCandidate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: RECOVERY ACTIONS */}
        {activeTab === 'recovery' && (
          <div className="flex flex-col gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10">
              <h3 className="text-sm font-semibold text-white tracking-wide">{t.reclaimTitle}</h3>
              <p className="text-xs text-slate-400 mt-1">{t.reclaimSubtitle}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {stationToolsList
                  .filter((tool) => ['DS04', 'DS05', 'DS06', 'DS08', 'DS09'].includes(tool.ToolId))
                  .map((tool) => {
                    const status = toolStatuses[tool.ToolId];
                    const isRunning = status === 'running';
                    const needsAdmin = tool.RequiresAdmin && !bridgeElevated;

                    return (
                      <div
                        key={tool.ToolId}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3 hover:border-cyan-500/30 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-cyan-400 font-bold">{tool.ToolId}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                tool.RiskLevel === 'DESTRUCTIVE'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {tool.RiskLevel}
                            </span>
                          </div>
                          <strong className="text-sm text-white block mt-1">
                            {pickName(tool, lang)}
                          </strong>
                          <p className="text-xs text-slate-400 mt-1">{tool.Purpose}</p>
                        </div>

                        {needsAdmin && (
                          <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                            <LockKeyhole size={13} />
                            <span>{t.adminRequired}</span>
                          </div>
                        )}

                        {tool.RiskLevel === 'DESTRUCTIVE' && (
                          <div className="flex items-center gap-1.5 text-rose-400 text-[11px]">
                            <AlertTriangle size={13} />
                            <span>{t.destructiveNotice}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                          <button
                            type="button"
                            disabled={needsAdmin || isRunning}
                            onClick={() => handleLaunchTool(tool.ToolId)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw size={13} className={isRunning ? 'animate-spin' : ''} />
                            <span>{isRunning ? (lang === 'ar' ? 'جارٍ التنفيذ...' : 'Running...') : t.startAction}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: HEALTH */}
        {activeTab === 'health' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{t.healthTitle}</h3>
                <p className="text-xs text-slate-400">{t.healthSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={runHealthCheck}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
                <span>{lang === 'ar' ? 'فحص صحة الأقراص (DS07)' : 'Check Disk Health (DS07)'}</span>
              </button>
            </div>

            {healthItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {lang === 'ar'
                  ? 'اضغط "فحص صحة الأقراص" لقراءة حالة SMART الفيزيائية عبر DS07.'
                  : 'Click "Check Disk Health" to query physical drive S.M.A.R.T telemetry via DS07.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {healthItems.map((h) => (
                  <div key={h.index} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive size={16} className="text-cyan-400" />
                        <strong className="text-sm text-white font-mono">Drive {h.index}: {h.model}</strong>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          h.evaluation === 'HEALTHY'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : h.evaluation === 'FAILURE_PREDICTED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {h.evaluation}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-mono flex items-center justify-between">
                      <span>Size: {h.sizeGB} GB</span>
                      <span>SMART Status: {h.status}</span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {h.evaluation === 'HEALTHY'
                        ? t.smartOk
                        : h.evaluation === 'FAILURE_PREDICTED'
                        ? t.smartWarn
                        : t.smartUnavailable}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: REPORT */}
        {activeTab === 'report' && (
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{t.tabReport}</h3>
                <p className="text-xs text-slate-400">{lang === 'ar' ? 'تقرير مساحة وتخزين الجهاز الشامل المبني على الأدلة الفعلية' : 'Comprehensive disk space report generated from verified evidence'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleLaunchTool('DS10')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={13} />
                <span>{lang === 'ar' ? 'توليد تقرير التخزين (DS10)' : 'Generate Disk Report (DS10)'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 font-mono text-xs text-slate-300 space-y-2">
              <p>STORAGE AUDIT SUMMARY</p>
              <p>----------------------------------------</p>
              <p>Detected Volumes: {volumes.length}</p>
              <p>Total Capacity: {formatBytes(totalCapacity, lang)}</p>
              <p>Total Free: {formatBytes(totalFree, lang)}</p>
              <p>System Volume: {primaryVolume ? `${primaryVolume.name} (${primaryVolume.usedPercent}% used)` : 'N/A'}</p>
              <p>Physical Drives Tested: {healthItems.length}</p>
              <p>S.M.A.R.T Status: {healthItems.some((h) => h.smartPredictFailure) ? 'FAILURE PREDICTED' : 'NOMINAL'}</p>
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
                      <span className="font-bold text-cyan-400">{h.toolId}</span>
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

        {/* Execution Confirmation Dialog for Destructive / Repair operations */}
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

export default DiskSpaceStation;
