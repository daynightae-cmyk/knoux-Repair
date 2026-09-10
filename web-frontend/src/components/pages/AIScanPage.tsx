import { Sparkles, ArrowRight, ArrowLeft, ShieldCheck, Activity, Database, Shield, Package, Code2, Search } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { FAMILIES } from '../../data/family-map';
import type { NavDestination } from '../../data/family-map';

export interface AIScanPageProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  toolCount: number | null;
  onNavigate: (dest: NavDestination) => void;
}

const FAMILY_ICONS: Record<string, React.ElementType> = {
  vitality: Activity,
  recovery: Database,
  assurance: Shield,
  software: Package,
  workbench: Code2,
  investigation: Search,
};

export default function AIScanPage({
  lang,
  bridgeOnline,
  toolCount,
  onNavigate
}: AIScanPageProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Hero / AI Scanner Orb */}
      <div className="flex flex-col items-center text-center">
        <div className="relative w-36 h-36 mb-6 flex items-center justify-center">
          {/* Animated halo rings */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="absolute inset-2 border border-cyan-500/30 rounded-full animate-spin" style={{ animationDuration: '15s' }} />
          <div className="absolute inset-4 border border-violet-500/40 rounded-full animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />
          
          <motion.div 
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-full bg-slate-950/80 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,238,0.35)] backdrop-blur-xl z-10"
          >
            <Sparkles size={40} className="text-cyan-400" />
          </motion.div>
        </div>

        <h1 className="text-4xl font-black text-white mb-3 tracking-tight font-display">
          KNOUX <span className="text-cyan-400">AI Scan</span>
        </h1>
        <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed mb-6">
          {isRtl 
            ? 'نظام الفحص والتوجيه الاستراتيجي. تشخيص عميق للبنية التحتية يوجهك إلى العائلة والخدمة الدقيقة لحل المشكلة دون تكرار.'
            : 'Autonomous diagnostic and system guidance engine. Evaluates health metrics and deep-links directly into canonical repair families.'}
        </p>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => onNavigate({ family: 'vitality', service: '01-System-Maintenance' })}
            className="knoux-btn knoux-btn-primary px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2.5 shadow-[0_0_25px_rgba(124,58,237,0.4)] hover:shadow-[0_0_35px_rgba(124,58,237,0.6)] cursor-pointer"
          >
            <Sparkles size={16} />
            <span>{isRtl ? 'بدء فحص الحيوية الشامل' : 'Start Vitality Scan'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ family: 'recovery', service: '02-System-Cleanup' })}
            className="knoux-btn knoux-btn-secondary px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer"
          >
            {isRtl ? 'فحص التخزين والاسترداد' : 'Inspect Storage'}
          </button>
        </div>

        {/* Engine Status Tag */}
        <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className={clsx("w-2 h-2 rounded-full", bridgeOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-400")} />
          <span>
            {bridgeOnline 
              ? `${isRtl ? 'محرك الفحص نشط' : 'Diagnostic Engine Ready'} (${toolCount ?? 158} ${isRtl ? 'أداة مسجلة' : 'canonical tools'})` 
              : (isRtl ? 'الجسر المحلي مفصول' : 'Local Bridge Offline')}
          </span>
        </div>
      </div>

      {/* Strategic Entry Points - Deep-link Cards */}
      <div>
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldCheck size={18} className="text-cyan-400" />
            <span>{isRtl ? 'عائلات الإصلاح الست' : 'Six Canonical Repair Families'}</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {isRtl ? '18 خدمة متخصصة' : '18 Dedicated Services'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FAMILIES.map((fam) => {
            const Icon = FAMILY_ICONS[fam.id] || Activity;
            return (
              <button
                key={fam.id}
                type="button"
                onClick={() => onNavigate({ family: fam.id })}
                className="p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-cyan-500/40 transition-all text-left rtl:text-right flex flex-col group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="p-2.5 rounded-xl bg-white/[0.05] group-hover:bg-cyan-500/20 group-hover:text-cyan-300 text-slate-300 transition-colors">
                    <Icon size={20} />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.06]">
                    {fam.expectedTools} {isRtl ? 'أداة' : 'tools'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-cyan-300 transition-colors">
                  {isRtl ? fam.name.ar : fam.name.en}
                </h3>
                
                <p className="text-xs text-slate-400 leading-relaxed mb-4 flex-1">
                  {isRtl ? fam.tagline.ar : fam.tagline.en}
                </p>

                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
                  <span>{isRtl ? 'فتح مساحة العمل' : 'Enter Workspace'}</span>
                  {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
