import { ArrowRight, ArrowLeft } from 'lucide-react';
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
  onExplore?: () => void;
}

const FAMILY_OVERVIEWS: Record<string, {
  tagEn: string;
  tagAr: string;
  sloganEn: string;
  sloganAr: string;
  descEn: string;
  descAr: string;
  ctaEn: string;
  ctaAr: string;
  gradient: string;
  accentBorder: string;
}> = {
  vitality: {
    tagEn: 'SYSTEM VITALITY • OPTIMIZE • PERFORM • STAY AHEAD',
    tagAr: 'حيوية النظام • تحسين • أداء • استباقية',
    sloganEn: 'A Healthier PC. A Smoother You.',
    sloganAr: 'حاسوب أكثر كفاءة وسلاسة واستقراراً.',
    descEn: 'Keep your system clean, optimized and running at its best. 26 specialist tools to maintain, boost performance and monitor your PC in real time.',
    descAr: 'حافظ على نظافة نظامك وتحسينه وتشغيله بأفضل أداء. أدوات متخصصة للصيانة ورفع الكفاءة والمراقبة اللحظية.',
    ctaEn: 'Check PC Health',
    ctaAr: 'فحص صحة النظام',
    gradient: 'radial-gradient(ellipse 75% 70% at 85% 45%, rgba(124,58,237,0.22) 0%, transparent 70%), radial-gradient(ellipse 55% 55% at 15% 55%, rgba(34,211,238,0.14) 0%, transparent 60%)',
    accentBorder: 'rgba(124,58,237,0.3)',
  },
  recovery: {
    tagEn: 'RECOVERY & STORAGE • CLEAN • PROTECT • RESTORE',
    tagAr: 'الاستعادة والتخزين • تنظيف • حماية • استرداد',
    sloganEn: 'Clean. Protect. Recover. Keep What Matters.',
    sloganAr: 'تنظيف. حماية. استعادة. حماية ما يهمك.',
    descEn: 'Free up space, remove junk, eliminate duplicates and keep your data safe — with powerful recovery tools built for peace of mind.',
    descAr: 'تحرير المساحة، إزالة المخلفات، التخلص من الملفات المكررة والحفاظ على أمان بياناتك عبر أدوات استعادة فائقة الدقة.',
    ctaEn: 'Explore Recovery',
    ctaAr: 'استكشاف الاستعادة',
    gradient: 'radial-gradient(ellipse 75% 70% at 85% 45%, rgba(6,182,212,0.22) 0%, transparent 70%), radial-gradient(ellipse 55% 55% at 15% 55%, rgba(14,165,233,0.14) 0%, transparent 60%)',
    accentBorder: 'rgba(6,182,212,0.3)',
  },
  assurance: {
    tagEn: 'ASSURANCE • CONNECT • SECURE • PRIVACY',
    tagAr: 'الضمان والحماية • اتصال • أمان • خصوصية',
    sloganEn: 'Stronger Connections. Safer Devices. More Privacy.',
    sloganAr: 'اتصالات أقوى، أجهزة أكثر أماناً، وخصوصية تامة.',
    descEn: 'Comprehensive tools to keep your PC connected, protected, private and ready — today and tomorrow.',
    descAr: 'منظومة شاملة لضمان اتصال حاسوبك وأمانه وخصوصيته وجاهزيته الدائمة في كافة الظروف.',
    ctaEn: 'Run Assurance',
    ctaAr: 'بدء فحص الحماية',
    gradient: 'radial-gradient(ellipse 75% 70% at 85% 45%, rgba(16,185,129,0.2) 0%, transparent 70%), radial-gradient(ellipse 55% 55% at 15% 55%, rgba(34,211,238,0.14) 0%, transparent 60%)',
    accentBorder: 'rgba(16,185,129,0.3)',
  },
  software: {
    tagEn: 'EXPLORE • INSTALL • CONFIGURE • RUNTIMES',
    tagAr: 'استكشاف • تثبيت • تكوين • بيئات تشغيل',
    sloganEn: 'Programs. Environments. Setup. All in One Place.',
    sloganAr: 'البرامج. بيئات التشغيل. الإعداد. في مكان واحد.',
    descEn: 'Discover, manage, and set up the software your PC needs. From essential apps to runtime environments and post-install configuration.',
    descAr: 'إدارة وتثبيت وضبط البرامج التي يحتاجها حاسوبك، من التطبيقات الأساسية وبيئات التشغيل حتى تهيئة ما بعد التثبيت.',
    ctaEn: 'Browse Library',
    ctaAr: 'تصفح المكتبة',
    gradient: 'radial-gradient(ellipse 75% 70% at 85% 45%, rgba(168,85,247,0.22) 0%, transparent 70%), radial-gradient(ellipse 55% 55% at 15% 55%, rgba(236,72,153,0.14) 0%, transparent 60%)',
    accentBorder: 'rgba(168,85,247,0.3)',
  },
  workbench: {
    tagEn: 'ENGINEERING WORKBENCH • BUILD SMARTER • SHIP SAFER',
    tagAr: 'ورشة الهندسة • بناء أذكى • نشر أكثر أماناً',
    sloganEn: 'Build Smarter. Ship Safer. Complete Command.',
    sloganAr: 'بناء أذكى، نشر أكثر أماناً، وتحكم شامل.',
    descEn: 'Your complete development command center. Analyze dependencies, resolve port collisions, inspect runtimes and optimize workspace code.',
    descAr: 'مركز قيادة التطوير المتكامل. تحليل التبعيات، حل تعارض المنافذ، تدقيق بيئات العمل وتحسين كود المشاريع البرمجية.',
    ctaEn: 'Open Workbench',
    ctaAr: 'فتح ورشة العمل',
    gradient: 'radial-gradient(ellipse 75% 70% at 85% 45%, rgba(124,58,237,0.22) 0%, transparent 70%), radial-gradient(ellipse 55% 55% at 15% 55%, rgba(59,130,246,0.14) 0%, transparent 60%)',
    accentBorder: 'rgba(124,58,237,0.3)',
  },
  investigation: {
    tagEn: 'INVESTIGATION • OBSERVE • ANALYZE • UNCOVER',
    tagAr: 'التحقيق والتشخيص • مراقبة • تحليل • كشف الحقائق',
    sloganEn: "See What's Really Happening. Find the Truth.",
    sloganAr: 'اكتشف ما يحدث بدقة، واكشف الحقائق بالأدلة.',
    descEn: 'Deep diagnostics, event telemetry, process analysis and hardware reports. Clear evidence and actionable insights.',
    descAr: 'تشخيص عميق، تتبع سجلات الأحداث، فحص العمليات والخدمات، وتقارير العتاد ببيانات حقيقية وقابلة للتنفيذ.',
    ctaEn: 'Start Investigation',
    ctaAr: 'بدء التحقيق',
    gradient: 'radial-gradient(ellipse 75% 70% at 85% 45%, rgba(59,130,246,0.22) 0%, transparent 70%), radial-gradient(ellipse 55% 55% at 15% 55%, rgba(34,211,238,0.14) 0%, transparent 60%)',
    accentBorder: 'rgba(59,130,246,0.3)',
  },
};

export default function HeroSection({ family, totalTools, lang, systemSnapshot, onExplore }: HeroSectionProps) {
  const isRtl = lang === 'ar';
  const overview = FAMILY_OVERVIEWS[family.id] ?? FAMILY_OVERVIEWS.vitality;

  return (
    <div
      className="knoux-hero relative rounded-2xl border p-6 md:p-8 overflow-hidden bg-[#070b1e]/90 backdrop-blur-xl shadow-2xl min-h-[300px]"
      style={{
        backgroundImage: overview.gradient,
        borderColor: overview.accentBorder,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Background Technical Grid Spanning Across Card */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* Main Composed Banner Layout */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 w-full">
        {/* Left Column: Typography, Benefit Slogan & Action (52% width) */}
        <div className="w-full lg:basis-[52%] lg:max-w-[52%] flex flex-col justify-center space-y-3.5 shrink-0">
          {/* Eyebrow / Category Tag */}
          <div className="inline-flex items-center gap-2 text-[10px] md:text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22D3EE]" />
            {isRtl ? overview.tagAr : overview.tagEn}
          </div>

          {/* Family Title & Slogan */}
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-display">
              {isRtl ? family.name.ar : family.name.en}
            </h1>
            <p className="text-sm md:text-base font-semibold text-cyan-200/90 mt-1">
              {isRtl ? overview.sloganAr : overview.sloganEn}
            </p>
          </div>

          {/* Body Description */}
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-lg">
            {isRtl ? overview.descAr : overview.descEn}
          </p>

          {/* Action Row: Primary CTA + Badges */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExplore}
              className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all cursor-pointer hover:scale-102 active:scale-98"
            >
              <span>{isRtl ? overview.ctaAr : overview.ctaEn}</span>
              {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
            </button>

            <span className="px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-xs font-bold text-cyan-300">
              {totalTools} {isRtl ? 'أداة مسجلة' : 'Registered Tools'}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-xs font-semibold text-violet-300">
              {family.services.length} {isRtl ? 'خدمات فرعية' : 'Services'}
            </span>
          </div>
        </div>

        {/* Right Column: True Cinematic Holographic Visual Scene (48% width, min 420px) */}
        <div className="w-full lg:basis-[48%] lg:max-w-[48%] lg:min-w-[420px] flex items-center justify-center overflow-visible">
          {family.id === 'vitality' && <VitalityHoloVisual lang={lang} systemSnapshot={systemSnapshot} />}
          {family.id === 'recovery' && <RecoveryHoloVisual lang={lang} />}
          {family.id === 'assurance' && <AssuranceHoloVisual lang={lang} systemSnapshot={systemSnapshot} />}
          {family.id === 'software' && <SoftwareHoloVisual lang={lang} />}
          {family.id === 'workbench' && <WorkbenchHoloVisual lang={lang} />}
          {family.id === 'investigation' && <InvestigationHoloVisual lang={lang} systemSnapshot={systemSnapshot} />}
        </div>
      </div>
    </div>
  );
}
