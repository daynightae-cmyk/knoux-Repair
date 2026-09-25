import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Activity, Braces, CircleStop, Gauge, Radio, ShieldCheck, Terminal, TerminalSquare } from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition } from '../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../types';
import ExecutionConfirmDialog from '../ExecutionConfirmDialog';
import KnouxAiContextButton from '../KnouxAiContextButton';
import ServiceApps from '../ServiceApps';
import ToolWorkspace from './ToolWorkspace';
import KnouxDockWorkspace from '../workspace/KnouxDockWorkspace';

interface FamilyLiveStageProps {
  family: FamilyDefinition;
  service: ServiceDefinition;
  serviceTools: BridgeTool[];
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
  onRetryBridge: () => void;
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
  serviceTools,
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
  onRetryBridge,
  consoleEntries,
  activeToolId,
}: FamilyLiveStageProps) {
  const [pendingExecution, setPendingExecution] = useState<PendingExecution | null>(null);
  const [liveClock, setLiveClock] = useState(() => new Date());
  const [serviceToolStatuses, setServiceToolStatuses] = useState<Record<string, ToolStatus>>({});
  const isRtl = lang === 'ar';
  const ServiceIcon = (LucideIcons as unknown as Record<string, React.ElementType>)[service.icon] ?? LucideIcons.Wrench;
  const bridgeLabel = bridgeOnline === true
    ? (isRtl ? 'الجسر متصل' : 'Bridge online')
    : bridgeOnline === false
      ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline')
      : (isRtl ? 'جارٍ فحص الجسر' : 'Checking bridge');

  const effectiveToolStatuses: Record<string, ToolStatus> = {
    ...toolStatuses,
    ...serviceToolStatuses,
  };

  const executionStatus: ToolStatus = executionTool
    ? effectiveToolStatuses[executionTool.ToolId] ?? 'idle'
    : 'idle';
  const executionRunning = Boolean(executionTool && executionStatus === 'running');
  const serviceAppMode = !selectedTool && !executionRunning;
  const selectionDiffersFromExecution = Boolean(
    selectedTool && executionTool && selectedTool.ToolId !== executionTool.ToolId
  );

  useEffect(() => {
    setPendingExecution(null);
  }, [selectedTool?.ToolId]);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
  const liveStatus = selectedTool ? (effectiveToolStatuses[selectedTool.ToolId] ?? 'idle') : 'idle';
  const activityCount = selectedTool ? consoleEntries?.length ?? 0 : 0;
  const activeSignals = Object.values(effectiveToolStatuses).filter(status => status === 'running').length;
  const statusLabel = bridgeOnline === null
    ? (isRtl ? 'جارٍ فحص بيئة التشغيل' : 'CHECKING RUNTIME')
    : bridgeOnline === false
      ? (isRtl ? 'بيئة التشغيل غير متاحة' : 'RUNTIME UNAVAILABLE')
      : serviceAppMode
        ? (isRtl ? 'الخدمة جاهزة' : 'SERVICE READY')
        : !selectedTool
          ? (isRtl ? 'التنفيذ النشط مستمر' : 'ACTIVE EXECUTION')
          : liveStatus === 'running'
            ? (isRtl ? 'تنفيذ مباشر' : 'LIVE EXECUTION')
            : liveStatus === 'success'
              ? (isRtl ? 'اكتمل بنجاح' : 'COMPLETED')
              : liveStatus === 'error'
                ? (isRtl ? 'يحتاج مراجعة' : 'REVIEW NEEDED')
                : liveStatus === 'cancelled'
                  ? (isRtl ? 'تم الإلغاء' : 'CANCELLED')
                  : liveStatus === 'inconclusive'
                    ? (isRtl ? 'غير حاسم' : 'INCONCLUSIVE')
                    : (isRtl ? 'جاهز' : 'READY');

  const programsDockEnabled = service.id === '04-Programs-Applications' && serviceAppMode;
  const softwareDockEnabled = service.id === '16-Software-Environment' && serviceAppMode;
  const postInstallDockEnabled = service.id === '17-PostInstall-Setup' && serviceAppMode;
  const diagnosticsDockEnabled = service.id === '10-Diagnostics-Reports' && serviceAppMode;
  const performanceDockEnabled = service.id === '08-Performance' && serviceAppMode;
  const securityDockEnabled = service.id === '09-Security' && serviceAppMode;
  const servicesDockEnabled = service.id === '07-Services-Processes' && serviceAppMode;
  const serviceDockEnabled = programsDockEnabled || softwareDockEnabled || postInstallDockEnabled || diagnosticsDockEnabled || performanceDockEnabled || securityDockEnabled || servicesDockEnabled;
  const serviceDockWorkspace = servicesDockEnabled
    ? 'services'
    : securityDockEnabled
      ? 'security'
      : performanceDockEnabled
        ? 'performance'
        : diagnosticsDockEnabled
          ? 'diagnostics'
          : postInstallDockEnabled
            ? 'postinstall'
            : softwareDockEnabled
              ? 'software'
              : 'programs';
  const serviceAppSurface = (
    <ServiceApps
      activeSection={service.legacySection}
      tools={serviceTools}
      toolStatuses={effectiveToolStatuses}
      lang={lang}
      bridgeElevated={bridgeElevated}
      bridgeOnline={bridgeOnline}
      onRetryBridge={onRetryBridge}
      onToolStatus={(toolId, status) => {
        setServiceToolStatuses(prev => ({ ...prev, [toolId]: status }));
      }}
      onRunTool={onRunTool}
      onCancelTool={onCancelTool}
      embedded={serviceDockEnabled}
    />
  );


  return (
    <section
      id="family-tool-workspace"
      className="knoux-workspace-stage knoux-command-workspace"
      data-mode={selectedTool ? 'tool' : serviceAppMode ? 'service' : 'empty'}
      data-execution={executionStatus}
      data-selected-tool-id={selectedTool?.ToolId ?? ''}
      data-execution-tool-id={executionTool?.ToolId ?? ''}
      data-service-tool-count={serviceToolCount}
      aria-label={isRtl ? 'مساحة عمل الخدمة والأداة' : 'Service and tool workspace'}
    >
      <div className="knoux-stage-grid" aria-hidden="true" />
      <div className="knoux-stage-scanline" aria-hidden="true" />

      <header className="knoux-stage-header">
        <div className="knoux-stage-kicker">
          <Activity size={13} />
          <span>{serviceAppMode ? (isRtl ? 'مساحة الخدمة' : 'SERVICE WORKSPACE') : (isRtl ? 'مساحة التنفيذ' : 'LIVE EXECUTION WORKSPACE')}</span>
        </div>
        <div className="knoux-stage-context">
          <span>{isRtl ? family.name.ar : family.name.en}</span>
          <span className="knoux-stage-separator">/</span>
          <strong>{selectedTool ? (isRtl ? selectedTool.ArabicName : selectedTool.EnglishName) : (isRtl ? service.name.ar : service.name.en)}</strong>
        </div>
        <KnouxAiContextButton
          lang={lang}
          familyId={family.id}
          familyName={isRtl ? family.name.ar : family.name.en}
          serviceId={service.id}
          serviceName={isRtl ? service.name.ar : service.name.en}
          toolId={selectedTool?.ToolId ?? null}
          toolName={selectedTool ? (isRtl ? selectedTool.ArabicName : selectedTool.EnglishName) : null}
        />
        <div className="knoux-stage-runtime">
          <span className={bridgeOnline === true ? 'is-online' : bridgeOnline === false ? 'is-offline' : 'is-pending'} />
          {bridgeLabel}
        </div>
      </header>

      <div className="knoux-live-hud" aria-live="polite">
        <div className="knoux-live-hud-title">
          <span className="knoux-live-pulse" />
          <div>
            <strong>{statusLabel}</strong>
            <small>{liveClock.toLocaleTimeString(isRtl ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>
          </div>
        </div>
        <div className="knoux-live-metrics">
          <div><Radio size={14} /><span>{isRtl ? 'الإشارات' : 'SIGNALS'}<b>{activeSignals}</b></span></div>
          <div><TerminalSquare size={14} /><span>{isRtl ? 'السجل الحي' : 'LIVE LOG'}<b>{activityCount}</b></span></div>
          <div><Gauge size={14} /><span>{isRtl ? 'زمن الاستجابة' : 'LATENCY'}<b>—</b></span></div>
          <div><ShieldCheck size={14} /><span>{isRtl ? 'وضع الامتياز' : 'PRIVILEGE'}<b>{bridgeElevated ? (isRtl ? 'مرتفع' : 'ELEVATED') : (isRtl ? 'قياسي' : 'STANDARD')}</b></span></div>
        </div>
      </div>

      {executionTool && (
        <div
          className="knoux-command-execution-bar"
          data-status={executionStatus}
          data-tool-id={executionTool.ToolId}
          role="status"
        >
          <div className="knoux-command-execution-led"><Radio size={14} /></div>
          <div className="knoux-command-execution-copy">
            <span>{executionRunning ? (isRtl ? 'تنفيذ نشط' : 'ACTIVE EXECUTION') : (isRtl ? 'آخر نتيجة تنفيذ' : 'LAST EXECUTION')}</span>
            <strong>{isRtl ? executionTool.ArabicName : executionTool.EnglishName}</strong>
            {selectionDiffersFromExecution && (
              <small>{isRtl ? 'الإجراء المحدد مختلف؛ حالة التنفيذ تظل مرتبطة بأداة التنفيذ الأصلية.' : 'Selected action differs; runtime ownership remains attached to the execution tool.'}</small>
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

      {/* mode="sync": the incoming station mounts concurrently with the outgoing
          exit so service switching never leaves the center stage empty
          (proven by the final-visual in-app navigation gate). */}
      <AnimatePresence mode="sync" initial={false}>
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
              bridgeOnline={bridgeOnline}
              bridgeElevated={bridgeElevated}
              toolStatus={effectiveToolStatuses[selectedTool.ToolId] ?? 'idle'}
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
        ) : serviceAppMode ? (
          <motion.div
            key={`service-app-${service.id}`}
            className={`knoux-stage-service-app${serviceDockEnabled ? ' knoux-stage-service-app--dock' : ''}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {serviceDockEnabled ? (
              <KnouxDockWorkspace lang={lang} workspace={serviceDockWorkspace} enabled>
                <aside className="knoux-service-dock-explorer" data-service-dock-zone="explorer">
                  <p className="knoux-service-dock-eyebrow">{isRtl ? 'الأدوات المسجلة' : 'REGISTERED TOOLS'}</p>
                  <strong>{isRtl ? service.name.ar : service.name.en}</strong>
                  <ul>
                    {serviceTools.map(tool => {
                      const status = effectiveToolStatuses[tool.ToolId] ?? 'idle';
                      return (
                        <li key={tool.ToolId} data-tool-id={tool.ToolId} data-tool-status={status}>
                          <span className="knoux-service-dock-status" data-status={status} aria-hidden="true" />
                          <span className="knoux-service-dock-tool-id">{tool.ToolId}</span>
                          <span>{isRtl ? tool.ArabicName : tool.EnglishName}</span>
                        </li>
                      );
                    })}
                  </ul>
                </aside>

                <div className="knoux-service-dock-center" data-service-dock-zone="center">
                  {serviceAppSurface}
                </div>

                <aside className="knoux-service-dock-context" data-service-dock-zone="context">
                  <p className="knoux-service-dock-eyebrow">{isRtl ? 'حالة التشغيل' : 'RUNTIME STATE'}</p>
                  <dl>
                    <div>
                      <dt>{isRtl ? 'الجسر' : 'Bridge'}</dt>
                      <dd>{bridgeLabel}</dd>
                    </div>
                    <div>
                      <dt>{isRtl ? 'الامتياز' : 'Privilege'}</dt>
                      <dd>{bridgeElevated ? (isRtl ? 'مرتفع' : 'Elevated') : (isRtl ? 'قياسي' : 'Standard')}</dd>
                    </div>
                    <div>
                      <dt>{isRtl ? 'الإجراءات المسجلة' : 'Registered actions'}</dt>
                      <dd>{bridgeOnline === true ? serviceTools.length : '—'}</dd>
                    </div>
                    <div>
                      <dt>{isRtl ? 'عمليات نشطة' : 'Running actions'}</dt>
                      <dd>{activeSignals}</dd>
                    </div>
                  </dl>
                  <p className="knoux-service-dock-note">
                    {servicesDockEnabled
                      ? (isRtl
                          ? 'بيانات الخدمات والعمليات والطوبولوجيا والتنفيذ تظل مملوكة لمحطة الخدمات والعمليات الحالية.'
                          : 'Service, process, topology, and execution evidence remain owned by the existing Services & Processes station.')
                      : securityDockEnabled
                        ? (isRtl
                            ? 'أدلة الحماية والإشارات والإجراءات تبقى مملوكة لمركز أدلة الأمان الحالي.'
                            : 'Protection evidence, signals, and actions remain owned by the existing Security Evidence Center station.')
                        : performanceDockEnabled
                          ? (isRtl
                              ? 'قياسات الأداء والأدلة والتوصيات والتنفيذ تظل مملوكة لمرصد الأداء الحالي.'
                              : 'Performance telemetry, evidence, recommendations, and execution remain owned by the existing Performance Observatory station.')
                          : diagnosticsDockEnabled
                            ? (isRtl
                                ? 'القياسات التشخيصية والأدلة والتقارير والتنفيذ تظل مملوكة بمحطة التشخيص الحالية.'
                                : 'Diagnostic telemetry, evidence, reports, and execution remain owned by the existing Diagnostics station.')
                            : postInstallDockEnabled
                              ? (isRtl
                                  ? 'بيانات التجهيز والاختيارات والتنفيذ والنتائج تظل مملوكة بمحطة ما بعد التثبيت الحالية.'
                                  : 'Provisioning data, selections, execution, and evidence remain owned by the existing Post-Install station.')
                              : softwareDockEnabled
                                ? (isRtl
                                    ? 'بيانات البيئة والتشغيل والنتائج تظل مملوكة بمحطة بيئة البرامج الحالية.'
                                    : 'Environment data, execution, and evidence remain owned by the existing Software Environment station.')
                                : (isRtl
                                    ? 'التشغيل والنتائج تظل مملوكة بمحطة البرامج الحالية.'
                                    : 'Execution and evidence remain owned by the existing Programs station.')}
                  </p>
                </aside>
              </KnouxDockWorkspace>
            ) : serviceAppSurface}
          </motion.div>
        ) : (
          <motion.div
            key={`runtime-${executionTool?.ToolId ?? service.id}`}
            className="knoux-workspace-empty knoux-command-workspace-empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <div className="knoux-workspace-empty-icon"><ServiceIcon size={28} /></div>
            <div>
              <span>{isRtl ? 'التنفيذ النشط يحتفظ بالمساحة' : 'ACTIVE EXECUTION OWNS THIS WORKSPACE'}</span>
              <h3>{executionTool ? (isRtl ? executionTool.ArabicName : executionTool.EnglishName) : (isRtl ? service.name.ar : service.name.en)}</h3>
              <p>
                {isRtl
                  ? 'يبقى التنفيذ الحالي هو المصدر المعتمد حتى ينتهي أو يتم إلغاؤه.'
                  : 'The current execution remains authoritative until it completes or is cancelled.'}
              </p>
            </div>
            <div className="knoux-command-empty-hint">
              <Braces size={15} />
              <Terminal size={15} />
              <span>{isRtl ? 'لن يغيّر اختيار خدمة أخرى ملكية التنفيذ' : 'Changing service selection will not relabel the running work'}</span>
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
