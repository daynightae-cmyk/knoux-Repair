import {
  AppWindow,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDot,
  Download,
  Layers3,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { BridgeTool } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../data/family-map';

interface SoftwareLibraryPageProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onSelectService: (id: ServiceId) => void;
}

const SERVICE_ICONS: Record<string, ElementType> = {
  '04-Programs-Applications': AppWindow,
  '16-Software-Environment': Layers3,
  '17-PostInstall-Setup': Settings2,
};

const SERVICE_KICKERS: Record<string, { en: string; ar: string }> = {
  '04-Programs-Applications': { en: 'Manage installed apps, startup and repairs', ar: 'إدارة البرامج المثبتة وبدء التشغيل والإصلاح' },
  '16-Software-Environment': { en: 'Audit runtimes, environments and extensions', ar: 'فحص بيئات التشغيل والإضافات' },
  '17-PostInstall-Setup': { en: 'Prepare a trusted software setup plan', ar: 'إعداد خطة موثوقة لتجهيز البرامج' },
};

const SHORTCUTS: Array<{
  service: ServiceId;
  icon: ElementType;
  en: string;
  ar: string;
}> = [
  { service: '04-Programs-Applications', icon: Boxes, en: 'Installed Apps', ar: 'التطبيقات المثبتة' },
  { service: '04-Programs-Applications', icon: RefreshCw, en: 'Startup Control', ar: 'التحكم في بدء التشغيل' },
  { service: '04-Programs-Applications', icon: ShieldCheck, en: 'Repair Center', ar: 'مركز الإصلاح' },
  { service: '16-Software-Environment', icon: TerminalSquare, en: 'Runtime Hub', ar: 'مركز بيئات التشغيل' },
  { service: '16-Software-Environment', icon: Search, en: 'Extension Audit', ar: 'فحص الإضافات' },
  { service: '17-PostInstall-Setup', icon: Download, en: 'Setup Checklist', ar: 'قائمة التجهيز' },
];

function serviceToolCount(service: ServiceDefinition, tools: BridgeTool[], online: boolean | null) {
  if (online !== true) return null;
  return tools.filter(tool => tool.Category === service.id).length;
}

export default function SoftwareLibraryPage({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  onSelectService,
}: SoftwareLibraryPageProps) {
  const ar = lang === 'ar';
  const programs = family.services.find(service => service.id === '04-Programs-Applications') ?? family.services[0];
  const loadedTools = family.services.reduce((total, service) => {
    const count = serviceToolCount(service, tools, bridgeOnline);
    return total + (count ?? 0);
  }, 0);

  return (
    <div className="software-library-page" dir={ar ? 'rtl' : 'ltr'}>
      <section className="software-library-hero" aria-labelledby="software-library-title">
        <img
          className="software-library-hero__art"
          src="/brand/knoux-software-library-hero.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <div className="software-library-hero__shade" aria-hidden="true" />
        <div className="software-library-hero__copy">
          <p className="software-library-eyebrow">{ar ? 'استكشف • ثبّت • اضبط' : 'EXPLORE  •  INSTALL  •  CONFIGURE'}</p>
          <h1 id="software-library-title">
            <span>{ar ? 'مكتبة' : 'Software'}</span>
            <strong>{ar ? 'البرامج' : 'Library'}</strong>
          </h1>
          <h2>{ar ? 'البرامج. البيئات. التجهيز. كلها في مكان واحد.' : 'Programs. Environments. Setup. All in one place.'}</h2>
          <p>
            {ar
              ? 'استكشف برامج جهازك وبيئات التشغيل وخطوات التجهيز من ثلاث مساحات متخصصة تعتمد فقط على بيانات جهازك الحقيقية.'
              : 'Explore installed programs, runtime environments and setup workflows in three focused workspaces backed only by live device evidence.'}
          </p>
          <div className="software-library-hero__actions">
            <button type="button" className="software-library-primary" onClick={() => onSelectService(programs.id)}>
              <AppWindow size={18} />
              <span>{ar ? 'فتح مركز التطبيقات' : 'Open Application Studio'}</span>
              <ArrowRight size={18} />
            </button>
            <button type="button" className="software-library-secondary" onClick={() => onSelectService('16-Software-Environment')}>
              <Layers3 size={18} />
              <span>{ar ? 'عرض بيئات التشغيل' : 'Browse Environments'}</span>
            </button>
          </div>
          <div className="software-library-principles" aria-label={ar ? 'مبادئ المكتبة' : 'Library principles'}>
            <span><Sparkles size={16} /><b>{ar ? 'أوضح' : 'CLEARER'}</b><small>{ar ? 'نتائج مثبتة فقط' : 'Evidence before claims'}</small></span>
            <span><ShieldCheck size={16} /><b>{ar ? 'أكثر أمانًا' : 'SAFER'}</b><small>{ar ? 'تأكيد قبل التغيير' : 'Confirm before change'}</small></span>
            <span><Package size={16} /><b>{ar ? 'أكثر تنظيمًا' : 'ORGANIZED'}</b><small>{ar ? 'مساحة لكل مهمة' : 'A workspace per task'}</small></span>
          </div>
        </div>
        <div className="software-library-hero__status">
          <span>{ar ? 'حالة المكتبة' : 'LIBRARY STATUS'}</span>
          <strong data-state={bridgeOnline === true ? 'ready' : bridgeOnline === false ? 'offline' : 'checking'}>
            <CircleDot size={13} />
            {bridgeOnline === true
              ? (ar ? 'جاهزة للفحص' : 'READY TO SCAN')
              : bridgeOnline === false
                ? (ar ? 'غير متاحة — الجسر مفصول' : 'UNAVAILABLE — BRIDGE OFFLINE')
                : (ar ? 'جارٍ التحقق' : 'CHECKING CONNECTION')}
          </strong>
          <small>
            {bridgeOnline === true
              ? (ar ? `${loadedTools} إجراءً محملًا من سجل الأدوات.` : `${loadedTools} actions loaded from the live manifest.`)
              : (ar ? 'لن تظهر أرقام جهاز قبل الاتصال والفحص.' : 'No device counts are shown before connection and scan.')}
          </small>
        </div>
      </section>

      <section className="software-library-services" aria-labelledby="software-services-title">
        <header>
          <span>{ar ? 'مساحات مكتبة البرامج' : 'SOFTWARE LIBRARY SERVICES'}</span>
          <h2 id="software-services-title">{ar ? 'اختر مساحة عمل' : 'Choose a workspace'}</h2>
        </header>
        <div className="software-library-service-grid">
          {family.services.map(service => {
            const Icon = SERVICE_ICONS[service.id] ?? Package;
            const count = serviceToolCount(service, tools, bridgeOnline);
            const kicker = SERVICE_KICKERS[service.id];
            return (
              <button key={service.id} type="button" onClick={() => onSelectService(service.id)} className="software-library-service-card">
                <span className="software-library-service-card__icon"><Icon size={28} /></span>
                <span className="software-library-service-card__copy">
                  <strong>{ar ? service.name.ar : service.name.en}</strong>
                  <small>{ar ? kicker.ar : kicker.en}</small>
                </span>
                <span className="software-library-service-card__count">
                  <b>{count ?? '—'}</b>
                  <small>{count === null ? (ar ? 'غير متصل' : 'not connected') : (ar ? 'إجراءات' : 'actions')}</small>
                </span>
                <ArrowRight size={21} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="software-library-shortcuts" aria-labelledby="software-shortcuts-title">
        <header>
          <span>{ar ? 'اختصارات المهام' : 'TASK SHORTCUTS'}</span>
          <h2 id="software-shortcuts-title">{ar ? 'انتقل للمساحة الصحيحة' : 'Go straight to the right workspace'}</h2>
        </header>
        <div>
          {SHORTCUTS.map(({ service, icon: Icon, en, ar: arLabel }) => (
            <button key={`${service}-${en}`} type="button" onClick={() => onSelectService(service)}>
              <Icon size={21} />
              <strong>{ar ? arLabel : en}</strong>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
        <aside>
          <CheckCircle2 size={22} />
          <p>
            <strong>{ar ? 'الاختيار ليس تنفيذًا.' : 'Selection is not execution.'}</strong>
            <span>{ar ? 'لن يغيّر KNOUX جهازك دون معاينة واضحة وتأكيدك.' : 'KNOUX will not change your device without a clear review and your confirmation.'}</span>
          </p>
          <span className="software-library-admin-state">
            {bridgeElevated ? (ar ? 'صلاحيات المدير متاحة' : 'Administrator access available') : (ar ? 'الوضع القياسي' : 'Standard access')}
          </span>
        </aside>
      </section>
    </div>
  );
}
