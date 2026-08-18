import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import SplashScreen from './components/SplashScreen';
import Sidebar from './components/Sidebar';
import ToolGrid from './components/ToolGrid';
import DiagnosticConsole from './components/DiagnosticConsole';
import PlaceholderPage from './components/PlaceholderPage';
import PageTransition from './components/PageTransition';
import type { ActiveSection, Tool, ToolStatus, ConsoleEntry, ConsoleEntryType } from './types';
import { useTypewriterRunner, buildToolSimulation } from './lib/consoleSimulator';

const TOOL_SECTIONS = new Set([
  'maintenance', 'cleanup', 'network', 'programs', 'duplicates',
  'disk', 'services', 'performance', 'security', 'diagnostics',
]);

function NexusApp() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('maintenance');
  const [searchQuery, setSearchQuery] = useState('');
  const [toolStatuses, setToolStatuses] = useState<Record<string, ToolStatus>>({});
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { run: runTypewriter, cancel: cancelTypewriter } = useTypewriterRunner();

  let entryCounter = 0;
  const addEntry = useCallback((text: string, type: ConsoleEntryType = 'info') => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    entryCounter++;
    setConsoleEntries(prev => [...prev, { id: Date.now() + entryCounter, text, type, timestamp: ts }]);
  }, []);

  const simulateToolRun = useCallback((tool: Tool) => {
    cancelTypewriter();
    setActiveTool(tool);
    setConsoleVisible(true);
    setConsoleEntries([]);
    setConsoleStatus('running');
    setToolStatuses(prev => ({ ...prev, [tool.Id]: 'running' }));

    const lines = buildToolSimulation(tool);

    runTypewriter(lines, addEntry, (finalStatus) => {
      setToolStatuses(prev => ({ ...prev, [tool.Id]: finalStatus }));
      setConsoleStatus(finalStatus);
    });
  }, [addEntry, runTypewriter, cancelTypewriter]);

  const handleRetry = useCallback(() => {
    if (activeTool) {
      cancelTypewriter();
      setConsoleEntries([]);
      simulateToolRun(activeTool);
    }
  }, [activeTool, simulateToolRun, cancelTypewriter]);

  const showTools = TOOL_SECTIONS.has(activeSection);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-pattern-sm opacity-100" />
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/10 via-black to-purple-900/10" />

      {/* Light blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-500/[0.06] blur-[120px] pointer-events-none" />

      {/* Main Canvas */}
      <div className="relative z-10 h-full p-4 flex gap-4">
        {/* Sidebar */}
        <Sidebar
          active={activeSection}
          onSelect={setActiveSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Glass Canvas */}
        <div className="flex-1 glass-panel rounded-[2rem] p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

          <AnimatePresence mode="wait">
            {showTools ? (
              <PageTransition key={`tools-${activeSection}`}>
                <ToolGrid
                  activeSection={activeSection}
                  searchQuery={searchQuery}
                  toolStatuses={toolStatuses}
                  onRunTool={simulateToolRun}
                />
              </PageTransition>
            ) : (
              <PageTransition key={`page-${activeSection}`}>
                <PlaceholderPage section={activeSection} />
              </PageTransition>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Console */}
      <DiagnosticConsole
        visible={consoleVisible}
        onClose={() => setConsoleVisible(false)}
        activeTool={activeTool}
        entries={consoleEntries}
        status={consoleStatus}
        onRetry={handleRetry}
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
