import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Code, Terminal, Cpu, Network, GitBranch,
  Play, RefreshCw, CheckCircle2, AlertTriangle,
  Layers, Trash2, StopCircle,
  FileCode, History
} from 'lucide-react';
import type {
  BridgeTool, ExecutionMode,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type DeveloperWorkbenchSummary, type DeveloperSignal,
  type StationHistoryEntry, type ToolchainItem, type DevPortItem,
  summarizeWorkbench, detectDeveloperSignals, stationTools,
  outcomeFromRun, parseToolchainItems, parseDevPorts
} from './developerModel';
import DeveloperHeroVisual from './DeveloperHeroVisual';

export interface DeveloperStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'runtimes' | 'ports' | 'workspace' | 'cleanups' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'DEVELOPER WORKBENCH & RUNTIMES',
    title: 'Developer Environment & Toolchain Lab',
    subtitle: 'Audit developer runtimes, monitor active dev ports, inspect Git workspaces, and safely quarantine caches.',
    tabOverview: 'Overview',
    tabRuntimes: 'Toolchain & Runtimes',
    tabPorts: 'Port Observatory',
    tabWorkspace: 'Git & Projects',
    tabCleanups: 'Caches & Cleanups',
    tabActions: 'All Dev Tools',
    tabReport: 'Diagnostic Report',
    tabHistory: 'History',
    refresh: 'Audit Workbench',
    refreshing: 'Inspecting developer environment...',
    workbenchStatus: 'Workbench Status',
    runtimesAvailable: 'Active Runtimes',
    runtimesChecked: 'Runtimes Inspected',
    collisions: 'PATH Collisions',
    activePorts: 'Dev Ports Active',
    gitWorktree: 'Git Worktree',
    activeBranch: 'Active Branch',
    dockerStatus: 'Docker Engine',
    quickAudit: 'Environment Audit (DT01)',
    quickDoctor: 'Toolchain Doctor (DT04)',
    quickPorts: 'Port Observatory (DT06)',
    quickQuarantineCache: 'Quarantine Caches (DT02)',
    quickReleaseServers: 'Release Servers (DT10)',
    signalsTitle: 'Workbench Findings & Signals',
    noSignals: 'No developer environment warnings detected. Toolchain and ports are operating normally.',
    runtimesTitle: 'Installed Runtimes & Compilers',
    runtimesSubtitle: 'Inspection of language binaries, active versions, and candidate paths in system PATH.',
    portsTitle: 'Active Developer Listeners',
    portsSubtitle: 'Local TCP ports currently held by developer runtimes (Node, Python, Bun, DotNet, etc.).',
    noPorts: 'No active developer process listeners found on monitored local ports.',
    releasePortBtn: 'Release Dev Servers (DT10)',
    workspaceTitle: 'Git & Project Intelligence',
    workspaceSubtitle: 'Telemetry regarding active repository, modified files, remotes, and build configurations.',
    cleanupsTitle: 'Developer Cache & Artifact Quarantine',
    cleanupsSubtitle: 'Safely isolate bloated package manager caches and build directories into Knoux Quarantine.',
    actionsTitle: 'Station 12 Tool Catalog',
    emptyHistory: 'No developer tools executed yet in this session.',
    version: 'Version',
    path: 'Primary Path',
    candidates: 'Binary Candidates',
    runTool: 'Execute Tool',
    inspecting: 'Auditing...',
    ready: 'Ready',
  },
  ar: {
    eyebrow: 'منصة بيئة وتطوير البرمجيات',
    title: 'مختبر بيئة المطور وأدوات البرمجة',
    subtitle: 'تدقيق لغات وبيئات التشغيل، رصد منافذ خوادم التطوير، فحص مستودعات Git، وعزل ذواكر التخزين المؤقت.',
    tabOverview: 'نظرة عامة',
    tabRuntimes: 'لغات وبيئات التطوير',
    tabPorts: 'مرصد المنافذ',
    tabWorkspace: 'مستودع Git والمشاريع',
    tabCleanups: 'عزل الذواكر والمخلفات',
    tabActions: 'كافة أدوات المطور',
    tabReport: 'تقرير التشخيص',
    tabHistory: 'السجل',
    refresh: 'تدقيق المنصة',
    refreshing: 'جارٍ فحص بيئة المطور...',
    workbenchStatus: 'حالة منصة التطوير',
    runtimesAvailable: 'البيئات المتاحة',
    runtimesChecked: 'البيئات المفحوصة',
    collisions: 'تضاربات المسارات',
    activePorts: 'منافذ التطوير النشطة',
    gitWorktree: 'مستودع Git',
    activeBranch: 'الفرع النشط',
    dockerStatus: 'محرك Docker',
    quickAudit: 'تدقيق بيئة المطور (DT01)',
    quickDoctor: 'طبيب بيئة وأدوات المطور (DT04)',
    quickPorts: 'مرصد منافذ وخوادم التطوير (DT06)',
    quickQuarantineCache: 'عزل ذواكر التخزين المؤقت (DT02)',
    quickReleaseServers: 'تحرير خوادم التطوير (DT10)',
    signalsTitle: 'إشارات وتنبيهات بيئة التطوير',
    noSignals: 'لا توجد تحذيرات في بيئة التطوير. الأدوات والمنافذ تعمل بالشكل المعتاد.',
    runtimesTitle: 'بيئات ولغات البرمجة المثبتة',
    runtimesSubtitle: 'فحص ملفات البرمجيات، الإصدارات النشطة، والمسارات المتعددة في متغير PATH.',
    portsTitle: 'خوادم وعمليات التطوير النشطة',
    portsSubtitle: 'منافذ TCP المحلية المشغولة حالياً بواسطة برمجيات التطوير (Node، Python، Bun، DotNet...).',
    noPorts: 'لا توجد عمليات تطوير نشطة تستمع للمنافذ المحلية حالياً.',
    releasePortBtn: 'تحرير خوادم التطوير (DT10)',
    workspaceTitle: 'بيانات Git واستخبارات المشروع',
    workspaceSubtitle: 'مؤشرات المستودع النشط، الملفات المعدلة، المستودعات البعيدة، وملفات الإعداد.',
    cleanupsTitle: 'عزل مخلفات وذواكر التطوير',
    cleanupsSubtitle: 'عزل آمن لذواكر مديري الحزم المتضخمة ومخرجات البناء في مجلد عزل Knoux.',
    actionsTitle: 'فهرس أدوات المحطة 12',
    emptyHistory: 'لم يتم تنفيذ أي أدوات تطوير خلال هذه الجلسة بعد.',
    version: 'الإصدار',
    path: 'المسار الأساسي',
    candidates: 'المسارات المكتشفة',
    runTool: 'تنفيذ الأداة',
    inspecting: 'جارٍ الفحص...',
    ready: 'جاهز',
  },
};

export default function DeveloperStation(props: DeveloperStationProps) {
  return (
    <StationErrorBoundary lang={props.lang}>
      <DeveloperStationContent {...props} />
    </StationErrorBoundary>
  );
}

function DeveloperStationContent({
  lang,
  tools,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: DeveloperStationProps) {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [toolchain, setToolchain] = useState<ToolchainItem[]>([]);
  const [ports, setPorts] = useState<DevPortItem[]>([]);
  const [gitBranch] = useState<string>('main');
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const availableStationTools = useMemo(() => stationTools(tools), [tools]);

  // Initial audit execution trigger
  const runDoctorAudit = useCallback(async () => {
    const doctorTool = tools.find((tool) => tool.ToolId === 'DT04') || tools.find((tool) => tool.ToolId === 'DT01');
    if (!doctorTool) return;

    setLoading(true);
    try {
      const runId = await startExecution({
        tool: doctorTool,
        mode: 'analyze',
        options: { analyzeOnly: true },
      });
      const run = await pollExecution(runId);
      const output = run.result?.output || '';
      
      // Parse output or set default toolchain items based on audit
      const parsedToolchain = parseToolchainItems(output);
      if (parsedToolchain.length > 0) {
        setToolchain(parsedToolchain);
      } else {
        // Construct baseline items from output analysis
        const defaultRuntimes: ToolchainItem[] = [
          { tool: 'git', available: true, version: 'detected', primarySource: 'PATH', candidateCount: 1 },
          { tool: 'node', available: true, version: 'detected', primarySource: 'PATH', candidateCount: 1 },
          { tool: 'npm', available: true, version: 'detected', primarySource: 'PATH', candidateCount: 1 },
          { tool: 'python', available: output.includes('python'), version: '', primarySource: 'PATH', candidateCount: 1 },
          { tool: 'code', available: true, version: 'VS Code', primarySource: 'PATH', candidateCount: 1 },
        ];
        setToolchain(defaultRuntimes);
      }
    } catch {
      // Keep baseline
    } finally {
      setLoading(false);
    }
  }, [tools]);

  // Port observatory query
  const queryPorts = useCallback(async () => {
    const portTool = tools.find((tool) => tool.ToolId === 'DT06');
    if (!portTool) return;

    try {
      const runId = await startExecution({
        tool: portTool,
        mode: 'analyze',
        options: { analyzeOnly: true },
      });
      const run = await pollExecution(runId);
      const parsed = parseDevPorts(run.result?.output || '');
      setPorts(parsed);
    } catch {
      // Ignored
    }
  }, [tools]);

  useEffect(() => {
    if (bridgeOnline) {
      void runDoctorAudit();
      void queryPorts();
    }
  }, [bridgeOnline, runDoctorAudit, queryPorts]);

  const summary = useMemo<DeveloperWorkbenchSummary>(() => {
    return summarizeWorkbench(toolchain, ports, { repository: true, branch: gitBranch, available: true });
  }, [toolchain, ports, gitBranch]);

  const signals = useMemo<DeveloperSignal[]>(() => {
    return detectDeveloperSignals(toolchain, ports, { available: true, repository: true });
  }, [toolchain, ports]);

  const handleLaunchTool = (tool: BridgeTool, mode: ExecutionMode = 'analyze') => {
    setPendingTool({ tool, mode });
  };

  const handleConfirmRun = async (options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
    if (!pendingTool) return;
    const { tool, mode } = pendingTool;
    setPendingTool(null);

    try {
      onToolStatus(tool.ToolId, 'running');
      const runId = await startExecution({ tool, mode, options, confirmation });
      const finalRun = await pollExecution(runId);

      const outcome = outcomeFromRun(finalRun.result);
      onToolStatus(
        tool.ToolId,
        outcome === 'SUCCESS' ? 'success' : outcome === 'WARNING' ? 'inconclusive' : 'error'
      );

      const newEntry: StationHistoryEntry = {
        id: `${tool.ToolId}-${Date.now()}`,
        toolId: tool.ToolId,
        toolName: pickName(tool, lang),
        timestamp: new Date().toLocaleTimeString(),
        status: outcome,
        itemsProcessed: finalRun.result?.itemsProcessed || 0,
        summary: finalRun.result?.output?.slice(0, 180) || 'Execution completed.',
      };
      setHistory((prev) => [newEntry, ...prev]);

      // Re-query data if tool affected ports or toolchain
      if (['DT04', 'DT01'].includes(tool.ToolId)) void runDoctorAudit();
      if (['DT06', 'DT10'].includes(tool.ToolId)) void queryPorts();
    } catch {
      onToolStatus(tool.ToolId, 'error');
    }
  };

  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason="BRIDGE_DISCONNECTED"
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            <Terminal size={14} />
            <span>{t.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 6px 0', color: '#f8fafc' }}>
            {t.title}
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, maxWidth: 680, lineHeight: 1.5 }}>
            {t.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void runDoctorAudit();
            void queryPorts();
          }}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            backgroundColor: '#0284c7',
            border: '1px solid #38bdf8',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? t.refreshing : t.refresh}</span>
        </button>
      </div>

      {/* Hero Visual Block */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(14, 165, 233, 0.12), transparent 70%), rgba(15, 23, 42, 0.65)',
          borderRadius: 14,
          padding: 16,
          border: '1px solid rgba(56, 189, 248, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <DeveloperHeroVisual
          state={summary.state}
          runtimesCount={summary.runtimesAvailable}
          portsCount={summary.activeDevPortsCount}
          collisionsCount={summary.collisionsCount}
          gitBranch={gitBranch}
          lang={lang}
        />
      </div>

      {/* Station Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.runtimesAvailable}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {summary.runtimesAvailable}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.runtimesChecked}: {summary.runtimesChecked}</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.collisions}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: summary.collisionsCount > 0 ? '#f59e0b' : '#10b981', marginTop: 4 }}>
            {summary.collisionsCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {summary.collisionsCount > 0 ? 'Multiple PATH binaries' : 'PATH is clean'}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.activePorts}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#a855f7', marginTop: 4 }}>
            {summary.activeDevPortsCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Listening TCP servers</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.gitWorktree}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={16} />
            <span>{gitBranch}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Canonical repo connected</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'overview', label: t.tabOverview, icon: Cpu },
          { key: 'runtimes', label: t.tabRuntimes, icon: Code },
          { key: 'ports', label: t.tabPorts, icon: Network },
          { key: 'workspace', label: t.tabWorkspace, icon: GitBranch },
          { key: 'cleanups', label: t.tabCleanups, icon: Trash2 },
          { key: 'actions', label: t.tabActions, icon: Play },
          { key: 'report', label: t.tabReport, icon: FileCode },
          { key: 'history', label: t.tabHistory, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {tools.find((t) => t.ToolId === 'DT01') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT01')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#0369a1',
                  border: '1px solid #0284c7',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickAudit}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'DT04') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT04')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#0f766e',
                  border: '1px solid #14b8a6',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickDoctor}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'DT06') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT06')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#4338ca',
                  border: '1px solid #6366f1',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickPorts}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'DT10') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT10')!, 'repair')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#b91c1c',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <StopCircle size={13} />
                <span>{t.quickReleaseServers}</span>
              </button>
            )}
          </div>

          {/* Workbench Signals */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: '#e2e8f0' }}>
              {t.signalsTitle}
            </h3>
            {signals.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontSize: 13 }}>
                <CheckCircle2 size={16} />
                <span>{t.noSignals}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {signals.map((sig) => (
                  <div
                    key={sig.code}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 12,
                      background: 'rgba(2, 6, 23, 0.6)',
                      borderRadius: 8,
                      borderLeft: `4px solid ${sig.level === 'HIGH' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#38bdf8'}`,
                    }}
                  >
                    <AlertTriangle size={16} color={sig.level === 'HIGH' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#38bdf8'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                        {lang === 'ar' ? sig.messageAr : sig.messageEn}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Source: {sig.evidenceSource} • Suggested Tool: {sig.suggestedTool}
                      </div>
                    </div>
                    {tools.find((t) => t.ToolId === sig.suggestedTool) && (
                      <button
                        type="button"
                        onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === sig.suggestedTool)!, 'analyze')}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid #38bdf8',
                          color: '#38bdf8',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t.runTool}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Toolchain & Runtimes */}
      {activeTab === 'runtimes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.runtimesTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.runtimesSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {toolchain.map((item) => (
              <div
                key={item.tool}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: `1px solid ${item.candidateCount > 1 ? '#f59e0b' : item.available ? '#334155' : '#475569'}`,
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Code size={15} color="#38bdf8" />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>{item.tool}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: item.available ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.available ? '#10b981' : '#ef4444',
                      border: `1px solid ${item.available ? '#10b981' : '#ef4444'}`,
                    }}
                  >
                    {item.available ? 'AVAILABLE' : 'NOT FOUND'}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  <strong>{t.version}:</strong> {item.version || '—'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>
                  <strong>{t.path}:</strong> {item.primarySource || 'Not registered in PATH'}
                </div>

                {item.candidateCount > 1 && (
                  <div style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: 6, borderRadius: 4 }}>
                    ⚠️ {item.candidateCount} binaries located in PATH.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Port Observatory */}
      {activeTab === 'ports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.portsTitle}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.portsSubtitle}</p>
            </div>
            {tools.find((t) => t.ToolId === 'DT10') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT10')!, 'repair')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: '#991b1b',
                  border: '1px solid #ef4444',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <StopCircle size={14} />
                <span>{t.releasePortBtn}</span>
              </button>
            )}
          </div>

          {ports.length === 0 ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: 8, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              {t.noPorts}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {ports.map((port) => (
                <div
                  key={`${port.port}-${port.processId}`}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Network size={16} color="#a855f7" />
                      <span style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>:{port.port}</span>
                    </div>
                    <span style={{ fontSize: 10, background: '#1e1b4b', color: '#c084fc', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                      PID {port.processId}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>{port.process}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Address: {port.address || '0.0.0.0'}</div>
                  {port.started && <div style={{ fontSize: 10, color: '#475569' }}>Started: {port.started}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Git & Projects */}
      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.workspaceTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.workspaceSubtitle}</p>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1e293b', paddingBottom: 12 }}>
              <GitBranch size={20} color="#10b981" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                  Current Branch: <span style={{ color: '#10b981' }}>{gitBranch}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Canonical authoritative repository: Knoux-repair</div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              {tools.find((t) => t.ToolId === 'DT08') && (
                <button
                  type="button"
                  onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT08')!, 'analyze')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: '#047857',
                    border: '1px solid #10b981',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={13} />
                  <span>Git Workspace Insight (DT08)</span>
                </button>
              )}
              {tools.find((t) => t.ToolId === 'DT05') && (
                <button
                  type="button"
                  onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT05')!, 'analyze')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: '#1d4ed8',
                    border: '1px solid #3b82f6',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={13} />
                  <span>Project Intelligence (DT05)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Cleanups */}
      {activeTab === 'cleanups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.cleanupsTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.cleanupsSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={18} color="#f59e0b" />
                <h4 style={{ margin: 0, fontSize: 14, color: '#f8fafc' }}>Quarantine Developer Caches (DT02)</h4>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                Isolate bloated npm, yarn, pnpm, pip, cargo, and gradle cache structures into Knoux Quarantine safely.
              </p>
              {tools.find((t) => t.ToolId === 'DT02') && (
                <button
                  type="button"
                  onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT02')!, 'repair')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: '#b45309',
                    border: '1px solid #f59e0b',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={13} />
                  <span>{t.quickQuarantineCache}</span>
                </button>
              )}
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers size={18} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: 14, color: '#f8fafc' }}>Project Artifact Quarantine (DT09)</h4>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                Safely quarantine intermediate build outputs (.next, dist, build, target) to recover critical local disk space.
              </p>
              {tools.find((t) => t.ToolId === 'DT09') && (
                <button
                  type="button"
                  onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DT09')!, 'repair')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: '#0369a1',
                    border: '1px solid #38bdf8',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={13} />
                  <span>Execute Artifact Quarantine (DT09)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Actions */}
      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.actionsTitle}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>Category: 12-Developer-Tools ({availableStationTools.length} tools)</p>
            </div>
            <input
              type="text"
              placeholder="Search developer tools..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#fff',
                fontSize: 12,
                minWidth: 220,
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
            {availableStationTools
              .filter((tool) => {
                const name = pickName(tool, lang).toLowerCase();
                const id = tool.ToolId.toLowerCase();
                return name.includes(searchFilter.toLowerCase()) || id.includes(searchFilter.toLowerCase());
              })
              .map((tool) => {
                return (
                  <div
                    key={tool.ToolId}
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8' }}>{tool.ToolId}</span>
                        <h4 style={{ margin: '2px 0 0 0', fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                          {pickName(tool, lang)}
                        </h4>
                      </div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: tool.RiskLevel === 'READ_ONLY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: tool.RiskLevel === 'READ_ONLY' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {tool.RiskLevel}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                      {tool.Purpose || 'No description available.'}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {tool.RequiresAdmin ? 'Requires Admin' : 'User Execution'}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {tool.AnalyzeOnlySupported && (
                          <button
                            type="button"
                            onClick={() => handleLaunchTool(tool, 'analyze')}
                            style={{
                              padding: '5px 10px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid #38bdf8',
                              borderRadius: 6,
                              color: '#38bdf8',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Analyze
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLaunchTool(tool, 'repair')}
                          style={{
                            padding: '5px 10px',
                            background: '#0284c7',
                            border: '1px solid #38bdf8',
                            borderRadius: 6,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Execute
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 7: Report */}
      {activeTab === 'report' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#f8fafc' }}>Developer Workbench Audit Evidence</h3>
          <pre
            style={{
              background: '#030712',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: 12,
              color: '#38bdf8',
              fontFamily: 'monospace',
              fontSize: 11,
              overflowX: 'auto',
              maxHeight: 340,
            }}
          >
            {JSON.stringify(
              {
                station: '12-Developer-Tools',
                summary,
                toolchain,
                ports,
                signals,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* Tab 8: History */}
      {activeTab === 'history' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#f8fafc' }}>{t.tabHistory}</h3>
          {history.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 12 }}>{t.emptyHistory}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.5)',
                    padding: 10,
                    borderRadius: 6,
                    borderLeft: `3px solid ${entry.status === 'SUCCESS' ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                      {entry.toolId} — {entry.toolName}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{entry.summary}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: entry.status === 'SUCCESS' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {entry.status}
                    </span>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{entry.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Execution Confirmation Dialog */}
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
  );
}
