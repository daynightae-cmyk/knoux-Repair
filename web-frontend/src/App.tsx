/**
 * KNOUX Repair — Master Premium Application
 *
 * ABSOLUTE PREMIUM UI RECONSTRUCTION
 * Unified Desktop Workstation Shell
 * Left Rail: AI Scan → 6 Families → Action Center → Settings
 * One Canonical Tool Workspace • Contextual Sentinel • Truthful Telemetry
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import type { BridgeTool, BridgeRun, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot, BridgeAuthStatus } from './lib/api';
import { api, BridgeError } from './lib/api';
import type { ToolStatus, ConsoleEntryType, ConsoleEntry } from './types';
import type { FamilyId, ServiceId, NavDestination, FamilyDefinition } from './data/family-map';
import { FAMILIES } from './data/family-map';
import type { Lang } from './lib/i18n';

import TopBar from './components/premium/TopBar';
import LeftRail from './components/premium/LeftRail';
import SentinelPanel from './components/premium/SentinelPanel';
import type { SentinelTask } from './components/premium/SentinelPanel';
import FamilyPage from './components/premium/FamilyPage';
import AIScanPage from './components/pages/AIScanPage';
import ActionCenterPage from './components/pages/ActionCenterPage';
import AllServicesNavigator from './components/premium/AllServicesNavigator';
import GlobalSearch from './components/premium/GlobalSearch';
import DiagnosticConsole from './components/DiagnosticConsole';
import SettingsCenter from './components/SettingsCenter';
import NexusSplash from './components/NexusSplash';
import AuthGate from './components/AuthGate';

type ActiveView = FamilyId | 'ai-scan' | 'action-center' | 'settings' | 'navigator';
type AuthenticationProviderId = 'google' | 'github' | 'entra';

const AUTH_BRIDGE_ORIGIN = 'http://127.0.0.1:8787';
const AUTH_HANDOFF_TIMEOUT_MS = 2 * 60 * 1000;

function bridgeCapabilityHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = new URLSearchParams(window.location.search).get('bridgeToken') || '';
  if (/^[A-Za-z0-9_-]{16,128}$/.test(token)) headers['X-Knoux-Bridge-Token'] = token;
  return headers;
}

function createAuthHandoffId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

let entryCounter = 0;
function toConsoleEntry(line: { t: string; s: 'out' | 'err'; text: string }): ConsoleEntry {
  const type: ConsoleEntryType = line.s === 'err' ? 'error' : 'info';
  return {
    id: Date.now() + (entryCounter += 1),
    text: line.text,
    type,
    timestamp: line.t ? new Date(line.t).toLocaleTimeString() : new Date().toLocaleTimeString(),
  };
}

function MasterWorkstation() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('knoux-lang');
    return saved === 'ar' ? 'ar' : 'en';
  });

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialView = (searchParams.get('view') as ActiveView) || 'ai-scan';
  const initialService = (searchParams.get('service') as ServiceId) || null;
  const initialTool = searchParams.get('tool') || null;
  const initialSplash = searchParams.get('nosplash') !== '1';

  const [activeView, setActiveView] = useState<ActiveView>(initialView);
  const [selectedService, setSelectedService] = useState<ServiceId | null>(initialService);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(initialTool);

  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [bridgeToolCount, setBridgeToolCount] = useState<number | null>(null);
  const [bridgeElevated, setBridgeElevated] = useState(false);
  const [toolsByCategory, setToolsByCategory] = useState<Record<string, BridgeTool[]>>({});
  const [systemSnapshot, setSystemSnapshot] = useState<SystemSnapshot | null>(null);

  const [toolStatuses, setToolStatuses] = useState<Record<string, ToolStatus>>({});
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [activeTool, setActiveTool] = useState<BridgeTool | null>(null);
  const [activeRequest, setActiveRequest] = useState<{
    tool: BridgeTool; mode: ExecutionMode; options: ToolRunOptions; confirmation?: ToolRunConfirmation;
  } | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'cancelled' | 'inconclusive'>('idle');
  const [activeTasks, setActiveTasks] = useState<SentinelTask[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashVisible, setSplashVisible] = useState(initialSplash);

  const [authStatus, setAuthStatus] = useState<BridgeAuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authPendingProvider, setAuthPendingProvider] = useState<AuthenticationProviderId | null>(null);

  const currentRunId = useRef<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const authPollTimer = useRef<number | null>(null);
  const authHandoffId = useRef<string | null>(null);
  const authAttemptStartedAt = useRef(0);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('knoux-theme') as 'dark' | 'light') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('knoux-lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('knoux-theme', theme);
  }, [theme]);

  useEffect(() => () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    if (authPollTimer.current) window.clearTimeout(authPollTimer.current);
  }, []);

  const connectBridge = useCallback(async () => {
    setBridgeOnline(null);
    let health: Awaited<ReturnType<typeof api.health>> | null = null;
    let tools: BridgeTool[] = [];
    let toolsError = '';

    try { health = await api.health(); } catch { health = null; }
    try { ({ tools } = await api.tools()); }
    catch (e: unknown) { toolsError = e instanceof BridgeError ? `[${e.code}] ${e.message}` : String(e); }

    if (!health) {
      setBridgeOnline(false);
      setBridgeToolCount(null);
      return;
    }

    const byCategory: Record<string, BridgeTool[]> = {};
    for (const t of tools) (byCategory[t.Category] ||= []).push(t);
    setToolsByCategory(byCategory);
    setBridgeToolCount(tools.length);
    setBridgeElevated(health.elevated);

    if (toolsError) {
      setBridgeOnline(false);
      return;
    }

    const auth = await api.authStatus().catch(() => null);
    setAuthStatus(auth);
    setAuthError(auth ? '' : 'Local OAuth routes are not available until bridge is restarted.');
    setBridgeOnline(true);
  }, []);

  const loadSystemSnapshot = useCallback(async () => {
    try { const { system } = await api.system(); setSystemSnapshot(system); }
    catch { setSystemSnapshot(null); }
  }, []);

  useEffect(() => { connectBridge(); loadSystemSnapshot(); }, [connectBridge, loadSystemSnapshot]);
  useEffect(() => { setAuthLoading(bridgeOnline === null); }, [bridgeOnline]);

  const refreshAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try { setAuthStatus(await api.authStatus()); }
    catch (e: unknown) { setAuthError(e instanceof Error ? e.message : String(e)); }
    finally { setAuthLoading(false); }
  }, []);

  const stopAuthPolling = useCallback(() => {
    if (authPollTimer.current) window.clearTimeout(authPollTimer.current);
    authPollTimer.current = null;
    authHandoffId.current = null;
    authAttemptStartedAt.current = 0;
    setAuthPendingProvider(null);
  }, []);

  const cancelSignIn = useCallback(async () => {
    const handoff = authHandoffId.current;
    stopAuthPolling();
    if (!handoff) return;
    try {
      await fetch(`${AUTH_BRIDGE_ORIGIN}/api/auth/handoff/${encodeURIComponent(handoff)}/cancel`, {
        method: 'POST', headers: bridgeCapabilityHeaders(), credentials: 'include',
      });
    } catch { /* best effort */ }
    setAuthError(lang === 'ar' ? 'تم إلغاء تسجيل الدخول.' : 'Sign-in was cancelled.');
  }, [lang, stopAuthPolling]);

  const startSignIn = useCallback((provider: AuthenticationProviderId) => {
    stopAuthPolling();
    setAuthError('');
    const handoff = createAuthHandoffId();
    authHandoffId.current = handoff;
    authAttemptStartedAt.current = Date.now();
    setAuthPendingProvider(provider);
    const startUrl = `${AUTH_BRIDGE_ORIGIN}/api/auth/start/${provider}?handoff=${encodeURIComponent(handoff)}`;
    window.open(startUrl, '_blank', 'noopener,noreferrer');

    const poll = async () => {
      if (authHandoffId.current !== handoff) return;
      if (Date.now() - authAttemptStartedAt.current > AUTH_HANDOFF_TIMEOUT_MS) {
        stopAuthPolling();
        setAuthError(lang === 'ar' ? 'انتهت مهلة تسجيل الدخول. ابدأ المحاولة مرة أخرى.' : 'Sign-in timed out. Start the authentication flow again.');
        try {
          await fetch(`${AUTH_BRIDGE_ORIGIN}/api/auth/handoff/${encodeURIComponent(handoff)}/cancel`, {
            method: 'POST', headers: bridgeCapabilityHeaders(), credentials: 'include',
          });
        } catch { /* best effort */ }
        return;
      }
      try {
        const response = await fetch(`${AUTH_BRIDGE_ORIGIN}/api/auth/handoff/${encodeURIComponent(handoff)}/claim`, {
          method: 'POST', headers: bridgeCapabilityHeaders(), credentials: 'include', body: '{}',
        });
        if (response.status === 202) {
          authPollTimer.current = window.setTimeout(poll, 700);
          return;
        }
        const payload = await response.json().catch(() => ({})) as { message?: string };
        if (!response.ok) throw new Error(payload.message || `Authentication handoff failed (${response.status}).`);
        stopAuthPolling();
        await refreshAuth();
      } catch (error: unknown) {
        if (authHandoffId.current !== handoff) return;
        stopAuthPolling();
        setAuthError(error instanceof Error ? error.message : String(error));
      }
    };
    authPollTimer.current = window.setTimeout(poll, 700);
  }, [lang, refreshAuth, stopAuthPolling]);

  const finishRun = useCallback((run: BridgeRun) => {
    const status: ToolStatus = run.status === 'success' ? 'success' : run.status === 'inconclusive' ? 'inconclusive' : run.status === 'error' ? 'error' : 'cancelled';
    setToolStatuses(prev => ({ ...prev, [run.toolId]: status }));
    setConsoleStatus(run.status);
    setActiveTasks(prev => prev.map(t => t.runId === run.id ? { ...t, status: run.status } : t));
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
          setConsoleEntries(prev => [...prev, ...newLines.map((l: { t: string; s: 'out' | 'err'; text: string }) => toConsoleEntry(l))]);
        }
        if (run.status === 'running') pollTimer.current = window.setTimeout(tick, 600);
        else finishRun(run);
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
      setActiveTasks(prev => [...prev.filter(t => t.tool.ToolId !== tool.ToolId), { runId, tool, mode, status: 'running' }]);
      pollRun(runId, tool);
    } catch (e: unknown) {
      const msg = e instanceof BridgeError ? e.message : e instanceof Error ? e.message : String(e);
      setConsoleEntries([{ id: Date.now() + (entryCounter += 1), text: `[ERR!] ${msg}`, type: 'error', timestamp: new Date().toLocaleTimeString() }]);
      setConsoleStatus('error');
      setToolStatuses(prev => ({ ...prev, [tool.ToolId]: 'error' }));
    }
  }, [pollRun]);

  const cancelRun = useCallback(async () => {
    if (currentRunId.current) try { await api.cancelRun(currentRunId.current); } catch { /* next poll settles */ }
  }, []);

  const handleRetry = useCallback(() => {
    if (activeRequest) runTool(activeRequest.tool, activeRequest.mode, activeRequest.options, activeRequest.confirmation);
  }, [activeRequest, runTool]);

  const navigateTo = useCallback((dest: NavDestination) => {
    setActiveView(dest.family);
    if (dest.service) setSelectedService(dest.service);
    if (dest.toolId) setSelectedToolId(dest.toolId);
  }, []);

  const handleRailSelect = useCallback((view: ActiveView) => {
    setActiveView(view); setSelectedService(null); setSelectedToolId(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(prev => !prev); }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allTools = useMemo(() => Object.values(toolsByCategory).flat(), [toolsByCategory]);
  const activeFamily = useMemo(() => {
    if (activeView === 'ai-scan' || activeView === 'action-center' || activeView === 'settings' || activeView === 'navigator') return null;
    return FAMILIES.find((f: FamilyDefinition) => f.id === activeView) ?? null;
  }, [activeView]);

  return (
    <div className="knoux-shell flex flex-col h-screen w-screen bg-[#050714] text-white overflow-hidden relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px] translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <TopBar lang={lang} bridgeOnline={bridgeOnline} bridgeElevated={bridgeElevated} onSearchOpen={() => setSearchOpen(true)} onSettingsOpen={() => setSettingsOpen(true)} />
      <div className="knoux-body flex flex-1 min-h-0 relative z-10">
        <LeftRail activeView={activeView} onSelect={handleRailSelect} lang={lang} bridgeOnline={bridgeOnline} />
        <main className="knoux-workspace flex-1 overflow-y-auto px-6 py-6" role="main">
          <AnimatePresence mode="wait">
            {activeView === 'ai-scan' ? <motion.div key="ai-scan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}><AIScanPage lang={lang} bridgeOnline={bridgeOnline} toolCount={bridgeToolCount} onNavigate={navigateTo} /></motion.div>
            : activeView === 'navigator' ? <motion.div key="navigator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}><AllServicesNavigator lang={lang} onNavigate={navigateTo} /></motion.div>
            : activeView === 'action-center' ? <motion.div key="action-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}><ActionCenterPage lang={lang} activeTasks={activeTasks} toolStatuses={toolStatuses} onNavigate={navigateTo} /></motion.div>
            : activeView === 'settings' ? <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}><SettingsCenter open={true} onClose={() => setActiveView('ai-scan')} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} bridgeOnline={bridgeOnline} bridgeElevated={bridgeElevated} toolCount={bridgeToolCount ?? allTools.length} onReplaySplash={() => setSplashVisible(true)} auth={authStatus} onSignIn={startSignIn} onLogout={() => { void api.logout().finally(() => { void refreshAuth(); }); }} /></motion.div>
            : activeFamily ? <motion.div key={`family-${activeFamily.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}><FamilyPage family={activeFamily} tools={allTools} lang={lang} bridgeOnline={bridgeOnline} bridgeElevated={bridgeElevated} toolStatuses={toolStatuses} onRunTool={runTool} onCancelTool={cancelRun} selectedService={selectedService} onSelectService={setSelectedService} selectedToolId={selectedToolId} onSelectTool={setSelectedToolId} onRetryBridge={() => { void connectBridge(); }} systemSnapshot={systemSnapshot} consoleEntries={consoleEntries} activeToolId={activeTool?.ToolId ?? null} /></motion.div>
            : null}
          </AnimatePresence>
        </main>
        {!selectedToolId && <SentinelPanel lang={lang} bridgeOnline={bridgeOnline} activeFamily={activeFamily?.id ?? null} activeTasks={activeTasks} systemSnapshot={systemSnapshot} />}
      </div>
      <footer className="knoux-footer flex items-center justify-between h-7 px-4 bg-slate-950/90 border-t border-white/[0.08] text-[11px] font-mono text-slate-400 z-20"><div className="flex items-center gap-3"><span className="font-bold tracking-wider text-slate-300">KNOUX Repair</span><span className="text-slate-600">|</span><span>v2.0.2 Local Workstation</span></div><div className="flex items-center gap-2"><span>{bridgeOnline === true ? `${lang === 'ar' ? 'الجسر متصل' : 'Bridge Online'} • ${bridgeToolCount ?? 0} ${lang === 'ar' ? 'أداة جاهزة' : 'tools ready'}` : bridgeOnline === false ? (lang === 'ar' ? 'غير متاح — الجسر مفصول' : 'UNAVAILABLE — bridge offline') : (lang === 'ar' ? 'جارٍ الاتصال...' : 'Connecting to bridge...')}</span></div></footer>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} tools={allTools} lang={lang} onNavigate={(dest: NavDestination) => { navigateTo(dest); setSearchOpen(false); }} />
      <DiagnosticConsole visible={consoleVisible} onClose={() => setConsoleVisible(false)} activeTool={activeTool} entries={consoleEntries} status={consoleStatus} onRetry={handleRetry} onCancel={cancelRun} lang={lang} />
      {authStatus?.required && !authStatus.authenticated && <AuthGate lang={lang} status={authStatus} loading={authLoading} error={authError} pendingProvider={authPendingProvider} onRetry={refreshAuth} onSignIn={startSignIn} onCancel={cancelSignIn} />}
      <SettingsCenter open={settingsOpen} onClose={() => setSettingsOpen(false)} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} bridgeOnline={bridgeOnline} bridgeElevated={bridgeElevated} toolCount={bridgeToolCount ?? allTools.length} onReplaySplash={() => { setSettingsOpen(false); setSplashVisible(true); }} auth={authStatus} onSignIn={startSignIn} onLogout={() => { void api.logout().finally(() => { void refreshAuth(); }); }} />
      <NexusSplash visible={splashVisible} onDone={() => setSplashVisible(false)} lang={lang} bridgeOnline={bridgeOnline} toolCount={bridgeToolCount ?? allTools.length} />
    </div>
  );
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/*" element={<MasterWorkstation />} /></Routes></BrowserRouter>;
}
