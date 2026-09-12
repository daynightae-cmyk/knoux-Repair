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

function scrollTo(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
    scrollTo('family-tool-workspace');
  };

  const selectedToolStatus = selectedTool
    ? toolStatuses[selectedTool.ToolId] ?? 'idle'
    : 'idle';

  return (
    <div className="knoux-family-page">
      <HeroSection
        family={family}
        service={activeService}
        selectedTool={selectedTool}
        familyToolCount={familyTools.length}
        serviceToolCount={serviceTools.length}
        lang={lang}
        bridgeOnline={bridgeOnline}
        bridgeElevated={bridgeElevated}
        toolStatus={selectedToolStatus}
        systemSnapshot={systemSnapshot}
        onExplore={() => scrollTo('family-services')}
        onOpenWorkspace={() => scrollTo('family-tool-workspace')}
        onClearTool={() => onSelectTool(null)}
        onSelectService={selectService}
      />

      <section id="family-services" className="knoux-family-catalog" aria-label={lang === 'ar' ? 'الخدمات والأدوات' : 'Services and tools'}>
        <div className="knoux-section-heading">
          <div>
            <span>{lang === 'ar' ? 'الخدمات' : 'SERVICES'}</span>
            <h2>{lang === 'ar' ? 'اختر الخدمة، ثم الأداة' : 'Choose a service, then a tool'}</h2>
          </div>
          <p>
            {lang === 'ar'
              ? 'خدمة واحدة نشطة في كل مرة. المعاينة بالأعلى ومساحة العمل بالأسفل تتبعان اختيارك.'
              : 'One service stays active at a time. The preview above and action workspace below follow your selection.'}
          </p>
        </div>

        <div className="knoux-service-grid">
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

        <div className="knoux-active-service-panel">
          <div className="knoux-active-service-head">
            <div>
              <span className="knoux-active-service-kicker">{lang === 'ar' ? 'الخدمة المحددة' : 'SELECTED SERVICE'}</span>
              <h3>{lang === 'ar' ? activeService.name.ar : activeService.name.en}</h3>
              <p>{lang === 'ar' ? activeService.purpose.ar : activeService.purpose.en}</p>
            </div>
            <div className="knoux-active-service-count">
              <strong>{bridgeOnline === true ? serviceTools.length : '—'}</strong>
              <span>{lang === 'ar' ? 'أداة محمّلة' : 'loaded tools'}</span>
            </div>
          </div>

          {bridgeOnline === false ? (
            <div className="knoux-tool-empty-state">
              <p>{lang === 'ar' ? 'الجسر غير متصل، لذلك لا يمكن تحميل عقود الأدوات الحالية.' : 'Bridge offline, so the current tool contracts cannot be loaded.'}</p>
              <button type="button" className="knoux-btn knoux-btn-secondary" onClick={onRetryBridge}>
                {lang === 'ar' ? 'إعادة المحاولة' : 'Retry connection'}
              </button>
            </div>
          ) : serviceTools.length === 0 ? (
            <div className="knoux-tool-empty-state">
              <p>{bridgeOnline === null
                ? (lang === 'ar' ? 'جارٍ تحميل عقود الأدوات...' : 'Loading tool contracts...')
                : (lang === 'ar' ? 'لا توجد أدوات محمّلة لهذه الخدمة.' : 'No loaded tools are available for this service.')}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeService.id}
                className="knoux-tool-card-grid"
                initial={{ opacity: 0, x: lang === 'ar' ? -14 : 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: lang === 'ar' ? 14 : -14 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
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
      </section>

      <FamilyLiveStage
        family={family}
        service={activeService}
        selectedTool={selectedTool}
        serviceToolCount={serviceTools.length}
        lang={lang}
        bridgeOnline={bridgeOnline}
        bridgeElevated={bridgeElevated}
        toolStatuses={toolStatuses}
        onRunTool={onRunTool}
        onCancelTool={onCancelTool}
        onClearTool={() => onSelectTool(null)}
        onChooseTool={() => scrollTo('family-services')}
        consoleEntries={consoleEntries}
        activeToolId={activeToolId}
      />
    </div>
  );
}
