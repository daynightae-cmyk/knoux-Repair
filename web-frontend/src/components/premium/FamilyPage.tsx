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
  const activeServiceId = selectedService ?? family.services[0]?.id ?? null;
  const activeService = family.services.find(service => service.id === activeServiceId) ?? family.services[0];

  const familyServiceIds = useMemo(() => new Set(family.services.map(service => service.id)), [family.services]);
  const familyTools = useMemo(
    () => tools.filter(tool => familyServiceIds.has(tool.Category as ServiceId)),
    [tools, familyServiceIds]
  );
  const serviceTools = useMemo(
    () => activeServiceId ? familyTools.filter(tool => tool.Category === activeServiceId) : [],
    [familyTools, activeServiceId]
  );
  const selectedTool = useMemo(
    () => selectedToolId ? familyTools.find(tool => tool.ToolId === selectedToolId) ?? null : null,
    [selectedToolId, familyTools]
  );
  const selectedToolService = useMemo(
    () => selectedTool
      ? family.services.find(service => service.id === selectedTool.Category) ?? activeService
      : activeService,
    [selectedTool, family.services, activeService]
  );

  if (!activeService || !selectedToolService) return null;

  const selectService = (serviceId: ServiceId) => {
    onSelectService(serviceId);
    onSelectTool(null);
  };

  return (
    <div className="knoux-family-page">
      <HeroSection
        family={family}
        totalTools={familyTools.length}
        lang={lang}
        systemSnapshot={systemSnapshot}
        onExplore={() => {
          const el = document.getElementById('family-services');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      <FamilyLiveStage
        family={family}
        service={selectedTool ? selectedToolService : activeService}
        selectedTool={selectedTool}
        familyTools={familyTools}
        serviceTools={selectedTool ? familyTools.filter(tool => tool.Category === selectedToolService.id) : serviceTools}
        lang={lang}
        bridgeOnline={bridgeOnline}
        bridgeElevated={bridgeElevated}
        toolStatuses={toolStatuses}
        onRunTool={onRunTool}
        onCancelTool={onCancelTool}
        onClearTool={() => onSelectTool(null)}
        onSelectService={selectService}
        consoleEntries={consoleEntries}
        activeToolId={activeToolId}
      />

      <section id="family-services" className="knoux-family-catalog" aria-label={lang === 'ar' ? 'الخدمات والأدوات' : 'Services and tools'}>
        <div className="knoux-section-heading">
          <div>
            <span>{lang === 'ar' ? 'الخدمات' : 'SERVICE FAMILIES'}</span>
            <h2>{lang === 'ar' ? 'اختر الخدمة، ثم الأداة' : 'Choose a service, then a tool'}</h2>
          </div>
          <p>
            {lang === 'ar'
              ? 'يظهر محتوى خدمة واحدة فقط في كل مرة. اختيار الأداة يحول منصة العمل الحية بالأعلى إلى واجهتها الفعلية.'
              : 'Only one service is expanded at a time. Selecting a tool transforms the live stage above into its real workspace.'}
          </p>
        </div>

        <div className="knoux-service-grid">
          {family.services.map(service => {
            const count = tools.filter(tool => tool.Category === service.id).length;
            return (
              <ServiceCard
                key={service.id}
                service={service}
                toolCount={count}
                active={activeServiceId === service.id}
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
              <span className="knoux-active-service-kicker">{lang === 'ar' ? 'الخدمة النشطة' : 'ACTIVE SERVICE'}</span>
              <h3>{lang === 'ar' ? activeService.name.ar : activeService.name.en}</h3>
              <p>{lang === 'ar' ? activeService.purpose.ar : activeService.purpose.en}</p>
            </div>
            <div className="knoux-active-service-count">
              <strong>{serviceTools.length}</strong>
              <span>{lang === 'ar' ? 'أداة' : 'tools'}</span>
            </div>
          </div>

          {bridgeOnline === false ? (
            <div className="knoux-tool-empty-state">
              <p>{lang === 'ar' ? 'الجسر غير متصل، لذلك لا يمكن تحميل عقود الأدوات الحالية.' : 'Bridge offline, so the current tool contracts cannot be loaded.'}</p>
              <button type="button" className="knoux-btn knoux-btn-secondary" onClick={onRetryBridge}>
                {lang === 'ar' ? 'إعادة المحاولة' : 'Retry Connection'}
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
                initial={{ opacity: 0, x: lang === 'ar' ? -18 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: lang === 'ar' ? 18 : -18 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {serviceTools.map(tool => (
                  <ToolCard
                    key={tool.ToolId}
                    tool={tool}
                    serviceIcon={activeService.icon}
                    active={selectedToolId === tool.ToolId}
                    status={toolStatuses[tool.ToolId] ?? 'idle'}
                    bridgeOnline={bridgeOnline}
                    onClick={() => {
                      onSelectTool(tool.ToolId);
                      const stage = document.querySelector('.knoux-live-stage');
                      if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    lang={lang}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>
    </div>
  );
}
