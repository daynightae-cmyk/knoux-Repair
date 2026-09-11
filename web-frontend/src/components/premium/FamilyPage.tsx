import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot } from '../../lib/api';
import type { ToolStatus, ConsoleEntry } from '../../types';
import HeroSection from './HeroSection';
import ServiceCard from './ServiceCard';
import ToolRow from './ToolRow';
import ToolWorkspace from './ToolWorkspace';

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
  // Default to first service if none selected
  const activeServiceId = selectedService ?? family.services[0]?.id ?? null;
  const activeService = family.services.find(s => s.id === activeServiceId) ?? family.services[0];

  // Tools for this family (all services within family)
  const familyServiceIds = useMemo(() => new Set(family.services.map(s => s.id)), [family]);
  const familyTools = useMemo(
    () => tools.filter(t => familyServiceIds.has(t.Category as ServiceId)),
    [tools, familyServiceIds]
  );

  // Tools for selected service
  const serviceTools = useMemo(
    () => familyTools.filter(t => t.Category === activeServiceId),
    [familyTools, activeServiceId]
  );

  // Selected tool object
  const selectedTool = useMemo(
    () => selectedToolId ? serviceTools.find(t => t.ToolId === selectedToolId) ?? null : null,
    [selectedToolId, serviceTools]
  );

  // If a tool is selected, render the dedicated Universal Tool Workspace matching P0-10
  if (selectedTool && activeService) {
    return (
      <ToolWorkspace
        tool={selectedTool}
        family={family}
        service={activeService}
        lang={lang}
        bridgeElevated={bridgeElevated}
        toolStatus={toolStatuses[selectedTool.ToolId] ?? 'idle'}
        onRun={(mode) => onRunTool(selectedTool, mode)}
        onCancel={onCancelTool}
        consoleEntries={consoleEntries}
        activeToolId={activeToolId}
        onBack={() => onSelectTool(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <HeroSection family={family} totalTools={familyTools.length} lang={lang} systemSnapshot={systemSnapshot} />

      {/* Service selector */}
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {family.services.map(service => {
          const count = tools.filter(t => t.Category === service.id).length;
          return (
            <ServiceCard
              key={service.id}
              service={service}
              toolCount={count}
              active={activeServiceId === service.id}
              onClick={() => {
                onSelectService(service.id);
                onSelectTool(null);
              }}
              lang={lang}
              accentColor={`var(${family.accentVar})`}
            />
          );
        })}
      </div>

      {/* Tool catalog */}
      <div className="knoux-glass" style={{ padding: 0 }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--knoux-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--knoux-text-secondary)' }}>
            {activeService ? (lang === 'ar' ? activeService.name.ar : activeService.name.en) : ''}
          </h3>
          <span className="text-xs" style={{ color: 'var(--knoux-text-faint)' }}>
            {serviceTools.length} {lang === 'ar' ? 'أداة' : 'tools'}
          </span>
        </div>

        {bridgeOnline === false ? (
          <div className="p-8 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--knoux-text-muted)' }}>
              {lang === 'ar' ? 'الجسر غير متصل — لا يمكن تحميل الأدوات' : 'Bridge offline — cannot load tools'}
            </p>
            <button type="button" className="knoux-btn knoux-btn-secondary" onClick={onRetryBridge}>
              {lang === 'ar' ? 'إعادة المحاولة' : 'Retry Connection'}
            </button>
          </div>
        ) : serviceTools.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--knoux-text-muted)' }}>
              {bridgeOnline === null
                ? (lang === 'ar' ? 'جارٍ التحميل...' : 'Loading tools...')
                : (lang === 'ar' ? 'لا توجد أدوات متاحة لهذه الخدمة' : 'No tools available for this service')}
            </p>
          </div>
        ) : (
          <div>
            {serviceTools.map(tool => (
              <ToolRow
                key={tool.ToolId}
                tool={tool}
                active={selectedToolId === tool.ToolId}
                status={toolStatuses[tool.ToolId] ?? 'idle'}
                onClick={() => onSelectTool(selectedToolId === tool.ToolId ? null : tool.ToolId)}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expanded tool workspace */}
      <AnimatePresence>
        {selectedTool && activeService && (
          <motion.div
            key={selectedTool.ToolId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ToolWorkspace
              tool={selectedTool}
              family={family}
              service={activeService}
              lang={lang}
              bridgeElevated={bridgeElevated}
              toolStatus={toolStatuses[selectedTool.ToolId] ?? 'idle'}
              onRun={(mode) => onRunTool(selectedTool, mode)}
              onCancel={onCancelTool}
              consoleEntries={consoleEntries}
              activeToolId={activeToolId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
