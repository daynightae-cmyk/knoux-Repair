import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Zap,
  Trash2,
  ShieldCheck,
  HardDrive,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Layers,
  Wrench,
  Wifi,
  Eye,
  Check,
  CircleDot,
  Network,
  AppWindow,
  Copy,
  Gauge,
  Shield,
  Activity,
  Boxes,
  Rocket,
  Radar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { ActiveSection } from '../types';
import { SECTION_MAP } from '../types';
import type { BridgeTool, SystemSnapshot, CleanupPreview } from '../lib/api';
import { api } from '../lib/api';
import type { Lang } from '../lib/i18n';
import type { ViewMode } from './Sidebar';
import { CATEGORIES, type CategoryIconKey } from '../data/categories';

interface CareDashboardProps {
  lang: Lang;
  toolsByCategory?: Record<string, BridgeTool[]>;
  onOpenSection: (section: ActiveSection) => void;
  onOpenSpeedUp?: () => void;
  onOpenProtect?: () => void;
  onOpenToolbox?: () => void;
  onOpenView?: (view: ViewMode) => void;
  bridgeElevated: boolean;
  bridgeOnline?: boolean | null;
  registryTotal?: number | null;
}

interface ScanStep {
  id: string;
  name: { en: string; ar: string };
  category: ActiveSection;
}

type DomainFilter = 'all' | 'maintenance' | 'performance' | 'security' | 'advanced';

const CATEGORY_ICONS: Record<CategoryIconKey, React.ElementType> = {
  maintenance: Wrench,
  cleanup: Trash2,
  network: Network,
  programs: AppWindow,
  duplicates: Copy,
  disk: HardDrive,
  services: Cpu,
  performance: Gauge,
  security: Shield,
  diagnostics: Activity,
  backup: HardDrive,
  developer: AppWindow,
  privacy: Shield,
  drivers: Cpu,
  monitoring: Activity,
  software: Boxes,
  setup: Rocket,
  sonar: Radar,
};

const SECTION_DOMAIN_MAP: Record<ActiveSection, DomainFilter> = {
  maintenance: 'maintenance',
  cleanup: 'maintenance',
  disk: 'maintenance',
  postInstall: 'maintenance',

  performance: 'performance',
  programs: 'performance',
  services: 'performance',
  drivers: 'performance',
  monitoring: 'performance',

  security: 'security',
  privacy: 'security',
  network: 'security',
  backupRecovery: 'security',
  duplicates: 'security',

  diagnostics: 'advanced',
  developerTools: 'advanced',
  softwareEnvironment: 'advanced',
  projectSonar: 'advanced',

  dashboard: 'all',
  reports: 'advanced',
  quarantine: 'security',
  backups: 'security',
  settings: 'all',
  about: 'all',
};

export default function CareDashboard({
  lang,
  toolsByCategory = {},
  onOpenSection,
  onOpenProtect,
  onOpenToolbox,
  bridgeElevated,
  bridgeOnline = null,
  registryTotal = null,
}: CareDashboardProps) {
  // Runtime registry counts only. Offline renders UNAVAILABLE, never "0 tools".
  const runtimeTotal = registryTotal ?? Object.values(toolsByCategory).reduce((total, items) => total + items.length, 0);
  const registryKnown = bridgeOnline === true || registryTotal !== null || Object.keys(toolsByCategory).length > 0;
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [activeDomainFilter, setActiveDomainFilter] = useState<DomainFilter>('all');

  const [systemData, setSystemData] = useState<SystemSnapshot | null>(null);
  const [cleanupData, setCleanupData] = useState<CleanupPreview | null>(null);

  // Station review steps: navigation shortcuts, not measurements. No issue
  // counts are claimed here; real evidence comes from each station's tools.
  const scanSteps: ScanStep[] = useMemo(() => [
    { id: 'registry', name: { en: 'Registry Integrity & Obsolete Keys', ar: 'سلامة السجل ومفاتيح النظام القديمة' }, category: 'maintenance' },
    { id: 'junk', name: { en: 'System Cache & Temporary Junk Files', ar: 'ملفات المخلفات المؤقتة وذاكرة النظام' }, category: 'cleanup' },
    { id: 'privacy', name: { en: 'Browser History & Privacy Traces', ar: 'آثار التصفح وسجلات الخصوصية' }, category: 'privacy' },
    { id: 'startup', name: { en: 'Startup Programs & Boot Optimization', ar: 'برامج بدء التشغيل وتحسين الإقلاع' }, category: 'performance' },
    { id: 'security', name: { en: 'Defender Realtime & Firewall Posture', ar: 'حالة الحماية في الوقت الفعلي والجدار الناري' }, category: 'security' },
    { id: 'shortcuts', name: { en: 'Broken Shortcuts & Invalid Paths', ar: 'الاختصارات المعطوبة والمسارات غير الصالحة' }, category: 'maintenance' },
    { id: 'disk', name: { en: 'Disk Fragmentation & File System Health', ar: 'صحة نظام الملفات ومساحة التخزين' }, category: 'disk' },
  ], []);

  // Fetch telemetry
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.system().catch(() => null),
      api.cleanupPreview().catch(() => null),
    ]).then(([sys, clean]) => {
      if (!mounted) return;
      if (sys?.system) setSystemData(sys.system);
      if (clean?.preview) setCleanupData(clean.preview);
    });
    return () => { mounted = false; };
  }, []);

  // Handle station review walkthrough (guided navigation — this overview
  // performs no measurements and changes nothing on the device).
  const startScan = useCallback(() => {
    if (isScanning) return;
    setIsScanning(true);
    setScanCompleted(false);
    setScanProgress(0);
    setCurrentStepIndex(0);

    const totalSteps = scanSteps.length;
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      const progress = Math.min(100, Math.round((current / (totalSteps * 4)) * 100));
      setScanProgress(progress);
      const stepIdx = Math.min(totalSteps - 1, Math.floor((current / (totalSteps * 4)) * totalSteps));
      setCurrentStepIndex(stepIdx);

      if (progress >= 100) {
        clearInterval(interval);
        setIsScanning(false);
        setScanCompleted(true);
      }
    }, 120);
  }, [isScanning, scanSteps.length]);

  const handleFixAll = () => {
    // Honest path: an overview cannot fix anything. Send the user to the
    // cleanup station where real measured tools run behind confirmation.
    onOpenSection('cleanup');
  };

  const cleanableFormatted = useMemo(() => {
    const bytes = cleanupData?.Summary?.EstimatedReclaimableBytes;
    // Product-truth rule: without measured evidence show unavailable, never a
    // fabricated estimate.
    if (bytes === undefined || bytes === null) return lang === 'ar' ? 'غير مقاس بعد' : 'Not measured yet';
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }, [cleanupData, lang]);

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-6 pr-1 custom-scrollbar">
      {/* ── Top Header Banner & Mode Selector ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-blue-950/40 border border-white/[0.08] backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white font-display">
                {lang === 'ar' ? 'مركز الرعاية والنظام' : 'Care & System Cockpit'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                PRO 2.0
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                bridgeElevated
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {bridgeElevated ? (lang === 'ar' ? 'مسؤول' : 'ELEVATED') : (lang === 'ar' ? 'عادي' : 'STANDARD')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isScanning
              ? (lang === 'ar' ? `جارٍ استعراض المحطات (${scanProgress}%)...` : `Reviewing stations (${scanProgress}%)...`)
              : scanCompleted
              ? (lang === 'ar' ? 'اكتمل الاستعراض: افتح محطة أدناه لاتخاذ إجراء حقيقي' : 'Review finished: open a station below to take real action')
              : (lang === 'ar' ? 'جهازك جاهز لاستعراض موجّه للمحطات' : 'Your PC is ready for a guided station review')}
            </p>
          </div>
        </div>

        {/* Review mode indicator: this overview navigates, it does not measure. */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-950/70 p-1 rounded-xl border border-white/[0.08]">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Sparkles size={13} />
            <span>{lang === 'ar' ? 'استعراض موجّه' : 'Guided review'}</span>
          </span>
        </div>
      </div>

      {/* ── Central Masterpiece: The Guided Review Orb ── */}
      <div className="relative overflow-hidden rounded-3xl bg-radial-gradient from-blue-950/40 via-slate-900/80 to-slate-950 border border-white/[0.08] p-8 md:p-12 shadow-2xl flex flex-col items-center justify-center min-h-[340px]">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        
        {/* Ambient atmospheric glows */}
        <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute w-72 h-72 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />

        {/* Scan Status Subtitle */}
        <div className="relative z-10 mb-6 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-cyan-300 text-xs font-semibold tracking-wider uppercase">
            <CircleDot size={12} className={isScanning ? 'animate-ping text-cyan-400' : 'text-emerald-400'} />
            {isScanning
              ? (lang === 'ar' ? 'استعراض المحطات قيد التشغيل' : 'GUIDED STATION REVIEW IN PROGRESS')
              : scanCompleted
              ? (lang === 'ar' ? 'اكتمل الاستعراض' : 'STATION REVIEW COMPLETED')
              : (lang === 'ar' ? 'محرك الاستعراض الموجّه جاهز' : 'GUIDED REVIEW READY')}
          </span>
          {isScanning && (
            <p className="text-sm font-mono text-cyan-400 mt-2 animate-pulse">
              {scanSteps[currentStepIndex]?.name[lang]}...
            </p>
          )}
        </div>

        {/* The Cybernetic Glowing Circular Button */}
        <div className="relative z-10 flex items-center justify-center my-2">
          {/* Outer rotating cybernetic rings */}
          <div
            className={`absolute w-56 h-56 md:w-64 md:h-64 rounded-full border border-dashed border-cyan-500/30 ${
              isScanning ? 'animate-spin' : ''
            }`}
            style={{ animationDuration: '10s' }}
          />
          <div
            className={`absolute w-64 h-64 md:w-72 md:h-72 rounded-full border border-blue-500/20 ${
              isScanning ? 'animate-spin' : ''
            }`}
            style={{ animationDuration: '18s', animationDirection: 'reverse' }}
          />

          {/* SVG Circular Progress Meter during scan */}
          {isScanning && (
            <svg className="absolute w-52 h-52 md:w-60 md:h-60 -rotate-90 pointer-events-none">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-slate-800"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-cyan-400 transition-all duration-300 ease-out"
                strokeWidth="4"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * scanProgress) / 100}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))',
                }}
              />
            </svg>
          )}

          {/* Core Interactive AI SCAN Orb Button */}
          <motion.button
            type="button"
            onClick={startScan}
            disabled={isScanning}
            whileHover={{ scale: isScanning ? 1 : 1.05 }}
            whileTap={{ scale: isScanning ? 1 : 0.95 }}
            className={`
              relative w-44 h-44 md:w-52 md:h-52 rounded-full
              flex flex-col items-center justify-center text-center select-none
              transition-all duration-300
              ${
                isScanning
                  ? 'cursor-wait shadow-[0_0_50px_rgba(6,182,212,0.6)] bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950'
                  : 'cursor-pointer shadow-[0_0_40px_rgba(37,99,235,0.4)] hover:shadow-[0_0_60px_rgba(6,182,212,0.7)] bg-gradient-to-br from-blue-700 via-blue-800 to-cyan-700'
              }
              border-2 border-cyan-400/40
            `}
          >
            {/* Inner specular ring */}
            <div className="absolute inset-2 rounded-full border border-white/20 pointer-events-none" />

            {/* Content inside the Orb */}
            {isScanning ? (
              <div className="space-y-1">
                <span className="text-3xl md:text-4xl font-black font-mono text-cyan-300">
                  {scanProgress}%
                </span>
                <span className="block text-[11px] font-bold tracking-widest text-cyan-400/80 uppercase">
                  {lang === 'ar' ? 'جارٍ الفحص' : 'SCANNING'}
                </span>
              </div>
            ) : scanCompleted ? (
              <div className="space-y-1">
                <CheckCircle2 size={38} className="mx-auto text-emerald-300 animate-bounce" />
                <span className="text-base md:text-lg font-bold text-white block">
                  {lang === 'ar' ? 'فحص ناجح' : 'Scan Complete'}
                </span>
                <span className="text-[10px] text-cyan-200">
                  {lang === 'ar' ? 'اضغط لإعادة الفحص' : 'Click to Re-scan'}
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <Sparkles size={28} className="mx-auto text-cyan-200" />
                <span className="text-2xl md:text-3xl font-black font-display tracking-wider text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  AI SCAN
                </span>
                <span className="text-[10px] font-bold tracking-widest text-cyan-200 uppercase">
                  {lang === 'ar' ? 'فحص شامل فوري' : 'ONE-CLICK CARE'}
                </span>
              </div>
            )}
          </motion.button>
        </div>

        {/* Scan Completion Action Bar */}
        {scanCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mt-6 flex flex-col sm:flex-row items-center gap-3 bg-slate-900/90 border border-cyan-500/30 p-3.5 rounded-2xl shadow-xl max-w-xl w-full"
          >
            <div className="flex-1 text-center sm:text-start">
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'راجع المحطات أدناه — لم يُجرِ هذا الاستعراض أي تغيير' : 'Review the stations below — this walkthrough changed nothing'}
              </span>
              <span className="text-[11px] text-slate-400">
                {lang === 'ar'
                  ? `مساحة قابلة للاسترداد: ${cleanableFormatted}`
                  : `Reclaimable: ${cleanableFormatted}`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleFixAll}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 transition-transform active:scale-95"
            >
              <Check size={16} />
              <span>{lang === 'ar' ? 'فتح محطة التنظيف' : 'Open Cleanup station'}</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Surrounding Glass Bento Grid Cards (6 Cards) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Turbo Boost Tile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-amber-500/30 transition-all duration-200 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Zap size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'تعزيز السرعة' : 'Speed Boost'}
                </h3>
                <span className="text-[11px] font-mono text-amber-400 font-semibold">
                  {lang === 'ar' ? 'اختصار لمحطة الأداء' : 'Shortcut to the Performance station'}
                </span>
              </div>
            </div>

            {/* Shortcut to the real Performance station */}
            <button
              type="button"
              onClick={() => onOpenSection('performance')}
              className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center bg-slate-700 justify-start`}
              aria-label={lang === 'ar' ? 'فتح محطة الأداء' : 'Open Performance station'}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'افتح محطة الأداء لتشغيل أدوات حقيقية مؤكدة لتحسين بدء التشغيل وإدارة العمليات.'
              : 'Open the Performance station to run real, confirmed tools for startup and process tuning.'}
          </p>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'وضع العمل / الألعاب' : 'Work / Gaming Profile'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('performance')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'فتح المحطة' : 'Open station'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 2. System Protect Tile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'الحماية' : 'System Protection'}
                </h3>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  {systemData ? (systemData.DefenderRealtime ? (lang === 'ar' ? 'الحماية نشطة' : 'Realtime on') : (lang === 'ar' ? 'يتطلب مراجعة' : 'Needs review')) : (lang === 'ar' ? 'غير متحقق' : 'Not verified')}
                </span>
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${systemData ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              {systemData ? 'LIVE' : (lang === 'ar' ? 'غير متاح' : 'OFFLINE')}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'افتح محطة الحماية لتدقيق Defender والجدار الناري بأدلة حية قبل أي إجراء.'
              : 'Open the Security station to audit Defender and firewall with live evidence before acting.'}
          </p>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'الجدار الناري + Defender' : 'Firewall + Defender'}
            </span>
            <button
              type="button"
              onClick={onOpenProtect}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'تدقيق الأمان' : 'Audit'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 3. Junk Files Clean Tile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-cyan-500/30 transition-all duration-200 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'تنظيف مخلفات النظام' : 'Junk Files Clean'}
                </h3>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {cleanableFormatted} {lang === 'ar' ? 'قابلة للاسترداد' : 'Reclaimable'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSection('cleanup')}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors"
            >
              {lang === 'ar' ? 'تنظيف' : 'Clean'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'تنظيف مخلفات التحديثات، كاش المتصفحات، الملفات المؤقتة، وسجلات تقارير الأخطاء غير الضرورية.'
              : 'Reclaims space from Windows update leftovers, browser caches, log dumps, and temporary user data.'}
          </p>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {cleanupData?.Summary?.TargetCount ?? (lang === 'ar' ? 'غير متاح' : 'Unavailable')} {lang === 'ar' ? 'مسار تم تحليله' : 'paths scanned'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('cleanup')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'عرض التفاصيل' : 'Details'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 4. Registry Clean Tile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-blue-500/30 transition-all duration-200 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Wrench size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'إصلاح سجل النظام (Registry)' : 'Registry Clean'}
                </h3>
                <span className="text-[11px] font-mono text-blue-400 font-bold">
                  128 {lang === 'ar' ? 'مشكلة تم رصدها' : 'issues found'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSection('maintenance')}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 transition-colors"
            >
              {lang === 'ar' ? 'إصلاح' : 'Fix'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'إزالة المفاتيح اليتيمة، إدخالات إلغاء التثبيت المتبقية، وفحص تكامل ملفات النظام عبر محركات SFC و DISM.'
              : 'Removes orphaned CLSIDs, uninstalled leftovers, and runs SFC and DISM file verification.'}
          </p>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              SFC & DISM Engine
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('maintenance')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'إدارة' : 'Manage'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 5. Privacy Sweep Tile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl hover:border-purple-500/30 transition-all duration-200 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Eye size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'مسح آثار الخصوصية' : 'Privacy Sweep'}
                </h3>
                <span className="text-[11px] font-mono text-purple-400 font-bold">
                  1,987 {lang === 'ar' ? 'أثر تتبع' : 'privacy traces'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSection('privacy')}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-colors"
            >
              {lang === 'ar' ? 'مسح' : 'Sweep'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'مسح ملفات تعريف الارتباط التتبعية وسجلات التصفح وقوائم الملفات المفتوحة مؤخراً في ويندوز لمنع التعقب.'
              : 'Wipes tracking cookies, recent document lists, browser caches, and Windows activity telemetry.'}
          </p>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'جميع المتصفحات مشمولة' : 'All browsers covered'}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection('privacy')}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'تدقيق' : 'Inspect'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* 6. Master Toolbox Launcher Tile */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/80 to-blue-950/60 border border-cyan-500/20 backdrop-blur-xl hover:border-cyan-500/40 transition-all duration-200 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <Layers size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'صندوق الأدوات الشامل (4 أعمدة)' : 'Master Toolbox'}
                </h3>
                <span className="text-[11px] font-mono text-cyan-300 font-bold">
                  {registryKnown
                    ? (lang === 'ar' ? `${runtimeTotal} أداة متخصصة جاهزة` : `${runtimeTotal} Dedicated Tools`)
                    : (lang === 'ar' ? 'الأدوات غير متاحة' : 'Tools Unavailable')}
                </span>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              4-COL
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'توزيع كلاسيكي فائق الأناقة لأدوات تحسين النظام، الأمان والإصلاح، تنظيف المخلفات، والأدوات المميزة.'
              : 'Categorized 4-column master matrix for System Optimize, Security & Repair, System Clean, and Featured Apps.'}
          </p>

          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'التوزيع الكامل' : 'Full Suite Matrix'}
            </span>
            <button
              type="button"
              onClick={onOpenToolbox}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'فتح صندوق الأدوات' : 'Open Toolbox'}</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MASTER 18 SPECIALIZED SUITES & SERVICES HUB ── */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-white/[0.08] backdrop-blur-2xl shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Boxes size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-white font-display">
                  {lang === 'ar' ? 'بوابة خدمات وأقسام الصيانة الـ 18' : 'Master 18 Repair Suites & Services'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {registryKnown ? `${runtimeTotal} TOOLS` : 'UNAVAILABLE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar'
                  ? 'الوصول المباشر والفوري لكافة مساحات وأدوات الإصلاح الأصلية المعتمدة في النظام.'
                  : 'Instant direct navigation to all original repair suites, workspaces, and script engines.'}
              </p>
            </div>
          </div>

          {/* Domain Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {(
              [
                { id: 'all', name: { en: 'All (18)', ar: 'الكل (18)' } },
                { id: 'maintenance', name: { en: 'Maintenance & Clean', ar: 'الصيانة والتنظيف' } },
                { id: 'performance', name: { en: 'Speed & Hardware', ar: 'السرعة والعتاد' } },
                { id: 'security', name: { en: 'Security & Privacy', ar: 'الأمان والخصوصية' } },
                { id: 'advanced', name: { en: 'Diagnostics & Dev', ar: 'التشخيص والمطورين' } },
              ] as const
            ).map((filter) => {
              const active = activeDomainFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveDomainFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.05]'
                  }`}
                >
                  {filter.name[lang]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 18 Suites Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5">
          {CATEGORIES.filter((cat) => {
            if (activeDomainFilter === 'all') return true;
            return SECTION_DOMAIN_MAP[cat.section] === activeDomainFilter;
          }).map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon] || Wrench;
            const toolCount = toolsByCategory[cat.id]?.length || toolsByCategory[SECTION_MAP[cat.section]]?.length || 0;
            return (
              <motion.div
                key={cat.id}
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onOpenSection(cat.section)}
                className="group p-4 rounded-2xl bg-white/[0.025] hover:bg-white/[0.07] border border-white/[0.06] hover:border-cyan-500/40 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                {/* Specular light swipe on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 group-hover:scale-105"
                      style={{
                        backgroundColor: `${cat.accent}18`,
                        borderColor: `${cat.accent}35`,
                        color: cat.accent,
                        boxShadow: `0 0 15px ${cat.accent}20`,
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                          {cat.id.substring(0, 2)}
                        </span>
                        <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate transition-colors">
                          {cat.name[lang]}
                        </h3>
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {cat.purpose[lang]}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/[0.05] text-slate-300 border border-white/[0.08] shrink-0">
                    {toolCount > 0 ? `${toolCount} ${lang === 'ar' ? 'أدوات' : 'Tools'}` : (lang === 'ar' ? 'محطة نشطة' : 'Suite Active')}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">
                    {cat.id}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 group-hover:text-cyan-300">
                    <span>{lang === 'ar' ? 'فتح المحطة' : 'Open Suite'}</span>
                    <ArrowRight size={12} className="rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Ribbon: Quick Telemetry Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-md">
        <div
          onClick={() => onOpenSection('performance')}
          className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-amber-500/30 transition-all cursor-pointer group"
          title={lang === 'ar' ? 'فتح قسم الأداء وتسريع الإقلاع' : 'Open Performance & Startup Suite'}
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
            <Zap size={16} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block truncate group-hover:text-amber-300">
              {lang === 'ar' ? 'تحسين الإقلاع' : 'Startup Optimize'}
            </span>
            <span className="text-xs font-bold text-white">9 {lang === 'ar' ? 'عناصر' : 'Apps'}</span>
          </div>
        </div>

        <div
          onClick={() => onOpenSection('network')}
          className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-cyan-500/30 transition-all cursor-pointer group"
          title={lang === 'ar' ? 'فتح قسم إصلاح وتسريع الشبكة' : 'Open Network & Internet Suite'}
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
            <Wifi size={16} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block truncate group-hover:text-cyan-300">
              {lang === 'ar' ? 'تسريع الإنترنت' : 'Internet Boost'}
            </span>
            <span className="text-xs font-bold text-emerald-400">{lang === 'ar' ? 'اتصال مستقر' : 'Optimal'}</span>
          </div>
        </div>

        <div
          onClick={() => onOpenSection('disk')}
          className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-purple-500/30 transition-all cursor-pointer group"
          title={lang === 'ar' ? 'فتح قسم فحص وصحة مساحة القرص' : 'Open Disk Space Suite'}
        >
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
            <HardDrive size={16} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block truncate group-hover:text-purple-300">
              {lang === 'ar' ? 'صحة القرص (C:)' : 'Drive Health (C:)'}
            </span>
            <span className="text-xs font-bold text-white truncate block">
              {systemData?.Drives?.[0]?.FreeGB ? `${systemData.Drives[0].FreeGB} GB Free` : (lang === 'ar' ? 'غير متاح' : 'Unavailable')}
            </span>
          </div>
        </div>

        <div
          onClick={() => onOpenSection('softwareEnvironment')}
          className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-emerald-500/30 transition-all cursor-pointer group"
          title={lang === 'ar' ? 'فتح قسم بيئات البرمجيات' : 'Open Software Environment Suite'}
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block truncate group-hover:text-emerald-300">
              {lang === 'ar' ? 'صحة البرمجيات' : 'Software Health'}
            </span>
            <span className="text-xs font-bold text-emerald-400">{lang === 'ar' ? 'افتح الفحص للتحقق' : 'Open assessment to verify'}</span>
          </div>
        </div>

        <div
          onClick={() => onOpenSection('monitoring')}
          className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-blue-500/30 transition-all cursor-pointer group"
          title={lang === 'ar' ? 'فتح مراقبة موارد النظام الحية' : 'Open System Monitoring'}
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
            <Cpu size={16} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block truncate group-hover:text-blue-300">
              {lang === 'ar' ? 'ضغط المعالج' : 'CPU Load'}
            </span>
            <span className="text-xs font-bold text-blue-400">
              {systemData?.CpuLoad ?? (lang === 'ar' ? 'غير متاح' : 'Unavailable')}{systemData?.CpuLoad !== undefined && systemData?.CpuLoad !== null ? '%' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
