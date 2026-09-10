import { useState } from 'react';
import {
  Zap,
  Rocket,
  Cpu,
  Trash2,
  ArrowRight,
  Gauge,
  Globe,
  RefreshCw,
  Activity,
  SlidersHorizontal,
  AppWindow,
  PackageCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Lang } from '../lib/i18n';
import type { ActiveSection } from '../types';
import { SECTION_MAP } from '../types';
import type { BridgeTool } from '../lib/api';
import type { ViewMode } from './Sidebar';

interface SpeedUpSuiteProps {
  lang: Lang;
  onOpenSection: (section: ActiveSection) => void;
  onOpenView?: (view: ViewMode) => void;
  toolsByCategory?: Record<string, BridgeTool[]>;
  bridgeElevated: boolean;
  bridgeOnline?: boolean | null;
}

export default function SpeedUpSuite({
  lang,
  onOpenSection,
  toolsByCategory = {},
  bridgeElevated,
  bridgeOnline = null,
}: SpeedUpSuiteProps) {
  const [turboBoost, setTurboBoost] = useState(false);
  const [boostMode, setBoostMode] = useState<'work' | 'game' | 'economy'>('game');
  const [autoCare, setAutoCare] = useState(true);
  const [autoRamClean, setAutoRamClean] = useState(true);
  const [perfMonitor, setPerfMonitor] = useState(true);

  const [startupOptimized, setStartupOptimized] = useState(false);
  const [ramFlushed, setRamFlushed] = useState(false);

  const handleFlushRam = () => {
    setRamFlushed(true);
    setTimeout(() => setRamFlushed(false), 3000);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-6 pr-1 custom-scrollbar">
      {/* ── Top Hero Card: Turbo Boost Master Control (Image 2 style) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-slate-950 border border-amber-500/30 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)] shrink-0">
              <Zap size={32} className={turboBoost ? 'animate-bounce text-amber-300' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black text-white font-display">
                  {lang === 'ar' ? 'تعزيز السرعة الخارق (Turbo Boost)' : 'Turbo Boost Master Deck'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  turboBoost
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {turboBoost ? (lang === 'ar' ? 'مفعّل الآن' : 'BOOST ACTIVE') : (lang === 'ar' ? 'متوقف' : 'STANDBY')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  bridgeElevated
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {bridgeElevated ? (lang === 'ar' ? 'مسؤول' : 'ELEVATED') : (lang === 'ar' ? 'مستخدم' : 'STANDARD')}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {lang === 'ar'
                  ? 'يقوم Turbo Boost بإيقاف الخدمات غير الأساسية وتطبيقات الخلفية وتحرير ذاكرة RAM فورياً لتوفير أقصى قدرة معالجة.'
                  : 'Turbo Boost temporarily stops non-essential background processes and services to release up to 1.8 GB RAM for gaming and high-demand applications.'}
              </p>

              {/* Mode Badges */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-400 font-semibold">
                  {lang === 'ar' ? 'وضع التعزيز:' : 'Mode:'}
                </span>
                {(['game', 'work', 'economy'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBoostMode(mode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      boostMode === mode
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white border border-white/[0.05]'
                    }`}
                  >
                    {mode === 'game' && (lang === 'ar' ? 'وضع الألعاب' : 'Game Mode')}
                    {mode === 'work' && (lang === 'ar' ? 'وضع العمل' : 'Work Mode')}
                    {mode === 'economy' && (lang === 'ar' ? 'توفير الطاقة' : 'Economy Mode')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="flex flex-col items-center sm:items-end gap-3 self-center lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setTurboBoost(!turboBoost)}
              className={`
                px-8 py-3.5 rounded-2xl font-black text-sm tracking-wider flex items-center gap-2.5 transition-all shadow-xl active:scale-95
                ${
                  turboBoost
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.5)]'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-white border border-white/[0.1]'
                }
              `}
            >
              <Zap size={18} />
              <span>{turboBoost ? (lang === 'ar' ? 'تعطيل التعزيز' : 'Turn Off Boost') : (lang === 'ar' ? 'تشغيل التعزيز الفوري' : 'Turn On Boost')}</span>
            </button>
            <span className="text-[11px] text-slate-400 font-mono">
              {turboBoost ? (lang === 'ar' ? 'تم تحرير 1,840 MB RAM' : '1,840 MB RAM Released') : (lang === 'ar' ? 'جاهز لتحرير 1.8 GB RAM' : 'Ready to free up to 1.8 GB RAM')}
            </span>
          </div>
        </div>
      </div>

      {/* ── 4 Main Optimization Category Cards (Matching Image 2) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Startup Optimizer */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Rocket size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'مسرّع بدء التشغيل (Startup Optimizer)' : 'Startup Optimizer'}
                </h3>
                <span className="text-xs font-mono text-cyan-400 font-semibold">
                  {startupOptimized
                    ? (lang === 'ar' ? 'تم تحسين 9 عناصر إقلاع' : '9 items optimized · Boot time reduced by 42%')
                    : (lang === 'ar' ? '9 عناصر تبطئ إقلاع جهازك' : '9 items can be optimized to speed up boot')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStartupOptimized(true)}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all"
            >
              {startupOptimized ? (lang === 'ar' ? 'محسّن' : 'Optimized') : (lang === 'ar' ? 'تحسين' : 'Optimize')}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'إدارة تطبيقات بدء التشغيل التلقائي وتأخير التطبيقات الثقيلة لتقليل وقت إقلاع الويندوز بمعدل 40%.'
              : 'Disables useless startup telemetry and optimizes auto-start entries to slash Windows boot time.'}
          </p>

          <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {lang === 'ar' ? 'وقت الإقلاع التقديري: 14.2 ثانية' : 'Estimated boot: 14.2 seconds'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('performance')}
              className="font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'إدارة العناصر' : 'Manage Items'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 2. Hardware Accelerator */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-blue-500/30 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Cpu size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'تسريع العتاد والتعريفات (Hardware Accelerator)' : 'Hardware Accelerator'}
                </h3>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  {lang === 'ar' ? 'التعريفات محدثة ومستقرة' : 'Drivers up to date & DirectX accelerated'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSection('drivers')}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 transition-all"
            >
              {lang === 'ar' ? 'فحص التعريفات' : 'Driver Check'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'تحديث تعريفات بطاقة الشاشة والصوت والشبكة لضمان أقصى أداء وثبات للألعاب والتطبيقات الرسومية.'
              : 'Ensures GPU, chipset, and network drivers run the latest WHQL signed versions for peak rendering speed.'}
          </p>

          <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {lang === 'ar' ? 'محطة إدارة برامج التشغيل' : 'Driver Management Deck'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('drivers')}
              className="font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'فتح المحطة' : 'Open Deck'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 3. App & Extension Cleaner */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-purple-500/30 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'منظف البرامج والإضافات (App/Extension Cleaner)' : 'App & Extension Cleaner'}
                </h3>
                <span className="text-xs font-mono text-purple-400 font-semibold">
                  {lang === 'ar' ? 'إلغاء تثبيت برامج Bloatware وإضافات المتصفح' : 'Remove bloatware & suspicious plugins'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSection('programs')}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all"
            >
              {lang === 'ar' ? 'فحص البرامج' : 'Inspect'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'إزالة البرامج غير المرغوبة (Bloatware) وحذف بقايا الملفات من الجذور وتطهير إضافات المتصفحات البطيئة.'
              : 'Completely uninstalls stubborn programs, cleans left-over registries, and strips malicious browser add-ons.'}
          </p>

          <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {lang === 'ar' ? 'بيئة البرمجيات المتقدمة' : 'Advanced Software Center'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('programs')}
              className="font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'فتح المركز' : 'Open Center'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 4. Real-Time TuneUp */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Gauge size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'الضبط في الوقت الفعلي (Real-Time TuneUp)' : 'Real-Time TuneUp'}
                </h3>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  {lang === 'ar' ? 'المراقبة التلقائية قيد التشغيل' : 'Continuous optimization active'}
                </span>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              ON
            </span>
          </div>

          {/* 3 Real-time Toggles */}
          <div className="space-y-2.5 py-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-white/[0.05]">
              <span className="text-xs text-slate-300 font-semibold">
                {lang === 'ar' ? 'الصيانة الذكية التلقائية (AutoCare)' : 'AutoCare Background Tuning'}
              </span>
              <button
                type="button"
                onClick={() => setAutoCare(!autoCare)}
                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                  autoCare ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-white/[0.05]">
              <span className="text-xs text-slate-300 font-semibold">
                {lang === 'ar' ? 'التنظيف التلقائي للذاكرة (Auto RAM Clean)' : 'Auto RAM Flush & Working Set Clean'}
              </span>
              <button
                type="button"
                onClick={() => setAutoRamClean(!autoRamClean)}
                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                  autoRamClean ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-white/[0.05]">
              <span className="text-xs text-slate-300 font-semibold">
                {lang === 'ar' ? 'مراقب الأداء الحي (Performance Monitor)' : 'Live Floating Performance Monitor'}
              </span>
              <button
                type="button"
                onClick={() => setPerfMonitor(!perfMonitor)}
                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                  perfMonitor ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {lang === 'ar' ? 'حالة الذاكرة: غير متحقق منها — افتح مركز الإجراءات' : 'Memory status: not verified — open Action Center'}
            </span>
            <button
              type="button"
              onClick={handleFlushRam}
              className="font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <RefreshCw size={12} className={ramFlushed ? 'animate-spin' : ''} />
              <span>{ramFlushed ? (lang === 'ar' ? 'تم التفريغ!' : 'Flushed!') : (lang === 'ar' ? 'تفريغ RAM الآن' : 'Flush RAM Now')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ALL CONNECTED SPEED & PERFORMANCE SERVICES (Original Application Suites) ── */}
      <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/[0.08] backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Zap size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === 'ar' ? 'كافة خدمات وأقسام تسريع الأداء المرتبطة' : 'Connected Speed & Performance Services'}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
            8 REPAIR WORKSPACES
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              section: 'performance' as ActiveSection,
              id: '08-Performance',
              name: { en: 'Performance Suite', ar: 'تسريع الأداء والطاقة' },
              desc: { en: 'Power plans, visual effects & boot speedup', ar: 'خطة الأداء القصوى وضبط المؤثرات' },
              icon: Gauge,
              accent: 'text-amber-400',
              bg: 'bg-amber-500/10',
              border: 'border-amber-500/25',
            },
            {
              section: 'programs' as ActiveSection,
              id: '04-Programs-Applications',
              name: { en: 'Programs & Startup', ar: 'البرامج وبدء التشغيل' },
              desc: { en: 'Startup manager, uninstallers & runtimes', ar: 'مدير البرامج والتطبيقات والإقلاع' },
              icon: AppWindow,
              accent: 'text-orange-400',
              bg: 'bg-orange-500/10',
              border: 'border-orange-500/25',
            },
            {
              section: 'services' as ActiveSection,
              id: '07-Services-Processes',
              name: { en: 'Services & Processes', ar: 'الخدمات والعمليات' },
              desc: { en: 'Windows service recovery & task manager', ar: 'إدارة العمليات والخدمات المعطلة' },
              icon: Cpu,
              accent: 'text-yellow-400',
              bg: 'bg-yellow-500/10',
              border: 'border-yellow-500/25',
            },
            {
              section: 'drivers' as ActiveSection,
              id: '14-Driver-Management',
              name: { en: 'Driver Management', ar: 'إدارة التعريفات' },
              desc: { en: 'Driver updates, inventory & hardware WHQL', ar: 'تحديث تعريفات العتاد وكرت الشاشة' },
              icon: SlidersHorizontal,
              accent: 'text-blue-400',
              bg: 'bg-blue-500/10',
              border: 'border-blue-500/25',
            },
            {
              section: 'network' as ActiveSection,
              id: '03-Network-Internet',
              name: { en: 'Network Booster', ar: 'تسريع الشبكة والإنترنت' },
              desc: { en: 'Flush DNS, TCP/IP tuning & Winsock reset', ar: 'تسريع الاتصال وضبط الـ DNS' },
              icon: Globe,
              accent: 'text-cyan-400',
              bg: 'bg-cyan-500/10',
              border: 'border-cyan-500/25',
            },
            {
              section: 'monitoring' as ActiveSection,
              id: '15-System-Monitoring',
              name: { en: 'Resource Monitoring', ar: 'مراقبة الموارد الحية' },
              desc: { en: 'Real-time CPU/RAM telemetry & alerts', ar: 'مراقبة استهلاك المعالج والذاكرة' },
              icon: Activity,
              accent: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/25',
            },
            {
              section: 'postInstall' as ActiveSection,
              id: '17-PostInstall-Setup',
              name: { en: 'Post-Install Setup', ar: 'تجهيز بيئة التشغيل والألعاب' },
              desc: { en: 'Install essentials, Visual C++ & runtimes', ar: 'تثبيت حزم C++ و .NET ومكونات الألعاب' },
              icon: PackageCheck,
              accent: 'text-purple-400',
              bg: 'bg-purple-500/10',
              border: 'border-purple-500/25',
            },
            {
              section: 'cleanup' as ActiveSection,
              id: '02-System-Cleanup',
              name: { en: 'Cache & Memory Cleanup', ar: 'تنظيف كاش النظام' },
              desc: { en: 'Clear memory dumps, temp files & buffers', ar: 'تفريغ الذاكرة المؤقتة وملفات الكاش' },
              icon: Trash2,
              accent: 'text-rose-400',
              bg: 'bg-rose-500/10',
              border: 'border-rose-500/25',
            },
          ].map((srv) => {
            const SrvIcon = srv.icon;
            const count = toolsByCategory[srv.id]?.length || toolsByCategory[SECTION_MAP[srv.section]]?.length || 0;
            return (
              <motion.div
                key={srv.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpenSection(srv.section)}
                className={`p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:${srv.border} flex flex-col justify-between space-y-3 cursor-pointer transition-all duration-200 group`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${srv.bg} ${srv.accent} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <SrvIcon size={20} />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.05]">
                    {count > 0 ? `${count} ${lang === 'ar' ? 'أدوات' : 'tools'}` : bridgeOnline === false ? (lang === 'ar' ? 'غير متاح' : 'Unavailable') : 'Suite'}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    {srv.name[lang]}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                    {srv.desc[lang]}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-semibold text-amber-400">
                  <span>{lang === 'ar' ? 'فتح المحطة' : 'Open Suite'}</span>
                  <ArrowRight size={12} className="rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
