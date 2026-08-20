import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, FileText, HardDrive, HeartPulse, LoaderCircle, MemoryStick, Play, RefreshCw, ShieldCheck, Siren, Stethoscope, TriangleAlert, Wrench } from 'lucide-react';
import { api, type BridgeTool, type DiagnosticsPreview, type DiagnosticsPreviewDisk, type DiagnosticsPreviewEvent } from '../lib/api';
import type { Lang } from '../lib/i18n';

const COPY = {
  en: {
    eyebrow: 'Live Windows diagnostic evidence', title: 'Diagnostics & reports observatory', body: 'Review observed Windows events, reliability history, device state, and storage evidence before requesting a detailed report.', refresh: 'Refresh evidence', loading: 'Reading local Windows diagnostic evidence…', captured: 'Captured', events: 'Recent events', eventsWindow: 'last {days} days', critical: 'critical', reliability: 'Reliability records', reliabilityWindow: 'last {days} days', devices: 'Devices requiring review', storage: 'Storage evidence', noEvents: 'No Error or Critical event was returned for this observation window.', noReliability: 'No reliability record was returned for this observation window.', noDevices: 'No device problem was reported by Windows.', noDisks: 'No physical disk evidence was returned.', smartAvailable: 'SMART queried', smartUnavailable: 'SMART status unavailable', predicted: 'failure predicted', noPrediction: 'no failure prediction', system: 'System context', uptime: 'uptime', boot: 'last boot duration', unavailable: 'Unavailable', provider: 'Provider', eventId: 'Event ID', log: 'Log', review: 'Review signal', fullReport: 'Run full diagnostic report', eventReport: 'Inspect event-log errors', confirmation: 'These actions open the mandatory confirmation window. This observatory is read-only and does not repair, clear logs, or change a driver.', safety: 'Read-only local diagnostic telemetry. An observed event or record is evidence for review, not proof of a root cause.', error: 'Diagnostic evidence could not be read.',
  },
  ar: {
    eyebrow: 'أدلة تشخيص ويندوز الحية', title: 'مرصد التشخيص والتقارير', body: 'راجع أحداث ويندوز المرصودة وسجل الموثوقية وحالة الأجهزة وأدلة التخزين قبل طلب تقرير تفصيلي.', refresh: 'تحديث الأدلة', loading: 'تجري قراءة أدلة تشخيص ويندوز المحلية…', captured: 'وقت اللقطة', events: 'أحداث حديثة', eventsWindow: 'آخر {days} أيام', critical: 'حرج', reliability: 'سجلات الموثوقية', reliabilityWindow: 'آخر {days} أيام', devices: 'أجهزة تحتاج مراجعة', storage: 'أدلة التخزين', noEvents: 'لم تُرجع نافذة المراقبة أحداث خطأ أو حرجة.', noReliability: 'لم تُرجع نافذة المراقبة سجل موثوقية.', noDevices: 'لم يبلغ ويندوز عن مشكلة جهاز.', noDisks: 'لم تُرجع المعاينة أدلة أقراص فعلية.', smartAvailable: 'تم الاستعلام عن SMART', smartUnavailable: 'حالة SMART غير متاحة', predicted: 'توقع فشل', noPrediction: 'لا توقع فشل', system: 'سياق النظام', uptime: 'مدة التشغيل', boot: 'مدة آخر إقلاع', unavailable: 'غير متاح', provider: 'المزوّد', eventId: 'معرّف الحدث', log: 'السجل', review: 'إشارة للمراجعة', fullReport: 'تشغيل التقرير التشخيصي الكامل', eventReport: 'فحص أخطاء سجل الأحداث', confirmation: 'تفتح هذه الإجراءات نافذة التأكيد الإلزامية. هذا المرصد للقراءة فقط ولا يصلح النظام ولا يمسح السجلات ولا يغير تعريفًا.', safety: 'قياسات تشخيص محلية للقراءة فقط؛ الحدث أو السجل المرصود دليل للمراجعة وليس إثباتًا لسبب جذري.', error: 'تعذر قراءة الأدلة التشخيصية.',
  },
};

function stamp(value: string, lang: Lang) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function uptime(hours: number, lang: Lang) { const days = Math.floor(hours / 24); const rest = Math.round(hours % 24); return lang === 'ar' ? `${days} يوم · ${rest} س` : `${days}d ${rest}h`; }
function boot(value: number | null, fallback: string) { return value === null || value <= 0 ? fallback : `${(value / 1000).toFixed(1)} s`; }

function EvidenceEvent({ item, lang }: { item: DiagnosticsPreviewEvent; lang: Lang }) {
  const text = COPY[lang];
  return <li className="diagnostics-event-row"><div className={`diagnostics-level ${item.Level === 'Critical' ? 'is-critical' : ''}`}>{item.Level === 'Critical' ? <Siren size={13} /> : <TriangleAlert size={13} />}{item.Level}</div><div className="diagnostics-event-main"><b>{item.Provider || text.unavailable}</b><span>{text.log}: {item.Log} · {text.eventId}: {item.EventId.toLocaleString()}</span></div><time>{stamp(item.Time, lang)}</time></li>;
}

function DiskEvidence({ item, lang }: { item: DiagnosticsPreviewDisk; lang: Lang }) {
  const text = COPY[lang];
  return <li className={`diagnostics-disk ${item.PredictFailure ? 'is-risk' : ''}`}><HardDrive size={16} /><div><b>{item.Model || `${text.storage} ${item.Index}`}</b><span>{item.SizeGB.toLocaleString()} GB · {item.SmartAvailable ? text.smartAvailable : text.smartUnavailable}</span></div><strong>{item.PredictFailure ? text.predicted : text.noPrediction}</strong></li>;
}

export default function DiagnosticsReportPanel({ lang, tools, onRequestExecution }: { lang: Lang; tools: BridgeTool[]; onRequestExecution: (tool: BridgeTool) => void }) {
  const text = COPY[lang];
  const [preview, setPreview] = useState<DiagnosticsPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setPreview((await api.diagnosticsPreview()).preview); } catch (reason) { setError(reason instanceof Error ? reason.message : text.error); } finally { setLoading(false); } }, [text.error]);
  useEffect(() => { void load(); }, [load]);
  const fullReportTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DR10') ?? null, [tools]);
  const eventTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DR03') ?? null, [tools]);

  return <aside className="diagnostics-report-panel" aria-label={text.title}>
    <header className="diagnostics-report-header"><div className="diagnostics-report-icon"><Stethoscope size={22} /></div><div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p>{text.body}</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} />{text.refresh}</button></header>
    {loading && <div className="diagnostics-report-state"><LoaderCircle size={18} className="is-spinning" />{text.loading}</div>}
    {!loading && error && <div className="diagnostics-report-state is-error">{error}</div>}
    {!loading && !error && preview && <>
      <div className="diagnostics-captured"><Clock3 size={13} />{text.captured}: <b>{stamp(preview.CapturedAt, lang)}</b><span><ShieldCheck size={13} />{text.safety}</span></div>
      <div className="diagnostics-signal-grid">
        <article><Activity size={17} /><div><b>{preview.Events.ErrorOrCriticalCount.toLocaleString()}</b><span>{text.events}</span><small>{text.eventsWindow.replace('{days}', String(preview.Events.WindowDays))}</small></div><em className={preview.Events.CriticalCount ? 'is-review' : 'is-clear'}>{preview.Events.CriticalCount ? `${preview.Events.CriticalCount.toLocaleString()} ${text.critical}` : <CheckCircle2 size={14} />}</em></article>
        <article><HeartPulse size={17} /><div><b>{preview.Reliability.RecordsObserved.toLocaleString()}</b><span>{text.reliability}</span><small>{text.reliabilityWindow.replace('{days}', String(preview.Reliability.WindowDays))}</small></div><em className={preview.Reliability.RecordsObserved ? 'is-review' : 'is-clear'}>{preview.Reliability.RecordsObserved ? text.review : <CheckCircle2 size={14} />}</em></article>
        <article><Wrench size={17} /><div><b>{preview.Devices.ProblemsObserved.toLocaleString()}</b><span>{text.devices}</span><small>{preview.Storage.DisksObserved.toLocaleString()} {text.storage}</small></div><em className={preview.Devices.ProblemsObserved || preview.Storage.SmartFailurePredicted ? 'is-review' : 'is-clear'}>{preview.Storage.SmartFailurePredicted ? text.predicted : <CheckCircle2 size={14} />}</em></article>
      </div>
      <section className="diagnostics-system-context"><header><MemoryStick size={16} /><div><p className="eyebrow">{text.system}</p><h4>{preview.System.Os} · {preview.System.Build}</h4></div></header><div><span><b>{preview.System.Machine}</b>Machine</span><span><b>{uptime(preview.System.UptimeHours, lang)}</b>{text.uptime}</span><span><b>{boot(preview.System.BootDurationMs, text.unavailable)}</b>{text.boot}</span><span><b>{preview.System.MemoryLoadPercent.toLocaleString()}%</b>RAM</span></div></section>
      <div className="diagnostics-evidence-grid">
        <section className="diagnostics-evidence-card"><header><Activity size={16} /><div><h4>{text.events}</h4><p>{text.eventsWindow.replace('{days}', String(preview.Events.WindowDays))}</p></div></header>{preview.Events.Recent.length ? <ol>{preview.Events.Recent.slice(0, 8).map((item, index) => <EvidenceEvent key={`${item.Time}-${item.EventId}-${index}`} item={item} lang={lang} />)}</ol> : <p className="diagnostics-empty">{text.noEvents}</p>}</section>
        <section className="diagnostics-evidence-card"><header><HeartPulse size={16} /><div><h4>{text.reliability}</h4><p>{text.reliabilityWindow.replace('{days}', String(preview.Reliability.WindowDays))}</p></div></header>{preview.Reliability.Recent.length ? <ol>{preview.Reliability.Recent.slice(0, 6).map((item, index) => <li key={`${item.Time}-${item.Id}-${index}`} className="diagnostics-reliability-row"><div><b>{item.Product || text.unavailable}</b><span>{item.Message || item.Id}</span></div><time>{stamp(item.Time, lang)}</time></li>)}</ol> : <p className="diagnostics-empty">{text.noReliability}</p>}</section>
      </div>
      <div className="diagnostics-lower-grid">
        <section className="diagnostics-devices"><header><Wrench size={16} /><h4>{text.devices}</h4></header>{preview.Devices.Problems.length ? <ul>{preview.Devices.Problems.slice(0, 6).map((item) => <li key={item.DeviceId}><b>{item.Name}</b><span>{item.Status || text.unavailable} · {item.ErrorCode.toLocaleString()}</span></li>)}</ul> : <p className="diagnostics-empty">{text.noDevices}</p>}</section>
        <section className="diagnostics-storage"><header><HardDrive size={16} /><h4>{text.storage}</h4></header>{preview.Storage.Disks.length ? <ul>{preview.Storage.Disks.map((item) => <DiskEvidence key={`${item.Index}-${item.Model}`} item={item} lang={lang} />)}</ul> : <p className="diagnostics-empty">{text.noDisks}</p>}</section>
      </div>
      <footer className="diagnostics-actions"><p><ShieldCheck size={14} />{text.confirmation}</p><div>{eventTool && <button type="button" className="diagnostics-action is-secondary" onClick={() => onRequestExecution(eventTool)}><Play size={14} />{text.eventReport}</button>}{fullReportTool && <button type="button" className="diagnostics-action" onClick={() => onRequestExecution(fullReportTool)}><FileText size={14} />{text.fullReport}</button>}</div></footer>
    </>}
  </aside>;
}
