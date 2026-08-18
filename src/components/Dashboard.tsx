import { motion } from 'framer-motion';
import { Activity, Shield, HardDrive, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import type { ToolStatus } from '../types';

interface DashboardProps {
  toolStatuses: Record<string, ToolStatus>;
}

interface StatCard {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

export default function Dashboard({ toolStatuses }: DashboardProps) {
  const completedCount = Object.values(toolStatuses).filter(s => s === 'success').length;
  const errorCount = Object.values(toolStatuses).filter(s => s === 'error').length;
  const totalRun = completedCount + errorCount;

  const stats: StatCard[] = [
    {
      label: 'SYSTEM STATUS',
      value: errorCount > 0 ? 'WARNING' : 'OPTIMAL',
      sub: errorCount > 0 ? `${errorCount} module(s) reported errors` : 'All systems operational',
      icon: Activity,
      color: errorCount > 0 ? 'text-amber-400' : 'text-emerald-400',
      bg: errorCount > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      border: errorCount > 0 ? 'border-amber-500/20' : 'border-emerald-500/20',
      glow: errorCount > 0 ? 'shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    },
    {
      label: 'SECURITY',
      value: 'PROTECTED',
      sub: 'Firewall active — Defender enabled',
      icon: Shield,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      glow: 'shadow-[0_0_20px_rgba(0,229,255,0.1)]',
    },
    {
      label: 'DISK HEALTH',
      value: 'GOOD',
      sub: 'S.M.A.R.T. status:Passed',
      icon: HardDrive,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.1)]',
    },
  ];

  const completedEntries = Object.entries(toolStatuses)
    .filter(([, s]) => s === 'success' || s === 'error')
    .sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-6">
      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.6)' }} />
            <h2 className="font-mono text-[10px] tracking-[0.3em] text-cyan-400/70">SYSTEM TELEMETRY</h2>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-white text-glow">
            NEXUS CORE <span className="text-cyan-400 font-light">DASHBOARD</span>
          </h1>
          <p className="font-mono text-[10px] text-white/20 mt-2 tracking-wider">
            v2.0.2 // 100 MODULES LOADED // REAL-TIME MONITORING
          </p>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
              className={`glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-cyan-500/15 transition-all duration-300 ${stat.glow}`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-[40px] group-hover:bg-cyan-500/10 transition-colors" />
              <div className={`inline-flex p-3 rounded-xl border ${stat.bg} ${stat.color} ${stat.border} mb-4`}>
                <Icon size={22} strokeWidth={1.5} />
              </div>
              <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 mb-1">{stat.label}</p>
              <p className={`font-display text-xl font-bold tracking-wider ${stat.color}`}>{stat.value}</p>
              <p className="font-mono text-[9px] text-white/20 mt-1">{stat.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Session summary */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-panel rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <Activity size={14} className="text-cyan-400" />
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-cyan-400/70">SESSION SUMMARY</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-white">{totalRun}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">EXECUTED</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-emerald-400">{completedCount}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">SUCCEEDED</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-red-400">{errorCount}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">FAILED</p>
          </div>
        </div>
      </motion.div>

      {/* Event logs */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass-panel rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <Clock size={14} className="text-cyan-400" />
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-cyan-400/70">EVENT LOG</h3>
        </div>
        {completedEntries.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl bg-black/20">
            <Activity size={28} className="text-white/10 mb-3" />
            <p className="font-mono text-[10px] text-white/20 tracking-widest">NO EVENTS RECORDED</p>
            <p className="font-mono text-[9px] text-white/10 mt-1">Initiate a module to begin</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {completedEntries.map(([toolId, status]) => (
              <motion.div
                key={toolId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-white/[0.03] hover:border-cyan-500/10 transition-colors"
              >
                {status === 'success' ? (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                )}
                <span className="font-mono text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-2 ${
                    status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {toolId}
                  </span>
                  <span className="text-slate-400">
                    {status === 'success' ? 'EXECUTION SUCCESSFUL' : 'EXECUTION FAILED'}
                  </span>
                </span>
                <span className="ml-auto font-mono text-[9px] text-white/15">
                  {new Date().toLocaleTimeString()}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
