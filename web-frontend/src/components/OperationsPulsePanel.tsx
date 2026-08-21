import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Cpu, LoaderCircle, Play, RefreshCw, ShieldCheck, Workflow, Wrench } from 'lucide-react';
import { api, type BridgeTool, type OperationsPreview, type OperationsPreviewProcess } from '../lib/api';
import type { Lang } from '../lib/i18n';

const COPY = {
  en: {
    eyebrow: 'Live Windows operations', title: 'Services & processes control room', body: 'Inspect actual service state and process resource evidence before any repair is confirmed.', refresh: 'Refresh live data', loading: 'Reading Windows service and process telemetry…', memory: 'Top memory', cpu: 'CPU time', services: 'services', processes: 'processes', running: 'running', stopped: 'stopped', automatic: 'automatic', noHung: 'No non-responding process was reported in this snapshot.', hung: 'Processes requiring review', autoStopped: 'Automatic services currently stopped', autoStoppedHint: 'A stopped automatic service is a review signal, not an automatic fault. Windows may start it on demand.', noAutoStopped: 'No stopped automatic services were reported.', reviewCleanup: 'Review hung-process cleanup', restartExplorer: 'Restart Windows Explorer', confirmation: 'These actions open the mandatory confirmation window; nothing is changed from this panel directly.', safety: 'Read-only local telemetry. No process is ended and no service configuration is changed by this preview.', captured: 'Captured', notResponding: 'not responding', pid: 'PID', memoryValue: 'Memory', status: 'Status', startMode: 'Start mode', empty: 'No live evidence was returned.', error: 'Live telemetry could not be read.',
  },
  ar: {
    eyebrow: 'عمليات ويندوز الحية', title: 'غرفة تحكم الخدمات والعمليات', body: 'افحص حالة الخدمات الفعلية وأدلة استهلاك العمليات قبل تأكيد أي إصلاح.', refresh: 'تحديث البيانات الحية', loading: 'تجري قراءة قياسات خدمات وعمليات ويندوز…', memory: 'الأعلى في الذاكرة', cpu: 'زمن CPU', services: 'خدمة', processes: 'عملية', running: 'قيد التشغيل', stopped: 'متوقفة', automatic: 'تلقائية', noHung: 'لا توجد عملية غير مستجيبة ضمن هذه اللقطة.', hung: 'عمليات تحتاج مراجعة', autoStopped: 'خدمات تلقائية متوقفة حاليًا', autoStoppedHint: 'الخدمة التلقائية المتوقفة إشارة للمراجعة وليست عطلًا تلقائيًا؛ فقد يشغّلها ويندوز عند الحاجة.', noAutoStopped: 'لا توجد خدمات تلقائية متوقفة ضمن اللقطة.', reviewCleanup: 'مراجعة تنظيف العمليات المعلّقة', restartExplorer: 'إعادة تشغيل مستكشف ويندوز', confirmation: 'تفتح هذه الأزرار نافذة التأكيد الإلزامية؛ لا يُغيَّر شيء مباشرة من هذه اللوحة.', safety: 'قياسات محلية للقراءة فقط؛ لا تُنهى أي عملية ولا تتغير إعدادات الخدمة عبر هذه المعاينة.', captured: 'وقت اللقطة', notResponding: 'غير مستجيبة', pid: 'PID', memoryValue: 'الذاكرة', status: 'الحالة', startMode: 'نمط البدء', empty: 'لم تُرجع المعاينة أدلة حية.', error: 'تعذر قراءة القياسات الحية.',
  },
};

function formatTime(value: string, lang: Lang) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ProcessRow({ item, lang, kind }: { item: OperationsPreviewProcess; lang: Lang; kind: 'memory' | 'cpu' }) {
  const text = COPY[lang];
  const value = kind === 'memory' ? `${item.MemoryMB.toLocaleString()} MB` : `${item.CpuSeconds.toLocaleString()} s`;
  return <li className="operations-process-row"><div><b>{item.Name}</b><span>{text.pid} {item.ProcessId.toLocaleString()}</span></div><strong>{value}</strong></li>;
}

export default function OperationsPulsePanel({ lang, tools, onRequestExecution }: { lang: Lang; tools: BridgeTool[]; onRequestExecution: (tool: BridgeTool) => void }) {
  const text = COPY[lang];
  const [preview, setPreview] = useState<OperationsPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setPreview((await api.operationsPreview()).preview); } catch (reason) { setError(reason instanceof Error ? reason.message : text.error); } finally { setLoading(false); }
  }, [text.error]);
  useEffect(() => { void load(); }, [load]);
  const cleanupTool = useMemo(() => tools.find((tool) => tool.ToolId === 'SP04') ?? null, [tools]);
  const explorerTool = useMemo(() => tools.find((tool) => tool.ToolId === 'SP03') ?? null, [tools]);

  return <aside className="operations-pulse" aria-label={text.title}>
    <header className="operations-pulse-header">
      <div className="operations-pulse-icon"><Workflow size={22} /></div>
      <div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p>{text.body}</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} />{text.refresh}</button>
    </header>

    {loading && <div className="operations-pulse-state"><LoaderCircle size={18} className="is-spinning" />{text.loading}</div>}
    {!loading && error && <div className="operations-pulse-state is-error">{error}</div>}
    {!loading && !error && !preview && <div className="operations-pulse-state">{text.empty}</div>}
    {!loading && !error && preview && <>
      <div className="operations-captured"><Clock3 size={13} />{text.captured}: <b>{formatTime(preview.CapturedAt, lang)}</b><span><ShieldCheck size={13} />{text.safety}</span></div>
      <div className="operations-metrics">
        <article><Activity size={17} /><b>{preview.Services.Running.toLocaleString()}</b><span>{text.running} {text.services}</span></article>
        <article><Wrench size={17} /><b>{preview.Services.Stopped.toLocaleString()}</b><span>{text.stopped} {text.services}</span></article>
        <article><CheckCircle2 size={17} /><b>{preview.Services.Automatic.toLocaleString()}</b><span>{text.automatic} {text.services}</span></article>
        <article><Cpu size={17} /><b>{preview.Processes.Total.toLocaleString()}</b><span>{text.processes}</span></article>
      </div>
      <div className="operations-grid">
        <section className="operations-card"><header><Cpu size={16} /><div><h4>{text.memory}</h4><p>{text.processes}</p></div></header><ol>{preview.Processes.TopMemory.slice(0, 6).map((item) => <ProcessRow key={`memory-${item.ProcessId}`} item={item} lang={lang} kind="memory" />)}</ol></section>
        <section className="operations-card"><header><Activity size={16} /><div><h4>{text.cpu}</h4><p>{text.processes}</p></div></header><ol>{preview.Processes.TopCpuTime.slice(0, 6).map((item) => <ProcessRow key={`cpu-${item.ProcessId}`} item={item} lang={lang} kind="cpu" />)}</ol></section>
      </div>
      <div className="operations-review-grid">
        <section className="operations-review"><header><AlertTriangle size={16} /><div><h4>{text.hung}</h4><p>{preview.Processes.NotResponding.toLocaleString()} {text.notResponding}</p></div></header>{preview.Processes.NotRespondingForReview.length ? <ul>{preview.Processes.NotRespondingForReview.map((item) => <li key={`hung-${item.ProcessId}`}><b>{item.Name}</b><span>{text.pid} {item.ProcessId.toLocaleString()} · {item.MemoryMB.toLocaleString()} MB</span></li>)}</ul> : <p className="operations-empty">{text.noHung}</p>}</section>
        <section className="operations-review"><header><Wrench size={16} /><div><h4>{text.autoStopped}</h4><p>{text.autoStoppedHint}</p></div></header>{preview.Services.AutomaticStoppedForReview.length ? <ul>{preview.Services.AutomaticStoppedForReview.map((service) => <li key={service.Name}><b>{service.DisplayName}</b><span>{service.Name} · {service.StartMode}</span></li>)}</ul> : <p className="operations-empty">{text.noAutoStopped}</p>}</section>
      </div>
      <footer className="operations-actions"><p><ShieldCheck size={14} />{text.confirmation}</p><div>{cleanupTool && <button type="button" className="operations-action is-review" onClick={() => onRequestExecution(cleanupTool)}><Play size={14} />{text.reviewCleanup}</button>}{explorerTool && <button type="button" className="operations-action" onClick={() => onRequestExecution(explorerTool)}><RefreshCw size={14} />{text.restartExplorer}</button>}</div></footer>
    </>}
  </aside>;
}
