import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AppWindow, Boxes, CircleDot, Copy, Cpu, Gauge, HardDrive, Languages,
  Lock, Moon, Network, Radar, Rocket, Settings, Shield, Sparkles, Sun, Terminal, Trash2, Wrench,
  Zap, ShieldCheck, Layers, ChevronDown, ChevronUp, Code2,
} from 'lucide-react';
import type { CSSProperties, ElementType } from 'react';
import type { ActiveSection } from '../types';
import type { BridgeTool } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { STRINGS } from '../lib/i18n';
import { CATEGORIES, type CategoryIconKey } from '../data/categories';

export type ViewMode =
  | 'care'
  | 'speedup'
  | 'protect'
  | 'toolbox'
  | 'action-center'
  | 'workspace-hub'
  | 'code-zen'
  | 'workspaces'
  | 'tools'
  | 'all-tools';

interface SidebarProps {
  active: ActiveSection;
  onSelect: (section: ActiveSection) => void;
  viewMode: ViewMode;
  onOpenCare: () => void;
  onOpenSpeedUp: () => void;
  onOpenProtect: () => void;
  onOpenToolbox: () => void;
  onOpenActionCenter: () => void;
  onOpenWorkspaceHub: () => void;
  onOpenCodeZen: () => void;
  onOpenAllTools: () => void;
  toolsByCategory: Record<string, BridgeTool[]>;
  open: boolean;
  onClose: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onOpenSettings: () => void;
}

type AccentStyle = CSSProperties & Record<'--accent', string>;

const ICONS: Record<CategoryIconKey, ElementType> = {
  maintenance: Wrench,
  cleanup: Trash2,
  network: Network,
  programs: AppWindow,
  duplicates: Copy,
  disk: HardDrive,
  services: Cpu,
  performance: Gauge,
  security: Shield,
  diagnostics: Activity,
  backup: HardDrive,
  developer: AppWindow,
  privacy: Shield,
  drivers: Cpu,
  monitoring: Activity,
  software: Boxes,
  setup: Rocket,
  sonar: Radar,
};

export default function Sidebar({
  active,
  onSelect,
  viewMode,
  onOpenCare,
  onOpenSpeedUp,
  onOpenProtect,
  onOpenToolbox,
  onOpenActionCenter,
  onOpenWorkspaceHub,
  onOpenCodeZen,
  onOpenAllTools,
  toolsByCategory,
  open,
  onClose,
  lang,
  setLang,
  theme,
  setTheme,
  bridgeOnline,
  bridgeElevated,
  onOpenSettings,
}: SidebarProps) {
  const t = STRINGS[lang];
  const totalTools = Object.values(toolsByCategory).reduce((sum, list) => sum + list.length, 0);
  const [suitesExpanded, setSuitesExpanded] = useState(true);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-label={lang === 'ar' ? 'فئات أدوات الإصلاح' : 'Repair tool categories'}
        className={`
          w-[17.5rem] shrink-0 h-full nx-sidebar rounded-[1.75rem] flex flex-col overflow-hidden
          fixed md:relative z-40 transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          rtl:translate-x-full rtl:md:translate-x-0
        `}
      >
        {/* Brand Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl nx-brand-mark flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <img src="/brand/knoux-repair-logo.png" alt="" className="w-full h-full object-contain scale-[1.22]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-[13px] font-bold tracking-[0.12em] text-white">
                  KNOUX <span className="text-cyan-400 font-black">REPAIR</span>
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-black font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  PRO
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.16em] text-slate-400">
                {lang === 'ar' ? 'منصة الصيانة الذكية 2.0' : 'SYSTEMCARE COCKPIT 2.0'}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Suites (Matching the user's requested dashboard layout) */}
        <div className="px-3 pb-2 space-y-1">
          {/* 1. Care (AI Scan) */}
          <button
            type="button"
            onClick={() => { onOpenCare(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'care' ? 'is-active bg-gradient-to-r from-blue-600/30 to-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : ''}`}
          >
            <span className="workspace-nav-entry-icon text-cyan-400"><Sparkles size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-bold">{lang === 'ar' ? 'الرعاية الذكية (AI)' : 'Care (AI Scan)'}</span>
            <span className="workspace-nav-entry-badge bg-cyan-500/20 text-cyan-300 border-cyan-500/30">AI</span>
          </button>

          {/* 2. Speed Up (تسريع الأداء) */}
          <button
            type="button"
            onClick={() => { onOpenSpeedUp(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'speedup' ? 'is-active bg-gradient-to-r from-amber-600/30 to-yellow-600/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : ''}`}
          >
            <span className="workspace-nav-entry-icon text-amber-400"><Zap size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-bold">{lang === 'ar' ? 'تسريع الأداء' : 'Speed Up'}</span>
            <span className="workspace-nav-entry-badge bg-amber-500/20 text-amber-300 border-amber-500/30">BOOST</span>
          </button>

          {/* 3. Protect (الحماية والأمان) */}
          <button
            type="button"
            onClick={() => { onOpenProtect(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'protect' ? 'is-active bg-gradient-to-r from-emerald-600/30 to-teal-600/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : ''}`}
          >
            <span className="workspace-nav-entry-icon text-emerald-400"><ShieldCheck size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-bold">{lang === 'ar' ? 'الحماية والأمان' : 'Protect & Guard'}</span>
            <span className="workspace-nav-entry-badge bg-emerald-500/20 text-emerald-300 border-emerald-500/30">ARMED</span>
          </button>

          {/* 4. Toolbox (صندوق الأدوات - 4 أعمدة) */}
          <button
            type="button"
            onClick={() => { onOpenToolbox(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'toolbox' ? 'is-active bg-gradient-to-r from-purple-600/30 to-indigo-600/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : ''}`}
          >
            <span className="workspace-nav-entry-icon text-purple-400"><Layers size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-bold">{lang === 'ar' ? 'صندوق الأدوات (4 أعمدة)' : 'Toolbox Suite'}</span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">4-COL</span>
          </button>

          {/* 5. Action Center */}
          <button
            type="button"
            onClick={() => { onOpenActionCenter(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'action-center' ? 'is-active' : ''}`}
          >
            <span className="workspace-nav-entry-icon"><Activity size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-semibold">{lang === 'ar' ? 'مركز الإجراءات والتقارير' : 'Action Center'}</span>
            <span className="workspace-nav-entry-badge">LIVE</span>
          </button>

          {/* 6. Google Workspace & Cloud Hub */}
          <button
            type="button"
            onClick={() => { onOpenWorkspaceHub(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'workspace-hub' ? 'is-active bg-gradient-to-r from-blue-600/30 to-indigo-600/20 text-blue-300 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''}`}
          >
            <span className="workspace-nav-entry-icon text-blue-400"><Layers size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-bold">{lang === 'ar' ? 'سحابة Google و Cloud SQL' : 'Google & Cloud SQL Hub'}</span>
            <span className="workspace-nav-entry-badge bg-blue-500/20 text-blue-300 border-blue-500/30">CLOUD</span>
          </button>

          {/* 7. Open Code Zen & Free AI Models */}
          <button
            type="button"
            onClick={() => { onOpenCodeZen(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'code-zen' ? 'is-active bg-gradient-to-r from-indigo-600/30 to-cyan-600/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]' : ''}`}
          >
            <span className="workspace-nav-entry-icon text-indigo-400"><Code2 size={16} /></span>
            <span className="flex-1 min-w-0 text-start font-bold">{lang === 'ar' ? 'محرك كود زن (النماذج المجانية)' : 'Open Code Zen (Free AI)'}</span>
            <span className="workspace-nav-entry-badge bg-indigo-500/20 text-indigo-300 border-indigo-500/30">ZEN</span>
          </button>

          {/* 8. All Tools Catalog */}
          <button
            type="button"
            onClick={() => { onOpenAllTools(); onClose(); }}
            className={`workspace-nav-entry w-full ${viewMode === 'all-tools' ? 'is-active' : ''}`}
          >
            <span className="workspace-nav-entry-icon"><Terminal size={16} /></span>
            <span className="flex-1 min-w-0 text-start">{lang === 'ar' ? 'فهرس الأدوات الشامل' : 'All Tools Catalog'}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/[0.08]">{totalTools}</span>
          </button>
        </div>

        {/* Expandable 18 Specialized Suites Divider */}
        <div className="px-4 py-2 border-t border-white/[0.05] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSuitesExpanded(!suitesExpanded)}
            className="flex items-center justify-between w-full text-slate-400 hover:text-white transition-colors"
          >
            <span className="font-mono text-[9px] font-bold tracking-[0.16em]">
              {lang === 'ar' ? 'محطات الصيانة المتخصصة (18)' : '18 REPAIR SUITES'}
            </span>
            {suitesExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Collapsible Suites List */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar" aria-label={lang === 'ar' ? 'الفئات' : 'Categories'}>
          <AnimatePresence initial={false}>
            {suitesExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-0.5"
              >
                {CATEGORIES.map((category) => {
                  const isActive = viewMode === 'tools' && active === category.section;
                  const Icon = ICONS[category.icon];
                  const count = toolsByCategory[category.id]?.length ?? 0;
                  const style: AccentStyle = { '--accent': category.accent };

                  return (
                    <motion.button
                      key={category.id}
                      type="button"
                      onClick={() => { onSelect(category.section); onClose(); }}
                      className={`category-nav-item w-full ${isActive ? 'is-active' : ''}`}
                      style={style}
                      aria-current={isActive ? 'page' : undefined}
                      whileTap={{ scale: 0.985 }}
                    >
                      <span className="category-nav-icon"><Icon size={15} strokeWidth={isActive ? 2.5 : 1.8} /></span>
                      <span className="flex-1 min-w-0 text-start truncate text-xs">{category.name[lang]}</span>
                      <span className="category-count" aria-label={`${count} tools`}>{count}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Bottom Status Strip */}
        <div className="px-5 py-3.5 border-t border-white/[0.07] space-y-2.5 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <CircleDot size={11} className={bridgeOnline ? 'text-emerald-400' : bridgeOnline === false ? 'text-rose-400' : 'text-slate-500'} />
            <span className={`font-mono text-[9px] tracking-wide ${bridgeOnline ? 'text-emerald-300' : bridgeOnline === false ? 'text-rose-300' : 'text-slate-500'}`}>
              {bridgeOnline === null ? (lang === 'ar' ? 'جارٍ فحص الجسر' : 'CHECKING EXECUTION BRIDGE') : bridgeOnline ? t.bridgeOnline : t.bridgeOfflineTitle}
            </span>
          </div>
          {bridgeOnline && (
            <p className="font-mono text-[9px] text-slate-400 leading-relaxed flex items-center gap-1">
              <Lock size={10} className="text-cyan-400 shrink-0" />
              <span>{bridgeElevated ? t.bridgeElevated : t.bridgeNotElevated}</span>
            </p>
          )}
          <button type="button" className="sidebar-settings-link" onClick={onOpenSettings}>
            <Settings size={12} />
            <span>{lang === 'ar' ? 'إعدادات المنظومة' : 'Suite Settings'}</span>
          </button>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <Languages size={11} className="text-slate-500" />
              <button onClick={() => setLang('en')} className={`locale-toggle ${lang === 'en' ? 'is-active' : ''}`}>EN</button>
              <button onClick={() => setLang('ar')} className={`locale-toggle ${lang === 'ar' ? 'is-active' : ''}`}>AR</button>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? t.themeLight : t.themeDark}
              title={theme === 'dark' ? t.themeLight : t.themeDark}
              className="theme-toggle"
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

