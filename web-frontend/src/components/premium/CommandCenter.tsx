/**
 * KNOUX Repair — CommandCenterShell.
 *
 * ONE persistent workstation:
 *   [ServiceRail] [LiveWorkspace (always mounted)] [ToolRail]
 *   [ContextDock]
 *
 * Focus precedence (execution truth outranks selection):
 *   runningTool > selectedTool > last finished tool with result > standby.
 * The center never unmounts and never scrolls the page. Rails control it.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import {
  Play, Search, Eye, X, Shield, Clock,
  ScrollText, Flag, Download, RotateCcw,
  Radio, WifiOff, CircleDot,
} from 'lucide-react';
import clsx from 'clsx';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot, KnouxRunResult } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../types';
import ExecutionConfirmDialog from '../ExecutionConfirmDialog';
import KnouxAiContextButton from '../KnouxAiContextButton';
import RuntimeVisualizer from './RuntimeVisualizer';

export interface RunMeta {
  startedAt: number | null;
  finishedAt: number | null;
  mode: ExecutionMode | null;
  result: KnouxRunResult | null;
}

interface CommandCenterProps {
  family: FamilyDefinition;
  familyTools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatuses: Record<string, ToolStatus>;
  activeService: ServiceDefinition;
  onSelectService: (id: ServiceId) => void;
  selectedTool: BridgeTool | null;
  onSelectTool: (id: string | null) => void;
  runningTool: BridgeTool | null;
  lastRunToolId: string | null;
  runMeta: Record<string, RunMeta>;
  consoleEntries: ConsoleEntry[];
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  onCancelTool: () => void;
  onRetryBridge: () => void;
  systemSnapshot: SystemSnapshot | null;
}

type DockTab = 'overview' | 'findings' | 'timeline' | 'safety' | 'logs' | 'result';
type PendingExecution = { toolId: string; mode: ExecutionMode };

function serviceIcon(name: string): React.ElementType {
  return (LucideIcons as unknown as Record<string, React.ElementType>)[name] ?? LucideIcons.Wrench;
}

function pillFor(toolId: string, selectedId: string | null, runningId: string | null, statuses: Record<string, ToolStatus>): { key: string; label: string; cls: string } {
  if (runningId === toolId) return { key: 'running', label: 'RUNNING', cls: 'is-running' };
  const st = statuses[toolId] ?? 'idle';
  if (st === 'success') return { key: 'success', label: 'SUCCESS', cls: 'is-success' };
  if (st === 'error') return { key: 'error', label: 'FAILED', cls: 'is-error' };
  if (st === 'cancelled') return { key: 'cancelled', label: 'CANCELLED', cls: 'is-cancelled' };
  if (st === 'inconclusive') return { key: 'inc', label: 'INCONCLUSIVE', cls: '' };
  if (selectedId === toolId) return { key: 'sel', label: 'SELECTED', cls: 'is-selected' };
  return { key: 'ready', label: 'READY', cls: '' };
}

function fmtDur(ms: number | null): string {
  if (ms === null || ms === undefined || Number.isNaN(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function CommandCenter(props: CommandCenterProps) {
  const {
    family, familyTools, lang, bridgeOnline, bridgeElevated, toolStatuses,
    activeService, onSelectService, selectedTool, onSelectTool,
    runningTool, lastRunToolId, runMeta, consoleEntries,
    onRunTool, onCancelTool, onRetryBridge, systemSnapshot,
  } = props;
  const isRtl = lang === 'ar';
  const [dockTab, setDockTab] = useState<DockTab>('overview');
  const [pending, setPending] = useState<PendingExecution | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const runningId = runningTool?.ToolId ?? null;
  const selectedId = selectedTool?.ToolId ?? null;

  const serviceTools = useMemo(
    () => familyTools.filter(t => t.Category === activeService.id),
    [familyTools, activeService.id]
  );

  // Last finished tool that produced a result (for honest result ownership).
  const lastFinishedTool = useMemo(() => {
    let best: BridgeTool | null = null;
    let bestTs = -1;
    for (const t of familyTools) {
      const m = runMeta[t.ToolId];
      if (m?.finishedAt && m.finishedAt > bestTs) { best = t; bestTs = m.finishedAt; }
    }
    return best;
  }, [familyTools, runMeta]);

  // Focus precedence: running > selected > last finished > none.
  const focusedTool = runningTool ?? selectedTool ?? lastFinishedTool ?? null;
  const focusedStatus: ToolStatus = focusedTool ? (toolStatuses[focusedTool.ToolId] ?? 'idle') : 'idle';
  const focusIsLive = Boolean(runningTool && focusedTool && runningTool.ToolId === focusedTool.ToolId);
  const focusIsResult = !runningTool && focusedTool && (toolStatuses[focusedTool.ToolId] === 'success' || toolStatuses[focusedTool.ToolId] === 'error' || toolStatuses[focusedTool.ToolId] === 'cancelled' || toolStatuses[focusedTool.ToolId] === 'inconclusive');

  // Lines belong to the focused tool ONLY when it owns the current console buffer.
  const ownsBuffer = focusedTool !== null && focusedTool.ToolId === (runningId ?? lastRunToolId);
  const focusLines = ownsBuffer ? consoleEntries : [];
  const focusMeta: RunMeta | null = focusedTool ? (runMeta[focusedTool.ToolId] ?? null) : null;
  const focusResult = focusMeta?.result ?? null;

  // Live ticking clock — only while a run is actually active.
  useEffect(() => {
    if (!runningId) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [runningId]);

  const elapsedSec = useMemo(() => {
    if (!focusMeta?.startedAt) return null;
    const end = focusIsLive ? now : (focusMeta.finishedAt ?? now);
    return Math.max(0, (end - focusMeta.startedAt) / 1000);
  }, [focusMeta, focusIsLive, now]);

  useEffect(() => { setPending(null); }, [selectedId]);

  const requestExecution = (tool: BridgeTool, mode: ExecutionMode) => {
    if (!tool || bridgeOnline === false) return;
    if (tool.RequiresConfirmation) { setPending({ toolId: tool.ToolId, mode }); return; }
    onRunTool(tool, mode);
  };

  const pendingTool = pending && focusedTool && pending.toolId === focusedTool.ToolId ? focusedTool : null;

  const exportReport = () => {
    if (!focusedTool) return;
    const svc = family.services.find(s => s.id === focusedTool.Category);
    const text = [
      'KNOUX Repair — Technical Execution Report',
      `Tool ID: ${focusedTool.ToolId}`,
      `Name: ${focusedTool.EnglishName} (${focusedTool.ArabicName})`,
      `Family: ${family.name.en}`,
      `Service: ${svc ? svc.name.en : focusedTool.Category}`,
      `Mode: ${focusMeta?.mode ?? '—'}`,
      `Status: ${focusedStatus}`,
      `Started: ${focusMeta?.startedAt ? new Date(focusMeta.startedAt).toISOString() : '—'}`,
      `Finished: ${focusMeta?.finishedAt ? new Date(focusMeta.finishedAt).toISOString() : '—'}`,
      `Risk Level: ${focusedTool.RiskLevel}`,
      `Requires Admin: ${focusedTool.RequiresAdmin ? 'Yes' : 'No'}`,
      '',
      '--- Purpose ---',
      focusedTool.Purpose,
      '',
      `--- Runtime Console Output (${focusLines.length} lines) ---`,
      ...focusLines.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`),
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KNOUX_Report_${focusedTool.ToolId}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const findings = focusLines.filter(l => l.type === 'error' || l.type === 'warning');
  const needsAdmin = focusedTool ? focusedTool.RequiresAdmin && !bridgeElevated : false;

  // Canonical lifecycle hooks (preserved across the cockpit migration so
  // existing runtime evidence keeps addressing selected vs running ownership).
  // Execution truth is independent of focus: running tool wins, otherwise the
  // last finished tool's terminal state persists even while another tool is
  // selected for inspection.
  const executionId = runningId ?? lastFinishedTool?.ToolId ?? null;
  const executionPhase: ToolStatus | 'empty' = runningId
    ? 'running'
    : lastFinishedTool
      ? (toolStatuses[lastFinishedTool.ToolId] ?? 'idle')
      : (focusedTool ? focusedStatus : 'empty');

  const tabs: { id: DockTab; en: string; ar: string; badge?: number }[] = [
    { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
    { id: 'findings', en: 'Findings', ar: 'النتائج', badge: findings.length || undefined },
    { id: 'timeline', en: 'Timeline', ar: 'الخط الزمني' },
    { id: 'safety', en: 'Safety', ar: 'الأمان' },
    { id: 'logs', en: 'Technical Log', ar: 'السجل', badge: focusLines.length || undefined },
    { id: 'result', en: 'Result', ar: 'النتيجة' },
  ];

  return (
    <div className="knoux-cc" dir={isRtl ? 'rtl' : 'ltr'} data-family={family.id}>
      {/* ── LEFT: services ── */}
      <aside className="cc-rail cc-services" aria-label={isRtl ? 'خدمات العائلة' : 'Family services'}>
        <div className="cc-rail-head">
          <div className="cc-rail-kicker">{isRtl ? 'الخدمات' : 'SERVICES'}</div>
          <div className="cc-rail-title">{isRtl ? family.name.ar : family.name.en}</div>
        </div>
        <div className="cc-rail-scroll" role="listbox" aria-label={isRtl ? 'اختر الخدمة' : 'Select service'}>
          {family.services.map(svc => {
            const Icon = serviceIcon(svc.icon);
            const count = familyTools.filter(t => t.Category === svc.id).length;
            const hasRunning = runningTool?.Category === svc.id;
            return (
              <button
                key={svc.id}
                type="button"
                role="option"
                aria-selected={activeService.id === svc.id}
                className="cc-service"
                data-active={activeService.id === svc.id}
                onClick={() => onSelectService(svc.id)}
                title={isRtl ? svc.purpose.ar : svc.purpose.en}
              >
                <span className="cc-service-icon"><Icon size={16} /></span>
                <span className="cc-service-body">
                  <span className="cc-service-name">{isRtl ? svc.name.ar : svc.name.en}</span>
                  <span className="cc-service-meta">
                    <span className={clsx('cc-dot', hasRunning && 'is-run', !hasRunning && activeService.id === svc.id && 'is-live')} />
                    {count} {isRtl ? 'أداة' : 'tools'}{hasRunning ? (isRtl ? ' · يعمل' : ' · live') : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── CENTER: live workspace (never unmounts) ── */}
      <section
        className="cc-live knoux-workspace-stage"
        data-mode={focusedTool ? 'tool' : 'empty'}
        data-execution={executionPhase}
        data-selected-tool-id={selectedId ?? ''}
        data-execution-tool-id={executionId ?? ''}
        aria-label={isRtl ? 'مساحة التنفيذ الحية' : 'Live execution workspace'}
      >
        <header className="cc-live-head">
          <span className="cc-live-kicker">
            <span className={clsx('cc-dot', focusIsLive ? 'is-run' : bridgeOnline === true ? 'is-live' : bridgeOnline === false ? 'is-err' : 'is-warn')} />
            {isRtl ? 'مساحة حية' : 'LIVE'}
          </span>
          <span className="cc-live-title">{isRtl ? family.name.ar : family.name.en}</span>
          <span className="cc-live-sub">/ {isRtl ? activeService.name.ar : activeService.name.en}</span>
          {focusedTool && (
            <>
              <span className="cc-live-sub">/ <b style={{ color: '#a5f3fc' }}>{focusedTool.ToolId}</b> {isRtl ? focusedTool.ArabicName : focusedTool.EnglishName}</span>
            </>
          )}
          <span className="cc-live-state">
            {focusIsLive
              ? <span className="cc-pill is-running"><Radio size={10} /> {isRtl ? 'قيد التنفيذ' : 'RUNNING'}</span>
              : focusedTool
                ? <span className={clsx('cc-pill', focusedStatus === 'success' && 'is-success', focusedStatus === 'error' && 'is-error', focusedStatus === 'cancelled' && 'is-cancelled', (focusedStatus === 'idle') && 'is-selected')}>{focusedStatus.toUpperCase()}</span>
                : <span className="cc-pill">{isRtl ? 'استعداد' : 'STANDBY'}</span>}
          </span>
          <KnouxAiContextButton
            lang={lang}
            familyId={family.id}
            familyName={isRtl ? family.name.ar : family.name.en}
            serviceId={activeService.id}
            serviceName={isRtl ? activeService.name.ar : activeService.name.en}
            toolId={focusedTool?.ToolId ?? null}
            toolName={focusedTool ? (isRtl ? focusedTool.ArabicName : focusedTool.EnglishName) : null}
          />
        </header>

        {pending && (
          <div style={{ padding: '6px 14px 0', fontSize: 11, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={12} /> {isRtl ? 'بانتظار التأكيد — لن يبدأ التنفيذ قبل الموافقة الصريحة.' : 'WAITING FOR CONFIRMATION — execution will not start before explicit approval.'}
          </div>
        )}
        {runningTool && !focusIsLive && (
          <div style={{ padding: '6px 14px 0', fontSize: 11, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={12} /> {isRtl ? `التنفيذ الحي مثبّت على ${runningTool.ToolId} — الإلغاء يستهدفه دائمًا.` : `Live execution pinned to ${runningTool.ToolId} — cancel always targets it.`}
          </div>
        )}

        <div className="cc-viz">
          <div className="cc-viz-grid" aria-hidden="true" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${focusedTool?.ToolId ?? 'none'}-${focusIsLive ? 'live' : focusedStatus}`}
              style={{ display: 'contents' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {focusIsResult && focusResult ? (
                <ResultView result={focusResult} tool={focusedTool!} lang={lang} elapsedMs={focusMeta?.finishedAt && focusMeta?.startedAt ? focusMeta.finishedAt - focusMeta.startedAt : null} onReview={() => setDockTab('logs')} onExport={exportReport} onRunAgain={() => requestExecution(focusedTool!, 'run')} />
              ) : (
                <RuntimeVisualizer
                  serviceId={focusedTool ? (focusedTool.Category as ServiceId) : activeService.id}
                  tool={focusedTool}
                  status={focusedTool ? focusedStatus : 'idle'}
                  lines={focusLines}
                  elapsedSec={elapsedSec}
                  snapshot={systemSnapshot}
                  bridgeOnline={bridgeOnline}
                  result={null}
                  lang={lang}
                  standbyTitle={isRtl ? activeService.name.ar : activeService.name.en}
                  standbyPurpose={isRtl ? activeService.purpose.ar : activeService.purpose.en}
                  standbyServiceTools={serviceTools.length}
                  standbyFamilyTools={familyTools.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="cc-info-strip">
          <span>{isRtl ? 'الجسر' : 'Bridge'} <b className={bridgeOnline === true ? 'ok' : bridgeOnline === false ? 'bad' : 'warn'}>{bridgeOnline === true ? (isRtl ? 'متصل' : 'ONLINE') : bridgeOnline === false ? (isRtl ? 'مفصول' : 'OFFLINE') : '…'}</b></span>
          {bridgeElevated && <span className="warn">{isRtl ? 'مسؤول' : 'ADMIN'}</span>}
          {focusedTool && <span>Mode <b>{focusMeta?.mode ?? '—'}</b></span>}
          {elapsedSec !== null && <span>{isRtl ? 'المنقضي' : 'Elapsed'} <b><Clock size={10} style={{ display: 'inline', verticalAlign: -1 }} /> {fmtDur(elapsedSec * 1000)}</b></span>}
          <span>{isRtl ? 'الأحداث' : 'Events'} <b>{focusLines.length}</b></span>
          {findings.length > 0 && <span className="bad">{isRtl ? 'تنبيهات' : 'Flags'} <b>{findings.length}</b></span>}
        </div>

        <div className="cc-actions">
          {bridgeOnline === false ? (
            <>
              <span style={{ fontSize: 11, color: '#fda4af' }}>{isRtl ? 'وقت التشغيل غير متاح — الجسر مفصول.' : 'Runtime unavailable — bridge offline.'}</span>
              <button type="button" className="cc-btn" onClick={onRetryBridge}><RotateCcw size={13} /> {isRtl ? 'إعادة المحاولة' : 'Retry Connection'}</button>
            </>
          ) : !focusedTool ? (
            <span style={{ fontSize: 11, color: '#64748b' }}>{isRtl ? 'اختر أداة من السكة اليمنى — لن يبدأ أي تنفيذ بمجرد الاختيار.' : 'Select a tool from the right rail — selection alone never starts execution.'}</span>
          ) : focusIsLive ? (
            <button type="button" className="cc-btn cc-btn-danger" onClick={onCancelTool}><X size={13} /> {isRtl ? `إلغاء ${runningId}` : `Cancel ${runningId}`}</button>
          ) : (
            <>
              {focusedTool.AnalyzeOnlySupported && (
                <button type="button" className="cc-btn" disabled={needsAdmin} onClick={() => requestExecution(focusedTool, 'analyze')}><Search size={13} /> {isRtl ? 'تحليل' : 'Analyze'}</button>
              )}
              {focusedTool.WhatIfSupported && (
                <button type="button" className="cc-btn" disabled={needsAdmin} onClick={() => requestExecution(focusedTool, 'preview')}><Eye size={13} /> {isRtl ? 'معاينة' : 'Preview'}</button>
              )}
              <span style={{ flex: 1 }} />
              <button type="button" className="cc-btn cc-btn-primary" disabled={needsAdmin} onClick={() => requestExecution(focusedTool, 'run')} title={needsAdmin ? (isRtl ? 'يتطلب صلاحيات المسؤول' : 'Requires administrator privileges') : ''}><Play size={13} /> {isRtl ? 'تشغيل' : 'Run'}</button>
            </>
          )}
          {needsAdmin && focusedTool && !focusIsLive && (
            <span style={{ fontSize: 10.5, color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Shield size={12} /> {isRtl ? 'تتطلب مسؤولًا.' : 'Requires elevation.'}</span>
          )}
        </div>
      </section>

      {/* ── RIGHT: tools ── */}
      <aside className="cc-rail cc-tools" aria-label={isRtl ? 'أدوات الخدمة' : 'Service tools'}>
        <div className="cc-rail-head">
          <div className="cc-rail-kicker">{isRtl ? 'الأدوات' : 'TOOLS'}</div>
          <div className="cc-rail-title">{isRtl ? activeService.name.ar : activeService.name.en} · {serviceTools.length}</div>
        </div>
        {runningTool && (
          <div
            className="cc-active-exec knoux-command-execution-bar"
            data-status="running"
            data-tool-id={runningTool.ToolId}
            role="status"
          >
            <span className="cc-dot is-run" style={{ display: 'inline-block', marginInlineEnd: 6 }} />
            <b>{isRtl ? 'تنفيذ نشط' : 'ACTIVE EXECUTION'}</b>
            <div style={{ color: '#e2e8f0', marginTop: 2 }}>{runningTool.ToolId} · {isRtl ? runningTool.ArabicName : runningTool.EnglishName}</div>
            {selectedId !== runningId && (
              <button type="button" className="cc-btn" style={{ marginTop: 6, padding: '4px 10px', fontSize: 10.5 }} onClick={() => onSelectTool(runningId)}>
                {isRtl ? 'عرض التنفيذ الحي' : 'View live execution'}
              </button>
            )}
          </div>
        )}
        {!runningTool && lastFinishedTool && lastFinishedTool.ToolId !== selectedId && (
          <div
            className="cc-active-exec knoux-command-execution-bar"
            data-status={toolStatuses[lastFinishedTool.ToolId] ?? 'idle'}
            data-tool-id={lastFinishedTool.ToolId}
            role="status"
            style={{ borderColor: 'rgba(148,163,184,0.3)', background: 'linear-gradient(180deg, rgba(148,163,184,0.08), rgba(148,163,184,0.02))' }}
          >
            <span className={clsx('cc-dot', (toolStatuses[lastFinishedTool.ToolId] === 'success' || toolStatuses[lastFinishedTool.ToolId] === 'inconclusive') && 'is-live', toolStatuses[lastFinishedTool.ToolId] === 'error' && 'is-err')} style={{ display: 'inline-block', marginInlineEnd: 6 }} />
            <b style={{ color: '#cbd5e1' }}>{isRtl ? 'آخر نتيجة' : 'LAST RESULT'}</b>
            <div style={{ color: '#e2e8f0', marginTop: 2 }}>{lastFinishedTool.ToolId} · {(toolStatuses[lastFinishedTool.ToolId] ?? 'idle').toUpperCase()}</div>
            <button type="button" className="cc-btn" style={{ marginTop: 6, padding: '4px 10px', fontSize: 10.5 }} onClick={() => onSelectTool(lastFinishedTool.ToolId)}>
              {isRtl ? 'عرض النتيجة' : 'View result'}
            </button>
          </div>
        )}
        <div className="cc-rail-scroll" role="listbox" aria-label={isRtl ? 'اختر الأداة' : 'Select tool'}>
          {bridgeOnline === false ? (
            <div style={{ padding: 12, fontSize: 11, color: '#fda4af', display: 'flex', gap: 6 }}><WifiOff size={13} /> {isRtl ? 'الجسر مفصول — لا يمكن تحميل عقود الأدوات.' : 'Bridge offline — tool contracts unavailable.'}</div>
          ) : serviceTools.length === 0 ? (
            <div style={{ padding: 12, fontSize: 11, color: '#64748b' }}>{bridgeOnline === null ? (isRtl ? 'جارٍ تحميل عقود الأدوات…' : 'Loading tool contracts…') : (isRtl ? 'لا توجد أدوات محمّلة.' : 'No loaded tools.')}</div>
          ) : serviceTools.map(tool => {
            const pill = pillFor(tool.ToolId, selectedId, runningId, toolStatuses);
            const name = isRtl ? tool.ArabicName : tool.EnglishName;
            return (
              <button
                key={tool.ToolId}
                type="button"
                role="option"
                aria-selected={selectedId === tool.ToolId}
                className="cc-tool"
                data-tool-id={tool.ToolId}
                data-tool-status={toolStatuses[tool.ToolId] ?? 'idle'}
                data-selected={selectedId === tool.ToolId}
                data-running={runningId === tool.ToolId}
                onClick={() => onSelectTool(selectedId === tool.ToolId ? null : tool.ToolId)}
                title={tool.Purpose}
              >
                <span className="cc-tool-top">
                  <span className="cc-tool-id">{tool.ToolId}</span>
                  <span className="cc-tool-name">{name}</span>
                </span>
                <span className="cc-tool-purpose">{tool.Purpose}</span>
                <span className="cc-tool-foot" style={{ display: 'flex' }}>
                  <span className={clsx('cc-pill', pill.cls)}>{pill.key === 'running' && <Radio size={9} />} {pill.label}</span>
                  {tool.RequiresAdmin && <span className="cc-admin"><Shield size={10} /> ADMIN</span>}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── BOTTOM: context dock ── */}
      <footer className="cc-context" aria-label={isRtl ? 'السياق' : 'Context'}>
        <div className="cc-context-tabs" role="tablist">
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={dockTab === t.id} className="cc-context-tab" data-on={dockTab === t.id} onClick={() => setDockTab(t.id)}>
              {isRtl ? t.ar : t.en}{t.badge !== undefined && <span className="cc-pill" style={{ fontSize: 8 }}>{t.badge}</span>}
            </button>
          ))}
          <span style={{ marginInlineStart: 'auto', fontFamily: 'monospace', fontSize: 9.5, color: '#475569', paddingInlineEnd: 6 }}>
            {focusedTool ? `${focusedTool.ToolId} · ${focusedStatus.toUpperCase()}` : (isRtl ? 'لا تركيز' : 'NO FOCUS')}
          </span>
        </div>
        <div className="cc-context-body">
          {dockTab === 'overview' && (
            <div className="cc-kv">
              <div><span>{isRtl ? 'العائلة' : 'Family'}</span><b>{isRtl ? family.name.ar : family.name.en}</b></div>
              <div><span>{isRtl ? 'الخدمة' : 'Service'}</span><b>{isRtl ? activeService.name.ar : activeService.name.en}</b></div>
              <div><span>{isRtl ? 'أدوات العائلة' : 'Family tools'}</span><b>{familyTools.length}</b></div>
              <div><span>{isRtl ? 'أدوات الخدمة' : 'Service tools'}</span><b>{serviceTools.length}</b></div>
              <div><span>{isRtl ? 'الأداة المحددة' : 'Selected'}</span><b>{selectedTool ? selectedTool.ToolId : '—'}</b></div>
              <div><span>{isRtl ? 'الأداة الشغالة' : 'Running'}</span><b>{runningTool ? runningTool.ToolId : '—'}</b></div>
              {focusedTool && <div><span>{isRtl ? 'الغرض' : 'Purpose'}</span><b style={{ fontWeight: 400 }}>{focusedTool.Purpose}</b></div>}
            </div>
          )}
          {dockTab === 'findings' && (
            findings.length === 0
              ? <p>{isRtl ? 'لا توجد تنبيهات مسجلة في مخرجات التشغيل الحالية.' : 'No flags recorded in the current execution output.'}</p>
              : <div className="cc-log">{findings.slice(-60).map(l => <div key={l.id} className="err"><span className="ts">[{l.timestamp}]</span>{l.text}</div>)}</div>
          )}
          {dockTab === 'timeline' && (
            !focusedTool || !focusMeta?.startedAt
              ? <p>{isRtl ? 'لا يوجد خط زمني بعد — ابدأ تشغيلًا حقيقيًا.' : 'No timeline yet — start a real run.'}</p>
              : <div className="cc-kv">
                <div><span>{isRtl ? 'الأداة' : 'Tool'}</span><b>{focusedTool.ToolId}</b></div>
                <div><span>{isRtl ? 'الوضع' : 'Mode'}</span><b>{focusMeta.mode ?? '—'}</b></div>
                <div><span>{isRtl ? 'بدأ' : 'Started'}</span><b>{new Date(focusMeta.startedAt).toLocaleTimeString()}</b></div>
                <div><span>{isRtl ? 'انتهى' : 'Finished'}</span><b>{focusMeta.finishedAt ? new Date(focusMeta.finishedAt).toLocaleTimeString() : (isRtl ? 'جارٍ…' : 'running…')}</b></div>
                <div><span>{isRtl ? 'المدة' : 'Duration'}</span><b>{focusMeta.finishedAt ? fmtDur(focusMeta.finishedAt - focusMeta.startedAt) : fmtDur(elapsedSec !== null ? elapsedSec * 1000 : null)}</b></div>
                <div><span>{isRtl ? 'الحالة' : 'Status'}</span><b>{focusedStatus.toUpperCase()}</b></div>
              </div>
          )}
          {dockTab === 'safety' && (
            !focusedTool
              ? <p>{isRtl ? 'اختر أداة لعرض عقد الأمان الخاص بها.' : 'Select a tool to view its safety contract.'}</p>
              : <div>
                <p style={{ marginBottom: 6 }}>
                  {isRtl
                    ? `هذه الأداة جزء من منظومة KNOUX Repair المعتمدة (المعرف: ${focusedTool.ToolId}). تنفذ عبر جسر PowerShell المحلي المحمي دون مخاطر خروج عن النطاق المسموح به.`
                    : `This tool is part of the canonical KNOUX Repair suite (ID: ${focusedTool.ToolId}). It executes via the managed loopback PowerShell bridge within its approved scope.`}
                </p>
                <div className="cc-kv">
                <div><span>{isRtl ? 'المخاطرة' : 'Risk'}</span><b>{focusedTool.RiskLevel}</b></div>
                <div><span>{isRtl ? 'مسؤول' : 'Admin'}</span><b>{focusedTool.RequiresAdmin ? (bridgeElevated ? (isRtl ? 'مطلوب ومتوفر' : 'required · elevated') : (isRtl ? 'مطلوب وغير متوفر' : 'required · NOT elevated')) : (isRtl ? 'غير مطلوب' : 'not required')}</b></div>
                <div><span>{isRtl ? 'إعادة تشغيل' : 'Restart'}</span><b>{focusedTool.RequiresRestart ? (isRtl ? 'مطلوبة' : 'required') : '—'}</b></div>
                <div><span>{isRtl ? 'تأكيد' : 'Confirmation'}</span><b>{focusedTool.RequiresConfirmation ? (isRtl ? 'مطلوب' : 'required') : '—'}</b></div>
                <div><span>{isRtl ? 'تحليل فقط' : 'Analyze-only'}</span><b>{focusedTool.AnalyzeOnlySupported ? (isRtl ? 'مدعوم' : 'supported') : '—'}</b></div>
                <div><span>{isRtl ? 'معاينة' : 'WhatIf'}</span><b>{focusedTool.WhatIfSupported ? (isRtl ? 'مدعوم' : 'supported') : '—'}</b></div>
                <div><span>{isRtl ? 'دون إنترنت' : 'Offline'}</span><b>{focusedTool.OfflineCapability}</b></div>
                <div><span>{isRtl ? 'النسخ الاحتياطي' : 'Backup'}</span><b style={{ fontWeight: 400 }}>{focusedTool.BackupMethod || '—'}</b></div>
                <div><span>{isRtl ? 'التراجع' : 'Rollback'}</span><b style={{ fontWeight: 400 }}>{focusedTool.RollbackMethod || '—'}</b></div>
                </div>
              </div>
          )}
          {dockTab === 'logs' && (
            focusLines.length === 0
              ? <p>{isRtl ? 'لا توجد مخرجات مسجلة للأداة محل التركيز.' : 'No recorded output for the focused tool.'}</p>
              : <div className="cc-log">{focusLines.slice(-200).map(l => <div key={l.id} className={l.type === 'error' ? 'err' : ''}><span className="ts">[{l.timestamp}]</span>{l.text}</div>)}</div>
          )}
          {dockTab === 'result' && (
            !focusResult
              ? <p>{isRtl ? 'لا توجد نتيجة منظمة بعد — تظهر هنا نتيجة التشغيل الحقيقية فور اكتمالها.' : 'No structured result yet — the real run result appears here on completion.'}</p>
              : <ResultSummary result={focusResult} lang={lang} />
          )}
        </div>
      </footer>

      {pendingTool && pending && (
        <ExecutionConfirmDialog
          tool={pendingTool}
          mode={pending.mode}
          lang={lang}
          onCancel={() => setPending(null)}
          onConfirm={(options, confirmation) => {
            const mode = pending.mode;
            setPending(null);
            onRunTool(pendingTool, mode, options, confirmation);
          }}
        />
      )}
    </div>
  );
}

function ResultView({ result, tool, lang, elapsedMs, onReview, onExport, onRunAgain }: {
  result: KnouxRunResult; tool: BridgeTool; lang: 'en' | 'ar';
  elapsedMs: number | null; onReview: () => void; onExport: () => void; onRunAgain: () => void;
}) {
  const isRtl = lang === 'ar';
  const ok = (result.status || result.Status || '').toLowerCase() === 'success';
  const cells: { label: string; value: string }[] = [];
  const num = (v: number | null | undefined) => (v === null || v === undefined ? null : v.toLocaleString('en-US'));
  const bytes = (v: number | null | undefined) => {
    if (v === null || v === undefined) return null;
    if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`;
    if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MB`;
    return `${Math.round(v / 1024)} KB`;
  };
  const push = (label: string, value: string | null) => { if (value !== null) cells.push({ label, value }); };
  push(isRtl ? 'عناصر مكتشفة' : 'ITEMS FOUND', num(result.itemsFound ?? result.ItemsFound ?? null));
  push(isRtl ? 'عولجت' : 'PROCESSED', num(result.itemsProcessed ?? result.ItemsProcessed ?? null));
  push(isRtl ? 'قابل للاسترداد' : 'RECOVERABLE', bytes(result.bytesPotentiallyRecoverable ?? null));
  push(isRtl ? 'عُزل' : 'QUARANTINED', num(result.quarantinedCount ?? null));
  push(isRtl ? 'محذوف نهائيًا' : 'DELETED', bytes(result.bytesPermanentlyDeleted ?? null));
  push(isRtl ? 'نُقل' : 'MOVED', bytes(result.bytesMoved ?? null));
  push(isRtl ? 'المدة' : 'DURATION', result.durationMs ? fmtDur(result.durationMs) : (elapsedMs !== null ? fmtDur(elapsedMs) : (result.Duration || null)));
  if (result.restartNeeded || result.RestartNeeded) cells.push({ label: isRtl ? 'إعادة تشغيل' : 'RESTART', value: isRtl ? 'مطلوبة' : 'REQUIRED' });
  if (result.reportPath || result.ReportPath) cells.push({ label: isRtl ? 'التقرير' : 'REPORT', value: String(result.reportPath ?? result.ReportPath).split(/[\\/]/).pop() ?? '' });
  if (result.errorMessage || result.ErrorMessage) cells.push({ label: isRtl ? 'الخطأ' : 'ERROR', value: String(result.errorMessage ?? result.ErrorMessage) });

  return (
    <div className="cc-viz-body" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="cc-viz-main cc-result">
        <div className="cc-result-head">
          <CircleDot size={16} style={{ color: ok ? '#6ee7b7' : '#fda4af' }} />
          <span className="cc-result-title">{tool.ToolId} · {isRtl ? tool.ArabicName : tool.EnglishName} — {ok ? (isRtl ? 'مكتمل' : 'COMPLETED') : (result.status || result.Status || (isRtl ? 'انتهى' : 'FINISHED')).toString().toUpperCase()}</span>
        </div>
        {cells.length === 0
          ? <p style={{ fontSize: 11, color: '#64748b' }}>{isRtl ? 'اكتمل التشغيل دون مقاييس منظمة — راجع السجل التقني.' : 'Run finished with no structured metrics — see Technical Log.'}</p>
          : <div className="cc-result-grid">{cells.map(c => <div key={c.label} className="cc-result-cell"><label>{c.label}</label><b>{c.value}</b></div>)}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button type="button" className="cc-btn" onClick={onReview}><ScrollText size={13} /> {isRtl ? 'مراجعة' : 'Review'}</button>
          <button type="button" className="cc-btn" onClick={onExport}><Download size={13} /> {isRtl ? 'تصدير' : 'Export'}</button>
          <button type="button" className="cc-btn cc-btn-primary" onClick={onRunAgain}><RotateCcw size={13} /> {isRtl ? 'تشغيل مجددًا' : 'Run Again'}</button>
        </div>
      </div>
      <div className="cc-viz-side">
        <div className="cc-event-stream" role="log">
          <div className="cc-stream-empty">
            <Flag size={18} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
            {isRtl ? 'النتيجة مملوكة لهذه الأداة ولن تُنسب لغيرها.' : 'This result is owned by this tool and will not be relabeled.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultSummary({ result, lang }: { result: KnouxRunResult; lang: 'en' | 'ar' }) {
  const isRtl = lang === 'ar';
  const rows: [string, string][] = [];
  const s = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
  const pairs: [string, unknown][] = [
    [isRtl ? 'الحالة' : 'Status', result.status ?? result.Status],
    [isRtl ? 'الوضع' : 'Mode', result.mode ?? null],
    [isRtl ? 'المدة' : 'Duration', result.durationMs ? fmtDur(result.durationMs) : result.Duration],
    [isRtl ? 'مكتشفة/معالجة' : 'Found/Processed', result.itemsFound ?? result.ItemsFound ?? null],
    [isRtl ? 'رمز الخروج' : 'Exit code', result.exitCode ?? result.ExitCode ?? null],
    [isRtl ? 'التقرير' : 'Report', result.reportPath ?? result.ReportPath],
    [isRtl ? 'الخطأ' : 'Error', result.errorMessage ?? result.ErrorMessage],
  ];
  for (const [k, v] of pairs) { const sv = s(v); if (sv !== null) rows.push([k, sv]); }
  if (rows.length === 0) return <p>{isRtl ? 'لا توجد حقول منظمة.' : 'No structured fields.'}</p>;
  return <div className="cc-kv">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b style={{ fontWeight: 400 }}>{v}</b></div>)}</div>;
}

