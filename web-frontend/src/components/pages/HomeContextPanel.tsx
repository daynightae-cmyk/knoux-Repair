import {
  BarChart3,
  BrainCircuit,
  ChevronRight,
  Clock3,
  FileText,
  Lightbulb,
  Link2,
  Monitor,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { FamilyId, NavDestination } from '../../data/family-map';
import type { SystemSnapshot } from '../../lib/api';
import type { SentinelTask } from '../premium/SentinelPanel';

interface HomeContextPanelProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  aiProviderState: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  activeTasks: SentinelTask[];
  systemSnapshot: SystemSnapshot | null;
  onNavigate: (destination: NavDestination) => void;
  onOpenActionCenter: () => void;
  onOpenSettings: () => void;
}

interface ContextCardProps {
  eyebrow: string;
  value: string;
  detail: string;
  icon: ElementType;
  tone: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ContextCard({ eyebrow, value, detail, icon: Icon, tone, onClick, disabled }: ContextCardProps) {
  return (
    <button
      type="button"
      className="knoux-home-context-card"
      data-tone={tone}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="knoux-home-context-card__icon"><Icon size={25} /></span>
      <span className="knoux-home-context-card__copy">
        <small>{eyebrow}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </span>
      {!disabled && <ChevronRight size={20} className="knoux-home-context-card__arrow" />}
    </button>
  );
}

export default function HomeContextPanel({
  lang,
  bridgeOnline,
  aiProviderState,
  activeTasks,
  systemSnapshot,
  onNavigate,
  onOpenActionCenter,
  onOpenSettings,
}: HomeContextPanelProps) {
  const ar = lang === 'ar';
  const runningTasks = activeTasks.filter(task => task.status === 'running').length;
  const bridgeValue = bridgeOnline === true
    ? (ar ? 'متصل' : 'CONNECTED')
    : bridgeOnline === false
      ? (ar ? 'غير متصل' : 'OFFLINE')
      : (ar ? 'لم يُفحص' : 'NOT CHECKED');
  const bridgeDetail = bridgeOnline === true
    ? (ar ? 'محرك التنفيذ المحلي جاهز' : 'Local execution bridge ready')
    : bridgeOnline === false
      ? (ar ? 'المحرك المحلي غير متصل' : 'Local bridge unavailable')
      : (ar ? 'جارٍ التحقق من الاتصال' : 'Connection has not resolved');
  const aiValue = aiProviderState === 'CONFIGURED'
    ? (ar ? 'مُعد' : 'CONFIGURED')
    : aiProviderState === 'UNCONFIGURED'
      ? (ar ? 'غير مُعد' : 'UNCONFIGURED')
      : aiProviderState === 'CHECKING'
        ? (ar ? 'جارٍ الفحص' : 'CHECKING')
        : aiProviderState === 'ERROR'
          ? (ar ? 'خطأ' : 'ERROR')
          : (ar ? 'غير متاح' : 'UNAVAILABLE');
  const aiDetail = aiProviderState === 'CONFIGURED'
    ? (ar ? 'يوجد مزود AI مُعد؛ التوفر الفعلي يُتحقق عند الطلب' : 'An AI provider is configured; live availability is verified on use')
    : aiProviderState === 'UNCONFIGURED'
      ? (ar ? 'لا توجد مفاتيح مزود AI مُعدة في الجسر' : 'No AI provider keys are configured in the bridge')
      : aiProviderState === 'CHECKING'
        ? (ar ? 'يتم فحص إعداد المزود بدون إجراء مكالمة مدفوعة' : 'Checking provider configuration without a paid call')
        : aiProviderState === 'ERROR'
          ? (ar ? 'حدث خطأ أثناء قراءة إعداد المزود من الجسر' : 'The bridge returned an error while reading provider configuration')
          : (ar ? 'الجسر المحلي غير متاح، لذلك لم تُفحص إعدادات AI' : 'The local bridge is unavailable, so AI configuration was not checked');

  const openFamily = (family: FamilyId) => onNavigate({ family });

  return (
    <aside className="knoux-home-context" aria-label={ar ? 'السياق المباشر' : 'Live context'}>
      <header className="knoux-home-context__header">
        <h2>KNOUX SENTINEL <span>/ {ar ? 'السياق المباشر' : 'LIVE CONTEXT'}</span></h2>
        <i className={bridgeOnline === true ? 'is-online' : bridgeOnline === false ? 'is-offline' : 'is-pending'} />
      </header>

      <div className="knoux-home-context__cards">
        <ContextCard
          eyebrow={ar ? 'وقت التشغيل' : 'RUNTIME'}
          value={runningTasks > 0 ? (ar ? 'نشط' : 'RUNNING') : (ar ? 'خامل' : 'IDLE')}
          detail={runningTasks > 0
            ? (ar ? `${runningTasks} مهمة قيد التشغيل` : `${runningTasks} active ${runningTasks === 1 ? 'task' : 'tasks'}`)
            : (ar ? 'لا توجد خدمات قيد التشغيل' : 'No services running')}
          icon={Monitor}
          tone="cyan"
          onClick={onOpenActionCenter}
        />
        <ContextCard
          eyebrow={ar ? 'محرك النظام' : 'SYSTEM BRIDGE'}
          value={bridgeValue}
          detail={bridgeDetail}
          icon={Link2}
          tone={bridgeOnline === true ? 'cyan' : bridgeOnline === false ? 'danger' : 'muted'}
          onClick={onOpenSettings}
        />
        <ContextCard
          eyebrow="KNOUX AI"
          value={aiValue}
          detail={aiDetail}
          icon={BrainCircuit}
          tone={aiProviderState === 'CONFIGURED' ? 'violet' : aiProviderState === 'UNAVAILABLE' || aiProviderState === 'ERROR' ? 'danger' : 'muted'}
          onClick={() => openFamily('ai-scan')}
        />
        <ContextCard
          eyebrow={ar ? 'الأدلة' : 'EVIDENCE'}
          value={systemSnapshot ? (ar ? 'متاحة' : 'AVAILABLE') : (ar ? 'لا توجد بعد' : 'NONE YET')}
          detail={systemSnapshot
            ? (ar ? 'تم استلام لقطة نظام حقيقية' : 'Verified system snapshot received')
            : (ar ? 'لا توجد نتائج فحص' : 'No scan results')}
          icon={FileText}
          tone="blue"
          onClick={() => openFamily('ai-scan')}
        />
        <ContextCard
          eyebrow={ar ? 'الوجهات الحديثة' : 'RECENT DESTINATIONS'}
          value={ar ? 'لا توجد بعد' : 'NONE YET'}
          detail={ar ? 'ستظهر اختصاراتك هنا' : 'Your shortcuts will appear here.'}
          icon={Clock3}
          tone="blue"
          disabled
        />
      </div>

      <button type="button" className="knoux-home-get-started" onClick={() => openFamily('vitality')}>
        <span className="knoux-home-get-started__icon"><Lightbulb size={28} /></span>
        <span><strong>{ar ? 'ابدأ الآن' : 'GET STARTED'}</strong><small>{ar ? 'اختر عائلة أو استخدم البحث للوصول إلى أداة.' : 'Choose a family or use search to find a tool.'}</small></span>
        <ChevronRight size={20} />
      </button>

      <div className="knoux-home-quote">
        <blockquote>“{ar ? 'أدوات دقيقة لمشكلات حقيقية.' : 'Precision tools for real problems.'}”</blockquote>
        <span>KNOUX</span>
        <BarChart3 size={25} />
      </div>
    </aside>
  );
}
