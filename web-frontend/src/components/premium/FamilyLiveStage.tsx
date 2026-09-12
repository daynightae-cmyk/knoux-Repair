import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Activity, Braces, CircleStop, Radio, TerminalSquare } from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition } from '../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../types';
import ExecutionConfirmDialog from '../ExecutionConfirmDialog';
import ToolWorkspace from './ToolWorkspace';

interface FamilyLiveStageProps {
  family: FamilyDefinition;
  service: ServiceDefinition;
  selectedTool: BridgeTool | null;
  executionTool: BridgeTool | null;
  serviceToolCount: number;
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatuses: Record<string, ToolStatus>;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  onCancelTool: () => void;
  onClearTool: () => void;
  consoleEntries?: ConsoleEntry[];
  activeToolId?: string | null;
}

type PendingExecution = {
  toolId: string;
  mode: ExecutionMode;
};

const STATUS_TEXT: Record<ToolStatus, { en: string; ar: string }> = {
  idle: { en: 'Ready', ar: 'جاهز' },
  running: { en: 'Running', ar: 'قيد التشغيل' },
  success: { en: 'Completed', ar: 'مكتمل' },
  error: { en: 'Failed', ar: 'فشل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  inconclusive: { en: 'Inconclusive', ar: 'غير حاسم' },
};

export default function FamilyLiveStage({
  family,
  service,
  selectedTool,
  executionTool,
  serviceToolCount,
  lang,
  bridgeOnline,
  bridgeElevated,
  toolStatuses,
  onRunTool,
  onCancelTool,
  onClearTool,
  consoleEntries,
  activeToolId,
}: FamilyLiveStageProps) {
  const [pendingExecution, setPendingExecution] = useState<PendingExecution | null>(null);
  const isRtl = lang === 'ar';
  const ServiceIcon = (LucideIcons as unknown as Record<string, React.ElementType>)[service.icon] ?? LucideIcons.Wrench;
  const bridgeLabel = bridgeOnline === true
    ? (isRtl ? 'الجسر متصل' : 'Bridge online')
    : bridgeOnline === false
      ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline')
      : (isRtl ? 'جارٍ فحص الجسر' : 'Checking bridge');

  const executionStatus: ToolStatus = executionTool
    ? toolStatuses[executionTool.ToolId] ?? 'idle'
    : 'idle';
  const executionRunning = Boolean(executionTool && executionStatus === 'running');
  const selectionDiffersFromExecution = Boolean(
    selectedTool && executionTool && selectedTool.ToolId !== executionTool.ToolId
  );

  useEffect(() => {
    setPendingExecution(null);
  }, [selectedTool?.ToolId]);

  const requestExecution = (mode: ExecutionMode) => {
    if (!selectedTool) return;
    if (selectedTool.RequiresConfirmation) {
      setPendingExecution({ toolId: selectedTool.ToolId, mode });
      return;
    }
    onRunTool(selectedTool, mode);
  };

  const pendingTool = selectedTool && pendingExecution?.toolId === selectedTool.ToolId
    ? selectedTool
    : null;

  return (
    <section
      id="family-tool-workspace"
      className="knoux-workspace-stage knoux-command-workspace"
      data-mode={selectedTool ? 'tool' : 'empty'}
      data-execution={executionStatus}
      aria-label={isRtl ? 'مساحة عمل الأداة' : 'Tool workspace'}
    >
      <div className="knoux-stage-grid" aria-hidden="true" />
      <div className="knoux-stage-scanline" aria-hidden="true" />

      <header className="knoux-stage-header">
        <div className="knoux-stage-kicker">
          <Activity size={13} />
          <span>{isRtl ? 'مساحة التنفيذ' : 'LIVE EXECUTION WORKSPACE'}</span>
        </div>
        <div className="knoux-stage-context">
          <span>{isRtl ? family.name.ar : family.name.en}</span>
          <span className="knoux-stage-separator">/</span>
          <strong>{selectedTool ? (isRtl ? selectedTool.ArabicName : selectedTool.EnglishName) : (isRtl ? service.name.ar : service.name.en)}</strong>
        </div>
        <div className="knoux-stage-runtime">
          <span className={bridgeOnline === true ? 'is-online' : bridgeOnline === false ? 'is-offline' : 'is-pending'} />
          {bridgeLabel}
        </div>
      </header>

      {executionTool && (
        <div className="knoux-command-execution-bar" data-status={executionStatus} role="status">
          <div className="knoux-command-execution-led"><Radio size={14} /></div>
          <div className="knoux-command-execution-copy">
            <span>{executionRunning ? (isRtl ? 'تنفيذ نشط' : 'ACTIVE EXECUTION') : (isRtl ? 'آخر نتيجة تنفيذ' : 'LAST EXECUTION')}</span>
            <strong>{executionTool.ToolId} · {isRtl ? executionTool.ArabicName : executionTool.EnglishName}</strong>
            {selectionDiffersFromExecution && (
              <small>{isRtl ? 'الأداة المحددة مختلفة؛ حالة التنفيذ تظل مرتبطة بالأداة الأصلية.' : 'Selected tool differs; runtime ownership remains attached to the execution tool.'}</small>
            )}
          </div>
          <b>{isRtl ? STATUS_TEXT[executionStatus].ar : STATUS_TEXT[executionStatus].en}</b>
          {executionRunning && (
            <button type="button" onClick={onCancelTool} className="knoux-command-cancel-run">
              <CircleStop size={14} />
              {isRtl ? 'إلغاء التنفيذ' : 'Cancel run'}
            </button>
          )}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {selectedTool ? (
          <motion.div
            key={selectedTool.ToolId}
            className="knoux-stage-tool"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <ToolWorkspace
              tool={selectedTool}
              family={family}
              service={service}
              lang={lang}
              bridgeElevated={bridgeElevated}
              toolStatus={toolStatuses[selectedTool.ToolId] ?? 'idle'}
              onRun={requestExecution}
              onCancel={onCancelTool}
              consoleEntries={consoleEntries}
              activeToolId={activeToolId}
              onBack={() => {
                setPendingExecution(null);
                onClearTool();
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key={service.id}
            className="knoux-workspace-empty knoux-command-workspace-empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <div className="knoux-workspace-empty-icon"><ServiceIcon size={28} /></div>
            <div>
              <span>{isRtl ? 'مساحة العمل جاهزة للسياق' : 'CONTEXT-READY ACTION AREA'}</span>
              <h3>{isRtl ? service.name.ar : service.name.en}</h3>
              <p>
                {bridgeOnline === false
                  ? (isRtl ? 'اتصل بالجسر أولاً لتحميل عقود الأدوات وتشغيلها.' : 'Connect the bridge to load and execute the registered tool contracts.')
                  : serviceToolCount > 0
                    ? (isRtl ? 'اختر أداة من الشريط الجانبي لفتح عناصر التحكم الحقيقية هنا.' : 'Choose a tool from the tool rail to open its real controls here.')
                    : (isRtl ? 'لا توجد عقود أدوات محمّلة لهذه الخدمة حالياً.' : 'No tool contracts are loaded for this service yet.')}
              </p>
            </div>
            <div className="knoux-command-empty-hint">
              <Braces size={15} />
              <TerminalSquare size={15} />
              <span>{isRtl ? 'الأدوات على جانب مساحة العمل' : 'Tools remain available beside the workspace'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {pendingTool && pendingExecution && (
        <ExecutionConfirmDialog
          tool={pendingTool}
          mode={pendingExecution.mode}
          lang={lang}
          onCancel={() => setPendingExecution(null)}
          onConfirm={(options, confirmation) => {
            const mode = pendingExecution.mode;
            setPendingExecution(null);
            onRunTool(pendingTool, mode, options, confirmation);
          }}
        />
      )}
    </section>
  );
}
