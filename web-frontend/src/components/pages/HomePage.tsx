import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Database,
  Gauge,
  LayoutGrid,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ElementType } from 'react';
import { FAMILIES } from '../../data/family-map';
import type { NavDestination } from '../../data/family-map';
import { STUDIOS, studioDisplayName } from '../../data/studio-registry';
import { FAMILY_ICONS } from '../../data/studio-icons';
import type { BridgeTool, SystemSnapshot } from '../../lib/api';
import type { SentinelTask } from '../premium/SentinelPanel';
import StatusIndicator from '../shell/StatusIndicator';
import type { StatusTone } from '../shell/StatusIndicator';
import HomeContextPanel from './HomeContextPanel';
import './HomePage.css';
import './home-command.css';

interface HomePageProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  aiProviderState: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  activeTasks: SentinelTask[];
  systemSnapshot: SystemSnapshot | null;
  /** The live bridge registry, so the studio counts are measured. */
  tools: BridgeTool[];
  onNavigate: (destination: NavDestination) => void;
  onOpenActionCenter: () => void;
  onOpenSettings: () => void;
}

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

/**
 * Home is the command launcher.
 *
 * It is not a poster. The brand illustration survives as a compact identity
 * band, the six studios are the primary destinations with their measured
 * tool counts, the quick actions stay one click away, and everything the
 * page claims about the machine comes from a real measurement.
 */
export default function HomePage({
  lang,
  bridgeOnline,
  aiProviderState,
  activeTasks,
  systemSnapshot,
  tools,
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

  const measured = bridgeOnline === true;
  const toolsByFamily = new Map<string, number>();
  for (const tool of tools) {
    toolsByFamily.set(tool.Category, (toolsByFamily.get(tool.Category) ?? 0) + 1);
  }
  const countForFamily = (familyId: string): number | null => {
    if (!measured) return null;
    const family = FAMILIES.find(candidate => candidate.id === familyId);
    if (!family) return null;
    return family.services.reduce((sum, service) => sum + (toolsByFamily.get(service.id) ?? 0), 0);
  };

  const recentTasks = activeTasks.slice(-4).reverse();
  const bridgeTone: StatusTone = bridgeOnline === true ? 'positive' : bridgeOnline === false ? 'danger' : 'caution';
  const bridgeLabel = bridgeOnline === true
    ? (ar ? 'الجسر متصل' : 'Bridge online')
    : bridgeOnline === false
      ? (ar ? 'الجسر غير متصل' : 'Bridge offline')
      : (ar ? 'جارٍ فحص الجسر' : 'Checking bridge');

  return (
    <div className="knoux-home" dir={ar ? 'rtl' : 'ltr'}>
      <section className="knoux-home__main">
        <div className="knoux-home-hero">
          <div className="knoux-home-core">
            <img src="/brand/knoux-home-core.png" alt="KNOUX system diagnostic core" draggable={false} />
            <div className="knoux-home-core__veil" aria-hidden="true" />
          </div>

          <div className="knoux-home-hero__readiness">
            <div className="knoux-home-hero__identity">
              <span className="knoux-home-hero__eyebrow">{ar ? 'محطة عمل كنوكس' : 'KNOUX WORKSTATION'}</span>
              <h1>{ar ? 'أين تريد أن تبدأ؟' : 'Where do you want to start?'}</h1>
              <p>{activitySummary}</p>
            </div>
            <div className="knoux-home-hero__chips">
              <StatusIndicator tone={bridgeTone} label={bridgeLabel} />
              <StatusIndicator
                tone={systemSnapshot ? 'data' : 'neutral'}
                label={systemSnapshot?.Os ?? (ar ? 'النظام — لم يُفحص' : 'System — Not checked')}
              />
              <StatusIndicator
                tone={systemSnapshot ? 'data' : 'neutral'}
                label={systemSnapshot?.Build ? `Build ${systemSnapshot.Build}` : (ar ? 'البناء — لم يُفحص' : 'Build — Not checked')}
              />
            </div>
          </div>
        </div>

        <nav className="knoux-home-actions" aria-label={ar ? 'إجراءات سريعة' : 'Quick actions'}>
          {HERO_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className="knoux-home-action"
                data-position={action.position}
                onClick={() => onNavigate(action.destination)}
                aria-label={ar ? action.labelAr : action.labelEn}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{ar ? action.labelAr : action.labelEn}</span>
              </button>
            );
          })}
        </nav>

        <header className="knoux-home-intro">
          <h2>{ar ? 'الاستوديوهات' : 'THE SIX STUDIOS'}</h2>
          <p>{ar ? 'ستة استوديوهات متخصصة، كل منها يعرض خدماته الحقيقية وأدواتها المقيسة.' : 'Six specialized studios, each with its own real services and measured tools.'}</p>
        </header>

        <div className="knoux-home-families" aria-label={ar ? 'استوديوهات الخدمات' : 'Service studios'}>
          {families.map((family, index) => {
            const Icon = FAMILY_ICONS[family.id];
            const description = FAMILY_DESCRIPTIONS[family.id];
            const studio = STUDIOS.find(candidate => candidate.id === family.id);
            const count = countForFamily(family.id);
            return (
              <button
                key={family.id}
                type="button"
                className="knoux-home-family-card"
                data-family={family.id}
                style={{ '--home-card-index': index } as CSSProperties}
                onClick={() => onNavigate({ family: family.id })}
              >
                <span className="knoux-home-family-card__icon"><Icon size={20} /></span>
                <span className="knoux-home-family-card__body">
                  <strong>{ar ? family.name.ar : family.name.en}</strong>
                  <em>{studio ? studioDisplayName(studio, ar ? 'ar' : 'en') : ''}</em>
                  <p>{ar ? description.ar : description.en}</p>
                </span>
                <span className="knoux-home-family-card__meta">
                  <StatusIndicator tone="data" label={count === null ? '—' : String(count)} />
                  <span className="knoux-home-family-card__arrow"><ArrowRight size={17} /></span>
                </span>
              </button>
            );
          })}
        </div>

        <section className="knoux-home-recent" aria-label={ar ? 'عمليات حديثة' : 'Recent operations'}>
          <header>
            <h3>{ar ? 'عمليات حديثة' : 'RECENT OPERATIONS'}</h3>
            <button type="button" className="knoux-home-recent__action" onClick={onOpenActionCenter}>
              {ar ? 'مركز الإجراءات' : 'Action Center'}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>
          {recentTasks.length === 0 ? (
            <p className="knoux-home-recent__empty">
              {ar
                ? 'لا توجد عمليات مسجّلة في هذه الجلسة بعد.'
                : 'No operations have been recorded in this session yet.'}
            </p>
          ) : (
            <ul className="knoux-home-recent__list">
              {recentTasks.map(task => (
                <li key={task.runId} data-status={task.status}>
                  <span className="knoux-home-recent__name">
                    {ar ? task.tool.ArabicName : task.tool.EnglishName}
                    <small>{task.mode} · {task.tool.RiskLevel}</small>
                  </span>
                  <StatusIndicator
                    tone={task.status === 'success' ? 'positive' : task.status === 'running' ? 'data' : task.status === 'error' ? 'danger' : 'caution'}
                    label={task.status}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" className="knoux-home-banner" onClick={() => onNavigate({ family: 'navigator' })}>
          <span className="knoux-home-banner__icon"><LayoutGrid size={24} /></span>
          <span className="knoux-home-banner__headline">{ar ? 'كل الخدمات' : 'ALL SERVICES'}<br />{ar ? 'في فهرس واحد' : 'IN ONE INDEX'}</span>
          <i />
          <span className="knoux-home-banner__copy">
            <strong>{ar ? 'ثماني عشرة خدمة معيارية.' : 'Eighteen canonical services.'}</strong>
            <small>{ar ? 'انتقل إلى أي خدمة مباشرة، دون المرور عبر لوحة متكررة.' : 'Jump straight to any service, without a duplicated landing page.'}</small>
          </span>
          <span className="knoux-home-banner__arrow"><ArrowRight size={21} /></span>
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
