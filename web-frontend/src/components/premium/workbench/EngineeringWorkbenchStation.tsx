import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Code2, Cpu, Download, Network, Package, Radar, ScanLine, ScanSearch,
  ShieldCheck, Wifi, WifiOff, Wrench, type LucideIcon,
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../../data/family-map';
import type { ToolStatus } from '../../../types';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ServiceApps from '../../ServiceApps';
import ExecutionConfirmDialog from '../../ExecutionConfirmDialog';
import KnouxAiContextButton from '../../KnouxAiContextButton';

interface EngineeringWorkbenchStationProps {
  family: FamilyDefinition;
  activeService: ServiceDefinition;
  serviceTools: BridgeTool[];
  /** All family tools (both services) for honest per-service counts. Falls back to serviceTools. */
  familyTools?: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatuses: Record<string, ToolStatus>;
  onSelectService: (id: ServiceId) => void;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  onCancelTool: () => void;
  onRetryBridge: () => void;
}

const WORKBENCH_SERVICES: ServiceId[] = ['12-Developer-Tools', '18-Project-Sonar'];

interface DeckChip {
  toolId: string;
  serviceId: ServiceId;
  icon: LucideIcon;
  labelEn: string;
  labelAr: string;
}

/** Curated quick actions — every chip maps 1:1 to a real manifest ToolId. */
const DECK_CHIPS: DeckChip[] = [
  { toolId: 'DT05', serviceId: '12-Developer-Tools', icon: ScanSearch, labelEn: 'Project Intelligence', labelAr: 'ذكاء المشاريع' },
  { toolId: 'DT06', serviceId: '12-Developer-Tools', icon: Network, labelEn: 'Port Observatory', labelAr: 'مرصد المنافذ' },
  { toolId: 'DT01', serviceId: '12-Developer-Tools', icon: Cpu, labelEn: 'Runtime Audit', labelAr: 'تدقيق البيئة' },
  { toolId: 'SN01', serviceId: '18-Project-Sonar', icon: ScanLine, labelEn: 'Workspace Scan', labelAr: 'فحص مساحة العمل' },
  { toolId: 'SN02', serviceId: '18-Project-Sonar', icon: Radar, labelEn: 'Sonar Gap Map', labelAr: 'خريطة فجوات سونار' },
  { toolId: 'SN04', serviceId: '18-Project-Sonar', icon: Package, labelEn: 'Dependency Audit', labelAr: 'تدقيق الاعتماديات' },
  { toolId: 'SN06', serviceId: '18-Project-Sonar', icon: Download, labelEn: 'Export Handoff', labelAr: 'تصدير التسليم' },
];

function preferredMode(tool: BridgeTool): ExecutionMode {
  return tool.AnalyzeOnlySupported ? 'analyze' : tool.WhatIfSupported ? 'preview' : 'run';
}

const COPY = {
  en: {
    kicker: 'ENGINEERING WORKBENCH',
    titleA: 'Build Smarter.',
    titleB: 'Ship Safer.',
    subtitle: 'Your complete development command center. Analyze. Optimize. Secure. Deliver.',
    heroTools: 'Workbench tools',
    serviceReady: 'Ready',
    serviceActive: 'Active',
    serviceOffline: 'Waiting for bridge',
    toolsLabel: 'registered',
    stripTitle: 'WORKBENCH TOOLS',
    viewAll: 'Open service actions below',
    offlineNote: 'Connect the local bridge to arm the quick actions.',
    retry: 'Retry connection',
    ctxBridge: 'Bridge',
    ctxPrivilege: 'Privilege',
    ctxActions: 'Registered actions',
    ctxSonarAi: 'Sonar AI',
    aiConfigured: 'Configured',
    aiMissing: 'Not configured',
    aiUnknown: 'Unknown',
    elevated: 'ELEVATED',
    standard: 'STANDARD',
    online: 'Online',
    offline: 'Offline',
    checking: 'Checking',
    previewLabel: 'ACTIVE WORKSPACE',
  },
  ar: {
    kicker: 'منصة العمل الهندسية',
    titleA: 'ابنِ بذكاء.',
    titleB: 'أطلق بأمان.',
    subtitle: 'مركز قيادة التطوير الكامل. حلّل. حسّن. أمّن. أطلق.',
    heroTools: 'أدوات المنصة',
    serviceReady: 'جاهزة',
    serviceActive: 'نشطة',
    serviceOffline: 'بانتظار الجسر',
    toolsLabel: 'مسجلة',
    stripTitle: 'أدوات المنصة',
    viewAll: 'افتح إجراءات الخدمة بالأسفل',
    offlineNote: 'اتصل بالجسر المحلي لتفعيل الإجراءات السريعة.',
    retry: 'إعادة المحاولة',
    ctxBridge: 'الجسر',
    ctxPrivilege: 'الامتياز',
    ctxActions: 'الإجراءات المسجلة',
    ctxSonarAi: 'ذكاء سونار',
    aiConfigured: 'مُعد',
    aiMissing: 'غير مُعد',
    aiUnknown: 'غير معروف',
    elevated: 'مرتفع',
    standard: 'قياسي',
    online: 'متصل',
    offline: 'غير متصل',
    checking: 'يفحص',
    previewLabel: 'مساحة العمل النشطة',
  },
};

export default function EngineeringWorkbenchStation({
  family,
  activeService,
  serviceTools,
  familyTools,
  lang,
  bridgeOnline,
  bridgeElevated,
  toolStatuses,
  onSelectService,
  onRunTool,
  onCancelTool,
  onRetryBridge,
}: EngineeringWorkbenchStationProps) {
  const isRtl = lang === 'ar';
  const text = COPY[lang];
  const [serviceToolStatuses, setServiceToolStatuses] = useState<Record<string, ToolStatus>>({});
  const [pending, setPending] = useState<{ tool: BridgeTool; serviceId: ServiceId; mode: ExecutionMode } | null>(null);
  const [heroImg, setHeroImg] = useState('/brand/workbench-hero.png');
  const [sonarAi, setSonarAi] = useState<'configured' | 'missing' | 'unknown'>('unknown');
  type WorkbenchTab = 'overview' | 'code' | 'dependencies' | 'scripts' | 'environment' | 'insights' | 'output';
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview');

  const effectiveStatuses = useMemo<Record<string, ToolStatus>>(
    () => ({ ...toolStatuses, ...serviceToolStatuses }),
    [toolStatuses, serviceToolStatuses],
  );

  const pool = familyTools ?? serviceTools;

  const workbenchServices = useMemo(
    () => WORKBENCH_SERVICES
      .map(id => family.services.find(service => service.id === id))
      .filter((service): service is ServiceDefinition => Boolean(service)),
    [family.services],
  );

  const serviceCounts = useMemo(() => {
    const counts: Partial<Record<ServiceId, number>> = {};
    if (bridgeOnline === true) {
      for (const service of workbenchServices) {
        counts[service.id] = pool.filter(tool => tool.Category === service.id).length;
      }
    }
    return counts;
  }, [bridgeOnline, pool, workbenchServices]);

  const chips = useMemo(() => {
    if (bridgeOnline !== true) return [];
    return DECK_CHIPS
      .map(chip => ({ chip, tool: pool.find(candidate => candidate.ToolId === chip.toolId) ?? null }))
      .filter((entry): entry is { chip: DeckChip; tool: BridgeTool } => entry.tool !== null);
  }, [bridgeOnline, pool]);

  useEffect(() => {
    if (bridgeOnline !== true) { setSonarAi('unknown'); return; }
    let cancelled = false;
    api.sonarAiStatus()
      .then(status => { if (!cancelled) setSonarAi(status.configured ? 'configured' : 'missing'); })
      .catch(() => { if (!cancelled) setSonarAi('unknown'); });
    return () => { cancelled = true; };
  }, [bridgeOnline]);

  const bridgeLabel = bridgeOnline === true ? text.online : bridgeOnline === false ? text.offline : text.checking;

  const launchChip = (tool: BridgeTool, serviceId: ServiceId) => {
    if (serviceId !== activeService.id) onSelectService(serviceId);
    setPending({ tool, serviceId, mode: preferredMode(tool) });
  };

  // Honest tab views over the same real tool pool. No tab invents data:
  // every tab filters registered bridge tools or live execution states.
  const workbenchPool = useMemo(
    () => pool.filter(tool => WORKBENCH_SERVICES.includes(tool.Category as ServiceId)),
    [pool],
  );
  const tabTools = useMemo(() => {
    switch (activeTab) {
      case 'code':
        return workbenchPool.filter(tool => tool.Category === '12-Developer-Tools');
      case 'dependencies':
        return workbenchPool.filter(tool => tool.ToolId === 'SN04' || tool.ToolId === 'DT05' || tool.ToolId === 'SN02');
      case 'scripts':
        return workbenchPool.filter(tool => tool.WhatIfSupported || tool.AnalyzeOnlySupported || (tool.Parameters?.length ?? 0) > 0);
      case 'environment':
        return workbenchPool.filter(tool => tool.ToolId === 'DT01' || tool.ToolId === 'DT06');
      case 'insights':
        return workbenchPool.filter(tool => tool.Category === '18-Project-Sonar');
      case 'output': {
        const activeIds = new Set(Object.entries(effectiveStatuses).filter(([, status]) => status !== 'idle').map(([id]) => id));
        const flagged = workbenchPool.filter(tool => activeIds.has(tool.ToolId));
        return flagged.length > 0 ? flagged : workbenchPool.slice(0, 3);
      }
      case 'overview':
      default:
        return workbenchPool;
    }
  }, [activeTab, workbenchPool, effectiveStatuses]);
  const tabs: Array<{ id: WorkbenchTab; labelEn: string; labelAr: string }> = [
    { id: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
    { id: 'code', labelEn: 'Developer Tools', labelAr: 'أدوات المطور' },
    { id: 'dependencies', labelEn: 'Dependencies', labelAr: 'الاعتماديات' },
    { id: 'scripts', labelEn: 'Scripts', labelAr: 'السكربتات' },
    { id: 'environment', labelEn: 'Environment', labelAr: 'البيئة' },
    { id: 'insights', labelEn: 'Sonar Insights', labelAr: 'رؤى سونار' },
    { id: 'output', labelEn: 'Run Activity', labelAr: 'نشاط التشغيل' },
  ];
  const visibleTabs = activeService.id === '18-Project-Sonar'
    ? tabs.filter(tab => ['overview', 'dependencies', 'insights', 'output'].includes(tab.id))
    : tabs.filter(tab => ['overview', 'code', 'dependencies', 'scripts', 'environment', 'output'].includes(tab.id));

  return (
    <section
      className="knoux-workspace-stage knoux-command-workspace knoux-engineering-workbench knoux-command-deck"
      data-mode="service"
      data-operational="true"
      data-execution="idle"
      data-selected-tool-id=""
      data-execution-tool-id=""
      data-service-id={activeService.id}
      data-service-tool-count={bridgeOnline === true ? serviceTools.length : ''}
      aria-label={isRtl ? 'محطة ورشة الهندسة' : 'Engineering Workbench station'}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="knoux-stage-grid" aria-hidden="true" />
      <div className="knoux-stage-scanline" aria-hidden="true" />

      {/* ── Command Deck Hero ─────────────────────────────── */}
      <div className="knoux-deck-hero" data-deck="hero">
        <div className="knoux-deck-hero__copy">
          <p className="knoux-deck-hero__kicker">
            <Code2 size={13} aria-hidden="true" />
            <span>{text.kicker}</span>
          </p>
          <h2 className="knoux-deck-hero__title">
            <span>{text.titleA}</span> <em>{text.titleB}</em>
          </h2>
          <p className="knoux-deck-hero__subtitle">{text.subtitle}</p>
          <div className="knoux-deck-hero__meta">
            <span className="knoux-stage-context">
              <span>{isRtl ? family.name.ar : family.name.en}</span>
              <span className="knoux-stage-separator">/</span>
              <strong>{isRtl ? activeService.name.ar : activeService.name.en}</strong>
            </span>
            <span className="knoux-deck-hero__bridge" data-state={bridgeOnline === true ? 'online' : bridgeOnline === false ? 'offline' : 'checking'}>
              {bridgeOnline === false ? <WifiOff size={13} aria-hidden="true" /> : <Wifi size={13} aria-hidden="true" />}
              {bridgeLabel}
            </span>
            <span className="knoux-deck-hero__count">
              <Wrench size={13} aria-hidden="true" />
              {bridgeOnline === true
                ? `${pool.filter(tool => WORKBENCH_SERVICES.includes(tool.Category as ServiceId)).length} ${text.heroTools}`
                : text.serviceOffline}
            </span>
            <KnouxAiContextButton
              lang={lang}
              familyId={family.id}
              familyName={isRtl ? family.name.ar : family.name.en}
              serviceId={activeService.id}
              serviceName={isRtl ? activeService.name.ar : activeService.name.en}
              toolId={null}
              toolName={null}
            />
          </div>
        </div>
        <div className="knoux-deck-hero__art" aria-hidden="true">
          <img src={heroImg} alt="" draggable={false} onError={() => { if (heroImg !== '/brand/workbench-hero.svg') setHeroImg('/brand/workbench-hero.svg'); }} />
        </div>
      </div>

      {/* ── Service selector cards ────────────────────────── */}
      <div className="knoux-deck-services" data-deck="services">
        {workbenchServices.map(service => {
          const active = service.id === activeService.id;
          const count = serviceCounts[service.id];
          const Icon = service.id === '18-Project-Sonar' ? Radar : Code2;
          return (
            <button
              key={service.id}
              type="button"
              className="knoux-deck-service"
              data-service-card={service.id}
              data-active={active}
              aria-pressed={active}
              onClick={() => onSelectService(service.id)}
            >
              <span className="knoux-deck-service__icon"><Icon size={22} aria-hidden="true" /></span>
              <span className="knoux-deck-service__text">
                <strong>{isRtl ? service.name.ar : service.name.en}</strong>
                <small>{isRtl ? service.purpose.ar : service.purpose.en}</small>
              </span>
              <span className="knoux-deck-service__meta">
                <b>{typeof count === 'number' ? `${count} ${text.toolsLabel}` : '—'}</b>
                <i data-state={active ? 'active' : bridgeOnline === true ? 'ready' : 'idle'}>
                  {active ? text.serviceActive : bridgeOnline === true ? text.serviceReady : text.serviceOffline}
                </i>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Quick-action tool strip ───────────────────────── */}
      <div className="knoux-deck-strip" data-deck="tools">
        <div className="knoux-deck-strip__head">
          <span>{text.stripTitle} {bridgeOnline === true ? `(${chips.length})` : ''}</span>
          <small>{text.viewAll}</small>
        </div>
        {chips.length > 0 ? (
          <div className="knoux-deck-strip__row" role="list">
            {chips.map(({ chip, tool }) => {
              const status = effectiveStatuses[tool.ToolId];
              const needsPermission = tool.RequiresAdmin && !bridgeElevated;
              const ChipIcon = chip.icon;
              return (
                <button
                  key={chip.toolId}
                  type="button"
                  role="listitem"
                  className="knoux-deck-chip"
                  data-tool-id={tool.ToolId}
                  data-tool-status={status ?? 'idle'}
                  title={pickName(tool, lang)}
                  disabled={needsPermission}
                  onClick={() => launchChip(tool, chip.serviceId)}
                >
                  <span className="knoux-deck-chip__dot" data-status={status ?? 'idle'} />
                  <ChipIcon size={18} aria-hidden="true" />
                  <span>{isRtl ? chip.labelAr : chip.labelEn}</span>
                  <small>{tool.ToolId}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="knoux-deck-strip__empty">
            <Activity size={14} aria-hidden="true" />
            <span>{text.offlineNote}</span>
            {bridgeOnline === false && (
              <button type="button" onClick={onRetryBridge}>{text.retry}</button>
            )}
          </div>
        )}
      </div>

      {/* ── Context strip (real provider/tool data only) ──── */}
      <div className="knoux-deck-context" data-deck="context">
        <span className="knoux-deck-pill">
          <Activity size={12} aria-hidden="true" className="text-cyan-300" />
          {text.ctxActions}
          <b>{bridgeOnline === true ? serviceTools.length : '—'}</b>
        </span>
        <span className="knoux-deck-pill">
          <ShieldCheck size={12} aria-hidden="true" className={bridgeElevated ? 'text-amber-300' : 'text-emerald-300'} />
          {text.ctxPrivilege}
          <b>{bridgeElevated ? text.elevated : text.standard}</b>
        </span>
        <span className="knoux-deck-pill" data-sonar-ai={sonarAi}>
          <span className="knoux-deck-pill__dot" data-state={sonarAi} />
          {text.ctxSonarAi}
          <b>{sonarAi === 'configured' ? text.aiConfigured : sonarAi === 'missing' ? text.aiMissing : text.aiUnknown}</b>
        </span>
        <span className="knoux-deck-pill knoux-deck-pill--service">
          {isRtl ? activeService.name.ar : activeService.name.en}
        </span>
      </div>

      {/* ── Adaptive IDE workspace: explorer / dominant preview / context ─── */}
      <p className="knoux-deck-preview-label">{text.previewLabel}</p>
      <div className="knoux-deck-tabs" role="tablist" aria-label={isRtl ? 'تبويبات مساحة العمل' : 'Workspace tabs'}>
        {visibleTabs.map(tab => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-workbench-tab={tab.id}
              data-active={selected}
              className="knoux-deck-tab"
              onClick={() => setActiveTab(tab.id)}
            >
              {isRtl ? tab.labelAr : tab.labelEn}
            </button>
          );
        })}
      </div>
      <div className="knoux-deck-workspace" data-workspace="ide">
        {/* LEFT — compact project / service explorer over real registered tools */}
        <aside className="knoux-deck-explorer" data-zone="explorer" aria-label={isRtl ? 'مستكشف المشروع' : 'Project explorer'}>
          <p className="knoux-deck-explorer__title">{isRtl ? 'المستكشف' : 'EXPLORER'}</p>
          {workbenchServices.map(service => {
            const active = service.id === activeService.id;
            const count = serviceCounts[service.id];
            return (
              <div key={service.id} className="knoux-deck-explorer__service" data-service-id={service.id} data-active={active}>
                <button type="button" className="knoux-deck-explorer__head" onClick={() => onSelectService(service.id)} aria-pressed={active}>
                  <strong>{isRtl ? service.name.ar : service.name.en}</strong>
                  <small>{typeof count === 'number' ? `${count} ${text.toolsLabel}` : '—'}</small>
                </button>
                <ul className="knoux-deck-explorer__tools">
                  {pool.filter(tool => tool.Category === service.id).slice(0, 6).map(tool => {
                    const status = effectiveStatuses[tool.ToolId] ?? 'idle';
                    return (
                      <li key={tool.ToolId}>
                        <button
                          type="button"
                          className="knoux-deck-explorer__tool"
                          data-tool-id={tool.ToolId}
                          data-tool-status={status}
                          title={pickName(tool, lang)}
                          onClick={() => launchChip(tool, service.id)}
                        >
                          <span className="knoux-deck-chip__dot" data-status={status} />
                          <span className="knoux-deck-explorer__tool-id">{tool.ToolId}</span>
                          <span className="knoux-deck-explorer__tool-name">{pickName(tool, lang)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </aside>

        {/* CENTER — dominant live preview; tab views filter the same real pool */}
        <div className="knoux-deck-center" data-zone="center">
          {activeTab === 'overview' ? (
            <div className="knoux-stage-service-app min-h-0 flex-1 overflow-hidden p-3">
              <ServiceApps
                activeSection={activeService.legacySection}
                tools={serviceTools}
                toolStatuses={effectiveStatuses}
                lang={lang as Lang}
                bridgeElevated={bridgeElevated}
                bridgeOnline={bridgeOnline}
                onRetryBridge={onRetryBridge}
                onToolStatus={(toolId, status) => {
                  setServiceToolStatuses(previous => ({ ...previous, [toolId]: status }));
                }}
                onRunTool={onRunTool}
                onCancelTool={onCancelTool}
                embedded
              />
            </div>
          ) : (
            <div className="knoux-deck-tabview" data-tabview={activeTab}>
              <p className="knoux-deck-tabview__meta">
                {isRtl ? activeService.name.ar : activeService.name.en}
                <span>{tabTools.length} {text.toolsLabel}</span>
              </p>
              {tabTools.length > 0 ? (
                <ul className="knoux-deck-tabview__list">
                  {tabTools.map(tool => {
                    const status = effectiveStatuses[tool.ToolId] ?? 'idle';
                    const needsPermission = tool.RequiresAdmin && !bridgeElevated;
                    return (
                      <li key={tool.ToolId} className="knoux-deck-tabview__row" data-tool-id={tool.ToolId} data-tool-status={status}>
                        <span className="knoux-deck-chip__dot" data-status={status} />
                        <span className="knoux-deck-explorer__tool-id">{tool.ToolId}</span>
                        <span className="knoux-deck-explorer__tool-name">{pickName(tool, lang)}</span>
                        <button
                          type="button"
                          className="knoux-deck-tabview__run"
                          disabled={bridgeOnline !== true || needsPermission}
                          onClick={() => launchChip(tool, tool.Category as ServiceId)}
                        >
                          {isRtl ? 'تشغيل' : 'Run'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="knoux-deck-tabview__empty">{bridgeOnline === true ? text.viewAll : text.offlineNote}</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — readable assistant + live instrumentation, no fabricated cards */}
        <aside className="knoux-deck-side" data-zone="context" aria-label={isRtl ? 'السياق والأدوات' : 'Context and instrumentation'}>
          <div className="knoux-deck-side__block" data-block="assistant">
            <p className="knoux-deck-side__title">{isRtl ? 'المساعد' : 'ASSISTANT'}</p>
            <p className="knoux-deck-side__row">
              <span>{text.ctxSonarAi}</span>
              <b data-sonar-ai={sonarAi}>{sonarAi === 'configured' ? text.aiConfigured : sonarAi === 'missing' ? text.aiMissing : text.aiUnknown}</b>
            </p>
            <KnouxAiContextButton
              lang={lang}
              familyId={family.id}
              familyName={isRtl ? family.name.ar : family.name.en}
              serviceId={activeService.id}
              serviceName={isRtl ? activeService.name.ar : activeService.name.en}
              toolId={null}
              toolName={null}
            />
          </div>
          <div className="knoux-deck-side__block" data-block="run-state">
            <p className="knoux-deck-side__title">{isRtl ? 'حالة التشغيل' : 'RUN STATE'}</p>
            <p className="knoux-deck-side__row"><span>{text.ctxBridge}</span><b>{bridgeLabel}</b></p>
            <p className="knoux-deck-side__row"><span>{text.ctxPrivilege}</span><b>{bridgeElevated ? text.elevated : text.standard}</b></p>
            <p className="knoux-deck-side__row"><span>{text.ctxActions}</span><b>{bridgeOnline === true ? serviceTools.length : '—'}</b></p>
            <p className="knoux-deck-side__row"><span>{isRtl ? 'الخدمة' : 'Service'}</span><b>{isRtl ? activeService.name.ar : activeService.name.en}</b></p>
          </div>
        </aside>
      </div>

      {pending && (
        <ExecutionConfirmDialog
          tool={pending.tool}
          mode={pending.mode}
          lang={lang as Lang}
          onCancel={() => setPending(null)}
          onConfirm={(options, confirmation) => {
            if (pending.serviceId !== activeService.id) onSelectService(pending.serviceId);
            onRunTool(pending.tool, pending.mode, options, confirmation);
            setPending(null);
          }}
        />
      )}
    </section>
  );
}
