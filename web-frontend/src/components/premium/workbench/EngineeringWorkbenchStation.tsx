import { useMemo, useState } from 'react';
import { Activity, Code2, Radar, ShieldCheck, Terminal, Wifi, WifiOff } from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../../lib/api';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../../data/family-map';
import type { ToolStatus } from '../../../types';
import ServiceApps from '../../ServiceApps';
import KnouxAiContextButton from '../../KnouxAiContextButton';

interface EngineeringWorkbenchStationProps {
  family: FamilyDefinition;
  activeService: ServiceDefinition;
  serviceTools: BridgeTool[];
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

export default function EngineeringWorkbenchStation({
  family,
  activeService,
  serviceTools,
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
  const [serviceToolStatuses, setServiceToolStatuses] = useState<Record<string, ToolStatus>>({});

  const effectiveStatuses = useMemo<Record<string, ToolStatus>>(
    () => ({ ...toolStatuses, ...serviceToolStatuses }),
    [toolStatuses, serviceToolStatuses],
  );

  const workbenchServices = useMemo(
    () => WORKBENCH_SERVICES
      .map(id => family.services.find(service => service.id === id))
      .filter((service): service is ServiceDefinition => Boolean(service)),
    [family.services],
  );

  const bridgeLabel = bridgeOnline === true
    ? (isRtl ? 'الجسر متصل' : 'Bridge online')
    : bridgeOnline === false
      ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline')
      : (isRtl ? 'جارٍ فحص الجسر' : 'Checking bridge');

  return (
    <section
      className="knoux-workspace-stage knoux-command-workspace knoux-engineering-workbench"
      data-service-id={activeService.id}
      data-service-tool-count={bridgeOnline === true ? serviceTools.length : ''}
      aria-label={isRtl ? 'محطة ورشة الهندسة' : 'Engineering Workbench station'}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="knoux-stage-grid" aria-hidden="true" />
      <div className="knoux-stage-scanline" aria-hidden="true" />

      <header className="knoux-stage-header">
        <div className="knoux-stage-kicker">
          <Code2 size={13} aria-hidden="true" />
          <span>{isRtl ? 'ورشة الهندسة' : 'ENGINEERING WORKBENCH'}</span>
        </div>
        <div className="knoux-stage-context">
          <span>{isRtl ? family.name.ar : family.name.en}</span>
          <span className="knoux-stage-separator">/</span>
          <strong>{isRtl ? activeService.name.ar : activeService.name.en}</strong>
        </div>
        <KnouxAiContextButton
          lang={lang}
          familyId={family.id}
          familyName={isRtl ? family.name.ar : family.name.en}
          serviceId={activeService.id}
          serviceName={isRtl ? activeService.name.ar : activeService.name.en}
          toolId={null}
          toolName={null}
        />
        <div className="knoux-stage-runtime">
          {bridgeOnline === false ? <WifiOff size={13} aria-hidden="true" /> : <Wifi size={13} aria-hidden="true" />}
          <span>{bridgeLabel}</span>
        </div>
      </header>

      <div className="border-b border-white/[0.08] bg-slate-950/45 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 rounded-xl border border-white/[0.08] bg-slate-950/75">
          {workbenchServices.map(service => {
            const active = service.id === activeService.id;
            const Icon = service.id === '18-Project-Sonar' ? Radar : Terminal;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelectService(service.id)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${active
                  ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/25'
                  : 'text-slate-400 border border-transparent hover:text-white hover:bg-white/[0.04]'}`}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{isRtl ? service.name.ar : service.name.en}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-slate-950/70 px-2.5 py-1.5 text-slate-300">
            <Activity size={12} aria-hidden="true" className="text-cyan-300" />
            {isRtl ? 'الإجراءات المسجلة' : 'REGISTERED ACTIONS'}
            <b className="text-white">{bridgeOnline === true ? serviceTools.length : '—'}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-slate-950/70 px-2.5 py-1.5 text-slate-300">
            <ShieldCheck size={12} aria-hidden="true" className={bridgeElevated ? 'text-amber-300' : 'text-emerald-300'} />
            {isRtl ? 'الامتياز' : 'PRIVILEGE'}
            <b className="text-white">{bridgeElevated ? (isRtl ? 'مرتفع' : 'ELEVATED') : (isRtl ? 'قياسي' : 'STANDARD')}</b>
          </span>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <strong className="text-xs text-white">{isRtl ? activeService.name.ar : activeService.name.en}</strong>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            {isRtl ? activeService.purpose.ar : activeService.purpose.en}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <ServiceApps
          activeSection={activeService.legacySection}
          tools={serviceTools}
          toolStatuses={effectiveStatuses}
          lang={lang}
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
    </section>
  );
}
