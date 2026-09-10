import { Shield, RotateCcw, WifiOff, Play, Search, Eye, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { BridgeTool, ExecutionMode } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition } from '../../data/family-map';
import type { ToolStatus } from '../../types';

interface ToolWorkspaceProps {
  tool: BridgeTool;
  family: FamilyDefinition;
  service: ServiceDefinition;
  lang: 'en' | 'ar';
  bridgeElevated: boolean;
  toolStatus: ToolStatus;
  onRun: (mode: ExecutionMode) => void;
  onCancel: () => void;
}

const RISK_LABELS: Record<string, { en: string; ar: string; cls: string }> = {
  READ_ONLY: { en: 'Safe', ar: 'آمن', cls: 'knoux-badge-safe' },
  SAFE_CLEANUP: { en: 'Low Risk', ar: 'مخاطرة منخفضة', cls: 'knoux-badge-low' },
  SYSTEM_REPAIR: { en: 'Caution', ar: 'تحذير', cls: 'knoux-badge-caution' },
  REBOOT_REQUIRED: { en: 'Elevated', ar: 'متقدم', cls: 'knoux-badge-elevated' },
  DESTRUCTIVE: { en: 'Critical', ar: 'حرج', cls: 'knoux-badge-critical' },
  WINRE_ONLY: { en: 'Critical', ar: 'حرج', cls: 'knoux-badge-critical' },
};

export default function ToolWorkspace({
  tool, family, service, lang, bridgeElevated, toolStatus, onRun, onCancel,
}: ToolWorkspaceProps) {
  const isRunning = toolStatus === 'running';
  const risk = RISK_LABELS[tool.RiskLevel] ?? RISK_LABELS.READ_ONLY;
  const needsAdmin = tool.RequiresAdmin && !bridgeElevated;
  const toolName = lang === 'ar' ? tool.ArabicName : tool.EnglishName;

  return (
    <div className="knoux-tool-workspace mt-4">
      {/* Breadcrumb */}
      <div className="knoux-breadcrumb">
        <span>{lang === 'ar' ? family.name.ar : family.name.en}</span>
        <span className="knoux-breadcrumb-sep">/</span>
        <span>{lang === 'ar' ? service.name.ar : service.name.en}</span>
        <span className="knoux-breadcrumb-sep">/</span>
        <span className="knoux-breadcrumb-current">{toolName}</span>
      </div>

      {/* Tool Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--knoux-text)', font: 'var(--knoux-text-card-title)' }}>
          {toolName}
        </h2>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--knoux-text-muted)' }}>
          {tool.Purpose}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Risk badge */}
          <span className={clsx('knoux-badge', risk.cls)}>
            {lang === 'ar' ? risk.ar : risk.en}
          </span>

          {/* Admin requirement */}
          {tool.RequiresAdmin && (
            <span className={clsx('knoux-badge', needsAdmin ? 'knoux-badge-critical' : 'knoux-badge-safe')}>
              <Shield size={10} />
              {needsAdmin
                ? (lang === 'ar' ? 'يحتاج صلاحيات مسؤول' : 'Admin Required')
                : (lang === 'ar' ? 'صلاحيات مسؤول متوفرة' : 'Admin Available')}
            </span>
          )}

          {/* Restart requirement */}
          {tool.RequiresRestart && (
            <span className="knoux-badge knoux-badge-elevated">
              <RotateCcw size={10} />
              {lang === 'ar' ? 'قد يتطلب إعادة تشغيل' : 'May Require Restart'}
            </span>
          )}

          {/* Offline capability */}
          {tool.OfflineCapability === 'FULL' && (
            <span className="knoux-badge knoux-badge-safe">
              <WifiOff size={10} />
              {lang === 'ar' ? 'يعمل بدون إنترنت' : 'Offline Capable'}
            </span>
          )}
        </div>
      </div>

      {/* Status Display */}
      <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--knoux-surface-inset)', border: '1px solid var(--knoux-border-subtle)', minHeight: '80px' }}>
        {toolStatus === 'idle' && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <Play size={20} className="mb-2" style={{ color: 'var(--knoux-text-disabled)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-text-muted)' }}>
              {lang === 'ar' ? 'جاهز للتشغيل' : 'Ready to run'}
            </p>
          </div>
        )}
        {isRunning && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <Loader2 size={20} className="animate-spin mb-2" style={{ color: 'var(--knoux-cyan)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-cyan)' }}>
              {lang === 'ar' ? 'جارٍ التشغيل...' : 'Running...'}
            </p>
            <div className="knoux-progress w-48 mt-3">
              <div className="knoux-progress-bar" style={{ width: '100%', animation: 'knoux-progress-slide 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        )}
        {toolStatus === 'success' && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <CheckCircle2 size={20} className="mb-2" style={{ color: 'var(--knoux-success)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-success)' }}>
              {lang === 'ar' ? 'اكتمل بنجاح' : 'Completed successfully'}
            </p>
          </div>
        )}
        {toolStatus === 'error' && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <AlertTriangle size={20} className="mb-2" style={{ color: 'var(--knoux-danger)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-danger)' }}>
              {lang === 'ar' ? 'حدث خطأ أثناء التشغيل' : 'Error during execution'}
            </p>
          </div>
        )}
        {toolStatus === 'cancelled' && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <X size={20} className="mb-2" style={{ color: 'var(--knoux-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-text-muted)' }}>
              {lang === 'ar' ? 'تم الإلغاء' : 'Cancelled'}
            </p>
          </div>
        )}
        {toolStatus === 'inconclusive' && (
          <div className="flex flex-col items-center justify-center text-center py-4">
            <AlertTriangle size={20} className="mb-2" style={{ color: 'var(--knoux-warning)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-warning)' }}>
              {lang === 'ar' ? 'النتيجة غير حاسمة' : 'Inconclusive result'}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {tool.AnalyzeOnlySupported && (
          <button
            type="button"
            onClick={() => onRun('analyze')}
            disabled={isRunning || needsAdmin}
            className="knoux-btn knoux-btn-secondary"
          >
            <Search size={14} />
            {lang === 'ar' ? 'تحليل' : 'Analyze'}
          </button>
        )}
        {tool.WhatIfSupported && (
          <button
            type="button"
            onClick={() => onRun('preview')}
            disabled={isRunning || needsAdmin}
            className="knoux-btn knoux-btn-secondary"
          >
            <Eye size={14} />
            {lang === 'ar' ? 'معاينة' : 'Preview'}
          </button>
        )}

        <div className="flex-1" />

        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="knoux-btn knoux-btn-danger"
          >
            <X size={14} />
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRun('run')}
            disabled={needsAdmin}
            className="knoux-btn knoux-btn-primary"
            title={needsAdmin ? (lang === 'ar' ? 'يتطلب صلاحيات مسؤول' : 'Requires administrator privileges') : ''}
          >
            <Play size={14} />
            {lang === 'ar' ? 'تشغيل' : 'Run'}
          </button>
        )}
      </div>

      {/* Admin warning */}
      {needsAdmin && (
        <p className="mt-3 text-xs" style={{ color: 'var(--knoux-warning)' }}>
          <Shield size={12} className="inline mr-1" />
          {lang === 'ar'
            ? 'هذه الأداة تتطلب صلاحيات المسؤول. أعد تشغيل KNOUX Repair كمسؤول.'
            : 'This tool requires administrator privileges. Restart KNOUX Repair as administrator.'}
        </p>
      )}
    </div>
  );
}
