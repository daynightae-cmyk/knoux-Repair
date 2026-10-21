import { useCallback, useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';
import type { FamilyId } from '../../data/family-map';
import { FAMILIES } from '../../data/family-map';
import { CROSS_CUTTING_DESTINATIONS, STUDIOS, studioDisplayName } from '../../data/studio-registry';
import { FAMILY_ICONS } from '../../data/studio-icons';
import { APP_VERSION } from '../../version';

export type ActiveView = FamilyId | 'home' | 'ai-scan' | 'action-center' | 'settings' | 'navigator';

export interface LeftRailProps {
  activeView: ActiveView;
  onSelect: (view: ActiveView) => void;
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
}

interface NavItem {
  id: ActiveView;
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
  hintEn?: string;
  hintAr?: string;
}

/**
 * The product's navigation spine.
 *
 * It is the only permanently visible navigation surface: Home and AI Scan
 * at the top, the six operational studios in the middle, Action Center and
 * Settings at the bottom. It starts collapsed to a 76px icon rail and
 * expands on demand (or with Ctrl+B) into a labelled column, so the work
 * surface keeps the width when it matters and the labels are available when
 * they are needed.
 */
const MAIN_ITEMS: NavItem[] = [
  {
    id: 'home',
    icon: CROSS_CUTTING_DESTINATIONS.find(d => d.id === 'home')!.icon,
    labelEn: 'Home',
    labelAr: 'الرئيسية',
    hintEn: 'Command launcher and readiness',
    hintAr: 'منصة الأوامر وحالة الجاهزية',
  },
  {
    id: 'ai-scan',
    icon: CROSS_CUTTING_DESTINATIONS.find(d => d.id === 'ai-scan')!.icon,
    labelEn: 'AI Scan',
    labelAr: 'فحص ذكي',
    hintEn: 'Guided investigation',
    hintAr: 'تحقيق موجّه',
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    id: 'action-center',
    icon: CROSS_CUTTING_DESTINATIONS.find(d => d.id === 'action-center')!.icon,
    labelEn: 'Action Center',
    labelAr: 'مركز الإجراءات',
    hintEn: 'Jobs, confirmations, records',
    hintAr: 'المهام والتأكيدات والسجلات',
  },
  {
    id: 'settings',
    icon: CROSS_CUTTING_DESTINATIONS.find(d => d.id === 'settings')!.icon,
    labelEn: 'Settings',
    labelAr: 'الإعدادات',
    hintEn: 'Language, theme, account',
    hintAr: 'اللغة والمظهر والحساب',
  },
];

const STUDIO_ITEMS: NavItem[] = FAMILIES.map(family => {
  const studio = STUDIOS.find(candidate => candidate.id === family.id);
  return {
    id: family.id,
    icon: FAMILY_ICONS[family.id],
    labelEn: family.name.en,
    labelAr: family.name.ar,
    hintEn: studio ? studioDisplayName(studio, 'en') : family.tagline.en,
    hintAr: studio ? studioDisplayName(studio, 'ar') : family.tagline.ar,
  };
});

export default function LeftRail({ activeView, onSelect, lang, bridgeOnline }: LeftRailProps) {
  const [expanded, setExpanded] = useState(false);
  const isRtl = lang === 'ar';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setExpanded(value => !value);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderItem = useCallback((item: NavItem) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;
    const label = isRtl ? item.labelAr : item.labelEn;
    const hint = isRtl ? item.hintAr : item.hintEn;

    return (
      <button
        key={`${item.id}:${item.labelEn}`}
        type="button"
        onClick={() => onSelect(item.id)}
        className="knoux-rail-item knoux-spine-item"
        data-nav-view={item.id}
        data-label={label}
        data-active={isActive}
        aria-current={isActive ? 'page' : undefined}
        title={hint ? `${label} — ${hint}` : label}
      >
        <span className="knoux-rail-icon knoux-spine-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="knoux-rail-text knoux-spine-text">
          <strong>{label}</strong>
          {hint ? <small>{hint}</small> : null}
        </span>
      </button>
    );
  }, [activeView, isRtl]);

  const studioItems = STUDIO_ITEMS;

  return (
    <nav
      className="knoux-rail knoux-spine"
      role="navigation"
      aria-label={isRtl ? 'التنقل الرئيسي' : 'Main navigation'}
      data-expanded={expanded}
    >
      <div className="knoux-spine-scroll">
        <div className="knoux-spine-section-label">{isRtl ? 'البداية' : 'Start'}</div>
        {MAIN_ITEMS.map(renderItem)}

        <div className="knoux-spine-section-label">{isRtl ? 'الاستوديوهات' : 'Studios'}</div>
        {studioItems.map(renderItem)}
      </div>

      <div className="knoux-spine-section knoux-spine-footer">
        {BOTTOM_ITEMS.map(renderItem)}
      </div>

      <button
        type="button"
        className="knoux-spine-toggle"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        aria-label={expanded
          ? (isRtl ? 'طي شريط التنقل' : 'Collapse navigation')
          : (isRtl ? 'توسيع شريط التنقل' : 'Expand navigation')}
        title={expanded
          ? (isRtl ? 'طي شريط التنقل (Ctrl+B)' : 'Collapse navigation (Ctrl+B)')
          : (isRtl ? 'توسيع شريط التنقل (Ctrl+B)' : 'Expand navigation (Ctrl+B)')}
      >
        {expanded
          ? (isRtl ? <PanelLeftClose size={15} aria-hidden="true" /> : <PanelLeftClose size={15} aria-hidden="true" />)
          : (isRtl ? <PanelLeftOpen size={15} aria-hidden="true" /> : <PanelLeftOpen size={15} aria-hidden="true" />)}
        <span className="knoux-spine-text" style={{ opacity: expanded ? 1 : 0 }}>
          {isRtl ? 'طي' : 'Collapse'}
        </span>
      </button>

      <div className="knoux-rail-brand-card knoux-spine-footer" aria-label={`KNOUX Repair version ${APP_VERSION}`}>
        <strong>KNOUX Repair</strong>
        <span>{APP_VERSION}</span>
        <small>{isRtl ? 'صُنع لجهاز أكثر صحة. غدٌ أكثر إشراقاً.' : 'Built for a Healthier PC. A Brighter Tomorrow.'}</small>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              bridgeOnline === true && 'bg-emerald-400',
              bridgeOnline === false && 'bg-red-400',
              bridgeOnline === null && 'bg-amber-400 animate-pulse',
            )}
          />
          <span className="knoux-rail-text text-[10px]" style={{ color: 'var(--knoux-text-faint)' }}>
            {bridgeOnline === true
              ? (isRtl ? 'متصل' : 'Online')
              : bridgeOnline === false
                ? (isRtl ? 'غير متصل' : 'Offline')
                : (isRtl ? 'يتصل...' : 'Connecting...')}
          </span>
        </div>
      </div>
    </nav>
  );
}
