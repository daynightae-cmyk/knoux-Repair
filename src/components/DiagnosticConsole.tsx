import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, RefreshCw, Terminal } from 'lucide-react';
import type { ConsoleEntry, Tool } from '../types';

interface DiagnosticConsoleProps {
  visible: boolean;
  onClose: () => void;
  activeTool: Tool | null;
  entries: ConsoleEntry[];
  status: 'idle' | 'running' | 'success' | 'error';
  onRetry: () => void;
}

function colorLine(text: string): { className: string } {
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('exception'))
    return { className: 'text-red-400' };
  if (lower.includes('success') || lower.includes('completed') || lower.includes('[ok]'))
    return { className: 'text-green-400' };
  if (lower.includes('warning') || lower.includes('warn') || lower.includes('[!]'))
    return { className: 'text-amber-400' };
  return { className: 'text-cyan-500/70' };
}

export default function DiagnosticConsole({
  visible, onClose, activeTool, entries, status, onRetry,
}: DiagnosticConsoleProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const exportLog = useCallback(() => {
    const text = entries.map(e => `[${e.timestamp}] [${e.type.toUpperCase()}] ${e.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knoux-${activeTool?.Id || 'console'}-log.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, activeTool]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 300, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 right-6 w-[480px] max-w-[calc(100vw-3rem)] h-[360px] glass-panel rounded-2xl flex flex-col overflow-hidden z-50"
          style={{
            boxShadow: '0 0 60px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 229, 255, 0.05)',
            border: '1px solid rgba(0, 229, 255, 0.12)',
          }}
        >
          {/* Scanlines overlay */}
          <div className="absolute inset-0 scanlines opacity-20 pointer-events-none z-10" />

          {/* Header */}
          <div className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-cyan-400" />
              <span className="font-mono text-[10px] text-cyan-400 tracking-widest">
                SYS.TERM // {activeTool?.Id || 'IDLE'}
              </span>
              {status === 'running' && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {status === 'error' && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all neon-glow-red"
                >
                  <RefreshCw size={10} />
                  RETRY
                </button>
              )}
              <button
                onClick={exportLog}
                className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-white/[0.03] transition-all"
                title="Export Log"
              >
                <Download size={12} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Log body */}
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="relative z-20 flex-1 overflow-y-auto bg-black/80 p-4 font-mono text-[11px] leading-relaxed"
          >
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Terminal size={24} className="text-cyan-400/20 mb-3" />
                <p className="text-cyan-400/30 text-[10px] tracking-widest font-mono">
                  AWAITING MODULE OUTPUT...
                </p>
                <p className="text-white/10 text-[9px] tracking-wider font-mono mt-1">
                  INITIATE A TOOL TO BEGIN TELEMETRY STREAM
                </p>
              </div>
            ) : (
              entries.map(entry => (
                <div key={entry.id} className={`mb-0.5 ${colorLine(entry.text).className}`}>
                  <span className="text-white/15 mr-2">[{entry.timestamp}]</span>
                  {entry.text}
                </div>
              ))
            )}
            {status === 'running' && (
              <div className="text-cyan-400/50">
                <span className="animate-blink">_</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative z-20 px-4 py-2 border-t border-white/[0.04] flex justify-between">
            <span className="font-mono text-[9px] text-white/15 tracking-wider">
              {entries.length} ENTRY ENTRIES
            </span>
            <span className={`font-mono text-[9px] tracking-wider ${
              status === 'running' ? 'text-cyan-400 animate-pulse' :
              status === 'success' ? 'text-green-400' :
              status === 'error' ? 'text-red-400' : 'text-white/20'
            }`}>
              {status === 'running' ? 'EXECUTING...' :
               status === 'success' ? 'COMPLETED' :
               status === 'error' ? 'FAILED' : 'STANDBY'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
