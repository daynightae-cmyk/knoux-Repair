import clsx from 'clsx';
import type { BridgeTool } from '../../lib/api';
import type { ToolStatus } from '../../types';
import { Shield, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface ToolRowProps {
  tool: BridgeTool;
  active: boolean;
  status: ToolStatus;
  onClick: () => void;
  lang: 'en' | 'ar';
}

const RISK_DOTS: Record<string, string> = {
  READ_ONLY: 'bg-emerald-400',
  SAFE_CLEANUP: 'bg-cyan-400',
  SYSTEM_REPAIR: 'bg-amber-400',
  REBOOT_REQUIRED: 'bg-orange-400',
  DESTRUCTIVE: 'bg-red-400',
  WINRE_ONLY: 'bg-red-400',
};

export default function ToolRow({ tool, active, status, onClick, lang }: ToolRowProps) {
  const name = lang === 'ar' ? tool.ArabicName : tool.EnglishName;
  const dotColor = RISK_DOTS[tool.RiskLevel] ?? 'bg-slate-400';

  return (
    <button
      type="button"
      className="knoux-tool-row w-full text-left"
      data-active={active}
      onClick={onClick}
      aria-pressed={active}
    >
      {/* Risk indicator dot */}
      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', dotColor)} title={tool.RiskLevel} />

      {/* Tool name */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: active ? 'var(--knoux-text)' : 'var(--knoux-text-secondary)' }}>
          {name}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--knoux-text-faint)' }}>
          {tool.Purpose?.slice(0, 80)}
        </div>
      </div>

      {/* Admin indicator */}
      {tool.RequiresAdmin && (
        <span title={lang === 'ar' ? 'يحتاج صلاحيات مسؤول' : 'Admin required'} className="flex-shrink-0">
          <Shield size={12} style={{ color: 'var(--knoux-text-disabled)' }} />
        </span>
      )}

      {/* Status indicator */}
      {status === 'running' && <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--knoux-cyan)' }} />}
      {status === 'success' && <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: 'var(--knoux-success)' }} />}
      {status === 'error' && <AlertTriangle size={14} className="flex-shrink-0" style={{ color: 'var(--knoux-danger)' }} />}
      {status === 'cancelled' && <X size={14} className="flex-shrink-0" style={{ color: 'var(--knoux-text-muted)' }} />}
    </button>
  );
}
