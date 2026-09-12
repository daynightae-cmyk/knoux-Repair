import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Lang } from '../lib/i18n';

export const KNOUX_AI_OPEN_EVENT = 'knoux:ai-open';

type AiState = 'checking' | 'available' | 'thinking' | 'ready' | 'unavailable' | 'error';
type Entry = { id: number; role: 'user' | 'assistant'; text: string };
type OpenDetail = { prompt?: string; context?: Record<string, unknown> };

const QUICK_ACTIONS = [
  'Explain the current result',
  'Find the likely root cause',
  'Recommend the safest next step',
  'What evidence is missing?',
  'Create a repair plan',
] as const;

let sequence = 0;

export default function KnouxAiOverlayHost() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => localStorage.getItem('knoux-lang') === 'ar' ? 'ar' : 'en');
  const [state, setState] = useState<AiState>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const isRtl = lang === 'ar';

  const refreshStatus = useCallback(async () => {
    setState('checking');
    setStatusMessage(isRtl ? 'جارٍ التحقق من KNOUX AI…' : 'Checking KNOUX AI…');
    try {
      const response = await fetch('/api/knoux-ai/status', { headers: { Accept: 'application/json' } });
      const body = await response.json().catch(() => ({})) as { available?: boolean; message?: string };
      if (response.ok && body.available === true) {
        setState('available');
        setStatusMessage(isRtl ? 'KNOUX AI متاح' : 'KNOUX AI available');
      } else {
        setState('unavailable');
        setStatusMessage(body.message || (isRtl ? 'KNOUX AI غير متاح في هذا التشغيل.' : 'KNOUX AI is unavailable in this runtime.'));
      }
    } catch {
      setState('unavailable');
      setStatusMessage(isRtl ? 'مسار KNOUX AI غير متاح.' : 'KNOUX AI route is unavailable.');
    }
  }, [isRtl]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenDetail>).detail;
      if (detail?.prompt) setPrompt(detail.prompt);
      if (detail?.context) setContext(detail.context);
      setOpen(true);
    };
    const observer = new MutationObserver(() => setLang(document.documentElement.lang === 'ar' ? 'ar' : 'en'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    window.addEventListener(KNOUX_AI_OPEN_EVENT, onOpen);
    return () => {
      observer.disconnect();
      window.removeEventListener(KNOUX_AI_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) void refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [open]);

  const stateLabel = useMemo(() => {
    if (state === 'checking') return isRtl ? 'جارٍ التحقق' : 'Checking';
    if (state === 'available') return isRtl ? 'متاح' : 'Available';
    if (state === 'thinking') return isRtl ? 'يفكر' : 'Thinking';
    if (state === 'ready') return isRtl ? 'الرد جاهز' : 'Response ready';
    if (state === 'error') return isRtl ? 'خطأ' : 'Error';
    return isRtl ? 'غير متاح' : 'Unavailable';
  }, [isRtl, state]);

  const send = useCallback(async (override?: string) => {
    const message = (override ?? prompt).trim();
    if (!message || state === 'thinking' || state === 'unavailable' || state === 'checking') return;

    setEntries(previous => [...previous, { id: Date.now() + (++sequence), role: 'user', text: message }]);
    setPrompt('');
    setState('thinking');
    setStatusMessage(isRtl ? 'KNOUX AI يحلل السياق المتاح…' : 'KNOUX AI is reasoning over available context…');

    try {
      const response = await fetch('/api/knoux-ai/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, sessionId, context }),
      });
      const body = await response.json().catch(() => ({})) as { ok?: boolean; text?: string; sessionId?: string | null; message?: string; error?: string };
      if (!response.ok || body.ok === false || !body.text) throw new Error(body.message || body.error || `HTTP ${response.status}`);
      setEntries(previous => [...previous, { id: Date.now() + (++sequence), role: 'assistant', text: body.text! }]);
      setSessionId(body.sessionId || sessionId);
      setState('ready');
      setStatusMessage(isRtl ? 'تم استلام رد KNOUX AI.' : 'KNOUX AI response received.');
    } catch (error) {
      setState('error');
      setStatusMessage(error instanceof Error ? error.message : (isRtl ? 'تعذر استدعاء KNOUX AI.' : 'KNOUX AI request failed.'));
    }
  }, [context, isRtl, prompt, sessionId, state]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/55 backdrop-blur-sm" dir={isRtl ? 'rtl' : 'ltr'} onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false); }}>
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col border-s border-cyan-300/15 bg-[#050817]/95 shadow-[-28px_0_80px_rgba(0,0,0,0.48)]" role="dialog" aria-modal="true" aria-label="KNOUX AI">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300"><BrainCircuit size={20} /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-sm tracking-wide text-white">KNOUX AI</strong><Sparkles size={13} className="text-violet-300" /></div><p className="mt-1 truncate text-[11px] text-slate-400">{isRtl ? 'العقل التشخيصي لـ KNOUX Repair' : 'Reasoning and diagnostics for KNOUX Repair'}</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label={isRtl ? 'إغلاق' : 'Close'}><X size={18} /></button>
        </header>

        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-2.5 text-[10px] font-mono"><span className={`h-2 w-2 rounded-full ${state === 'available' || state === 'ready' ? 'bg-emerald-400' : state === 'thinking' || state === 'checking' ? 'bg-amber-300' : 'bg-rose-400'}`} /><b className="text-slate-200">{stateLabel}</b><span className="text-slate-500">•</span><span className="min-w-0 flex-1 truncate text-slate-500">{statusMessage}</span>{(state === 'unavailable' || state === 'error') && <button type="button" onClick={() => void refreshStatus()} className="text-cyan-300 hover:text-cyan-200">{isRtl ? 'إعادة المحاولة' : 'Retry'}</button>}</div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {entries.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-cyan-300"><ShieldCheck size={16} /><strong className="text-xs">{isRtl ? 'حدود الحقيقة مفعّلة' : 'Product-truth boundary active'}</strong></div><p className="mt-2 text-xs leading-5 text-slate-400">{isRtl ? 'يعمل KNOUX AI على السياق والأدلة المتاحة، بينما يبقى التنفيذ تحت سياسات KNOUX المحلية.' : 'KNOUX AI reasons over available context and evidence while execution remains under local KNOUX policy.'}</p></div>}
          {entries.map(entry => <div key={entry.id} className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${entry.role === 'user' ? 'ms-8 border-violet-300/15 bg-violet-400/[0.07] text-slate-100' : 'me-4 border-cyan-300/15 bg-cyan-300/[0.05] text-slate-200'}`}><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{entry.role === 'user' ? (isRtl ? 'أنت' : 'You') : 'KNOUX AI'}</span><p className="whitespace-pre-wrap">{entry.text}</p></div>)}
          {state === 'thinking' && <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-xs text-slate-400"><Loader2 size={16} className="animate-spin text-cyan-300" />{isRtl ? 'تحليل السياق…' : 'Analyzing context…'}</div>}
          {state === 'error' && <div className="flex items-start gap-3 rounded-2xl border border-rose-400/15 bg-rose-400/[0.05] p-4 text-xs text-rose-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{statusMessage}</span></div>}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{QUICK_ACTIONS.map(action => <button key={action} type="button" disabled={state !== 'available' && state !== 'ready'} onClick={() => void send(action)} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35">{action}</button>)}</div>
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/25 p-2 focus-within:border-cyan-300/30"><textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder={isRtl ? 'اسأل KNOUX AI عن المشكلة أو الخدمة…' : 'Ask KNOUX AI about the issue or service…'} className="max-h-36 min-h-[54px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-600" /><button type="button" onClick={() => void send()} disabled={!prompt.trim() || state === 'thinking' || state === 'checking' || state === 'unavailable'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35" aria-label={isRtl ? 'إرسال' : 'Send'}><Send size={16} /></button></div>
        </div>
      </aside>
    </div>
  );
}
