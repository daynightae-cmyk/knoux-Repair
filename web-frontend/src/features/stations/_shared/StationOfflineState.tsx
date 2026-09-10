import { useState } from 'react';
import { Unplug, RefreshCw, Copy, Check } from 'lucide-react';
import type { Lang } from '../../../lib/i18n';
import { copyTechnicalDetails } from './bridgeLifecycle';

interface StationOfflineStateProps {
  lang: Lang;
  reason: string;
  technical?: string;
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * StationOfflineState — the ONLY offline presentation stations may use.
 * Bridge unavailable renders UNAVAILABLE/OFFLINE, never "0 tools".
 */
export default function StationOfflineState({ lang, reason, technical = '', onRetry, retrying = false }: StationOfflineStateProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyTechnicalDetails(reason, technical));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard is best-effort */
    }
  };
  return (
    <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
      <div className="glass-panel rounded-2xl p-10 max-w-lg text-center border-amber-500/25">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 mb-6">
          <Unplug size={26} />
        </div>
        <p className="font-mono text-[10px] tracking-[0.3em] text-amber-400/70 mb-2">
          {lang === 'ar' ? 'غير متاح' : 'UNAVAILABLE'}
        </p>
        <h2 className="font-display text-xl font-bold tracking-wider text-white mb-3">
          {lang === 'ar' ? 'الجسر المحلي غير متصل' : 'Execution Bridge Offline'}
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-4" dir="auto">
          {reason || (lang === 'ar' ? 'تعذر الوصول إلى الجسر المحلي.' : 'The local execution bridge could not be reached.')}
        </p>
        {technical && (
          <p className="font-mono text-[10px] text-amber-300/70 tracking-wider mb-6 break-all" dir="ltr">
            {technical}
          </p>
        )}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-xs font-semibold tracking-wider text-cyan-400 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
            {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-xs font-semibold tracking-wider text-slate-300 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-all"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {lang === 'ar' ? 'نسخ التفاصيل التقنية' : 'Copy technical details'}
          </button>
        </div>
      </div>
    </div>
  );
}
