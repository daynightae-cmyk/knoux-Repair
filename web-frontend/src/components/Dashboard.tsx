import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, HardDrive, CheckCircle, AlertTriangle, Clock, Ban,
  RefreshCw, MonitorCog, MemoryStick, Cpu, ShieldCheck,
} from 'lucide-react';
import type { ToolStatus, ActiveSection } from '../types';
import type { SystemSnapshot } from '../lib/api';
import { api, BridgeError } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { STRINGS, formatUptime } from '../lib/i18n';

interface DashboardProps {
  lang: Lang;
  onNavigate: (section: ActiveSection) => void;
  toolStatuses: Record<string, ToolStatus>;
}

function StatCard({
  label, value, sub, icon: Icon, color, pulse,
}: {
  label: string; value: string; sub: string; icon: React.ElementType; color: string; pulse?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-cyan-500/15 transition-all duration-300"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-[40px] group-hover:bg-cyan-500/10 transition-colors" />
      <div className={`inline-flex p-3 rounded-xl border bg-white/[0.03] border-white/10 ${color} mb-4`}>
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 mb-1">{label}</p>
      <p className={`font-display text-xl font-bold tracking-wider ${color} flex items-center gap-2`}>
        {pulse && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.6)' }} />}
        {value}
      </p>
      <p className="font-mono text-[9px] text-white/20 mt-1">{sub}</p>
    </motion.div>
  );
}

export default function Dashboard({ lang, onNavigate, toolStatuses }: DashboardProps) {
  const t = STRINGS[lang];
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { system: snap } = await api.system();
      setSystem(snap);
    } catch (e) {
      setError(e instanceof BridgeError ? e.message : String(e));
      setSystem(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = window.setInterval(load, 60000);
    return () => window.clearInterval(iv);
  }, [load]);

  const completedEntries = Object.entries(toolStatuses).filter(([, s]) => s !== 'idle');
  const successCount = completedEntries.filter(([, s]) => s === 'success').length;
  const errorCount = completedEntries.filter(([, s]) => s === 'error').length;
  const cancelledCount = completedEntries.filter(([, s]) => s === 'cancelled').length;
  const totalRun = successCount + errorCount + cancelledCount;

  const freeDriveTotal = (system?.Drives || []).reduce((a, d) => a + (d.FreeGB || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto pr-2 rtl:pl-2 rtl:pr-0 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 8px rgba(0,229,255,0.6)' }} />
              <h2 className="font-mono text-[10px] tracking-[0.3em] text-cyan-400/70">{t.dashboard}</h2>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-wider text-white text-glow">
              KNOUX REPAIR <span className="text-cyan-400 font-light">NEXUS</span>
            </h1>
            <p className="font-mono text-[10px] text-white/20 mt-2 tracking-wider">
              v2.0.2 // {t.dashboardSub} // {system ? `${system.Os} (${system.Build})` : '...'}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[10px] font-semibold tracking-wider text-cyan-400 border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {t.refresh}
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="glass-panel rounded-xl p-4 border border-red-500/20">
          <p className="font-mono text-[11px] text-red-400 tracking-wider">
            {t.bridgeOfflineTitle}: {error}
          </p>
          <button
            onClick={load}
            className="mt-2 px-3 py-1.5 rounded-lg font-mono text-[10px] font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
          >
            {t.bridgeOfflineRetry}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={t.systemInfo}
          value={system ? `${system.Os.split(' ').slice(1).join(' ') || 'Windows'}` : '--'}
          sub={system ? `${system.Machine} // ${formatUptime(system.UptimeSeconds, lang)}` : t.unavailable}
          icon={MonitorCog}
          color="text-cyan-400"
          pulse={!!system}
        />
        <StatCard
          label={t.memory}
          value={system ? `${system.FreeRamGB.toFixed(1)} GB` : '--'}
          sub={system ? `${t.free} ${system.FreeRamGB.toFixed(1)} / ${system.TotalRamGB.toFixed(1)} GB` : t.unavailable}
          icon={MemoryStick}
          color="text-purple-400"
        />
        <StatCard
          label={t.cpu}
          value={system ? `${system.CpuLoad ?? 0}%` : '--'}
          sub={system ? system.CpuName || 'CPU' : t.unavailable}
          icon={Cpu}
          color="text-emerald-400"
        />
        <StatCard
          label={t.drives}
          value={system ? `${freeDriveTotal.toFixed(0)} GB` : '--'}
          sub={system
            ? system.Drives.map(d => `${d.Name} ${d.FreeGB.toFixed(1)}/${d.TotalGB.toFixed(1)} GB`).join(' · ')
            : t.unavailable}
          icon={HardDrive}
          color="text-orange-400"
        />
        <StatCard
          label={t.processes}
          value={system ? String(system.Processes ?? 0) : '--'}
          sub={t.sessionSummary}
          icon={Activity}
          color="text-cyan-400"
        />
        <StatCard
          label={t.defender}
          value={system
            ? system.DefenderRealtime ? t.defenderRealtime : system.DefenderRunning ? t.defenderRunning : t.defenderStopped
            : '--'}
          sub={system ? `${t.defender} ${system.DefenderSignatures || ''}` : t.unavailable}
          icon={ShieldCheck}
          color={system?.DefenderRealtime ? 'text-green-400' : 'text-amber-400'}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-panel rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <Activity size={14} className="text-cyan-400" />
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-cyan-400/70">{t.sessionSummary}</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-white">{totalRun}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">{t.executed}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-emerald-400">{successCount}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">{t.succeeded}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-red-400">{errorCount}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">{t.failed}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-amber-400">{cancelledCount}</p>
            <p className="font-mono text-[9px] text-white/25 tracking-wider mt-1">{t.cancelled}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass-panel rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <Clock size={14} className="text-cyan-400" />
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-cyan-400/70">{t.eventLog}</h3>
        </div>
        {completedEntries.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl bg-black/20">
            <Activity size={28} className="text-white/10 mb-3" />
            <p className="font-mono text-[10px] text-white/20 tracking-widest">{t.noEvents}</p>
            <p className="font-mono text-[9px] text-white/10 mt-1">{t.noEventsHint}</p>
            <button
              onClick={() => onNavigate('maintenance')}
              className="mt-4 px-3 py-1.5 rounded-lg font-mono text-[10px] font-semibold text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/10 transition-all"
            >
              {t.navMaintenance} →
            </button>
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
                ) : status === 'error' ? (
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                ) : (
                  <Ban size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="font-mono text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-2 ${
                    status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : status === 'error'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {toolId}
                  </span>
                  <span className="text-slate-400">
                    {status === 'success' ? 'SUCCESS' : status === 'error' ? 'FAILED' : 'CANCELLED'}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
