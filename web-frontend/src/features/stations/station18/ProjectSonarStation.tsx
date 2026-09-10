import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Radar, FolderKanban, ShieldCheck, FileCode2, GitBranch,
  BarChart3, Sparkles, ChevronRight, Check, Download,
  WandSparkles, LoaderCircle, TriangleAlert, CheckCircle2,
  RefreshCw, Play, XCircle, History
} from 'lucide-react';
import type {
  BridgeTool, ExecutionMode,
  ProjectSonarPreview, ProjectSonarFinding, ProjectSonarAiAnalysis,
  SonarSeverity, ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api, BRIDGE_URL } from '../../../lib/api';
import type { Lang } from '../../../types';
import WorkspaceFolderPicker from '../../../components/WorkspaceFolderPicker';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type SonarSummary,
  SEVERITIES, severityLabel,
  summarizeSonar, filterFindings, stationTools
} from './sonarModel';
import SonarHeroVisual from './SonarHeroVisual';

export interface ProjectSonarStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses?: Record<string, string>;
  bridgeElevated?: boolean;
  bridgeOnline?: boolean | null;
  onRetryBridge?: () => void;
  onToolStatus?: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
  onPrepareRun?: (tool: BridgeTool, mode: 'run' | 'analyze' | 'preview', options: ToolRunOptions) => void;
}

type TabKey = 'workspace' | 'findings' | 'plan' | 'export' | 'tools' | 'history';

interface StationHistoryEntry {
  toolId: string;
  toolName: string;
  timestamp: string;
  outcome: 'success' | 'error' | 'cancelled' | 'inconclusive';
  message: string;
}

const COPY = {
  en: {
    eyebrow: 'PROJECT INTELLIGENCE & CODEBASE RADAR',
    title: 'Project Sonar',
    subtitle: 'Audit project architecture, detect Git readiness and dependencies, prioritize evidence-backed findings, and export auditable reports.',
    tabWorkspace: 'Overview & Workspace',
    tabFindings: 'Priority Findings',
    tabPlan: 'Service Plan',
    tabExport: 'Export & AI Center',
    tabTools: 'Sonar Tools',
    tabHistory: 'History',
    chooseProject: 'Choose Project',
    selectedProject: 'Selected Project',
    noProjectSelected: 'No project workspace selected',
    runSonar: 'Run Sonar',
    analyzing: 'Scanning workspace...',
    filesObserved: 'Files Observed',
    gitStatus: 'Git Repository',
    languages: 'Languages',
    packageName: 'Package Name',
    priorityBoard: 'Priority Board',
    evidenceFindings: 'Evidence-Backed Findings',
    all: 'All',
    noFindings: 'No findings match this severity filter.',
    evidence: 'Evidence',
    recommendedStep: 'Recommended Next Step',
    guidedPlan: 'Guided Service Plan',
    readyActions: 'Actions Ready to Review',
    exportCenter: 'Export Center',
    shareReport: 'Share an Auditable Report',
    exportNotice: 'Reports are generated from local Sonar evidence and do not include source contents or secrets.',
    optionalAnalysis: 'Optional AI Analysis',
    createAnalysis: 'Create Optional Analysis',
    aiNotConfigured: 'Optional AI analysis is not configured in the local service.',
    noPlanActions: 'No registered service action is suggested by the current scan.',
    localEvidenceOnly: 'Local evidence only',
    noHistory: 'No tools executed in this session yet.',
    offlineNotice: 'Bridge server is currently offline. Start the KNOUX Bridge to run Project Sonar.',
    mayChangeDevice: 'May modify workspace/system after confirmation',
    reviewOnly: 'Review or check only',
  },
  ar: {
    eyebrow: 'رادار استكشاف المشاريع وهندسة البرمجيات',
    title: 'Project Sonar — استكشاف المشاريع',
    subtitle: 'تدقيق بنية المشاريع، فحص جاهزية Git والاعتمادات، ترتيب النتائج حسب الأولوية، وتصدير تقارير تدقيق شاملة.',
    tabWorkspace: 'نظرة عامة ومساحة العمل',
    tabFindings: 'لوحة الأولويات والنتائج',
    tabPlan: 'خطة الخدمة الموجهة',
    tabExport: 'مركز التصدير والذكاء الاصطناعي',
    tabTools: 'أدوات Sonar',
    tabHistory: 'السجل',
    chooseProject: 'اختيار مساحة عمل',
    selectedProject: 'المشروع المختار',
    noProjectSelected: 'لم يتم اختيار مجلد المشروع',
    runSonar: 'تشغيل سونار',
    analyzing: 'جاري فحص المشروع...',
    filesObserved: 'الملفات المرصودة',
    gitStatus: 'مستودع Git',
    languages: 'اللغات',
    packageName: 'اسم الحزمة',
    priorityBoard: 'لوحة الأولويات',
    evidenceFindings: 'النتائج المبنية على الأدلة',
    all: 'الكل',
    noFindings: 'لا توجد نتائج ضمن هذا المرشح.',
    evidence: 'الدليل',
    recommendedStep: 'الخطوة المقترحة',
    guidedPlan: 'الخطة الموجهة',
    readyActions: 'إجراءات جاهزة للمراجعة',
    exportCenter: 'مركز التصدير',
    shareReport: 'مشاركة تقرير قابل للتدقيق',
    exportNotice: 'تُنشأ التقارير من دليل Sonar المحلي حصراً ولا تتضمن محتويات الشيفرة أو المفاتيح السرية.',
    optionalAnalysis: 'تحليل الذكاء الاصطناعي الاختياري',
    createAnalysis: 'إنشاء تحليل ذكي',
    aiNotConfigured: 'التحليل الذكي الاختياري غير مهيأ في الخدمة المحلية.',
    noPlanActions: 'لا توجد خطوة خدمة مقترحة من الفحص الحالي.',
    localEvidenceOnly: 'دليل محلي فقط',
    noHistory: 'لم يتم تشغيل أدوات في هذه الجلسة بعد.',
    offlineNotice: 'خادم الجسر غير متصل حالياً. شغل جسر KNOUX لتشغيل Project Sonar.',
    mayChangeDevice: 'قد يُجري تعديلات بعد التأكيد',
    reviewOnly: 'فحص ومراجعة فقط',
  }
};

export default function ProjectSonarStation(props: ProjectSonarStationProps) {
  const {
    lang, tools, toolStatuses = {}, bridgeElevated = false,
    bridgeOnline = true, onRetryBridge, onToolStatus, onPrepareRun
  } = props;
  const t = COPY[lang];

  const [activeTab, setActiveTab] = useState<TabKey>('workspace');
  const [workspace, setWorkspace] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [preview, setPreview] = useState<ProjectSonarPreview | null>(null);
  const [filter, setFilter] = useState<'ALL' | SonarSeverity>('ALL');
  const [findingQuery, setFindingQuery] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<'pdf' | 'markdown' | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<ProjectSonarAiAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // History tracking
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);

  // Execution dialog state
  const [pendingRun, setPendingRun] = useState<{
    tool: BridgeTool;
    mode: ExecutionMode;
    options?: ToolRunOptions;
  } | null>(null);

  const relevantTools = useMemo(() => stationTools(tools), [tools]);

  useEffect(() => {
    api.sonarAiStatus()
      .then((status) => setAiReady(status.configured))
      .catch(() => setAiReady(false));
  }, []);

  const scan = useCallback(async () => {
    if (!workspace.trim()) {
      setError(lang === 'ar' ? 'اختر مجلد المشروع قبل تشغيل سونار.' : 'Choose a project folder before running Sonar.');
      return;
    }
    setLoading(true);
    setError('');
    setPreview(null);
    setAnalysis(null);
    setSelectedCode(null);
    try {
      const response = await api.sonarPreview(workspace);
      setPreview(response.preview);
    } catch {
      setError(
        lang === 'ar'
          ? 'تعذر فحص مساحة العمل. تأكد من تشغيل خدمة KNOUX ومن أن مجلد المشروع متاح.'
          : 'KNOUX could not scan this workspace. Check that the local service is running and the project folder is available.'
      );
    } finally {
      setLoading(false);
    }
  }, [lang, workspace]);

  const summary: SonarSummary = useMemo(
    () => summarizeSonar(preview, workspace),
    [preview, workspace]
  );

  const filteredFindings = useMemo(
    () => filterFindings(preview?.Findings, filter, findingQuery),
    [preview?.Findings, filter, findingQuery]
  );

  const selectedFinding: ProjectSonarFinding | null = useMemo(() => {
    if (!preview?.Findings) return null;
    return (
      filteredFindings.find(f => f.Code === selectedCode) ||
      preview.Findings.find(f => f.Code === selectedCode) ||
      filteredFindings[0] ||
      null
    );
  }, [preview?.Findings, filteredFindings, selectedCode]);

  const exportReport = useCallback(async (format: 'pdf' | 'markdown') => {
    if (!workspace) return;
    setExporting(format);
    setError('');
    try {
      const { export: item } = await api.sonarExport(workspace, format, lang);
      window.open(`${BRIDGE_URL}${item.downloadUrl}`, '_blank', 'noopener,noreferrer');
    } catch {
      setError(lang === 'ar' ? 'تعذر إنشاء التقرير المطلوب محلياً.' : 'KNOUX could not create the requested local report.');
    } finally {
      setExporting(null);
    }
  }, [workspace, lang]);

  const runAnalysis = useCallback(async () => {
    if (!workspace || !aiReady) return;
    setAnalysisLoading(true);
    setError('');
    try {
      const result = await api.sonarAnalysis(workspace, lang);
      setAnalysis(result);
    } catch {
      setError(lang === 'ar' ? 'تعذر إنشاء التحليل الاختياري للمشروع.' : 'The optional project analysis could not be generated.');
    } finally {
      setAnalysisLoading(false);
    }
  }, [workspace, aiReady, lang]);

  const openPlanAction = useCallback((toolId: string) => {
    const tool = tools.find(c => c.ToolId === toolId);
    if (!tool) return;
    if (onPrepareRun) {
      onPrepareRun(tool, tool.AnalyzeOnlySupported ? 'analyze' : tool.WhatIfSupported ? 'preview' : 'run', {});
    } else {
      setPendingRun({
        tool,
        mode: tool.RiskLevel === 'READ_ONLY' ? 'AnalyzeOnly' : 'WhatIf',
      });
    }
  }, [tools, onPrepareRun]);

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

    if (onToolStatus) onToolStatus(tool.ToolId, 'running');
    try {
      const runId = await startExecution(tool, mode, options, confirmation);
      const finalRecord = await pollExecution(runId, 250);

      const outcome = finalRecord.Outcome === 'Success' ? 'success'
        : finalRecord.Outcome === 'Failed' ? 'error'
        : finalRecord.Outcome === 'Cancelled' ? 'cancelled'
        : 'inconclusive';

      if (onToolStatus) onToolStatus(tool.ToolId, outcome);

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
    } catch (err: unknown) {
      if (onToolStatus) onToolStatus(tool.ToolId, 'error');
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
  }, [pendingRun, onToolStatus, lang]);

  if (bridgeOnline === false && !preview) {
    return (
      <StationOfflineState
        lang={lang}
        onRetryBridge={onRetryBridge || (() => {})}
        customNotice={t.offlineNotice}
      />
    );
  }

  return (
    <StationErrorBoundary lang={lang}>
      <div className="glass-nexus-station project-sonar-station-root" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* Header Bar */}
        <header className="station-header">
          <div className="station-title-group">
            <span className="station-eyebrow">{t.eyebrow}</span>
            <h1 className="station-title">{t.title}</h1>
            <p className="station-subtitle">{t.subtitle}</p>
          </div>
          <div className="station-actions-group">
            <div className="sonar-privacy-chip">
              <ShieldCheck size={15} />
              <span>{t.localEvidenceOnly}</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="station-banner warning">
            <TriangleAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Workspace Selector Bar */}
        <div className="sonar-workspace-bar">
          <FolderKanban size={22} className="text-primary" />
          <div className="workspace-label-group">
            <small>{t.selectedProject}</small>
            <strong className="workspace-path-text">{workspace || t.noProjectSelected}</strong>
          </div>
          <button
            type="button"
            className="action-button-secondary"
            onClick={() => setPickerOpen(true)}
          >
            {t.chooseProject}
          </button>
          <button
            type="button"
            className="action-button-primary"
            onClick={scan}
            disabled={loading || !workspace.trim()}
          >
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Radar size={15} />}
            <span>{loading ? t.analyzing : t.runSonar}</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <nav className="station-tabs-nav" aria-label="Station tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveTab('workspace')}
          >
            <Radar size={15} />
            <span>{t.tabWorkspace}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
            onClick={() => setActiveTab('findings')}
          >
            <BarChart3 size={15} />
            <span>{t.tabFindings}</span>
            <span className="tab-pill">{summary.totalFindings}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            <Check size={15} />
            <span>{t.tabPlan}</span>
            <span className="tab-pill">{preview?.ServicePlan?.length ?? 0}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={15} />
            <span>{t.tabExport}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <Play size={15} />
            <span>{t.tabTools}</span>
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
          {/* TAB 1: OVERVIEW & WORKSPACE */}
          {activeTab === 'workspace' && (
            <div className="tab-pane overview-pane">
              <div className="overview-hero-layout">
                <SonarHeroVisual
                  condition={summary.condition}
                  fileCount={summary.fileCount}
                  isGitRepo={summary.isGitRepo}
                  gitBranch={summary.gitBranch}
                  criticalCount={summary.criticalCount}
                  highCount={summary.highCount}
                  totalFindings={summary.totalFindings}
                  languages={summary.languages}
                  lang={lang}
                />
              </div>

              {preview ? (
                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-label">{t.filesObserved}</span>
                    <span className="metric-value primary">{summary.fileCount.toLocaleString()}</span>
                    <span className="metric-sub">Local filesystem bounded</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t.gitStatus}</span>
                    <span className="metric-value success">
                      {summary.isGitRepo ? (summary.gitBranch || 'Active') : 'Not detected'}
                    </span>
                    <span className="metric-sub">{summary.isGitRepo ? 'Git branch detected' : 'Non-git project'}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t.languages}</span>
                    <span className="metric-value info">
                      {summary.languages.join(' · ') || '—'}
                    </span>
                    <span className="metric-sub">Technology markers</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t.packageName}</span>
                    <span className="metric-value">
                      {summary.packageName || '—'}
                    </span>
                    <span className="metric-sub">Project manifest</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state-notice">
                  <Radar size={28} className="text-primary" />
                  <span>{lang === 'ar' ? 'اختر مجلد مساحة العمل واضغط تشغيل سونار لاستكشاف المشروع.' : 'Select a workspace folder and click Run Sonar to inspect your project.'}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRIORITY FINDINGS */}
          {activeTab === 'findings' && (
            <div className="tab-pane findings-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.priorityBoard}</h2>
                  <p>{t.evidenceFindings}</p>
                </div>
                <div className="sonar-severity-filter">
                  <button
                    type="button"
                    className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilter('ALL')}
                  >
                    {t.all}
                  </button>
                  {SEVERITIES.map(sev => {
                    const count = preview?.SeverityCounts?.[sev[0] + sev.slice(1).toLowerCase() as keyof typeof preview.SeverityCounts] ?? 0;
                    return (
                      <button
                        type="button"
                        key={sev}
                        className={`filter-chip ${sev.toLowerCase()} ${filter === sev ? 'active' : ''}`}
                        onClick={() => setFilter(sev)}
                      >
                        {severityLabel(sev, lang)} {count}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredFindings.length === 0 ? (
                <div className="empty-state-notice">
                  <CheckCircle2 size={24} className="text-success" />
                  <span>{t.noFindings}</span>
                </div>
              ) : (
                <div className="sonar-findings-layout">
                  <div className="sonar-finding-list">
                    {filteredFindings.map(f => (
                      <button
                        type="button"
                        key={f.Code}
                        className={`sonar-finding-row ${f.Severity.toLowerCase()} ${selectedFinding?.Code === f.Code ? 'is-selected' : ''}`}
                        onClick={() => setSelectedCode(f.Code)}
                      >
                        <span className={`sonar-severity-badge ${f.Severity.toLowerCase()}`}>
                          {severityLabel(f.Severity, lang)}
                        </span>
                        <div className="finding-body">
                          <strong>{lang === 'ar' ? f.TitleAr : f.TitleEn}</strong>
                          <small>{f.Evidence}</small>
                        </div>
                        <ChevronRight size={16} className="rtl:rotate-180" />
                      </button>
                    ))}
                  </div>

                  {selectedFinding && (
                    <aside className="sonar-finding-detail">
                      <span className={`sonar-severity-badge ${selectedFinding.Severity.toLowerCase()}`}>
                        {severityLabel(selectedFinding.Severity, lang)}
                      </span>
                      <h3>{lang === 'ar' ? selectedFinding.TitleAr : selectedFinding.TitleEn}</h3>
                      <div className="detail-section">
                        <small>{t.evidence}</small>
                        <p>{selectedFinding.Evidence}</p>
                      </div>
                      <div className="detail-section">
                        <small>{t.recommendedStep}</small>
                        <p>{lang === 'ar' ? selectedFinding.FixAr : selectedFinding.FixEn}</p>
                      </div>
                    </aside>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GUIDED SERVICE PLAN */}
          {activeTab === 'plan' && (
            <div className="tab-pane plan-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.guidedPlan}</h2>
                  <p>{t.readyActions}</p>
                </div>
              </div>

              {(preview?.ServicePlan ?? []).length === 0 ? (
                <div className="empty-state-notice">
                  <CheckCircle2 size={24} className="text-success" />
                  <span>{t.noPlanActions}</span>
                </div>
              ) : (
                <div className="service-plan-list">
                  {preview!.ServicePlan.map((item, idx) => (
                    <button
                      type="button"
                      key={`${item.ToolId}-${item.Action}-${idx}`}
                      className="service-plan-card"
                      onClick={() => openPlanAction(item.ToolId)}
                      disabled={!tools.some(tl => tl.ToolId === item.ToolId)}
                    >
                      <div className="plan-icon-box">
                        <Check size={16} />
                      </div>
                      <div className="plan-details">
                        <strong>{item.Action}</strong>
                        <small>{item.Changes ? t.mayChangeDevice : t.reviewOnly}</small>
                      </div>
                      <div className="plan-meta">
                        <span className="tool-id-badge">{item.ToolId}</span>
                        <ChevronRight size={16} className="rtl:rotate-180" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXPORT & AI CENTER */}
          {activeTab === 'export' && (
            <div className="tab-pane export-pane">
              <div className="pane-header-box">
                <div>
                  <h2>{t.exportCenter}</h2>
                  <p>{t.shareReport}</p>
                </div>
              </div>

              <div className="export-cards-grid">
                <div className="export-card">
                  <h3>Document Export</h3>
                  <p>{t.exportNotice}</p>
                  <div className="export-buttons-row">
                    <button
                      type="button"
                      className="action-button-primary"
                      onClick={() => exportReport('markdown')}
                      disabled={exporting !== null || !workspace}
                    >
                      <Download size={15} />
                      <span>{exporting === 'markdown' ? 'Generating…' : 'Markdown Report'}</span>
                    </button>
                    <button
                      type="button"
                      className="action-button-primary"
                      onClick={() => exportReport('pdf')}
                      disabled={exporting !== null || !workspace}
                    >
                      <Download size={15} />
                      <span>{exporting === 'pdf' ? 'Generating…' : 'PDF Report'}</span>
                    </button>
                  </div>
                </div>

                <div className="export-card">
                  <h3>{t.optionalAnalysis}</h3>
                  {aiReady ? (
                    <button
                      type="button"
                      className="action-button-primary"
                      onClick={runAnalysis}
                      disabled={analysisLoading || !workspace}
                    >
                      {analysisLoading ? <LoaderCircle size={15} className="animate-spin" /> : <WandSparkles size={15} />}
                      <span>{t.createAnalysis}</span>
                    </button>
                  ) : (
                    <div className="station-banner notice">
                      <span>{t.aiNotConfigured}</span>
                    </div>
                  )}
                  {analysis && (
                    <div className="analysis-box">
                      <div className="analysis-header">
                        <WandSparkles size={16} />
                        <strong>Model: {analysis.model}</strong>
                      </div>
                      <pre className="analysis-text">{analysis.analysis}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SONAR TOOLS */}
          {activeTab === 'tools' && (
            <div className="tab-pane tools-pane">
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

          {/* TAB 6: HISTORY */}
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

        {/* Workspace Folder Picker Modal */}
        {pickerOpen && (
          <WorkspaceFolderPicker
            lang={lang}
            initialPath={workspace}
            onSelect={(folderPath) => {
              setWorkspace(folderPath);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}

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
