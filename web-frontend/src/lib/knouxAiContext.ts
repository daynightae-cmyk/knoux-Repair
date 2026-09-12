import type { BridgeTool } from './api';
import type { FamilyDefinition, FamilyId, ServiceDefinition, ServiceId } from '../data/family-map';
import { FAMILIES } from '../data/family-map';
import type { ConsoleEntry, ToolStatus } from '../types';

export interface KnouxAiEvidenceSummary {
  source: 'local-tool' | 'local-bridge' | 'local-report' | 'user';
  type: string;
  summary: string;
}

export interface KnouxAiToolContext {
  id: string;
  name: string;
  riskLevel: string;
  requiresAdmin: boolean;
  requiresRestart: boolean;
  requiresConfirmation: boolean;
  analyzeOnlySupported: boolean;
  whatIfSupported: boolean;
}

export interface KnouxAiContextEnvelope {
  familyId: FamilyId | null;
  familyName: string | null;
  serviceId: ServiceId | null;
  serviceName: string | null;
  tool: KnouxAiToolContext | null;
  runtime: {
    bridgeOnline: boolean | null;
    bridgeElevated: boolean;
    toolStatus: ToolStatus | null;
  };
  evidence: KnouxAiEvidenceSummary[];
}

export interface BuildKnouxAiContextInput {
  family?: FamilyDefinition | FamilyId | null;
  service?: ServiceDefinition | ServiceId | null;
  tool?: BridgeTool | null;
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatus?: ToolStatus | null;
  evidence?: KnouxAiEvidenceSummary[];
  consoleEntries?: ConsoleEntry[];
  lang?: 'en' | 'ar';
}

function resolveFamily(value: BuildKnouxAiContextInput['family']): FamilyDefinition | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  return FAMILIES.find(family => family.id === value) ?? null;
}

function resolveService(
  family: FamilyDefinition | null,
  value: BuildKnouxAiContextInput['service'],
): ServiceDefinition | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  if (family) return family.services.find(service => service.id === value) ?? null;
  for (const candidate of FAMILIES) {
    const service = candidate.services.find(item => item.id === value);
    if (service) return service;
  }
  return null;
}

function boundedConsoleEvidence(entries: ConsoleEntry[] | undefined): KnouxAiEvidenceSummary[] {
  if (!entries?.length) return [];

  const safeLines = entries
    .slice(-12)
    .map(entry => entry.text.trim())
    .filter(Boolean)
    .map(text => text.slice(0, 320));

  if (!safeLines.length) return [];

  return [{
    source: 'local-tool',
    type: 'recent-console-summary',
    summary: safeLines.join('\n').slice(0, 3000),
  }];
}

export function buildKnouxAiContext(input: BuildKnouxAiContextInput): KnouxAiContextEnvelope {
  const family = resolveFamily(input.family);
  const service = resolveService(family, input.service);
  const lang = input.lang === 'ar' ? 'ar' : 'en';
  const tool = input.tool ?? null;

  const explicitEvidence = (input.evidence ?? [])
    .filter(item => item.summary.trim().length > 0)
    .slice(0, 8)
    .map(item => ({ ...item, summary: item.summary.slice(0, 1200) }));

  const evidence = [...explicitEvidence, ...boundedConsoleEvidence(input.consoleEntries)].slice(0, 8);

  return {
    familyId: family?.id ?? null,
    familyName: family ? family.name[lang] : null,
    serviceId: service?.id ?? null,
    serviceName: service ? service.name[lang] : null,
    tool: tool ? {
      id: tool.ToolId,
      name: lang === 'ar' ? tool.ArabicName : tool.EnglishName,
      riskLevel: tool.RiskLevel,
      requiresAdmin: tool.RequiresAdmin,
      requiresRestart: tool.RequiresRestart,
      requiresConfirmation: tool.RequiresConfirmation,
      analyzeOnlySupported: tool.AnalyzeOnlySupported,
      whatIfSupported: tool.WhatIfSupported,
    } : null,
    runtime: {
      bridgeOnline: input.bridgeOnline,
      bridgeElevated: input.bridgeElevated,
      toolStatus: input.toolStatus ?? null,
    },
    evidence,
  };
}
