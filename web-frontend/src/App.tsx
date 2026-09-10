import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Menu, Terminal, Shield, ArrowRight } from 'lucide-react';

import Sidebar from './components/Sidebar';
import ServiceApps from './components/ServiceApps';
import DiagnosticConsole from './components/DiagnosticConsole';

import PageTransition from './components/PageTransition';
import SettingsCenter from './components/SettingsCenter';
import NexusSplash from './components/NexusSplash';
import AuthGate from './components/AuthGate';
import ActionCenter from './components/ActionCenter';
import AllToolsCatalog from './components/AllToolsCatalog';

import CareDashboard from './components/CareDashboard';
import SpeedUpSuite from './components/SpeedUpSuite';
import ProtectSuite from './components/ProtectSuite';
import ToolboxSuite from './components/ToolboxSuite';
import GoogleWorkspaceHub from './components/GoogleWorkspaceHub';
import OpenCodeZenHub from './components/OpenCodeZenHub';
import type { ViewMode } from './components/Sidebar';

import type { ActiveSection, ToolStatus, ConsoleEntry, ConsoleEntryType } from './types';
import { SECTION_MAP } from './types';
import type { BridgeAuthStatus, BridgeTool, BridgeRun, ExecutionMode, ToolRunOptions, ToolRunConfirmation } from './lib/api';
import { api, BridgeError } from './lib/api';
import type { Lang } from './lib/i18n';
import { CATEGORIES } from './data/categories';



let entryCounter = 0;

function toConsoleEntry(line: { t: string; s: 'out' | 'err'; text: string }, id: number): ConsoleEntry {
  const type: ConsoleEntryType = line.s === 'err' ? 'error' : 'info';
  return {
    id,
    text: line.text,
    type,
    timestamp: line.t ? new Date(line.t).toLocaleTimeString() : new Date().toLocaleTimeString(),
  };
}

function NexusApp() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('knoux-lang');
    return saved === 'ar' ? 'ar' : 'en';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('knoux-theme') === 'light' ? 'light' : 'dark');
  const [activeSection, setActiveSection] = useState<ActiveSection>('maintenance');
  const [activeView, setActiveView] = useState<ViewMode>('care');
  const [toolStatuses, setToolStatuses] = useState<Record<string, ToolStatus>>({});
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
    const [activeTool, setActiveTool] = useState<BridgeTool | null>(null);
  const [activeRequest, setActiveRequest] = useState<{ tool: BridgeTool; mode: ExecutionMode; options: ToolRunOptions; confirmation?: ToolRunConfirmation } | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'cancelled' | 'inconclusive'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [bridgeOfflineReason, setBridgeOfflineReason] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('bridgeError') || '';
    } catch {
      return '';
    }
  });
  const [bridgeToolCount, setBridgeToolCount] = useState<number | null>(null);
  const [bridgeElevated, setBridgeElevated] = useState(false);
  const [toolsByCategory, setToolsByCategory] = useState<Record<string, BridgeTool[]>>({});
  const [authStatus, setAuthStatus] = useState<BridgeAuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const currentRunId = useRef<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('knoux-lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('knoux-theme', theme);
  }, [theme]);

  useEffect(() => () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
  }, []);

  const connectBridge = useCallback(async () => {
    // Phase 00 lifecycle: health and registry resolve independently so a
    // half-ready bridge never reports "0 tools". Offline is UNAVAILABLE
    // with a reason, never a zero count.
    setBridgeOnline(null);
    setBridgeOfflineReason('');
    let health: Awaited<ReturnType<typeof api.health>> | null = null;
    let tools: BridgeTool[] = [];
    let healthError = '';
    let toolsError = '';
    try {
      health = await api.health();
    } catch (e) {
      healthError = e instanceof BridgeError ? `[${e.code}] ${e.message}` : String(e);
    }
    try {
      ({ tools } = await api.tools());
    } catch (e) {
      toolsError = e instanceof BridgeError ? `[${e.code}] ${e.message}` : String(e);
    }
    if (!health) {
      setBridgeOnline(false);
      setBridgeToolCount(null);
      setBridgeOfflineReason(healthError || 'Bridge health probe failed.');
      return;
    }
    const byCategory: Record<string, BridgeTool[]> = {};
    for (const t of tools) {
      (byCategory[t.Category] ||= []).push(t);
    }
    setToolsByCategory(byCategory);
    setBridgeToolCount(tools.length);
    setBridgeElevated(health.elevated);
    if (toolsError) {
      // Bridge is up but the registry did not load: stay degraded, not "0 tools".
      setBridgeOnline(false);
      setBridgeOfflineReason(toolsError);
      return;
    }
    const auth = await api.authStatus().catch(() => null);
    setAuthStatus(auth);
    setAuthError(auth ? '' : 'Local OAuth routes are not available until the bridge is restarted with this release.');
    setBridgeOnline(true);
    setBridgeOfflineReason('');
  }, []);

  useEffect(() => {
    connectBridge();
  }, [connectBridge]);

  useEffect(() => { setAuthLoading(bridgeOnline === null); }, [bridgeOnline]);
  const refreshAuth = useCallback(async () => { setAuthLoading(true); setAuthError(''); try { setAuthStatus(await api.authStatus()); } catch (e) { setAuthError(e instanceof Error ? e.message : String(e)); } finally { setAuthLoading(false); } }, []);
  const startSignIn = useCallback((provider: 'github' | 'entra') => { window.location.assign(api.authStartUrl(provider)); }, []);

  const finishRun = useCallback((run: BridgeRun) => {
    const status: ToolStatus =
      run.status === 'success' ? 'success'
      : run.status === 'inconclusive' ? 'inconclusive'
      : run.status === 'error' ? 'error' : 'cancelled';
    setToolStatuses(prev => ({ ...prev, [run.toolId]: status }));
    setConsoleStatus(run.status);
    currentRunId.current = null;
  }, []);

  const pollRun = useCallback((runId: string, tool: BridgeTool) => {
    let lastCount = 0;
    const tick = async () => {
      try {
        const { run } = await api.getRun(runId);
        const newLines = run.lines.slice(lastCount);
        if (newLines.length > 0) {
          lastCount = run.lines.length;
          setConsoleEntries(prev => [
            ...prev,
            ...newLines.map(l => toConsoleEntry(l, Date.now() + (entryCounter += 1))),
          ]);
        }
        if (run.status === 'running') {
          pollTimer.current = window.setTimeout(tick, 600);
        } else {
          finishRun(run);
        }
      } catch {
        setConsoleStatus('error');
        setToolStatuses(prev => ({ ...prev, [tool.ToolId]: 'error' }));
        currentRunId.current = null;
      }
    };
    tick();
  }, [finishRun]);

  const runTool = useCallback(async (tool: BridgeTool, mode: ExecutionMode = 'run', options: ToolRunOptions = {}, confirmation?: ToolRunConfirmation) => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setActiveTool(tool);
    setActiveRequest({ tool, mode, options, confirmation });
    setConsoleVisible(true);
    setConsoleEntries([]);
    setConsoleStatus('running');
    setToolStatuses(prev => ({ ...prev, [tool.ToolId]: 'running' }));
    try {
      const { runId } = await api.startRun(tool.ToolId, mode, options, confirmation);
      currentRunId.current = runId;
      pollRun(runId, tool);
    } catch (e) {
      const msg = e instanceof BridgeError ? e.message : String(e);
      setConsoleEntries([{
        id: Date.now() + (entryCounter += 1),
        text: `[ERR!] ${msg}`,
        type: 'error',
        timestamp: new Date().toLocaleTimeString(),
      }]);
      setConsoleStatus('error');
      setToolStatuses(prev => ({ ...prev, [tool.ToolId]: 'error' }));
    }
  }, [pollRun]);

  const cancelRun = useCallback(async () => {
    if (currentRunId.current) {
      try { await api.cancelRun(currentRunId.current); } catch { /* polling will settle */ }
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (activeRequest) runTool(activeRequest.tool, activeRequest.mode, activeRequest.options, activeRequest.confirmation);
  }, [activeRequest, runTool]);

  const allToolsList = useMemo(() => {
    return Object.values(toolsByCategory).flat();
  }, [toolsByCategory]);

  return (
    <div className="h-screen w-screen nexus-shell overflow-hidden relative" dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme}>
      <div className="relative z-10 h-full p-3 md:p-4 flex gap-3 md:gap-4">
        <Sidebar
          active={activeSection}
          onSelect={(section) => { setActiveSection(section); setActiveView('tools'); }}
          viewMode={activeView}
          onOpenCare={() => { setActiveView('care'); setSidebarOpen(false); }}
          onOpenSpeedUp={() => { setActiveView('speedup'); setSidebarOpen(false); }}
          onOpenProtect={() => { setActiveView('protect'); setSidebarOpen(false); }}
          onOpenToolbox={() => { setActiveView('toolbox'); setSidebarOpen(false); }}
          onOpenActionCenter={() => { setActiveView('action-center'); setSidebarOpen(false); }}
          onOpenWorkspaceHub={() => { setActiveView('workspace-hub'); setSidebarOpen(false); }}
          onOpenCodeZen={() => { setActiveView('code-zen'); setSidebarOpen(false); }}
          onOpenAllTools={() => { setActiveView('all-tools'); setSidebarOpen(false); }}
          toolsByCategory={toolsByCategory}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
          onOpenSettings={() => { setSettingsOpen(true); setSidebarOpen(false); }}
        />

        <main className="flex-1 nx-workspace rounded-[1.75rem] p-3 md:p-5 flex flex-col overflow-hidden">
          {/* ── Title Bar & Navigation Controls ── */}
          <header className="shrink-0 mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
                aria-label="Toggle menu"
              >
                <Menu size={18} />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display tracking-wide text-white">
                  KNOUX <span className="text-cyan-400 font-black">Repair</span>
                </span>
                <span className="text-slate-600 text-xs">/</span>
                <span className="text-xs font-medium text-slate-300">
                  {activeView === 'care'
                    ? (lang === 'ar' ? 'الرعاية الذكية' : 'Care Dashboard')
                    : activeView === 'speedup'
                    ? (lang === 'ar' ? 'تسريع الأداء' : 'Speed Up')
                    : activeView === 'protect'
                    ? (lang === 'ar' ? 'الحماية والأمان' : 'Protect Suite')
                    : activeView === 'toolbox'
                    ? (lang === 'ar' ? 'صندوق الأدوات' : 'Toolbox')
                    : activeView === 'action-center'
                    ? (lang === 'ar' ? 'مركز الإجراءات' : 'Action Center')
                    : activeView === 'workspace-hub'
                    ? (lang === 'ar' ? 'سحابة Google و Cloud SQL' : 'Google Workspace & Cloud Hub')
                    : activeView === 'code-zen'
                    ? (lang === 'ar' ? 'محرك كود زن (النماذج المجانية)' : 'Open Code Zen (Free AI)')
                    : activeView === 'all-tools'
                    ? (lang === 'ar' ? 'فهرس جميع الأدوات' : 'Master Tools Catalog')
                    : (CATEGORIES.find(c => c.section === activeSection)?.name[lang] ?? activeSection)}
                </span>
              </div>
            </div>

            {/* Top Glass Navigation Tabs */}
            <div className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-slate-950/70 border border-white/[0.08] shadow-inner">
              <button
                type="button"
                onClick={() => setActiveView('care')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'care'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'الرعاية الذكية' : 'Care'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('speedup')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'speedup'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'تسريع الأداء' : 'Speed Up'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('protect')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'protect'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'الحماية' : 'Protect'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('toolbox')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'toolbox'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'صندوق الأدوات' : 'Toolbox'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('action-center')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'action-center'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'مركز التقارير' : 'Action Center'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('workspace-hub')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'workspace-hub'
                    ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'سحابة Google' : 'Google Cloud'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('code-zen')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'code-zen'
                    ? 'bg-gradient-to-r from-indigo-600/40 to-cyan-600/40 text-indigo-200 border border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'كود زن (AI)' : 'Code Zen (AI)'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Elevation Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  bridgeElevated
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-white/[0.06]'
                }`}
              >
                <Shield size={12} />
                <span className="hidden sm:inline">
                  {bridgeElevated
                    ? (lang === 'ar' ? 'مسؤول (صلاحيات كاملة)' : 'Administrator (Elevated)')
                    : (lang === 'ar' ? 'مستخدم قياسي' : 'Standard User')}
                </span>
              </div>

              {/* Diagnostic Console Button */}
              <button
                type="button"
                onClick={() => setConsoleVisible(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/[0.06] transition-colors"
                title={lang === 'ar' ? 'طرفية التشخيص' : 'Diagnostic Terminal Console'}
              >
                <Terminal size={12} />
                <span className="hidden sm:inline">{lang === 'ar' ? 'طرفية التشخيص' : 'Terminal'}</span>
                {consoleEntries.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeView === 'care' ? (
              <PageTransition key="care">
                <CareDashboard
                  lang={lang}
                  toolsByCategory={toolsByCategory}
                  onOpenSection={(section) => {
                    setActiveSection(section);
                    setActiveView('tools');
                  }}
                  onOpenView={(view) => setActiveView(view)}
                  bridgeElevated={bridgeElevated}
                  bridgeOnline={bridgeOnline}
                  registryTotal={bridgeToolCount}
                />
              </PageTransition>
            ) : activeView === 'speedup' ? (
              <PageTransition key="speedup">
                <SpeedUpSuite
                  lang={lang}
                  toolsByCategory={toolsByCategory}
                  onOpenSection={(section) => {
                    setActiveSection(section);
                    setActiveView('tools');
                  }}
                  onOpenView={(view) => setActiveView(view)}
                  bridgeElevated={bridgeElevated}
                  bridgeOnline={bridgeOnline}
                />
              </PageTransition>
            ) : activeView === 'protect' ? (
              <PageTransition key="protect">
                <ProtectSuite
                  lang={lang}
                  toolsByCategory={toolsByCategory}
                  onOpenSection={(section) => {
                    setActiveSection(section);
                    setActiveView('tools');
                  }}
                  onOpenView={(view) => setActiveView(view)}
                  bridgeElevated={bridgeElevated}
                  bridgeOnline={bridgeOnline}
                />
              </PageTransition>
            ) : activeView === 'toolbox' ? (
              <PageTransition key="toolbox">
                <ToolboxSuite
                  lang={lang}
                  toolsByCategory={toolsByCategory}
                  onOpenSection={(section) => {
                    setActiveSection(section);
                    setActiveView('tools');
                  }}
                  bridgeElevated={bridgeElevated}
                  bridgeOnline={bridgeOnline}
                />
              </PageTransition>
            ) : activeView === 'action-center' ? (
              <PageTransition key="action-center">
                <ActionCenter
                  lang={lang}
                  toolsByCategory={toolsByCategory}
                  onOpenSection={(section) => {
                    setActiveSection(section);
                    setActiveView('tools');
                  }}
                  onOpenAllTools={() => setActiveView('all-tools')}
                  bridgeElevated={bridgeElevated}
                  bridgeOnline={bridgeOnline}
                  onOpenNavigation={() => setSidebarOpen(true)}
                />
              </PageTransition>
            ) : activeView === 'workspace-hub' ? (
              <PageTransition key="workspace-hub">
                <GoogleWorkspaceHub
                  lang={lang}
                  bridgeElevated={bridgeElevated}
                />
              </PageTransition>
            ) : activeView === 'code-zen' ? (
              <PageTransition key="code-zen">
                <OpenCodeZenHub
                  lang={lang}
                  bridgeElevated={bridgeElevated}
                  onSendToTerminal={(code) => {
                    setConsoleEntries(prev => [
                      ...prev,
                      {
                        id: Date.now() + (entryCounter += 1),
                        text: `[Open Code Zen Injection]\n${code}`,
                        type: 'info',
                        timestamp: new Date().toLocaleTimeString(),
                      },
                    ]);
                    setConsoleVisible(true);
                  }}
                />
              </PageTransition>
            ) : activeView === 'all-tools' ? (
              <PageTransition key="all-tools">
                <AllToolsCatalog
                  tools={allToolsList}
                  toolStatuses={toolStatuses}
                  lang={lang}
                  bridgeElevated={bridgeElevated}
                  bridgeOnline={bridgeOnline}
                  onRetryBridge={() => { void connectBridge(); }}
                  onRunTool={runTool}
                  onCancelTool={cancelRun}
                  onOpenSection={(section) => {
                    setActiveSection(section);
                    setActiveView('tools');
                  }}
                />
              </PageTransition>
            ) : (
              <PageTransition key={`tools-${activeSection}`}>
                <div className="flex flex-col h-full space-y-3">
                  {/* Fluid Return Header Ribbon */}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveView('care')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-xs font-bold text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                    >
                      <ArrowRight size={14} className="rotate-180 rtl:rotate-0" />
                      <span>{lang === 'ar' ? 'العودة إلى لوحة القيادة الذكية' : 'Back to Master Care Dashboard'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        {bridgeOnline === true
                          ? `${toolsByCategory[SECTION_MAP[activeSection]]?.length || 0} ${lang === 'ar' ? 'أداة متاحة' : 'tools ready'}`
                          : bridgeOnline === false
                            ? (lang === 'ar' ? 'غير متاح — الجسر مفصول' : 'UNAVAILABLE — bridge offline')
                            : (lang === 'ar' ? 'جارٍ الاتصال...' : 'CONNECTING...')}
                      </span>
                      {bridgeOnline === false && (
                        <button
                          type="button"
                          onClick={() => { void connectBridge(); }}
                          title={bridgeOfflineReason}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                        >
                          {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveView('toolbox')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 hover:text-white border border-white/[0.06] transition-colors"
                      >
                        {lang === 'ar' ? 'صندوق الأدوات' : 'Toolbox'}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <ServiceApps
                      activeSection={activeSection}
                      toolStatuses={toolStatuses}
                      tools={toolsByCategory[SECTION_MAP[activeSection]] || []}
                      lang={lang}
                      bridgeElevated={bridgeElevated}
                      bridgeOnline={bridgeOnline}
                      onRetryBridge={() => { void connectBridge(); }}
                      onToolStatus={(toolId, status) => setToolStatuses((previous) => ({ ...previous, [toolId]: status }))}
                      onRunTool={runTool}
                      onCancelTool={cancelRun}
                    />
                  </div>
                </div>
              </PageTransition>
            )}
          </AnimatePresence>
        </main>
      </div>

      <SettingsCenter
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        bridgeOnline={bridgeOnline}
        bridgeElevated={bridgeElevated}
        toolCount={bridgeToolCount ?? Object.values(toolsByCategory).reduce((total, items) => total + items.length, 0)}
        onReplaySplash={() => { setSettingsOpen(false); setSplashVisible(true); }}
        auth={authStatus}
        onSignIn={startSignIn}
        onLogout={() => { void api.logout().finally(() => { void refreshAuth(); }); }}
      />

      <DiagnosticConsole
        visible={consoleVisible}
        onClose={() => setConsoleVisible(false)}
        activeTool={activeTool}
        entries={consoleEntries}
        status={consoleStatus}
        onRetry={handleRetry}
        onCancel={cancelRun}
        lang={lang}
      />
      {authStatus?.required && !authStatus.authenticated && (
        <AuthGate lang={lang} status={authStatus} loading={authLoading} error={authError} onRetry={refreshAuth} onSignIn={startSignIn} />
      )}
      <NexusSplash
        visible={splashVisible}
        onDone={() => setSplashVisible(false)}
        lang={lang}
        bridgeOnline={bridgeOnline}
        toolCount={bridgeToolCount ?? Object.values(toolsByCategory).reduce((total, items) => total + items.length, 0)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<NexusApp />} />
      </Routes>
    </BrowserRouter>
  );
}
