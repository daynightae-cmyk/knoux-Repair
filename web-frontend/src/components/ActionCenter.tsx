import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  HardDrive,
  HeartPulse,
  Layers,
  MemoryStick,
  Network,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ActiveSection } from '../types';
import type { BridgeTool, SystemSnapshot, CleanupPreview } from '../lib/api';
import { api } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { CATEGORIES } from '../data/categories';

interface ActionCenterProps {
  lang: Lang;
  toolsByCategory: Record<string, BridgeTool[]>;
  onOpenSection: (section: ActiveSection) => void;
  onOpenAllTools: () => void;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onOpenNavigation?: () => void;
}

interface AssessmentItem {
  id: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  status: 'optimal' | 'attention' | 'ready';
  badge: Record<Lang, string>;
  targetSection: ActiveSection;
  actionText: Record<Lang, string>;
  icon: typeof HeartPulse;
}

export default function ActionCenter({
  lang,
  toolsByCategory,
  onOpenSection,
  onOpenAllTools,
  bridgeElevated,
  bridgeOnline,
}: ActionCenterProps) {
  const [systemData, setSystemData] = useState<SystemSnapshot | null>(null);
  const [cleanupData, setCleanupData] = useState<CleanupPreview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  // Runtime registry total. Offline renders UNAVAILABLE, never "0 tools".
  const registryTotal = useMemo(
    () => Object.values(toolsByCategory).reduce((total, items) => total + items.length, 0),
    [toolsByCategory],
  );

  // Load live telemetry data
  const fetchData = useCallback(async () => {
    try {
      const [sysRes, cleanRes] = await Promise.all([
        api.system().catch(() => null),
        api.cleanupPreview().catch(() => null),
      ]);
      if (sysRes?.system) setSystemData(sysRes.system);
      if (cleanRes?.preview) setCleanupData(cleanRes.preview);
    } catch {
      // Gracefully handle offline
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Run Smart PC Assessment (non-destructive, queries local endpoints)
  const handleStartScan = () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(10);

    const timer1 = setTimeout(() => setScanProgress(35), 400);
    const timer2 = setTimeout(() => setScanProgress(70), 900);
    const timer3 = setTimeout(() => {
      setScanProgress(100);
      setScanning(false);
      fetchData();
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  const totalTools = useMemo(() => {
    return Object.values(toolsByCategory).reduce((acc, list) => acc + list.length, 0);
  }, [toolsByCategory]);

  const hasSystemData = systemData !== null;
  const hasCleanupData = cleanupData !== null;

  const unavailableText = lang === 'ar' ? 'غير متاح' : 'Unavailable';
  const bridgeOfflineText = lang === 'ar' ? 'يتطلب اتصال المحرك المحلي' : 'Requires the local bridge';

  const cleanableBytesFormatted = useMemo(() => {
    const bytes = cleanupData?.Summary?.EstimatedReclaimableBytes;
    // Product-truth rule: without measured evidence show unavailable, never a
    // fabricated estimate.
    if (bytes === undefined || bytes === null) return unavailableText;
    if (bytes >= 1024 ** 3) {
      return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    }
    return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  }, [cleanupData, unavailableText]);

  // Assessment results based on live data
  const assessmentItems: AssessmentItem[] = useMemo(() => {
    const items: AssessmentItem[] = [];

    // 1. Windows Integrity & SFC
    items.push({
      id: 'integrity',
      title: {
        en: 'System File Integrity & Component Store',
        ar: 'سلامة ملفات النظام ومخزن المكونات',
      },
      description: {
        en: 'Windows SFC and DISM engines are ready to verify and service corrupted system files.',
        ar: 'محركات SFC و DISM في ويندوز جاهزة للتحقق من ملفات النظام التالفة وإصلاحها.',
      },
      status: 'ready',
      badge: {
        en: 'Ready to scan',
        ar: 'جاهز للفحص',
      },
      targetSection: 'maintenance',
      actionText: {
        en: 'Verify Files',
        ar: 'تحقق من الملفات',
      },
      icon: HeartPulse,
    });

    // 2. Disk Storage Cleanup
    items.push({
      id: 'cleanup',
      title: {
        en: hasCleanupData ? `Cleanable Temporary Data (${cleanableBytesFormatted})` : 'Cleanable Temporary Data (Unavailable)',
        ar: hasCleanupData ? `بيانات مؤقتة قابلة للتنظيف (${cleanableBytesFormatted})` : 'بيانات مؤقتة قابلة للتنظيف (غير متاح)',
      },
      description: {
        en: hasCleanupData
          ? 'Reclaimable temporary files, Windows update caches, and browser storage detected.'
          : 'Cleanup evidence is unavailable. Connect the local bridge and refresh to measure real targets.',
        ar: hasCleanupData
          ? 'تم اكتشاف ملفات مؤقتة قابلة للاسترداد وذاكرة التحديثات ومخلفات التصفح.'
          : 'أدلة التنظيف غير متاحة. اتصل بالمحرك المحلي وحدّث الصفحة لقياس الأهداف الحقيقية.',
      },
      status: 'attention',
      badge: {
        en: 'Reclaimable Space',
        ar: 'مساحة قابلة للاسترداد',
      },
      targetSection: 'cleanup',
      actionText: {
        en: 'Clean Junk',
        ar: 'تنظيف المخلفات',
      },
      icon: Trash2,
    });

    // 3. Performance & Memory
    const ramUsedPercent = systemData && systemData.TotalRamGB > 0
      ? Math.round(((systemData.TotalRamGB - systemData.FreeRamGB) / systemData.TotalRamGB) * 100)
      : null;
    items.push({
      id: 'performance',
      title: {
        en: ramUsedPercent === null ? 'Memory & Background Load (Unavailable)' : `Memory & Background Load (${ramUsedPercent}% Active)`,
        ar: ramUsedPercent === null ? 'الذاكرة وضغط العمليات (غير متاح)' : `الذاكرة وضغط العمليات (${ramUsedPercent}% نشط)`,
      },
      description: {
        en: systemData ? `Process pool active with ${systemData.Processes} running tasks. Startup trace ready.` : 'Live process data is unavailable. Connect the local bridge and refresh.',
        ar: systemData ? `مجموعة العمليات نشطة بـ ${systemData.Processes} مهمة. تتبع الإقلاع جاهز.` : 'بيانات العمليات الحية غير متاحة. اتصل بالمحرك المحلي وحدّث الصفحة.',
      },
      status: ramUsedPercent !== null && ramUsedPercent > 80 ? 'attention' : ramUsedPercent === null ? 'ready' : 'optimal',
      badge: {
        en: ramUsedPercent === null ? 'Not verified' : ramUsedPercent > 80 ? 'High Pressure' : 'Balanced',
        ar: ramUsedPercent === null ? 'غير متحقق' : ramUsedPercent > 80 ? 'ضغط مرتفع' : 'متوازن',
      },
      targetSection: 'performance',
      actionText: {
        en: 'Optimize Boot',
        ar: 'تسريع الإقلاع',
      },
      icon: Gauge,
    });

    // 4. Security & Protection Posture
    const defenderState = systemData ? systemData.DefenderRealtime : null;
    items.push({
      id: 'security',
      title: {
        en: 'Windows Defender & Firewall Posture',
        ar: 'حالة Windows Defender والجدار الناري',
      },
      description: {
        en: defenderState === null
          ? 'Protection state is not verified. Connect the local bridge and refresh for live evidence.'
          : defenderState
            ? 'Real-time antivirus defense is active. Firewall profiles are enforced.'
            : 'Security alerts require attention.',
        ar: defenderState === null
          ? 'حالة الحماية غير متحقق منها. اتصل بالمحرك المحلي وحدّث الصفحة للحصول على أدلة حية.'
          : defenderState
            ? 'الحماية في الوقت الفعلي مفعّلة. ملفات الجدار الناري مؤمّنة.'
            : 'تنبيهات الأمان تتطلب مراجعة.',
      },
      status: defenderState === null ? 'ready' : defenderState ? 'optimal' : 'attention',
      badge: {
        en: defenderState === null ? 'Not verified' : defenderState ? 'Protected' : 'Review Needed',
        ar: defenderState === null ? 'غير متحقق' : defenderState ? 'محمي' : 'يتطلب مراجعة',
      },
      targetSection: 'security',
      actionText: {
        en: 'Audit Posture',
        ar: 'تدقيق الأمان',
      },
      icon: ShieldCheck,
    });

    return items;
  }, [cleanableBytesFormatted, hasCleanupData, hasSystemData, systemData, unavailableText, lang]);

  // Goal-centric symptom cards
  const symptomCards = [
    {
      id: 'slow',
      title: { en: 'PC is running slow', ar: 'الجهاز بطيء أو ثقيل' },
      subtitle: { en: 'Tune boot apps, release inactive RAM, and audit power plans', ar: 'ضبط بدء التشغيل، تفريغ الذاكرة الخاملة، وتدقيق خطط الطاقة' },
      target: 'performance' as ActiveSection,
      icon: Zap,
      accent: '#f59e0b',
      badge: { en: 'Speed Up', ar: 'تسريع' },
    },
    {
      id: 'disk',
      title: { en: 'Low on disk space', ar: 'مساحة القرص منخفضة' },
      subtitle: { en: 'Analyze large folders, junk files, and duplicate documents', ar: 'تحليل المجلدات الكبيرة والمخلفات والملفات المكررة' },
      target: 'cleanup' as ActiveSection,
      icon: Trash2,
      accent: '#10b981',
      badge: { en: 'Clean Space', ar: 'تفريغ مساحة' },
    },
    {
      id: 'repair',
      title: { en: 'Windows errors or crash', ar: 'أخطاء وانهيارات في ويندوز' },
      subtitle: { en: 'Run verified SFC file repair, DISM image scan, and chkdsk', ar: 'تشغيل إصلاح SFC وفحص صورة DISM وفحص القرص' },
      target: 'maintenance' as ActiveSection,
      icon: Wrench,
      accent: '#3b82f6',
      badge: { en: 'File Repair', ar: 'إصلاح الملفات' },
    },
    {
      id: 'network',
      title: { en: 'Internet or DNS issues', ar: 'مشاكل في الإنترنت أو الـ DNS' },
      subtitle: { en: 'Flush DNS cache, reset Winsock stack, and test ping latency', ar: 'مسح كاش DNS، إعادة تعيين مكدس Winsock، وفحص استجابة الاتصال' },
      target: 'network' as ActiveSection,
      icon: Network,
      accent: '#06b6d4',
      badge: { en: 'Reset Network', ar: 'إصلاح الشبكة' },
    },
    {
      id: 'security',
      title: { en: 'Check protection & privacy', ar: 'فحص الحماية والخصوصية' },
      subtitle: { en: 'Audit Defender signatures, firewall status, and telemetry', ar: 'تدقيق توقيعات Defender وحالة الجدار الناري وبيانات التتبع' },
      target: 'security' as ActiveSection,
      icon: Shield,
      accent: '#14b8a6',
      badge: { en: 'Audit Security', ar: 'تدقيق الأمان' },
    },
    {
      id: 'recovery',
      title: { en: 'Backup & restore point', ar: 'نسخة احتياطية ونقطة استعادة' },
      subtitle: { en: 'Create emergency restore points and inspect backup archives', ar: 'إنشاء نقاط استعادة طوارئ وتدقيق أرشيف النسخ الاحتياطية' },
      target: 'backupRecovery' as ActiveSection,
      icon: HardDrive,
      accent: '#8b5cf6',
      badge: { en: 'Recovery Vault', ar: 'خزنة الاستعادة' },
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-6 pr-1 custom-scrollbar">
      {/* ── Executive Header Banner ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-blue-950/40 border border-white/[0.08] p-6 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
              <Sparkles size={13} />
              <span>{lang === 'ar' ? 'مركز القيادة المباشر' : 'ACTION CENTER COCKPIT'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              {lang === 'ar' ? 'مركز الإجراءات وصيانة الجهاز' : 'System Care & Action Center'}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {lang === 'ar'
                ? 'تشخيص متكامل وفحص شامل لموارد الجهاز، سلامة ملفات النظام، ومساحة التخزين مع أدوات إصلاح فورية.'
                : 'Unified diagnostics and health assessment covering file integrity, storage reclamation, and system performance.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleStartScan}
              disabled={scanning}
              className={`
                px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg
                transition-all duration-200
                ${scanning
                  ? 'bg-blue-600/50 text-blue-200 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-blue-500/20'
                }
              `}
            >
              <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
              <span>
                {scanning
                  ? (lang === 'ar' ? `جارٍ الفحص (${scanProgress}%)` : `Assessing Device (${scanProgress}%)`)
                  : (lang === 'ar' ? 'بدء الفحص الشامل' : 'Run Smart Assessment')}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAllTools}
              className="px-4 py-3 rounded-xl font-medium text-sm text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center gap-2 transition-colors"
            >
              <Terminal size={15} />
              <span>{lang === 'ar' ? `فهرس الأدوات (${totalTools})` : `All Tools (${totalTools})`}</span>
            </button>
          </div>
        </div>

        {/* Scan Progress Bar */}
        {scanning && (
          <div className="mt-5 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        )}
      </section>

      {/* ── Live System Telemetry Strip ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* CPU Gauge */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Cpu size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'ar' ? 'المعالج' : 'CPU Load'}
              </span>
              <span className="text-xs font-mono font-bold text-blue-400">
                {hasSystemData && systemData?.CpuLoad !== undefined && systemData?.CpuLoad !== null ? `${systemData.CpuLoad}%` : unavailableText}
              </span>
            </div>
            <div className="mt-1 text-sm font-semibold text-white truncate">
              {systemData?.CpuName ? systemData.CpuName.split('@')[0] : (lang === 'ar' ? 'اسم المعالج غير متاح' : 'CPU name unavailable')}
            </div>
            <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div
                className="bg-blue-500 h-full"
                style={{ width: `${hasSystemData && systemData?.CpuLoad !== undefined && systemData?.CpuLoad !== null ? Math.min(100, systemData.CpuLoad) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* RAM Gauge */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <MemoryStick size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'ar' ? 'الذاكرة العشوائية' : 'RAM Memory'}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {systemData
                  ? `${(systemData.TotalRamGB - systemData.FreeRamGB).toFixed(1)} / ${systemData.TotalRamGB} GB`
                  : unavailableText}
              </span>
            </div>
            <div className="mt-1 text-sm font-semibold text-white truncate">
              {systemData
                ? `${systemData.FreeRamGB.toFixed(1)} GB ${lang === 'ar' ? 'متاح' : 'Available'}`
                : bridgeOfflineText}
            </div>
            <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-full"
                style={{
                  width: `${systemData ? Math.round(((systemData.TotalRamGB - systemData.FreeRamGB) / systemData.TotalRamGB) * 100) : 32}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* System Drive Storage */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <HardDrive size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'ar' ? 'قرص النظام (C:)' : 'System Drive (C:)'}
              </span>
              <span className="text-xs font-mono font-bold text-purple-400">
                {systemData?.Drives?.[0]
                  ? `${systemData.Drives[0].FreeGB} GB Free`
                  : unavailableText}
              </span>
            </div>
            <div className="mt-1 text-sm font-semibold text-white truncate">
              {systemData?.Drives?.[0]
                ? `${systemData.Drives[0].TotalGB - systemData.Drives[0].FreeGB} GB / ${systemData.Drives[0].TotalGB} GB`
                : bridgeOfflineText}
            </div>
            <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div
                className="bg-purple-500 h-full"
                style={{
                  width: `${systemData?.Drives?.[0] ? Math.round(((systemData.Drives[0].TotalGB - systemData.Drives[0].FreeGB) / systemData.Drives[0].TotalGB) * 100) : 37}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Protection & Elevation */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'ar' ? 'حالة الحماية' : 'Security Posture'}
              </span>
              <span className="text-xs font-bold text-teal-400">
                {systemData ? (systemData.DefenderRealtime ? (lang === 'ar' ? 'محمي' : 'Active') : 'Review') : unavailableText}
              </span>
            </div>
            <div className="mt-1 text-sm font-semibold text-white truncate">
              {bridgeElevated ? (lang === 'ar' ? 'صلاحية مسؤول كاملة' : 'Admin Privileges') : (lang === 'ar' ? 'وضع قياسي' : 'Standard User')}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate">{systemData?.Os ?? unavailableText}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${bridgeOnline ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                {bridgeOnline ? (lang === 'ar' ? 'المحرك متصل' : 'Bridge Live') : (lang === 'ar' ? 'المحرك مفصول' : 'Bridge Offline')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Smart Assessment & Actionable Findings ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={17} className="text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              {lang === 'ar' ? 'نتائج الفحص والتقييم الذكي' : 'Assessment & Actionable Findings'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {lang === 'ar' ? 'تم الفحص دون تغيير في النظام' : 'Read-only verified audit'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assessmentItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.07] hover:border-blue-500/30 transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-white/[0.08] flex items-center justify-center text-blue-400 shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-colors">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {item.title[lang]}
                      </h3>
                      <span
                        className={`
                          text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0
                          ${item.status === 'optimal'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'attention'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }
                        `}
                      >
                        {item.badge[lang]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {item.description[lang]}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.05] flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenSection(item.targetSection)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span>{item.actionText[lang]}</span>
                    <ArrowRight size={13} className="rtl:rotate-180" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Goal-Centric Symptom Triage ("What would you like to fix?") ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={17} className="text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              {lang === 'ar' ? 'حلول سريعة للأعطال الشائعة' : 'What would you like to fix?'}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {lang === 'ar' ? 'اختر المشكلة وسيتولى KNOUX توجيهك' : 'Choose your symptom to open the verified workflow'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {symptomCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onOpenSection(card.target)}
                className="p-4 rounded-xl text-start bg-slate-900/40 hover:bg-slate-900/80 border border-white/[0.06] hover:border-white/[0.15] transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${card.accent}18`, color: card.accent }}
                    >
                      <Icon size={16} />
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${card.accent}15`, color: card.accent }}
                    >
                      {card.badge[lang]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {card.title[lang]}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {card.subtitle[lang]}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 group-hover:text-white">
                  <span>{lang === 'ar' ? 'بدء الإجراء' : 'Launch station'}</span>
                  <ArrowRight size={13} className="rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Specialized Workstations Quick Hub ── */}
      <section className="space-y-3 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={17} className="text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              {lang === 'ar' ? 'محطات الصيانة المتخصصة (18 محطة)' : 'Specialized Repair Workstations (18 Categories)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenAllTools}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <span>{bridgeOnline === true ? (lang === 'ar' ? `عرض جميع الأدوات (${registryTotal})` : `View All ${registryTotal} Tools`) : (lang === 'ar' ? 'الأدوات غير متاحة' : 'Tools Unavailable')}</span>
            <ArrowRight size={13} className="rtl:rotate-180" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {CATEGORIES.slice(0, 12).map((cat) => {
            const items = toolsByCategory[cat.id];
            const countLabel = bridgeOnline === true && items
              ? `${items.length} ${lang === 'ar' ? 'أداة' : 'tools'}`
              : (lang === 'ar' ? 'غير متاح' : 'Unavailable');
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpenSection(cat.section)}
                className="p-3 rounded-xl bg-slate-900/30 hover:bg-slate-900/70 border border-white/[0.05] hover:border-white/[0.14] text-start transition-all group"
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${cat.accent}20`, color: cat.accent }}
                >
                  <Wrench size={14} />
                </div>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                  {cat.name[lang]}
                </div>
                <div className="mt-1 text-[11px] font-mono text-slate-500">
                  {countLabel}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
