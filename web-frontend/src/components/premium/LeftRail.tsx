import { useCallback } from 'react';
import {
  Sparkles, Activity, Database, Shield, Package,
  Code2, Search, Bell, Settings, LayoutGrid,
  HeartPulse, Copy, HardDrive, ClipboardList, Terminal,
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { FamilyId, NavDestination } from '../../data/family-map';

export type ActiveView = FamilyId | 'ai-scan' | 'action-center' | 'settings' | 'navigator';

export interface LeftRailProps {
  activeView: ActiveView;
  onSelect: (view: ActiveView) => void;
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  onQuickTool?: (dest: NavDestination) => void;
}

interface NavItem {
  id: ActiveView;
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'ai-scan', icon: Sparkles, labelEn: 'AI Scan', labelAr: 'فحص ذكي' },
  { id: 'vitality', icon: Activity, labelEn: 'System Vitality', labelAr: 'حيوية النظام' },
  { id: 'recovery', icon: Database, labelEn: 'Recovery & Storage', labelAr: 'الاستعادة والتخزين' },
  { id: 'assurance', icon: Shield, labelEn: 'Assurance', labelAr: 'الضمان والحماية' },
  { id: 'software', icon: Package, labelEn: 'Software Library', labelAr: 'مكتبة البرامج' },
  { id: 'workbench', icon: Code2, labelEn: 'Engineering Workbench', labelAr: 'ورشة الهندسة' },
  { id: 'investigation', icon: Search, labelEn: 'Investigation', labelAr: 'التحقيق' },
  { id: 'navigator', icon: LayoutGrid, labelEn: 'All Services', labelAr: 'دليل الخدمات' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'action-center', icon: Bell, labelEn: 'Action Center', labelAr: 'مركز الإجراءات' },
  { id: 'settings', icon: Settings, labelEn: 'Settings', labelAr: 'الإعدادات' },
];

interface QuickItem {
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
  dest: NavDestination;
}

// Canonical high-value shortcuts — each navigates to the REAL existing
// family → service → tool. No duplicated implementations.
const QUICK_ITEMS: QuickItem[] = [
  { icon: HeartPulse, labelEn: 'System Health', labelAr: 'صحة النظام', dest: { family: 'vitality', service: '01-System-Maintenance', toolId: 'SM10' } },
  { icon: Copy, labelEn: 'Duplicate Detection', labelAr: 'كشف التكرار', dest: { family: 'recovery', service: '05-Duplicate-Files', toolId: 'DF01' } },
  { icon: HardDrive, labelEn: 'Storage Analysis', labelAr: 'تحليل التخزين', dest: { family: 'recovery', service: '06-Disk-Space', toolId: 'DS01' } },
  { icon: ClipboardList, labelEn: 'Software Inspection', labelAr: 'فحص البرامج', dest: { family: 'software', service: '04-Programs-Applications', toolId: 'PA01' } },
  { icon: Terminal, labelEn: 'Developer Diagnostics', labelAr: 'تشخيص المطور', dest: { family: 'workbench', service: '12-Developer-Tools', toolId: 'DT01' } },
];

export default function LeftRail({ activeView, onSelect, lang, bridgeOnline, onQuickTool }: LeftRailProps) {
  const renderItem = useCallback((item: NavItem) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelect(item.id)}
        className="knoux-rail-item"
        data-label={lang === 'ar' ? item.labelAr : item.labelEn}
        data-active={isActive}
        aria-current={isActive ? 'page' : undefined}
        title={lang === 'ar' ? item.labelAr : item.labelEn}
      >
        {isActive && (
          <motion.div
            layoutId="rail-active-indicator"
            className="absolute left-0 rtl:left-auto rtl:right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
            style={{
              background: 'var(--knoux-violet)',
              boxShadow: '0 0 8px rgba(var(--knoux-violet-rgb), 0.5)',
            }}
            initial={false}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <span className="knoux-rail-icon">
          <Icon size={18} />
        </span>
        <span className="knoux-rail-text">{lang === 'ar' ? item.labelAr : item.labelEn}</span>
      </button>
    );
  }, [activeView, lang, onSelect]);

  return (
    <nav className="knoux-rail" role="navigation" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="knoux-rail-label">
          {lang === 'ar' ? 'الخدمات' : 'Services'}
        </div>
        {MAIN_ITEMS.map(renderItem)}
      </div>

      {onQuickTool && (
        <div className="knoux-rail-section flex flex-col gap-0.5">
          <div className="knoux-rail-label">
            {lang === 'ar' ? 'قدرات سريعة' : 'Quick capabilities'}
          </div>
          {QUICK_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.labelEn}
                type="button"
                onClick={() => onQuickTool(item.dest)}
                className="knoux-rail-item"
                data-active={false}
                title={lang === 'ar' ? item.labelAr : item.labelEn}
              >
                <span className="knoux-rail-icon">
                  <Icon size={18} />
                </span>
                <span className="knoux-rail-text">{lang === 'ar' ? item.labelAr : item.labelEn}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="knoux-rail-section flex flex-col gap-0.5">
        {BOTTOM_ITEMS.map(renderItem)}
      </div>

      {/* Bridge status indicator at bottom */}
      <div className="mt-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              bridgeOnline === true && 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
              bridgeOnline === false && 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
              bridgeOnline === null && 'bg-amber-400 animate-pulse',
            )}
          />
          <span className="knoux-rail-text text-[10px]" style={{ color: 'var(--knoux-text-faint)' }}>
            {bridgeOnline === true
              ? (lang === 'ar' ? 'متصل' : 'Online')
              : bridgeOnline === false
                ? (lang === 'ar' ? 'غير متصل' : 'Offline')
                : (lang === 'ar' ? 'يتصل...' : 'Connecting...')}
          </span>
        </div>
      </div>
    </nav>
  );
}
