import type { Lang } from '../../../lib/i18n';
import type { ExecutionState } from './contracts';

interface StationRunProgressProps {
  lang: Lang;
  state: ExecutionState;
  toolId: string;
  lineCount?: number;
}

const STATE_COPY: Record<ExecutionState, { en: string; ar: string }> = {
  IDLE: { en: 'Idle', ar: 'خامل' },
  PREPARING: { en: 'Preparing a safe workspace', ar: 'تحضير مساحة عمل آمنة' },
  WAITING_FOR_CONFIRMATION: { en: 'Waiting for confirmation', ar: 'بانتظار التأكيد' },
  WAITING_FOR_ELEVATION: { en: 'Administrator permission required', ar: 'تتطلب صلاحية المدير' },
  RUNNING: { en: 'Running', ar: 'قيد التنفيذ' },
  VERIFYING: { en: 'Verifying evidence', ar: 'التحقق من الأدلة' },
  SUCCESS: { en: 'Success', ar: 'نجاح' },
  WARNING: { en: 'Completed with warnings', ar: 'اكتمل مع تحذيرات' },
  FAILED: { en: 'Failed', ar: 'فشل' },
  CANCELLED: { en: 'Cancelled', ar: 'أُلغي' },
  SKIPPED: { en: 'Skipped', ar: 'تخطي' },
  INCONCLUSIVE: { en: 'Inconclusive', ar: 'غير حاسم' },
};

/** StationRunProgress — progress for every execution state, including waits. */
export default function StationRunProgress({ lang, state, toolId, lineCount = 0 }: StationRunProgressProps) {
  const copy = STATE_COPY[state][lang];
  const active = state === 'RUNNING' || state === 'PREPARING' || state === 'VERIFYING';
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-cyan-400">{toolId}</span>
        <span className="font-mono text-[11px] text-slate-300">{copy}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" role="progressbar" aria-valuetext={copy}>
        <div className={`h-full rounded-full bg-cyan-400/70 transition-all ${active ? 'animate-pulse w-2/3' : state === 'SUCCESS' ? 'w-full' : 'w-1/3'}`} />
      </div>
      {lineCount > 0 && <p className="mt-1 font-mono text-[10px] text-slate-500">{lineCount} lines</p>}
    </div>
  );
}
