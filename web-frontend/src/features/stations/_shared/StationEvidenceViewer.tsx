import type { Lang } from '../../../lib/i18n';
import type { KnouxRunResult } from '../../../lib/api';
import { readResultField } from './contracts';

interface StationEvidenceViewerProps {
  lang: Lang;
  result: KnouxRunResult | null;
  lines?: Array<{ t: string; s: string; text: string }>;
}

/** StationEvidenceViewer — report path, verification, and raw evidence lines. */
export default function StationEvidenceViewer({ lang, result, lines = [] }: StationEvidenceViewerProps) {
  const unavailable = lang === 'ar' ? 'غير متاح' : 'Unavailable';
  const reportPath = readResultField<string>(result, 'reportPath', 'ReportPath');
  const evidence = readResultField<unknown>(result, 'evidence', 'Evidence');
  const evidenceText = typeof evidence === 'string' ? evidence : evidence ? JSON.stringify(evidence) : '';
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4 space-y-3">
      <p className="font-mono text-[10px] tracking-[0.2em] text-slate-400">{lang === 'ar' ? 'الأدلة' : 'EVIDENCE'}</p>
      <p className="font-mono text-[11px] text-slate-300 break-all" dir="ltr">
        {reportPath || unavailable}
      </p>
      {evidenceText && (
        <pre className="max-h-40 overflow-y-auto rounded-lg bg-black/50 p-3 font-mono text-[10px] text-slate-300 whitespace-pre-wrap" dir="auto">
          {evidenceText}
        </pre>
      )}
      {lines.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {lines.slice(-50).map((line, index) => (
            <p key={index} className={`font-mono text-[10px] ${line.s === 'err' ? 'text-red-300/90' : 'text-slate-300'}`}>
              {line.text}
            </p>
          ))}
        </div>
      )}
      {lines.length === 0 && !evidenceText && (
        <p className="font-mono text-[11px] text-slate-500">{lang === 'ar' ? 'لا توجد أدلة بعد' : 'No evidence yet'}</p>
      )}
    </div>
  );
}
