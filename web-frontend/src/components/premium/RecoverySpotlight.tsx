import { useEffect, useMemo, useState } from 'react';
import {
  Trash2, Copy, HardDrive, RotateCcw, ChevronRight, ShieldCheck,
  Leaf, Database, Cloud, History, FileText, RefreshCw, Lightbulb,
} from 'lucide-react';
import type { BackupRecoveryPreview, BridgeTool, CleanupPreview, SystemSnapshot } from '../../lib/api';
import { api } from '../../lib/api';

interface RecoverySpotlightProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  systemSnapshot?: SystemSnapshot | null;
  serviceTools: BridgeTool[];
  allTools: BridgeTool[];
  onSelectTool: (toolId: string) => void;
}

function formatBytes(bytes: number | null | undefined, lang: 'en' | 'ar'): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return lang === 'ar' ? 'غير متوفر' : 'Unavailable';
  if (bytes <= 0) return '0 MB';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatGB(gb: number | null | undefined, lang: 'en' | 'ar'): string {
  if (gb === null || gb === undefined || Number.isNaN(gb)) return lang === 'ar' ? 'غير متوفر' : 'Unavailable';
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
}

export default function RecoverySpotlight({ lang, bridgeOnline, systemSnapshot, serviceTools, allTools, onSelectTool }: RecoverySpotlightProps) {
  const isRtl = lang === 'ar';
  const [cleanup, setCleanup] = useState<CleanupPreview | null>(null);
  const [cleanupState, setCleanupState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [backup, setBackup] = useState<BackupRecoveryPreview | null>(null);

  // Defer heavy previews until the bridge handshake completes so the
  // initial tool-contract load is never starved by PowerShell scans.
  useEffect(() => {
    if (bridgeOnline !== true) return;
    let cancelled = false;
    setCleanupState('loading');
    api.cleanupPreview()
      .then(({ preview }) => { if (!cancelled) { setCleanup(preview); setCleanupState('ready'); } })
      .catch(() => { if (!cancelled) setCleanupState('error'); });
    // Stagger the second scan so the bridge handles one PowerShell job at a time.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      api.backupRecoveryPreview()
        .then(({ preview }) => { if (!cancelled) setBackup(preview); })
        .catch(() => { /* keep null -> unavailable states */ });
    }, 2500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bridgeOnline]);

  const sysDrive = useMemo(() => {
    const drives = systemSnapshot?.Drives ?? [];
    return drives.find(d => d.IsSystem || d.Name === systemSnapshot?.SystemDrive) ?? drives[0] ?? null;
  }, [systemSnapshot]);

  const diskTotal = sysDrive ? sysDrive.TotalGB : null;
  const diskFree = sysDrive ? sysDrive.FreeGB : null;
  const diskUsed = diskTotal !== null && diskFree !== null ? Math.max(0, diskTotal - diskFree) : null;
  const diskPct = diskTotal && diskTotal > 0 && diskUsed !== null ? Math.round((diskUsed / diskTotal) * 100) : null;

  const reclaimable = cleanup?.Summary.EstimatedReclaimableBytes ?? null;
  const targets = useMemo(() => [...(cleanup?.Targets ?? [])].sort((a, b) => b.SizeBytes - a.SizeBytes).slice(0, 4), [cleanup]);

  const findTool = (id: string) => allTools.find(t => t.ToolId === id) ?? serviceTools.find(t => t.ToolId === id);
  const previewTool = findTool('SC11') ?? serviceTools[0] ?? null;

  const additionalPicks = useMemo(() => {
    const ids = ['SC03', 'SC02', 'SC08', 'SC04'];
    const picked: BridgeTool[] = [];
    for (const id of ids) {
      const t = findTool(id);
      if (t) picked.push(t);
      if (picked.length >= 4) break;
    }
    for (const t of serviceTools) {
      if (picked.length >= 4) break;
      if (!picked.some(p => p.ToolId === t.ToolId) && t.ToolId !== previewTool?.ToolId) picked.push(t);
    }
    return picked.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTools, serviceTools]);

  const toolIcon = (toolId: string) => {
    if (toolId.startsWith('SC')) return Trash2;
    if (toolId.startsWith('DF')) return Copy;
    if (toolId.startsWith('DS')) return HardDrive;
    return RotateCcw;
  };

  // Donut geometry (truthful only — no fake 256GB)
  const R = 52;
  const C = 2 * Math.PI * R;
  const usedFrac = diskPct !== null ? diskPct / 100 : 0;

  const restoreCount = backup?.RestorePoints.QueryAvailable ? backup.RestorePoints.Count : null;
  const latestBackup = backup?.LocalBackups.Latest ?? null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Left: Interactive Cleanup Preview ── */}
      <div className="rounded-2xl border border-cyan-400/20 bg-[#070d22]/90 backdrop-blur-xl p-5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-teal-400/15 border border-teal-300/30 flex items-center justify-center shrink-0">
                <Trash2 size={17} className="text-teal-300" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white flex-wrap">
                  <span>{isRtl ? 'تنظيف النظام' : 'System Cleanup'}</span>
                  <ChevronRight size={14} className={`text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                  <span className="text-cyan-200">{isRtl ? 'معاينة التنظيف التفاعلية' : 'Interactive Cleanup Preview'}</span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                  {isRtl
                    ? 'اعثر على الملفات المؤقتة ومخلفات النظام وذواكر التخزين بأمان. راجع ما سيُحذف قبل التنظيف، مع إمكانية الاستعادة عند الحاجة.'
                    : 'Safely find and remove temporary files, system junk, and app caches. Preview what will be deleted before you clean, with the option to restore if needed.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                {serviceTools.length} {isRtl ? 'أداة في هذه الفئة' : 'tools in this category'}
                <ChevronRight size={12} className={`text-slate-500 ${isRtl ? 'rotate-180' : ''}`} />
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-5 flex items-center gap-0" role="list" aria-label={isRtl ? 'خطوات التنظيف' : 'Cleanup steps'}>
            {[
              { n: 1, tEn: 'Scanning', tAr: 'الفحص', sEn: cleanupState === 'ready' ? 'Completed' : cleanupState === 'error' ? 'Unavailable' : 'Running…', sAr: cleanupState === 'ready' ? 'مكتمل' : cleanupState === 'error' ? 'غير متوفر' : 'جارٍ…', done: cleanupState === 'ready', active: cleanupState !== 'ready' },
              { n: 2, tEn: 'Review Items', tAr: 'مراجعة العناصر', sEn: cleanup ? `${formatBytes(reclaimable, 'en')} found` : '…', sAr: cleanup ? `تم العثور على ${formatBytes(reclaimable, 'ar')}` : '…', done: false, active: cleanupState === 'ready' },
              { n: 3, tEn: 'Clean & Optimize', tAr: 'التنظيف والتحسين', sEn: 'Ready', sAr: 'جاهز', done: false, active: false },
              { n: 4, tEn: 'Complete', tAr: 'اكتمال', sEn: 'Pending', sAr: 'بانتظار', done: false, active: false },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center flex-1 last:flex-none" role="listitem">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${s.done ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.5)]' : s.active ? 'bg-violet-600 text-white border-violet-400 shadow-[0_0_14px_rgba(168,85,247,0.5)]' : 'bg-white/5 text-slate-400 border-white/15'}`}>
                    {s.done ? '✓' : s.n}
                  </span>
                  <span className="hidden sm:block">
                    <span className={`block text-[11px] font-bold ${s.active || s.done ? 'text-white' : 'text-slate-400'}`}>{isRtl ? s.tAr : s.tEn}</span>
                    <span className="block text-[10px] text-violet-300/90">{isRtl ? s.sAr : s.sEn}</span>
                  </span>
                </div>
                {i < arr.length - 1 && <span className={`mx-2 md:mx-3 h-px flex-1 ${i === 0 && cleanupState === 'ready' ? 'bg-gradient-to-r from-sky-400 to-violet-500' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
            <div className="min-w-[130px]">
              <div className="text-[11px] text-slate-400 font-semibold">{isRtl ? 'نتائج الفحص' : 'Scan Results'}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                {cleanupState === 'loading' ? '…' : formatBytes(reclaimable, lang)}
              </div>
              <div className="text-[11px] text-slate-400">{isRtl ? 'مساحة قابلة للاسترداد' : 'Reclaimable Space'}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs border-s border-white/10 ps-4">
              {cleanupState === 'loading' && <span className="text-slate-500 col-span-2">{isRtl ? 'جارٍ قياس المسارات الآمنة…' : 'Measuring safe target paths…'}</span>}
              {cleanupState === 'error' && <span className="text-amber-300 col-span-2">{isRtl ? 'تعذر تحميل المعاينة — الجسر أو الفحص غير متاح.' : 'Preview unavailable — bridge or scan not reachable.'}</span>}
              {targets.map(t => (
                <div key={`${t.ToolId}-${t.Category}`} className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">{t.Category}</span>
                  <span className="font-mono font-bold text-white shrink-0">{formatBytes(t.SizeBytes, 'en')}</span>
                </div>
              ))}
              {cleanupState === 'ready' && targets.length === 0 && (
                <span className="text-slate-400 col-span-2">{isRtl ? 'لا يوجد ما يمكن تنظيفه بأمان.' : 'Nothing safe to clean.'}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-[190px]">
              <button
                type="button"
                disabled={!previewTool}
                onClick={() => previewTool && onSelectTool(previewTool.ToolId)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 disabled:opacity-40 shadow-[0_0_22px_rgba(124,58,237,0.45)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRtl ? 'مراجعة وتنظيف' : 'Review & Clean'}
                <ChevronRight size={15} className={isRtl ? 'rotate-180' : ''} />
              </button>
              <p className="text-[10px] text-slate-500 leading-relaxed flex gap-1.5">
                <History size={12} className="shrink-0 mt-0.5" />
                {isRtl ? 'العناصر المحذوفة تنتقل إلى الحجر الصحي ويمكن استعادتها من هناك.' : 'Deleted items move to quarantine and can be restored from there.'}
              </p>
            </div>
          </div>

          {/* Additional tools */}
          <div className="mt-4">
            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-2">
              {isRtl ? `أدوات إضافية في تنظيف النظام (${serviceTools.length})` : `ADDITIONAL TOOLS IN SYSTEM CLEANUP (${serviceTools.length})`}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {additionalPicks.map(t => {
                const Icon = toolIcon(t.ToolId);
                return (
                  <button
                    key={t.ToolId}
                    type="button"
                    onClick={() => onSelectTool(t.ToolId)}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5 flex items-center gap-2 text-xs font-semibold text-slate-200 transition-colors cursor-pointer text-start"
                    title={isRtl ? t.ArabicName : t.EnglishName}
                  >
                    <Icon size={15} className="text-sky-400 shrink-0" />
                    <span className="truncate">{isRtl ? t.ArabicName : t.EnglishName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Storage column ── */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#070d22]/90 backdrop-blur-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase">{isRtl ? 'نظرة على التخزين' : 'Storage Overview'}</h3>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 font-semibold">
              {isRtl ? 'القرص المحلي' : 'Local Disk'} ({sysDrive?.Name ?? 'C:'})
            </span>
          </div>
          {sysDrive ? (
            <div className="flex items-center gap-4">
              <div className="relative w-[118px] h-[118px] shrink-0" role="img" aria-label={isRtl ? `القرص ${sysDrive.Name}` : `Disk ${sysDrive.Name}`}>
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r={R} fill="none"
                    stroke="url(#recDonutGrad)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${C * usedFrac} ${C}`} opacity="0.95"
                  />
                  <defs>
                    <linearGradient id="recDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#A855F7" />
                      <stop offset="100%" stopColor="#22D3EE" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold text-white font-mono">{formatGB(diskTotal, 'en')}</span>
                  <span className="text-[10px] text-slate-400">{isRtl ? 'الإجمالي' : 'Total'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2 h-2 rounded-full bg-violet-400" />{isRtl ? 'مستخدم' : 'Used'}</span>
                  <span className="font-mono font-bold text-white">{formatGB(diskUsed, 'en')} {diskPct !== null && <span className="text-slate-400 font-semibold">({diskPct}%)</span>}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2 h-2 rounded-full bg-sky-400" />{isRtl ? 'متاح' : 'Free'}</span>
                  <span className="font-mono font-bold text-white">{formatGB(diskFree, 'en')}</span>
                </div>
                <div className="mt-1 rounded-xl bg-emerald-400/10 border border-emerald-400/25 p-2.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Leaf size={16} className="text-emerald-300 shrink-0" />
                    <span>
                      <span className="block text-base font-extrabold text-emerald-300 font-mono leading-none">
                        {cleanupState === 'loading' ? '…' : formatBytes(reclaimable, 'en')}
                      </span>
                      <span className="block text-[10px] text-emerald-200/90 font-semibold mt-0.5">{isRtl ? 'مساحة قابلة للاسترداد' : 'Reclaimable Space'}</span>
                    </span>
                  </span>
                  <ChevronRight size={14} className={`text-emerald-300/70 ${isRtl ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{isRtl ? 'بيانات القرص غير متوفرة — تحقق من اتصال الجسر.' : 'Disk data unavailable — check the bridge connection.'}</p>
          )}
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            {isRtl ? 'نظّف الملفات غير الضرورية لتحرير المساحة وتحسين الأداء.' : 'Clean unnecessary files to free up space and improve performance.'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#070d22]/90 backdrop-blur-xl p-4 shadow-xl">
          <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase mb-2">{isRtl ? 'الحماية والاستعادة' : 'Protection & Recovery'}</h3>
          <div className="flex flex-col divide-y divide-white/5">
            {[
              { icon: ShieldCheck, c: 'text-teal-300', tEn: 'Items in Quarantine', tAr: 'عناصر في الحجر', v: cleanup ? (isRtl ? `${cleanup.Quarantine.FileCount} عنصر` : `${cleanup.Quarantine.FileCount} items`) : (isRtl ? 'غير متوفر' : 'Unavailable') },
              { icon: FileText, c: 'text-sky-300', tEn: 'Protected Files', tAr: 'ملفات محمية', v: isRtl ? 'لا توجد بيانات حقيقية بعد' : 'No verified inventory yet' },
              { icon: Database, c: 'text-cyan-300', tEn: 'Latest Backup', tAr: 'أحدث نسخة احتياطية', v: latestBackup ? `${latestBackup.Name}` : (isRtl ? 'لا أدلة بعد' : 'No evidence yet') },
              { icon: History, c: 'text-slate-300', tEn: 'Available Restore Points', tAr: 'نقاط الاستعادة المتاحة', v: restoreCount !== null ? (isRtl ? `${restoreCount} نقطة` : `${restoreCount} restore points`) : (isRtl ? 'تعذر الاستعلام' : 'Query unavailable') },
            ].map(row => (
              <div key={row.tEn} className="flex items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2.5 min-w-0">
                  <row.icon size={16} className={`${row.c} shrink-0`} />
                  <span className="min-w-0">
                    <span className="block text-xs text-slate-300">{isRtl ? row.tAr : row.tEn}</span>
                    <span className="block text-[11px] font-semibold text-white truncate">{row.v}</span>
                  </span>
                </span>
                <ChevronRight size={14} className={`text-slate-500 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.07] to-transparent p-4 shadow-xl">
          <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase mb-2">{isRtl ? 'التوصية' : 'Recommendation'}</h3>
          <div className="flex gap-2.5">
            <Lightbulb size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-200 leading-relaxed">
                {cleanup && reclaimable !== null && reclaimable > 0
                  ? (isRtl ? `حرّر ${formatBytes(reclaimable, lang)} لتحسين أداء النظام.` : `Free up ${formatBytes(reclaimable, lang)} to improve system performance.`)
                  : (isRtl ? 'شغّل معاينة التنظيف لقياس المساحة القابلة للاسترداد أولًا.' : 'Run the cleanup preview first to measure reclaimable space.')}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {isRtl ? 'التنظيف المنتظم يحافظ على سرعة وأمان واستجابة حاسوبك.' : 'Regular cleanup keeps your PC faster, safer, and more responsive.'}
              </p>
              <button
                type="button"
                disabled={!previewTool}
                onClick={() => previewTool && onSelectTool(previewTool.ToolId)}
                className="mt-2.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                {isRtl ? 'تشغيل التنظيف الآن' : 'Run Cleanup Now'}
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecoveryHeroBadges({ lang }: { lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  const items = [
    { icon: ShieldCheck, en: ['CLEANER', 'SYSTEM'], ar: ['نظام', 'أنظف'] },
    { icon: Leaf, en: ['SAFER', 'STORAGE'], ar: ['تخزين', 'أكثر أمانًا'] },
    { icon: Database, en: ['RECOVER', 'FILES'], ar: ['استعادة', 'الملفات'] },
    { icon: Cloud, en: ['STRONGER', 'TOMORROW'], ar: ['غد', 'أقوى'] },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 md:gap-6 pt-1" dir={isRtl ? 'rtl' : 'ltr'}>
      {items.map((b, i) => (
        <span key={i} className="flex flex-col items-center gap-1 min-w-[64px]">
          <b.icon size={17} className="text-teal-300" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-slate-300 text-center leading-tight">
            {isRtl ? b.ar[0] : b.en[0]}<br />{isRtl ? b.ar[1] : b.en[1]}
          </span>
        </span>
      ))}
    </div>
  );
}
