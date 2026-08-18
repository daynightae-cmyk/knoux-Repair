import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, Terminal } from 'lucide-react';
import type { Tool, ToolStatus, ActiveSection } from '../types';
import { SECTION_MAP, CATEGORY_LABELS, RISK_COLORS } from '../types';
import { CATEGORIES } from '../data/tools';

interface ToolGridProps {
  activeSection: ActiveSection;
  searchQuery: string;
  toolStatuses: Record<string, ToolStatus>;
  onRunTool: (tool: Tool) => void;
}

export default function ToolGrid({ activeSection, searchQuery, toolStatuses, onRunTool }: ToolGridProps) {
  const tools = useMemo(() => {
    const catKey = SECTION_MAP[activeSection];
    if (!catKey) return [];
    const cat = CATEGORIES.find(c => c.Category === catKey);
    return cat ? cat.Tools.map(t => ({ ...t, Category: catKey })) : [];
  }, [activeSection]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(t =>
      t.Id.toLowerCase().includes(q) ||
      t.Name.toLowerCase().includes(q) ||
      t.Risk.toLowerCase().includes(q)
    );
  }, [tools, searchQuery]);

  const catLabel = CATEGORY_LABELS[SECTION_MAP[activeSection]] || activeSection.toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto pr-2">
      {/* Section Header */}
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <Terminal size={16} className="text-cyan-400" />
          <h2 className="font-display text-lg font-bold tracking-wider text-white text-glow">
            {catLabel}
          </h2>
        </div>
        <p className="font-mono text-[10px] text-cyan-400/40 tracking-widest ml-7">
          {filtered.length} MODULE{filtered.length !== 1 ? 'S' : ''} AVAILABLE
        </p>
      </motion.div>

      {/* Tool Cards */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-2xl p-12 text-center"
        >
          <p className="font-mono text-sm text-cyan-400/50 tracking-wider">
            {searchQuery ? 'NO MODULES MATCH SEARCH' : 'MODULES UNAVAILABLE'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((tool, i) => {
              const status = toolStatuses[tool.Id] || 'idle';
              const risk = RISK_COLORS[tool.Risk];
              const isRunning = status === 'running';

              return (
                <motion.div
                  key={tool.Id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  className={`glass-panel rounded-xl p-4 relative overflow-hidden group transition-all duration-300 ${
                    isRunning ? 'neon-glow-strong border-cyan-500/30' : 'hover:border-cyan-500/10'
                  }`}
                >
                  {/* Cylon scanner on running */}
                  {isRunning && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div
                        className="absolute top-0 h-[2px] w-32 animate-cylon"
                        style={{
                          background: 'linear-gradient(90deg, transparent, #00e5ff, transparent)',
                          boxShadow: '0 0 20px rgba(0, 229, 255, 0.4)',
                        }}
                      />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-semibold tracking-wider border ${risk.bg} ${risk.text} ${risk.border}`}>
                      {tool.Id}
                    </span>
                    {tool.RequiresAdmin && (
                      <span className="text-[8px] font-mono text-amber-400/60 tracking-wider">ADMIN</span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-sm font-body font-medium text-slate-200 mb-2 leading-tight">
                    {tool.Name}
                  </h3>

                  {/* Risk label */}
                  <p className="font-mono text-[9px] text-white/20 tracking-wider mb-4">
                    {tool.Risk.replace(/_/g, ' ')}
                  </p>

                  {/* Action Button */}
                  <motion.button
                    onClick={() => !isRunning && onRunTool(tool)}
                    disabled={isRunning}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-[11px] font-semibold tracking-wider transition-all ${
                      isRunning
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 cursor-wait'
                        : 'bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20'
                    }`}
                    whileTap={!isRunning ? { scale: 0.97 } : undefined}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        EXECUTING
                      </>
                    ) : (
                      <>
                        <Play size={12} />
                        INITIATE
                      </>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
