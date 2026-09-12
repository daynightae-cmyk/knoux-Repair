import clsx from 'clsx';
import * as LucideIcons from 'lucide-react';
import type { BridgeTool } from '../../lib/api';
import type { ToolStatus } from '../../types';

interface ToolCardProps {
  tool: BridgeTool;
  serviceIcon: string;
  active: boolean;
  status: ToolStatus;
  bridgeOnline: boolean | null;
  onClick: () => void;
  lang: 'en' | 'ar';
}

const RISK_META: Record<string, { en: string; ar: string; cls: string }> = {
  READ_ONLY: { en: 'Read only', ar: 'قراءة فقط', cls: 'knoux-tool-risk-safe' },
  SAFE_CLEANUP: { en: 'Low risk', ar: 'مخاطرة منخفضة', cls: 'knoux-tool-risk-low' },
  SYSTEM_REPAIR: { en: 'System repair', ar: 'إصلاح نظام', cls: 'knoux-tool-risk-caution' },
  REBOOT_REQUIRED: { en: 'Restart aware', ar: 'قد يتطلب إعادة تشغيل', cls: 'knoux-tool-risk-elevated' },
  DESTRUCTIVE: { en: 'Critical', ar: 'حرج', cls: 'knoux-tool-risk-critical' },
  WINRE_ONLY: { en: 'WinRE only', ar: 'بيئة الاسترداد فقط', cls: 'knoux-tool-risk-critical' },
};

const STATUS_META: Record<ToolStatus, { en: string; ar: string; cls: string }> = {
  idle: { en: 'Ready', ar: 'جاهز', cls: 'is-idle' },
  running: { en: 'Running', ar: 'قيد التشغيل', cls: 'is-running' },
  success: { en: 'Completed', ar: 'مكتمل', cls: 'is-success' },
  error: { en: 'Failed', ar: 'فشل', cls: 'is-error' },
  cancelled: { en: 'Cancelled', ar: 'ملغي', cls: 'is-muted' },
  inconclusive: { en: 'Inconclusive', ar: 'غير حاسم', cls: 'is-warning' },
};

export default function ToolCard({
  tool,
  serviceIcon,
  active,
  status,
  bridgeOnline,
  onClick,
  lang,
}: ToolCardProps) {
  const isRtl = lang === 'ar';
  const name = isRtl ? tool.ArabicName : tool.EnglishName;
  const risk = RISK_META[tool.RiskLevel] ?? RISK_META.READ_ONLY;
  const state = STATUS_META[status] ?? STATUS_META.idle;
  const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[serviceIcon] ?? LucideIcons.Wrench;
  const availability = bridgeOnline === true
    ? (isRtl ? 'متاح عبر الجسر' : 'Bridge available')
    : bridgeOnline === false
      ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline')
      : (isRtl ? 'جارٍ التحقق' : 'Checking bridge');

  return (
    <button
      type="button"
      className="knoux-tool-card"
      data-active={active}
      data-tool-id={tool.ToolId}
      data-tool-status={status}
      onClick={onClick}
      aria-pressed={active}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="knoux-tool-card-glow" aria-hidden="true" />

      <div className="knoux-tool-card-head">
        <div className="knoux-tool-card-icon" aria-hidden="true">
          <Icon size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="knoux-tool-card-id">{tool.ToolId}</div>
          <h4 className="knoux-tool-card-title">{name}</h4>
        </div>
        <span className={clsx('knoux-tool-state', state.cls)}>
          {isRtl ? state.ar : state.en}
        </span>
      </div>

      <p className="knoux-tool-card-purpose">{tool.Purpose}</p>

      <div className="knoux-tool-card-meta">
        <span className={clsx('knoux-tool-risk', risk.cls)}>
          {isRtl ? risk.ar : risk.en}
        </span>
        <span className="knoux-tool-chip">
          {tool.RequiresAdmin
            ? (isRtl ? 'مسؤول' : 'Admin')
            : (isRtl ? 'مستخدم قياسي' : 'Standard user')}
        </span>
        {tool.OfflineCapability && (
          <span className="knoux-tool-chip">
            {tool.OfflineCapability === 'FULL'
              ? (isRtl ? 'محلي بالكامل' : 'Offline')
              : tool.OfflineCapability === 'PARTIAL'
                ? (isRtl ? 'محلي جزئياً' : 'Partial offline')
                : (isRtl ? 'يتطلب شبكة' : 'Network')}
          </span>
        )}
        {tool.ReportsEvidence && (
          <span className="knoux-tool-chip">{isRtl ? 'أدلة' : 'Evidence'}</span>
        )}
      </div>

      <div className="knoux-tool-card-foot">
        <span className={clsx('knoux-availability-dot', bridgeOnline === true && 'is-online', bridgeOnline === false && 'is-offline')} />
        <span>{availability}</span>
        {tool.RequiresRestart && <span className="ml-auto rtl:mr-auto rtl:ml-0">{isRtl ? 'إعادة تشغيل' : 'Restart aware'}</span>}
      </div>
    </button>
  );
}
