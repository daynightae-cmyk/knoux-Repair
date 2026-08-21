import type { BridgeRun, SystemDrive, SystemSnapshot } from './api';

export type RepairSignalState = 'ready' | 'passed' | 'review';
export type RepairRunState = 'idle' | 'ready' | 'running' | 'completed_healthy' | 'completed_issues' | 'failed' | 'cancelled';

export interface RepairCheck {
  id: 'fileIntegrity' | 'componentStore' | 'systemCapacity' | 'runtimeResources' | 'systemProtection';
  state: RepairSignalState;
}

export interface SystemRepairReadiness {
  systemDrive: SystemDrive | null;
  checks: RepairCheck[];
  reviewCount: number;
  score: number;
  gaugeDegrees: number;
}

export function findSystemDrive(system: Pick<SystemSnapshot, 'SystemDrive' | 'Drives'>): SystemDrive | null {
  const declared = system.SystemDrive?.trim().toLowerCase();
  return system.Drives.find((drive) => drive.IsSystem || (declared ? drive.Name.toLowerCase() === declared : false)) || system.Drives[0] || null;
}

export function computeReadiness(system: Pick<SystemSnapshot, 'SystemDrive' | 'Drives' | 'CpuLoad' | 'FreeRamGB' | 'TotalRamGB' | 'DefenderRealtime' | 'Firewall'>): SystemRepairReadiness {
  const systemDrive = findSystemDrive(system);
  const lowSystemStorage = systemDrive ? systemDrive.FreeGB / Math.max(1, systemDrive.TotalGB) < .1 : true;
  const highCpu = system.CpuLoad >= 85;
  const lowMemory = system.FreeRamGB / Math.max(1, system.TotalRamGB) < .15;
  const firewallOn = Boolean(system.Firewall?.length && system.Firewall.every((item) => item.Enabled));
  const checks: RepairCheck[] = [
    { id: 'fileIntegrity', state: 'ready' },
    { id: 'componentStore', state: 'ready' },
    { id: 'systemCapacity', state: lowSystemStorage ? 'review' : 'passed' },
    { id: 'runtimeResources', state: highCpu || lowMemory ? 'review' : 'passed' },
    { id: 'systemProtection', state: system.DefenderRealtime && firewallOn ? 'passed' : 'review' },
  ];
  const reviewCount = checks.filter((check) => check.state === 'review').length;
  const score = Math.max(52, 100 - reviewCount * 16);
  return { systemDrive, checks, reviewCount, score, gaugeDegrees: score * 3.6 };
}

export function classifyDiagnosticRun(run: BridgeRun | null): RepairRunState {
  if (!run) return 'idle';
  if (run.status === 'running') return 'running';
  if (run.status === 'cancelled') return 'cancelled';
  if (run.status === 'error') return 'failed';
  const status = String(run.result?.Status || '').toLowerCase();
  const verification = String(run.result?.VerificationResult || '').toLowerCase();
  if (status === 'success' && (verification === 'ok' || verification === 'repaired_verified')) return 'completed_healthy';
  if (status === 'warning' || status === 'inconclusive' || verification.includes('violation') || verification.includes('evidence')) return 'completed_issues';
  if (status === 'failed' || status === 'malformed') return 'failed';
  return run.status === 'success' ? 'completed_issues' : 'failed';
}
