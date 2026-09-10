import type { BridgeTool, ProjectSonarPreview, ProjectSonarFinding, SonarSeverity } from '../../../lib/api';
import type { Lang } from '../../../types';

export type SonarCondition = 'healthy' | 'attention' | 'critical' | 'unscanned';

export interface SonarSummary {
  workspace: string;
  fileCount: number;
  isGitRepo: boolean;
  gitBranch: string | null;
  languages: string[];
  packageName: string | null;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalFindings: number;
  condition: SonarCondition;
}

export const SEVERITIES: SonarSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function severityLabel(severity: SonarSeverity, lang: Lang): string {
  const labels: Record<SonarSeverity, [string, string]> = {
    CRITICAL: ['حرج', 'Critical'],
    HIGH: ['مرتفع', 'High'],
    MEDIUM: ['متوسط', 'Medium'],
    LOW: ['منخفض', 'Low'],
  };
  return labels[severity] ? labels[severity][lang === 'ar' ? 0 : 1] : severity;
}

export function deriveSonarCondition(preview: ProjectSonarPreview | null): SonarCondition {
  if (!preview) return 'unscanned';

  const crit = preview.SeverityCounts?.Critical ?? 0;
  const high = preview.SeverityCounts?.High ?? 0;
  const med = preview.SeverityCounts?.Medium ?? 0;

  if (crit > 0) return 'critical';
  if (high > 0 || med > 0) return 'attention';
  return 'healthy';
}

export function summarizeSonar(preview: ProjectSonarPreview | null, workspace: string): SonarSummary {
  if (!preview) {
    return {
      workspace: workspace || '',
      fileCount: 0,
      isGitRepo: false,
      gitBranch: null,
      languages: [],
      packageName: null,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalFindings: 0,
      condition: 'unscanned',
    };
  }

  const criticalCount = preview.SeverityCounts?.Critical ?? 0;
  const highCount = preview.SeverityCounts?.High ?? 0;
  const mediumCount = preview.SeverityCounts?.Medium ?? 0;
  const lowCount = preview.SeverityCounts?.Low ?? 0;
  const totalFindings = preview.Findings?.length ?? (criticalCount + highCount + mediumCount + lowCount);

  const condition = deriveSonarCondition(preview);

  return {
    workspace: workspace || preview.Workspace,
    fileCount: preview.Snapshot?.FileCount ?? 0,
    isGitRepo: Boolean(preview.Snapshot?.Git?.Repository),
    gitBranch: preview.Snapshot?.Git?.Branch ?? null,
    languages: preview.Snapshot?.Languages ?? [],
    packageName: preview.Snapshot?.PackageName ?? null,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    totalFindings,
    condition,
  };
}

export function filterFindings(
  findings: ProjectSonarFinding[] = [],
  filter: 'ALL' | SonarSeverity = 'ALL',
  query: string = ''
): ProjectSonarFinding[] {
  const q = query.trim().toLowerCase();
  return findings.filter(f => {
    if (filter !== 'ALL' && f.Severity !== filter) return false;
    if (!q) return true;
    return (
      (f.TitleEn && f.TitleEn.toLowerCase().includes(q)) ||
      (f.TitleAr && f.TitleAr.toLowerCase().includes(q)) ||
      (f.Evidence && f.Evidence.toLowerCase().includes(q)) ||
      (f.Code && f.Code.toLowerCase().includes(q))
    );
  });
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return tools.filter(
    (tool) => tool.Category === '18-Project-Sonar' || tool.ToolId.startsWith('SN')
  );
}
