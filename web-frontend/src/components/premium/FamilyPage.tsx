import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Layers3, Search } from 'lucide-react';
import type { FamilyDefinition, FamilyId, ServiceId } from '../../data/family-map';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot } from '../../lib/api';
import type { ToolStatus, ConsoleEntry } from '../../types';
import { studioForFamily, studioDisplayName } from '../../data/studio-registry';
import { SERVICE_ICONS } from '../../data/studio-icons';
import HeroSection from './HeroSection';
import ToolCard from './ToolCard';
import FamilyLiveStage from './FamilyLiveStage';
import EngineeringWorkbenchStation from './workbench/EngineeringWorkbenchStation';
import SoftwareLibraryPage from '../pages/SoftwareLibraryPage';
import StorageStudio from '../pages/StorageStudio';
import VitalityLab from '../pages/VitalityLab';
import RecoverySpotlight from './RecoverySpotlight';
import FamilyOverviewPage from '../pages/FamilyOverviewPage';
import StudioHeader from '../shell/StudioHeader';
import StudioNavigation from '../shell/StudioNavigation';

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
  /** Cross-station deep link: change family and service in one move. */
  onNavigateService?: (family: FamilyId, service: ServiceId) => void;
}

const STATION_OWNS_ACTIONS_IDS = new Set<ServiceId>([
  '04-Programs-Applications',
  '05-Duplicate-Files',
  '06-Disk-Space',
  '07-Services-Processes',
  '10-Diagnostics-Reports',
  '16-Software-Environment',
  '17-PostInstall-Setup',
]);

export default function FamilyPage({
  family, tools, lang, bridgeOnline, bridgeElevated,
  toolStatuses, onRunTool, onCancelTool,
  selectedService, onSelectService,
  selectedToolId, onSelectTool, onRetryBridge,
    systemSnapshot, consoleEntries, activeToolId, onNavigateService,
}: FamilyPageProps) {
  const [toolQuery, setToolQuery] = useState('');
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
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
  const filteredServiceTools = useMemo(() => {
    const query = toolQuery.trim().toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en');
    if (!query) return serviceTools;
    return serviceTools.filter(tool => [tool.EnglishName, tool.ArabicName, tool.Purpose]
      .some(value => value.toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en').includes(query)));
  }, [lang, serviceTools, toolQuery]);
  const visibleServiceTools = toolsExpanded || toolQuery.trim()
    ? filteredServiceTools
    : filteredServiceTools.slice(0, 4);

  if (!activeService) return null;

  const selectService = (serviceId: ServiceId) => {
    onSelectService(serviceId);
    onSelectTool(null);
    setToolQuery('');
    setToolsExpanded(false);
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
  const serviceAppActive = !selectedTool;
  const showWorkbenchStation = family.id === 'workbench' && selectedService !== null;
  const hideGenericToolRail =
    showWorkbenchStation || STATION_OWNS_ACTIONS_IDS.has(activeService.id);

  const showFamilyOverview = selectedService === null && selectedTool === null && executionTool === null;
  if (showFamilyOverview) {
    const selectOverviewService = (serviceId: ServiceId) => {
      onSelectService(serviceId);
      onSelectTool(null);
      setToolQuery('');
      setToolsExpanded(false);
    };

    // The library overview renders without an enter fade: a brand new page must
    // never paint itself invisible first. The outgoing surface still animates
    // out, so switching never leaves the stage empty.
    if (family.id === 'software') {
      return (
        <SoftwareLibraryPage
          family={family}
          tools={tools}
          lang={lang}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
          onSelectService={selectOverviewService}
          onSelectTool={onSelectTool}
        />
      );
    }

    if (family.id === 'vitality') {
      return (
        <VitalityLab
          family={family}
          tools={tools}
          lang={lang}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
          systemSnapshot={systemSnapshot}
          onSelectService={selectOverviewService}
          onSelectTool={onSelectTool}
        />
      );
    }

    // The Recovery family is the only one that can destroy user data, so its
    // overview is a measurement surface: four stations read live from the
    // bridge, and the family's own action surface stays mounted underneath.
    if (family.id === 'recovery') {
      return (
        <StorageStudio
          family={family}
          tools={tools}
          lang={lang}
          bridgeOnline={bridgeOnline}
          bridgeElevated={bridgeElevated}
          systemSnapshot={systemSnapshot}
          onSelectService={selectOverviewService}
        >
          <RecoverySpotlight
            lang={lang}
            bridgeOnline={bridgeOnline}
            systemSnapshot={systemSnapshot}
            serviceTools={familyTools}
            allTools={tools}
            onSelectTool={onSelectTool}
          />
        </StorageStudio>
      );
    }

    return (
      <FamilyOverviewPage
        family={family}
        tools={tools}
        lang={lang}
        bridgeOnline={bridgeOnline}
        bridgeElevated={bridgeElevated}
        systemSnapshot={systemSnapshot}
        onSelectService={selectOverviewService}
        onSelectTool={onSelectTool}
      />
    );
  }

  const studio = studioForFamily(family);
  const StudioIcon = studio.icon;
  const accent = `var(${family.accentVar})`;
  const serviceCount = family.services.length;
  const exposedToolCount = bridgeOnline === true ? familyTools.length : null;

  const navigationItems = family.services.map(service => {
    const count = bridgeOnline === true ? familyTools.filter(tool => tool.Category === service.id).length : null;
    const Icon = SERVICE_ICONS[service.id];
    return {
      id: service.id,
      label: isRtl ? service.name.ar : service.name.en,
      icon: <Icon size={14} aria-hidden="true" />,
      count,
      title: isRtl ? service.purpose.ar : service.purpose.en,
    };
  });

  return (
    <div className={`knoux-family-page knoux-command-center knoux-studio-workspace${serviceAppActive ? ' knoux-service-app-active' : ''}`} data-family={family.id} data-service={activeService.id} dir={isRtl ? 'rtl' : 'ltr'} style={{ ['--studio-accent' as string]: accent } as React.CSSProperties}>
      {!showWorkbenchStation && (
      <aside className="knoux-command-rail knoux-command-service-rail" aria-label={isRtl ? 'خدمات العائلة' : 'Family services'}>
        <StudioNavigation
          items={navigationItems}
          activeId={activeService.id}
          onSelect={id => selectService(id as ServiceId)}
          accent={accent}
          label={isRtl ? 'خدمات الاستوديو' : 'Studio services'}
        />
      </aside>
      )}

      <main className="knoux-command-live-column knoux-studio-surface">
        <StudioHeader
          kicker={isRtl ? studioDisplayName(studio, 'ar') : studioDisplayName(studio, 'en')}
          title={isRtl ? activeService.name.ar : activeService.name.en}
          description={isRtl ? activeService.purpose.ar : activeService.purpose.en}
          icon={<StudioIcon size={20} aria-hidden="true" />}
          accent={accent}
          metrics={[
            {
              label: isRtl ? 'الاستوديو' : 'Studio',
              value: isRtl ? studioDisplayName(studio, 'ar') : studioDisplayName(studio, 'en'),
            },
            {
              label: isRtl ? 'الخدمات' : 'Services',
              value: String(serviceCount),
            },
            {
              label: isRtl ? 'الأدوات' : 'Tools',
              value: exposedToolCount === null ? '—' : String(exposedToolCount),
            },
            {
              label: isRtl ? 'الجسر' : 'Bridge',
              value: bridgeOnline === true ? (isRtl ? 'متصل' : 'Online') : bridgeOnline === false ? (isRtl ? 'غير متصل' : 'Offline') : (isRtl ? 'فحص' : 'Checking'),
              tone: bridgeOnline === true ? 'positive' : bridgeOnline === false ? 'danger' : 'caution',
            },
          ]}
          actions={
            <button
              type="button"
              className="knoux-studio-btn"
              onClick={() => setBriefOpen(value => !value)}
              aria-expanded={briefOpen}
              title={isRtl ? 'ملخص الاستوديو' : 'Studio brief'}
            >
              <ChevronDown size={13} aria-hidden="true" style={{ transform: briefOpen ? 'rotate(180deg)' : 'none' }} />
              <span>{isRtl ? 'الموجز' : 'Brief'}</span>
            </button>
          }
        />

        <AnimatePresence initial={false}>
          {briefOpen && family.id !== 'workbench' ? (
            <motion.div
              key="studio-brief"
              className="knoux-studio-brief"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
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
            </motion.div>
          ) : null}
        </AnimatePresence>

        {showWorkbenchStation ? (
          <EngineeringWorkbenchStation
            family={family}
            activeService={activeService}
            serviceTools={serviceTools}
            familyTools={familyTools}
            lang={lang}
            bridgeOnline={bridgeOnline}
            bridgeElevated={bridgeElevated}
            toolStatuses={toolStatuses}
            onSelectService={selectService}
            onRunTool={onRunTool}
            onCancelTool={onCancelTool}
            onRetryBridge={onRetryBridge}
          />
        ) : (
          <FamilyLiveStage
            family={family}
            service={activeService}
            serviceTools={serviceTools}
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
            onRetryBridge={onRetryBridge}
  consoleEntries={consoleEntries}
  activeToolId={activeToolId}
  onNavigateService={onNavigateService}
  />
        )}
      </main>

      {!hideGenericToolRail && (
      <aside className="knoux-command-rail knoux-command-tool-rail" aria-label={isRtl ? 'إجراءات الخدمة' : 'Service actions'}>
        <header className="knoux-command-rail-header">
          <span>{isRtl ? 'الإجراءات' : 'ACTIONS'}</span>
          <strong>{isRtl ? activeService.name.ar : activeService.name.en}</strong>
          <small>{bridgeOnline === true ? serviceTools.length : '—'}</small>
        </header>

        <div className="knoux-command-selected-service">
          <span>{isRtl ? 'الخدمة المحددة' : 'SELECTED SERVICE'}</span>
          <strong>{isRtl ? activeService.name.ar : activeService.name.en}</strong>
          <p>{isRtl ? activeService.purpose.ar : activeService.purpose.en}</p>
        </div>

        {bridgeOnline === true && serviceTools.length > 0 && (
          <div className="knoux-command-tool-controls">
            <label className="knoux-command-tool-search">
              <Search size={14} aria-hidden="true" />
              <input
                value={toolQuery}
                onChange={event => setToolQuery(event.target.value)}
                placeholder={isRtl ? 'ابحث داخل إجراءات الخدمة' : 'Search service actions'}
                aria-label={isRtl ? 'بحث إجراءات الخدمة' : 'Search service actions'}
              />
            </label>
            <button
              type="button"
              className="knoux-command-tool-drawer"
              data-expanded={toolsExpanded}
              onClick={() => setToolsExpanded(value => !value)}
              aria-expanded={toolsExpanded}
            >
              <Layers3 size={14} aria-hidden="true" />
              <span>{toolsExpanded
                ? (isRtl ? 'عرض الإجراءات الأساسية' : 'Show primary actions')
                : (isRtl ? `عرض كل الإجراءات (${serviceTools.length})` : `Show all actions (${serviceTools.length})`)}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="knoux-command-rail-scroll knoux-command-tool-scroll">
          {bridgeOnline === false ? (
            <div className="knoux-tool-empty-state">
              <p>{isRtl ? 'الجسر غير متصل، لذلك لا يمكن تحميل الإجراءات الحالية.' : 'Bridge offline, so the current actions cannot be loaded.'}</p>
              <button type="button" className="knoux-btn knoux-btn-secondary" onClick={onRetryBridge}>
                {isRtl ? 'إعادة المحاولة' : 'Retry connection'}
              </button>
            </div>
          ) : serviceTools.length === 0 ? (
            <div className="knoux-tool-empty-state">
              <p>{bridgeOnline === null
                ? (isRtl ? 'جارٍ تحميل الإجراءات...' : 'Loading actions...')
                : (isRtl ? 'لا توجد إجراءات محمّلة لهذه الخدمة.' : 'No loaded actions are available for this service.')}
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
                {visibleServiceTools.map(tool => (
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
                {filteredServiceTools.length === 0 && (
                  <div className="knoux-tool-empty-state">
                    <p>{isRtl ? 'لا توجد إجراءات تطابق البحث.' : 'No actions match this search.'}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </aside>
      )}
    </div>
  );
}
