import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, Gauge, HardDrive, LoaderCircle, MemoryStick, Play, RefreshCw, ShieldCheck, Timer, Zap } from 'lucide-react';
import { api, type BridgeTool, type PerformancePreview, type PerformancePreviewDisk } from '../lib/api';
import type { Lang } from '../lib/i18n';

const COPY = {
  en: {
    eyebrow: 'Live performance telemetry', title: 'Performance observatory', body: 'Measure current CPU, memory, disk, and process pressure before launching any detailed diagnosis or optimization.', refresh: 'Refresh live data', loading: 'Reading local performance counters…', cpu: 'CPU load', memory: 'Memory load', available: 'available', processes: 'processes', logical: 'logical processors', disks: 'Logical disks', disk: 'Disk', used: 'used', free: 'free', active: 'active time', read: 'read', write: 'write', unavailable: 'Counter unavailable', pageRate: 'pages/sec', analyzeMemory: 'Analyze memory pressure', analyzeStartup: 'Analyze startup impact', confirmation: 'These analysis actions open the mandatory confirmation window. The preview itself changes no system setting.', safety: 'Read-only local performance telemetry. No power plan, visual effect, disk, memory, or process setting is changed here.', captured: 'Captured', empty: 'No disk telemetry was returned.', error: 'Performance telemetry could not be read.',
  },
  ar: {
    eyebrow: 'قياسات الأداء الحية', title: 'مرصد الأداء', body: 'قِس ضغط المعالج والذاكرة والأقراص والعمليات الآن قبل إطلاق أي تحليل تفصيلي أو تحسين.', refresh: 'تحديث البيانات الحية', loading: 'تجري قراءة عدّادات الأداء المحلية…', cpu: 'حمل المعالج', memory: 'حمل الذاكرة', available: 'متاح', processes: 'عملية', logical: 'معالج منطقي', disks: 'الأقراص المنطقية', disk: 'القرص', used: 'مستخدم', free: 'متاح', active: 'وقت نشط', read: 'قراءة', write: 'كتابة', unavailable: 'العداد غير متاح', pageRate: 'صفحة/ث', analyzeMemory: 'تحليل ضغط الذاكرة', analyzeStartup: 'تحليل أثر بدء التشغيل', confirmation: 'تفتح إجراءات التحليل هذه نافذة التأكيد الإلزامية؛ أما المعاينة نفسها فلا تغيّر أي إعداد بالنظام.', safety: 'قياسات أداء محلية للقراءة فقط؛ لا تتغير خطة الطاقة أو المؤثرات أو القرص أو الذاكرة أو إعدادات العمليات هنا.', captured: 'وقت اللقطة', empty: 'لم تُرجع المعاينة بيانات أقراص.', error: 'تعذر قراءة قياسات الأداء.',
  },
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const rate = (value: number | null) => value === null ? '—' : value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB/s` : `${(value / 1024).toFixed(1)} KB/s`;
function stamp(value: string, lang: Lang) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

function Meter({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'warning' }) {
  return <span className={`performance-meter ${tone === 'warning' ? 'is-warning' : ''}`} aria-label={`${clamp(value)}%`}><i style={{ width: `${clamp(value)}%` }} /></span>;
}

function DiskCard({ disk, lang }: { disk: PerformancePreviewDisk; lang: Lang }) {
  const text = COPY[lang];
  return <article className="performance-disk-card"><header><HardDrive size={17} /><div><h4>{disk.Name}</h4><p>{disk.TotalGB.toLocaleString()} GB {text.disk}</p></div><strong>{disk.UsedPercent.toLocaleString()}%</strong></header><Meter value={disk.UsedPercent} tone={disk.UsedPercent >= 90 ? 'warning' : 'accent'} /><div className="performance-disk-summary"><span><b>{disk.FreeGB.toLocaleString()} GB</b>{text.free}</span><span><b>{disk.ActiveTimePercent === null ? '—' : `${disk.ActiveTimePercent.toLocaleString()}%`}</b>{text.active}</span></div><dl><div><dt>{text.read}</dt><dd>{rate(disk.ReadBytesPerSecond)}</dd></div><div><dt>{text.write}</dt><dd>{rate(disk.WriteBytesPerSecond)}</dd></div></dl></article>;
}

export default function PerformancePulsePanel({ lang, tools, onRequestExecution }: { lang: Lang; tools: BridgeTool[]; onRequestExecution: (tool: BridgeTool) => void }) {
  const text = COPY[lang];
  const [preview, setPreview] = useState<PerformancePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setPreview((await api.performancePreview()).preview); } catch (reason) { setError(reason instanceof Error ? reason.message : text.error); } finally { setLoading(false); } }, [text.error]);
  useEffect(() => { void load(); }, [load]);
  const memoryTool = useMemo(() => tools.find((tool) => tool.ToolId === 'PF04') ?? null, [tools]);
  const startupTool = useMemo(() => tools.find((tool) => tool.ToolId === 'PF02') ?? null, [tools]);

  return <aside className="performance-pulse" aria-label={text.title}>
    <header className="performance-pulse-header"><div className="performance-pulse-icon"><Gauge size={22} /></div><div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p>{text.body}</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} />{text.refresh}</button></header>
    {loading && <div className="performance-pulse-state"><LoaderCircle size={18} className="is-spinning" />{text.loading}</div>}
    {!loading && error && <div className="performance-pulse-state is-error">{error}</div>}
    {!loading && !error && preview && <>
      <div className="performance-captured"><Timer size={13} />{text.captured}: <b>{stamp(preview.CapturedAt, lang)}</b><span><ShieldCheck size={13} />{text.safety}</span></div>
      <div className="performance-metrics">
        <article><Cpu size={18} /><div><span>{text.cpu}</span><b>{preview.Cpu.LoadPercent.toLocaleString()}%</b><small>{preview.Cpu.LogicalProcessors.toLocaleString()} {text.logical}</small></div><Meter value={preview.Cpu.LoadPercent} tone={preview.Cpu.LoadPercent >= 90 ? 'warning' : 'accent'} /></article>
        <article><MemoryStick size={18} /><div><span>{text.memory}</span><b>{preview.Memory.LoadPercent.toLocaleString()}%</b><small>{preview.Memory.FreeGB.toLocaleString()} GB {text.available}</small></div><Meter value={preview.Memory.LoadPercent} tone={preview.Memory.LoadPercent >= 90 ? 'warning' : 'accent'} /></article>
        <article><Activity size={18} /><div><span>{text.processes}</span><b>{preview.ProcessCount.toLocaleString()}</b><small>{preview.Memory.PagesPerSecond === null ? '—' : `${preview.Memory.PagesPerSecond.toLocaleString()} ${text.pageRate}`}</small></div></article>
      </div>
      <section className="performance-disks"><header><div><HardDrive size={16} /><p className="eyebrow">{text.disks}</p><h4>{preview.Disks.length.toLocaleString()} {text.disks}</h4></div><Zap size={18} /></header>{preview.Disks.length ? <div className="performance-disk-grid">{preview.Disks.map((disk) => <DiskCard key={disk.Name} disk={disk} lang={lang} />)}</div> : <p className="performance-empty">{text.empty}</p>}</section>
      <footer className="performance-actions"><p><ShieldCheck size={14} />{text.confirmation}</p><div>{memoryTool && <button type="button" className="performance-action" onClick={() => onRequestExecution(memoryTool)}><Play size={14} />{text.analyzeMemory}</button>}{startupTool && <button type="button" className="performance-action is-secondary" onClick={() => onRequestExecution(startupTool)}><Play size={14} />{text.analyzeStartup}</button>}</div></footer>
    </>}
  </aside>;
}
