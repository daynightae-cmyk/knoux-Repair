/**
 * KNOUX Repair — StationToolRegistry (Phase 00 foundation).
 *
 * The manifest is the authoritative tool registry. Every registered tool is
 * addressable by ToolId with exactly one Category. Counts always come from
 * the live runtime registry, never from hard-coded numbers.
 */
import { api, BridgeError, type BridgeTool, type RegistryCategory } from '../../../lib/api';

export interface RegistrySnapshot {
  tools: BridgeTool[];
  byCategory: Record<string, BridgeTool[]>;
  categories: RegistryCategory[];
  total: number;
}

export function snapshotFromTools(tools: BridgeTool[]): RegistrySnapshot {
  const byCategory: Record<string, BridgeTool[]> = {};
  for (const tool of tools) (byCategory[tool.Category] ||= []).push(tool);
  const categories: RegistryCategory[] = Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, items]) => ({ id, tools: items.length, available: items.length }));
  return { tools, byCategory, categories, total: tools.length };
}

export async function loadRegistrySnapshot(): Promise<RegistrySnapshot> {
  const [{ tools }, { categories }] = await Promise.all([api.tools(), api.categories()]);
  const byCategory: Record<string, BridgeTool[]> = {};
  for (const tool of tools) (byCategory[tool.Category] ||= []).push(tool);
  // Category counts reported by the bridge win; fall back to local grouping.
  if (categories.length > 0) {
    for (const category of categories) {
      if (!byCategory[category.id]) byCategory[category.id] = [];
    }
  }
  return { tools, byCategory, categories, total: tools.length };
}

export async function loadCategoryTools(categoryId: string): Promise<BridgeTool[]> {
  const { tools } = await api.categoryTools(categoryId);
  return tools;
}

export async function loadToolMetadata(toolId: string): Promise<BridgeTool> {
  const { tool } = await api.toolMetadata(toolId);
  return tool;
}

export function isRegistryUnavailable(error: unknown): boolean {
  return error instanceof BridgeError && (error.code === 'BRIDGE_UNREACHABLE' || error.status === 0);
}
