import type { Lang } from '../../../lib/i18n';
import type { KnouxRunResult } from '../../../lib/api';
import { normalizeResultStatus, readResultField } from './contracts';

interface StationResultRendererProps {
  lang: Lang;
  result: KnouxRunResult | null;
}

/**
 * StationResultRenderer — evidence-first rendering of the structured result.
 * Missing evidence renders as Not scanned / Unavailable / Inconclusive.
 * Values are never invented.
 */
export default function StationResultRenderer({ lang, result }: StationResultRendererProps) {
  if (!result) {
    return <p className="font-mono text-[11px] text-slate-400">{lang === 'ar' ? 'لم يتم الفحص بعد' : 'Not scanned'}</p>;
  }
  const status = normalizeResultStatus(readResultField<string>(result, 'status', 'Status'));
  const itemsFound = readResultField<number>(result, 'itemsFound', 'ItemsFound');
  const itemsProcessed = readResultField<number>(result, 'itemsProcessed', 'ItemsProcessed');
  const verification = readResultField<string>(result, 'verificationResult', 'VerificationResult');
  const errorMessage = readResultField<string>(result, 'errorMessage', 'ErrorMessage');
  const reportPath = readResultField<string>(result, 'reportPath', 'ReportPath');

  const unavailable = lang === 'ar' ? 'غير متاح' : 'Unavailable';
  const fmt = (value: number | null) => (value === null || value === undefined ? unavailable : String(value));

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.2em] text-slate-400">{lang === 'ar' ? 'النتيجة' : 'RESULT'}</span>
        <span
          className={`font-mono text-[11px] font-bold ${
            status === 'SUCCESS' ? 'text-emerald-400' : status === 'INCONCLUSIVE' ? 'text-yellow-300' : status === 'FAILED' ? 'text-red-400' : 'text-slate-300'
          }`}
        >
          {status}
        </span>
      </div>
      {status === 'INCONCLUSIVE' && (
        <p className="text-xs text-yellow-200/80">
          {lang === 'ar' ? 'الأدلة غير حاسمة. لا يتم ادعاء أي نتيجة.' : 'Evidence was inconclusive. No result is claimed.'}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div><dt className="text-slate-500">{lang === 'ar' ? 'المكتشف' : 'Found'}</dt><dd className="text-slate-200">{fmt(itemsFound)}</dd></div>
        <div><dt className="text-slate-500">{lang === 'ar' ? 'المعالج' : 'Processed'}</dt><dd className="text-slate-200">{fmt(itemsProcessed)}</dd></div>
        <div><dt className="text-slate-500">{lang === 'ar' ? 'التحقق' : 'Verification'}</dt><dd className="text-slate-200">{verification || unavailable}</dd></div>
        <div><dt className="text-slate-500">{lang === 'ar' ? 'التقرير' : 'Report'}</dt><dd className="text-slate-200 break-all" dir="ltr">{reportPath || unavailable}</dd></div>
      </dl>
      {errorMessage && <p className="text-xs text-red-300/90" dir="auto">{errorMessage}</p>}
    </div>
  );
}
