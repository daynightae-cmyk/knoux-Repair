import React from 'react';
import {
  Activity, Database, Shield, Package, Code2, Search,
  Wrench, Gauge, Monitor, Trash2, Copy, HardDrive,
  RotateCcw, Wifi, Lock, Eye, Cpu, AppWindow, Layers,
  Download, Terminal, Radar, ArrowRight, ArrowLeft
} from 'lucide-react';
import { FAMILIES } from '../../data/family-map';
import type { NavDestination, FamilyId, ServiceId } from '../../data/family-map';

export interface AllServicesNavigatorProps {
  lang: 'en' | 'ar';
  onNavigate: (dest: NavDestination) => void;
}

const FAMILY_ICONS: Record<FamilyId, React.ElementType> = {
  'ai-scan': Activity,
  'vitality': Activity,
  'recovery': Database,
  'assurance': Shield,
  'software': Package,
  'workbench': Code2,
  'investigation': Search,
  'navigator': Package,
};

const SERVICE_ICONS: Record<ServiceId, React.ElementType> = {
  '01-System-Maintenance': Wrench,
  '02-System-Cleanup': Trash2,
  '03-Network-Internet': Wifi,
  '04-Programs-Applications': AppWindow,
  '05-Duplicate-Files': Copy,
  '06-Disk-Space': HardDrive,
  '07-Services-Processes': Monitor,
  '08-Performance': Gauge,
  '09-Security': Lock,
  '10-Diagnostics-Reports': Search,
  '11-Backup-Recovery': RotateCcw,
  '12-Developer-Tools': Terminal,
  '13-Privacy': Eye,
  '14-Driver-Management': Cpu,
  '15-System-Monitoring': Activity,
  '16-Software-Environment': Layers,
  '17-PostInstall-Setup': Download,
  '18-Project-Sonar': Radar,
};

const FAMILY_THEMES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  vitality: {
    border: 'border-violet-500/30 hover:border-violet-500/60',
    bg: 'from-violet-950/20 to-slate-950/60',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    text: 'text-violet-400',
  },
  recovery: {
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    bg: 'from-cyan-950/20 to-slate-950/60',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    text: 'text-cyan-400',
  },
  assurance: {
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    bg: 'from-emerald-950/20 to-slate-950/60',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    text: 'text-emerald-400',
  },
  software: {
    border: 'border-pink-500/30 hover:border-pink-500/60',
    bg: 'from-pink-950/20 to-slate-950/60',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    text: 'text-pink-400',
  },
  workbench: {
    border: 'border-amber-500/30 hover:border-amber-500/60',
    bg: 'from-amber-950/20 to-slate-950/60',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    text: 'text-amber-400',
  },
  investigation: {
    border: 'border-blue-500/30 hover:border-blue-500/60',
    bg: 'from-blue-950/20 to-slate-950/60',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    text: 'text-blue-400',
  },
};

export default function AllServicesNavigator({ lang, onNavigate }: AllServicesNavigatorProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="max-w-6xl mx-auto space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Banner (Matching P0-09 Header) */}
      <div className="relative rounded-2xl border border-white/10 p-6 bg-gradient-to-r from-[#0d1433]/90 via-[#0a0f28]/90 to-[#0e173a]/90 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] md:text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase mb-1">
            {isRtl ? 'مستعرض الخدمات الشامل • البنية المعتمدة' : 'ALL SERVICES NAVIGATOR'}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-display mb-1">
            {isRtl ? (
              <>كل ما يحتاجه حاسوبك. <span className="text-cyan-400">في مكان واحد.</span></>
            ) : (
              <>Everything Your PC Needs. <span className="text-cyan-400">In One Place.</span></>
            )}
          </h1>
          <p className="text-xs md:text-sm text-slate-300 font-mono">
            {isRtl
              ? '6 عائلات إصلاح • 18 خدمة متخصصة • 158 أداة موثوقة • نحو غد أكثر صحة.'
              : '6 service families • 18 services • 158 professional tools • A healthier tomorrow.'}
          </p>
        </div>

        <div className="text-[9px] font-mono tracking-widest text-slate-400 uppercase md:text-right flex flex-wrap gap-2 md:block">
          <div>EXPLORE • MAINTAIN</div>
          <div>OPTIMIZE • RECOVER</div>
          <div>SECURE • GO FURTHER</div>
        </div>
      </div>

      {/* 6 Canonical Families Grid (3 Columns x 2 Rows, Matching P0-09) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {FAMILIES.map((family) => {
          const FamilyIcon = FAMILY_ICONS[family.id] || Activity;
          const theme = FAMILY_THEMES[family.id] ?? FAMILY_THEMES.vitality;

          return (
            <div
              key={family.id}
              className={`rounded-2xl border ${theme.border} bg-gradient-to-b ${theme.bg} p-5 backdrop-blur-md shadow-lg flex flex-col justify-between transition-all hover:shadow-2xl`}
            >
              {/* Family Card Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-white/5 ${theme.text}`}>
                      <FamilyIcon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">
                        {isRtl ? family.name.ar : family.name.en}
                      </h2>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {family.services.length} {isRtl ? 'خدمات' : 'Services'}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${theme.badge}`}>
                    {family.expectedTools} {isRtl ? 'أداة' : 'tools'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isRtl ? family.tagline.ar : family.tagline.en}
                </p>
              </div>

              {/* Service List in this Family */}
              <div className="space-y-2 border-t border-white/10 pt-3 flex-1">
                {family.services.map((service) => {
                  const ServiceIcon = SERVICE_ICONS[service.id] || Wrench;

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => onNavigate({ family: family.id, service: service.id })}
                      className="w-full p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all flex items-center justify-between group cursor-pointer text-left rtl:text-right"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 rtl:pr-0 rtl:pl-2">
                        <div className="text-slate-400 group-hover:text-cyan-400 transition-colors shrink-0">
                          <ServiceIcon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                            {isRtl ? service.name.ar : service.name.en}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                            {isRtl ? service.purpose.ar : service.purpose.en}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-400 group-hover:text-cyan-400 shrink-0">
                        <span>{service.expectedTools}</span>
                        {isRtl ? (
                          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                        ) : (
                          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
