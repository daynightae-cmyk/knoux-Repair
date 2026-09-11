import { useState } from 'react';
import {
  Shield, RotateCcw, WifiOff, Play, Search, Eye, X, CheckCircle2,
  AlertTriangle, Loader2, Info, FileText, Check
} from 'lucide-react';
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

const RISK_LABELS: Record<string, { en: string; ar: string; cls: string; descEn: string; descAr: string }> = {
  READ_ONLY: {
    en: 'Safe',
    ar: 'آمن',
    cls: 'knoux-badge-safe',
    descEn: 'Queries diagnostics and reports status without modifying files or system registry.',
    descAr: 'يستعرض التقارير والتشخيصات دون تعديل أي ملفات أو قيم في سجل النظام.'
  },
  SAFE_CLEANUP: {
    en: 'Low Risk',
    ar: 'مخاطرة منخفضة',
    cls: 'knoux-badge-low',
    descEn: 'Clears disposable caches and temporary files. User data and settings are preserved.',
    descAr: 'يمسح الذاكرة المؤقتة والملفات الزائدة المؤكدة مع الحفاظ التام على بيانات المستخدم.'
  },
  SYSTEM_REPAIR: {
    en: 'Caution',
    ar: 'تحذير',
    cls: 'knoux-badge-caution',
    descEn: 'Modifies system configuration, services, or registry values to resolve faults.',
    descAr: 'يعدل تكوينات النظام والخدمات وقيم التسجيل لمعالجة الأعطال.'
  },
  REBOOT_REQUIRED: {
    en: 'Elevated',
    ar: 'متقدم',
    cls: 'knoux-badge-elevated',
    descEn: 'System reboot is recommended or required for modifications to finalize.',
    descAr: 'يوصى أو يلزم إعادة تشغيل النظام لتطبيق التغييرات.'
  },
  DESTRUCTIVE: {
    en: 'Critical',
    ar: 'حرج',
    cls: 'knoux-badge-critical',
    descEn: 'Irreversible operations like file deletion or partition changes. Proceed with care.',
    descAr: 'عمليات لا رجعة فيها كالحذف الدائم أو تغيير الأقسام. تأكد قبل التنفيذ.'
  },
  WINRE_ONLY: {
    en: 'Critical',
    ar: 'حرج',
    cls: 'knoux-badge-critical',
    descEn: 'Designed for Windows Recovery Environment execution only.',
    descAr: 'مصمم للتنفيذ داخل بيئة استرداد ويندوز (WinRE) حصراً.'
  },
};

type WorkspaceTab = 'overview' | 'safety' | 'scope';

export default function ToolWorkspace({
  tool, family, service, lang, bridgeElevated, toolStatus, onRun, onCancel,
}: ToolWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const isRunning = toolStatus === 'running';
  const risk = RISK_LABELS[tool.RiskLevel] ?? RISK_LABELS.READ_ONLY;
  const needsAdmin = tool.RequiresAdmin && !bridgeElevated;
  const toolName = lang === 'ar' ? tool.ArabicName : tool.EnglishName;
  const isRtl = lang === 'ar';

  return (
    <div className="knoux-tool-workspace mt-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Breadcrumb */}
      <div className="knoux-breadcrumb text-xs mb-3 flex items-center gap-1.5 text-slate-400">
        <span className="hover:text-white transition-colors">{lang === 'ar' ? family.name.ar : family.name.en}</span>
        <span className="knoux-breadcrumb-sep text-slate-600">/</span>
        <span className="hover:text-white transition-colors">{lang === 'ar' ? service.name.ar : service.name.en}</span>
        <span className="knoux-breadcrumb-sep text-slate-600">/</span>
        <span className="knoux-breadcrumb-current font-bold text-cyan-400">{toolName}</span>
      </div>

      {/* Tool Header */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {tool.ToolId}
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {toolName}
            </h2>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Risk badge */}
            <span className={clsx('knoux-badge text-xs px-2.5 py-0.5 rounded-full font-semibold', risk.cls)}>
              {lang === 'ar' ? risk.ar : risk.en}
            </span>

            {/* Admin requirement */}
            {tool.RequiresAdmin && (
              <span className={clsx('knoux-badge text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold', needsAdmin ? 'knoux-badge-critical' : 'knoux-badge-safe')}>
                <Shield size={11} />
                {needsAdmin
                  ? (lang === 'ar' ? 'يحتاج صلاحيات مسؤول' : 'Admin Required')
                  : (lang === 'ar' ? 'صلاحيات مسؤول متوفرة' : 'Admin Available')}
              </span>
            )}

            {/* Restart requirement */}
            {tool.RequiresRestart && (
              <span className="knoux-badge knoux-badge-elevated text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <RotateCcw size={11} />
                {lang === 'ar' ? 'قد يتطلب إعادة تشغيل' : 'May Require Restart'}
              </span>
            )}

            {/* Offline capability */}
            {tool.OfflineCapability === 'FULL' && (
              <span className="knoux-badge knoux-badge-safe text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <WifiOff size={11} />
                {lang === 'ar' ? 'يعمل بدون إنترنت' : 'Offline Capable'}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-300">
          {tool.Purpose}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.08] mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={clsx(
            "px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === 'overview'
              ? "border-cyan-400 text-cyan-300 bg-white/[0.02]"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <Info size={13} />
          <span>{lang === 'ar' ? 'نظرة عامة' : 'Overview'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('safety')}
          className={clsx(
            "px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === 'safety'
              ? "border-cyan-400 text-cyan-300 bg-white/[0.02]"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <Shield size={13} />
          <span>{lang === 'ar' ? 'الأمان والمتطلبات' : 'Safety & Prerequisites'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scope')}
          className={clsx(
            "px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === 'scope'
              ? "border-cyan-400 text-cyan-300 bg-white/[0.02]"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <FileText size={13} />
          <span>{lang === 'ar' ? 'نطاق التأثير' : 'Execution Scope'}</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="mb-5 text-xs text-slate-300">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="text-slate-400 mb-1">{lang === 'ar' ? 'الخدمة التابعة' : 'Parent Service'}</div>
                <div className="font-semibold text-white">{lang === 'ar' ? service.name.ar : service.name.en}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="text-slate-400 mb-1">{lang === 'ar' ? 'وضع التحليل المدعوم' : 'Supported Modes'}</div>
                <div className="font-semibold text-white">
                  {[
                    tool.AnalyzeOnlySupported ? (lang === 'ar' ? 'تحليل' : 'Analyze') : null,
                    tool.WhatIfSupported ? (lang === 'ar' ? 'معاينة' : 'WhatIf') : null,
                    lang === 'ar' ? 'تنفيذ كامل' : 'Execute'
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="text-slate-400 mb-1">{lang === 'ar' ? 'الاعتماد على الشبكة' : 'Connectivity'}</div>
                <div className="font-semibold text-white">
                  {tool.OfflineCapability === 'FULL'
                    ? (lang === 'ar' ? 'محلي بالكامل (بدون إنترنت)' : 'Fully Offline Capable')
                    : (lang === 'ar' ? 'قد يتطلب اتصالاً' : 'Network Dependent')}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="space-y-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-start gap-2">
              <div className="mt-0.5"><Check size={14} className="text-emerald-400" /></div>
              <div>
                <b className="text-white">{lang === 'ar' ? 'تصنيف المخاطرة:' : 'Risk Assessment:'} </b>
                <span>{lang === 'ar' ? risk.descAr : risk.descEn}</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5"><Check size={14} className="text-emerald-400" /></div>
              <div>
                <b className="text-white">{lang === 'ar' ? 'صلاحيات المسؤول:' : 'Elevation State:'} </b>
                <span>
                  {tool.RequiresAdmin
                    ? (needsAdmin
                      ? (lang === 'ar' ? 'غير متوفرة. يلزم إعادة تشغيل التطبيق كمسؤول.' : 'Not elevated. Restart KNOUX Repair with administrator privileges.')
                      : (lang === 'ar' ? 'متوفرة وجاهزة للتنفيذ.' : 'Elevated token verified and ready for execution.'))
                    : (lang === 'ar' ? 'غير مطلوبة لهذا الإجراء.' : 'Standard privileges sufficient.')}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scope' && (
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] leading-relaxed">
            <p className="text-slate-300">
              {lang === 'ar'
                ? `هذه الأداة جزء من منصة KNOUX Repair الكنسية (المعرف: ${tool.ToolId}). تنفذ عبر كونسول PowerShell المدار والمحمي بالـ Nonce Token دون مخاطر خروج عن النطاق المسموح به.`
                : `This tool is part of the KNOUX Repair canonical suite (ID: ${tool.ToolId}). Executes via the managed loopback PowerShell bridge secured with single-use nonce tokens.`}
            </p>
          </div>
        )}
      </div>

      {/* Execution Status Display */}
      <div className="p-4 rounded-xl mb-4 bg-black/40 border border-white/[0.06] min-h-[72px] flex items-center justify-center">
        {toolStatus === 'idle' && (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <Play size={18} className="mb-1 text-slate-500" />
            <p className="text-xs text-slate-400">
              {lang === 'ar' ? 'جاهز للتشغيل' : 'Ready to run'}
            </p>
          </div>
        )}
        {isRunning && (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <Loader2 size={20} className="animate-spin mb-1 text-cyan-400" />
            <p className="text-xs text-cyan-300 font-medium">
              {lang === 'ar' ? 'جارٍ التنفيذ عبر الجسر المحلي...' : 'Executing via local bridge...'}
            </p>
            <div className="w-48 mt-2.5 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-cyan-400 rounded-full animate-slide-indeterminate" />
            </div>
          </div>
        )}
        {toolStatus === 'success' && (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <CheckCircle2 size={20} className="mb-1 text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">
              {lang === 'ar' ? 'اكتمل بنجاح' : 'Completed successfully'}
            </p>
          </div>
        )}
        {toolStatus === 'error' && (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <AlertTriangle size={20} className="mb-1 text-red-400" />
            <p className="text-xs font-semibold text-red-400">
              {lang === 'ar' ? 'حدث خطأ أثناء التشغيل — راجع سجل وحدة التحكم' : 'Error during execution — check console log'}
            </p>
          </div>
        )}
        {toolStatus === 'cancelled' && (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <X size={20} className="mb-1 text-slate-400" />
            <p className="text-xs text-slate-400">
              {lang === 'ar' ? 'تم إلغاء المهمة' : 'Execution cancelled'}
            </p>
          </div>
        )}
        {toolStatus === 'inconclusive' && (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <AlertTriangle size={20} className="mb-1 text-amber-400" />
            <p className="text-xs text-amber-400">
              {lang === 'ar' ? 'النتيجة غير حاسمة' : 'Inconclusive outcome'}
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
            className="knoux-btn knoux-btn-secondary text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Search size={14} />
            <span>{lang === 'ar' ? 'تحليل فقط' : 'Analyze'}</span>
          </button>
        )}
        {tool.WhatIfSupported && (
          <button
            type="button"
            onClick={() => onRun('preview')}
            disabled={isRunning || needsAdmin}
            className="knoux-btn knoux-btn-secondary text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Eye size={14} />
            <span>{lang === 'ar' ? 'معاينة WhatIf' : 'Preview'}</span>
          </button>
        )}

        <div className="flex-1" />

        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="knoux-btn knoux-btn-danger text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <X size={14} />
            <span>{lang === 'ar' ? 'إلغاء التنفيذ' : 'Cancel'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRun('run')}
            disabled={needsAdmin}
            className="knoux-btn knoux-btn-primary text-xs px-6 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            title={needsAdmin ? (lang === 'ar' ? 'يتطلب صلاحيات مسؤول' : 'Requires administrator privileges') : ''}
          >
            <Play size={14} />
            <span>{lang === 'ar' ? 'تشغيل الأداة' : 'Run Tool'}</span>
          </button>
        )}
      </div>

      {/* Admin warning */}
      {needsAdmin && (
        <p className="mt-3 text-xs text-amber-400 flex items-center gap-1.5">
          <Shield size={13} className="shrink-0" />
          <span>
            {lang === 'ar'
              ? 'هذه الأداة تتطلب صلاحيات المسؤول. أعد تشغيل KNOUX Repair كمسؤول.'
              : 'This tool requires administrator privileges. Restart KNOUX Repair as administrator.'}
          </span>
        </p>
      )}
    </div>
  );
}
