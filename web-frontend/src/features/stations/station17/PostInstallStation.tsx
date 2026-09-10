import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Rocket, Layers, HardDrive, RefreshCw, Play,
  CheckCircle2, AlertTriangle, XCircle, History, Search,
  ArrowUpRight, Download, ShieldCheck, CheckSquare, Square,
  RotateCcw, ShieldAlert
} from 'lucide-react';
import type {
  BridgeTool, ExecutionMode,
  PostInstallPreview,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../types';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type ProvisioningSummary, type ProvisioningSignal,
  summarizeProvisioning, detectProvisioningSignals, filterCatalog,
  stationTools
} from './postInstallModel';
import PostInstallHeroVisual from './PostInstallHeroVisual';

export interface PostInstallStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'baseline' | 'catalog' | 'drivers' | 'winget' | 'actions' | 'history';

interface StationHistoryEntry {
  toolId: string;
  toolName: string;
  timestamp: string;
  outcome: 'success' | 'error' | 'cancelled' | 'inconclusive';
  message: string;
}

const COPY = {
  en: {
    eyebrow: 'POST-INSTALL PROVISIONING STUDIO',
    title: 'Workstation Provisioning & Setup',
    subtitle: 'Inspect system readiness, provision essential applications, discover Windows Update driver offers, and refresh package sources.',
    tabOverview: 'Overview',
    tabBaseline: 'System Baseline',
    tabCatalog: 'Essential Apps',
    tabDrivers: 'Driver Offers',
    tabWinget: 'Winget Environment',
    tabActions: 'Provisioning Tools',
    tabHistory: 'History',
    refresh: 'Query Readiness',
    refreshing: 'Inspecting workstation baseline...',
    installedApps: 'Installed Programs',
    pendingReboot: 'Pending Restart',
    missingApps: 'Missing Catalog Apps',
    driverOffers: 'Driver Offers',
    wingetStatus: 'Winget Client',
    servicesStatus: 'Update Services',
    signalsTitle: 'Provisioning Signals & Recommendations',
    noSignals: 'All post-install baseline checks and essential utilities are satisfied.',
    quickDiscoverDrivers: 'Discover Drivers (PI01)',
    quickCatalog: 'Catalog Export (PI03)',
    quickRefreshSources: 'Refresh Sources (PI05)',
    quickPreview: 'Full Preview (PI06)',
    baselineTitle: 'Operating System Baseline & Services',
    baselineSubtitle: 'Core Windows OS edition, build metrics, pending restart flags, and servicing subsystems.',
    catalogTitle: 'Essential Applications Catalog',
    catalogSubtitle: 'Transparent list of standard post-install utilities with exact Winget identifiers.',
    driversTitle: 'Windows Update Driver Offers',
    driversSubtitle: 'Applicable OEM and hardware drivers retrieved directly from Windows Update agent.',
    wingetTitle: 'Windows Package Manager Setup',
    wingetSubtitle: 'Winget client version, package source health, and catalog connectivity.',
    searchPlaceholder: 'Search catalog by name, category, or ID...',
    installSelectedApps: 'Install Selected Apps via PI04',
    installSelectedDrivers: 'Install Selected Drivers via PI02',
    refreshSourcesAction: 'Refresh Sources via PI05',
    adminRequiredNotice: 'Administrator privileges are required to install driver updates.',
    noSelection: 'Please select at least one item.',
    noDriversAvailable: 'Zero driver updates offered by Windows Update for this device.',
    noHistory: 'No tools executed in this session yet.',
    offlineNotice: 'Bridge server is currently offline. Start the KNOUX Bridge to query post-install telemetry.',
    selectAll: 'Select All Missing',
    deselectAll: 'Deselect All',
  },
  ar: {
    eyebrow: 'استوديو الإعداد والتجهيز بعد التثبيت',
    title: 'تهيئة وتجهيز بيئة العمل والنظام',
    subtitle: 'فحص جاهزية النظام، تثبيت التطبيقات الأساسية المعتمدة، استكشاف عروض تعريفات Windows Update، وتحديث مصادر الحزم.',
    tabOverview: 'نظرة عامة',
    tabBaseline: 'أساس النظام',
    tabCatalog: 'التطبيقات الأساسية',
    tabDrivers: 'عروض التعريفات',
    tabWinget: 'بيئة Winget',
    tabActions: 'أدوات التجهيز',
    tabHistory: 'السجل',
    refresh: 'فحص الجاهزية',
    refreshing: 'جاري فحص مؤشرات جاهزية النظام...',
    installedApps: 'البرامج المثبتة',
    pendingReboot: 'إعادة تشغيل معلقة',
    missingApps: 'تطبيقات غير مثبتة',
    driverOffers: 'عروض التعريفات',
    wingetStatus: 'عميل Winget',
    servicesStatus: 'خدمات التحديث',
    signalsTitle: 'مؤشرات التجهيز والتوصيات الهندسية',
    noSignals: 'جميع فحوصات جاهزية النظام والبرامج الأساسية مستوفاة بحالة ممتازة.',
    quickDiscoverDrivers: 'استكشاف التعريفات (PI01)',
    quickCatalog: 'كتالوج التطبيقات (PI03)',
    quickRefreshSources: 'تحديث المصادر (PI05)',
    quickPreview: 'معاينة شاملة (PI06)',
    baselineTitle: 'أساس نظام التشغيل والخدمات',
    baselineSubtitle: 'إصدار ويندوز، رقم البناء، مؤشرات إعادة التشغيل المعلقة، وخدمات التحديث.',
    catalogTitle: 'كتالوج التطبيقات الأساسية المعتمدة',
    catalogSubtitle: 'قائمة شفافة للتطبيقات الشائعة بعد التثبيت بمعرفات Winget الدقيقة دون برامج إضافية.',
    driversTitle: 'عروض تعريفات Windows Update',
    driversSubtitle: 'تحديثات التعريفات المتاحة للأجهزة من خوادم تحديث مايكروسوفت المعتمدة.',
    wingetTitle: 'تهيئة مدير حزم ويندوز (Winget)',
    wingetSubtitle: 'إصدار عميل Winget وصحة مصادر الحزم والاتصال بالكتالوج.',
    searchPlaceholder: 'بحث في الكتالوج بالاسم أو الفئة أو المعرف...',
    installSelectedApps: 'تثبيت التطبيقات المختارة عبر PI04',
    installSelectedDrivers: 'تثبيت التعريفات المختارة عبر PI02',
    refreshSourcesAction: 'تحديث مصادر Winget عبر PI05',
    adminRequiredNotice: 'صلاحيات المسؤول مطلوبة لتثبيت تحديثات التعريفات.',
    noSelection: 'يرجى اختيار عنصر واحد على الأقل.',
    noDriversAvailable: 'لا توجد عروض تحديث تعريفات معلقة من Windows Update لهذا الجهاز.',
    noHistory: 'لم يتم تشغيل أدوات في هذه الجلسة بعد.',
    offlineNotice: 'خادم الجسر غير متصل حالياً. شغل جسر KNOUX لاسترجاع بيانات التجهيز.',
    selectAll: 'تحديد كل المفقود',
    deselectAll: 'إلغاء التحديد',
  }
};

export default function PostInstallStation(props: PostInstallStationProps) {
  const { lang, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus } = props;
  const t = COPY[lang];

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PostInstallPreview | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Search and selection states
  const [catalogQuery, setCatalogQuery] = useState<string>('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'missing' | 'installed'>('all');
  const [selectedAppSelections, setSelectedAppSelections] = useState<number[]>([]);
  const [selectedDriverSelections, setSelectedDriverSelections] = useState<number[]>([]);

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
      const res = await api.postInstallPreview();
      if (res?.preview) {
        setPreviewData(res.preview);
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

  const summary: ProvisioningSummary = useMemo(
    () => summarizeProvisioning(previewData),
    [previewData]
  );

  const signals: ProvisioningSignal[] = useMemo(
    () => detectProvisioningSignals(previewData),
    [previewData]
  );

  const filteredCatalog = useMemo(
    () => filterCatalog(previewData?.Catalog, catalogQuery, catalogFilter),
    [previewData?.Catalog, catalogQuery, catalogFilter]
  );

  const handleToggleApp = useCallback((selection: number) => {
    setSelectedAppSelections(prev =>
      prev.includes(selection) ? prev.filter(s => s !== selection) : [...prev, selection]
    );
  }, []);

  const handleSelectAllMissing = useCallback(() => {
    if (!previewData?.Catalog) return;
    const missing = previewData.Catalog.filter(c => !c.Detected).map(c => c.Selection);
    setSelectedAppSelections(missing);
  }, [previewData?.Catalog]);

  const handleDeselectAllApps = useCallback(() => {
    setSelectedAppSelections([]);
  }, []);

  const handleToggleDriver = useCallback((selection: number) => {
    setSelectedDriverSelections(prev =>
      prev.includes(selection) ? prev.filter(s => s !== selection) : [...prev, selection]
    );
  }, []);

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

  if (bridgeOnline === false && !previewData) {
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
      <div className="glass-nexus-station post-install-station-root" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
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
            <Rocket size={15} />
            <span>{t.tabOverview}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'baseline' ? 'active' : ''}`}
            onClick={() => setActiveTab('baseline')}
          >
            <HardDrive size={15} />
            <span>{t.tabBaseline}</span>
            {summary.pendingRestartCount > 0 && (
              <span className="tab-pill danger">{summary.pendingRestartCount}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Layers size={15} />
            <span>{t.tabCatalog}</span>
            <span className="tab-pill">{summary.catalogMissing}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
            onClick={() => setActiveTab('drivers')}
          >
            <Download size={15} />
            <span>{t.tabDrivers}</span>
            {summary.driverOffersCount > 0 && (
              <span className="tab-pill warning">{summary.driverOffersCount}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'winget' ? 'active' : ''}`}
            onClick={() => setActiveTab('winget')}
          >
            <ShieldCheck size={15} />
            <span>{t.tabWinget}</span>
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
                <PostInstallHeroVisual
                  readiness={summary.readiness}
                  installedAppsCount={summary.installedAppsCount}
                  catalogDetected={summary.catalogDetected}
                  catalogTotal={summary.catalogTotal}
                  driverOffersCount={summary.driverOffersCount}
                  pendingRestartCount={summary.pendingRestartCount}
                  wingetAvailable={summary.wingetAvailable}
                  lang={lang}
                />
              </div>

              {/* KPI Metrics Grid */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">{t.installedApps}</span>
                  <span className="metric-value primary">{summary.installedAppsCount}</span>
                  <span className="metric-sub">{summary.systemCaption}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.pendingReboot}</span>
                  <span className={`metric-value ${summary.pendingRestartCount > 0 ? 'danger' : 'success'}`}>
                    {summary.pendingRestartCount > 0 ? `${summary.pendingRestartCount} signals` : 'None'}
                  </span>
                  <span className="metric-sub">{summary.pendingRestartCount > 0 ? 'Reboot recommended' : 'Clean state'}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.missingApps}</span>
                  <span className={`metric-value ${summary.catalogMissing > 0 ? 'warning' : 'success'}`}>
                    {summary.catalogMissing} / {summary.catalogTotal}
                  </span>
                  <span className="metric-sub">Catalog utilities</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.driverOffers}</span>
                  <span className="metric-value info">{summary.driverOffersCount}</span>
                  <span className="metric-sub">Windows Update</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">{t.wingetStatus}</span>
                  <span className="metric-value">{summary.wingetAvailable ? (summary.wingetVersion || 'Ready') : 'Missing'}</span>
                  <span className="metric-sub">{summary.wingetSourcesCount} sources active</span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="quick-actions-bar">
                {relevantTools.find(x => x.ToolId === 'PI01') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI01')!, 'AnalyzeOnly')}
                  >
                    <Download size={14} />
                    <span>{t.quickDiscoverDrivers}</span>
                  </button>
                )}
                {relevantTools.find(x => x.ToolId === 'PI03') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI03')!, 'AnalyzeOnly')}
                  >
                    <Layers size={14} />
                    <span>{t.quickCatalog}</span>
                  </button>
                )}
                {relevantTools.find(x => x.ToolId === 'PI05') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI05')!, 'WhatIf')}
                  >
                    <RefreshCw size={14} />
                    <span>{t.quickRefreshSources}</span>
                  </button>
                )}
                {relevantTools.find(x => x.ToolId === 'PI06') && (
                  <button
                    type="button"
                    className="quick-action-pill"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI06')!, 'AnalyzeOnly')}
                  >
                    <ArrowUpRight size={14} />
                    <span>{t.quickPreview}</span>
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

          {/* TAB 2: BASELINE */}
          {activeTab === 'baseline' && (
            <div className="tab-pane baseline-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.baselineTitle}</h2>
                  <p>{t.baselineSubtitle}</p>
                </div>
              </div>

              <div className="baseline-cards-grid">
                <div className="baseline-card">
                  <h3>Operating System</h3>
                  <div className="baseline-kv">
                    <span>Edition:</span>
                    <strong>{previewData?.System.Caption || '—'}</strong>
                  </div>
                  <div className="baseline-kv">
                    <span>Build Number:</span>
                    <strong>{previewData?.System.Build || '—'}</strong>
                  </div>
                  <div className="baseline-kv">
                    <span>Last Boot:</span>
                    <strong>{previewData?.System.LastBoot ? new Date(previewData.System.LastBoot).toLocaleString() : '—'}</strong>
                  </div>
                  <div className="baseline-kv">
                    <span>Installed Programs:</span>
                    <strong>{previewData?.System.InstalledProgramCount ?? '—'}</strong>
                  </div>
                </div>

                <div className="baseline-card">
                  <h3>Pending Restart Signals</h3>
                  {(previewData?.System.PendingRestartSignals ?? []).length === 0 ? (
                    <div className="empty-state-notice">
                      <CheckCircle2 size={18} className="text-success" />
                      <span>No pending restarts detected.</span>
                    </div>
                  ) : (
                    <ul className="signals-ul">
                      {previewData!.System.PendingRestartSignals.map((sig, i) => (
                        <li key={i} className="restart-signal-item">
                          <AlertTriangle size={14} className="text-warning" />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="baseline-card full-width">
                  <h3>Windows Update Servicing Subsystems</h3>
                  <table className="station-data-table">
                    <thead>
                      <tr>
                        <th>Service Name</th>
                        <th>Current Status</th>
                        <th>Startup Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewData?.UpdateServices ?? []).map(svc => (
                        <tr key={svc.Name}>
                          <td><strong>{svc.Name}</strong></td>
                          <td>
                            <span className={`status-pill ${svc.Status === 'Running' ? 'success' : 'neutral'}`}>
                              {svc.Status}
                            </span>
                          </td>
                          <td className="monospace-cell">{svc.StartType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CATALOG */}
          {activeTab === 'catalog' && (
            <div className="tab-pane catalog-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.catalogTitle}</h2>
                  <p>{t.catalogSubtitle}</p>
                </div>
                <div className="catalog-actions-row">
                  <button
                    type="button"
                    className="action-button-secondary"
                    onClick={handleSelectAllMissing}
                  >
                    <CheckSquare size={14} />
                    <span>{t.selectAll}</span>
                  </button>
                  <button
                    type="button"
                    className="action-button-secondary"
                    onClick={handleDeselectAllApps}
                  >
                    <Square size={14} />
                    <span>{t.deselectAll}</span>
                  </button>
                  {relevantTools.find(x => x.ToolId === 'PI04') && (
                    <button
                      type="button"
                      className="action-button-primary"
                      disabled={selectedAppSelections.length === 0}
                      onClick={() => {
                        if (selectedAppSelections.length === 0) return;
                        const selectionStr = selectedAppSelections.sort((a, b) => a - b).join(',');
                        handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI04')!, 'WhatIf', {
                          customParameters: { Selection: selectionStr }
                        });
                      }}
                    >
                      <Download size={14} />
                      <span>{t.installSelectedApps} ({selectedAppSelections.length})</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="filter-controls-group">
                <div className="kind-filters">
                  <button
                    type="button"
                    className={`filter-chip ${catalogFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setCatalogFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${catalogFilter === 'missing' ? 'active' : ''}`}
                    onClick={() => setCatalogFilter('missing')}
                  >
                    Missing Only
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${catalogFilter === 'installed' ? 'active' : ''}`}
                    onClick={() => setCatalogFilter('installed')}
                  >
                    Installed
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

              <div className="data-table-container">
                <table className="station-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Select</th>
                      <th>Application</th>
                      <th>Winget Identifier</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.map(item => {
                      const isSelected = selectedAppSelections.includes(item.Selection);
                      return (
                        <tr
                          key={item.PackageId}
                          className={isSelected ? 'selected-row' : ''}
                          onClick={() => !item.Detected && handleToggleApp(item.Selection)}
                          style={{ cursor: !item.Detected ? 'pointer' : 'default' }}
                        >
                          <td>
                            {!item.Detected ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleApp(item.Selection)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <CheckCircle2 size={16} className="text-success" />
                            )}
                          </td>
                          <td><strong>{item.Name}</strong></td>
                          <td className="monospace-cell">{item.PackageId}</td>
                          <td><span className="profile-pill">{item.Category}</span></td>
                          <td>
                            <span className={`status-pill ${item.Detected ? 'success' : 'warning'}`}>
                              {item.Detected ? 'Installed' : 'Available'}
                            </span>
                          </td>
                          <td className="desc-cell text-muted">{item.Evidence || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DRIVERS */}
          {activeTab === 'drivers' && (
            <div className="tab-pane drivers-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.driversTitle}</h2>
                  <p>{t.driversSubtitle}</p>
                </div>
                {relevantTools.find(x => x.ToolId === 'PI02') && (
                  <button
                    type="button"
                    className="action-button-primary"
                    disabled={selectedDriverSelections.length === 0}
                    onClick={() => {
                      if (selectedDriverSelections.length === 0) return;
                      const selStr = selectedDriverSelections.sort((a, b) => a - b).join(',');
                      handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI02')!, 'WhatIf', {
                        customParameters: { Selection: selStr }
                      });
                    }}
                  >
                    <Download size={14} />
                    <span>{t.installSelectedDrivers} ({selectedDriverSelections.length})</span>
                  </button>
                )}
              </div>

              {!bridgeElevated && (
                <div className="station-banner notice">
                  <ShieldAlert size={16} />
                  <span>{t.adminRequiredNotice}</span>
                </div>
              )}

              {previewData?.DriverOffers.Count === 0 || !previewData?.DriverOffers.Offers || previewData.DriverOffers.Offers.length === 0 ? (
                <div className="empty-state-notice">
                  <CheckCircle2 size={24} className="text-success" />
                  <span>{t.noDriversAvailable}</span>
                </div>
              ) : (
                <div className="data-table-container">
                  <table className="station-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>Select</th>
                        <th>Offer Title</th>
                        <th>Driver Class</th>
                        <th>Model</th>
                        <th>Release Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.DriverOffers.Offers.map(offer => {
                        const isSelected = selectedDriverSelections.includes(offer.Selection);
                        return (
                          <tr
                            key={offer.Selection}
                            className={isSelected ? 'selected-row' : ''}
                            onClick={() => handleToggleDriver(offer.Selection)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleDriver(offer.Selection)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td><strong>{offer.Title}</strong></td>
                            <td><span className="profile-pill">{offer.DriverClass}</span></td>
                            <td className="monospace-cell">{offer.DriverModel}</td>
                            <td className="monospace-cell text-muted">{offer.DriverVerDate}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: WINGET */}
          {activeTab === 'winget' && (
            <div className="tab-pane winget-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.wingetTitle}</h2>
                  <p>{t.wingetSubtitle}</p>
                </div>
                {relevantTools.find(x => x.ToolId === 'PI05') && (
                  <button
                    type="button"
                    className="action-button-primary"
                    onClick={() => handleLaunchTool(relevantTools.find(x => x.ToolId === 'PI05')!, 'WhatIf')}
                  >
                    <RotateCcw size={14} />
                    <span>{t.refreshSourcesAction}</span>
                  </button>
                )}
              </div>

              <div className="winget-details-card">
                <div className="baseline-kv">
                  <span>Client Detected:</span>
                  <strong>{previewData?.Winget.Available ? 'Yes' : 'No'}</strong>
                </div>
                <div className="baseline-kv">
                  <span>Client Version:</span>
                  <strong className="monospace-cell">{previewData?.Winget.Version || '—'}</strong>
                </div>
                <div className="baseline-kv">
                  <span>Configured Sources:</span>
                  <strong>{previewData?.Winget.SourceCount ?? '—'}</strong>
                </div>
                {previewData?.Winget.Error && (
                  <div className="station-banner warning">
                    <AlertTriangle size={16} />
                    <span>{previewData.Winget.Error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: ACTIONS */}
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

          {/* TAB 7: HISTORY */}
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
