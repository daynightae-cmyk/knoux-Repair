import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Layers, Terminal, Puzzle, Database, RefreshCw, Play,
  CheckCircle2, AlertTriangle, XCircle, History, Search,
  ArrowUpRight, Trash2, Archive, Package, ShieldCheck
} from 'lucide-react';
import type {
  BridgeTool, ExecutionMode,
  SoftwarePreview, AdvancedSoftwarePreview, SoftwarePreviewItem,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../types';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type SoftwareHubSummary, type SoftwareSignal,
  summarizeSoftwareHub, detectSoftwareSignals, filterSoftwareItems,
  filterDeveloperTools, filterChromeExtensions, stationTools,
  formatBytes
} from './softwareModel';
import SoftwareHeroVisual from './SoftwareHeroVisual';

export interface SoftwareStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'runtimes' | 'catalog' | 'extensions' | 'caches' | 'winget' | 'actions' | 'history';

interface StationHistoryEntry {
  toolId: string;
  toolName: string;
  timestamp: string;
  outcome: 'success' | 'error' | 'cancelled' | 'inconclusive';
  message: string;
}

const COPY = {
  en: {
    eyebrow: 'RUNTIME ENVIRONMENT & APPLICATION HUB',
    title: 'Software Environment & Application Shelf',
    subtitle: 'Inspect installed software, audit development toolchains, discover browser extensions, quarantine cache bloat, and manage Winget upgrades.',
    tabOverview: 'Overview',
    tabRuntimes: 'Runtimes & Toolchains',
    tabCatalog: 'Software Catalog',
    tabExtensions: 'Browser Extensions',
    tabCaches: 'Software Caches',
    tabWinget: 'Winget Packages',
    tabActions: 'Station Tools',
    tabHistory: 'History',
    refresh: 'Query Environment',
    refreshing: 'Inspecting installed software and runtimes...',
    totalSoftware: 'Total Installed',
    desktopApps: 'Desktop Apps (Win32)',
    storeApps: 'Windows Store Apps',
    activeRuntimes: 'Active Runtimes',
    cacheSize: 'Caches Footprint',
    extensionsCount: 'Chrome Extensions',
    wingetStatus: 'Winget Status',
    signalsTitle: 'Environment Findings & Telemetry Signals',
    noSignals: 'All software inventories, runtimes, and package environments are operating normally.',
    quickCatalog: 'Inventory Software (SW01)',
    quickRuntimes: 'Audit Dev Runtimes (SW02)',
    quickQuarantine: 'Quarantine Caches (SW04)',
    quickUpgrade: 'Upgrade Winget (SW05)',
    runtimesTitle: 'Installed Runtimes, Interpreters & Package Managers',
    runtimesSubtitle: 'Audited executables on Windows PATH with resolved versions and physical paths.',
    catalogTitle: 'Installed Desktop & Appx Applications',
    catalogSubtitle: 'Comprehensive application inventory from Windows Uninstall registries and Appx packages.',
    extensionsTitle: 'Chrome & Chromium Extensions',
    extensionsSubtitle: 'Local extension manifests discovered across available user profiles.',
    cachesTitle: 'Package Manager & Browser Caches',
    cachesSubtitle: 'Quarantine-eligible cache directories measured directly on disk.',
    wingetTitle: 'Windows Package Manager (Winget)',
    wingetSubtitle: 'Manage package upgrades and clean uninstalls through winget.exe.',
    searchPlaceholder: 'Search by name, publisher, or path...',
    kindAll: 'All Applications',
    kindDesktop: 'Desktop (Win32)',
    kindAppx: 'Store (Appx)',
    canUninstall: 'Uninstallable',
    cannotUninstall: 'System/Protected',
    available: 'Installed',
    missing: 'Not Detected',
    quarantineAction: 'Quarantine Caches via SW04',
    upgradeAction: 'Check Upgrades via SW05',
    uninstallAction: 'Uninstall Package via SW06',
    packageIdPrompt: 'Enter exact Winget Package ID (e.g. Git.Git):',
    confirmText: 'Type UNINSTALL to confirm destructive removal:',
    noHistory: 'No tools executed in this session yet.',
    offlineNotice: 'Bridge server is currently offline. Start the KNOUX Bridge to query software telemetry.',
  },
  ar: {
    eyebrow: 'مركز بيئات البرامج وتطبيقات النظام',
    title: 'رف البرامج وبيئات التشغيل والتطوير',
    subtitle: 'جرد البرامج المثبتة وتدقيق بيئات التطوير وفحص إضافات المتصفح وعزل الذاكرات المؤقتة وإدارة تحديثات وينجت.',
    tabOverview: 'نظرة عامة',
    tabRuntimes: 'بيئات وأطر التشغيل',
    tabCatalog: 'دليل البرامج',
    tabExtensions: 'إضافات المتصفح',
    tabCaches: 'الذاكرة المؤقتة',
    tabWinget: 'حزم Winget',
    tabActions: 'أدوات المحطة',
    tabHistory: 'السجل',
    refresh: 'فحص البيئة',
    refreshing: 'جاري فحص البرامج المثبتة وبيئات التشغيل...',
    totalSoftware: 'إجمالي البرامج',
    desktopApps: 'برامج سطح المكتب (Win32)',
    storeApps: 'تطبيقات متجر ويندوز',
    activeRuntimes: 'البيئات النشطة',
    cacheSize: 'حجم الذاكرة المؤقتة',
    extensionsCount: 'إضافات Chrome',
    wingetStatus: 'حالة Winget',
    signalsTitle: 'ملاحظات البيئة ومؤشرات القياس',
    noSignals: 'جميع جرد البرامج وبيئات التشغيل وأطر العمل تعمل بحالة مثالية.',
    quickCatalog: 'جرد البرامج (SW01)',
    quickRuntimes: 'تدقيق بيئات التطوير (SW02)',
    quickQuarantine: 'عزل الذاكرة المؤقتة (SW04)',
    quickUpgrade: 'تحديث الحزم (SW05)',
    runtimesTitle: 'بيئات التشغيل والمفسرات ومديرو الحزم',
    runtimesSubtitle: 'تدقيق البرامج التنفيذية في مسار النظام مع تحديد المسار الفعلي والإصدار بدقة.',
    catalogTitle: 'تطبيقات سطح المكتب والمتجر المثبتة',
    catalogSubtitle: 'سجل شامل للتطبيقات من سجلات ويندوز وحزم متجر التطبيقات.',
    extensionsTitle: 'إضافات Google Chrome',
    extensionsSubtitle: 'فحص ملفات تعريف الإضافات المحلية دون المساس ببيانات المستخدم.',
    cachesTitle: 'ذاكرات التخزين المؤقت للبرامج والمطورين',
    cachesSubtitle: 'مجلدات التخزين المؤقت المؤهلة للعزل الآمن مقاسة مباشرة من القرص.',
    wingetTitle: 'مدير حزم ويندوز (Winget)',
    wingetSubtitle: 'إدارة تحديثات الحزم والإزالة الموثوقة عبر winget.exe.',
    searchPlaceholder: 'بحث بالاسم أو الناشر أو المسار...',
    kindAll: 'جميع التطبيقات',
    kindDesktop: 'سطح المكتب (Win32)',
    kindAppx: 'متجر ويندوز (Appx)',
    canUninstall: 'قابل للإزالة',
    cannotUninstall: 'نظام / محمي',
    available: 'مثبت ومتاح',
    missing: 'غير مكتشف',
    quarantineAction: 'عزل الذاكرة المؤقتة عبر SW04',
    upgradeAction: 'فحص التحديثات عبر SW05',
    uninstallAction: 'إزالة حزمة عبر SW06',
    packageIdPrompt: 'أدخل معرف الحزمة الدقيق (مثال: Git.Git):',
    confirmText: 'اكتب UNINSTALL لتأكيد الإزالة:',
    noHistory: 'لم يتم تشغيل أدوات في هذه الجلسة بعد.',
    offlineNotice: 'خادم الجسر غير متصل حالياً. شغل جسر KNOUX لاسترجاع بيانات البرامج.',
  }
};

export default function SoftwareStation(props: SoftwareStationProps) {
  const { lang, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus } = props;
  const t = COPY[lang];

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [softwareData, setSoftwareData] = useState<SoftwarePreview | null>(null);
  const [advancedData, setAdvancedData] = useState<AdvancedSoftwarePreview | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Search and filter states
  const [catalogQuery, setCatalogQuery] = useState<string>('');
  const [catalogKind, setCatalogKind] = useState<'all' | 'Desktop' | 'Appx'>('all');
  const [runtimeQuery, setRuntimeQuery] = useState<string>('');
  const [extensionQuery, setExtensionQuery] = useState<string>('');

  // History tracking
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);

  // Execution dialog state
  const [pendingRun, setPendingRun] = useState<{
    tool: BridgeTool;
    mode: ExecutionMode;
    options?: ToolRunOptions;
  } | null>(null);

  const relevantTools = useMemo(() => stationTools(tools), [tools]);

  const loadData = useCallback(async () => {
    if (bridgeOnline === false) return;
    setLoading(true);
    setLastError(null);
    try {
      const [swRes, advRes] = await Promise.allSettled([
        api.softwarePreview(),
        api.advancedSoftwarePreview()
      ]);

      if (swRes.status === 'fulfilled' && swRes.value?.preview) {
        setSoftwareData(swRes.value.preview);
      }
      if (advRes.status === 'fulfilled' && advRes.value?.preview) {
        setAdvancedData(advRes.value.preview);
      }

      if (swRes.status === 'rejected' && advRes.status === 'rejected') {
        setLastError('Failed to fetch software environment telemetry from bridge.');
      }
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [bridgeOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary: SoftwareHubSummary = useMemo(
    () => summarizeSoftwareHub(softwareData, advancedData),
    [softwareData, advancedData]
  );

  const signals: SoftwareSignal[] = useMemo(
    () => detectSoftwareSignals(softwareData, advancedData),
    [softwareData, advancedData]
  );

  const filteredCatalog = useMemo(
    () => filterSoftwareItems(softwareData?.Items, catalogQuery, catalogKind),
    [softwareData?.Items, catalogQuery, catalogKind]
  );

  const filteredRuntimes = useMemo(
    () => filterDeveloperTools(advancedData?.DeveloperTools, runtimeQuery),
    [advancedData?.DeveloperTools, runtimeQuery]
  );

  const filteredExtensions = useMemo(
    () => filterChromeExtensions(advancedData?.ChromeExtensions, extensionQuery),
    [advancedData?.ChromeExtensions, extensionQuery]
  );

  const handleLaunchTool = useCallback((tool: BridgeTool, mode: ExecutionMode = 'AnalyzeOnly', customOptions?: ToolRunOptions) => {
    setPendingRun({
      tool,
      mode,
      options: customOptions
    });
  }, []);

  const handleConfirmRun = useCallback(async (options: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
    if (!pendingRun) return;
    const { tool, mode } = pendingRun;
    setPendingRun(null);

    onToolStatus(tool.ToolId, 'running');
    try {
      const runId = await startExecution(tool, mode, options, confirmation);
      const finalRecord = await pollExecution(runId, 250);

      const outcome = finalRecord.Outcome === 'Success' ? 'success'
        : finalRecord.Outcome === 'Failed' ? 'error'
        : finalRecord.Outcome === 'Cancelled' ? 'cancelled'
        : 'inconclusive';

      onToolStatus(tool.ToolId, outcome);

      const toolName = lang === 'ar' ? (tool.ArabicName || tool.EnglishName) : tool.EnglishName;
      setHistory(prev => [
        {
          toolId: tool.ToolId,
          toolName,
          timestamp: new Date().toLocaleTimeString(),
          outcome,
          message: finalRecord.ErrorMessage || `Executed ${tool.ToolId} successfully.`
        },
        ...prev
      ]);

      loadData();
    } catch (err: unknown) {
      onToolStatus(tool.ToolId, 'error');
      const msg = err instanceof Error ? err.message : String(err);
      setHistory(prev => [
        {
          toolId: tool.ToolId,
          toolName: tool.ToolId,
          timestamp: new Date().toLocaleTimeString(),
          outcome: 'error',
          message: msg
        },
        ...prev
      ]);
    }
  }, [pendingRun, onToolStatus, lang, loadData]);

  if (bridgeOnline === false && !softwareData && !advancedData) {
    return (
      <StationOfflineState
        lang={lang}
        onRetryBridge={onRetryBridge}
        customNotice={t.offlineNotice}
      />
    );
  }

  return (
    <StationErrorBoundary lang={lang}>
      <div className="glass-nexus-station software-station-root" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* Header Bar */}
        <header className="station-header">
          <div className="station-title-group">
            <span className="station-eyebrow">{t.eyebrow}</span>
            <h1 className="station-title">{t.title}</h1>
            <p className="station-subtitle">{t.subtitle}</p>
          </div>
          <div className="station-actions-group">
            <button
              type="button"
              className="action-button-primary"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? t.refreshing : t.refresh}</span>
            </button>
          </div>
        </header>

        {lastError && (
          <div className="station-banner warning">
            <AlertTriangle size={18} />
            <span>{lastError}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <nav className="station-tabs-nav" aria-label="Station tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Package size={15} />
            <span>{t.tabOverview}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'runtimes' ? 'active' : ''}`}
            onClick={() => setActiveTab('runtimes')}
          >
            <Terminal size={15} />
            <span>{t.tabRuntimes}</span>
            <span className="tab-pill">{summary.detectedRuntimes}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Layers size={15} />
            <span>{t.tabCatalog}</span>
            <span className="tab-pill">{summary.installedTotal}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'extensions' ? 'active' : ''}`}
            onClick={() => setActiveTab('extensions')}
          >
            <Puzzle size={15} />
            <span>{t.tabExtensions}</span>
            <span className="tab-pill">{summary.extensionCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'caches' ? 'active' : ''}`}
            onClick={() => setActiveTab('caches')}
          >
            <Archive size={15} />
            <span>{t.tabCaches}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'winget' ? 'active' : ''}`}
            onClick={() => setActiveTab('winget')}
          >
            <Database size={15} />
            <span>{t.tabWinget}</span>
            {summary.wingetUpgradeCandidates > 0 && (
              <span className="tab-pill warning">{summary.wingetUpgradeCandidates}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <Play size={15} />
            <span>{t.tabActions}</span>
            <span className="tab-pill">{relevantTools.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={15} />
            <span>{t.tabHistory}</span>
            <span className="tab-pill">{history.length}</span>
          </button>
        </nav>

        {/* Tab Content */}
        <div className="station-tab-content">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-pane overview-pane">
              <div className="overview-hero-layout">
                <SoftwareHeroVisual
                  condition={summary.condition}
                  detectedRuntimes={summary.detectedRuntimes}
                  missingRuntimes={summary.missingRuntimes}
                  totalSoftware={summary.installedTotal}
                  wingetAvailable={summary.wingetAvailable}
                  totalCacheBytes={summary.totalCacheBytes}
                  lang={lang}
                />
              </div>

              {/* KPI Metrics Grid */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">{t.totalSoftware}</span>
                  <span className="metric-value primary">{summary.installedTotal}</span>
                  <span className="metric-sub">{summary.desktopCount} Desktop · {summary.appxCount} Store</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.activeRuntimes}</span>
                  <span className="metric-value success">{summary.detectedRuntimes} / {summary.detectedRuntimes + summary.missingRuntimes}</span>
                  <span className="metric-sub">Active on PATH</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.cacheSize}</span>
                  <span className="metric-value warning">{formatBytes(summary.totalCacheBytes, lang)}</span>
                  <span className="metric-sub">npm, Yarn, pip, Chrome</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.extensionsCount}</span>
                  <span className="metric-value info">{summary.extensionCount}</span>
                  <span className="metric-sub">Chrome Profiles</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.wingetStatus}</span>
                  <span className="metric-value">{summary.wingetAvailable ? (summary.wingetVersion || 'Ready') : t.missing}</span>
                  <span className="metric-sub">{summary.wingetUpgradeCandidates} upgrades available</span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="quick-actions-bar">
                {relevantTools.find(x => x.ToolId === 'SW01') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW01')!, 'AnalyzeOnly')}
                  >
                    <Layers size={14} />
                    <span>{t.quickCatalog}</span>
                  </button>
                )}
                {relevantTools.find(x => x.ToolId === 'SW02') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW02')!, 'AnalyzeOnly')}
                  >
                    <Terminal size={14} />
                    <span>{t.quickRuntimes}</span>
                  </button>
                )}
                {relevantTools.find(x => x.ToolId === 'SW04') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW04')!, 'WhatIf')}
                  >
                    <Archive size={14} />
                    <span>{t.quickQuarantine}</span>
                  </button>
                )}
                {relevantTools.find(x => x.ToolId === 'SW05') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW05')!, 'AnalyzeOnly')}
                  >
                    <ArrowUpRight size={14} />
                    <span>{t.quickUpgrade}</span>
                  </button>
                )}
              </div>

              {/* Signals Section */}
              <div className="signals-section">
                <h3 className="section-title">{t.signalsTitle}</h3>
                {signals.length === 0 ? (
                  <div className="empty-state-notice">
                    <CheckCircle2 size={24} className="text-success" />
                    <span>{t.noSignals}</span>
                  </div>
                ) : (
                  <div className="signals-list">
                    {signals.map(sig => {
                      const recTool = sig.recommendedToolId ? relevantTools.find(tl => tl.ToolId === sig.recommendedToolId) : null;
                      return (
                        <div key={sig.id} className={`signal-card ${sig.level}`}>
                          <div className="signal-header">
                            {sig.level === 'warning' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                            <strong className="signal-title">{lang === 'ar' ? sig.titleAr : sig.titleEn}</strong>
                          </div>
                          <p className="signal-detail">{lang === 'ar' ? sig.detailAr : sig.detailEn}</p>
                          {recTool && (
                            <button
                              type="button"
                              className="signal-action-btn"
                              onClick={() => handleLaunchTool(recTool, recTool.RiskLevel === 'READ_ONLY' ? 'AnalyzeOnly' : 'WhatIf')}
                            >
                              <span>{recTool.ToolId}: {lang === 'ar' ? (recTool.ArabicName || recTool.EnglishName) : recTool.EnglishName}</span>
                              <ArrowUpRight size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RUNTIMES & TOOLCHAINS */}
          {activeTab === 'runtimes' && (
            <div className="tab-pane runtimes-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.runtimesTitle}</h2>
                  <p>{t.runtimesSubtitle}</p>
                </div>
                <div className="search-box">
                  <Search size={15} />
                  <input
                    type="text"
                    value={runtimeQuery}
                    onChange={(e) => setRuntimeQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                  />
                </div>
              </div>

              <div className="runtimes-grid">
                {filteredRuntimes.map(rt => (
                  <div key={rt.Command} className={`runtime-card ${rt.Available ? 'is-available' : 'is-missing'}`}>
                    <div className="runtime-header">
                      <Terminal size={18} />
                      <strong className="runtime-command">{rt.Command}</strong>
                      <span className={`status-pill ${rt.Available ? 'success' : 'neutral'}`}>
                        {rt.Available ? t.available : t.missing}
                      </span>
                    </div>
                    <div className="runtime-meta">
                      <span className="runtime-version">{rt.Version || '—'}</span>
                      <small className="runtime-source" title={rt.Source || ''}>{rt.Source || 'Not in PATH'}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SOFTWARE CATALOG */}
          {activeTab === 'catalog' && (
            <div className="tab-pane catalog-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.catalogTitle}</h2>
                  <p>{t.catalogSubtitle}</p>
                </div>
                <div className="filter-controls-group">
                  <div className="kind-filters">
                    <button
                      type="button"
                      className={`filter-chip ${catalogKind === 'all' ? 'active' : ''}`}
                      onClick={() => setCatalogKind('all')}
                    >
                      {t.kindAll}
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${catalogKind === 'Desktop' ? 'active' : ''}`}
                      onClick={() => setCatalogKind('Desktop')}
                    >
                      {t.kindDesktop}
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${catalogKind === 'Appx' ? 'active' : ''}`}
                      onClick={() => setCatalogKind('Appx')}
                    >
                      {t.kindAppx}
                    </button>
                  </div>
                  <div className="search-box">
                    <Search size={15} />
                    <input
                      type="text"
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                    />
                  </div>
                </div>
              </div>

              <div className="data-table-container">
                <table className="station-data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Version</th>
                      <th>Publisher</th>
                      <th>Type</th>
                      <th>Uninstall Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.slice(0, 100).map((item, idx) => (
                      <tr key={`${item.Name}-${item.Version}-${idx}`}>
                        <td className="item-name-cell">
                          <strong>{item.Name}</strong>
                        </td>
                        <td className="monospace-cell">{item.Version || '—'}</td>
                        <td>{item.Publisher || '—'}</td>
                        <td>
                          <span className={`badge-type ${item.Kind === 'Appx' ? 'store' : 'win32'}`}>
                            {item.Kind === 'Appx' ? 'Store' : 'Win32'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge-status ${item.CanUninstall ? 'removable' : 'locked'}`}>
                            {item.CanUninstall ? t.canUninstall : t.cannotUninstall}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredCatalog.length > 100 && (
                  <div className="table-truncation-footer">
                    <span>Showing top 100 of {filteredCatalog.length} matched applications.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EXTENSIONS */}
          {activeTab === 'extensions' && (
            <div className="tab-pane extensions-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.extensionsTitle}</h2>
                  <p>{t.extensionsSubtitle}</p>
                </div>
                <div className="search-box">
                  <Search size={15} />
                  <input
                    type="text"
                    value={extensionQuery}
                    onChange={(e) => setExtensionQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                  />
                </div>
              </div>

              <div className="data-table-container">
                <table className="station-data-table">
                  <thead>
                    <tr>
                      <th>Extension Name</th>
                      <th>Version</th>
                      <th>Profile</th>
                      <th>Extension ID</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExtensions.map(ext => (
                      <tr key={`${ext.Profile}-${ext.ExtensionId}`}>
                        <td><strong>{ext.Name || ext.ExtensionId}</strong></td>
                        <td className="monospace-cell">{ext.Version}</td>
                        <td><span className="profile-pill">{ext.Profile}</span></td>
                        <td className="monospace-cell text-muted">{ext.ExtensionId}</td>
                        <td className="desc-cell">{ext.Description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: CACHES */}
          {activeTab === 'caches' && (
            <div className="tab-pane caches-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.cachesTitle}</h2>
                  <p>{t.cachesSubtitle}</p>
                </div>
                {relevantTools.find(x => x.ToolId === 'SW04') && (
                  <button
                    type="button"
                    className="action-button-primary"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW04')!, 'WhatIf')}
                  >
                    <Archive size={15} />
                    <span>{t.quarantineAction}</span>
                  </button>
                )}
              </div>

              <div className="caches-list">
                {(advancedData?.CacheEvidence ?? []).map(cache => (
                  <div key={cache.Path} className="cache-card">
                    <div className="cache-info">
                      <Archive size={20} className="text-warning" />
                      <div>
                        <strong>{cache.Name}</strong>
                        <p className="cache-path">{cache.Path}</p>
                      </div>
                    </div>
                    <div className="cache-stats">
                      <span className="cache-size">{formatBytes(cache.SizeBytes, lang)}</span>
                      <span className={`status-pill ${cache.Exists ? 'warning' : 'neutral'}`}>
                        {cache.Exists ? 'Accumulated' : 'Empty / Clean'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: WINGET */}
          {activeTab === 'winget' && (
            <div className="tab-pane winget-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.wingetTitle}</h2>
                  <p>{t.wingetSubtitle}</p>
                </div>
                <div className="winget-actions-row">
                  {relevantTools.find(x => x.ToolId === 'SW05') && (
                    <button
                      type="button"
                      className="action-button-primary"
                      onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW05')!, 'AnalyzeOnly')}
                    >
                      <ArrowUpRight size={15} />
                      <span>{t.upgradeAction}</span>
                    </button>
                  )}
                  {relevantTools.find(x => x.ToolId === 'SW06') && (
                    <button
                      type="button"
                      className="action-button-danger"
                      onClick={() => {
                        const packageId = window.prompt(t.packageIdPrompt);
                        if (packageId && packageId.trim()) {
                          handleLaunchTool(relevantTools.find(x => x.ToolId === 'SW06')!, 'Execute', {
                            customParameters: { PackageId: packageId.trim() }
                          });
                        }
                      }}
                    >
                      <Trash2 size={15} />
                      <span>{t.uninstallAction}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="winget-details-card">
                <div className="winget-status-banner">
                  <Database size={24} />
                  <div>
                    <strong>Windows Package Manager Client</strong>
                    <p>{advancedData?.Winget?.Available ? `Client Version: ${advancedData.Winget.Version}` : 'winget.exe not found on system PATH.'}</p>
                  </div>
                </div>

                <div className="winget-upgrades-console">
                  <h3>Available Upgrades Output</h3>
                  <pre className="console-output">
                    {(advancedData?.Winget?.UpgradeLines ?? []).join('\n') || 'No winget upgrade output available.'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ACTIONS */}
          {activeTab === 'actions' && (
            <div className="tab-pane actions-pane">
              <div className="tools-list-grid">
                {relevantTools.map(tool => {
                  const status = toolStatuses[tool.ToolId];
                  return (
                    <div key={tool.ToolId} className="tool-card">
                      <div className="tool-card-header">
                        <span className="tool-id-badge">{tool.ToolId}</span>
                        <strong className="tool-name">{lang === 'ar' ? (tool.ArabicName || tool.EnglishName) : tool.EnglishName}</strong>
                        <span className={`risk-pill ${tool.RiskLevel.toLowerCase()}`}>{tool.RiskLevel}</span>
                      </div>
                      <p className="tool-purpose">{tool.Purpose}</p>
                      <div className="tool-card-footer">
                        {tool.AnalyzeOnlySupported && (
                          <button
                            type="button"
                            className="tool-exec-btn analyze"
                            onClick={() => handleLaunchTool(tool, 'AnalyzeOnly')}
                          >
                            Analyze
                          </button>
                        )}
                        {tool.WhatIfSupported && (
                          <button
                            type="button"
                            className="tool-exec-btn whatif"
                            onClick={() => handleLaunchTool(tool, 'WhatIf')}
                          >
                            WhatIf
                          </button>
                        )}
                        {tool.RiskLevel !== 'READ_ONLY' && (
                          <button
                            type="button"
                            className="tool-exec-btn execute"
                            onClick={() => handleLaunchTool(tool, 'Execute')}
                          >
                            Execute
                          </button>
                        )}
                        {status && (
                          <span className={`tool-run-status ${status}`}>
                            {status === 'running' && <RefreshCw size={12} className="animate-spin" />}
                            {status === 'success' && <CheckCircle2 size={12} />}
                            {status === 'error' && <XCircle size={12} />}
                            <span>{status}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 8: HISTORY */}
          {activeTab === 'history' && (
            <div className="tab-pane history-pane">
              {history.length === 0 ? (
                <div className="empty-state-notice">
                  <History size={24} />
                  <span>{t.noHistory}</span>
                </div>
              ) : (
                <div className="history-entries-list">
                  {history.map((entry, idx) => (
                    <div key={`${entry.toolId}-${entry.timestamp}-${idx}`} className={`history-card ${entry.outcome}`}>
                      <div className="history-header">
                        <span className="tool-id-badge">{entry.toolId}</span>
                        <strong>{entry.toolName}</strong>
                        <span className="timestamp">{entry.timestamp}</span>
                      </div>
                      <p className="history-message">{entry.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Execution Confirmation Modal */}
        {pendingRun && (
          <ExecutionConfirmDialog
            tool={pendingRun.tool}
            mode={pendingRun.mode}
            lang={lang}
            initialOptions={pendingRun.options}
            onCancel={() => setPendingRun(null)}
            onConfirm={handleConfirmRun}
          />
        )}
      </div>
    </StationErrorBoundary>
  );
}
