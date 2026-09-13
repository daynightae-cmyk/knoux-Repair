import { XCircle } from 'lucide-react';
import type { Lang } from '../../../lib/i18n';
import StationRunProgress from './StationRunProgress';

export type RunBannerAccent = 'cyan' | 'sky' | 'emerald' | 'teal';

interface StationActiveRunBannerProps {
  lang: Lang;
  toolId: string;
  lineCount: number;
  onCancel: () => void;
  accent?: RunBannerAccent;
  /**
   * running: live execution, Cancel sends a real bridge cancellation.
   * cancelling: cancellation requested, awaiting BACKEND confirmation.
   * The banner never claims CANCELLED — only terminal backend states do.
   */
  phase?: 'running' | 'cancelling';
}

const ACCENT_STYLES: Record<RunBannerAccent, { frame: string; button: string }> = {
  cyan: {
    frame: 'border-cyan-400/20 bg-cyan-950/30',
    button: 'border-cyan-400/40 text-cyan-200 hover:bg-cyan-900/40',
  },
  sky: {
    frame: 'border-sky-400/20 bg-sky-950/30',
    button: 'border-sky-400/40 text-sky-200 hover:bg-sky-900/40',
  },
  emerald: {
    frame: 'border-emerald-400/20 bg-emerald-950/30',
    button: 'border-emerald-400/40 text-emerald-200 hover:bg-emerald-900/40',
  },
  teal: {
    frame: 'border-teal-400/20 bg-teal-950/30',
    button: 'border-teal-400/40 text-teal-200 hover:bg-teal-900/40',
  },
};

/**
 * StationActiveRunBanner — the single shared running-state banner for every
 * station. Selection and execution stay separate: the banner owns the live
 * run wherever the user navigates inside the station, with one honest
 * indeterminate progress (no fabricated percentages) and one Cancel action.
 */
export default function StationActiveRunBanner({
  lang,
  toolId,
  lineCount,
  onCancel,
  accent = 'cyan',
  phase = 'running',
}: StationActiveRunBannerProps) {
  const styles = ACCENT_STYLES[accent];
  const cancelling = phase === 'cancelling';
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${styles.frame}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex-1">
        <StationRunProgress lang={lang} state="RUNNING" toolId={toolId} lineCount={lineCount} />
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        aria-disabled={cancelling}
        title={
          cancelling
            ? lang === 'ar'
              ? 'تم إرسال طلب الإلغاء — بانتظار تأكيد الخدمة الخلفية'
              : 'Cancellation requested — awaiting backend confirmation'
            : undefined
        }
        className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-transparent border transition ${styles.button} ${cancelling ? 'opacity-60 cursor-wait' : ''}`}
      >
        <XCircle size={14} />
        {cancelling
          ? lang === 'ar'
            ? 'جارٍ تأكيد الإلغاء…'
            : 'Confirming cancel…'
          : lang === 'ar'
            ? 'إلغاء التنفيذ'
            : 'Cancel run'}
      </button>
    </div>
  );
}
