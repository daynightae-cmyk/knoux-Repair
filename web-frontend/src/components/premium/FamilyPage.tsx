import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot } from '../../lib/api';
import type { ToolStatus, ConsoleEntry } from '../../types';
import HeroSection from './HeroSection';
import ServiceCard from './ServiceCard';
import ToolCard from './ToolCard';
import FamilyLiveStage from './FamilyLiveStage';

interface FamilyPageProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatuses: Record<string, ToolStatus>;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  onCancelTool: () => void;
  selectedService: ServiceId | null;
  onSelectService: (id: ServiceId | null) => void;
  selectedToolId: string | null;
  onSelectTool: (id: string | null) => void;
  onRetryBridge: () => void;
  systemSnapshot?: SystemSnapshot | null;
  consoleEntries?: ConsoleEntry[];
  activeToolId?: string | null;
}

export default function FamilyPage({
  family, tools, lang, bridgeOnline, bridgeElevated,
  toolStatuses, onRunTool, onCancelTool,
  selectedService, onSelectService,
  selectedToolId, onSelectTool, onRetryBridge,
  systemSnapshot, consoleEntries, activeToolId,
}: FamilyPageProps) {
  const familyServiceIds = useMemo(() => new Set(family.services.map(service => service.id)), [family.services]);
  const familyTools = useMemo(
    () => tools.filter(tool => familyServiceIds.has(tool.Category as ServiceId)),
    [tools, familyServiceIds]
  );

  const selectedTool = useMemo(
    () => selectedToolId ? familyTools.find(tool => tool.ToolId === selectedToolId) ?? null : null,
    [selectedToolId, familyTools]
  );

  const executionTool = useMemo(
    () => activeToolId ? familyTools.find(tool => tool.ToolId === activeToolId) ?? null : null,
    [activeToolId, familyTools]
  );

  const requestedService = family.services.find(service => service.id === selectedService) ?? family.services[0];
  const activeService = selectedTool
    ? family.services.find(service => service.id === selectedTool.Category) ?? requestedService
    : requestedService;

  const serviceTools = useMemo(
    () => activeService ? familyTools.filter(tool => tool.Category === activeService.id) : [],
    [familyTools, activeService]
  );

  if (!activeService) return null;

  const selectService = (serviceId: ServiceId) => {
    onSelectService(serviceId);
    onSelectTool(null);
  };

  const selectTool = (toolId: string) => {
    onSelectTool(toolId);
  };

  const selectedToolStatus = selectedTool
    ? toolStatuses[selectedTool.ToolId] ?? 'idle'
    : 'idle';
  const executionToolStatus = executionTool
    ? toolStatuses[executionTool.ToolId] ?? 'idle'
    : 'idle';

  const isRtl = lang === 'ar';

  return (
    <div className="knoux-family-page knoux-command-center" dir={isRtl ? 'rtl' : 'ltr'}>
      <aside className="knoux-command-rail knoux-command-service-rail" aria-label={isRtl ? 'خدمات العائلة' : 'Family services'}>
        <header className="knoux-command-rail-header">
          <span>{isRtl ? 'الخدمات' : 'SERVICES'}</span>
          <strong>{isRtl ? family.name.ar : family.name.en}</strong>
          <small>{family.services.length}</small>
        </header>

        <div className="knoux-command-rail-scroll">
          {family.services.map(service => {
            const count = familyTools.filter(tool => tool.Category === service.id).length;
            return (
              <ServiceCard
                key={service.id}
                service={service}
                toolCount={bridgeOnline === true ? count : null}
                active={activeService.id === service.id}
                onClick={() => selectService(service.id)}
                lang={lang}
                accentColor={`var(${family.accentVar})`}
              />
            );
          })}
        </div>
      </aside>

      <main className="knoux-command-live-column">
        <HeroSection
          family={family}
          service={activeService}
          selectedTool={selectedTool}
          executionTool={executionTool}
          familyToolCount={familyTools.length}
          serviceToolCount={serviceTools.length}
          lang={lang}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
          selectedToolStatus={selectedToolStatus}
          executionToolStatus={executionToolStatus}
          systemSnapshot={systemSnapshot}
          onClearTool={() => onSelectTool(null)}
        />

        <FamilyLiveStage
          family={family}
          service={activeService}
          selectedTool={selectedTool}
          executionTool={executionTool}
          serviceToolCount={serviceTools.length}
          lang={lang}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
          toolStatuses={toolStatuses}
          onRunTool={onRunTool}
          onCancelTool={onCancelTool}
          onClearTool={() => onSelectTool(null)}
          consoleEntries={consoleEntries}
          activeToolId={activeToolId}
        />
      </main>

      <aside className="knoux-command-rail knoux-command-tool-rail" aria-label={isRtl ? 'أدوات الخدمة' : 'Service tools'}>
        <header className="knoux-command-rail-header">
          <span>{isRtl ? 'الأدوات' : 'TOOLS'}</span>
          <strong>{isRtl ? activeService.name.ar : activeService.name.en}</strong>
          <small>{bridgeOnline === true ? serviceTools.length : '—'}</small>
        </header>

        <div className="knoux-command-selected-service">
          <span>{isRtl ? 'الخدمة المحددة' : 'SELECTED SERVICE'}</span>
          <strong>{isRtl ? activeService.name.ar : activeService.name.en}</strong>
          <p>{isRtl ? activeService.purpose.ar : activeService.purpose.en}</p>
        </div>

        <div className="knoux-command-rail-scroll knoux-command-tool-scroll">
          {bridgeOnline === false ? (
            <div className="knoux-tool-empty-state">
              <p>{isRtl ? 'الجسر غير متصل، لذلك لا يمكن تحميل عقود الأدوات الحالية.' : 'Bridge offline, so the current tool contracts cannot be loaded.'}</p>
              <button type="button" className="knoux-btn knoux-btn-secondary" onClick={onRetryBridge}>
                {isRtl ? 'إعادة المحاولة' : 'Retry connection'}
              </button>
            </div>
          ) : serviceTools.length === 0 ? (
            <div className="knoux-tool-empty-state">
              <p>{bridgeOnline === null
                ? (isRtl ? 'جارٍ تحميل عقود الأدوات...' : 'Loading tool contracts...')
                : (isRtl ? 'لا توجد أدوات محمّلة لهذه الخدمة.' : 'No loaded tools are available for this service.')}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeService.id}
                className="knoux-command-tool-list"
                initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRtl ? 10 : -10 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {serviceTools.map(tool => (
                  <ToolCard
                    key={tool.ToolId}
                    tool={tool}
                    serviceIcon={activeService.icon}
                    active={selectedTool?.ToolId === tool.ToolId}
                    status={toolStatuses[tool.ToolId] ?? 'idle'}
                    bridgeOnline={bridgeOnline}
                    onClick={() => selectTool(tool.ToolId)}
                    lang={lang}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </aside>
    </div>
  );
}
