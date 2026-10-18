import { useEffect, useMemo, useState } from 'react';
import {
  Package, AppWindow, Layers, Download, ChevronRight, ShieldCheck,
  RefreshCw, Lightbulb, MonitorDown, Blocks, ListChecks
} from 'lucide-react';
import type { AdvancedSoftwarePreview, BridgeTool, PostInstallPreview, SoftwarePreview } from '../../lib/api';
import { api } from '../../lib/api';

interface SoftwareSpotlightProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  serviceTools: BridgeTool[];
  allTools: BridgeTool[];
  onSelectTool: (toolId: string) => void;
}

export default function SoftwareSpotlight({
  lang,
  bridgeOnline,
  serviceTools,
  allTools,
  onSelectTool,
}: SoftwareSpotlightProps) {
  const isRtl = lang === 'ar';
  const [software, setSoftware] = useState<SoftwarePreview | null>(null);
  const [swState, setSwState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [postInstall, setPostInstall] = useState<PostInstallPreview | null>(null);
  const [advanced, setAdvanced] = useState<AdvancedSoftwarePreview | null>(null);

  // Defer heavy previews until the bridge handshake completes so the
  // initial tool-contract load is never starved by registry scans.
  useEffect(() => {
    if (bridgeOnline !== true) return;
    let cancelled = false;
    setSwState('loading');
    api.softwarePreview()
      .then(({ preview }) => { if (!cancelled) { setSoftware(preview); setSwState('ready'); } })
      .catch(() => { if (!cancelled) setSwState('error'); });
    // Stagger follow-up scans so the bridge handles one job at a time.
    const t1 = window.setTimeout(() => {
      if (cancelled) return;
      api.postInstallPreview()
        .then(({ preview }) => { if (!cancelled) setPostInstall(preview); })
        .catch(() => { /* keep null -> unavailable states */ });
    }, 2500);
    const t2 = window.setTimeout(() => {
      if (cancelled) return;
      api.advancedSoftwarePreview()
        .then(({ preview }) => { if (!cancelled) setAdvanced(preview); })
        .catch(() => { /* keep null -> unavailable states */ });
    }, 5000);
    return () => { cancelled = true; window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [bridgeOnline]);

  const installedTotal = software?.Total ?? postInstall?.System.InstalledProgramCount ?? null;
  const topItems = useMemo(() => (software?.Items ?? []).slice(0, 6), [software]);
  const pendingUpdates = advanced?.Winget.Available ? advanced.Winget.UpgradeLines.length : null;
  const wingetLabel = !advanced
    ? (isRtl ? 'جارٍ الاستعلام…' : 'Querying…')
    : advanced.Winget.Available
      ? (isRtl ? 'متاح' : `v${advanced.Winget.Version ?? '?'}`)
      : (isRtl ? 'غير متاح' : 'Unavailable');
  const devRuntimes = advanced?.DeveloperTools ?? [];
  const devReady = devRuntimes.filter(d => d.Available).length;
  const catalog = postInstall?.Catalog ?? [];
  const catalogDetected = catalog.filter(c => c.Detected).length;
  const extensionsCount = advanced?.ChromeExtensions.length ?? null;

  const findTool = (id: string) => allTools.find(t => t.ToolId === id) ?? serviceTools.find(t => t.ToolId === id);
  const primaryTool = findTool('PA01') ?? serviceTools[0] ?? null;
  const runtimeTool = findTool('PA06') ?? null;

  const quickPicks = useMemo(() => {
    const ids = ['PA01', 'PA06', 'PA09'];
    const picked: BridgeTool[] = [];
    for (const id of ids) {
      const t = findTool(id);
      if (t && !picked.some(p => p.ToolId === t.ToolId)) picked.push(t);
      if (picked.length >= 4) break;
    }
    for (const t of serviceTools) {
      if (picked.length >= 4) break;
      if (!picked.some(p => p.ToolId === t.ToolId)) picked.push(t);
    }
    return picked.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTools, serviceTools]);

  const toolIcon = (toolId: string) => {
    if (toolId.startsWith('PI')) return Download;
    if (toolId.startsWith('SE')) return Layers;
    if (toolId.startsWith('PA')) return AppWindow;
    return Package;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Left: Software Catalog Preview ── */}
      <div className="rounded-2xl border border-violet-400/20 bg-[#0a0d24]/90 backdrop-blur-xl p-5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-violet-400/15 border border-violet-300/30 flex items-center justify-center shrink-0">
                <Package size={17} className="text-violet-300" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white flex-wrap">
                  <span>{isRtl ? 'مكتبة البرامج' : 'Software Library'}</span>
                  <ChevronRight size={14} className={`text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                  <span className="text-cyan-200">{isRtl ? 'معاينة الكتالوج وبيئات التشغيل' : 'Catalog & Runtime Preview'}</span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                  {isRtl
                    ? 'اكتشف البرامج المثبتة وبيئات التشغيل وإضافات المتصفح. راجع الكتالوج الأساسي قبل التثبيت أو الإدارة، وكل الفحوص للقراءة فقط.'
                    : 'Discover installed programs, runtime environments, and browser extensions. Review the essentials catalog before installing or managing — all scans are read-only.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-400/20 text-[11px] font-semibold text-violet-300 flex items-center gap-1.5">
                <Blocks size={12} />
                {isRtl ? `${serviceTools.length} أداة مكتبة` : `${serviceTools.length} Library Tools`}
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-5 flex items-center gap-0" role="list" aria-label={isRtl ? 'خطوات الكتالوج' : 'Catalog steps'}>
            {[
              { n: 1, tEn: 'Inventory', tAr: 'الجرد', sEn: swState === 'ready' ? 'Completed' : swState === 'error' ? 'Unavailable' : 'Running…', sAr: swState === 'ready' ? 'مكتمل' : swState === 'error' ? 'غير متوفر' : 'جارٍ…', done: swState === 'ready', active: swState !== 'ready' },
              { n: 2, tEn: 'Review Catalog', tAr: 'مراجعة الكتالوج', sEn: postInstall ? `${catalogDetected}/${catalog.length || '…'}` : '…', sAr: postInstall ? `${catalogDetected}/${catalog.length || '…'}` : '…', done: false, active: swState === 'ready' },
              { n: 3, tEn: 'Install & Manage', tAr: 'التثبيت والإدارة', sEn: 'Ready', sAr: 'جاهز', done: false, active: false },
              { n: 4, tEn: 'Verified', tAr: 'تم التحقق', sEn: 'Pending', sAr: 'بانتظار', done: false, active: false },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center flex-1 last:flex-none" role="listitem">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${s.done ? 'bg-violet-500 text-white border-violet-400 shadow-[0_0_14px_rgba(168,85,247,0.5)]' : s.active ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.5)]' : 'bg-white/5 text-slate-400 border-white/15'}`}>
                    {s.done ? '✓' : s.n}
                  </span>
                  <span className="hidden sm:block">
                    <span className={`block text-[11px] font-bold ${s.active || s.done ? 'text-white' : 'text-slate-400'}`}>{isRtl ? s.tAr : s.tEn}</span>
                    <span className="block text-[10px] text-violet-300/90">{isRtl ? s.sAr : s.sEn}</span>
                  </span>
                </div>
                {i < arr.length - 1 && <span className={`mx-2 md:mx-3 h-px flex-1 ${i === 0 && swState === 'ready' ? 'bg-gradient-to-r from-violet-400 to-cyan-500' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
            <div className="min-w-[130px]">
              <div className="text-[11px] text-slate-400 font-semibold">{isRtl ? 'البرامج المثبتة' : 'Installed Apps'}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                {swState === 'loading' ? '…' : swState === 'error' ? (isRtl ? 'غير متوفر' : 'N/A') : (installedTotal ?? (isRtl ? 'غير متوفر' : 'N/A'))}
              </div>
              <div className="text-[11px] text-slate-400">
                {software ? (isRtl ? `سطح مكتب ${software.DesktopCount} • متجر ${software.AppxCount}` : `Desktop ${software.DesktopCount} • Store ${software.AppxCount}`) : (isRtl ? 'بانتظار الجرد' : 'Awaiting inventory')}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs border-s border-white/10 ps-4">
              {swState === 'loading' && <span className="text-slate-500 col-span-2">{isRtl ? 'جارٍ جرد سجلات إلغاء التثبيت…' : 'Reading uninstall registry hives…'}</span>}
              {swState === 'error' && <span className="text-amber-300 col-span-2">{isRtl ? 'تعذر تحميل المعاينة — الجسر أو الجرد غير متاح.' : 'Preview unavailable — bridge or inventory not reachable.'}</span>}
              {topItems.map(item => (
                <div key={`${item.Kind}-${item.Name}`} className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">{item.Name}</span>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">{item.Version || '—'}</span>
                </div>
              ))}
              {swState === 'ready' && topItems.length === 0 && (
                <span className="text-slate-400 col-span-2">{isRtl ? 'لا توجد عناصر مخزنة.' : 'No inventoried items.'}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-[190px]">
              <button
                type="button"
                disabled={!primaryTool}
                onClick={() => primaryTool && onSelectTool(primaryTool.ToolId)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 disabled:opacity-40 shadow-[0_0_22px_rgba(124,58,237,0.45)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRtl ? 'تصفح الكتالوج' : 'Browse Catalog'}
                <ChevronRight size={15} className={isRtl ? 'rotate-180' : ''} />
              </button>
              <p className="text-[10px] text-slate-500 leading-relaxed flex gap-1.5">
                <ListChecks size={12} className="shrink-0 mt-0.5 text-violet-400" />
                {isRtl ? 'الجرد للقراءة فقط ولا يثبت أو يزيل أي برنامج دون اختيارك.' : 'Inventory is read-only — nothing installs or uninstalls without your selection.'}
              </p>
            </div>
          </div>

          {/* Additional tools */}
          <div className="mt-4">
            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-2">
              {isRtl ? `أدوات مميزة في المكتبة (${serviceTools.length})` : `FEATURED LIBRARY TOOLS (${serviceTools.length})`}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {quickPicks.map(t => {
                const Icon = toolIcon(t.ToolId);
                return (
                  <button
                    key={t.ToolId}
                    type="button"
                    onClick={() => onSelectTool(t.ToolId)}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-violet-400/40 hover:bg-violet-400/5 flex items-center gap-2 text-xs font-semibold text-slate-200 transition-colors cursor-pointer text-start"
                    title={isRtl ? t.ArabicName : t.EnglishName}
                  >
                    <Icon size={15} className="text-violet-400 shrink-0" />
                    <span className="truncate">{isRtl ? t.ArabicName : t.EnglishName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Library column ── */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a0d24]/90 backdrop-blur-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase">{isRtl ? 'نظرة على المكتبة' : 'Library Overview'}</h3>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${bridgeOnline === true ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {bridgeOnline === true ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير متصل' : 'Offline')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-violet-300 font-bold flex items-center gap-1.5"><AppWindow size={13} /> {isRtl ? 'البرامج المثبتة' : 'Installed Apps'}</span>
              <span className="text-base font-extrabold text-white font-mono">{installedTotal ?? (isRtl ? 'غير متوفر' : 'N/A')}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5"><MonitorDown size={13} /> {isRtl ? 'تحديثات معلقة' : 'Pending Updates'}</span>
              <span className="text-base font-extrabold text-white font-mono">
                {pendingUpdates ?? (isRtl ? 'غير متوفر' : 'N/A')}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-sky-300 font-bold flex items-center gap-1.5"><Layers size={13} /> {isRtl ? 'بيئات جاهزة' : 'Runtimes Ready'}</span>
              <span className="text-base font-extrabold text-white font-mono">
                {advanced ? `${devReady}/${devRuntimes.length}` : (isRtl ? 'غير متوفر' : 'N/A')}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-emerald-300 font-bold flex items-center gap-1.5"><ShieldCheck size={13} /> {isRtl ? 'كتالوج أساسي' : 'Essentials Found'}</span>
              <span className="text-base font-extrabold text-white font-mono">
                {postInstall ? `${catalogDetected}/${catalog.length}` : (isRtl ? 'غير متوفر' : 'N/A')}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>{isRtl ? 'مصدر الحزم winget' : 'winget source'}</span>
            <span className="font-mono font-bold text-slate-200">{wingetLabel}</span>
          </div>
          {extensionsCount !== null && (
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>{isRtl ? 'إضافات كروم المرصودة' : 'Chrome extensions seen'}</span>
              <span className="font-mono font-bold text-slate-200">{extensionsCount}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.07] to-transparent p-4 shadow-xl">
          <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase mb-2">{isRtl ? 'التوصية' : 'Recommendation'}</h3>
          <div className="flex gap-2.5">
            <Lightbulb size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-200 leading-relaxed">
                {pendingUpdates !== null && pendingUpdates > 0
                  ? (isRtl ? `توجد ${pendingUpdates} تحديثات معلقة — راجعها قبل التثبيت.` : `${pendingUpdates} pending updates — review before installing.`)
                  : swState === 'ready' && installedTotal !== null
                    ? (isRtl
                        ? `اكتمل الجرد — ${installedTotal} برنامج موثق.${advanced && !advanced.Winget.Available ? ' مصدر winget غير متاح لفحص التحديثات.' : ''}`
                        : `Inventory complete — ${installedTotal} programs catalogued.${advanced && !advanced.Winget.Available ? ' winget source unavailable for update checks.' : ''}`)
                    : (isRtl ? 'شغّل جرد البرامج أولًا لقياس حالة المكتبة الحقيقية.' : 'Run the program inventory first to measure true library state.')}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!runtimeTool}
                  onClick={() => runtimeTool && onSelectTool(runtimeTool.ToolId)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {isRtl ? 'فحص بيئات التشغيل' : 'Run Runtime Scan'}
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SoftwareHeroBadges({ lang }: { lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  const items = [
    { icon: AppWindow, en: ['PROGRAMS', 'CATALOG'], ar: ['كتالوج', 'البرامج'] },
    { icon: Layers, en: ['RUNTIMES', 'READY'], ar: ['بيئات', 'جاهزة'] },
    { icon: Download, en: ['POST-INSTALL', 'SETUP'], ar: ['تجهيز', 'ما بعد التثبيت'] },
    { icon: ShieldCheck, en: ['ESSENTIALS', 'TRUSTED'], ar: ['أساسيات', 'موثوقة'] },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 md:gap-6 pt-1" dir={isRtl ? 'rtl' : 'ltr'}>
      {items.map((b, i) => (
        <span key={i} className="flex flex-col items-center gap-1 min-w-[64px]">
          <b.icon size={17} className="text-violet-300" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-slate-300 text-center leading-tight">
            {isRtl ? b.ar[0] : b.en[0]}<br />{isRtl ? b.ar[1] : b.en[1]}
          </span>
        </span>
      ))}
    </div>
  );
}
