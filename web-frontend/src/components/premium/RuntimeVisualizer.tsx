/**
 * KNOUX Repair — RuntimeVisualizer.
 *
 * ONE shell, category-adaptive interior. Every pixel is driven by REAL
 * runtime props: status, log lines, measured elapsed time, system snapshot,
 * bridge state, structured run result. When data is unavailable the
 * visualizer says so — it never invents telemetry.
 */
import { Activity, Cpu, MemoryStick, HardDrive, Timer, TerminalSquare, ShieldAlert, CheckCircle2, XCircle, Ban } from 'lucide-react';
import clsx from 'clsx';
import type { BridgeTool, SystemSnapshot, KnouxRunResult } from '../../lib/api';
import type { ServiceId } from '../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../types';

export type VizPhase = 'standby' | 'ready' | 'running' | 'done' | 'failed' | 'cancelled';

interface RuntimeVisualizerProps {
  serviceId: ServiceId | null;
  tool: BridgeTool | null;
  status: ToolStatus;
  lines: ConsoleEntry[];
  elapsedSec: number | null;
  snapshot: SystemSnapshot | null;
  bridgeOnline: boolean | null;
  result: KnouxRunResult | null;
  lang: 'en' | 'ar';
  standbyTitle?: string;
  standbyPurpose?: string;
  standbyServiceTools?: number | null;
  standbyFamilyTools?: number | null;
}

type Category = 'health' | 'storage' | 'duplicates' | 'network' | 'security' | 'software' | 'developer' | 'diagnostics';

function categoryFor(serviceId: ServiceId | null): Category {
  switch (serviceId) {
    case '01-System-Maintenance':
    case '08-Performance':
    case '15-System-Monitoring':
      return 'health';
    case '02-System-Cleanup':
    case '06-Disk-Space':
    case '11-Backup-Recovery':
      return 'storage';
    case '05-Duplicate-Files':
      return 'duplicates';
    case '03-Network-Internet':
      return 'network';
    case '09-Security':
    case '13-Privacy':
    case '14-Driver-Management':
      return 'security';
    case '04-Programs-Applications':
    case '16-Software-Environment':
    case '17-PostInstall-Setup':
      return 'software';
    case '12-Developer-Tools':
    case '18-Project-Sonar':
      return 'developer';
    default:
      return 'diagnostics';
  }
}

const STAGES: Record<Category, { en: string; ar: string }[]> = {
  health: [
    { en: 'Sample', ar: 'أخذ عينة' },
    { en: 'CPU / RAM', ar: 'المعالج / الذاكرة' },
    { en: 'Processes', ar: 'العمليات' },
    { en: 'Verdict', ar: 'النتيجة' },
  ],
  storage: [
    { en: 'Source', ar: 'المصدر' },
    { en: 'Scan', ar: 'المسح' },
    { en: 'Candidates', ar: 'المرشحات' },
    { en: 'Action', ar: 'الإجراء' },
  ],
  duplicates: [
    { en: 'Scan', ar: 'المسح' },
    { en: 'Hash', ar: 'البصمة' },
    { en: 'Groups', ar: 'المجموعات' },
    { en: 'Results', ar: 'النتائج' },
  ],
  network: [
    { en: 'Endpoints', ar: 'النقاط' },
    { en: 'Tests', ar: 'الاختبارات' },
    { en: 'Quality', ar: 'الجودة' },
    { en: 'Report', ar: 'التقرير' },
  ],
  security: [
    { en: 'Checks', ar: 'الفحوصات' },
    { en: 'Findings', ar: 'النتائج' },
    { en: 'Severity', ar: 'الخطورة' },
    { en: 'Verdict', ar: 'الحكم' },
  ],
  software: [
    { en: 'Inventory', ar: 'الجرد' },
    { en: 'Inspect', ar: 'الفحص' },
    { en: 'Runtimes', ar: 'البيئات' },
    { en: 'Report', ar: 'التقرير' },
  ],
  developer: [
    { en: 'Workspace', ar: 'المساحة' },
    { en: 'Toolchain', ar: 'الأدوات' },
    { en: 'Gaps', ar: 'الفجوات' },
    { en: 'Handoff', ar: 'التسليم' },
  ],
  diagnostics: [
    { en: 'Observe', ar: 'المراقبة' },
    { en: 'Capture', ar: 'الالتقاط' },
    { en: 'Correlate', ar: 'الربط' },
    { en: 'Evidence', ar: 'الدليل' },
  ],
};

export function phaseFor(status: ToolStatus, hasTool: boolean): VizPhase {
  if (!hasTool) return 'standby';
  switch (status) {
    case 'running': return 'running';
    case 'success':
    case 'inconclusive': return 'done';
    case 'error': return 'failed';
    case 'cancelled': return 'cancelled';
    default: return 'ready';
  }
}

function fmtElapsed(sec: number | null): string {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RuntimeVisualizer(props: RuntimeVisualizerProps) {
  const { serviceId, tool, status, lines, elapsedSec, snapshot, bridgeOnline, lang } = props;
  const { standbyTitle, standbyPurpose, standbyServiceTools, standbyFamilyTools } = props;
  const isRtl = lang === 'ar';
  const category = categoryFor(serviceId);
  const phase = phaseFor(status, Boolean(tool));
  const stages = STAGES[category];

  const errCount = lines.filter(l => l.type === 'error').length;
  const warnCount = lines.filter(l => l.type === 'warning').length;

  // Stage activation — strictly from observed runtime signals.
  const done = phase === 'done' || phase === 'failed' || phase === 'cancelled';
  const stageOn = [phase === 'running' || done, lines.length >= 3 || done, lines.length >= 10 || errCount > 0 || done, done];
  const stageDone = [done, done && lines.length >= 3, done && (lines.length >= 10 || errCount > 0), phase === 'done'];

  const recent = lines.slice(-14).reverse();

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Stage pipeline */}
      <div className="cc-stage-pipe" aria-hidden="false">
        {stages.map((st, i) => (
          <div key={st.en} style={{ display: 'contents' }}>
            {i > 0 && <span className="cc-stage-link" data-on={stageOn[i] || stageOn[i - 1]} />}
            <div className="cc-stage" data-on={stageOn[i]} data-done={stageDone[i]}>
              <b>{isRtl ? st.ar : st.en}</b>
              <span>
                {i === 0 && (phase === 'running' || done ? (isRtl ? 'نشط' : 'live') : (isRtl ? 'بانتظار التشغيل' : 'awaiting run'))}
                {i === 1 && (lines.length > 0 ? `${lines.length} ${isRtl ? 'حدث' : 'events'}` : '—')}
                {i === 2 && (errCount + warnCount > 0 ? `${errCount + warnCount} ${isRtl ? 'تنبيه' : 'flags'}` : lines.length >= 10 ? (isRtl ? 'يتدفق' : 'streaming') : '—')}
                {i === 3 && (phase === 'done' ? (isRtl ? 'مكتمل' : 'complete') : phase === 'failed' ? (isRtl ? 'فشل' : 'failed') : phase === 'cancelled' ? (isRtl ? 'ملغي' : 'cancelled') : '—')}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="cc-viz-body">
        <div className="cc-viz-main">
          {(category === 'health' || category === 'diagnostics') && (
            <HealthMeters snapshot={snapshot} bridgeOnline={bridgeOnline} lang={lang} live={phase === 'running'} />
          )}
          {category === 'storage' && (
            <DriveMeters snapshot={snapshot} bridgeOnline={bridgeOnline} lang={lang} />
          )}
          {(category === 'security' || category === 'network' || category === 'software' || category === 'developer' || category === 'duplicates') && (
            <SignalMeters
              lines={lines.length}
              errors={errCount}
              warnings={warnCount}
              elapsed={fmtElapsed(elapsedSec)}
              phase={phase}
              lang={lang}
            />
          )}
          {/* Live event stream — the honest core of the visualizer */}
          <div className="cc-event-stream" role="log" aria-label={isRtl ? 'الأحداث الحية' : 'Live runtime events'}>
            {recent.length === 0 ? (
              <div className="cc-stream-empty">
                <TerminalSquare size={20} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                {phase === 'standby' && standbyTitle ? (
                  <div style={{ maxWidth: 420 }}>
                    <div style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>{standbyTitle}</div>
                    {standbyPurpose && <div style={{ color: '#8ea0b8', fontSize: 10, lineHeight: 1.7, marginBottom: 6 }}>{standbyPurpose}</div>}
                    <div style={{ fontFamily: 'monospace', fontSize: 9.5, color: '#64748b' }}>
                      {standbyServiceTools !== null && standbyServiceTools !== undefined ? `${standbyServiceTools} ${isRtl ? 'أداة في الخدمة' : 'service tools'}` : ''}
                      {standbyFamilyTools !== null && standbyFamilyTools !== undefined ? ` · ${standbyFamilyTools} ${isRtl ? 'في العائلة' : 'family tools'}` : ''}
                    </div>
                  </div>
                ) : phase === 'standby'
                  ? (isRtl ? 'اختر أداة من السكة اليمنى لبدء جلسة حية' : 'Select a tool from the right rail to begin a live session')
                  : phase === 'ready'
                    ? (isRtl ? 'جاهز — الأحداث الحقيقية ستظهر هنا عند التشغيل' : 'Ready — real runtime events will stream here on Run')
                    : (isRtl ? 'بانتظار أحداث التشغيل…' : 'Awaiting runtime events…')}
              </div>
            ) : (
              recent.map(ev => (
                <div key={ev.id} className={clsx('ev', ev.type === 'error' && 'err')}>
                  <span style={{ opacity: 0.45 }}>[{ev.timestamp}]</span> {ev.text}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cc-viz-side">
          <PhaseCard phase={phase} tool={tool} status={status} elapsed={fmtElapsed(elapsedSec)} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function HealthMeters({ snapshot, bridgeOnline, lang, live }: { snapshot: SystemSnapshot | null; bridgeOnline: boolean | null; lang: 'en' | 'ar'; live: boolean }) {
  const isRtl = lang === 'ar';
  if (!snapshot) {
    return (
      <div style={{ fontSize: 10.5, color: '#64748b', padding: '10px 2px' }}>
        {bridgeOnline === false
          ? (isRtl ? 'القياسات غير متاحة — الجسر مفصول.' : 'Metrics unavailable — bridge offline.')
          : (isRtl ? 'جارٍ تحميل القياسات الحية…' : 'Loading live metrics…')}
      </div>
    );
  }
  const ramPct = snapshot.TotalRamGB > 0 ? Math.round(((snapshot.TotalRamGB - snapshot.FreeRamGB) / snapshot.TotalRamGB) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div className="cc-meter">
        <label><Cpu size={11} style={{ display: 'inline', verticalAlign: -1 }} /> CPU</label>
        <div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, snapshot.CpuLoad))}%` }} /></div>
        <output>{snapshot.CpuLoad}%{live ? ' ●' : ''}</output>
      </div>
      <div className="cc-meter">
        <label><MemoryStick size={11} style={{ display: 'inline', verticalAlign: -1 }} /> RAM</label>
        <div className="bar"><i style={{ width: `${ramPct}%` }} /></div>
        <output>{ramPct}%</output>
      </div>
      <div className="cc-meter">
        <label><Activity size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {isRtl ? 'العمليات' : 'PROCS'}</label>
        <div className="bar"><i style={{ width: `${Math.min(100, snapshot.Processes / 4)}%` }} /></div>
        <output>{snapshot.Processes}</output>
      </div>
    </div>
  );
}

function DriveMeters({ snapshot, bridgeOnline, lang }: { snapshot: SystemSnapshot | null; bridgeOnline: boolean | null; lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  if (!snapshot || !snapshot.Drives || snapshot.Drives.length === 0) {
    return (
      <div style={{ fontSize: 10.5, color: '#64748b', padding: '10px 2px' }}>
        {bridgeOnline === false
          ? (isRtl ? 'بيانات الأقراص غير متاحة — الجسر مفصول.' : 'Drive data unavailable — bridge offline.')
          : (isRtl ? 'جارٍ تحميل بيانات الأقراص…' : 'Loading drive data…')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {snapshot.Drives.slice(0, 4).map(d => {
        const used = d.TotalGB > 0 ? Math.round(((d.TotalGB - d.FreeGB) / d.TotalGB) * 100) : 0;
        return (
          <div className="cc-meter" key={d.Name}>
            <label><HardDrive size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {d.Name}</label>
            <div className="bar"><i style={{ width: `${used}%` }} /></div>
            <output>{d.FreeGB.toFixed(0)}G {isRtl ? 'حر' : 'free'}</output>
          </div>
        );
      })}
    </div>
  );
}

function SignalMeters({ lines, errors, warnings, elapsed, phase, lang }: { lines: number; errors: number; warnings: number; elapsed: string; phase: VizPhase; lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  const items: { label: string; value: string; tone?: 'ok' | 'bad' | 'warn' }[] = [
    { label: isRtl ? 'الأحداث' : 'EVENTS', value: String(lines) },
    { label: isRtl ? 'المنقضي' : 'ELAPSED', value: elapsed },
    { label: isRtl ? 'أخطاء' : 'ERRORS', value: String(errors), tone: errors > 0 ? 'bad' : undefined },
    { label: isRtl ? 'تحذيرات' : 'WARNINGS', value: String(warnings), tone: warnings > 0 ? 'warn' : undefined },
  ];
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {items.map(it => (
        <div key={it.label} className="cc-result-cell" style={{ flex: 1 }}>
          <label>{it.label}</label>
          <b style={it.tone === 'bad' ? { color: '#fda4af' } : it.tone === 'warn' ? { color: '#fcd34d' } : phase === 'running' ? { color: '#67e8f9' } : undefined}>{it.value}</b>
        </div>
      ))}
    </div>
  );
}

function PhaseCard({ phase, tool, status, elapsed, lang }: { phase: VizPhase; tool: BridgeTool | null; status: ToolStatus; elapsed: string; lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  const Icon = phase === 'done' ? CheckCircle2 : phase === 'failed' ? XCircle : phase === 'cancelled' ? Ban : phase === 'running' ? Activity : ShieldAlert;
  const color = phase === 'done' ? '#6ee7b7' : phase === 'failed' ? '#fda4af' : phase === 'cancelled' ? '#94a3b8' : phase === 'running' ? '#67e8f9' : '#475569';
  const label = phase === 'standby'
    ? (isRtl ? 'استعداد' : 'STANDBY')
    : phase === 'ready'
      ? (isRtl ? 'جاهز للتشغيل' : 'READY')
      : phase === 'running'
        ? (isRtl ? 'قيد التنفيذ' : 'RUNNING')
        : phase === 'done'
          ? (status === 'inconclusive' ? (isRtl ? 'غير حاسم' : 'INCONCLUSIVE') : (isRtl ? 'مكتمل' : 'COMPLETE'))
          : phase === 'failed'
            ? (isRtl ? 'فشل' : 'FAILED')
            : (isRtl ? 'ملغي' : 'CANCELLED');
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, background: 'rgba(0,0,0,0.35)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={clsx('cc-dot', phase === 'running' && 'is-run', phase === 'done' && 'is-live', phase === 'failed' && 'is-err', phase === 'ready' && 'is-warn')} />
        <b style={{ fontSize: 12, color }}>{label}</b>
        <span style={{ marginInlineStart: 'auto', fontFamily: 'monospace', fontSize: 10, color: '#8ea0b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Timer size={11} /> {elapsed}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tool ? (isRtl ? tool.ArabicName : tool.EnglishName) : (isRtl ? 'لا توجد أداة محددة' : 'No tool focused')}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 9.5, color: '#64748b' }}>
        {tool ? `${tool.ToolId} · ${tool.RiskLevel}${tool.RequiresAdmin ? ' · ADMIN' : ''}` : '—'}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 9.5, color: '#475569', lineHeight: 1.6 }}>
        {phase === 'running'
          ? (isRtl ? 'التدفق أعلاه يعكس مخرجات التشغيل الفعلية لحظة بلحظة.' : 'The stream above mirrors live execution output.')
          : phase === 'standby'
            ? (isRtl ? 'المركز حي ودائم — لن يختفي عند التنقل.' : 'The center is persistent — it never navigates away.')
            : (isRtl ? 'الحالة مشتقة من عقدة التنفيذ الحقيقية.' : 'State derived from the real execution record.')}
      </div>
      <Icon size={44} style={{ color, opacity: 0.28, alignSelf: 'flex-end' }} />
    </div>
  );
}
