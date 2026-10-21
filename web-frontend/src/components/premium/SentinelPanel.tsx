import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Cpu, Layers, PanelRightClose, PanelRightOpen, Zap,
} from 'lucide-react';
import type { AdvancedSoftwarePreview, BridgeHealth, BridgeTool, ExecutionMode, SystemSnapshot } from '../../lib/api';
import { api } from '../../lib/api';
import type { FamilyId } from '../../data/family-map';
import StatusIndicator from '../shell/StatusIndicator';
import type { StatusTone } from '../shell/StatusIndicator';

export interface SentinelTask {
  runId: string;
  tool: BridgeTool;
  mode: ExecutionMode;
  status: 'running' | 'success' | 'error' | 'cancelled' | 'inconclusive';
}

export interface SentinelPanelProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  activeFamily: FamilyId | null;
  activeTasks: SentinelTask[];
  systemSnapshot?: SystemSnapshot | null;
  activeView?: string;
  aiProviderState?: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  selectedTarget?: string | null;
  evidenceCount?: number | null;
  findingsCount?: number | null;
  /** The operation currently selected in the work surface, if any. */
  selectedTool?: BridgeTool | null;
  /** The service the work surface is showing, if any. */
  selectedService?: string | null;
  /** Collapsed state of the adaptive inspector. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type SectionId = 'operation' | 'system' | 'tasks' | 'evidence';

const RISK_TONE: Record<string, StatusTone> = {
  READ_ONLY: 'positive',
  SAFE_CLEANUP: 'data',
  SYSTEM_REPAIR: 'caution',
  DESTRUCTIVE: 'danger',
  REBOOT_REQUIRED: 'danger',
  WINRE_ONLY: 'caution',
};

const TASK_TONE: Record<SentinelTask['status'], StatusTone> = {
  running: 'data',
  success: 'positive',
  error: 'danger',
  cancelled: 'caution',
  inconclusive: 'caution',
};

const SECTION_ICONS: Record<SectionId, React.ElementType> = {
  operation: Layers,
  system: Cpu,
  tasks: Zap,
  evidence: Activity,
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let size = value;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * The adaptive inspector.
 *
 * It is contextual by design: it shows what belongs to the operation the
 * user is looking at — the selected tool's requirements, risk and
 * elevation, the live system evidence behind the current studio, the
 * running tasks and the evidence produced so far. System-wide telemetry is
 * one section away instead of a permanent full-height column, and the whole
 * panel can be collapsed to a narrow rail when the work surface needs the
 * width.
 */
export default function SentinelPanel({
  lang,
  bridgeOnline,
  activeFamily,
  activeTasks,
  systemSnapshot,
  activeView,
  aiProviderState,
  selectedTarget,
  evidenceCount,
  findingsCount,
  selectedTool,
  selectedService,
  collapsed = false,
  onToggleCollapse,
}: SentinelPanelProps) {
  const isRtl = lang === 'ar';
  const [liveSystem, setLiveSystem] = useState<SystemSnapshot | null>(systemSnapshot ?? null);
  const [apiHealth, setApiHealth] = useState<BridgeHealth | null>(null);
  const [probeState, setProbeState] = useState<'idle' | 'probing' | 'ready' | 'unavailable'>('idle');
  const [probeLatency, setProbeLatency] = useState<number | null>(null);
  const [developerToolCount, setDeveloperToolCount] = useState<number | null>(null);
  const [sonarToolCount, setSonarToolCount] = useState<number | null>(null);
  const [sonarAiConfigured, setSonarAiConfigured] = useState<boolean | null>(null);
  const [developerPreview, setDeveloperPreview] = useState<AdvancedSoftwarePreview | null>(null);
  const [developerProbeState, setDeveloperProbeState] = useState<'idle' | 'probing' | 'ready' | 'unavailable'>('idle');
  const probeTimer = useRef<number | null>(null);
  const probeGeneration = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => () => { cancelledRef.current = true; }, []);

  useEffect(() => {
    if (systemSnapshot) setLiveSystem(systemSnapshot);
  }, [systemSnapshot]);

  // The workbench keeps its live sensor probe: real counts, real latency,
  // never a fabricated readiness signal. One endpoint failing must never
  // suppress the others, so the probe settles every call independently.
  useEffect(() => {
    if (activeFamily !== 'workbench') return;
    let cancelled = false;
    const generation = ++probeGeneration.current;

    const probe = async () => {
      setProbeState('probing');
      const startedAt = Date.now();
      try {
        const settled = await Promise.allSettled([
          api.health(),
          api.categoryTools('12-Developer-Tools'),
          api.categoryTools('18-Project-Sonar'),
          api.sonarAiStatus(),
          api.system(),
        ]);
        if (cancelled || generation !== probeGeneration.current) return;

        const [healthResult, developerResult, sonarResult, sonarAiResult, systemResult] = settled;
        if (healthResult.status === 'fulfilled') setApiHealth(healthResult.value);
        if (developerResult.status === 'fulfilled') setDeveloperToolCount(developerResult.value.tools?.length ?? null);
        if (sonarResult.status === 'fulfilled') setSonarToolCount(sonarResult.value.tools?.length ?? null);
        if (sonarAiResult.status === 'fulfilled') setSonarAiConfigured(sonarAiResult.value.configured);
        if (systemResult.status === 'fulfilled') setLiveSystem(systemResult.value.system);

        setProbeLatency(Date.now() - startedAt);
        const anyLive = settled.some(result => result.status === 'fulfilled');
        setProbeState(anyLive ? 'ready' : 'unavailable');
      } catch {
        if (cancelled || generation !== probeGeneration.current) return;
        setProbeState('unavailable');
      }
    };

    void probe();
    const schedule = () => { probeTimer.current = window.setTimeout(() => void probe(), 8000); };
    schedule();
    return () => {
      cancelled = true;
      probeGeneration.current += 1;
      if (probeTimer.current) window.clearTimeout(probeTimer.current);
      probeTimer.current = null;
    };
  }, [activeFamily]);

  // The heavy developer inventory is explicit and user-triggered: it must
  // never run inside the 8 second live sensor loop.
  const runDeveloperDeepProbe = useCallback(async () => {
    setDeveloperProbeState('probing');
    try {
      const { preview } = await api.advancedSoftwarePreview();
      if (cancelledRef.current) return;
      setDeveloperPreview(preview);
      setDeveloperProbeState('ready');
    } catch {
      if (cancelledRef.current) return;
      setDeveloperProbeState('unavailable');
    }
  }, []);

  const defenderTone: StatusTone = !liveSystem
    ? 'neutral'
    : liveSystem.DefenderRunning && liveSystem.DefenderRealtime
      ? 'positive'
      : 'danger';

  const sections = useMemo(() => {
    const list: { id: SectionId; label: string }[] = [];
    if (selectedTool) list.push({ id: 'operation', label: isRtl ? 'العملية' : 'Operation' });
    list.push({ id: 'system', label: isRtl ? 'النظام' : 'System' });
    if (activeTasks.length > 0) list.push({ id: 'tasks', label: isRtl ? 'المهام' : 'Tasks' });
    if (activeView === 'ai-scan' || evidenceCount || findingsCount) list.push({ id: 'evidence', label: isRtl ? 'الأدلة' : 'Evidence' });
    return list;
  }, [activeTasks.length, activeView, evidenceCount, findingsCount, isRtl, selectedTool]);

  return (
    <aside
      className="knoux-sentinel knoux-inspector"
      data-collapsed={collapsed}
      data-role="context-inspector"
      aria-label={isRtl ? 'السياق' : 'Context inspector'}
    >
      <div className="knoux-inspector-header">
        <h2>{isRtl ? 'السياق' : 'Context'}</h2>
        {onToggleCollapse ? (
          <button
            type="button"
            className="knoux-inspector-toggle"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed
              ? (isRtl ? 'توسيع لوحة السياق' : 'Expand context inspector')
              : (isRtl ? 'طي لوحة السياق' : 'Collapse context inspector')}
            title={collapsed
              ? (isRtl ? 'توسيع لوحة السياق' : 'Expand context inspector')
              : (isRtl ? 'طي لوحة السياق' : 'Collapse context inspector')}
          >
            {collapsed ? <PanelRightOpen size={15} aria-hidden="true" /> : <PanelRightClose size={15} aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      <div className="knoux-inspector-body">
        {collapsed ? (
          <div className="knoux-inspector-rail-icons">
            {sections.map(section => {
              const Icon = SECTION_ICONS[section.id];
              return (
                <span key={section.id} className="knoux-inspector-rail-icon" title={section.label}>
                  <Icon size={15} aria-hidden="true" />
                </span>
              );
            })}
          </div>
        ) : null}

        {!collapsed && selectedTool ? (
          <section className="knoux-inspector-section" data-section="operation">
            <header>
              <span>{isRtl ? 'العملية' : 'Operation'}</span>
              <StatusIndicator tone={RISK_TONE[selectedTool.RiskLevel] ?? 'neutral'} label={selectedTool.RiskLevel} />
            </header>
            <dl className="knoux-inspector-facts">
              <dt>{isRtl ? 'الخدمة' : 'Service'}</dt>
              <dd>{selectedService ?? selectedTool.Category}</dd>
              <dt>{isRtl ? 'المعرّف' : 'Tool id'}</dt>
              <dd>{selectedTool.ToolId}</dd>
              <dt>{isRtl ? 'الصلاحية' : 'Elevation'}</dt>
              <dd>{selectedTool.RequiresAdmin ? (isRtl ? 'مطلوبة' : 'Required') : (isRtl ? 'غير مطلوبة' : 'Not required')}</dd>
              <dt>{isRtl ? 'إعادة تشغيل' : 'Restart'}</dt>
              <dd>{selectedTool.RequiresRestart ? (isRtl ? 'قد تتطلب' : 'May be required') : (isRtl ? 'لا' : 'No')}</dd>
              <dt>{isRtl ? 'تحليل فقط' : 'Analyze only'}</dt>
              <dd>{selectedTool.AnalyzeOnlySupported ? (isRtl ? 'مدعوم' : 'Supported') : (isRtl ? 'غير مدعوم' : 'Not supported')}</dd>
              <dt>{isRtl ? 'تأكيد' : 'Confirmation'}</dt>
              <dd>{selectedTool.RequiresConfirmation ? (isRtl ? 'مطلوب' : 'Required') : (isRtl ? 'غير مطلوب' : 'Not required')}</dd>
              <dt>{isRtl ? 'مدخلات' : 'Inputs'}</dt>
              <dd>{selectedTool.Parameters?.length ? selectedTool.Parameters.join(', ') : (isRtl ? 'لا مدخلات' : 'No inputs')}</dd>
              <dt>{isRtl ? 'دليل' : 'Guide'}</dt>
              <dd>{selectedTool.OfflineCapability || '—'}</dd>
            </dl>
          </section>
        ) : null}

        {!collapsed ? (
          <section className="knoux-inspector-section" data-section="system">
            <header>
              <span>{isRtl ? 'النظام' : 'System'}</span>
              <StatusIndicator
                tone={bridgeOnline === true ? 'positive' : bridgeOnline === false ? 'danger' : 'caution'}
                label={bridgeOnline === true ? (isRtl ? 'متصل' : 'Online') : bridgeOnline === false ? (isRtl ? 'غير متصل' : 'Offline') : (isRtl ? 'فحص' : 'Checking')}
              />
            </header>
            {liveSystem ? (
              <dl className="knoux-inspector-facts">
                <dt>{isRtl ? 'النظام' : 'OS'}</dt>
                <dd>{liveSystem.Os || '—'}</dd>
                <dt>{isRtl ? 'البناء' : 'Build'}</dt>
                <dd>{liveSystem.Build || '—'}</dd>
                <dt>{isRtl ? 'المعالج' : 'CPU'}</dt>
                <dd title={liveSystem.CpuName}>{liveSystem.CpuLoad ?? 0}%</dd>
                <dt>{isRtl ? 'الذاكرة الحرة' : 'Free RAM'}</dt>
                <dd>{formatBytes(liveSystem.FreeRamGB * 1024 * 1024 * 1024)}</dd>
                <dt>{isRtl ? 'العمليات' : 'Processes'}</dt>
                <dd>{liveSystem.Processes ?? '—'}</dd>
                <dt>{isRtl ? 'قرص النظام' : 'System drive'}</dt>
                <dd>{liveSystem.SystemDrive || '—'}</dd>
                <dt>{isRtl ? 'جدار الحماية' : 'Firewall'}</dt>
                <dd>
                  {liveSystem.Firewall
                    ? liveSystem.Firewall.map(profile => `${profile.Profile}: ${profile.Enabled ? 'on' : 'off'}`).join(' · ')
                    : (isRtl ? 'لم يُفحص' : 'Not checked')}
                </dd>
                <dt>{isRtl ? 'دفاع ويندوز' : 'Defender'}</dt>
                <dd>
                  <StatusIndicator
                    tone={defenderTone}
                    label={liveSystem.DefenderRunning
                      ? (liveSystem.DefenderRealtime ? (isRtl ? 'يعمل' : 'Running') : (isRtl ? 'معطّل' : 'Disabled'))
                      : (isRtl ? 'لا يعمل' : 'Not running')}
                  />
                </dd>
              </dl>
            ) : (
              <div className="knoux-panel-body">
                <p className="knoux-finding-body">{isRtl ? 'لم يتم استلام لقطة نظام بعد.' : 'No live system snapshot has been received yet.'}</p>
              </div>
            )}
          </section>
        ) : null}

        {!collapsed && activeFamily === 'workbench' ? (
          <section className="knoux-inspector-section" data-section="sensor">
            <header>
              <span>{isRtl ? 'مستشعرات الورشة' : 'Workbench sensors'}</span>
              <StatusIndicator
                tone={probeState === 'ready' ? 'positive' : probeState === 'unavailable' ? 'danger' : 'caution'}
                label={probeState === 'ready' ? (isRtl ? 'متصل' : 'Live') : probeState === 'unavailable' ? (isRtl ? 'غير متاح' : 'Unavailable') : (isRtl ? 'فحص' : 'Probing')}
              />
            </header>
            <dl className="knoux-inspector-facts">
              <dt>{isRtl ? 'زمن الاستجابة' : 'Latency'}</dt>
              <dd>{probeLatency === null ? '—' : `${probeLatency} ms`}</dd>
              <dt>{isRtl ? 'حالة الجسر' : 'Bridge'}</dt>
              <dd>{apiHealth ? (apiHealth.elevated ? (isRtl ? 'مرتفع' : 'Elevated') : (isRtl ? 'قياسي' : 'Standard')) : '—'}</dd>
              <dt>{isRtl ? 'أدوات التطوير' : 'Developer tools'}</dt>
              <dd>{developerToolCount ?? '—'}</dd>
              <dt>{isRtl ? 'أدوات Sonar' : 'Sonar tools'}</dt>
              <dd>{sonarToolCount ?? '—'}</dd>
              <dt>{isRtl ? 'ذكاء Sonar' : 'Sonar AI'}</dt>
              <dd>{sonarAiConfigured === null ? '—' : sonarAiConfigured ? (isRtl ? 'موصول' : 'Configured') : (isRtl ? 'غير موصول' : 'Not configured')}</dd>
            </dl>
            <div className="knoux-panel-body">
              {developerPreview ? (
                <dl className="knoux-inspector-facts">
                  <dt>{isRtl ? 'أدوات المطور' : 'Developer tools'}</dt>
                  <dd>{developerPreview.DeveloperTools?.length ?? 0}</dd>
                  <dt>{isRtl ? 'امتدادات' : 'Extensions'}</dt>
                  <dd>{developerPreview.ChromeExtensions?.length ?? 0}</dd>
                  <dt>{isRtl ? 'سجل عند' : 'Captured at'}</dt>
                  <dd>{developerPreview.CapturedAt ?? '—'}</dd>
                </dl>
              ) : (
                <p className="knoux-finding-body">{isRtl ? 'لم يُفحص بعد' : 'Not checked yet'}</p>
              )}
              <button
                type="button"
                className="knoux-studio-btn"
                data-action-id="developer-deep-probe"
                onClick={() => void runDeveloperDeepProbe()}
                disabled={developerProbeState === 'probing'}
              >
                <Zap size={13} aria-hidden="true" />
                <span>{developerProbeState === 'probing'
                  ? (isRtl ? 'جارٍ الفحص...' : 'Probing...')
                  : (isRtl ? 'فحص بيئة المطورين' : 'Probe developer environment')}</span>
              </button>
            </div>
          </section>
        ) : null}

        {!collapsed && activeTasks.length > 0 ? (
          <section className="knoux-inspector-section" data-section="tasks">
            <header>
              <span>{isRtl ? 'المهام' : 'Active tasks'}</span>
              <StatusIndicator tone="data" label={String(activeTasks.length)} />
            </header>
            <ul className="knoux-inspector-task-list">
              {activeTasks.map(task => (
                <li key={task.runId} data-status={task.status}>
                  <div className="knoux-inspector-task-copy">
                    <strong>{isRtl ? task.tool.ArabicName : task.tool.EnglishName}</strong>
                    <small>{task.mode} · {task.tool.RiskLevel}</small>
                  </div>
                  <StatusIndicator tone={TASK_TONE[task.status]} label={task.status} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!collapsed && (activeView === 'ai-scan' || evidenceCount || findingsCount) ? (
          <section className="knoux-inspector-section" data-section="evidence">
            <header>
              <span>{isRtl ? 'الأدلة' : 'Evidence'}</span>
              <StatusIndicator
                tone={aiProviderState === 'CONFIGURED' ? 'positive' : aiProviderState === 'UNCONFIGURED' || aiProviderState === 'UNAVAILABLE' ? 'caution' : 'neutral'}
                label={aiProviderState === 'CONFIGURED' ? (isRtl ? 'موصول' : 'Connected') : (isRtl ? 'غير موصول' : 'Not connected')}
              />
            </header>
            <dl className="knoux-inspector-facts">
              <dt>{isRtl ? 'الهدف' : 'Target'}</dt>
              <dd>{selectedTarget ?? (isRtl ? 'لم يُحدد' : 'Not selected')}</dd>
              <dt>{isRtl ? 'قطع الأدلة' : 'Evidence'}</dt>
              <dd>{evidenceCount ?? 0}</dd>
              <dt>{isRtl ? 'النتائج' : 'Findings'}</dt>
              <dd>{findingsCount ?? 0}</dd>
            </dl>
          </section>
        ) : null}

        {!collapsed && !selectedTool && !liveSystem && activeTasks.length === 0 ? (
          <div className="knoux-inspector-section">
            <div className="knoux-panel-body">
              <p className="knoux-finding-body">
                {isRtl
                  ? 'لا يوجد سياق بعد. اختر خدمة أو أداة لعرض متطلباتها وأدلتها.'
                  : 'No context yet. Select a service or a tool to see its requirements and evidence.'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
