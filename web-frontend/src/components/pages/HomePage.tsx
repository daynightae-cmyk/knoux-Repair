import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Database,
  Gauge,
  LayoutGrid,
  Package,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ElementType } from 'react';
import { FAMILIES } from '../../data/family-map';
import type { NavDestination } from '../../data/family-map';
import type { SystemSnapshot } from '../../lib/api';
import type { SentinelTask } from '../premium/SentinelPanel';
import HomeContextPanel from './HomeContextPanel';
import './HomePage.css';

interface HomePageProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  aiProviderState: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  activeTasks: SentinelTask[];
  systemSnapshot: SystemSnapshot | null;
  onNavigate: (destination: NavDestination) => void;
  onOpenActionCenter: () => void;
  onOpenSettings: () => void;
}

const FAMILY_ICONS: Record<string, ElementType> = {
  vitality: Activity,
  recovery: Database,
  assurance: ShieldCheck,
  software: Package,
  workbench: Wrench,
  investigation: Search,
};

const FAMILY_DESCRIPTIONS: Record<string, { en: string; ar: string }> = {
  vitality: { en: 'Keep your PC clean, optimized and running smoothly.', ar: 'حافظ على نظافة جهازك وسرعته واستقراره.' },
  recovery: { en: 'Manage storage, find duplicates and recover what matters.', ar: 'أدر التخزين وابحث عن التكرارات واستعد ما يهمك.' },
  assurance: { en: 'Strengthen security, privacy and driver integrity.', ar: 'عزّز الأمان والخصوصية وسلامة التعريفات.' },
  software: { en: 'Discover, install and manage software with confidence.', ar: 'اكتشف البرامج وثبّتها وأدرها بثقة.' },
  workbench: { en: 'Advanced tools for power users and technicians.', ar: 'أدوات متقدمة للمحترفين والفنيين.' },
  investigation: { en: 'Analyze, find answers and build the facts that matter.', ar: 'حلّل وابحث وابنِ الحقائق التي تهمك.' },
};

const HERO_ACTIONS: Array<{
  id: string;
  labelEn: string;
  labelAr: string;
  icon: ElementType;
  position: string;
  destination: NavDestination;
}> = [
  { id: 'analyze', labelEn: 'Analyze', labelAr: 'حلّل', icon: Activity, position: 'top-left', destination: { family: 'ai-scan' } },
  { id: 'repair', labelEn: 'Repair', labelAr: 'أصلح', icon: Wrench, position: 'top-right', destination: { family: 'vitality', service: '01-System-Maintenance' } },
  { id: 'recover', labelEn: 'Recover', labelAr: 'استعد', icon: Database, position: 'middle-left', destination: { family: 'recovery' } },
  { id: 'protect', labelEn: 'Protect', labelAr: 'احمِ', icon: ShieldCheck, position: 'middle-right', destination: { family: 'assurance' } },
  { id: 'optimize', labelEn: 'Optimize', labelAr: 'حسّن', icon: Gauge, position: 'bottom-left', destination: { family: 'vitality', service: '08-Performance' } },
  { id: 'understand', labelEn: 'Understand', labelAr: 'افهم', icon: BrainCircuit, position: 'bottom-right', destination: { family: 'investigation' } },
];

export default function HomePage({
  lang,
  bridgeOnline,
  aiProviderState,
  activeTasks,
  systemSnapshot,
  onNavigate,
  onOpenActionCenter,
  onOpenSettings,
}: HomePageProps) {
  const ar = lang === 'ar';
  const families = FAMILIES.filter(family => FAMILY_ICONS[family.id]);
  const runningTaskCount = activeTasks.filter(task => task.status === 'running').length;
  const activeTaskState = runningTaskCount === 0
    ? (ar ? 'لا توجد مهمة قيد التشغيل.' : 'Nothing is running.')
    : ar
      ? runningTaskCount === 1
        ? 'مهمة واحدة قيد التشغيل.'
        : runningTaskCount === 2
          ? 'مهمتان قيد التشغيل.'
          : runningTaskCount <= 10
            ? `${runningTaskCount} مهام قيد التشغيل.`
            : `${runningTaskCount} مهمة قيد التشغيل.`
      : runningTaskCount === 1
        ? '1 task is running.'
        : `${runningTaskCount} tasks are running.`;
  const activitySummary = ar
    ? `ست عائلات. ثماني عشرة خدمة. ذكاء اختياري. ${activeTaskState}`
    : `Six families. Eighteen services. Optional AI. ${activeTaskState}`;

  return (
    <div className="knoux-home" dir={ar ? 'rtl' : 'ltr'}>
      <section className="knoux-home__main">
        <div className="knoux-home-hero">
          <div className="knoux-home-hero__side knoux-home-hero__side--left" aria-hidden="true">
            <span>DIAGNOSE</span><span>REPAIR</span><span>OPTIMIZE</span><i />
            <span>TOOLS</span><span>KNOWLEDGE</span><span>CONFIDENCE</span>
          </div>

          <div className="knoux-home-core">
            <img src="/brand/knoux-home-core.png" alt="KNOUX system diagnostic core" draggable={false} />
            {HERO_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  className="knoux-home-core__action"
                  data-position={action.position}
                  onClick={() => onNavigate(action.destination)}
                  aria-label={ar ? action.labelAr : action.labelEn}
                >
                  <Icon size={21} />
                  <span>{ar ? action.labelAr : action.labelEn}</span>
                </button>
              );
            })}
          </div>

          <div className="knoux-home-hero__side knoux-home-hero__side--right" aria-hidden="true">
            <span>SIX FAMILIES</span><span>EIGHTEEN SERVICES</span><span>ONE PURPOSE</span><i />
            <span>A MORE</span><span>RELIABLE PC</span><span>STARTS HERE</span>
          </div>
        </div>

        <header className="knoux-home-intro">
          <h1>{ar ? 'اختر إجراءً للبدء' : 'SELECT AN ACTION TO BEGIN'}</h1>
          <p>{activitySummary}</p>
        </header>

        <div className="knoux-home-families" aria-label={ar ? 'عائلات الخدمات' : 'Service families'}>
          {families.map((family, index) => {
            const Icon = FAMILY_ICONS[family.id];
            const description = FAMILY_DESCRIPTIONS[family.id];
            return (
              <button
                key={family.id}
                type="button"
                className="knoux-home-family-card"
                data-family={family.id}
                style={{ '--home-card-index': index } as CSSProperties}
                onClick={() => onNavigate({ family: family.id })}
              >
                <Icon size={36} className="knoux-home-family-card__icon" />
                <strong>{ar ? family.name.ar : family.name.en}</strong>
                <p>{ar ? description.ar : description.en}</p>
                <span className="knoux-home-family-card__arrow"><ArrowRight size={19} /></span>
              </button>
            );
          })}
        </div>

        <button type="button" className="knoux-home-banner" onClick={() => onNavigate({ family: 'navigator' })}>
          <span className="knoux-home-banner__icon"><LayoutGrid size={27} /></span>
          <span className="knoux-home-banner__headline">{ar ? 'جهاز أكثر صحة.' : 'A HEALTHIER PC.'}<br />{ar ? 'غدٌ أكثر إشراقًا.' : 'A BRIGHTER TOMORROW.'}</span>
          <i />
          <span className="knoux-home-banner__copy"><strong>{ar ? 'أدوات قوية. رؤى واضحة. التحكم لك.' : "Powerful tools. Clear insights. You're in control."}</strong><small>{ar ? 'استكشف العائلات الست لتشخيص جهازك وإصلاحه وتحسينه وحمايته.' : 'Explore the six families to diagnose, repair, optimize and protect your PC.'}</small></span>
          <span className="knoux-home-banner__arrow"><ArrowRight size={23} /></span>
        </button>
      </section>

      <HomeContextPanel
        lang={lang}
        bridgeOnline={bridgeOnline}
        aiProviderState={aiProviderState}
        activeTasks={activeTasks}
        systemSnapshot={systemSnapshot}
        onNavigate={onNavigate}
        onOpenActionCenter={onOpenActionCenter}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
