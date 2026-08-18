import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import SplashScreen from './components/SplashScreen';
import Sidebar from './components/Sidebar';
import ToolGrid from './components/ToolGrid';
import DiagnosticConsole from './components/DiagnosticConsole';
import PlaceholderPage from './components/PlaceholderPage';
import PageTransition from './components/PageTransition';
import BridgeOffline from './components/BridgeOffline';
import Dashboard from './components/Dashboard';
import type { ActiveSection, ToolStatus, ConsoleEntry, ConsoleEntryType } from './types';
import { SECTION_MAP } from './types';
import type { BridgeTool, BridgeRun } from './lib/api';
import { api, BridgeError } from './lib/api';
import type { Lang } from './lib/i18n';

const TOOL_SECTIONS = new Set([
  'maintenance', 'cleanup', 'network', 'programs', 'duplicates',
  'disk', 'services', 'performance', 'security', 'diagnostics',
]);

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
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [toolStatuses, setToolStatuses] = useState<Record<string, ToolStatus>>({});
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [activeTool, setActiveTool] = useState<BridgeTool | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'cancelled'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [bridgeElevated, setBridgeElevated] = useState(false);
  const [toolsByCategory, setToolsByCategory] = useState<Record<string, BridgeTool[]>>({});
  const [bridgeError, setBridgeError] = useState('');

  const currentRunId = useRef<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('knoux-lang', lang);
  }, [lang]);

  useEffect(() => () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
  }, []);

  const connectBridge = useCallback(async () => {
    setBridgeOnline(null);
    setBridgeError('');
    try {
      const health = await api.health();
      const { tools } = await api.tools();
      const byCategory: Record<string, BridgeTool[]> = {};
      for (const t of tools) {
        (byCategory[t.Category] ||= []).push(t);
      }
      setToolsByCategory(byCategory);
      setBridgeElevated(health.elevated);
      setBridgeOnline(true);
    } catch (e) {
      setBridgeError(e instanceof BridgeError ? e.message : String(e));
      setBridgeOnline(false);
    }
  }, []);

  useEffect(() => {
    connectBridge();
  }, [connectBridge]);

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

  const runTool = useCallback(async (tool: BridgeTool) => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setActiveTool(tool);
    setConsoleVisible(true);
    setConsoleEntries([]);
    setConsoleStatus('running');
    setToolStatuses(prev => ({ ...prev, [tool.ToolId]: 'running' }));
    try {
      const { runId } = await api.startRun(tool.ToolId);
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
    if (activeTool) runTool(activeTool);
  }, [activeTool, runTool]);

  const showTools = TOOL_SECTIONS.has(activeSection);

  return (
    <div className="h-screen w-screen nexus-shell overflow-hidden relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-grid-pattern-sm opacity-100" />
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/10 via-black to-purple-900/10" />
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-500/[0.06] blur-[120px] pointer-events-none" />

      <div className="relative z-10 h-full p-4 flex gap-4">
        <Sidebar
          active={activeSection}
          onSelect={setActiveSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          lang={lang}
          setLang={setLang}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
        />

        <div className="flex-1 glass-panel rounded-[2rem] p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

          {bridgeOnline === false && (
            <BridgeOffline error={bridgeError} lang={lang} onRetry={connectBridge} />
          )}

          {bridgeOnline === true && (
            <AnimatePresence mode="wait">
              {activeSection === 'dashboard' ? (
                <PageTransition key="page-dashboard">
                  <Dashboard lang={lang} onNavigate={setActiveSection} toolStatuses={toolStatuses} />                </PageTransition>
              ) : showTools ? (
                <PageTransition key={`tools-${activeSection}`}>
                  <ToolGrid
                    activeSection={activeSection}
                    searchQuery={searchQuery}
                    toolStatuses={toolStatuses}
                    tools={toolsByCategory[SECTION_MAP[activeSection]] || []}
                    lang={lang}
                    onRunTool={runTool}
                    onCancelTool={cancelRun}
                  />
                </PageTransition>
              ) : (
                <PageTransition key={`page-${activeSection}`}>
                  <PlaceholderPage section={activeSection} lang={lang} />
                </PageTransition>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

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
    </div>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <BrowserRouter>
      <AnimatePresence>
        {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}
      </AnimatePresence>
      {splashDone && (
        <Routes>
          <Route path="/*" element={<NexusApp />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
