export interface Tool {
  Id: string;
  Name: string;
  File: string;
  Risk: RiskLevel;
  RequiresAdmin: boolean;
  Category?: string;
}

export type RiskLevel =
  | 'READ_ONLY'
  | 'SAFE_CLEANUP'
  | 'SYSTEM_REPAIR'
  | 'REBOOT_REQUIRED'
  | 'DESTRUCTIVE';

export interface Category {
  Category: string;
  Folder: string;
  Tools: Tool[];
}

export type ToolStatus = 'idle' | 'running' | 'success' | 'error';

export type ConsoleEntryType = 'info' | 'success' | 'error' | 'warning' | 'system' | 'data';

export interface ConsoleEntry {
  id: number;
  text: string;
  type: ConsoleEntryType;
  timestamp: string;
}

export type ActiveSection =
  | 'dashboard'
  | 'maintenance'
  | 'cleanup'
  | 'network'
  | 'programs'
  | 'duplicates'
  | 'disk'
  | 'services'
  | 'performance'
  | 'security'
  | 'diagnostics'
  | 'reports'
  | 'quarantine'
  | 'backups'
  | 'settings'
  | 'about';

export const SECTION_MAP: Record<ActiveSection, string> = {
  dashboard: '',
  maintenance: '01-System-Maintenance',
  cleanup: '02-System-Cleanup',
  network: '03-Network-Internet',
  programs: '04-Programs-Applications',
  duplicates: '05-Duplicate-Files',
  disk: '06-Disk-Space',
  services: '07-Services-Processes',
  performance: '08-Performance',
  security: '09-Security',
  diagnostics: '10-Diagnostics-Reports',
  reports: '',
  quarantine: '',
  backups: '',
  settings: '',
  about: '',
};

export const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; border: string; glow: string }> = {
  READ_ONLY: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'neon-glow' },
  SAFE_CLEANUP: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', glow: 'neon-glow-green' },
  SYSTEM_REPAIR: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'neon-glow-amber' },
  REBOOT_REQUIRED: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', glow: 'neon-glow-amber' },
  DESTRUCTIVE: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: 'neon-glow-red' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  '01-System-Maintenance': 'SYSTEM MAINTENANCE',
  '02-System-Cleanup': 'SYSTEM CLEANUP',
  '03-Network-Internet': 'NETWORK & INTERNET',
  '04-Programs-Applications': 'PROGRAMS & APPS',
  '05-Duplicate-Files': 'DUPLICATE FILES',
  '06-Disk-Space': 'DISK SPACE',
  '07-Services-Processes': 'SERVICES & PROCESSES',
  '08-Performance': 'PERFORMANCE',
  '09-Security': 'SECURITY',
  '10-Diagnostics-Reports': 'DIAGNOSTICS',
};
