import { motion } from 'framer-motion';
import {
  Shield, Wrench, Trash2, Wifi, AppWindow, Copy,
  HardDrive, Cpu, Gauge, Lock, Activity, FileText,
  Archive, Database, Settings, Info, Search, LayoutDashboard,
  Languages, CircleDot,
} from 'lucide-react';
import type { ActiveSection } from '../types';
import type { Lang } from '../lib/i18n';
import { STRINGS } from '../lib/i18n';

interface SidebarProps {
  active: ActiveSection;
  onSelect: (section: ActiveSection) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  open: boolean;
  onClose: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
}

interface NavItem {
  id: ActiveSection;
  labelKey: string;
  icon: React.ReactNode;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'navDashboard', icon: <LayoutDashboard size={16} />, group: 'groupOverview' },
  { id: 'maintenance', labelKey: 'navMaintenance', icon: <Wrench size={16} />, group: 'groupRepair' },
  { id: 'cleanup', labelKey: 'navCleanup', icon: <Trash2 size={16} />, group: 'groupRepair' },
  { id: 'network', labelKey: 'navNetwork', icon: <Wifi size={16} />, group: 'groupRepair' },
  { id: 'programs', labelKey: 'navPrograms', icon: <AppWindow size={16} />, group: 'groupRepair' },
  { id: 'duplicates', labelKey: 'navDuplicates', icon: <Copy size={16} />, group: 'groupRepair' },
  { id: 'disk', labelKey: 'navDisk', icon: <HardDrive size={16} />, group: 'groupRepair' },
  { id: 'services', labelKey: 'navServices', icon: <Cpu size={16} />, group: 'groupManage' },
  { id: 'performance', labelKey: 'navPerformance', icon: <Gauge size={16} />, group: 'groupManage' },
  { id: 'security', labelKey: 'navSecurity', icon: <Shield size={16} />, group: 'groupManage' },
  { id: 'diagnostics', labelKey: 'navDiagnostics', icon: <Activity size={16} />, group: 'groupManage' },
  { id: 'reports', labelKey: 'navReports', icon: <FileText size={16} />, group: 'groupSystem' },
  { id: 'quarantine', labelKey: 'navQuarantine', icon: <Archive size={16} />, group: 'groupSystem' },
  { id: 'backups', labelKey: 'navBackups', icon: <Database size={16} />, group: 'groupSystem' },
  { id: 'settings', labelKey: 'navSettings', icon: <Settings size={16} />, group: 'groupSystem' },
  { id: 'about', labelKey: 'navAbout', icon: <Info size={16} />, group: 'groupSystem' },
];

export default function Sidebar({
  active, onSelect, searchQuery, onSearchChange, open, onClose, lang, setLang, bridgeOnline, bridgeElevated,
}: SidebarProps) {
  const t = STRINGS[lang];
  const groups = [...new Set(NAV_ITEMS.map(i => i.group))];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        w-64 h-full glass-panel rounded-[2rem] flex flex-col overflow-hidden
        fixed md:relative z-40 transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg glass-panel-light neon-glow flex items-center justify-center shrink-0">
              <span className="font-display text-sm font-black text-cyan-400">K</span>
            </div>
            <div>
              <h1 className="font-display text-xs font-bold tracking-wider text-glow">
                <span className="text-white">KNOUX</span>{' '}
                <span className="text-cyan-400 font-light">REPAIR</span>
              </h1>
              <p className="font-mono text-[8px] text-cyan-400/40 tracking-widest">{t.tagline}</p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/40 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={t.search}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 pl-9 pr-3 text-xs font-mono text-slate-300 placeholder:text-white/20 focus-glow transition-all rtl:pl-3 rtl:pr-9"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {groups.map(group => (
            <div key={group} className="mb-3">
              <p className="px-3 py-1.5 font-mono text-[9px] font-semibold tracking-[0.2em] text-cyan-400/30">
                {t[group]}
              </p>
              {NAV_ITEMS.filter(i => i.group === group).map(item => {
                const isActive = active === item.id;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => { onSelect(item.id); onClose(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-body transition-all relative ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-cyan-400 rounded-r neon-glow rtl:left-auto rtl:right-0 rtl:rounded-l rtl:rounded-r-none"
                        layoutId="sidebar-indicator"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>{item.icon}</span>
                    <span className="truncate">{t[item.labelKey]}</span>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/[0.04] space-y-2">
          <div className="flex items-center gap-2">
            <CircleDot size={10} className={bridgeOnline ? 'text-green-400' : 'text-red-400'} />
            <span className={`font-mono text-[9px] ${bridgeOnline ? 'text-green-400' : 'text-red-400'}`}>
              {bridgeOnline === null ? '...' : bridgeOnline ? t.bridgeOnline : t.bridgeOfflineTitle}
            </span>
          </div>
          {bridgeOnline && (
            <p className="font-mono text-[9px] text-cyan-400/50 tracking-wider">
              <Lock size={9} className="inline me-1" />
              {bridgeElevated ? t.bridgeElevated : t.bridgeNotElevated}
            </p>
          )}
          <div className="flex items-center gap-1 pt-1">
            <Languages size={10} className="text-slate-500" />
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded font-mono text-[9px] transition-all ${lang === 'en' ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-2 py-1 rounded font-mono text-[9px] transition-all ${lang === 'ar' ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              AR
            </button>
          </div>
        </div>
      </div>
    </>
  );
}