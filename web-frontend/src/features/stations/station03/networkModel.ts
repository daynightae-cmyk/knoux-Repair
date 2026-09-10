/**
 * Station 03 — Network & Internet domain model (Connection Map).
 *
 * Every state derives from measured evidence: the NI11 structured preview,
 * NI01/NI06 parsed output markers, NI07/NI10 reports, and structured run
 * results. Latency, loss, DNS, and gateway states exist only when measured.
 * Proxy and full route tables are unsupported by the repository and are
 * reported as not measured, never invented.
 */
import type { BridgeRun, BridgeTool, ExecutionMode, KnouxRunResult } from '../../../lib/api';

export const STATION03_CATEGORY = '03-Network-Internet';

export const STATION03_TOOL_IDS = [
  'NI01', 'NI02', 'NI03', 'NI04', 'NI05', 'NI06', 'NI07', 'NI08', 'NI09', 'NI10', 'NI11',
] as const;

export type Station03ToolId = (typeof STATION03_TOOL_IDS)[number];

export type ConnectionLayerId = 'adapter' | 'ip' | 'gateway' | 'dns' | 'internet' | 'quality' | 'routing';

export type LayerState =
  | 'NOT_CHECKED'
  | 'CHECKING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'UNREACHABLE'
  | 'MISCONFIGURED'
  | 'BLOCKED'
  | 'ATTENTION'
  | 'CONFIGURED'
  | 'INCONCLUSIVE'
  | 'REPAIR_AVAILABLE'
  | 'REPAIR_IN_PROGRESS'
  | 'REPAIR_VERIFIED'
  | 'INCONCLUSIVE'
  | 'ADMIN_REQUIRED'
  | 'ENGINE_OFFLINE';

export interface PreviewAdapter {
  Description: string;
  IPv4: string;
  Gateway: string;
  DNS: string[];
  DHCP: boolean;
  MacAddress: string;
}

export type AdapterKind = 'ethernet' | 'wifi' | 'virtual' | 'loopback' | 'other';

/** Classify adapters from description text only. Never disables or modifies. */
export function classifyAdapter(description: string): AdapterKind {
  const text = String(description || '').toLowerCase();
  if (/loopback/.test(text)) return 'loopback';
  if (/hyper-v|virtual|vpn|tap-|tun-|vethernet|vmware|virtualbox|zerotier|tailscale|wireguard/.test(text)) return 'virtual';
  if (/wi-?fi|wireless|wlan|802\.11/.test(text)) return 'wifi';
  if (/ethernet|eth |gigabit|lan|realtek|intel\(r\) ethernet|broadcom/.test(text)) return 'ethernet';
  return 'other';
}

export interface Ni01Facts {
  adaptersUp: number | null;
  gateway: string;
  gatewayState: 'reachable' | 'failed' | 'none' | 'unknown';
  dnsOk: boolean | null;
  internetOk: boolean | null;
}

export interface Ni06Facts {
  lossPercent: number | null;
  avgMs: number | null;
  attempts: number;
  measured: boolean;
}

/** Parse NI01's real output markers. Absent markers stay unknown, never assumed. */
export function parseNi01Lines(lines: string[]): Ni01Facts {
  const facts: Ni01Facts = { adaptersUp: null, gateway: '', gatewayState: 'unknown', dnsOk: null, internetOk: null };
  const text = lines.join('\n');
  const upMatch = text.match(/Up adapters:\s*(\d+)/);
  if (upMatch) facts.adaptersUp = Number(upMatch[1]);
  const gwMatch = text.match(/Gateway:\s*([0-9a-fA-F.:]+)/);
  if (gwMatch) facts.gateway = gwMatch[1].trim();
  if (/=> REACHABLE/.test(text) && /Gateway:/.test(text)) {
    // The first REACHABLE after the gateway line belongs to the gateway test.
    const gatewaySection = text.split('Gateway:')[1] || '';
    const beforeDns = gatewaySection.split('DNS resolution')[0] || '';
    if (/=> REACHABLE/.test(beforeDns)) facts.gatewayState = 'reachable';
    else if (/=> FAILED/.test(beforeDns)) facts.gatewayState = 'failed';
  } else if (/no IPv4 gateway detected/.test(text)) {
    facts.gatewayState = 'none';
  }
  if (/=> DNS resolution OK/.test(text)) facts.dnsOk = true;
  else if (/=> DNS resolution FAILED/.test(text)) facts.dnsOk = false;
  const internetMatch = text.match(/=> 8\.8\.8\.8\s+(REACHABLE|UNREACHABLE)/);
  if (internetMatch) facts.internetOk = internetMatch[1] === 'REACHABLE';
  return facts;
}

/** Parse NI06's measured loss/latency markers. Unmeasured stays null. */
export function parseNi06Lines(lines: string[]): Ni06Facts {
  const facts: Ni06Facts = { lossPercent: null, avgMs: null, attempts: 10, measured: false };
  const text = lines.join('\n');
  const lossMatch = text.match(/Packet loss:\s*(\d+)%/);
  const avgMatch = text.match(/Average latency:\s*(\d+)\s*ms/);
  if (lossMatch) {
    facts.lossPercent = Number(lossMatch[1]);
    facts.measured = true;
  }
  if (avgMatch) {
    facts.avgMs = Number(avgMatch[1]);
    facts.measured = true;
  }
  return facts;
}

export interface ToolOutcome {
  toolId: string;
  mode: ExecutionMode;
  status: string;
  verificationResult: string;
  errorMessage: string;
  reportPath: string;
  finishedAt: string;
  changedSystem: boolean;
  restartNeeded: boolean;
  lines: string[];
}

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

export function outcomeFromRun(run: BridgeRun): ToolOutcome {
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
    lines: run.lines.map((line) => String(line.text || '')).slice(-400),
  };
}

export interface DiagnoseEvidence {
  adapters: PreviewAdapter[];
  ni01: Ni01Facts | null;
  ni06: Ni06Facts | null;
  outcomes: Record<string, ToolOutcome>;
}

export function emptyEvidence(): DiagnoseEvidence {
  return { adapters: [], ni01: null, ni06: null, outcomes: {} };
}

function isApipa(ip: string): boolean {
  return /^169\.254\./.test(String(ip || '').trim());
}

function hasUsableIp(adapter: PreviewAdapter): boolean {
  return Boolean(adapter.IPv4) && !isApipa(adapter.IPv4);
}

function isVirtualOrLoopback(adapter: PreviewAdapter): boolean {
  const kind = classifyAdapter(adapter.Description);
  return kind === 'virtual' || kind === 'loopback';
}

/** A primary physical/internet adapter: non-virtual/non-loopback, has a non-APIPA IPv4, and carries a gateway or default-route evidence. */
function isPrimaryInternetPath(adapter: PreviewAdapter, gatewayFromNi01?: string): boolean {
  if (isVirtualOrLoopback(adapter)) return false;
  if (!hasUsableIp(adapter)) return false;
  if (adapter.Gateway && adapter.Gateway.trim()) return true;
  if (gatewayFromNi01 && adapter.IPv4) {
    return true;
  }
  return false;
}

/** Per-layer states from measured evidence only. */
export function deriveLayerStates(evidence: DiagnoseEvidence, running: string[]): Record<ConnectionLayerId, LayerState> {
  const states: Record<ConnectionLayerId, LayerState> = {
    adapter: 'NOT_CHECKED', ip: 'NOT_CHECKED', gateway: 'NOT_CHECKED',
    dns: 'NOT_CHECKED', internet: 'NOT_CHECKED', quality: 'NOT_CHECKED', routing: 'NOT_CHECKED',
  };
  const markRunning = (layer: ConnectionLayerId) => { states[layer] = 'CHECKING'; };
  if (running.includes('NI11') || running.includes('NI07') || running.includes('NI10')) markRunning('adapter');
  if (running.includes('NI10') || running.includes('NI07')) markRunning('ip');
  if (running.includes('NI01')) { markRunning('gateway'); markRunning('dns'); markRunning('internet'); }
  if (running.includes('NI06')) markRunning('quality');
  if (running.some((id) => ['NI02', 'NI03', 'NI04', 'NI05', 'NI08', 'NI09'].includes(id))) {
    for (const layer of Object.keys(states) as ConnectionLayerId[]) {
      if (states[layer] === 'NOT_CHECKED') states[layer] = 'REPAIR_IN_PROGRESS';
    }
    return states;
  }

  // Adapter layer: real primary path requires non-virtual/non-loopback adapter
  // with usable IPv4 and gateway/default-route evidence. Virtual adapters
  // (Hyper-V, VPN, TAP/TUN, Tailscale) and loopback do NOT prove internet path.
  const primaryAdapters = evidence.adapters.filter((a) => isPrimaryInternetPath(a, evidence.ni01?.gateway));
  const anyRealAdapters = evidence.adapters.some((a) => !isVirtualOrLoopback(a));
  const anyAdapters = evidence.adapters.length > 0;
  if (!anyAdapters && !evidence.ni01) {
    // untouched
  } else if (!anyAdapters) {
    states.adapter = evidence.ni01 && (evidence.ni01.adaptersUp || 0) > 0 ? 'DEGRADED' : 'UNREACHABLE';
  } else if (primaryAdapters.length > 0) {
    states.adapter = 'CONNECTED';
  } else if (anyRealAdapters && evidence.adapters.some(hasUsableIp)) {
    // Real adapter exists with IP but no gateway/default-route evidence -> not a confirmed path.
    states.adapter = 'ATTENTION';
  } else if (anyRealAdapters) {
    states.adapter = 'MISCONFIGURED';
  } else {
    // Only virtual/loopback adapters present; no primary physical/internet proof.
    states.adapter = 'DEGRADED';
  }

  // IP layer: only real (non-virtual/non-loopback) adapters with usable IPv4 count.
  const realUsableAdapters = evidence.adapters.filter((a) => !isVirtualOrLoopback(a) && hasUsableIp(a));
  if (anyAdapters) {
    if (realUsableAdapters.length > 0) states.ip = 'CONNECTED';
    else if (evidence.adapters.some((a) => a.IPv4 && isApipa(a.IPv4))) states.ip = 'MISCONFIGURED';
    else states.ip = 'UNREACHABLE';
  }

  // Gateway layer.
  if (evidence.ni01) {
    if (evidence.ni01.gatewayState === 'reachable') states.gateway = 'CONNECTED';
    else if (evidence.ni01.gatewayState === 'failed') states.gateway = 'UNREACHABLE';
    else if (evidence.ni01.gatewayState === 'none') states.gateway = 'MISCONFIGURED';
  } else if (evidence.adapters.some((a) => a.Gateway)) {
    states.gateway = 'ATTENTION';
  }

  // DNS layer: resolution evidence owns the verdict, never ping alone.
  if (evidence.ni01 && evidence.ni01.dnsOk !== null) {
    states.dns = evidence.ni01.dnsOk ? 'CONNECTED' : 'UNREACHABLE';
  } else if (evidence.adapters.some((a) => (a.DNS || []).length > 0)) {
    states.dns = 'ATTENTION';
  }

  // Internet layer: layered evidence, ICMP-blocked stays inconclusive.
  if (evidence.ni01 && evidence.ni01.internetOk !== null) {
    if (evidence.ni01.internetOk) {
      states.internet = 'CONNECTED';
    } else if (evidence.ni01.gatewayState === 'reachable' && evidence.ni01.dnsOk === true) {
      states.internet = 'DEGRADED';
    } else {
      states.internet = 'UNREACHABLE';
    }
  }

  // Quality layer: measured loss/avg only.
  if (evidence.ni06 && evidence.ni06.measured) {
    const loss = evidence.ni06.lossPercent ?? 99;
    states.quality = loss < 5 ? 'CONNECTED' : loss < 25 ? 'DEGRADED' : 'UNREACHABLE';
  } else if (evidence.outcomes.NI06) {
    states.quality = 'INCONCLUSIVE';
  }

  // Routing layer: separate configured/default-route evidence from verified route.
  // The repository does not measure full route tables (only gateway/default route).
  const hasConfiguredRoute = evidence.adapters.some((a) => a.Gateway && a.Gateway.trim()) || Boolean(evidence.ni01 && evidence.ni01.gateway);
  const verifiedRoute = evidence.ni01 ? evidence.ni01.gatewayState === 'reachable' : false;
  if (verifiedRoute) {
    states.routing = 'CONNECTED';
  } else if (hasConfiguredRoute) {
    // Configured/default-route exists but was not verified by measurement.
    states.routing = 'CONFIGURED';
  } else if (anyAdapters || evidence.ni01) {
    states.routing = 'ATTENTION';
  } else {
    states.routing = 'INCONCLUSIVE';
  }
  return states;
}

/** The first confidently failed layer drives the finding. */
export function firstFailedLayer(states: Record<ConnectionLayerId, LayerState>): ConnectionLayerId | null {
  const order: ConnectionLayerId[] = ['adapter', 'ip', 'gateway', 'dns', 'internet', 'quality', 'routing'];
  const failing: LayerState[] = ['UNREACHABLE', 'MISCONFIGURED', 'BLOCKED', 'DEGRADED'];
  for (const layer of order) {
    if (failing.includes(states[layer])) return layer;
  }
  return null;
}

export interface RepairStep {
  level: number;
  toolId: string;
  mode: ExecutionMode;
  titleEn: string;
  titleAr: string;
  impactEn: string;
  impactAr: string;
}

export const REPAIR_LADDER: RepairStep[] = [
  { level: 1, toolId: 'NI01', mode: 'run', titleEn: 'Re-test connectivity', titleAr: 'إعادة اختبار الاتصال', impactEn: 'Non-destructive re-test: adapters, gateway ping, DNS, internet ping.', impactAr: 'إعادة اختبار غير مدمرة: المحولات وبوابة ping وDNS وping الإنترنت.' },
  { level: 2, toolId: 'NI03', mode: 'run', titleEn: 'Flush DNS cache', titleAr: 'تفريغ ذاكرة DNS', impactEn: 'Clears the local resolver cache only. Does not change providers or speed.', impactAr: 'يمسح ذاكرة الحل المحلية فقط. لا يغير المزود ولا السرعة.' },
  { level: 2, toolId: 'NI05', mode: 'run', titleEn: 'Refresh NetBIOS / ARP / DNS tables', titleAr: 'تحديث جداول NetBIOS وARP وDNS', impactEn: 'Flushes NetBIOS and ARP caches, re-registers DNS. Brief local-name disruption possible.', impactAr: 'يمسح NetBIOS وARP ويعيد تسجيل DNS. احتمال انقطاع محلي وجيز.' },
  { level: 3, toolId: 'NI02', mode: 'run', titleEn: 'Renew DHCP lease', titleAr: 'تجديد عنوان DHCP', impactEn: 'Releases then renews all adapters. Connection briefly drops. Skipped for static IPs.', impactAr: 'يحرر ثم يجدد كل المحولات. انقطاع وجيز. يُتخطى للعناوين الثابتة.' },
  { level: 4, toolId: 'NI04', mode: 'run', titleEn: 'Reset Winsock catalog', titleAr: 'إعادة تعيين Winsock', impactEn: 'Reinitializes Winsock. Network apps affected. Restart required afterwards.', impactAr: 'يعيد تهيئة Winsock. تتأثر تطبيقات الشبكة. يلزم إعادة التشغيل.' },
  { level: 4, toolId: 'NI09', mode: 'run', titleEn: 'Restore TCP defaults', titleAr: 'استعادة إعدادات TCP', impactEn: 'Restores standard TCP auto-tuning and congestion defaults. Previous values shown first.', impactAr: 'يستعيد قيم TCP القياسية. تُعرض القيم السابقة أولاً.' },
  { level: 5, toolId: 'NI08', mode: 'run', titleEn: 'Full network stack reset (last resort)', titleAr: 'إعادة تعيين شاملة (الملاذ الأخير)', impactEn: 'Winsock + IP reset. VPN and custom settings at risk. Restart required.', impactAr: 'إعادة Winsock وIP. إعدادات VPN والمخصصة معرضة. يلزم إعادة التشغيل.' },
];

export interface Recommendation {
  id: string;
  toolId: string;
  mode: ExecutionMode;
  reasonEn: string;
  reasonAr: string;
}

/** Deterministic recommendations. Escalation follows evidence, never jumps to reset. */
export function buildRecommendations(evidence: DiagnoseEvidence, tools: BridgeTool[]): Recommendation[] {
  const available = new Set(tools.map((tool) => tool.ToolId));
  const out: Recommendation[] = [];
  const ni01 = evidence.ni01;
  if (ni01) {
    if (ni01.dnsOk === false && ni01.gatewayState === 'reachable' && available.has('NI03')) {
      out.push({
        id: 'rec-ni03', toolId: 'NI03', mode: 'run',
        reasonEn: 'Gateway is reachable but name resolution fails: flush the local DNS cache, then re-test.',
        reasonAr: 'البوابة reachable لكن حل الأسماء يفشل: امسح ذاكرة DNS ثم أعد الاختبار.',
      });
    }
    const apipaOrMissing = evidence.adapters.length > 0 && !evidence.adapters.some(hasUsableIp);
    const dhcpCapable = evidence.adapters.some((a) => a.DHCP);
    if ((apipaOrMissing || ni01.gatewayState === 'none') && dhcpCapable && available.has('NI02')) {
      out.push({
        id: 'rec-ni02', toolId: 'NI02', mode: 'run',
        reasonEn: 'No usable DHCP lease (APIPA or missing gateway on a DHCP adapter): renew the lease.',
        reasonAr: 'لا يوجد عنوان DHCP صالح: جدد العنوان.',
      });
    }
    if (ni01.gatewayState === 'failed' && available.has('NI05')) {
      out.push({
        id: 'rec-ni05', toolId: 'NI05', mode: 'run',
        reasonEn: 'Configured gateway does not answer: refresh local tables before deeper repairs.',
        reasonAr: 'البوابة لا ترد: حدّث الجداول المحلية قبل إصلاحات أعمق.',
      });
    }
    // Gate: gateway reachable + DNS OK + public IP ICMP failure alone does NOT
    // prove a Winsock fault. ICMP may be blocked. Without stronger independent
    // transport evidence, this is DEGRADED / INCONCLUSIVE, not a Winsock reset.
    // Do NOT recommend NI04 automatically from ping failure alone.
  }
  if (evidence.ni06 && evidence.ni06.measured && (evidence.ni06.lossPercent ?? 0) >= 25) {
    // High loss has no supported repair tool: report only, never invent a fix.
  }
  return out;
}

export interface DiagnoseStep {
  toolId: string;
  mode: ExecutionMode;
}

/** Diagnose Connection: read-only layers in path order. Never a repair. */
export function diagnosePlan(tools: BridgeTool[]): DiagnoseStep[] {
  const available = new Set(tools.map((tool) => tool.ToolId));
  const plan: DiagnoseStep[] = [];
  for (const id of ['NI11', 'NI10', 'NI01', 'NI06']) {
    if (available.has(id)) plan.push({ toolId: id, mode: 'run' });
  }
  return plan;
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return STATION03_TOOL_IDS.map((id) => tools.find((tool) => tool.ToolId === id)).filter((tool): tool is BridgeTool => Boolean(tool));
}

export interface HistoryEntry {
  kind: 'diagnose' | 'repair' | 'verify';
  toolId: string;
  mode: ExecutionMode;
  status: string;
  finding: string;
  changedSystem: boolean;
  restartNeeded: boolean;
  verification: string;
  reportPath: string;
  finishedAt: string;
}

const HISTORY_KEY = 'knoux-station03-history';

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

/** Network report from measured evidence. Adapter data is local-only scope; no secrets exist in these tools. */
export function buildNetworkReport(input: {
  adapters: PreviewAdapter[];
  ni01: Ni01Facts | null;
  ni06: Ni06Facts | null;
  outcomes: ToolOutcome[];
  history: HistoryEntry[];
  before: { gateway: string; dnsOk: boolean | null; internetOk: boolean | null } | null;
  after: { gateway: string; dnsOk: boolean | null; internetOk: boolean | null } | null;
  lang: 'ar' | 'en';
}): string {
  const ar = input.lang === 'ar';
  const lines = [
    ar ? '# تقرير تشخيص الشبكة' : '# Network Diagnostic Report',
    '',
    `- ${ar ? 'التاريخ' : 'Generated'}: ${new Date().toISOString()}`,
    `- ${ar ? 'النطاق' : 'Scope'}: ${ar ? 'محلي فقط. لا كلمات مرور ولا أسرار.' : 'Local only. No passwords or secrets.'}`,
    '',
    ar ? '## المحولات المقاسة' : '## Measured adapters',
    '',
  ];
  if (input.adapters.length === 0) {
    lines.push(ar ? 'لا توجد بيانات محولات.' : 'No adapter data.', '');
  }
  for (const adapter of input.adapters) {
    lines.push(
      `- **${adapter.Description || '—'}** [${classifyAdapter(adapter.Description)}] — IPv4: ${adapter.IPv4 || '—'}` +
      ` · Gateway: ${adapter.Gateway || '—'} · DNS: ${(adapter.DNS || []).join(', ') || '—'}` +
      ` · DHCP: ${(adapter.DHCP ? 'yes' : 'no')} · MAC: ${adapter.MacAddress || '—'}`,
    );
  }
  lines.push('', ar ? '## الطبقات' : '## Layers', '');
  const ni01 = input.ni01;
  lines.push(`- Gateway: ${ni01 ? `${ni01.gateway || '—'} (${ni01.gatewayState})` : '—'}`);
  lines.push(`- DNS resolution: ${ni01 && ni01.dnsOk !== null ? String(ni01.dnsOk) : '—'}`);
  lines.push(`- Internet (8.8.8.8 ping): ${ni01 && ni01.internetOk !== null ? String(ni01.internetOk) : '—'}`);
  const ni06 = input.ni06;
  lines.push(`- Quality (10x ping): ${ni06 && ni06.measured ? `loss ${ni06.lossPercent}% avg ${ni06.avgMs === null ? 'n/a' : `${ni06.avgMs} ms`}` : '—'}`);
  lines.push(`- Proxy: ${ar ? 'غير مدعوم من الأدوات (لم يُقس)' : 'unsupported by tools (not measured)'}`);
  lines.push(`- Full route table: ${ar ? 'غير مدعوم (بوابة افتراضية فقط)' : 'unsupported (default gateway only)'}`);
  lines.push('', ar ? '## قبل / بعد' : '## Before / after', '');
  const fmt = (s: { gateway: string; dnsOk: boolean | null; internetOk: boolean | null } | null) =>
    s ? `gw=${s.gateway || '—'} dns=${String(s.dnsOk)} net=${String(s.internetOk)}` : '—';
  lines.push(`- ${ar ? 'قبل' : 'Before'}: ${fmt(input.before)}`);
  lines.push(`- ${ar ? 'بعد' : 'After'}: ${fmt(input.after)}`);
  lines.push('', ar ? '## العمليات' : '## Operations', '');
  if (input.outcomes.length === 0) lines.push(ar ? 'لا عمليات.' : 'No operations.', '');
  for (const outcome of input.outcomes) {
    lines.push(`- **${outcome.toolId}** [${outcome.mode}] — ${outcome.status}${outcome.verificationResult ? ` (${outcome.verificationResult})` : ''}${outcome.changedSystem ? (ar ? ' — غيّر النظام' : ' — changed system') : ''}${outcome.restartNeeded ? (ar ? ' — يلزم إعادة التشغيل' : ' — restart required') : ''}`);
    if (outcome.errorMessage) lines.push(`  - ${ar ? 'خطأ' : 'Error'}: ${outcome.errorMessage}`);
    if (outcome.reportPath) lines.push(`  - ${ar ? 'التقرير' : 'Report'}: ${outcome.reportPath}`);
  }
  lines.push('', ar ? '> اكتمال الأمر لا يعني استعادة الاتصال. الاستعادة تُثبت بإعادة الاختبار فقط.' : '> Command completion is not restoration. Only a re-test proves restoration.', '');
  return lines.join('\n');
}

export function formatMs(value: number | null, lang: 'ar' | 'en'): string {
  if (value === null) return lang === 'ar' ? 'غير مقاس' : 'Not measured';
  return `${value.toLocaleString(lang)} ms`;
}
