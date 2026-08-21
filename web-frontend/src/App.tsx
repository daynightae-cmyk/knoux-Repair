import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';

import Sidebar from './components/Sidebar';
import ServicePlatform from './components/ServicePlatform';
import DiagnosticConsole from './components/DiagnosticConsole';

import PageTransition from './components/PageTransition';
import SettingsCenter from './components/SettingsCenter';
import NexusSplash from './components/NexusSplash';
import AuthGate from './components/AuthGate';
import WorkspaceDashboard from './components/WorkspaceDashboard';

import type { ActiveSection, ToolStatus, ConsoleEntry, ConsoleEntryType } from './types';
import { SECTION_MAP } from './types';
import type { BridgeAuthStatus, BridgeTool, BridgeRun, ExecutionMode, ToolRunOptions } from './lib/api';
import { api, BridgeError } from './lib/api';
import type { Lang } from './lib/i18n';



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
  const [activeView, setActiveView] = useState<'workspaces' | 'tools'>('workspaces');
  const [toolStatuses, setToolStatuses] = useState<Record<string, ToolStatus>>({});
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
    const [activeTool, setActiveTool] = useState<BridgeTool | null>(null);
  const [activeRequest, setActiveRequest] = useState<{ tool: BridgeTool; mode: ExecutionMode; options: ToolRunOptions } | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'cancelled'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
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
    setBridgeOnline(null);
    try {
      const [health, toolResponse] = await Promise.all([api.health(), api.tools()]);
      const auth = await api.authStatus().catch(() => null);
      const { tools } = toolResponse;
      const byCategory: Record<string, BridgeTool[]> = {};
      for (const t of tools) {
        (byCategory[t.Category] ||= []).push(t);
      }
      setToolsByCategory(byCategory);
      setBridgeElevated(health.elevated);
      setAuthStatus(auth);
      setAuthError(auth ? '' : 'Local OAuth routes are not available until the bridge is restarted with this release.');
      setBridgeOnline(true);
    } catch (e) {
      setBridgeOnline(false);
    }
  }, []);

  useEffect(() => {
    connectBridge();
  }, [connectBridge]);

  useEffect(() => { setAuthLoading(bridgeOnline === null); }, [bridgeOnline]);
  const refreshAuth = useCallback(async () => { setAuthLoading(true); setAuthError(''); try { setAuthStatus(await api.authStatus()); } catch (e) { setAuthError(e instanceof Error ? e.message : String(e)); } finally { setAuthLoading(false); } }, []);
  const startSignIn = useCallback((provider: 'github' | 'entra') => { window.location.assign(api.authStartUrl(provider)); }, []);

  const finishRun = useCallback((run: BridgeRun) => {
    const status: ToolStatus = run.status === 'success' ? 'success' : run.status === 'error' ? 'error' : 'cancelled';
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

  const runTool = useCallback(async (tool: BridgeTool, mode: ExecutionMode = 'run', options: ToolRunOptions = {}) => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setActiveTool(tool);
    setActiveRequest({ tool, mode, options });
    setConsoleVisible(true);
    setConsoleEntries([]);
    setConsoleStatus('running');
    setToolStatuses(prev => ({ ...prev, [tool.ToolId]: 'running' }));
    try {
      const { runId } = await api.startRun(tool.ToolId, mode, options);
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
    if (activeRequest) runTool(activeRequest.tool, activeRequest.mode, activeRequest.options);
  }, [activeRequest, runTool]);

  return (
    <div className="h-screen w-screen nexus-shell overflow-hidden relative" dir={lang === 'ar' ? 'rtl' : 'ltr'} data-theme={theme}>
      <div className="relative z-10 h-full p-3 md:p-4 flex gap-3 md:gap-4">
        <Sidebar
          active={activeSection}
          onSelect={(section) => { setActiveSection(section); setActiveView('tools'); }}
          viewMode={activeView}
          onOpenWorkspaces={() => { setActiveView('workspaces'); setSidebarOpen(false); }}
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

        <main className="flex-1 nx-workspace rounded-[1.75rem] p-4 md:p-6 flex flex-col overflow-hidden">

          <AnimatePresence mode="wait">
              {activeView === 'workspaces' ? (
                <PageTransition key="workspaces">
                  <WorkspaceDashboard
                    lang={lang}
                    toolsByCategory={toolsByCategory}
                    onOpenNavigation={() => setSidebarOpen(true)}
                    onOpenSection={(section) => { setActiveSection(section); setActiveView('tools'); }}
                  />
                </PageTransition>
              ) : (
                <PageTransition key={`tools-${activeSection}`}>
                  <ServicePlatform
                    activeSection={activeSection}
                    toolStatuses={toolStatuses}
                    tools={toolsByCategory[SECTION_MAP[activeSection]] || []}
                    lang={lang}
                    bridgeElevated={bridgeElevated}
                    onRunTool={runTool}
                    onCancelTool={cancelRun}
                  />
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
        toolCount={Object.values(toolsByCategory).reduce((total, items) => total + items.length, 0)}
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
        toolCount={Object.values(toolsByCategory).reduce((total, items) => total + items.length, 0)}
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
