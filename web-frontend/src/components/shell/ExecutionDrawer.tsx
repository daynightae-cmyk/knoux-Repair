import { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, Copy, RotateCw, Ban,
} from 'lucide-react';
import type { BridgeTool, ExecutionMode } from '../../lib/api';
import type { ConsoleEntry } from '../../types';
import type { ShellActivity } from '../../lib/shellActivity';
import StatusIndicator from './StatusIndicator';
import type { StatusTone } from './StatusIndicator';

export type DrawerStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled' | 'inconclusive';

export interface ExecutionDrawerProps {
  lang: 'en' | 'ar';
  tool: BridgeTool | null;
  mode: ExecutionMode;
  status: DrawerStatus;
  entries: ConsoleEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCancel: () => void;
  onRetry: () => void;
  /** True when a retry would replay exactly the same request. */
  retryable: boolean;
  /**
   * A guided, multi-step activity that is not a single tool run — AI Scan's
   * evidence sweep, for example. It is reported into the same dock so the
   * product has one place where work is visible.
   */
  activity?: ShellActivity | null;
}

type StageId = 'select' | 'preview' | 'confirm' | 'execute' | 'verify' | 'report';
type StageState = 'idle' | 'active' | 'done' | 'failed';

const STAGES: { id: StageId; en: string; ar: string }[] = [
  { id: 'select', en: 'Select', ar: 'تحديد' },
  { id: 'preview', en: 'Preview', ar: 'معاينة' },
  { id: 'confirm', en: 'Confirm', ar: 'تأكيد' },
  { id: 'execute', en: 'Execute', ar: 'تنفيذ' },
  { id: 'verify', en: 'Verify', ar: 'تحقق' },
  { id: 'report', en: 'Report', ar: 'تقرير' },
];

const STATUS_TONE: Record<DrawerStatus, StatusTone> = {
  idle: 'neutral',
  running: 'data',
  success: 'positive',
  error: 'danger',
  cancelled: 'caution',
  inconclusive: 'caution',
};

const STATUS_LABEL: Record<DrawerStatus, { en: string; ar: string }> = {
  idle: { en: 'Idle', ar: 'خامل' },
  running: { en: 'Running', ar: 'قيد التنفيذ' },
  success: { en: 'Verified', ar: 'موثّق' },
  error: { en: 'Failed', ar: 'فشل' },
  cancelled: { en: 'Cancelled', ar: 'أُلغي' },
  inconclusive: { en: 'Inconclusive', ar: 'غير حاسم' },
};

/**
 * Detects a report artefact in the real run output.
 *
 * The shell does not receive the structured result envelope, so the only
 * honest way to know that a report was written is to look for it in the
 * output the bridge actually streamed. Nothing is inferred.
 */
function detectReportPath(entries: ConsoleEntry[]): string | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const text = entries[index]?.text ?? '';
    const match = text.match(/([A-Za-z]:\\[^\s"']+\.(?:md|json|html|csv))/);
    if (match) return match[1];
    if (/report|evidence|نتائج|تقرير/i.test(text) && /written|saved|created|wrote/i.test(text)) {
      return text.trim();
    }
  }
  return null;
}

/**
 * The global execution dock.
 *
 * One place for the whole SELECT → PREVIEW → CONFIRM → EXECUTE → VERIFY →
 * REPORT chain, for every studio. The stage strip reflects the real
 * execution mode and the real run status; a stage the shell cannot observe
 * stays neutral instead of being drawn as complete.
 */
export default function ExecutionDrawer({
  lang,
  tool,
  mode,
  status,
  entries,
  collapsed,
  onToggleCollapse,
  onCancel,
  onRetry,
  retryable,
  activity = null,
}: ExecutionDrawerProps) {
  const [copied, setCopied] = useState(false);

  const reportPath = useMemo(() => detectReportPath(entries), [entries]);

  const stageStates = useMemo<Record<StageId, StageState>>(() => {
    const states: Record<StageId, StageState> = {
      select: tool ? 'done' : 'idle',
      preview: 'idle',
      confirm: 'idle',
      execute: 'idle',
      verify: 'idle',
      report: 'idle',
    };

    if (!tool) return states;

    if (mode === 'analyze' || mode === 'preview') {
      states.preview = status === 'running' ? 'active' : status === 'success' ? 'done' : status === 'idle' ? 'idle' : 'failed';
      if (status === 'success') states.report = reportPath ? 'done' : 'idle';
      return states;
    }

    states.confirm = tool.RequiresConfirmation ? 'done' : 'idle';
    if (status === 'running') states.execute = 'active';
    if (status === 'success') {
      states.execute = 'done';
      states.verify = 'done';
      states.report = reportPath ? 'done' : 'idle';
    }
    if (status === 'error' || status === 'cancelled') {
      states.execute = 'failed';
      states.verify = 'failed';
    }
    if (status === 'inconclusive') {
      states.execute = 'done';
      states.verify = 'failed';
    }
    return states;
  }, [mode, reportPath, status, tool]);

  const isRtl = lang === 'ar';
  const statusLabel = isRtl ? STATUS_LABEL[status].ar : STATUS_LABEL[status].en;
  const toolName = tool ? (isRtl ? tool.ArabicName : tool.EnglishName) : null;

  // A guided activity (AI Scan's evidence sweep) is reported into the same
  // dock, so the product keeps one place where work is visible.
  const activityMode = activity !== null && tool === null;

  const copyLog = useCallback(() => {
    const text = activityMode && activity
      ? activity.lines.map(line => `[${line.timestamp}] ${line.text}`).join('\n')
      : entries.map(entry => `[${entry.timestamp}] ${entry.text}`).join('\n');
    void navigator.clipboard?.writeText(text).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); },
      () => { setCopied(false); },
    );
  }, [activity, activityMode, entries]);

  const activityStatusLabel = activity
    ? (activity.status === 'running'
      ? (isRtl ? 'قيد الفحص' : 'Scanning')
      : activity.status === 'success'
        ? (isRtl ? 'اكتمل' : 'Completed')
        : activity.status === 'error'
          ? (isRtl ? 'فشل' : 'Failed')
          : (isRtl ? 'غير حاسم' : 'Inconclusive'))
    : '';
  const activityTone: StatusTone = activity
    ? (activity.status === 'running' ? 'data' : activity.status === 'success' ? 'positive' : activity.status === 'error' ? 'danger' : 'caution')
    : 'neutral';

  return (
    <section className="knoux-execution-drawer" data-collapsed={collapsed} data-role="execution-drawer" data-status={status}>
      <div className="knoux-execution-drawer-head">
        <div className="knoux-execution-drawer-title">
          <StatusIndicator
            tone={activityMode ? activityTone : STATUS_TONE[status]}
            label={activityMode ? activityStatusLabel : statusLabel}
            pulse={activityMode ? activity?.status === 'running' : status === 'running'}
          />
          <strong>{activityMode ? activity?.title : toolName ?? (isRtl ? 'لا يوجد تشغيل نشط' : 'No active operation')}</strong>
          {!activityMode && tool ? <span>{tool.ToolId} · {mode}</span> : null}
        </div>

        <div className="knoux-execution-stages" role="list" aria-label={isRtl ? 'مراحل التنفيذ' : 'Execution stages'}>
          {activityMode
            ? (activity?.stages ?? []).map(stage => (
                <span key={stage.id} className="knoux-execution-stage" data-state={stage.state} role="listitem">
                  <span className="knoux-execution-stage-dot" aria-hidden="true" />
                  <span>{stage.label}</span>
                </span>
              ))
            : STAGES.map(stage => (
                <span key={stage.id} className="knoux-execution-stage" data-state={stageStates[stage.id]} role="listitem">
                  <span className="knoux-execution-stage-dot" aria-hidden="true" />
                  <span>{isRtl ? stage.ar : stage.en}</span>
                </span>
              ))}
        </div>

        <div className="knoux-execution-drawer-actions">
          {(activityMode ? (activity?.lines.length ?? 0) : entries.length) > 0 ? (
            <button type="button" className="knoux-studio-btn" onClick={copyLog} title={isRtl ? 'نسخ السجل' : 'Copy log'}>
              <Copy size={13} aria-hidden="true" />
              <span>{copied ? (isRtl ? 'تم النسخ' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
            </button>
          ) : null}
          {status === 'running' ? (
            <button type="button" className="knoux-studio-btn" data-variant="danger" onClick={onCancel} title={isRtl ? 'إلغاء' : 'Cancel'}>
              <Ban size={13} aria-hidden="true" />
              <span>{isRtl ? 'إلغاء' : 'Cancel'}</span>
            </button>
          ) : null}
          {retryable && status !== 'running' ? (
            <button type="button" className="knoux-studio-btn" onClick={onRetry} title={isRtl ? 'إعادة المحاولة' : 'Retry'}>
              <RotateCw size={13} aria-hidden="true" />
              <span>{isRtl ? 'إعادة' : 'Retry'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="knoux-studio-btn"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            title={collapsed ? (isRtl ? 'توسيع' : 'Expand') : (isRtl ? 'طي' : 'Collapse')}
          >
            {collapsed ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
            <span>{collapsed ? (isRtl ? 'توسيع' : 'Expand') : (isRtl ? 'طي' : 'Collapse')}</span>
          </button>
        </div>
      </div>

      <div className="knoux-execution-drawer-body">
        <pre className="knoux-execution-log" aria-label={isRtl ? 'سجل التنفيذ' : 'Execution log'}>
          {activityMode
            ? (activity?.lines.length ?? 0) === 0
              ? (isRtl ? 'لا يوجد سجل بعد.' : 'No output yet.')
              : activity!.lines.map(line => (
                  <div key={line.id} data-type={line.type}>
                    <time>{line.timestamp}</time>
                    <span>{line.text}</span>
                  </div>
                ))
            : entries.length === 0
              ? (isRtl ? 'لا يوجد سجل تنفيذ بعد.' : 'No execution output yet.')
              : entries.map(entry => (
                  <div key={entry.id} data-type={entry.type}>
                    <time>{entry.timestamp}</time>
                    <span>{entry.text}</span>
                  </div>
                ))}
        </pre>

        <div className="knoux-execution-detail">
          {activityMode ? (
            <div className="knoux-inspector-section">
              <header>
                <span>{isRtl ? 'النشاط' : 'Activity'}</span>
              </header>
              <dl className="knoux-inspector-facts">
                <dt>{isRtl ? 'العنوان' : 'Title'}</dt>
                <dd>{activity?.title}</dd>
                <dt>{isRtl ? 'المراحل' : 'Stages'}</dt>
                <dd>{activity?.stages.filter(stage => stage.state === 'done').length ?? 0}/{activity?.stages.length ?? 0}</dd>
                <dt>{isRtl ? 'الحالة' : 'Status'}</dt>
                <dd>{activityStatusLabel}</dd>
                <dt>{isRtl ? 'المدة' : 'Elapsed'}</dt>
                <dd>{activity ? `${Math.max(0, Math.round((Date.now() - activity.startedAt) / 1000))}s` : '—'}</dd>
              </dl>
            </div>
          ) : (
          <div className="knoux-inspector-section">
            <header>
              <span>{isRtl ? 'التشغيل' : 'Operation'}</span>
            </header>
            <dl className="knoux-inspector-facts">
              <dt>{isRtl ? 'الأداة' : 'Tool'}</dt>
              <dd>{tool ? tool.ToolId : '—'}</dd>
              <dt>{isRtl ? 'الوضع' : 'Mode'}</dt>
              <dd>{tool ? mode : '—'}</dd>
              <dt>{isRtl ? 'المخاطر' : 'Risk'}</dt>
              <dd>{tool ? tool.RiskLevel : '—'}</dd>
              <dt>{isRtl ? 'صلاحية' : 'Elevation'}</dt>
              <dd>{tool ? (tool.RequiresAdmin ? (isRtl ? 'مطلوب' : 'Required') : (isRtl ? 'غير مطلوب' : 'Not required')) : '—'}</dd>
              <dt>{isRtl ? 'تقرير' : 'Report'}</dt>
              <dd>{reportPath ?? (isRtl ? 'لم يُرصد بعد' : 'Not observed yet')}</dd>
            </dl>
          </div>
          )}

          {status === 'error' || status === 'cancelled' || status === 'inconclusive' ? (
            <div className="knoux-inspector-section">
              <header>
                <span>{isRtl ? 'لم يكتمل' : 'Not completed'}</span>
              </header>
              <div className="knoux-panel-body">
                <p className="knoux-finding-body">
                  {status === 'cancelled'
                    ? (isRtl ? 'أُلغي التشغيل عمدًا. لم يُنفَّذ الإجراء.' : 'The run was cancelled. The operation was not performed.')
                    : status === 'inconclusive'
                      ? (isRtl ? 'انتهى التشغيل دون نتيجة قابلة للتأكيد.' : 'The run finished without a confirmable result.')
                      : (isRtl ? 'فشل التشغيل. راجع السجل.' : 'The run failed. Review the log.')}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
