import { motion } from 'framer-motion';
import {
  Activity, AppWindow, Boxes, CircleDot, Copy, Cpu, Gauge, HardDrive, Languages,
  Lock, Moon, Network, Radar, Rocket, Settings, Shield, Sun, Trash2, Wrench,
} from 'lucide-react';
import type { CSSProperties, ElementType } from 'react';
import type { ActiveSection } from '../types';
import type { BridgeTool } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { STRINGS } from '../lib/i18n';
import { CATEGORIES, type CategoryIconKey } from '../data/categories';

interface SidebarProps {
  active: ActiveSection;
  onSelect: (section: ActiveSection) => void;
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
  active, onSelect, toolsByCategory, open, onClose, lang, setLang, theme, setTheme, bridgeOnline, bridgeElevated, onOpenSettings,
}: SidebarProps) {
  const t = STRINGS[lang];

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
          w-[17rem] shrink-0 h-full nx-sidebar rounded-[1.75rem] flex flex-col overflow-hidden
          fixed md:relative z-40 transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          rtl:translate-x-full rtl:md:translate-x-0
        `}
      >
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl nx-brand-mark flex items-center justify-center shrink-0" aria-hidden="true">
              <span className="font-display text-sm font-black">K</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[13px] font-bold tracking-[0.12em] text-white">
                KNOUX <span className="text-slate-400 font-medium">REPAIR</span>
              </h1>
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.16em] text-slate-500">
                {lang === 'ar' ? 'محطات صيانة ويندوز' : 'WINDOWS REPAIR WORKSTATIONS'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-2">
          <p className="font-mono text-[9px] font-semibold tracking-[0.18em] text-slate-500">
            {lang === 'ar' ? 'المجالات' : 'WORKSTATIONS'}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={lang === 'ar' ? 'الفئات' : 'Categories'}>
          <div className="space-y-1">
            {CATEGORIES.map((category) => {
              const isActive = active === category.section;
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
                  <span className="category-nav-icon"><Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} /></span>
                  <span className="flex-1 min-w-0 text-start truncate">{category.name[lang]}</span>
                  <span className="category-count" aria-label={`${count} tools`}>{count}</span>
                </motion.button>
              );
            })}
          </div>
        </nav>

        <div className="px-5 py-4 border-t border-white/[0.07] space-y-3">
          <div className="flex items-center gap-2">
            <CircleDot size={11} className={bridgeOnline ? 'text-emerald-400' : bridgeOnline === false ? 'text-rose-400' : 'text-slate-500'} />
            <span className={`font-mono text-[9px] tracking-wide ${bridgeOnline ? 'text-emerald-300' : bridgeOnline === false ? 'text-rose-300' : 'text-slate-500'}`}>
              {bridgeOnline === null ? (lang === 'ar' ? 'جارٍ التحقق من الجسر' : 'CHECKING EXECUTION BRIDGE') : bridgeOnline ? t.bridgeOnline : t.bridgeOfflineTitle}
            </span>
          </div>
          {bridgeOnline && (
            <p className="font-mono text-[9px] text-slate-500 leading-relaxed">
              <Lock size={9} className="inline me-1" />
              {bridgeElevated ? t.bridgeElevated : t.bridgeNotElevated}
            </p>
          )}
          <button type="button" className="sidebar-settings-link" onClick={onOpenSettings}><Settings size={12}/>{lang === 'ar' ? 'إعدادات المطور' : 'Developer settings'}</button>
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
