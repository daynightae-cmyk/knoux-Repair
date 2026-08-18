import { motion } from 'framer-motion';
import {
  Shield, Wrench, Trash2, Wifi, AppWindow, Copy,
  HardDrive, Cpu, Gauge, Lock, Activity, FileText,
  Archive, Database, Settings, Info, Search, LayoutDashboard
} from 'lucide-react';
import type { ActiveSection } from '../types';

interface SidebarProps {
  active: ActiveSection;
  onSelect: (section: ActiveSection) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  id: ActiveSection;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, group: 'OVERVIEW' },
  { id: 'maintenance', label: 'System Maintenance', icon: <Wrench size={16} />, group: 'REPAIR' },
  { id: 'cleanup', label: 'System Cleanup', icon: <Trash2 size={16} />, group: 'REPAIR' },
  { id: 'network', label: 'Network & Internet', icon: <Wifi size={16} />, group: 'REPAIR' },
  { id: 'programs', label: 'Programs & Apps', icon: <AppWindow size={16} />, group: 'REPAIR' },
  { id: 'duplicates', label: 'Duplicate Files', icon: <Copy size={16} />, group: 'REPAIR' },
  { id: 'disk', label: 'Disk Space', icon: <HardDrive size={16} />, group: 'REPAIR' },
  { id: 'services', label: 'Services & Processes', icon: <Cpu size={16} />, group: 'MANAGE' },
  { id: 'performance', label: 'Performance', icon: <Gauge size={16} />, group: 'MANAGE' },
  { id: 'security', label: 'Security', icon: <Shield size={16} />, group: 'MANAGE' },
  { id: 'diagnostics', label: 'Diagnostics', icon: <Activity size={16} />, group: 'MANAGE' },
  { id: 'reports', label: 'Reports', icon: <FileText size={16} />, group: 'SYSTEM' },
  { id: 'quarantine', label: 'Quarantine', icon: <Archive size={16} />, group: 'SYSTEM' },
  { id: 'backups', label: 'Backups', icon: <Database size={16} />, group: 'SYSTEM' },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} />, group: 'SYSTEM' },
  { id: 'about', label: 'About', icon: <Info size={16} />, group: 'SYSTEM' },
];

export default function Sidebar({ active, onSelect, searchQuery, onSearchChange, open, onClose }: SidebarProps) {
  const groups = [...new Set(NAV_ITEMS.map(i => i.group))];

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 h-full glass-panel rounded-[2rem] flex flex-col overflow-hidden
        fixed md:relative z-40 transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
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
              <p className="font-mono text-[8px] text-cyan-400/40 tracking-widest">NEXUS CORE</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search modules..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-2 pl-9 pr-3 text-xs font-mono text-slate-300 placeholder:text-white/20 focus-glow transition-all"
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {groups.map(group => (
            <div key={group} className="mb-3">
              <p className="px-3 py-1.5 font-mono text-[9px] font-semibold tracking-[0.2em] text-cyan-400/30">
                {group}
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
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-cyan-400 rounded-r neon-glow"
                        layoutId="sidebar-indicator"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Lock size={10} className="text-green-400" />
            <span className="font-mono text-[9px] text-slate-500">Authorized User</span>
          </div>
          <p className="font-mono text-[9px] text-cyan-400/50 mt-1 tracking-wider">
            ROOT_ACCESS <span className="text-green-400/60">[ACTIVE]</span>
          </p>
        </div>
      </div>
    </>
  );
}
