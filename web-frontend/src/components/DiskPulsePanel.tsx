import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, HardDrive, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, type SystemSnapshot } from '../lib/api';
import type { Lang } from '../lib/i18n';

const COPY = {
  en: { kicker: 'Live storage pulse', title: 'Real drive capacity before cleanup', body: 'Capacity is read from local Windows disk telemetry. Run a storage tool only after reviewing the pressure level and its recovery route.', refresh: 'Refresh', loading: 'Reading local drives…', total: 'total', used: 'used', free: 'free', pressure: 'pressure', healthy: 'Normal', watch: 'Watch', critical: 'Critical', safe: 'Read-only telemetry — no cleanup is triggered here.', unavailable: 'Drive telemetry is unavailable.' },
  ar: { kicker: 'نبض التخزين الحي', title: 'السعة الفعلية قبل أي تنظيف', body: 'تُقرأ السعة من قياسات أقراص ويندوز المحلية. شغّل أداة مساحة فقط بعد مراجعة مستوى الضغط ومسار الاسترداد الخاص بها.', refresh: 'تحديث', loading: 'تجري قراءة الأقراص المحلية…', total: 'الإجمالي', used: 'المستخدم', free: 'المتاح', pressure: 'الضغط', healthy: 'طبيعي', watch: 'مراقبة', critical: 'حرج', safe: 'قياسات للقراءة فقط — لا يبدأ أي تنظيف من هذه اللوحة.', unavailable: 'بيانات الأقراص غير متاحة.' },
};

function stateFor(used: number, text: typeof COPY.en) {
  if (used >= 90) return { label: text.critical, className: 'is-critical' };
  if (used >= 75) return { label: text.watch, className: 'is-watch' };
  return { label: text.healthy, className: 'is-healthy' };
}

export default function DiskPulsePanel({ lang }: { lang: Lang }) {
  const text = COPY[lang];
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setSystem((await api.system()).system); } catch (e) { setError(e instanceof Error ? e.message : text.unavailable); } finally { setLoading(false); } }, [text.unavailable]);
  useEffect(() => { load(); }, [load]);
  const drives = useMemo(() => system?.Drives || [], [system]);
  return <aside className="disk-pulse" aria-label={text.title}>
    <header><div className="disk-pulse-icon"><Database size={21} /></div><div><p className="eyebrow">{text.kicker}</p><h3>{text.title}</h3><p>{text.body}</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} />{text.refresh}</button></header>
    {loading && <div className="disk-pulse-state"><LoaderCircle size={19} className="is-spinning" />{text.loading}</div>}
    {!loading && error && <div className="disk-pulse-state is-error"><AlertTriangle size={18} />{error}</div>}
    {!loading && !error && <><div className="disk-pulse-drives">{drives.map((drive) => { const used = drive.TotalGB ? Math.round(((drive.TotalGB - drive.FreeGB) / drive.TotalGB) * 1000) / 10 : 0; const state = stateFor(used, text); return <article key={drive.Name} className={`disk-pulse-drive ${state.className}`}><div className="disk-pulse-drive-top"><HardDrive size={16} /><strong>{drive.Name}</strong><span>{state.label}</span></div><div className="disk-pulse-meter"><i style={{ width: `${Math.max(0, Math.min(100, used))}%` }} /></div><dl><div><dt>{text.total}</dt><dd>{drive.TotalGB.toLocaleString()} GB</dd></div><div><dt>{text.used}</dt><dd>{(drive.TotalGB - drive.FreeGB).toLocaleString()} GB</dd></div><div><dt>{text.free}</dt><dd>{drive.FreeGB.toLocaleString()} GB</dd></div><div><dt>{text.pressure}</dt><dd>{used}%</dd></div></dl></article>; })}</div><p className="disk-pulse-safe"><ShieldCheck size={14} />{text.safe}</p></>}
  </aside>;
}
