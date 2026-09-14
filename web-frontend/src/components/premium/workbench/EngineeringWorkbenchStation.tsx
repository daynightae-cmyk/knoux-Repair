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

  return (
    <section
      className="knoux-workspace-stage knoux-command-workspace knoux-engineering-workbench knoux-command-deck"
      data-mode="service"
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

      {/* ── Live preview workspace (real station screens) ─── */}
      <p className="knoux-deck-preview-label">{text.previewLabel}</p>
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
        />
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
