import { useState, useCallback } from 'react';
import {
  Sparkles, ArrowRight, ArrowLeft, ShieldCheck, Activity, Database,
  Shield, Package, Code2, Search, Loader2, CheckCircle2, AlertTriangle,
  RotateCcw
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
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);

  const runDiagnosticScan = useCallback(async () => {
    if (!bridgeOnline) return;
    setScanning(true);
    setProgressPercent(10);
    setScanStage(isRtl ? 'فحص مقاييس الحيوية والأداء...' : 'Inspecting system vitals & memory pressure...');

    const discoveredFindings: ScanFinding[] = [];

    try {
      // Step 1: System snapshot
      const sysRes = await api.system().catch(() => null);
      setProgressPercent(35);
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
            titleEn: 'Defender Real-Time Protection Inactive',
            titleAr: 'حماية Windows Defender بالوقت الحقيقي غير نشطة',
            detailEn: 'Real-time antivirus defense appears disabled or unmanaged.',
            detailAr: 'حماية مكافحة الفيروسات الفورية معطلة أو غير مدارة بشكل صحيح.',
            metric: 'Protection Inactive',
            dest: { family: 'assurance', service: '09-Security', toolId: 'SC01' },
            actionLabelEn: 'Audit Security Posture (SC01)',
            actionLabelAr: 'تدقيق الأمان (SC01)'
          });
        }
      }

      // Step 2: Cleanup preview
      setProgressPercent(65);
      setScanStage(isRtl ? 'تدقيق ملفات التخزين المؤقت والمخلفات...' : 'Auditing cache repositories & temporary files...');
      const cleanRes = await api.cleanupPreview().catch(() => null);

      if (cleanRes?.preview) {
        const clean = cleanRes.preview;
        const totalBytes = clean.Summary?.EstimatedReclaimableBytes ?? 0;
        const totalMb = totalBytes / (1024 * 1024);
        if (totalMb > 100) {
          const formattedSize = totalMb >= 1024 ? `${(totalMb / 1024).toFixed(2)} GB` : `${Math.round(totalMb)} MB`;
          discoveredFindings.push({
            id: 'cache-cleanup-eligible',
            severity: totalMb > 2048 ? 'warning' : 'optimal',
            titleEn: 'Reclaimable Temporary Cache Detected',
            titleAr: 'ملفات مؤقتة قابلة للتنظيف بأمان',
            detailEn: `Discovered approximately ${formattedSize} of disposable temp files and system log residue.`,
            detailAr: `تم اكتشاف ما يقارب ${formattedSize} من الملفات المؤقتة وسجلات النظام المؤهلة للعزل والتنظيف.`,
            metric: formattedSize,
            dest: { family: 'recovery', service: '02-System-Cleanup', toolId: 'CL01' },
            actionLabelEn: 'Clean System Caches (CL01)',
            actionLabelAr: 'تنظيف المخلفات (CL01)'
          });
        }
      }

      // Step 3: Drivers preview
      setProgressPercent(85);
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

      setProgressPercent(100);
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Hero / AI Scanner Orb */}
      <div className="flex flex-col items-center text-center">
        <div className="relative w-36 h-36 mb-6 flex items-center justify-center">
          {/* Animated halo rings */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="absolute inset-2 border border-cyan-500/30 rounded-full animate-spin" style={{ animationDuration: '15s' }} />
          <div className="absolute inset-4 border border-violet-500/40 rounded-full animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />

          <motion.div
            animate={{ scale: scanning ? [1, 1.12, 1] : [1, 1.06, 1] }}
            transition={{ duration: scanning ? 1.5 : 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-full bg-slate-950/80 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,238,0.35)] backdrop-blur-xl z-10"
          >
            {scanning ? (
              <Loader2 size={36} className="text-cyan-400 animate-spin" />
            ) : (
              <Sparkles size={40} className="text-cyan-400" />
            )}
          </motion.div>
        </div>

        <h1 className="text-4xl font-black text-white mb-3 tracking-tight font-display">
          KNOUX <span className="text-cyan-400">AI Scan</span>
        </h1>
        <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed mb-6">
          {isRtl
            ? 'نظام الفحص والتوجيه الاستراتيجي. تشخيص عميق للبنية التحتية عبر استدعاءات المعاينة الآمنة، وتوجيه مباشر نحو أدوات الإصلاح الكنسية.'
            : 'Autonomous diagnostic and system guidance engine. Executes safe read-only audits across subsystems and deep-links directly into canonical repair tools.'}
        </p>

        {/* Scan Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={runDiagnosticScan}
            disabled={scanning || !bridgeOnline}
            className={clsx(
              "knoux-btn knoux-btn-primary px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2.5 shadow-[0_0_25px_rgba(124,58,237,0.4)] hover:shadow-[0_0_35px_rgba(124,58,237,0.6)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
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
                <Sparkles size={16} />
                <span>{findings ? (isRtl ? 'إعادة تشغيل الفحص' : 'Rerun AI Scan') : (isRtl ? 'بدء الفحص الذكي الشامل' : 'Start AI Scan')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ family: 'recovery', service: '02-System-Cleanup' })}
            className="knoux-btn knoux-btn-secondary px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer"
          >
            {isRtl ? 'فحص التخزين والاسترداد' : 'Inspect Storage'}
          </button>
        </div>

        {/* Progress Bar when scanning */}
        {scanning && (
          <div className="w-full max-w-md mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-mono">{scanStage}</span>
              <span className="font-mono font-bold text-cyan-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Engine Status Tag */}
        <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className={clsx("w-2 h-2 rounded-full", bridgeOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-400")} />
          <span>
            {bridgeOnline
              ? `${isRtl ? 'محرك الفحص نشط' : 'Diagnostic Engine Ready'} (${toolCount ?? 158} ${isRtl ? 'أداة مسجلة' : 'canonical tools'})${scanTimestamp ? ` • ${isRtl ? 'آخر فحص:' : 'Last scan:'} ${scanTimestamp}` : ''}`
              : (isRtl ? 'الجسر المحلي مفصول — شغل خادم الجسر للبدء' : 'Local Bridge Offline — start bridge server')}
          </span>
        </div>
      </div>

      {/* Discovered Findings Section */}
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
                  {findings.length} {isRtl ? 'ملاحظة' : 'findings'}
                </span>
              </div>
              <button
                type="button"
                onClick={runDiagnosticScan}
                disabled={scanning}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={12} />
                <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>

            {findings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRtl ? 'النظام في حالة مستقرة ومثالية' : 'All Inspected Subsystems Operating Within Normal Parameters'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isRtl
                    ? 'لم يتم العثور على أخطاء حرجة في الذاكرة أو أقراص النظام أو برامج التشغيل أثناء هذا الفحص.'
                    : 'No critical memory pressure, drive saturation, or hardware faults were detected during this scan cycle.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {findings.map(finding => (
                  <div
                    key={finding.id}
                    className={clsx(
                      "p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all",
                      finding.severity === 'critical'
                        ? "bg-red-500/[0.06] border-red-500/30"
                        : finding.severity === 'warning'
                          ? "bg-amber-500/[0.06] border-amber-500/30"
                          : "bg-cyan-500/[0.04] border-cyan-500/20"
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
