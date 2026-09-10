import type { Lang } from '../../../lib/i18n';
import type { ToolStatus } from '../../../types';

export interface HistoryEntry {
  toolId: string;
  status: ToolStatus;
  at: string;
}

interface StationHistoryProps {
  lang: Lang;
  entries: HistoryEntry[];
}

/** StationHistory — per-station run history from live statuses, never invented. */
export default function StationHistory({ lang, entries }: StationHistoryProps) {
  if (entries.length === 0) {
    return <p className="font-mono text-[11px] text-slate-500">{lang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {entries.map((entry, index) => (
        <li key={`${entry.toolId}-${index}`} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/30 px-3 py-2">
          <span className="font-mono text-[11px] font-bold text-slate-300">{entry.toolId}</span>
          <span className="font-mono text-[10px] text-slate-400">{entry.status.toUpperCase()} · {entry.at}</span>
        </li>
      ))}
    </ul>
  );
}
