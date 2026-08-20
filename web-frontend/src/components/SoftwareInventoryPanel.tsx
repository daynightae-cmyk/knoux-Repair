import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppWindow, Boxes, CheckCircle2, LoaderCircle, PackageSearch, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { api, type SoftwarePreview } from '../lib/api';
import type { Lang } from '../lib/i18n';

const COPY = {
  en: { kicker: 'Local software inventory', title: 'Review installed software before change', body: 'This queue is built from local Windows inventory sources. It does not uninstall, update, or transmit inventory data.', refresh: 'Refresh inventory', loading: 'Reading installed software…', search: 'Filter name, publisher, version', total: 'records', desktop: 'desktop', appx: 'Appx', visible: 'visible', none: 'No inventory records match this filter.', safe: 'Read-only inventory; removal remains a separate confirmed service with an exact package identifier.', truncated: 'The in-app queue is capped; the complete local evidence remains in the generated report.' },
  ar: { kicker: 'جرد البرامج المحلي', title: 'راجع البرامج المثبتة قبل أي تغيير', body: 'يُبنى هذا الطابور من مصادر جرد ويندوز المحلية. لا يزيل أو يحدث أو يرسل بيانات الجرد.', refresh: 'تحديث الجرد', loading: 'تجري قراءة البرامج المثبتة…', search: 'تصفية الاسم أو الناشر أو الإصدار', total: 'سجل', desktop: 'سطح مكتب', appx: 'Appx', visible: 'ظاهر', none: 'لا توجد سجلات جرد تطابق المرشح الحالي.', safe: 'الجرد للقراءة فقط؛ تبقى الإزالة خدمة مستقلة مؤكدة تتطلب معرّف حزمة دقيقًا.', truncated: 'طابور الواجهة محدود، وتبقى الأدلة المحلية الكاملة في التقرير الناتج.' },
};

export default function SoftwareInventoryPanel({ lang }: { lang: Lang }) {
  const text = COPY[lang];
  const [preview, setPreview] = useState<SoftwarePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => { setLoading(true);setError('');try{setPreview((await api.softwarePreview()).preview);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}},[]);
  useEffect(() => { load(); }, [load]);
  const items = useMemo(() => (preview?.Items || []).filter((item) => `${item.Name} ${item.Version} ${item.Publisher}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [preview, query]);
  return <aside className="software-inventory" aria-label={text.title}>
    <header><div className="software-inventory-icon"><PackageSearch size={21} /></div><div><p className="eyebrow">{text.kicker}</p><h3>{text.title}</h3><p>{text.body}</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'is-spinning':''} />{text.refresh}</button></header>
    <div className="software-inventory-metrics"><span><b>{preview?.Total ?? '—'}</b>{text.total}</span><span><b>{preview?.DesktopCount ?? '—'}</b>{text.desktop}</span><span><b>{preview?.AppxCount ?? '—'}</b>{text.appx}</span><span><b>{items.length}</b>{text.visible}</span></div>
    <label className="software-inventory-search"><Search size={15}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={text.search}/></label>
    {loading && <div className="software-inventory-state"><LoaderCircle size={18} className="is-spinning" />{text.loading}</div>}
    {!loading && error && <div className="software-inventory-state is-error">{error}</div>}
    {!loading && !error && <div className="software-inventory-list">{items.slice(0,80).map((item)=> <article key={`${item.Kind}:${item.Name}:${item.Version}`}><span className={item.Kind==='Appx'?'is-appx':''}>{item.Kind==='Appx'?<Boxes size={14}/>:<AppWindow size={14}/>}</span><div><strong>{item.Name}</strong><p>{item.Publisher || '—'} · {item.Version || '—'}</p></div><i>{item.CanUninstall?<CheckCircle2 size={14}/>:<ShieldCheck size={14}/>}</i></article>)}{!items.length && <div className="software-inventory-empty">{text.none}</div>}</div>}
    {preview?.Truncated && <p className="software-inventory-note">{text.truncated}</p>}<p className="software-inventory-safe"><ShieldCheck size={14}/>{text.safe}</p>
  </aside>;
}
