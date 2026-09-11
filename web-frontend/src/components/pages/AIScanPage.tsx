import { useState, useCallback } from 'react';
import {
  Sparkles, ArrowRight, ArrowLeft, ShieldCheck, Activity, Database,
  Shield, Package, Code2, Search, Loader2, CheckCircle2, AlertTriangle,
  Zap, Clock, Play
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { FAMILIES } from '../../data/family-map';
import type { NavDestination, FamilyId, ServiceId } from '../../data/family-map';
import { api } from '../../lib/api';

export interface AIScanPageProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  toolCount: number | null;
  onNavigate: (dest: NavDestination) => void;
}

interface ScanFinding {
  id: string;
  severity: 'critical' | 'warning' | 'optimal';
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  metric?: string;
  dest: {
    family: FamilyId;
    service?: ServiceId;
    toolId?: string;
  };
  actionLabelEn: string;
  actionLabelAr: string;
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

  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState<string>('');
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const runDiagnosticScan = useCallback(async () => {
    if (!bridgeOnline) return;
    setScanning(true);
    setScanStage(isRtl ? 'فحص مقاييس الحيوية والأداء...' : 'Inspecting system vitals & memory pressure...');

    const discoveredFindings: ScanFinding[] = [];

    try {
      // Step 1: System snapshot
      const sysRes = await api.system().catch(() => null);
      setScanStage(isRtl ? 'فحص سعة الأقراص والنظافة العامة...' : 'Evaluating disk capacity & hygiene...');

      if (sysRes?.system) {
        const sys = sysRes.system;
        // Check RAM
        if (sys.TotalRamGB && sys.FreeRamGB !== undefined) {
          const usedGB = sys.TotalRamGB - sys.FreeRamGB;
          const ramPct = Math.round((usedGB / sys.TotalRamGB) * 100);
          if (ramPct > 85) {
            discoveredFindings.push({
              id: 'ram-pressure',
              severity: 'warning',
              titleEn: 'Elevated Memory Consumption',
              titleAr: 'استهلاك مرتفع للذاكرة العشوائية',
              detailEn: `Active memory usage is at ${ramPct}% (${usedGB.toFixed(1)} GB of ${sys.TotalRamGB.toFixed(1)} GB).`,
              detailAr: `استهلاك الذاكرة النشط وصل إلى ${ramPct}٪ (${usedGB.toFixed(1)} جيجابايت من أصل ${sys.TotalRamGB.toFixed(1)} جيجابايت).`,
              metric: `${ramPct}% RAM`,
              dest: { family: 'vitality', service: '08-Performance', toolId: 'PF01' },
              actionLabelEn: 'Optimize Performance (PF01)',
              actionLabelAr: 'تحسين الأداء (PF01)'
            });
          }
        }

        // Check System Drive
        const sysDrive = sys.Drives?.find(d => d.IsSystem || d.Name === sys.SystemDrive) ?? sys.Drives?.[0];
        if (sysDrive && sysDrive.FreeGB !== undefined && sysDrive.TotalGB) {
          const usedPct = Math.round(((sysDrive.TotalGB - sysDrive.FreeGB) / sysDrive.TotalGB) * 100);
          if (sysDrive.FreeGB < 20 || usedPct > 88) {
            discoveredFindings.push({
              id: 'disk-space-low',
              severity: sysDrive.FreeGB < 10 ? 'critical' : 'warning',
              titleEn: 'System Drive Storage Pressure',
              titleAr: 'ضغط على مساحة قرص النظام',
              detailEn: `System drive (${sysDrive.Name || 'C:'}) has ${sysDrive.FreeGB.toFixed(1)} GB free (${usedPct}% occupied).`,
              detailAr: `قرص النظام (${sysDrive.Name || 'C:'}) يتبقى به ${sysDrive.FreeGB.toFixed(1)} جيجابايت فقط (${usedPct}٪ مستغل).`,
              metric: `${sysDrive.FreeGB.toFixed(1)} GB Free`,
              dest: { family: 'recovery', service: '06-Disk-Space', toolId: 'DS01' },
              actionLabelEn: 'Audit Disk Space (DS01)',
              actionLabelAr: 'فحص مساحة القرص (DS01)'
            });
          }
        }

        // Check Windows Defender
        if (sys.DefenderRealtime === false) {
          discoveredFindings.push({
            id: 'defender-disabled',
            severity: 'critical',
            titleEn: 'Real-Time Protection Disabled',
            titleAr: 'الحماية في الوقت الفعلي معطلة',
            detailEn: 'Windows Defender real-time protection is inactive, leaving the system exposed.',
            detailAr: 'الحماية الفورية لويندوز ديفندر متوقفة حالياً، مما يجعل النظام غير محمي.',
            metric: 'Security Alert',
            dest: { family: 'assurance', service: '09-Security', toolId: 'SE04' },
            actionLabelEn: 'Check Security Posture (SE04)',
            actionLabelAr: 'فحص إعدادات الأمان (SE04)'
          });
        }
      }

      // Step 2: Cleanup preview
      setScanStage(isRtl ? 'تحليل مخلفات النظام المؤكدة...' : 'Analyzing reclaimable temporary files...');
      const cleanRes = await api.cleanupPreview().catch(() => null);

      if (cleanRes?.preview) {
        const clean = cleanRes.preview;
        const bytes = clean.Summary?.EstimatedReclaimableBytes ?? 0;
        const mb = Math.round(bytes / (1024 * 1024));
        if (mb > 500) {
          discoveredFindings.push({
            id: 'cleanup-cache-bloat',
            severity: mb > 2048 ? 'critical' : 'warning',
            titleEn: 'Safe Reclaimable Disk Space',
            titleAr: 'مساحة قابلة للاسترجاع بأمان',
            detailEn: `Found approx. ${mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`} of dispensable caches and temporary files.`,
            detailAr: `تم العثور على ما يقارب ${mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجابايت` : `${mb} ميجابايت`} من الملفات المؤقتة والذاكرة المخبأة الآمن حذفها.`,
            metric: `${mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`}`,
            dest: { family: 'recovery', service: '02-System-Cleanup', toolId: 'SC01' },
            actionLabelEn: 'Clean System Junk (SC01)',
            actionLabelAr: 'تنظيف المخلفات (SC01)'
          });
        }
      }

      // Step 3: Drivers preview
      setScanStage(isRtl ? 'فحص سلامة التعريفات وتوقيعات العتاد...' : 'Verifying driver signatures & hardware stability...');
      const driverRes = await api.driversPreview().catch(() => null);

      if (driverRes?.preview) {
        const drv = driverRes.preview;
        if (drv.DeviceProblems && drv.DeviceProblems.length > 0) {
          discoveredFindings.push({
            id: 'device-hardware-problems',
            severity: 'critical',
            titleEn: 'Device Manager Hardware Faults',
            titleAr: 'أخطاء في إدارة الأجهزة والعتاد',
            detailEn: `${drv.DeviceProblems.length} hardware device(s) report error states or missing drivers.`,
            detailAr: `تم رصد ${drv.DeviceProblems.length} جهاز يعاني من تعارض أو نقص في برامج التشغيل.`,
            metric: `${drv.DeviceProblems.length} Device Alert`,
            dest: { family: 'assurance', service: '14-Driver-Management', toolId: 'DM02' },
            actionLabelEn: 'Audit Device Problems (DM02)',
            actionLabelAr: 'تشخيص أخطاء الأجهزة (DM02)'
          });
        }
      }

      setScanStage(isRtl ? 'اكتمل الفحص بنجاح' : 'Diagnostic scan complete');
      setFindings(discoveredFindings);
      setScanTimestamp(new Date().toLocaleTimeString());
    } catch {
      setFindings([]);
    } finally {
      setScanning(false);
    }
  }, [bridgeOnline, isRtl]);

  return (
    <div className="max-w-6xl mx-auto space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── 1. Hero Card: Autonomous AI Scan Command Center (Matching P0-02) ── */}
      <div className="relative rounded-2xl border border-white/10 p-6 md:p-8 bg-gradient-to-br from-[#0b1026]/90 via-[#070b1a]/90 to-[#0c122c]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Column: Heading, Search & Actions */}
          <div className="flex-1 max-w-xl">
            {/* Tag */}
            <div className="text-[10px] md:text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase mb-2">
              {isRtl
                ? `ذكاء اصطناعي • رؤى عميقة • ${toolCount ?? 158} أداة كنسية`
                : `AI POWERED • DEEP INSIGHTS • ${toolCount ?? 158} CANONICAL TOOLS`}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight font-display mb-2">
              AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400">Scan</span>
            </h1>

            {/* Headline */}
            <p className="text-base md:text-lg font-bold text-slate-100 mb-2">
              {isRtl ? 'دع KNOUX يكتشف ما يهم نظامك حقاً.' : 'Let KNOUX find what matters.'}
            </p>

            {/* Subtitle */}
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-5">
              {isRtl
                ? 'فحص ذكي للكشف عن المشاكل، وتقييم صحة الحاسوب، وتقديم حلول موجهة عبر جميع عائلات الإصلاح الكنسية دون مخاطر.'
                : "Run an intelligent scan to detect issues, assess your PC's health, and get guided solutions across all repair families."}
            </p>

            {/* Search / Prompt Query Box */}
            <div className="relative mb-5">
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-cyan-400/60 focus-within:ring-1 focus-within:ring-cyan-400/40 transition-all shadow-inner">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'صف المشكلة، أو ابحث في أدوات KNOUX...' : 'Describe an issue, or ask KNOUX anything...'}
                  className="bg-transparent border-none text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none w-full"
                />
                <Sparkles size={16} className="text-cyan-400 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex gap-2">
                <span>{isRtl ? 'أمثلة:' : 'Examples:'}</span>
                <button type="button" onClick={() => setSearchQuery('Disk space low')} className="hover:text-cyan-300 transition-colors">
                  &quot;Disk space low&quot;
                </button>
                <span>•</span>
                <button type="button" onClick={() => setSearchQuery('Slow performance')} className="hover:text-cyan-300 transition-colors">
                  &quot;Slow performance&quot;
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                type="button"
                onClick={runDiagnosticScan}
                disabled={scanning || !bridgeOnline}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                  scanning && "animate-pulse"
                )}
              >
                {scanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{isRtl ? 'جارٍ فحص النظام...' : 'Running Diagnostic Scan...'}</span>
                  </>
                ) : (
                  <>
                    <Play size={15} className="fill-white" />
                    <span>{findings ? (isRtl ? 'إعادة تشغيل الفحص' : 'Rerun AI Scan') : (isRtl ? 'بدء الفحص الذكي' : 'Start AI Scan')}</span>
                    {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onNavigate({ family: 'navigator' })}
                className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 transition-all cursor-pointer flex items-center gap-2"
              >
                <Package size={15} />
                <span>{isRtl ? 'استعراض عائلات الإصلاح' : 'Explore Repair Families'}</span>
              </button>
            </div>

            {/* Value Props Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-white/10 text-[10px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-cyan-400 shrink-0" />
                <div>
                  <b className="block text-white">FASTER</b>
                  <span className="text-slate-400">{isRtl ? 'تشخيص فوري' : 'Diagnose quickly'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                <div>
                  <b className="block text-white">SAFER</b>
                  <span className="text-slate-400">{isRtl ? 'إصلاحات موثوقة' : 'Trusted, guided'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-violet-400 shrink-0" />
                <div>
                  <b className="block text-white">SMARTER</b>
                  <span className="text-slate-400">{isRtl ? 'تحليل ذكي' : 'AI-powered'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={13} className="text-pink-400 shrink-0" />
                <div>
                  <b className="block text-white">STRONGER</b>
                  <span className="text-slate-400">{isRtl ? 'نظام أكثر متانة' : 'Healthier PC'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Large Intelligent Diagnostic Core with Orbital Rings and Data Traces */}
          <div className="relative flex items-center justify-center p-2 lg:p-4 overflow-visible">
            <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
              {/* Volumetric Radial Energy Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/25 via-violet-600/35 to-fuchsia-500/25 rounded-full blur-3xl animate-pulse" />

              {/* Orbital Scanner Rings SVG */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 280 280" fill="none">
                <defs>
                  <linearGradient id="orbRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="50%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#C084FC" />
                  </linearGradient>
                  <linearGradient id="orbPulseBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="50%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                  <filter id="orbGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Outer Concentric Static Calibration Rings */}
                <circle cx="140" cy="140" r="125" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <circle cx="140" cy="140" r="110" stroke="rgba(34,211,238,0.2)" strokeWidth="1.2" strokeDasharray="6 6" />
                <circle cx="140" cy="140" r="95" stroke="rgba(129,140,248,0.25)" strokeWidth="1.5" />

                {/* Radar/Scan Coordinate Axes */}
                <line x1="20" y1="140" x2="260" y2="140" stroke="rgba(34,211,238,0.15)" strokeDasharray="3 3" />
                <line x1="140" y1="20" x2="140" y2="260" stroke="rgba(34,211,238,0.15)" strokeDasharray="3 3" />

                {/* Inflowing Data Stream Rays */}
                <line x1="30" y1="60" x2="110" y2="120" stroke="rgba(34,211,238,0.3)" strokeWidth="1.2" strokeDasharray="4 4" />
                <line x1="250" y1="60" x2="170" y2="120" stroke="rgba(192,132,252,0.3)" strokeWidth="1.2" strokeDasharray="4 4" />
                <line x1="40" y1="220" x2="110" y2="160" stroke="rgba(34,211,238,0.3)" strokeWidth="1.2" strokeDasharray="4 4" />
                <line x1="240" y1="220" x2="170" y2="160" stroke="rgba(192,132,252,0.3)" strokeWidth="1.2" strokeDasharray="4 4" />

                {/* Tilted Elliptical Orbital Rings (Saturn Style) */}
                <ellipse
                  cx="140"
                  cy="140"
                  rx="130"
                  ry="48"
                  stroke="url(#orbRingGrad)"
                  strokeWidth="2.5"
                  transform="rotate(-25 140 140)"
                  filter="url(#orbGlow)"
                  className="opacity-90"
                />
                <ellipse
                  cx="140"
                  cy="140"
                  rx="115"
                  ry="36"
                  stroke="#22D3EE"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                  transform="rotate(35 140 140)"
                  className="opacity-75"
                />

                {/* Pulsing Energy Core */}
                <circle cx="140" cy="140" r="64" fill="rgba(11,16,38,0.92)" stroke="rgba(34,211,238,0.5)" strokeWidth="1.8" />
                <circle cx="140" cy="140" r="54" fill="none" stroke="rgba(129,140,248,0.4)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Target Lock Brackets */}
                <path d="M 115,115 L 115,105 L 125,105" stroke="#22D3EE" strokeWidth="2" fill="none" />
                <path d="M 165,115 L 165,105 L 155,105" stroke="#22D3EE" strokeWidth="2" fill="none" />
                <path d="M 115,165 L 115,175 L 125,175" stroke="#22D3EE" strokeWidth="2" fill="none" />
                <path d="M 165,165 L 165,175 L 155,175" stroke="#22D3EE" strokeWidth="2" fill="none" />
              </svg>

              {/* Central Faceted "K" Monogram */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg className="w-24 h-24 drop-shadow-[0_0_24px_rgba(129,140,248,0.95)]" viewBox="0 0 100 100" fill="none">
                  <defs>
                    <linearGradient id="kStemLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="100%" stopColor="#4F46E5" />
                    </linearGradient>
                    <linearGradient id="kStemRight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22D3EE" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                    <linearGradient id="kArmTop" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38BDF8" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                    <linearGradient id="kArmBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#A855F7" />
                      <stop offset="100%" stopColor="#6366F1" />
                    </linearGradient>
                  </defs>

                  {/* Vertical Spine Facets */}
                  <polygon points="20,15 36,15 36,85 20,85" fill="url(#kStemLeft)" />
                  <polygon points="36,15 44,22 44,78 36,85" fill="url(#kStemRight)" />

                  {/* Top Diagonal Arm Facets */}
                  <polygon points="38,50 68,18 82,18 48,54" fill="url(#kArmTop)" />
                  <polygon points="48,54 82,18 84,26 52,60" fill="url(#kStemRight)" opacity="0.8" />

                  {/* Bottom Diagonal Arm Facets */}
                  <polygon points="44,48 78,85 64,85 36,54" fill="url(#kArmBottom)" />
                  <polygon points="44,48 52,48 84,85 78,85" fill="url(#kStemRight)" opacity="0.6" />
                </svg>
              </div>

              {/* Vertical Workflow Labels: SCAN • ANALYZE • UNDERSTAND • REPAIR • TOGETHER */}
              <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5 text-[8px] font-mono tracking-widest text-cyan-300/80 uppercase select-none font-bold">
                <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-cyan-400" />SCAN</span>
                <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-indigo-400" />ANALYZE</span>
                <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-violet-400" />UNDERSTAND</span>
                <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-purple-400" />REPAIR</span>
                <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-pink-400" />TOGETHER</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scan Progress Bar (Indeterminate) */}
        {scanning && (
          <div className="w-full mt-6 space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-mono flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-cyan-400" />
                {scanStage}
              </span>
              <span className="font-mono text-cyan-400 text-[11px] tracking-wider uppercase animate-pulse">
                {isRtl ? 'جارٍ التشخيص...' : 'DIAGNOSING...'}
              </span>
            </div>
            <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full w-full bg-gradient-to-r from-cyan-500 via-violet-500 to-cyan-500 rounded-full animate-pulse"
                style={{
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Discovered Findings Section (Real Diagnostic Evidence) ── */}
      <AnimatePresence>
        {findings !== null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-cyan-400" />
                <h2 className="text-base font-bold text-white tracking-wide">
                  {isRtl ? 'نتائج الفحص والتشخيص' : 'Discovered Diagnostics & Actionable Findings'}
                </h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {findings.length} {isRtl ? 'عناصر' : 'items'}
                </span>
              </div>
              {scanTimestamp && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock size={12} />
                  <span>{scanTimestamp}</span>
                </div>
              )}
            </div>

            {findings.length === 0 ? (
              <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-emerald-300">
                  {isRtl ? 'جميع الأنظمة المفحوصة في حالة مثالية' : 'All Inspected Subsystems Operating Within Safe Limits'}
                </p>
                <p className="text-xs text-slate-400">
                  {isRtl
                    ? 'لم يتم رصد ضغط غير عادي على الذاكرة أو القرص، ومحرك الحماية يعمل بشكل طبيعي.'
                    : 'No memory exhaustion, storage pressure, or critical defender omissions detected.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {findings.map((finding) => (
                  <div
                    key={finding.id}
                    className={clsx(
                      "p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors",
                      finding.severity === 'critical'
                        ? "bg-red-500/10 border-red-500/30"
                        : finding.severity === 'warning'
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-cyan-500/10 border-cyan-500/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {finding.severity === 'critical' ? (
                          <AlertTriangle size={18} className="text-red-400" />
                        ) : finding.severity === 'warning' ? (
                          <AlertTriangle size={18} className="text-amber-400" />
                        ) : (
                          <CheckCircle2 size={18} className="text-cyan-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">
                            {isRtl ? finding.titleAr : finding.titleEn}
                          </h3>
                          {finding.metric && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                              {finding.metric}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300">
                          {isRtl ? finding.detailAr : finding.detailEn}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate(finding.dest)}
                      className={clsx(
                        "knoux-btn text-xs font-semibold px-4 py-2 rounded-lg shrink-0 flex items-center gap-2 cursor-pointer",
                        finding.severity === 'critical'
                          ? "knoux-btn-danger"
                          : "knoux-btn-secondary"
                      )}
                    >
                      <span>{isRtl ? finding.actionLabelAr : finding.actionLabelEn}</span>
                      {isRtl ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. Six Pathways Section: "AI SCAN FINDS. REPAIR FAMILIES SOLVE." ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-white/[0.08] pb-3 gap-1">
          <div>
            <h2 className="text-sm md:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <ShieldCheck size={18} className="text-cyan-400" />
              <span>{isRtl ? 'عائلات الإصلاح الست' : 'Six Canonical Repair Families'}</span>
            </h2>
            <span className="text-[10px] md:text-xs text-cyan-400 font-mono">
              {isRtl ? 'فحص واحد • ستة مسارات • غد أكثر صحة' : 'ONE SCAN • SIX PATHWAYS • A HEALTHIER TOMORROW'}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {isRtl ? '18 خدمة متخصصة • 158 أداة' : '18 Dedicated Services • 158 Tools'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
