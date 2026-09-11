import type { FamilyDefinition } from '../../data/family-map';
import type { SystemSnapshot } from '../../lib/api';
import {
  VitalityHoloVisual,
  RecoveryHoloVisual,
  AssuranceHoloVisual,
  SoftwareHoloVisual,
  WorkbenchHoloVisual,
  InvestigationHoloVisual,
} from './HeroVisuals';

interface HeroSectionProps {
  family: FamilyDefinition;
  totalTools: number;
  lang: 'en' | 'ar';
  systemSnapshot?: SystemSnapshot | null;
}

const FAMILY_OVERVIEWS: Record<string, { tagEn: string; tagAr: string; descEn: string; descAr: string; gradient: string }> = {
  vitality: {
    tagEn: 'SYSTEM VITALITY • OPTIMIZE • PERFORM • STAY AHEAD',
    tagAr: 'حيوية النظام • تحسين • أداء • استباقية',
    descEn: 'Keep your system clean, optimized and running at its best. Specialist tools to maintain, boost performance and monitor your PC in real time.',
    descAr: 'حافظ على نظافة نظامك وتحسينه وتشغيله بأفضل أداء. أدوات متخصصة للصيانة ورفع الكفاءة والمراقبة اللحظية.',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(124,58,237,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(34,211,238,0.12) 0%, transparent 50%)',
  },
  recovery: {
    tagEn: 'RECOVERY & STORAGE • CLEAN • PROTECT • RESTORE',
    tagAr: 'الاستعادة والتخزين • تنظيف • حماية • استرداد',
    descEn: 'Free up space, remove junk, eliminate duplicates and keep your data safe — with powerful recovery tools built for peace of mind.',
    descAr: 'تحرير المساحة، إزالة المخلفات، التخلص من الملفات المكررة والحفاظ على أمان بياناتك عبر أدوات استعادة فائقة الدقة.',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(6,182,212,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(14,165,233,0.12) 0%, transparent 50%)',
  },
  assurance: {
    tagEn: 'ASSURANCE • CONNECT • SECURE • PRIVACY',
    tagAr: 'الضمان والحماية • اتصال • أمان • خصوصية',
    descEn: 'Comprehensive tools to keep your PC connected, protected, private and ready — today and tomorrow.',
    descAr: 'منظومة شاملة لضمان اتصال حاسوبك وأمانه وخصوصيته وجاهزيته الدائمة في كافة الظروف.',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(16,185,129,0.16) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(34,211,238,0.1) 0%, transparent 50%)',
  },
  software: {
    tagEn: 'EXPLORE • INSTALL • CONFIGURE • RUNTIMES',
    tagAr: 'استكشاف • تثبيت • تكوين • بيئات تشغيل',
    descEn: 'Discover, manage, and set up the software your PC needs. From essential apps to runtime environments and post-install configuration.',
    descAr: 'إدارة وتثبيت وضبط البرامج التي يحتاجها حاسوبك، من التطبيقات الأساسية وبيئات التشغيل حتى تهيئة ما بعد التثبيت.',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(168,85,247,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(236,72,153,0.12) 0%, transparent 50%)',
  },
  workbench: {
    tagEn: 'ENGINEERING WORKBENCH • BUILD SMARTER • SHIP SAFER',
    tagAr: 'ورشة الهندسة • بناء أذكى • نشر أكثر أماناً',
    descEn: 'Your complete development command center. Analyze dependencies, resolve port collisions, inspect runtimes and optimize workspace code.',
    descAr: 'مركز قيادة التطوير المتكامل. تحليل التبعيات، حل تعارض المنافذ، تدقيق بيئات العمل وتحسين كود المشاريع البرمجية.',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(124,58,237,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(59,130,246,0.12) 0%, transparent 50%)',
  },
  investigation: {
    tagEn: 'INVESTIGATION • OBSERVE • ANALYZE • UNCOVER',
    tagAr: 'التحقيق والتشخيص • مراقبة • تحليل • كشف الحقائق',
    descEn: 'Deep diagnostics, event telemetry, process analysis and hardware reports. Clear evidence and actionable insights.',
    descAr: 'تشخيص عميق، تتبع سجلات الأحداث، فحص العمليات والخدمات، وتقارير العتاد ببيانات حقيقية وقابلة للتنفيذ.',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(59,130,246,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(34,211,238,0.12) 0%, transparent 50%)',
  },
};

export default function HeroSection({ family, totalTools, lang, systemSnapshot }: HeroSectionProps) {
  const isRtl = lang === 'ar';
  const overview = FAMILY_OVERVIEWS[family.id] ?? FAMILY_OVERVIEWS.vitality;

  return (
    <div
      className="knoux-hero relative rounded-2xl border border-white/10 p-6 md:p-8 overflow-hidden bg-[#0a0f24]/80 backdrop-blur-xl shadow-2xl"
      style={{ backgroundImage: overview.gradient }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left Column: Typography & Metadata */}
        <div className="flex-1 max-w-xl">
          {/* Eyebrow / Category Tag */}
          <div className="text-[10px] md:text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase mb-2">
            {isRtl ? overview.tagAr : overview.tagEn}
          </div>

          {/* Family Title */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-display mb-2">
            {isRtl ? family.name.ar : family.name.en}
          </h1>

          {/* Headline / Tagline */}
          <p className="text-sm md:text-base font-medium text-cyan-200/90 mb-2">
            {isRtl ? family.tagline.ar : family.tagline.en}
          </p>

          {/* Body Copy */}
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-5">
            {isRtl ? overview.descAr : overview.descEn}
          </p>

          {/* Stats & Meta Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-xs font-bold text-cyan-300 shadow-sm">
              {totalTools} {isRtl ? 'أداة مسجلة' : 'Registered Tools'}
            </span>
            <span className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-xs font-semibold text-violet-300">
              {family.services.length} {isRtl ? 'خدمات فرعية' : 'Services'}
            </span>
            <span className="text-[11px] font-mono text-slate-400 ml-1">
              {isRtl ? 'تنفيذ محلي آمن ومحمي' : 'Hardened Local Execution'}
            </span>
          </div>
        </div>

        {/* Right Column: Holographic 3D Visualization */}
        <div className="flex-shrink-0 w-full lg:w-auto flex justify-center">
          {family.id === 'vitality' && <VitalityHoloVisual lang={lang} systemSnapshot={systemSnapshot} />}
          {family.id === 'recovery' && <RecoveryHoloVisual lang={lang} />}
          {family.id === 'assurance' && <AssuranceHoloVisual lang={lang} />}
          {family.id === 'software' && <SoftwareHoloVisual lang={lang} />}
          {family.id === 'workbench' && <WorkbenchHoloVisual lang={lang} />}
          {family.id === 'investigation' && <InvestigationHoloVisual lang={lang} />}
        </div>
      </div>
    </div>
  );
}
