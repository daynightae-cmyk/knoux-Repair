/**
 * Station 01 — System Maintenance domain model (Device Health / Health Studio).
 *
 * Everything here derives from real evidence: the 10 registered
 * 01-System-Maintenance tools, their manifest contracts, and structured run
 * results. Nothing is invented. Health is categorical, never a score.
 */
import type { BridgeRun, BridgeTool, ExecutionMode, KnouxRunResult } from '../../../lib/api';

export const STATION01_CATEGORY = '01-System-Maintenance';

export const STATION01_TOOL_IDS = ['SM01', 'SM02', 'SM03', 'SM04', 'SM05', 'SM06', 'SM07', 'SM08', 'SM09', 'SM10'] as const;

export type Station01ToolId = (typeof STATION01_TOOL_IDS)[number];

export type PipelinePhaseId = 'files' | 'store' | 'image' | 'disk' | 'servicing';

export interface PipelinePhase {
  id: PipelinePhaseId;
  toolIds: Station01ToolId[];
  verifyToolIds: Station01ToolId[];
  repairToolIds: Station01ToolId[];
}

export const PIPELINE_PHASES: PipelinePhase[] = [
  { id: 'files', toolIds: ['SM01', 'SM02'], verifyToolIds: ['SM01'], repairToolIds: ['SM02'] },
  { id: 'store', toolIds: ['SM03', 'SM04', 'SM08'], verifyToolIds: ['SM03', 'SM04', 'SM08'], repairToolIds: [] },
  { id: 'image', toolIds: ['SM05'], verifyToolIds: [], repairToolIds: ['SM05'] },
  { id: 'disk', toolIds: ['SM06', 'SM07'], verifyToolIds: ['SM06'], repairToolIds: ['SM07'] },
  { id: 'servicing', toolIds: ['SM09', 'SM10'], verifyToolIds: ['SM10'], repairToolIds: ['SM09'] },
];

export type PhaseState =
  | 'NOT_CHECKED'
  | 'CHECKING'
  | 'PASSED'
  | 'WARNING'
  | 'FAILED'
  | 'INCONCLUSIVE'
  | 'REPAIR_AVAILABLE'
  | 'REPAIR_COMPLETED'
  | 'RESTART_REQUIRED';

export type HealthState =
  | 'NOT_SCANNED'
  | 'CHECKING'
  | 'HEALTHY'
  | 'ATTENTION'
  | 'REPAIR_RECOMMENDED'
  | 'REPAIR_IN_PROGRESS'
  | 'RESTART_REQUIRED'
  | 'INCONCLUSIVE'
  | 'PERMISSION_REQUIRED'
  | 'ENGINE_OFFLINE';

export interface ToolEvidence {
  toolId: string;
  mode: ExecutionMode;
  status: string;
  verificationResult: string;
  errorMessage: string;
  reportPath: string;
  finishedAt: string;
  changedSystem: boolean;
  restartNeeded: boolean;
}

export type EvidenceMap = Record<string, ToolEvidence>;

function field(result: KnouxRunResult | null | undefined, lower: string, upper: string): string {
  if (!result) return '';
  const record = result as unknown as Record<string, unknown>;
  const value = record[lower] ?? record[upper];
  return value === null || value === undefined ? '' : String(value);
}

function boolField(result: KnouxRunResult | null | undefined, lower: string, upper: string): boolean {
  if (!result) return false;
  const record = result as unknown as Record<string, unknown>;
  return (record[lower] ?? record[upper]) === true;
}

/** Canonical evidence record from a finished bridge run. Unknown data stays empty. */
export function evidenceFromRun(run: BridgeRun): ToolEvidence {
  return {
    toolId: run.toolId,
    mode: run.mode,
    status: field(run.result, 'status', 'Status').toUpperCase() || 'INCONCLUSIVE',
    verificationResult: field(run.result, 'verificationResult', 'VerificationResult'),
    errorMessage: field(run.result, 'errorMessage', 'ErrorMessage'),
    reportPath: field(run.result, 'reportPath', 'ReportPath'),
    finishedAt: field(run.result, 'finishedAt', 'FinishedAt') || run.finishedAt || '',
    changedSystem: boolField(run.result, 'changedSystem', 'ChangedSystem'),
    restartNeeded: boolField(run.result, 'restartNeeded', 'RestartNeeded'),
  };
}

function indicatesViolations(evidence: ToolEvidence): boolean {
  return /VIOLATIONS_FOUND/.test(evidence.verificationResult);
}

function indicatesCorruption(evidence: ToolEvidence): boolean {
  return evidence.status === 'FAILED' || /FAILED|CORRUPT/i.test(evidence.verificationResult);
}

function indicatesDiskErrors(evidence: ToolEvidence): boolean {
  return /ERRORS_FOUND/.test(evidence.verificationResult);
}

function indicatesElevation(evidence: ToolEvidence): boolean {
  return /Administrator privileges/i.test(evidence.errorMessage);
}

/**
 * Categorical health derived exclusively from measured evidence.
 * HEALTHY requires at least one passing verify signal and no worse signal.
 */
export function deriveHealthState(evidence: EvidenceMap, running: string[], bridgeOnline: boolean | null): HealthState {
  if (bridgeOnline === false) return 'ENGINE_OFFLINE';
  if (running.length > 0) {
    const repairing = running.some((id) => ['SM02', 'SM05', 'SM07', 'SM09'].includes(id));
    return repairing ? 'REPAIR_IN_PROGRESS' : 'CHECKING';
  }
  const items = Object.values(evidence);
  if (items.length === 0) return 'NOT_SCANNED';
  if (items.some((item) => item.restartNeeded)) return 'RESTART_REQUIRED';
  const measured = items.filter((item) => item.status !== 'CANCELLED' && item.status !== 'SKIPPED');
  const elevationBlocked = (item: ToolEvidence) =>
    (item.status === 'FAILED' || item.status === 'WARNING') && indicatesElevation(item);
  if (measured.length > 0 && measured.every(elevationBlocked)) return 'PERMISSION_REQUIRED';
  if (items.some((item) => item.status === 'FAILED')) {
    const repairable =
      (evidence.SM01 && indicatesViolations(evidence.SM01)) ||
      ((evidence.SM03 && indicatesCorruption(evidence.SM03)) || (evidence.SM04 && indicatesCorruption(evidence.SM04))) ||
      (evidence.SM06 && indicatesDiskErrors(evidence.SM06));
    return repairable ? 'REPAIR_RECOMMENDED' : 'ATTENTION';
  }
  if (
    (evidence.SM01 && indicatesViolations(evidence.SM01)) ||
    (evidence.SM06 && indicatesDiskErrors(evidence.SM06))
  ) {
    return 'REPAIR_RECOMMENDED';
  }
  if (items.some((item) => item.status === 'WARNING')) return 'ATTENTION';
  if (items.every((item) => item.status === 'CANCELLED' || item.status === 'SKIPPED')) return 'NOT_SCANNED';
  if (items.some((item) => item.status === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
  const verified = items.some((item) => item.status === 'SUCCESS');
  return verified ? 'HEALTHY' : 'NOT_SCANNED';
}

export function derivePhaseState(phase: PipelinePhase, evidence: EvidenceMap, running: string[]): PhaseState {
  if (phase.toolIds.some((id) => running.includes(id))) return 'CHECKING';
  const phaseEvidence = phase.toolIds.map((id) => evidence[id]).filter(Boolean);
  if (phaseEvidence.length === 0) return 'NOT_CHECKED';
  if (phaseEvidence.some((item) => item.restartNeeded)) return 'RESTART_REQUIRED';
  if (phase.repairToolIds.some((id) => evidence[id]?.changedSystem)) return 'REPAIR_COMPLETED';
  const verifyFailed = phase.verifyToolIds.some((id) => {
    const item = evidence[id];
    if (!item) return false;
    if (id === 'SM01') return indicatesViolations(item) || item.status === 'FAILED';
    if (id === 'SM06') return indicatesDiskErrors(item) || item.status === 'FAILED';
    return item.status === 'FAILED';
  });
  if (verifyFailed && phase.repairToolIds.length > 0) return 'REPAIR_AVAILABLE';
  if (phaseEvidence.some((item) => item.status === 'FAILED')) return 'FAILED';
  if (phaseEvidence.some((item) => item.status === 'WARNING')) return 'WARNING';
  if (phaseEvidence.some((item) => item.status === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
  if (phase.verifyToolIds.length > 0 && phase.verifyToolIds.every((id) => evidence[id]?.status === 'SUCCESS')) return 'PASSED';
  if (phaseEvidence.some((item) => item.status === 'SUCCESS')) return 'PASSED';
  return 'NOT_CHECKED';
}

export interface Recommendation {
  id: string;
  toolId: Station01ToolId;
  mode: ExecutionMode;
  reason: string;
  reasonAr: string;
  impact: string;
  impactAr: string;
}

/**
 * Deterministic, evidence-based recommendations. A repair is proposed only
 * when a verify signal names the failure it fixes. Never the reverse.
 */
export function buildRecommendations(evidence: EvidenceMap, tools: BridgeTool[]): Recommendation[] {
  const byId = new Map(tools.map((tool) => [tool.ToolId, tool]));
  const out: Recommendation[] = [];
  const sm01 = evidence.SM01;
  if (sm01 && indicatesViolations(sm01) && byId.has('SM02')) {
    out.push({
      id: 'rec-sm02', toolId: 'SM02', mode: 'run',
      reason: 'SM01 found integrity violations (sfc exit 1 with VIOLATIONS_FOUND). SM02 repairs them with sfc /scannow and re-verifies.',
      reasonAr: 'عثر SM01 على انتهاكات سلامة. يقوم SM02 بإصلاحها عبر sfc /scannow ثم يعيد التحقق.',
      impact: 'Modifies protected system files; 10–20 minutes; admin required; post-repair verify included.',
      impactAr: 'يعدّل ملفات النظام المحمية؛ 10–20 دقيقة؛ يتطلب المدير؛ يشمل تحققاً بعد الإصلاح.',
    });
  }
  const storeBad = (evidence.SM03 && indicatesCorruption(evidence.SM03)) || (evidence.SM04 && indicatesCorruption(evidence.SM04));
  if (storeBad && byId.has('SM05')) {
    out.push({
      id: 'rec-sm05', toolId: 'SM05', mode: 'run',
      reason: 'Component store corruption was flagged by CheckHealth/ScanHealth. SM05 runs RestoreHealth with pre/post scans.',
      reasonAr: 'رُصد تلف في مخزن المكونات. يشغّل SM05 الإصلاح مع فحص قبل وبعد.',
      impact: 'Modifies the component store; may use Windows Update (network) or a local source; admin required; 20+ minutes.',
      impactAr: 'يعدّل مخزن المكونات؛ قد يستخدم Windows Update أو مصدراً محلياً؛ يتطلب المدير؛ +20 دقيقة.',
    });
  }
  const sm06 = evidence.SM06;
  if (sm06 && indicatesDiskErrors(sm06) && byId.has('SM07')) {
    out.push({
      id: 'rec-sm07', toolId: 'SM07', mode: 'run',
      reason: 'chkdsk /scan reported filesystem errors. SM07 schedules a boot-time chkdsk (/f /r) and verifies the schedule.',
      reasonAr: 'أبلغ فحص القرص عن أخطاء. يجدول SM07 فحصاً عند الإقلاع ويتحقق من الجدولة.',
      impact: 'Marks the system volume dirty; a restart is required for the repair to run; admin required.',
      impactAr: 'يعلّم قرص النظام؛ يلزم إعادة التشغيل لتنفيذ الإصلاح؛ يتطلب المدير.',
    });
  }
  return out;
}

export interface DiagnoseStep {
  toolId: Station01ToolId;
  mode: ExecutionMode;
}

/** Quick Diagnose plan: facts first (SM10), then verify-only (SM01). Never a blind repair. */
export function quickDiagnosePlan(tools: BridgeTool[]): DiagnoseStep[] {
  const available = new Set(tools.map((tool) => tool.ToolId));
  const plan: DiagnoseStep[] = [];
  if (available.has('SM10')) plan.push({ toolId: 'SM10', mode: 'run' });
  if (available.has('SM01')) plan.push({ toolId: 'SM01', mode: 'run' });
  return plan;
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return STATION01_TOOL_IDS.map((id) => tools.find((tool) => tool.ToolId === id)).filter((tool): tool is BridgeTool => Boolean(tool));
}

export interface HistoryEntry {
  toolId: string;
  mode: ExecutionMode;
  status: string;
  verificationResult: string;
  changedSystem: boolean;
  restartNeeded: boolean;
  reportPath: string;
  finishedAt: string;
}

const HISTORY_KEY = 'knoux-station01-history';

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.toolId === 'string') : [];
  } catch {
    return [];
  }
}

export function appendHistory(entries: HistoryEntry[], evidence: ToolEvidence): HistoryEntry[] {
  const next = [
    {
      toolId: evidence.toolId,
      mode: evidence.mode,
      status: evidence.status,
      verificationResult: evidence.verificationResult,
      changedSystem: evidence.changedSystem,
      restartNeeded: evidence.restartNeeded,
      reportPath: evidence.reportPath,
      finishedAt: evidence.finishedAt,
    },
    ...entries,
  ].slice(0, 100);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* history is best-effort */
  }
  return next;
}

/** Maintenance report generated exclusively from measured evidence and history. */
export function buildMaintenanceReport(input: {
  evidence: EvidenceMap;
  history: HistoryEntry[];
  health: HealthState;
  osCaption: string;
  osBuild: string;
  lang: 'ar' | 'en';
}): string {
  const ar = input.lang === 'ar';
  const lines = [
    ar ? '# تقرير صيانة Windows' : '# Windows Maintenance Report',
    '',
    `- ${ar ? 'التاريخ' : 'Generated'}: ${new Date().toISOString()}`,
    `- ${ar ? 'النظام' : 'System'}: ${input.osCaption || '—'} (build ${input.osBuild || '—'})`,
    `- ${ar ? 'الحالة' : 'Health'}: ${input.health}`,
    '',
    ar ? '## الأدلة المقاسة' : '## Measured evidence',
    '',
  ];
  const items = Object.values(input.evidence);
  if (items.length === 0) {
    lines.push(ar ? 'لا توجد أدلة بعد. لم يتم الفحص.' : 'No evidence yet. Not scanned.', '');
  }
  for (const item of items) {
    lines.push(
      `- **${item.toolId}** [${item.mode}] — ${item.status}` +
      (item.verificationResult ? ` (${item.verificationResult})` : '') +
      (item.changedSystem ? (ar ? ' — غيّر النظام' : ' — changed system') : '') +
      (item.restartNeeded ? (ar ? ' — يلزم إعادة التشغيل' : ' — restart required') : ''),
    );
    if (item.errorMessage) lines.push(`  - ${ar ? 'خطأ' : 'Error'}: ${item.errorMessage}`);
    if (item.reportPath) lines.push(`  - ${ar ? 'التقرير' : 'Report'}: ${item.reportPath}`);
  }
  lines.push('', ar ? '## السجل' : '## History', '');
  if (input.history.length === 0) {
    lines.push(ar ? 'لا يوجد سجل بعد.' : 'No history yet.', '');
  }
  for (const entry of input.history.slice(0, 30)) {
    lines.push(`- ${entry.finishedAt || '—'} · ${entry.toolId} [${entry.mode}] — ${entry.status}${entry.reportPath ? ` · ${entry.reportPath}` : ''}`);
  }
  lines.push('', ar ? '> لا يُدَّعى أي إصلاح لم يثبته التحقق.' : '> No repair is claimed where verification did not prove it.', '');
  return lines.join('\n');
}
