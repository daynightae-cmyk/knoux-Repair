/**
 * KNOUX REPAIR — Station 09: Security
 * Security Posture Center Domain Model
 * Pure deterministic functions for security posture assessment, Windows Defender
 * evaluation, firewall profile verification, UAC posture, and safe remediation recommendations.
 */

import type { BridgeTool, KnouxRunResult } from '../../../lib/api';

export type SecurityPostureStatus = 'SECURE' | 'PROTECTED_WITH_WARNINGS' | 'EXPOSED' | 'UNKNOWN';

export interface DefenderStatus {
  available: boolean;
  running: boolean;
  realtimeEnabled: boolean;
  signatures: string;
  signatureAgeDays: number | null;
  tamperProtected: boolean | null;
  signatureStatus: 'CURRENT' | 'OUTDATED' | 'UNKNOWN';
}

export interface FirewallProfileStatus {
  profile: string;
  enabled: boolean;
}

export interface FirewallEvaluation {
  allEnabled: boolean;
  anyDisabled: boolean;
  totalProfiles: number;
  enabledCount: number;
  profiles: FirewallProfileStatus[];
}

export interface UacStatus {
  enabled: boolean | null;
  levelDescription: string;
}

export interface SecuritySignal {
  code: string;
  level: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  messageEn: string;
  messageAr: string;
  suggestedTool: string;
  evidenceSource: string;
}

export interface SecurityAuditCheck {
  check: string;
  status: string;
  isHealthy: boolean;
}

export interface StationHistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE';
  itemsProcessed: number;
  summary: string;
}

export const STATION09_TOOL_IDS = [
  'SE01', 'SE02', 'SE03', 'SE04', 'SE05',
  'SE06', 'SE07', 'SE08', 'SE09', 'SE10',
] as const;

/**
 * Strict safety check: KNOUX Security Station ENFORCES security and NEVER offers
 * actions to disable protection, firewall, or UAC.
 */
export function isAllowedSecurityAction(toolId: string): boolean {
  // Prohibited tools or actions that weaken system security:
  const prohibitedDisablingIds = ['SE_DISABLE_DEFENDER', 'SE_DISABLE_FIREWALL', 'SE_DISABLE_UAC'];
  if (prohibitedDisablingIds.includes(toolId)) return false;
  return (STATION09_TOOL_IDS as readonly string[]).includes(toolId);
}

/**
 * Derives categorical security posture transparently without fake scoring
 */
export function deriveSecurityPosture(
  defenderRealtime: boolean | null | undefined,
  defenderRunning: boolean | null | undefined,
  firewallAllEnabled: boolean | null | undefined,
  uacEnabled?: boolean | null
): SecurityPostureStatus {
  if (defenderRealtime === null && defenderRunning === null && firewallAllEnabled === null) {
    return 'UNKNOWN';
  }

  // Any critical defense turned off constitutes an EXPOSED posture
  if (defenderRealtime === false || defenderRunning === false || firewallAllEnabled === false || uacEnabled === false) {
    return 'EXPOSED';
  }

  // All confirmed active
  if (defenderRealtime === true && defenderRunning === true && firewallAllEnabled === true && (uacEnabled === undefined || uacEnabled === true)) {
    return 'SECURE';
  }

  return 'PROTECTED_WITH_WARNINGS';
}

/**
 * Evaluates Windows Defender status from system snapshot or MpComputerStatus
 */
export function evaluateDefender(snapshot: {
  DefenderRunning?: boolean | null;
  DefenderRealtime?: boolean | null;
  DefenderSignatures?: string | null;
} | null | undefined): DefenderStatus {
  if (!snapshot) {
    return {
      available: false,
      running: false,
      realtimeEnabled: false,
      signatures: '',
      signatureAgeDays: null,
      tamperProtected: null,
      signatureStatus: 'UNKNOWN',
    };
  }

  const running = Boolean(snapshot.DefenderRunning);
  const realtime = Boolean(snapshot.DefenderRealtime);
  const signatures = snapshot.DefenderSignatures || '';

  return {
    available: running || realtime || Boolean(signatures),
    running,
    realtimeEnabled: realtime,
    signatures,
    signatureAgeDays: null,
    tamperProtected: null,
    signatureStatus: signatures ? 'CURRENT' : 'UNKNOWN',
  };
}

/**
 * Evaluates Windows Firewall profiles across Domain, Private, and Public
 */
export function evaluateFirewall(
  profiles: Array<{ Profile?: string; Enabled?: boolean }> | null | undefined
): FirewallEvaluation {
  if (!profiles || profiles.length === 0) {
    return {
      allEnabled: false,
      anyDisabled: false,
      totalProfiles: 0,
      enabledCount: 0,
      profiles: [],
    };
  }

  const normalized: FirewallProfileStatus[] = profiles.map((p) => ({
    profile: p.Profile || 'Unknown',
    enabled: Boolean(p.Enabled),
  }));

  const enabledCount = normalized.filter((p) => p.enabled).length;
  const allEnabled = normalized.length > 0 && enabledCount === normalized.length;
  const anyDisabled = normalized.some((p) => !p.enabled);

  return {
    allEnabled,
    anyDisabled,
    totalProfiles: normalized.length,
    enabledCount,
    profiles: normalized,
  };
}

/**
 * Evaluates UAC state
 */
export function evaluateUac(enableLua: number | boolean | null | undefined): UacStatus {
  if (enableLua === undefined || enableLua === null) {
    return {
      enabled: null,
      levelDescription: 'Policy not queried yet',
    };
  }
  const enabled = enableLua === 1 || enableLua === true;
  return {
    enabled,
    levelDescription: enabled
      ? 'User Account Control is active (EnableLUA = 1)'
      : 'User Account Control is disabled (EnableLUA = 0)',
  };
}

/**
 * Generates actionable security signals from measured observations
 */
export function detectSecuritySignals(
  defender: DefenderStatus,
  firewall: FirewallEvaluation,
  uac: UacStatus
): SecuritySignal[] {
  const signals: SecuritySignal[] = [];

  if (defender.available && !defender.running) {
    signals.push({
      code: 'DEFENDER_SERVICE_STOPPED',
      level: 'CRITICAL',
      messageEn: 'Windows Defender service (WinDefend) is not running.',
      messageAr: 'خدمة Windows Defender (WinDefend) متوقفة حالياً.',
      suggestedTool: 'SE03',
      evidenceSource: 'Service Control Manager: WinDefend',
    });
  }

  if (defender.available && !defender.realtimeEnabled) {
    signals.push({
      code: 'DEFENDER_REALTIME_DISABLED',
      level: 'CRITICAL',
      messageEn: 'Windows Defender real-time protection is disabled.',
      messageAr: 'الحماية الفورية في Windows Defender معطلة.',
      suggestedTool: 'SE02',
      evidenceSource: 'Get-MpComputerStatus: RealTimeProtectionEnabled',
    });
  }

  if (firewall.totalProfiles > 0 && firewall.anyDisabled) {
    signals.push({
      code: 'FIREWALL_PROFILE_DISABLED',
      level: 'HIGH',
      messageEn: `One or more Windows Firewall profiles are disabled (${firewall.enabledCount}/${firewall.totalProfiles} active).`,
      messageAr: `واحد أو أكثر من ملفات الجدار الناري معطل (${firewall.enabledCount}/${firewall.totalProfiles} مفعّل).`,
      suggestedTool: 'SE05',
      evidenceSource: 'netsh advfirewall / Get-NetFirewallProfile',
    });
  }

  if (uac.enabled === false) {
    signals.push({
      code: 'UAC_DISABLED',
      level: 'HIGH',
      messageEn: 'User Account Control (UAC) is disabled, allowing silent privilege elevation.',
      messageAr: 'التحكم في حساب المستخدم (UAC) معطل مما يسمح برفع الصلاحيات بصمت.',
      suggestedTool: 'SE07',
      evidenceSource: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System: EnableLUA',
    });
  }

  return signals;
}

/**
 * Filters registered tools to only those belonging to Station 09
 */
export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  const ids = new Set<string>(STATION09_TOOL_IDS);
  return tools.filter((t) => ids.has(t.ToolId) && t.Category === '09-Security');
}

/**
 * Maps execution result to standardized session history status
 */
export function outcomeFromRun(
  result: KnouxRunResult | null | undefined
): 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE' {
  if (!result) return 'INCONCLUSIVE';
  if (result.Status === 'Cancelled') return 'CANCELLED';
  if (result.Status === 'Success') return 'SUCCESS';
  if (result.Status === 'Warning') return 'WARNING';
  if (result.Status === 'Failed' || result.ExitCode !== 0) return 'FAILED';
  return 'INCONCLUSIVE';
}
