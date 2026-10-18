import { useMemo } from 'react';
import {
  Shield, Wifi, Lock, Eye, Cpu, ChevronRight, ShieldCheck,
  RefreshCw, Lightbulb, Radio, Globe, UserCheck
} from 'lucide-react';
import type { BridgeTool, SystemSnapshot } from '../../lib/api';

interface AssuranceSpotlightProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  systemSnapshot?: SystemSnapshot | null;
  serviceTools: BridgeTool[];
  allTools: BridgeTool[];
  onSelectTool: (toolId: string) => void;
}

export default function AssuranceSpotlight({
  lang,
  bridgeOnline,
  systemSnapshot,
  serviceTools,
  allTools,
  onSelectTool,
}: AssuranceSpotlightProps) {
  const isRtl = lang === 'ar';
  const defenderOn = systemSnapshot?.DefenderRealtime;

  const findTool = (id: string) => allTools.find(t => t.ToolId === id) ?? serviceTools.find(t => t.ToolId === id);
  const primaryTool = findTool('NI01') ?? findTool('SC01') ?? serviceTools[0] ?? null;

  const quickPicks = useMemo(() => {
    const ids = ['NI01', 'NI04', 'SC01', 'DV01', 'PR01'];
    const picked: BridgeTool[] = [];
    for (const id of ids) {
      const t = findTool(id);
      if (t) picked.push(t);
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
    if (toolId.startsWith('NI')) return Wifi;
    if (toolId.startsWith('SC') || toolId.startsWith('SE')) return Lock;
    if (toolId.startsWith('PR')) return Eye;
    return Cpu;
  };

  // Counts are computed from the live tool contract, never hardcoded: a
  // hardcoded "29 Protection Tools" would rot the next time the manifest
  // gains or loses a tool. Unknown stays unknown until tools arrive.
  const countFor = (prefixes: string[]) =>
    serviceTools.filter(t => prefixes.some(p => t.ToolId.startsWith(p))).length;
  const networkCount = countFor(['NI']);
  const securityCount = countFor(['SE']);
  const privacyCount = countFor(['PR']);
  const driversCount = countFor(['DV']);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Left: Interactive Network & Protection Preview ── */}
      <div className="rounded-2xl border border-emerald-400/20 bg-[#070e1c]/90 backdrop-blur-xl p-5 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-emerald-400/15 border border-emerald-300/30 flex items-center justify-center shrink-0">
                <Shield size={17} className="text-emerald-300" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white flex-wrap">
                  <span>{isRtl ? 'الضمان والحماية' : 'Assurance & Protection'}</span>
                  <ChevronRight size={14} className={`text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                  <span className="text-cyan-200">{isRtl ? 'معاينة الشبكة والحماية الحية' : 'Live Network & Security Radar'}</span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                  {isRtl
                    ? 'فحص استقرار الاتصال، ضوابط جدار الحماية، أمان التعريفات، وسلامة خصوصية المستخدم عبر أدوات الحماية المعتمدة.'
                    : 'Audit connectivity stability, firewall controls, driver signatures, and privacy boundaries with verified protection tools.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                <Radio size={12} className="animate-pulse" />
                {isRtl ? `${serviceTools.length} أداة حماية` : `${serviceTools.length} Protection Tools`}
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-5 flex items-center gap-0" role="list" aria-label={isRtl ? 'مراحل فحص الأمان' : 'Security audit steps'}>
            {[
              { n: 1, tEn: 'Connectivity', tAr: 'الاتصال', sEn: bridgeOnline === true ? 'Verified' : 'Checking…', sAr: bridgeOnline === true ? 'مؤكد' : 'فحص…', done: bridgeOnline === true, active: bridgeOnline === null },
              { n: 2, tEn: 'Firewall & Shield', tAr: 'جدار الحماية', sEn: defenderOn !== undefined ? (defenderOn ? 'Active' : 'Unverified') : 'Querying…', sAr: defenderOn !== undefined ? (defenderOn ? 'نشط' : 'غير مؤكد') : 'استعلام…', done: defenderOn === true, active: bridgeOnline === true },
              { n: 3, tEn: 'Driver Signatures', tAr: 'توقيع التعريفات', sEn: 'Ready', sAr: 'جاهز', done: false, active: false },
              { n: 4, tEn: 'Privacy Audit', tAr: 'تدقيق الخصوصية', sEn: 'Ready', sAr: 'جاهز', done: false, active: false },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center flex-1 last:flex-none" role="listitem">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${s.done ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.5)]' : s.active ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.5)]' : 'bg-white/5 text-slate-400 border-white/15'}`}>
                    {s.done ? '✓' : s.n}
                  </span>
                  <span className="hidden sm:block">
                    <span className={`block text-[11px] font-bold ${s.active || s.done ? 'text-white' : 'text-slate-400'}`}>{isRtl ? s.tAr : s.tEn}</span>
                    <span className="block text-[10px] text-emerald-300/90">{isRtl ? s.sAr : s.sEn}</span>
                  </span>
                </div>
                {i < arr.length - 1 && <span className={`mx-2 md:mx-3 h-px flex-1 ${i === 0 && bridgeOnline === true ? 'bg-gradient-to-r from-emerald-400 to-cyan-500' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {/* Results Grid */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
            <div className="min-w-[130px]">
              <div className="text-[11px] text-slate-400 font-semibold">{isRtl ? 'حالة الأمان' : 'Security Status'}</div>
              <div className="text-xl md:text-2xl font-extrabold text-emerald-300 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={22} className="text-emerald-400" />
                <span>{defenderOn === true ? (isRtl ? 'نشط' : 'Active') : defenderOn === false ? (isRtl ? 'غير مؤكد' : 'Unverified') : (isRtl ? 'غير معروف' : 'Unknown')}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{isRtl ? 'حماية ويندوز الحقيقية' : 'Windows Realtime Defense'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs border-s border-white/10 ps-4">
              <div className="flex items-center justify-between gap-2 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Wifi size={13} className="text-cyan-400" />
                  <span>{isRtl ? 'حالة الشبكة' : 'Network Link'}</span>
                </span>
                <span className="font-mono font-bold text-emerald-300">{bridgeOnline === true ? (isRtl ? 'متصل' : 'Connected') : (isRtl ? 'غير متصل' : 'Offline')}</span>
              </div>

              <div className="flex items-center justify-between gap-2 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Lock size={13} className="text-emerald-400" />
                  <span>{isRtl ? 'جدار الحماية' : 'Windows Firewall'}</span>
                </span>
                <span className="font-mono font-bold text-white">{defenderOn === true ? (isRtl ? 'مُفعّل' : 'Enabled') : defenderOn === false ? (isRtl ? 'غير مؤكد' : 'Unverified') : (isRtl ? 'غير معروف' : 'Unknown')}</span>
              </div>

              <div className="flex items-center justify-between gap-2 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Cpu size={13} className="text-violet-400" />
                  <span>{isRtl ? 'توقيع التعريفات' : 'Driver Signatures'}</span>
                </span>
                <span className="font-mono font-bold text-slate-400">{isRtl ? 'لم يُدقَّق بعد' : 'Not audited yet'}</span>
              </div>

              <div className="flex items-center justify-between gap-2 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Eye size={13} className="text-sky-400" />
                  <span>{isRtl ? 'مستوى الخصوصية' : 'Privacy Shield'}</span>
                </span>
                <span className="font-mono font-bold text-slate-400">{isRtl ? 'لم يُدقَّق بعد' : 'Not audited yet'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[190px]">
              <button
                type="button"
                disabled={!primaryTool}
                onClick={() => primaryTool && onSelectTool(primaryTool.ToolId)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 shadow-[0_0_22px_rgba(16,185,129,0.45)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRtl ? 'بدء فحص الشبكة والأمان' : 'Run Assurance Audit'}
                <ChevronRight size={15} className={isRtl ? 'rotate-180' : ''} />
              </button>
              <p className="text-[10px] text-slate-500 leading-relaxed flex gap-1.5">
                <ShieldCheck size={12} className="shrink-0 mt-0.5 text-emerald-400" />
                {isRtl ? 'جميع عمليات الفحص للقراءة فقط ولا تجري تعديلات دون إذنك.' : 'All audits run in safe read-only mode until confirmed by you.'}
              </p>
            </div>
          </div>

          {/* Additional tools */}
          <div className="mt-4">
            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-2">
              {isRtl ? `أدوات مميزة في الحماية والشبكات (${serviceTools.length})` : `FEATURED ASSURANCE TOOLS (${serviceTools.length})`}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {quickPicks.map(t => {
                const Icon = toolIcon(t.ToolId);
                return (
                  <button
                    key={t.ToolId}
                    type="button"
                    onClick={() => onSelectTool(t.ToolId)}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-400/5 flex items-center gap-2 text-xs font-semibold text-slate-200 transition-colors cursor-pointer text-start"
                    title={isRtl ? t.ArabicName : t.EnglishName}
                  >
                    <Icon size={15} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{isRtl ? t.ArabicName : t.EnglishName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Sentinel Protection States ── */}
      <div className="flex flex-col gap-4">
        {/* Protection Radar */}
        <div className="rounded-2xl border border-white/10 bg-[#070e1c]/90 backdrop-blur-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase">{isRtl ? 'رادار حمايةSentinel' : 'Sentinel Protection Radar'}</h3>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${bridgeOnline === true ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {bridgeOnline === true ? (isRtl ? 'نشط' : 'Active') : bridgeOnline === false ? (isRtl ? 'غير متصل' : 'Offline') : (isRtl ? 'غير معروف' : 'Unknown')}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-white/5">
            {[
              { icon: Globe, c: 'text-cyan-300', tEn: 'Network Perimeter', tAr: 'محيط الشبكة', v: bridgeOnline === true ? (isRtl ? 'الجسر متصل' : 'Bridge connected') : (isRtl ? 'غير متصل' : 'Offline') },
              { icon: Lock, c: 'text-emerald-300', tEn: 'Windows Defender', tAr: 'مدافع ويندوز', v: defenderOn === true ? (isRtl ? 'الحماية اللحظية نَشِطة' : 'Real-Time Active') : (isRtl ? 'غير مؤكد' : 'Unverified') },
              { icon: UserCheck, c: 'text-sky-300', tEn: 'Privacy Boundaries', tAr: 'حدود الخصوصية', v: isRtl ? 'لم يُدقَّق بعد' : 'Not audited yet' },
              { icon: Cpu, c: 'text-violet-300', tEn: 'Signed Drivers', tAr: 'التعريفات الموقعة', v: isRtl ? 'لم يُدقَّق بعد' : 'Not audited yet' },
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

        {/* Services summary card */}
        <div className="rounded-2xl border border-white/10 bg-[#070e1c]/90 backdrop-blur-xl p-4 shadow-xl">
          <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase mb-2">{isRtl ? 'خدمات الحماية' : 'Assurance Services'}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5"><Wifi size={13} /> {isRtl ? 'الشبكة' : 'Network'}</span>
              <span className="text-[11px] text-slate-400 font-mono">{networkCount} {isRtl ? 'أداة' : 'tools'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5"><Lock size={13} /> {isRtl ? 'الأمان' : 'Security'}</span>
              <span className="text-[11px] text-slate-400 font-mono">{securityCount} {isRtl ? 'أداة' : 'tools'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-sky-400 font-bold flex items-center gap-1.5"><Eye size={13} /> {isRtl ? 'الخصوصية' : 'Privacy'}</span>
              <span className="text-[11px] text-slate-400 font-mono">{privacyCount} {isRtl ? 'أدوات' : 'tools'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
              <span className="text-violet-400 font-bold flex items-center gap-1.5"><Cpu size={13} /> {isRtl ? 'التعريفات' : 'Drivers'}</span>
              <span className="text-[11px] text-slate-400 font-mono">{driversCount} {isRtl ? 'أدوات' : 'tools'}</span>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/[0.07] to-transparent p-4 shadow-xl">
          <h3 className="text-xs font-bold tracking-widest text-slate-300 uppercase mb-2">{isRtl ? 'التوصية الأمنية' : 'Security Recommendation'}</h3>
          <div className="flex gap-2.5">
            <Lightbulb size={18} className="text-emerald-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-200 leading-relaxed">
                {isRtl
                  ? 'قم بإجراء فحص شامل للشبكة وجدار الحماية بانتظام للتحقق من خلو الحاسوب من الثغرات.'
                  : 'Run regular network and firewall audits to verify device isolation and connection health.'}
              </p>
              <button
                type="button"
                disabled={!primaryTool}
                onClick={() => primaryTool && onSelectTool(primaryTool.ToolId)}
                className="mt-2.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                {isRtl ? 'إجراء فحص الحماية الآن' : 'Run Audit Now'}
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssuranceHeroBadges({ lang }: { lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  const items = [
    { icon: ShieldCheck, en: ['PROTECTED', 'DEVICE'], ar: ['جهاز', 'محمي'] },
    { icon: Wifi, en: ['SECURE', 'NETWORK'], ar: ['شبكة', 'آمنة'] },
    { icon: Lock, en: ['FIREWALL', 'ACTIVE'], ar: ['جدار حماية', 'نشط'] },
    { icon: Eye, en: ['PRIVACY', 'SHIELD'], ar: ['درع', 'الخصوصية'] },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 md:gap-6 pt-1" dir={isRtl ? 'rtl' : 'ltr'}>
      {items.map((b, i) => (
        <span key={i} className="flex flex-col items-center gap-1 min-w-[64px]">
          <b.icon size={17} className="text-emerald-300" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-slate-300 text-center leading-tight">
            {isRtl ? b.ar[0] : b.en[0]}<br />{isRtl ? b.ar[1] : b.en[1]}
          </span>
        </span>
      ))}
    </div>
  );
}
