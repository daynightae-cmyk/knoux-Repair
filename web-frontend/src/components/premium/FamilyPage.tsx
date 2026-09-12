/**
 * KNOUX Repair — FamilyPage (command-center adapter).
 *
 * Presentation moved to CommandCenter: services rail + persistent live
 * workspace + tools rail + context dock. This module only resolves
 * family → services → tools from the canonical map and loaded contracts.
 */
import { useMemo } from 'react';
import type { FamilyDefinition, ServiceId } from '../../data/family-map';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot } from '../../lib/api';
import type { ToolStatus, ConsoleEntry } from '../../types';
import CommandCenter from './CommandCenter';
import type { RunMeta } from './CommandCenter';

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
  runningTool?: BridgeTool | null;
  lastRunToolId?: string | null;
  runMeta?: Record<string, RunMeta>;
}

export default function FamilyPage({
  family, tools, lang, bridgeOnline, bridgeElevated,
  toolStatuses, onRunTool, onCancelTool,
  selectedService, onSelectService,
  selectedToolId, onSelectTool, onRetryBridge,
  systemSnapshot, consoleEntries, activeToolId,
  runningTool, lastRunToolId, runMeta,
}: FamilyPageProps) {
  const familyServiceIds = useMemo(() => new Set(family.services.map(service => service.id)), [family.services]);
  const familyTools = useMemo(
    () => tools.filter(tool => familyServiceIds.has(tool.Category as ServiceId)),
    [tools, familyServiceIds]
  );

  const activeService = (selectedService && family.services.find(s => s.id === selectedService)) || family.services[0];
  const selectedTool = useMemo(
    () => selectedToolId ? familyTools.find(tool => tool.ToolId === selectedToolId) ?? null : null,
    [selectedToolId, familyTools]
  );

  // If the running tool belongs to another family, the workspace pins to it
  // only inside its own family view; cross-family runs surface via Action Center.
  const familyRunningTool = runningTool && familyServiceIds.has(runningTool.Category as ServiceId) ? runningTool : null;
  void activeToolId;

  if (!activeService) return null;

  const selectService = (serviceId: ServiceId) => {
    onSelectService(serviceId);
    onSelectTool(null);
  };

  return (
    <CommandCenter
      family={family}
      familyTools={familyTools}
      lang={lang}
      bridgeOnline={bridgeOnline}
      bridgeElevated={bridgeElevated}
      toolStatuses={toolStatuses}
      activeService={activeService}
      onSelectService={selectService}
      selectedTool={selectedTool}
      onSelectTool={onSelectTool}
      runningTool={familyRunningTool}
      lastRunToolId={lastRunToolId ?? null}
      runMeta={runMeta ?? {}}
      consoleEntries={consoleEntries ?? []}
      onRunTool={onRunTool}
      onCancelTool={onCancelTool}
      onRetryBridge={onRetryBridge}
      systemSnapshot={systemSnapshot ?? null}
    />
  );
}
