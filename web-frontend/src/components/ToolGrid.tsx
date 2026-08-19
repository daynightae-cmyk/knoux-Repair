import { useMemo } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, ShieldAlert, Wrench, Trash2, Wifi, AppWindow, Copy,
  HardDrive, Cpu, Gauge, Lock, Activity, Square, RefreshCw, CheckCircle2,
  XCircle, Ban, Terminal, BarChart3, Layers, ScanLine, FileCheck,
  FolderOpen, ArchiveRestore, Settings2, Zap, Thermometer, Eye, ClipboardList,
} from 'lucide-react';
import type { ToolStatus } from '../types';
import { RISK_COLORS, CATEGORY_LABELS, CATEGORY_CONFIG, SECTION_MAP } from '../types';
import type { BridgeTool } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { STRINGS, pickName } from '../lib/i18n';

interface ToolGridProps {
  activeSection: string;
  searchQuery: string;
  toolStatuses: Record<string, ToolStatus>;
  tools: BridgeTool[];
  lang: Lang;
  onRunTool: (tool: BridgeTool) => void;
  onCancelTool: () => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  '01-System-Maintenance': Wrench,
  '02-System-Cleanup': Trash2,
  '03-Network-Internet': Wifi,
  '04-Programs-Applications': AppWindow,
  '05-Duplicate-Files': Copy,
  '06-Disk-Space': HardDrive,
  '07-Services-Processes': Cpu,
  '08-Performance': Gauge,
  '09-Security': ShieldAlert,
  '10-Diagnostics-Reports': Activity,
};

// Capability-based icon mapping for tools
const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  analyze: BarChart3,
  clean: Trash2,
  repair: Wrench,
  restore: ArchiveRestore,
  report: FileCheck,
  reset: Settings2,
  renew: RefreshCw,
  flush: Zap,
  move: Layers,
  schedule: ClipboardList,
  test: Zap,
  scan: ScanLine,
  inspect: Eye,
  whatif: Eye,
};

function getToolCapabilities(tool: BridgeTool): string[] {
  const caps: string[] = [];
  
  // From manifest flags
  if ((tool as any).AnalyzeOnlySupported) caps.push('analyze');
  if ((tool as any).WhatIfSupported) caps.push('whatif');
  
  const name = tool.EnglishName.toLowerCase();
  const purpose = tool.Purpose.toLowerCase();
  
  if ('clean' in name || 'clean' in purpose || tool.RiskLevel === 'DESTRUCTIVE' || tool.RiskLevel === 'SAFE_CLEANUP') caps.push('clean');
  if ('repair' in name || 'repair' in purpose) caps.push('repair');
  if ('restore' in name || 'restore' in purpose || 'quarantin' in purpose) caps.push('restore');
  if ('report' in name || 'report' in purpose) caps.push('report');
  if ('reset' in name || 'reset' in purpose) caps.push('reset');
  if ('renew' in name || 'renew' in purpose) caps.push('renew');
  if ('flush' in name || 'flush' in purpose) caps.push('flush');
  if ('move' in name || 'move' in purpose) caps.push('move');
  if ('schedule' in name || 'schedule' in purpose) caps.push('schedule');
  if ('test' in name || 'test' in purpose) caps.push('test');
  if ('scan' in name || 'scan' in purpose) caps.push('scan');
  if ('list' in name || 'inspect' in purpose) caps.push('inspect');
  
  return [...new Set(caps)];
}

const RISK_LABEL: Record<string, Record<Lang, string>> = {
  READ_ONLY: { en: 'READ ONLY', ar: 'قراءة فقط' },
  SAFE_CLEANUP: { en: 'SAFE CLEANUP', ar: 'تنظيف آمن' },
  SYSTEM_REPAIR: { en: 'SYSTEM REPAIR', ar: 'إصلاح النظام' },
  REBOOT_REQUIRED: { en: 'REBOOT REQUIRED', ar: 'يتطلب إعادة تشغيل' },
  DESTRUCTIVE: { en: 'DESTRUCTIVE', ar: 'تعديل دائم' },
};

function StatusPill({ status, lang }: { status: ToolStatus; lang: Lang }) {
  const t = STRINGS[lang];
  const map: Record<ToolStatus, { label: string; cls: string }> = {
    idle: { label: t.statusIdle, cls: 'text-white/30 border-white/10' },
    running: { label: t.statusRunning, cls: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
    success: { label: t.statusSuccess, cls: 'text-green-400 border-green-500/30 bg-green-500/10' },
    error: { label: t.statusError, cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
    cancelled: { label: t.statusCancelled, cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold tracking-wider border ${s.cls}`}>
      {status === 'running' && <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />}
      {status === 'success' && <CheckCircle2 size={9} />}
      {status === 'error' && <XCircle size={9} />}
      {status === 'cancelled' && <Ban size={9} />}
      {s.label}
    </span>
  );
}

export default function ToolGrid({
  activeSection, searchQuery, toolStatuses, tools, lang, onRunTool, onCancelTool,
}: ToolGridProps) {
  const t = STRINGS[lang];

  // Get the category from SECTION_MAP
  const categoryId = Object.entries(SECTION_MAP).find(([k]) => k === activeSection)?.[1] || '';
  const categoryConfig = CATEGORY_CONFIG[categoryId];
  
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(tool =>
      tool.ToolId.toLowerCase().includes(q) ||
      tool.EnglishName.toLowerCase().includes(q) ||
      (tool.ArabicName || '').toLowerCase().includes(q) ||
      tool.Purpose.toLowerCase().includes(q) ||
      tool.RiskLevel.toLowerCase().includes(q)
    );
  }, [tools, searchQuery]);

  const catLabel = categoryConfig ? (lang === 'ar' ? categoryConfig.arabicName : categoryConfig.name) : (CATEGORY_LABELS[activeSection] || activeSection.toUpperCase());
  const catPurpose = categoryConfig ? (lang === 'ar' ? categoryConfig.arabicPurpose : categoryConfig.purpose) : '';
  const accentColor = categoryConfig?.accent || '#06B6D4';

  return (
    <div className="flex-1 overflow-y-auto pr-2 rtl:pl-2 rtl:pr-0">
      {/* Category Hero */}
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 glass-panel rounded-2xl p-6 relative overflow-hidden"
        style={{ borderTop: `2px solid ${accentColor}` }}
      >
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top, ${accentColor}22, transparent 70%)` }}
        />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-lg"
              style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30`, color: accentColor }}
            >
              {categoryConfig && React.createElement(CATEGORY_ICONS[categoryId] || Wrench, { size: 24 })}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-wider text-white text-glow">
                {catLabel}
              </h2>
              {catPurpose && (
                <p className="font-mono text-[10px] text-white/40 mt-1 tracking-wide">
                  {catPurpose}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold" style={{ color: accentColor }}>
              {filtered.length}
            </p>
            <p className="font-mono text-[9px] text-white/30 tracking-widest">
              {t.toolsCount}
            </p>
          </div>
        </div>
      </motion.div>

      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-2xl p-12 text-center"
        >
          <p className="font-mono text-sm text-cyan-400/50 tracking-wider">
            {searchQuery ? t.noMatch : t.noTools}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((tool, i) => {
              const status = toolStatuses[tool.ToolId] || 'idle';
              const risk = RISK_COLORS[tool.RiskLevel] || RISK_COLORS.READ_ONLY;
              const isRunning = status === 'running';
              const Icon = CATEGORY_ICONS[tool.Category] || Wrench;

              return (
                <motion.div
                  key={tool.ToolId}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  className={`glass-panel glass-interactive rounded-xl p-4 relative overflow-hidden group transition-all duration-300 ${
                    isRunning ? 'neon-glow-strong border-cyan-500/30' : 'hover:border-cyan-500/10'
                  }`}
                >
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

                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 border ${risk.bg} ${risk.text} ${risk.border}`}>
                        <Icon size={15} />
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-semibold tracking-wider border ${risk.text} ${risk.border}`}>
                        {tool.ToolId}
                      </span>
                    </div>
                    <StatusPill status={status} lang={lang} />
                  </div>

                  <h3 className="text-sm font-body font-medium text-slate-200 mb-1.5 leading-tight">
                    {pickName(tool, lang)}
                  </h3>

                  <p className="text-[11px] text-white/35 leading-relaxed mb-3 line-clamp-2">
                    {tool.Purpose}
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <span className={`inline-flex items-center gap-1 font-mono text-[9px] tracking-wider ${risk.text} ${risk.bg} ${risk.border} rounded px-1.5 py-0.5`}>
                      {RISK_LABEL[tool.RiskLevel]?.[lang] || tool.RiskLevel.replace(/_/g, ' ')}
                    </span>
                    {tool.RequiresAdmin && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400/70 tracking-wider">
                        <Lock size={9} /> {t.admin}
                      </span>
                    )}
                  </div>

                  {/* Capability Chips */}
                  {(() => {
                    const caps = getToolCapabilities(tool);
                    if (caps.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {caps.slice(0, 4).map(cap => {
                          const CapIcon = CAPABILITY_ICONS[cap] || Eye;
                          return (
                            <span 
                              key={cap}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]"
                            >
                              <CapIcon size={8} className="text-cyan-400/60" />
                              <span className="font-mono text-[8px] text-white/40 uppercase">{cap}</span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <motion.button
                    onClick={() => (isRunning ? onCancelTool() : onRunTool(tool))}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-[11px] font-semibold tracking-wider transition-all ${
                      isRunning
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 cursor-pointer'
                        : 'bg-white/[0.03] text-slate-400 border border-white/[0.06] hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20'
                    }`}
                    whileTap={isRunning ? { scale: 0.97 } : undefined}
                  >
                    {isRunning ? (
                      <>
                        <Square size={11} /> {t.cancel}
                      </>
                    ) : status === 'success' || status === 'error' || status === 'cancelled' ? (
                      <>
                        <RefreshCw size={12} /> {t.retry}
                      </>
                    ) : (
                      <>
                        <Play size={12} /> {t.run}
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
