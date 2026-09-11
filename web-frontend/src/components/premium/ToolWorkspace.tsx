import { useState, useMemo } from 'react';
import {
  Shield, RotateCcw, WifiOff, Play, Search, Eye, X, CheckCircle2,
  Info, FileText, Check, BookOpen, Download,
  History, Terminal, Clock
} from 'lucide-react';
import clsx from 'clsx';
import type { BridgeTool, ExecutionMode } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition } from '../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../types';

interface ToolWorkspaceProps {
  tool: BridgeTool;
  family: FamilyDefinition;
  service: ServiceDefinition;
  lang: 'en' | 'ar';
  bridgeElevated: boolean;
  toolStatus: ToolStatus;
  onRun: (mode: ExecutionMode) => void;
  onCancel: () => void;
  consoleEntries?: ConsoleEntry[];
  activeToolId?: string | null;
  onBack?: () => void;
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

type WorkspaceTab = 'overview' | 'safety' | 'scope' | 'evidence' | 'history';

export default function ToolWorkspace({
  tool,
  family,
  service,
  lang,
  bridgeElevated,
  toolStatus,
  onRun,
  onCancel,
  consoleEntries = [],
  activeToolId,
  onBack,
}: ToolWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const isRunning = toolStatus === 'running';
  const risk = RISK_LABELS[tool.RiskLevel] ?? RISK_LABELS.READ_ONLY;
  const needsAdmin = tool.RequiresAdmin && !bridgeElevated;
  const toolName = lang === 'ar' ? tool.ArabicName : tool.EnglishName;
  const isRtl = lang === 'ar';

  // Real log lines for this specific tool
  const toolLogs = useMemo(() => {
    if (activeToolId === tool.ToolId) {
      return consoleEntries;
    }
    return [];
  }, [activeToolId, tool.ToolId, consoleEntries]);

  // Derived recommendations strictly from tool metadata
  const recommendations = useMemo(() => {
    const list: { en: string; ar: string }[] = [];
    if (tool.RiskLevel === 'READ_ONLY') {
      list.push({ en: 'Gathering verifiable system diagnostic evidence', ar: 'جمع أدلة تشخيصية موثوقة للنظام' });
      list.push({ en: 'Non-intrusive health baseline reporting', ar: 'تقارير فحص أساسية غير معدلة للملفات' });
    } else if (tool.RiskLevel === 'SAFE_CLEANUP') {
      list.push({ en: 'Reclaiming wasted disk storage capacity', ar: 'استعادة مساحة القرص المستهلكة بالمخلفات' });
      list.push({ en: 'Removing obsolete cache & temporary residues', ar: 'إزالة الملفات المؤقتة وبقايا الذاكرة المخبأة' });
    } else {
      list.push({ en: 'Remediating system stability & registry faults', ar: 'إصلاح أعطال الاستقرار وسجل النظام' });
      list.push({ en: 'Restoring verified Windows component health', ar: 'استعادة سلامة مكونات ويندوز المحمية' });
    }
    if (tool.RequiresAdmin) {
      list.push({ en: 'Applies system-level administrative changes', ar: 'يطبق تغييرات إدارية على مستوى النظام' });
    } else {
      list.push({ en: 'Safe for execution under standard user rights', ar: 'آمن للتنفيذ بحساب مستخدم قياسي' });
    }
    return list;
  }, [tool.RiskLevel, tool.RequiresAdmin]);

  // Export structured support report
  const handleExportReport = () => {
    const reportText = [
      `KNOUX Repair — Technical Execution Report`,
      `Tool ID: ${tool.ToolId}`,
      `Name: ${tool.EnglishName} (${tool.ArabicName})`,
      `Family: ${family.name.en}`,
      `Service: ${service.name.en}`,
      `Risk Level: ${tool.RiskLevel}`,
      `Requires Admin: ${tool.RequiresAdmin ? 'Yes' : 'No'}`,
      `Requires Restart: ${tool.RequiresRestart ? 'Yes' : 'No'}`,
      `Offline Capability: ${tool.OfflineCapability}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Execution Status: ${toolStatus}`,
      ``,
      `--- Purpose ---`,
      tool.Purpose,
      ``,
      `--- Runtime Console Output (${toolLogs.length} lines) ---`,
      ...toolLogs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`),
    ].join('\n');

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KNOUX_Report_${tool.ToolId}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="knoux-tool-workspace mt-4 p-5 md:p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Breadcrumb ── */}
      <div className="knoux-breadcrumb text-xs mb-4 flex items-center gap-2 text-slate-400 font-mono">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer mr-1"
          >
            ← {lang === 'ar' ? 'الرجوع للقائمة' : 'Back to Catalog'}
          </button>
        )}
        <span onClick={onBack} className={clsx(onBack && 'cursor-pointer hover:text-white transition-colors')}>{lang === 'ar' ? family.name.ar : family.name.en}</span>
        <span className="knoux-breadcrumb-sep text-slate-600">/</span>
        <span onClick={onBack} className={clsx(onBack && 'cursor-pointer hover:text-white transition-colors')}>{lang === 'ar' ? service.name.ar : service.name.en}</span>
        <span className="knoux-breadcrumb-sep text-slate-600">/</span>
        <span className="knoux-breadcrumb-current font-bold text-cyan-400">{toolName}</span>
      </div>

      {/* ── Two-Column Main Layout (Left: Tool Flow, Right: Guidance Panel) ── */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* LEFT COLUMN: Tool Header, Tabs, Progress & Execution */}
        <div className="flex-1 w-full min-w-0 space-y-5">
          {/* Tool Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {tool.ToolId}
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight font-display">
                  {toolName}
                </h2>
              </div>
              <p className="text-xs md:text-sm leading-relaxed text-slate-300 max-w-xl">
                {tool.Purpose}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className={clsx('knoux-badge text-xs px-2.5 py-1 rounded-full font-semibold', risk.cls)}>
                {lang === 'ar' ? risk.ar : risk.en}
              </span>

              {tool.RequiresAdmin && (
                <span className={clsx('knoux-badge text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold', needsAdmin ? 'knoux-badge-critical' : 'knoux-badge-safe')}>
                  <Shield size={12} />
                  {needsAdmin
                    ? (lang === 'ar' ? 'مسؤول مطلوب' : 'Admin Required')
                    : (lang === 'ar' ? 'مسؤول متوفر' : 'Admin Available')}
                </span>
              )}

              {tool.RequiresRestart && (
                <span className="knoux-badge knoux-badge-elevated text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <RotateCcw size={12} />
                  {lang === 'ar' ? 'إعادة تشغيل' : 'Restart Needed'}
                </span>
              )}

              {tool.OfflineCapability === 'FULL' && (
                <span className="knoux-badge knoux-badge-safe text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <WifiOff size={12} />
                  {lang === 'ar' ? 'بدون إنترنت' : 'Offline Capable'}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs (Overview, Safety, Scope, Evidence, History) */}
          <div className="flex items-center gap-1 border-b border-white/[0.08] overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={clsx(
                "px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
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
                "px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
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
                "px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                activeTab === 'scope'
                  ? "border-cyan-400 text-cyan-300 bg-white/[0.02]"
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <FileText size={13} />
              <span>{lang === 'ar' ? 'نطاق التأثير' : 'Execution Scope'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={clsx(
                "px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                activeTab === 'evidence'
                  ? "border-cyan-400 text-cyan-300 bg-white/[0.02]"
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <Terminal size={13} />
              <span>{lang === 'ar' ? 'الأدلة والسجلات' : 'Evidence'}</span>
              {toolLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                  {toolLogs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={clsx(
                "px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                activeTab === 'history'
                  ? "border-cyan-400 text-cyan-300 bg-white/[0.02]"
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <History size={13} />
              <span>{lang === 'ar' ? 'سجل التشغيل' : 'History'}</span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="text-xs text-slate-300 min-h-[90px]">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-slate-400 mb-1">{lang === 'ar' ? 'الخدمة التابعة' : 'Parent Service'}</div>
                  <div className="font-semibold text-white">{lang === 'ar' ? service.name.ar : service.name.en}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-slate-400 mb-1">{lang === 'ar' ? 'أوضاع التشغيل' : 'Supported Modes'}</div>
                  <div className="font-semibold text-white">
                    {[
                      tool.AnalyzeOnlySupported ? (lang === 'ar' ? 'تحليل' : 'Analyze') : null,
                      tool.WhatIfSupported ? (lang === 'ar' ? 'معاينة' : 'WhatIf') : null,
                      lang === 'ar' ? 'تنفيذ كامل' : 'Execute'
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-slate-400 mb-1">{lang === 'ar' ? 'الاعتماد على الشبكة' : 'Connectivity'}</div>
                  <div className="font-semibold text-white">
                    {tool.OfflineCapability === 'FULL'
                      ? (lang === 'ar' ? 'محلي بالكامل (بدون إنترنت)' : 'Fully Offline Capable')
                      : (lang === 'ar' ? 'يتطلب اتصال إنترنت' : 'Network Dependent')}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'safety' && (
              <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-start gap-2.5">
                  <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <b className="text-white">{lang === 'ar' ? 'تصنيف المخاطرة:' : 'Risk Assessment:'} </b>
                    <span>{lang === 'ar' ? risk.descAr : risk.descEn}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <b className="text-white">{lang === 'ar' ? 'صلاحيات المسؤول:' : 'Elevation State:'} </b>
                    <span>
                      {tool.RequiresAdmin
                        ? (needsAdmin
                          ? (lang === 'ar' ? 'غير متوفرة. يلزم إعادة تشغيل التطبيق كمسؤول.' : 'Not elevated. Restart KNOUX Repair with administrator privileges.')
                          : (lang === 'ar' ? 'متوفرة وجاهزة للتنفيذ.' : 'Elevated token verified and ready for execution.'))
                        : (lang === 'ar' ? 'غير مطلوبة لهذا الإجراء.' : 'Standard user privileges sufficient.')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'scope' && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] leading-relaxed">
                <p className="text-slate-300">
                  {lang === 'ar'
                    ? `هذه الأداة جزء من منصة KNOUX Repair الكنسية (المعرف: ${tool.ToolId}). تنفذ عبر كونسول PowerShell المدار والمحمي بالـ Nonce Token دون مخاطر خروج عن النطاق المسموح به.`
                    : `This tool is part of the KNOUX Repair canonical suite (ID: ${tool.ToolId}). Executes via the managed loopback PowerShell bridge secured with single-use nonce tokens.`}
                </p>
              </div>
            )}

            {activeTab === 'evidence' && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs">
                {toolLogs.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {toolLogs.map((log) => (
                      <div
                        key={log.id}
                        className={clsx(
                          "leading-tight text-[11px]",
                          log.type === 'error' ? 'text-red-400' : 'text-slate-300'
                        )}
                      >
                        <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                        <span>{log.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400">
                    <Terminal size={18} className="mx-auto mb-1.5 text-slate-500" />
                    <p>{lang === 'ar' ? 'لم يتم تسجيل أدلة تنفيذية حتى الآن' : 'No execution evidence recorded yet'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {lang === 'ar' ? 'قم بتشغيل الأداة أو إجراء فحص لجمع أدلة التشخيص' : 'Execute or analyze this tool to collect diagnostic evidence.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {toolStatus !== 'idle' ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-cyan-400" />
                      <div>
                        <span className="font-semibold text-white">{lang === 'ar' ? 'الجلسة الحالية' : 'Current Session Run'}</span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date().toLocaleDateString()} • {tool.ToolId}
                        </div>
                      </div>
                    </div>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold",
                      toolStatus === 'success' && "bg-emerald-500/20 text-emerald-300",
                      toolStatus === 'running' && "bg-cyan-500/20 text-cyan-300 animate-pulse",
                      toolStatus === 'error' && "bg-red-500/20 text-red-300",
                      toolStatus === 'cancelled' && "bg-slate-500/20 text-slate-300"
                    )}>
                      {toolStatus.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400">
                    <History size={18} className="mx-auto mb-1.5 text-slate-500" />
                    <p>{lang === 'ar' ? 'لا يوجد سجل تشغيل في هذه الجلسة' : 'No execution history recorded in this session'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {lang === 'ar' ? 'يتم حفظ السجلات محلياً تحت شجرة تقارير المشروع' : 'Run reports remain local under the project report tree.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4-Step Process Progress Bar (Matching Reference P0-10) */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] font-mono mb-3 text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {lang === 'ar' ? 'مراحل العملية:' : 'Tool Progress:'}
              </span>
              <span className="font-bold text-cyan-300 uppercase">
                {toolStatus}
              </span>
            </div>

            {/* Stepper Workflow */}
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
              <div className={clsx(
                "p-2 rounded-lg border transition-all",
                isRunning || toolStatus === 'success'
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                  : "bg-white/[0.02] border-white/[0.04] text-slate-500"
              )}>
                <div className="font-bold">1. {lang === 'ar' ? 'التحليل' : 'Analyze'}</div>
              </div>
              <div className={clsx(
                "p-2 rounded-lg border transition-all",
                isRunning || toolStatus === 'success'
                  ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                  : "bg-white/[0.02] border-white/[0.04] text-slate-500"
              )}>
                <div className="font-bold">2. {lang === 'ar' ? 'المعاينة' : 'Preview'}</div>
              </div>
              <div className={clsx(
                "p-2 rounded-lg border transition-all",
                isRunning
                  ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200 animate-pulse"
                  : toolStatus === 'success'
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-white/[0.02] border-white/[0.04] text-slate-500"
              )}>
                <div className="font-bold">3. {lang === 'ar' ? 'التنفيذ' : 'Action'}</div>
              </div>
              <div className={clsx(
                "p-2 rounded-lg border transition-all",
                toolStatus === 'success'
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold"
                  : "bg-white/[0.02] border-white/[0.04] text-slate-500"
              )}>
                <div className="font-bold">4. {lang === 'ar' ? 'الاكتمال' : 'Finalize'}</div>
              </div>
            </div>

            {/* Indeterminate animation bar when running */}
            {isRunning && (
              <div className="w-full mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full animate-slide-indeterminate" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-1">
            {tool.AnalyzeOnlySupported && (
              <button
                type="button"
                onClick={() => onRun('analyze')}
                disabled={isRunning || needsAdmin}
                className="knoux-btn knoux-btn-secondary text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                className="knoux-btn knoux-btn-secondary text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                className="knoux-btn knoux-btn-danger text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <X size={14} />
                <span>{lang === 'ar' ? 'إلغاء التنفيذ' : 'Cancel'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRun('run')}
                disabled={needsAdmin}
                className="knoux-btn knoux-btn-primary text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                title={needsAdmin ? (lang === 'ar' ? 'يتطلب صلاحيات مسؤول' : 'Requires administrator privileges') : ''}
              >
                <Play size={14} />
                <span>{lang === 'ar' ? 'تشغيل الأداة' : 'Run Tool'}</span>
              </button>
            )}
          </div>

          {/* Admin warning */}
          {needsAdmin && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <Shield size={13} className="shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'هذه الأداة تتطلب صلاحيات المسؤول. أعد تشغيل KNOUX Repair كمسؤول.'
                  : 'This tool requires administrator privileges. Restart KNOUX Repair as administrator.'}
              </span>
            </p>
          )}
        </div>

        {/* ── RIGHT COLUMN: Contextual Tool Help & Guidance Panel (P0-10 Reference) ── */}
        <div className="w-full lg:w-72 shrink-0 rounded-xl bg-black/40 border border-white/10 p-4 space-y-4 text-xs backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <BookOpen size={16} className="text-cyan-400" />
            <h3 className="font-bold text-white tracking-wide">
              {lang === 'ar' ? 'دليل وإرشادات الأداة' : 'Tool Help & Guidance'}
            </h3>
          </div>

          {/* Contextual description */}
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {tool.Purpose}
          </p>

          {/* Recommended For Section */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="font-semibold text-slate-200 text-[11px]">
              {lang === 'ar' ? 'يوصى بها لـ:' : 'Recommended For:'}
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                  <span>{lang === 'ar' ? rec.ar : rec.en}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Last Run Summary Section */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="font-semibold text-slate-200 text-[11px] flex items-center justify-between">
              <span>{lang === 'ar' ? 'ملخص آخر تشغيل:' : 'Last Run Summary:'}</span>
              <span className="text-[10px] font-mono text-slate-400">
                {toolStatus !== 'idle' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'لم ينفذ' : 'None')}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ar' ? 'الحالة:' : 'Status:'}</span>
                <span className={clsx(
                  "font-bold",
                  toolStatus === 'success' && "text-emerald-400",
                  toolStatus === 'running' && "text-cyan-400",
                  toolStatus === 'error' && "text-red-400",
                  toolStatus === 'idle' && "text-slate-400"
                )}>
                  {toolStatus.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ar' ? 'الأسطر المسجلة:' : 'Log Lines:'}</span>
                <span className="text-white">{toolLogs.length}</span>
              </div>
            </div>
          </div>

          {/* Export Support Report CTA Button */}
          <button
            type="button"
            onClick={handleExportReport}
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download size={13} />
            <span>{lang === 'ar' ? 'تصدير تقرير الدعم' : 'Export Support Report'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
