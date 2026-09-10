/**
 * Station 02 — System Cleanup domain model (Space Cleaner / Cleanup Plan).
 *
 * Everything derives from measured evidence: the SC11 read-only preview,
 * the 11 registered 02-System-Cleanup tools, and structured run results.
 * Three byte roles stay separate forever:
 *   potentiallyRecoverable != selected != actuallyRecovered.
 */
import type { BridgeRun, BridgeTool, CleanupPreview, ExecutionMode, KnouxRunResult } from '../../../lib/api';

export const STATION02_CATEGORY = '02-System-Cleanup';

export const STATION02_TOOL_IDS = [
  'SC01', 'SC02', 'SC03', 'SC04', 'SC05', 'SC06', 'SC07', 'SC08', 'SC09', 'SC10', 'SC11',
] as const;

export type Station02ToolId = (typeof STATION02_TOOL_IDS)[number];

export type CleanupTier = 'safe' | 'review' | 'sensitive' | 'destructive';

export interface CleanupGroup {
  id: string;
  toolId: Station02ToolId | null;
  tier: CleanupTier;
  defaultSelected: boolean;
  destructive: boolean;
}

export const CLEANUP_GROUPS: CleanupGroup[] = [
  { id: 'user-temp', toolId: 'SC01', tier: 'safe', defaultSelected: true, destructive: false },
  { id: 'browser-cache', toolId: 'SC03', tier: 'safe', defaultSelected: true, destructive: false },
  { id: 'thumbnails', toolId: 'SC09', tier: 'safe', defaultSelected: true, destructive: false },
  { id: 'system-temp', toolId: 'SC07', tier: 'review', defaultSelected: false, destructive: false },
  { id: 'error-reports', toolId: 'SC04', tier: 'review', defaultSelected: false, destructive: false },
  { id: 'large-temp', toolId: 'SC08', tier: 'review', defaultSelected: false, destructive: false },
  { id: 'update-cache', toolId: 'SC06', tier: 'sensitive', defaultSelected: false, destructive: false },
  { id: 'recycle-bin', toolId: 'SC02', tier: 'destructive', defaultSelected: false, destructive: true },
  { id: 'comprehensive', toolId: 'SC10', tier: 'destructive', defaultSelected: false, destructive: true },
  { id: 'dev-caches', toolId: null, tier: 'review', defaultSelected: false, destructive: false },
];

export type CleanupState =
  | 'NOT_SCANNED'
  | 'SCANNING'
  | 'CANDIDATES_FOUND'
  | 'NOTHING_SAFE'
  | 'REVIEW_REQUIRED'
  | 'READY'
  | 'CLEANING'
  | 'VERIFIED'
  | 'PARTIAL'
  | 'FAILED'
  | 'INCONCLUSIVE'
  | 'ENGINE_OFFLINE';

export interface GroupEvidence {
  groupId: string;
  files: number;
  bytes: number;
  exists: boolean;
  paths: string[];
}

export type GroupEvidenceMap = Record<string, GroupEvidence>;

export interface ToolOutcome {
  toolId: string;
  mode: ExecutionMode;
  status: string;
  verificationResult: string;
  errorMessage: string;
  reportPath: string;
  finishedAt: string;
  itemsFound: number;
  itemsProcessed: number;
  skippedCount: number;
  quarantinedCount: number;
  bytesPotentiallyRecoverable: number;
  bytesQuarantined: number;
  bytesPermanentlyDeleted: number;
  bytesActuallyRecovered: number;
  changedSystem: boolean;
  restartNeeded: boolean;
}

function field(result: KnouxRunResult | null | undefined, lower: string, upper: string): string {
  if (!result) return '';
  const record = result as unknown as Record<string, unknown>;
  const value = record[lower] ?? record[upper];
  return value === null || value === undefined ? '' : String(value);
}

function numField(result: KnouxRunResult | null | undefined, lower: string, upper: string): number {
  if (!result) return 0;
  const record = result as unknown as Record<string, unknown>;
  const value = record[lower] ?? record[upper];
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function boolField(result: KnouxRunResult | null | undefined, lower: string, upper: string): boolean {
  if (!result) return false;
  const record = result as unknown as Record<string, unknown>;
  return (record[lower] ?? record[upper]) === true;
}

/** Canonical outcome record. Unknown data is zero/empty — never invented. */
export function outcomeFromRun(run: BridgeRun): ToolOutcome {
  return {
    toolId: run.toolId,
    mode: run.mode,
    status: field(run.result, 'status', 'Status').toUpperCase() || 'INCONCLUSIVE',
    verificationResult: field(run.result, 'verificationResult', 'VerificationResult'),
    errorMessage: field(run.result, 'errorMessage', 'ErrorMessage'),
    reportPath: field(run.result, 'reportPath', 'ReportPath'),
    finishedAt: field(run.result, 'finishedAt', 'FinishedAt') || run.finishedAt || '',
    itemsFound: numField(run.result, 'itemsFound', 'ItemsFound'),
    itemsProcessed: numField(run.result, 'itemsProcessed', 'ItemsProcessed'),
    skippedCount: numField(run.result, 'skippedCount', 'SkippedCount'),
    quarantinedCount: numField(run.result, 'quarantinedCount', 'QuarantinedCount'),
    bytesPotentiallyRecoverable: numField(run.result, 'bytesPotentiallyRecoverable', 'BytesPotentiallyRecoverable'),
    bytesQuarantined: numField(run.result, 'bytesQuarantined', 'BytesQuarantined'),
    bytesPermanentlyDeleted: numField(run.result, 'bytesPermanentlyDeleted', 'BytesPermanentlyDeleted'),
    bytesActuallyRecovered:
      numField(run.result, 'bytesActuallyRecovered', 'BytesActuallyRecovered') ||
      numField(run.result, 'bytesRecovered', 'BytesRecovered'),
    changedSystem: boolField(run.result, 'changedSystem', 'ChangedSystem'),
    restartNeeded: boolField(run.result, 'restartNeeded', 'RestartNeeded'),
  };
}

/**
 * Actual recovery from an outcome: quarantined + permanently deleted +
 * legacy recovered aggregate, without double counting. Candidate estimates
 * are never treated as recovered.
 */
export function actualRecoveredBytes(outcome: ToolOutcome): number {
  const legacy = Math.max(0, outcome.bytesActuallyRecovered - outcome.bytesQuarantined - outcome.bytesPermanentlyDeleted);
  return outcome.bytesQuarantined + outcome.bytesPermanentlyDeleted + legacy;
}

const GROUP_MATCHERS: Array<{ groupId: string; match: (category: string) => boolean }> = [
  // Developer caches first: 'npm cache' also contains the word 'cache' and
  // must never be classified as browser cache.
  { groupId: 'dev-caches', match: (category) => /npm|yarn|pip/i.test(category) },
  { groupId: 'user-temp', match: (category) => category === 'User temp' },
  { groupId: 'browser-cache', match: (category) => /cache/i.test(category) && category !== 'Update download cache' },
  { groupId: 'thumbnails', match: (category) => /thumbnail/i.test(category) },
  { groupId: 'system-temp', match: (category) => category === 'Windows temp' },
  { groupId: 'error-reports', match: (category) => /error report/i.test(category) },
  { groupId: 'update-cache', match: (category) => category === 'Update download cache' },
];

/** Classify the SC11 preview targets into station groups. Unmatched targets stay visible, never silently dropped. */
export function classifyPreview(preview: CleanupPreview | null): { groups: GroupEvidenceMap; unmatched: GroupEvidence[] } {
  const groups: GroupEvidenceMap = {};
  for (const def of CLEANUP_GROUPS) groups[def.id] = { groupId: def.id, files: 0, bytes: 0, exists: false, paths: [] };
  const unmatched: GroupEvidence[] = [];
  if (!preview) return { groups, unmatched };
  for (const target of preview.Targets || []) {
    const category = String(target.Category || '');
    const matcher = GROUP_MATCHERS.find((entry) => entry.match(category));
    const record: GroupEvidence = {
      groupId: matcher ? matcher.groupId : `target:${category}`,
      files: Number(target.FileCount || 0),
      bytes: Number(target.SizeBytes || 0),
      exists: Boolean(target.Exists),
      paths: target.Path ? [String(target.Path)] : [],
    };
    if (matcher) {
      const current = groups[matcher.groupId];
      current.files += record.files;
      current.bytes += record.bytes;
      current.exists = current.exists || record.exists;
      current.paths.push(...record.paths);
    } else {
      unmatched.push(record);
    }
  }
  return { groups, unmatched };
}

export function selectedBytes(selected: string[], groups: GroupEvidenceMap): number {
  return selected.reduce((sum, id) => sum + (groups[id]?.bytes || 0), 0);
}

export function selectedFiles(selected: string[], groups: GroupEvidenceMap): number {
  return selected.reduce((sum, id) => sum + (groups[id]?.files || 0), 0);
}

export function deriveCleanupState(input: {
  bridgeOnline: boolean | null;
  scanning: boolean;
  cleaning: boolean;
  preview: CleanupPreview | null;
  groups: GroupEvidenceMap;
  outcomes: ToolOutcome[];
}): CleanupState {
  if (input.bridgeOnline === false) return 'ENGINE_OFFLINE';
  if (input.cleaning) return 'CLEANING';
  if (input.scanning) return 'SCANNING';
  if (!input.preview) return 'NOT_SCANNED';
  if (input.outcomes.length > 0) {
    const last = input.outcomes[input.outcomes.length - 1];
    if (input.outcomes.some((o) => o.status === 'FAILED')) return 'FAILED';
    if (input.outcomes.some((o) => o.status === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
    if (input.outcomes.some((o) => o.status === 'WARNING')) return 'PARTIAL';
    if (last.status === 'CANCELLED') return 'REVIEW_REQUIRED';
    if (last.status === 'SUCCESS') return 'VERIFIED';
    return 'INCONCLUSIVE';
  }
  const measurable = Object.values(input.groups).filter((g) => g.exists && (g.files > 0 || g.bytes > 0));
  if (measurable.length === 0) return 'NOTHING_SAFE';
  return 'CANDIDATES_FOUND';
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return STATION02_TOOL_IDS.map((id) => tools.find((tool) => tool.ToolId === id)).filter((tool): tool is BridgeTool => Boolean(tool));
}

export interface CleanupPlanStep {
  groupId: string;
  toolId: string;
  mode: ExecutionMode;
}

export function buildCleanupPlan(selected: string[], groups: Record<string, CleanupGroup>): CleanupPlanStep[] {
  const steps: CleanupPlanStep[] = [];
  for (const groupId of selected) {
    const def = groups[groupId];
    if (def && def.toolId) steps.push({ groupId, toolId: def.toolId, mode: 'run' });
  }
  return steps;
}

export interface HistoryEntry {
  kind: 'scan' | 'cleanup';
  toolId: string;
  mode: ExecutionMode;
  status: string;
  candidateBytes: number;
  selectedBytes: number;
  recoveredBytes: number;
  quarantined: number;
  deleted: number;
  skipped: number;
  failed: number;
  verification: string;
  reportPath: string;
  finishedAt: string;
}

const HISTORY_KEY = 'knoux-station02-history';

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

export function appendHistory(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...entries].slice(0, 100);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* history is best-effort */
  }
  return next;
}

/** Cleanup report from measured evidence only. Estimates are labeled estimates. */
export function buildCleanupReport(input: {
  groups: GroupEvidenceMap;
  unmatched: GroupEvidence[];
  selected: string[];
  outcomes: ToolOutcome[];
  history: HistoryEntry[];
  diskFreeBefore: number | null;
  diskFreeAfter: number | null;
  protectedExclusions: string[];
  lang: 'ar' | 'en';
}): string {
  const ar = input.lang === 'ar';
  const lines = [
    ar ? '# تقرير تنظيف Windows' : '# Windows Cleanup Report',
    '',
    `- ${ar ? 'التاريخ' : 'Generated'}: ${new Date().toISOString()}`,
    '',
    ar ? '## مجموعات المرشحات (مقاسة)' : '## Candidate groups (measured)',
    '',
  ];
  for (const group of Object.values(input.groups)) {
    if (!group.exists && group.files === 0) continue;
    const selected = input.selected.includes(group.groupId) ? (ar ? ' — محدد' : ' — selected') : '';
    lines.push(`- **${group.groupId}**: ${group.files} files, ${group.bytes} bytes${selected}`);
    for (const p of group.paths.slice(0, 4)) lines.push(`  - ${p}`);
  }
  for (const extra of input.unmatched) {
    lines.push(`- **${extra.groupId}** (unmapped target): ${extra.files} files, ${extra.bytes} bytes`);
  }
  lines.push('', ar ? '## التنفيذ' : '## Execution', '');
  if (input.outcomes.length === 0) {
    lines.push(ar ? 'لم يتم تنفيذ أي تنظيف.' : 'No cleanup executed.', '');
  }
  for (const outcome of input.outcomes) {
    lines.push(
      `- **${outcome.toolId}** [${outcome.mode}] — ${outcome.status}` +
      ` · quarantined ${outcome.quarantinedCount} · deleted-bytes ${outcome.bytesPermanentlyDeleted}` +
      ` · recovered ${actualRecoveredBytes(outcome)} bytes` +
      (outcome.verificationResult ? ` · verify: ${outcome.verificationResult}` : ''),
    );
    if (outcome.errorMessage) lines.push(`  - ${ar ? 'خطأ' : 'Error'}: ${outcome.errorMessage}`);
    if (outcome.reportPath) lines.push(`  - ${ar ? 'التقرير' : 'Report'}: ${outcome.reportPath}`);
  }
  lines.push('', ar ? '## قبل / بعد' : '## Before / after', '');
  lines.push(`- ${ar ? 'مساحة القرص قبل' : 'Disk free before'}: ${input.diskFreeBefore === null ? '—' : `${input.diskFreeBefore} bytes`}`);
  lines.push(`- ${ar ? 'مساحة القرص بعد' : 'Disk free after'}: ${input.diskFreeAfter === null ? '—' : `${input.diskFreeAfter} bytes`}`);
  lines.push('', ar ? '## عناصر محمية مستثناة' : '## Protected exclusions', '');
  for (const item of input.protectedExclusions) lines.push(`- ${item}`);
  lines.push('', ar ? '> الأحجام التقديرية ليست مساحة مستردة. المسترد هو ما أثبته التنفيذ فقط.' : '> Estimates are not recovery. Only executed results count as recovered.', '');
  return lines.join('\n');
}

export function formatBytes(bytes: number | null | undefined, lang: 'ar' | 'en'): string {
  if (bytes === null || bytes === undefined) return lang === 'ar' ? 'غير متاح' : 'Unavailable';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toLocaleString(lang, { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toLocaleString(lang, { maximumFractionDigits: 1 })} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toLocaleString(lang, { maximumFractionDigits: 1 })} KB`;
  return `${bytes.toLocaleString(lang)} B`;
}
