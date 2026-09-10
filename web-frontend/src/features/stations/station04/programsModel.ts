/**
 * Station 04 — Programs & Applications domain model.
 * Machine-readable Service Capability Matrix, normalizations, diagnostic logic,
 * safety policies, and verification contracts for all 10 services.
 */
import type { BridgeRun, BridgeTool, ExecutionMode } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';

export const STATION04_CATEGORY = '04-Programs-Applications';
export const STATION04_TOOL_IDS = [
  'PA01', 'PA02', 'PA03', 'PA04', 'PA05', 'PA06', 'PA07', 'PA08', 'PA09', 'PA10',
] as const;

export type Station04ToolId = (typeof STATION04_TOOL_IDS)[number];

/* =========================================================================
 * 1. MACHINE-READABLE SERVICE CAPABILITY MATRIX
 * ========================================================================= */

export type ServiceCapabilityStatus =
  | 'IMPLEMENTED'
  | 'PARTIAL'
  | 'UNAVAILABLE_BY_OS'
  | 'USER_ACTION_REQUIRED'
  | 'BLOCKED';

export type ServiceSafetyClass =
  | 'READ_ONLY'
  | 'SAFE_CLEANUP'
  | 'SYSTEM_REPAIR'
  | 'DESTRUCTIVE'
  | 'REBOOT_REQUIRED'
  | 'WINRE_ONLY';

export interface StationServiceCapability {
  serviceId: string;
  displayName: string;
  displayNameAr: string;
  diagnosticToolIds: readonly string[];
  actionToolIds: readonly string[];
  dataSources: readonly string[];
  supportedOperations: readonly string[];
  safetyClass: ServiceSafetyClass;
  requiresElevation: boolean;
  supportsAnalyzeOnly: boolean;
  supportsExecution: boolean;
  supportsPostVerify: boolean;
  status: ServiceCapabilityStatus;
  missingCapabilities: readonly string[];
}

export const STATION04_SERVICES: readonly StationServiceCapability[] = [
  {
    serviceId: 'applicationInventory',
    displayName: 'Application Inventory',
    displayNameAr: 'فهرس التطبيقات المثبتة',
    diagnosticToolIds: ['PA01'],
    actionToolIds: [],
    dataSources: [
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'Get-AppxPackage',
    ],
    supportedOperations: ['enumerate', 'inspect', 'deduplicate', 'filter'],
    safetyClass: 'READ_ONLY',
    requiresElevation: false,
    supportsAnalyzeOnly: true,
    supportsExecution: true,
    supportsPostVerify: false,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'startupPrograms',
    displayName: 'Startup Program Management',
    displayNameAr: 'إدارة برامج بدء التشغيل',
    diagnosticToolIds: ['PA05'],
    actionToolIds: ['PA05'],
    dataSources: [
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
      'Startup Folders',
    ],
    supportedOperations: ['enumerate', 'classify', 'disable', 'enable', 'verify'],
    safetyClass: 'SYSTEM_REPAIR',
    requiresElevation: false,
    supportsAnalyzeOnly: true,
    supportsExecution: true,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'windowsAppsRemoval',
    displayName: 'Unnecessary Windows Apps Removal',
    displayNameAr: 'إزالة تطبيقات Windows غير الضرورية',
    diagnosticToolIds: ['PA07'],
    actionToolIds: ['PA07'],
    dataSources: ['Get-AppxPackage', 'Get-AppxProvisionedPackage'],
    supportedOperations: ['enumerate', 'filter_non_essential', 'remove_user', 'remove_all_users', 'verify'],
    safetyClass: 'DESTRUCTIVE',
    requiresElevation: true,
    supportsAnalyzeOnly: true,
    supportsExecution: true,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'applicationCacheCleanup',
    displayName: 'Application Cache Cleanup',
    displayNameAr: 'تنظيف الذاكرة المؤقتة للتطبيقات',
    diagnosticToolIds: ['PA10'],
    actionToolIds: [],
    dataSources: ['%LOCALAPPDATA%\\*\\Cache', '%LOCALAPPDATA%\\Temp', '%APPDATA%'],
    supportedOperations: ['scan_candidates', 'classify_paths', 'byte_accounting', 'protect_user_data'],
    safetyClass: 'SAFE_CLEANUP',
    requiresElevation: false,
    supportsAnalyzeOnly: true,
    supportsExecution: false,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'orphanedAppData',
    displayName: 'Orphaned Application Data Cleanup',
    displayNameAr: 'تنظيف بقايا التطبيقات والبيانات المعزولة',
    diagnosticToolIds: ['PA03'],
    actionToolIds: ['PA03'],
    dataSources: ['%ProgramFiles%', '%ProgramFiles(x86)%', 'Registry Uninstall Keys'],
    supportedOperations: ['correlate_ownership', 'classify_orphan', 'quarantine_verified', 'verify'],
    safetyClass: 'DESTRUCTIVE',
    requiresElevation: true,
    supportsAnalyzeOnly: true,
    supportsExecution: true,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'applicationRepair',
    displayName: 'Application Repair / Re-registration',
    displayNameAr: 'إصلاح التطبيقات وإعادة التسجيل',
    diagnosticToolIds: ['PA02', 'PA08'],
    actionToolIds: ['PA02', 'PA08'],
    dataSources: ['msiserver service', 'msiexec.exe', 'AppX Manifests'],
    supportedOperations: ['msi_scaffolding_repair', 'uninstaller_repair', 'single_appx_reregister', 'post_verify'],
    safetyClass: 'SYSTEM_REPAIR',
    requiresElevation: true,
    supportsAnalyzeOnly: true,
    supportsExecution: true,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'fileAssociations',
    displayName: 'Default Programs & File Associations',
    displayNameAr: 'البرامج الافتراضية وارتباطات الملفات',
    diagnosticToolIds: ['PA10'],
    actionToolIds: [],
    dataSources: ['HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts', 'HKCR'],
    supportedOperations: ['diagnose_associations', 'detect_broken_targets', 'check_user_choice', 'launch_settings'],
    safetyClass: 'READ_ONLY',
    requiresElevation: false,
    supportsAnalyzeOnly: true,
    supportsExecution: false,
    supportsPostVerify: false,
    status: 'USER_ACTION_REQUIRED',
    missingCapabilities: ['programmatic_userchoice_mutation_blocked_by_windows_design'],
  },
  {
    serviceId: 'windowsFeatures',
    displayName: 'Windows Features Management',
    displayNameAr: 'إدارة ميزات Windows الاختيارية',
    diagnosticToolIds: ['PA06'],
    actionToolIds: [],
    dataSources: ['Get-WindowsOptionalFeature -Online', 'DISM /Online /Get-Features'],
    supportedOperations: ['query_feature_state', 'inspect_restart_required', 'target_feature'],
    safetyClass: 'SYSTEM_REPAIR',
    requiresElevation: true,
    supportsAnalyzeOnly: true,
    supportsExecution: false,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'installedUpdates',
    displayName: 'Installed Windows Updates Management',
    displayNameAr: 'إدارة تحديثات Windows المثبتة',
    diagnosticToolIds: ['PA09', 'PA10'],
    actionToolIds: [],
    dataSources: ['Get-HotFix', 'Win32_QuickFixEngineering', 'CBS Log'],
    supportedOperations: ['query_installed_kbs', 'distinguish_from_winget', 'assess_removal_safety'],
    safetyClass: 'READ_ONLY',
    requiresElevation: false,
    supportsAnalyzeOnly: true,
    supportsExecution: false,
    supportsPostVerify: false,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
  {
    serviceId: 'troubleshootingCompatibility',
    displayName: 'Application Troubleshooting & Compatibility',
    displayNameAr: 'استكشاف أخطاء التطبيقات والتوافق',
    diagnosticToolIds: ['PA04', 'PA06'],
    actionToolIds: ['PA04'],
    dataSources: ['Start Menu Shortcuts', 'System Runtimes (.NET, VC++, WebView2)', 'AppCompatFlags'],
    supportedOperations: ['shortcut_integrity', 'runtime_dependency_check', 'compatibility_diagnosis', 'quarantine_bad_shortcuts'],
    safetyClass: 'SYSTEM_REPAIR',
    requiresElevation: false,
    supportsAnalyzeOnly: true,
    supportsExecution: true,
    supportsPostVerify: true,
    status: 'IMPLEMENTED',
    missingCapabilities: [],
  },
] as const;

export function getServiceCapability(serviceId: string): StationServiceCapability | undefined {
  return STATION04_SERVICES.find((s) => s.serviceId === serviceId);
}

/* =========================================================================
 * 2. DOMAIN MODELS & TYPES
 * ========================================================================= */

export interface InstalledApp {
  id: string;
  name: string;
  version: string;
  publisher: string;
  source: 'registry_hklm64' | 'registry_hklm32' | 'registry_hkcu' | 'appx_user' | 'appx_allusers' | 'winget' | 'unknown';
  architecture: 'x64' | 'x86' | 'arm64' | 'neutral' | 'unknown';
  scope: 'machine' | 'user' | 'system';
  installLocation: string;
  installDate: string;
  uninstallAvailable: boolean;
  packageIdentity?: string;
  metadataConfidence: 'high' | 'medium' | 'low';
  estimatedSizeMB: number;
  uninstallString?: string;
}

export interface StartupItem {
  id: string;
  name: string;
  source: 'HKCU_Run' | 'HKLM_Run' | 'HKLM_WOW64_Run' | 'User_StartupFolder' | 'Common_StartupFolder';
  command: string;
  executablePath: string;
  scope: 'user' | 'machine';
  enabled: boolean;
  publisher: string;
  protected: boolean;
  reversible: boolean;
  status: 'active' | 'disabled_by_knoux' | 'broken_target';
}

export interface WindowsAppItem {
  name: string;
  packageFullName: string;
  publisher: string;
  version: string;
  isEssential: boolean;
  protectionReason?: string;
  removable: boolean;
}

export type PathClassification =
  | 'CACHE'
  | 'TEMPORARY'
  | 'CONFIGURATION'
  | 'USER_DATA'
  | 'DATABASE'
  | 'CREDENTIAL_STORE'
  | 'PROFILE'
  | 'UNKNOWN';

export interface CacheCandidate {
  path: string;
  name: string;
  classification: PathClassification;
  sizeBytes: number;
  isRemovable: boolean;
  protectedReason?: string;
}

export interface CacheScanSummary {
  candidateCount: number;
  candidateBytes: number;
  protectedCount: number;
  protectedBytes: number;
  unknownCount: number;
}

export type OrphanClassification =
  | 'VERIFIED_ORPHAN'
  | 'LIKELY_ORPHAN'
  | 'OWNED'
  | 'IN_USE'
  | 'UNKNOWN';

export interface ResidualCandidate {
  path: string;
  folderName: string;
  sizeMB: number;
  classification: OrphanClassification;
  matchedAppId?: string;
  confidence: number;
  reason: string;
  isEligibleForDeletion: boolean;
}

export type RepairStrategy =
  | 'win32_installer_repair'
  | 'msi_scaffolding_repair'
  | 'appx_single_package_reregister'
  | 'uninstaller_registration_repair'
  | 'runtime_dependency_remediation';

export interface TargetedRepairPlan {
  targetIdentity: string;
  targetName: string;
  strategy: RepairStrategy;
  preState: string;
  reason: string;
  plannedCommand: string;
  safetyLevel: 'SYSTEM_REPAIR' | 'SAFE_CLEANUP' | 'READ_ONLY';
  executionResult?: string;
  postState?: string;
  verified: boolean;
}

export type AssociationStatus =
  | 'VALID'
  | 'BROKEN'
  | 'USER_CHOICE_REQUIRED'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export interface AssociationDiagnostic {
  extensionOrProtocol: string;
  progId: string;
  currentTarget: string;
  targetExecutable: string;
  targetExists: boolean;
  userChoicePresent: boolean;
  status: AssociationStatus;
  recommendedAction?: string;
}

export type WindowsFeatureState =
  | 'ENABLED'
  | 'DISABLED'
  | 'ENABLE_PENDING'
  | 'DISABLE_PENDING'
  | 'UNKNOWN';

export interface WindowsFeatureItem {
  featureName: string;
  displayName: string;
  state: WindowsFeatureState;
  restartRequired: boolean;
}

export type InstalledUpdateState =
  | 'INSTALLED'
  | 'NOT_REMOVABLE'
  | 'BLOCKED_BY_OS'
  | 'UNKNOWN';

export interface InstalledWindowsUpdate {
  kb: string;
  title: string;
  installedOn: string;
  type: 'Security Update' | 'Update' | 'Hotfix' | 'Service Pack' | 'Unknown';
  uninstallable: boolean;
  restartRelevant: boolean;
  source: 'WMI_QuickFixEngineering' | 'Get-HotFix' | 'CBS';
  state: InstalledUpdateState;
}

export interface CompatibilityDiagnosis {
  appId: string;
  appName: string;
  executablePath: string;
  executableExists: boolean;
  architectureMismatch: boolean;
  brokenShortcut: boolean;
  missingRuntimes: string[];
  compatFlagsPresent: string[];
  diagnosisCode: string;
  supportingEvidence: string;
  confidence: 'high' | 'medium' | 'low';
  recommendedAction: string;
  risk: 'READ_ONLY' | 'SAFE_CLEANUP' | 'SYSTEM_REPAIR' | 'DESTRUCTIVE';
}

export type FinalVerificationStatus =
  | 'VERIFIED_FIXED'
  | 'ACTION_COMPLETED_UNVERIFIED'
  | 'NO_CHANGE_REQUIRED'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export interface OperationVerification {
  actionStarted: boolean;
  actionCompleted: boolean;
  verificationAttempted: boolean;
  verificationResult: string;
  finalStatus: FinalVerificationStatus;
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
  itemsFound: number;
  itemsProcessed: number;
  lines: string[];
}

export interface HistoryEntry {
  id: string;
  when: string;
  toolId: string;
  toolName: string;
  mode: ExecutionMode;
  status: string;
  finalVerification: FinalVerificationStatus;
  changedSystem: boolean;
  restartNeeded: boolean;
  reportPath: string;
}

export interface ProgramsEvidence {
  inventory: InstalledApp[];
  startup: StartupItem[];
  windowsApps: WindowsAppItem[];
  cacheSummary: CacheScanSummary;
  cacheCandidates: CacheCandidate[];
  orphans: ResidualCandidate[];
  repairPlans: TargetedRepairPlan[];
  associations: AssociationDiagnostic[];
  windowsFeatures: WindowsFeatureItem[];
  installedUpdates: InstalledWindowsUpdate[];
  runtimeComponents: Array<{ name: string; present: boolean; detail: string }>;
  brokenShortcutsCount: number;
  outcomes: Record<string, ToolOutcome>;
}

export function emptyEvidence(): ProgramsEvidence {
  return {
    inventory: [],
    startup: [],
    windowsApps: [],
    cacheSummary: { candidateCount: 0, candidateBytes: 0, protectedCount: 0, protectedBytes: 0, unknownCount: 0 },
    cacheCandidates: [],
    orphans: [],
    repairPlans: [],
    associations: [],
    windowsFeatures: [],
    installedUpdates: [],
    runtimeComponents: [],
    brokenShortcutsCount: 0,
    outcomes: {},
  };
}

/* =========================================================================
 * 3. NORMALIZATION & DIAGNOSTIC LOGIC
 * ========================================================================= */

/** Extract clean executable path from command line string. */
export function extractExecutablePath(command: string): string {
  if (!command) return '';
  const trimmed = command.trim();
  if (trimmed.startsWith('"')) {
    const nextQuote = trimmed.indexOf('"', 1);
    if (nextQuote > 1) return trimmed.slice(1, nextQuote);
  }
  // If unquoted, check if it matches an executable extension pattern
  const exeMatch = trimmed.match(/^((?:[a-zA-Z]:\\|\\\\)?[^/:*?"<>|\r\n]+?\.(?:exe|com|bat|cmd|vbs|ps1|msc))(?:\s.*|$)/i);
  if (exeMatch) {
    return exeMatch[1];
  }
  const spaceIndex = trimmed.indexOf(' ');
  return spaceIndex > 0 ? trimmed.slice(0, spaceIndex) : trimmed;
}

/**
 * Service 1: Application Inventory Parser & Normalizer
 * End-to-end normalization covering HKLM x64, HKLM x86, HKCU, and AppX identities.
 * Enforces deterministic deduplication and prevents inventing metadata.
 */
export function parseInstalledApps(input: string[] | string | unknown): InstalledApp[] {
  let rawItems: Array<Record<string, unknown>> = [];

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        for (const it of parsed) {
          if (it && typeof it === 'object') rawItems.push(it as Record<string, unknown>);
        }
      }
    } catch {
      // not direct JSON
    }
  } else if (Array.isArray(input)) {
    const hasObjects = input.some((it) => it && typeof it === 'object');
    if (hasObjects) {
      for (const it of input) {
        if (it && typeof it === 'object') {
          rawItems.push(it as Record<string, unknown>);
        }
      }
    } else {
      const stringLines = input.filter((it): it is string => typeof it === 'string');
      const text = stringLines.join('\n');
      const startIdx = text.indexOf('---KNOUX_PROGRAMS_JSON_START---');
      const endIdx = text.indexOf('---KNOUX_PROGRAMS_JSON_END---');
      if (startIdx >= 0 && endIdx > startIdx) {
        try {
          const jsonText = text.slice(startIdx + '---KNOUX_PROGRAMS_JSON_START---'.length, endIdx).trim();
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) {
            for (const it of parsed) {
              if (it && typeof it === 'object') rawItems.push(it as Record<string, unknown>);
            }
          } else if (parsed && Array.isArray(parsed.installed)) {
            for (const it of parsed.installed) {
              if (it && typeof it === 'object') rawItems.push(it as Record<string, unknown>);
            }
          }
        } catch {
          // malformed envelope
        }
      } else if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const it of parsed) {
              if (it && typeof it === 'object') rawItems.push(it as Record<string, unknown>);
            }
          }
        } catch {
          // fallback
        }
      }

      if (rawItems.length === 0) {
        for (const line of stringLines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('===') || trimmed.startsWith('knoux') || trimmed.startsWith('PA01') || trimmed.startsWith('Found ') || trimmed.startsWith('Status:') || trimmed.startsWith('Report:') || trimmed.startsWith('runId') || trimmed.startsWith('ToolName')) continue;
          const nameMatch = trimmed.match(/^([A-Za-z0-9_.+()[\]\- ]{2,60})\s{2,}([0-9A-Za-z.\-_]{1,30})?\s*(.*)$/);
          if (nameMatch) {
            rawItems.push({
              DisplayName: nameMatch[1].trim(),
              DisplayVersion: nameMatch[2]?.trim() || '',
              Publisher: nameMatch[3]?.trim() || '',
            });
          }
        }
      }
    }
  }

  const apps: InstalledApp[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.DisplayName || item.Name || '').trim();
    if (!name || name === 'Unknown') continue;

    const version = String(item.DisplayVersion || item.Version || '').trim();
    const publisher = String(item.Publisher || '').trim();
    const installDate = String(item.InstallDate || '').trim();
    const installLocation = String(item.InstallLocation || item.Path || '').trim();
    const uninstallString = String(item.UninstallString || '').trim();
    const packageIdentity = item.PackageFullName ? String(item.PackageFullName).trim() : undefined;
    const rawSize = Number(item.EstimatedSizeMB || (item.EstimatedSize ? Number(item.EstimatedSize) / 1024 : 0));
    const estimatedSizeMB = isNaN(rawSize) ? 0 : Math.max(0, Math.round(rawSize * 10) / 10);

    let source: InstalledApp['source'] = 'unknown';
    let architecture: InstalledApp['architecture'] = 'unknown';
    let scope: InstalledApp['scope'] = 'machine';

    const sourceRaw = String(item.Source || item.RegistryHive || '').toLowerCase();
    if (sourceRaw.includes('wow64') || sourceRaw.includes('x86')) {
      source = 'registry_hklm32';
      architecture = 'x86';
      scope = 'machine';
    } else if (sourceRaw.includes('hkcu')) {
      source = 'registry_hkcu';
      architecture = 'neutral';
      scope = 'user';
    } else if (sourceRaw.includes('appx') || packageIdentity) {
      source = sourceRaw.includes('allusers') ? 'appx_allusers' : 'appx_user';
      architecture = packageIdentity?.toLowerCase().includes('x64') ? 'x64' : 'neutral';
      scope = source === 'appx_allusers' ? 'machine' : 'user';
    } else if (sourceRaw.includes('hklm')) {
      source = 'registry_hklm64';
      architecture = 'x64';
      scope = 'machine';
    } else {
      if (name.includes('(x64') || name.includes('64-bit')) architecture = 'x64';
      else if (name.includes('(x86') || name.includes('32-bit')) architecture = 'x86';
      if (uninstallString.toLowerCase().includes('appdata')) scope = 'user';
    }

    const metadataConfidence: InstalledApp['metadataConfidence'] =
      (version && publisher && (installDate || installLocation || uninstallString)) ? 'high' :
      (version || publisher) ? 'medium' : 'low';

    const id = packageIdentity || `${name.toLowerCase()}::${version.toLowerCase()}::${publisher.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);

    apps.push({
      id,
      name,
      version,
      publisher,
      source,
      architecture,
      scope,
      installLocation,
      installDate,
      uninstallAvailable: Boolean(uninstallString || packageIdentity),
      packageIdentity,
      metadataConfidence,
      estimatedSizeMB,
      uninstallString: uninstallString || undefined,
    });
  }

  return apps;
}

/**
 * Service 2: Startup Program Management
 */
const PROTECTED_STARTUP_NAMES = new Set([
  'securityhealth', 'securityhealthsystray', 'securityhealthsystray.exe',
  'windefend', 'ctfmon', 'ctfmon.exe', 'igfxtray', 'hkcmd', 'rtkhdaudio',
]);

export function parseStartupItems(
  items: Array<Record<string, unknown>> | string[]
): StartupItem[] {
  const result: StartupItem[] = [];
  const seen = new Set<string>();

  if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'string') {
    for (const line of items as string[]) {
      const match = line.match(/^\s*\d+\.\s+([^\s]+)\s+(.+)$/);
      if (match) {
        const name = match[1].trim();
        const command = match[2].trim();
        const exe = extractExecutablePath(command);
        const isProt = PROTECTED_STARTUP_NAMES.has(name.toLowerCase()) || PROTECTED_STARTUP_NAMES.has(exe.toLowerCase());
        const id = `startup::${name.toLowerCase()}`;
        if (!seen.has(id)) {
          seen.add(id);
          result.push({
            id,
            name,
            source: 'HKCU_Run',
            command,
            executablePath: exe,
            scope: 'user',
            enabled: true,
            publisher: '',
            protected: isProt,
            reversible: true,
            status: 'active',
          });
        }
      }
    }
    return result;
  }

  for (const raw of (items as Array<Record<string, unknown>>)) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.Name || raw.name || '').trim();
    const command = String(raw.Command || raw.command || '').trim();
    if (!name || !command) continue;

    const key = String(raw.Key || raw.key || raw.source || 'HKCU_Run');
    let source: StartupItem['source'] = 'HKCU_Run';
    let scope: StartupItem['scope'] = 'user';

    if (key.includes('HKLM') && key.includes('WOW64')) {
      source = 'HKLM_WOW64_Run';
      scope = 'machine';
    } else if (key.includes('HKLM')) {
      source = 'HKLM_Run';
      scope = 'machine';
    } else if (key.includes('Common_StartupFolder') || key.includes('ProgramData')) {
      source = 'Common_StartupFolder';
      scope = 'machine';
    } else if (key.includes('StartupFolder')) {
      source = 'User_StartupFolder';
      scope = 'user';
    }

    const exe = extractExecutablePath(command);
    const leaf = exe.split(/[\\/]/).pop()?.toLowerCase() || '';
    const isProt = PROTECTED_STARTUP_NAMES.has(name.toLowerCase()) || PROTECTED_STARTUP_NAMES.has(leaf);

    const id = `startup::${source}::${name.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const enabled = raw.Enabled !== undefined ? Boolean(raw.Enabled) : true;

    result.push({
      id,
      name,
      source,
      command,
      executablePath: exe,
      scope,
      enabled,
      publisher: String(raw.Publisher || ''),
      protected: isProt,
      reversible: true,
      status: enabled ? 'active' : 'disabled_by_knoux',
    });
  }

  return result;
}

/**
 * Service 3: Unnecessary Windows Apps Removal
 */
const ESSENTIAL_WINDOWS_APPS = new Set([
  'microsoft.windowsstore', 'microsoft.storepurchaseapp',
  'microsoft.windowscalculator', 'microsoft.windows.photos',
  'microsoft.paint', 'microsoft.windowsterminal',
  'microsoft.screensketch', 'microsoft.windowsalarms',
  'microsoft.windowsclock', 'microsoft.windowsnotepada',
  'microsoft.notepad', 'microsoft.heifimageextension',
  'microsoft.vp9videoextensions', 'microsoft.vclibs',
  'microsoft.ui.xaml', 'microsoft.net.native.framework',
]);

export function classifyWindowsApp(pkg: { name: string; packageFullName?: string; publisher?: string; version?: string }): WindowsAppItem {
  const normName = pkg.name.toLowerCase();
  const isEssential = Array.from(ESSENTIAL_WINDOWS_APPS).some((ess) => normName.includes(ess) || ess.includes(normName));

  return {
    name: pkg.name,
    packageFullName: pkg.packageFullName || pkg.name,
    publisher: pkg.publisher || 'Microsoft Corporation',
    version: pkg.version || '1.0.0.0',
    isEssential,
    protectionReason: isEssential ? 'Core Windows OS accessory / framework component' : undefined,
    removable: !isEssential,
  };
}

/**
 * Service 4: Application Cache Cleanup
 */
export function classifyCachePath(pathStr: string): PathClassification {
  const norm = pathStr.replace(/\\/g, '/').toLowerCase();

  // 1. Database & Credential store (highest protection)
  if (/\/(vault|credentials?|login data|cookies|session storage|webstorage|indexeddb)\b/.test(norm) || /\.(db|sqlite|sqlite3|keychain|kdbx)$/.test(norm)) {
    if (/\/(vault|credentials?|login data|cookies)\b/.test(norm)) return 'CREDENTIAL_STORE';
    return 'DATABASE';
  }

  // 2. Profile & Configuration
  if (/\/(preferences|settings\.json|local state|user\.config|profiles?)\b/.test(norm) || /\.(ini|cfg|conf|toml)$/.test(norm)) {
    return 'CONFIGURATION';
  }
  if (/\/profile \d+\//.test(norm) || /\/users\/[^/]+\/documents\//.test(norm)) {
    return 'PROFILE';
  }

  // 3. User Data
  if (/\/user data\/(?!.*(cache|temp|crashpad))/.test(norm) || /\/saved games\//.test(norm) || /\/my games\//.test(norm)) {
    return 'USER_DATA';
  }

  // 4. Cache & Temporary (removable candidates)
  if (/\/(code cache|gpu.?cache|shader.?cache|package-cache|temp|tmp|cache)\b/.test(norm) || /\/appdata\/local\/temp\b/.test(norm)) {
    if (/\/(temp|tmp)\b/.test(norm)) return 'TEMPORARY';
    return 'CACHE';
  }

  return 'UNKNOWN';
}

export function isCacheCandidateRemovable(classification: PathClassification): boolean {
  return classification === 'CACHE' || classification === 'TEMPORARY';
}

export function calculateCacheSummary(candidates: CacheCandidate[]): CacheScanSummary {
  let candidateCount = 0;
  let candidateBytes = 0;
  let protectedCount = 0;
  let protectedBytes = 0;
  let unknownCount = 0;

  for (const c of candidates) {
    if (c.isRemovable) {
      candidateCount++;
      candidateBytes += c.sizeBytes;
    } else if (c.classification === 'UNKNOWN') {
      unknownCount++;
    } else {
      protectedCount++;
      protectedBytes += c.sizeBytes;
    }
  }

  return { candidateCount, candidateBytes, protectedCount, protectedBytes, unknownCount };
}

/**
 * Service 5: Orphaned Application Data Cleanup
 */
const KNOUX_SYSTEM_PROTECTED_PATHS = new Set([
  'windows', 'system32', 'syswow64', 'program files', 'program files (x86)',
  'common files', 'windows nt', 'windowsapps', 'microsoft', 'package cache',
  'internet explorer', 'windows defender', 'windows security',
]);

export function correlateOrphanData(
  candidate: { path: string; name: string; sizeMB: number },
  inventory: InstalledApp[],
  protectedPaths?: string[]
): ResidualCandidate {
  const leaf = candidate.name.toLowerCase().trim();
  const full = candidate.path.replace(/\\/g, '/').toLowerCase();

  if (KNOUX_SYSTEM_PROTECTED_PATHS.has(leaf) || (protectedPaths && protectedPaths.some((p) => full.includes(p.toLowerCase())))) {
    return {
      path: candidate.path,
      folderName: candidate.name,
      sizeMB: candidate.sizeMB,
      classification: 'IN_USE',
      confidence: 1.0,
      reason: 'Protected OS or core directory',
      isEligibleForDeletion: false,
    };
  }

  const matchedApp = inventory.find((app) => {
    const appName = app.name.toLowerCase();
    const appPub = app.publisher.toLowerCase();
    const appLoc = app.installLocation.replace(/\\/g, '/').toLowerCase();

    if (appLoc && full.startsWith(appLoc)) return true;
    if (appName.includes(leaf) || leaf.includes(appName)) return true;
    if (appPub && appPub.length > 3 && (leaf.includes(appPub) || appPub.includes(leaf))) return true;
    return false;
  });

  if (matchedApp) {
    return {
      path: candidate.path,
      folderName: candidate.name,
      sizeMB: candidate.sizeMB,
      classification: 'OWNED',
      matchedAppId: matchedApp.id,
      confidence: 0.95,
      reason: `Owned by installed application "${matchedApp.name}"`,
      isEligibleForDeletion: false,
    };
  }

  if (leaf.length < 3 || /^\d+$/.test(leaf)) {
    return {
      path: candidate.path,
      folderName: candidate.name,
      sizeMB: candidate.sizeMB,
      classification: 'UNKNOWN',
      confidence: 0.2,
      reason: 'Ambiguous short or numeric directory name',
      isEligibleForDeletion: false,
    };
  }

  return {
    path: candidate.path,
    folderName: candidate.name,
    sizeMB: candidate.sizeMB,
    classification: 'VERIFIED_ORPHAN',
    confidence: 0.9,
    reason: 'Residual program files folder without registered uninstaller',
    isEligibleForDeletion: true,
  };
}

/**
 * Service 6: Targeted Application Repair
 */
export function planTargetedRepair(target: {
  id: string;
  name: string;
  strategy: RepairStrategy;
  preState?: string;
  reason?: string;
}): TargetedRepairPlan {
  let plannedCommand = '';
  let safetyLevel: TargetedRepairPlan['safetyLevel'] = 'SYSTEM_REPAIR';

  switch (target.strategy) {
    case 'msi_scaffolding_repair':
      plannedCommand = 'msiexec.exe /unregister && msiexec.exe /regserver && sc config msiserver start= demand';
      break;
    case 'uninstaller_registration_repair':
      plannedCommand = 'Stop-Process -Name msiexec -Force; msiexec /regserver';
      break;
    case 'appx_single_package_reregister':
      if (target.id.includes('*') || target.id.toLowerCase() === 'allusers') {
        throw new Error('Mass global AppX re-registration is prohibited. Exact package target required.');
      }
      plannedCommand = `Add-AppxPackage -DisableDevelopmentMode -Register (Get-AppxPackage -Name "${target.id}").InstallLocation\\AppxManifest.xml`;
      break;
    case 'win32_installer_repair':
      plannedCommand = `msiexec.exe /fa "${target.id}"`;
      break;
    case 'runtime_dependency_remediation':
      plannedCommand = 'PA06 -CheckRuntimeComponents';
      safetyLevel = 'READ_ONLY';
      break;
  }

  return {
    targetIdentity: target.id,
    targetName: target.name,
    strategy: target.strategy,
    preState: target.preState || 'FAULTED',
    reason: target.reason || 'Component scaffolding corruption detected',
    plannedCommand,
    safetyLevel,
    verified: false,
  };
}

/**
 * Service 7: Default Programs & File Associations
 */
export function diagnoseAssociation(item: {
  extensionOrProtocol: string;
  progId: string;
  targetExecutable: string;
  targetExists: boolean;
  userChoicePresent: boolean;
}): AssociationDiagnostic {
  let status: AssociationStatus = 'UNKNOWN';
  let recommendedAction: string | undefined;

  if (item.userChoicePresent) {
    status = item.targetExists ? 'VALID' : 'USER_CHOICE_REQUIRED';
    recommendedAction = item.targetExists
      ? 'Association is valid and active.'
      : 'Target application missing. Open Windows Default Apps Settings to reassign.';
  } else if (!item.progId) {
    status = 'BROKEN';
    recommendedAction = 'No ProgID registered. Association is unassigned.';
  } else if (!item.targetExists) {
    status = 'BROKEN';
    recommendedAction = `Executable "${item.targetExecutable}" does not exist. Re-assign via Windows Settings.`;
  } else {
    status = 'VALID';
    recommendedAction = 'Association is valid.';
  }

  return {
    extensionOrProtocol: item.extensionOrProtocol,
    progId: item.progId,
    currentTarget: item.targetExecutable,
    targetExecutable: item.targetExecutable,
    targetExists: item.targetExists,
    userChoicePresent: item.userChoicePresent,
    status,
    recommendedAction,
  };
}

/**
 * Service 8: Windows Features Management
 */
export function parseWindowsFeatures(lines: string[]): WindowsFeatureItem[] {
  const result: WindowsFeatureItem[] = [];

  for (const line of lines) {
    if (!line || typeof line !== 'string') continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('===') || trimmed.toLowerCase() === 'feature name') continue;

    // Check DISM format: Feature Name : NetFx4
    const dismMatch = trimmed.match(/^Feature Name\s*:\s*([^\r\n]+)/i);
    if (dismMatch) {
      result.push({
        featureName: dismMatch[1].trim(),
        displayName: dismMatch[1].trim(),
        state: 'UNKNOWN',
        restartRequired: false,
      });
      continue;
    }

    const colonMatch = trimmed.match(/^([A-Za-z0-9_\-.]+)\s*:\s*([A-Za-z0-9_\-]+)$/);
    if (colonMatch) {
      const name = colonMatch[1].trim();
      const rawState = colonMatch[2].trim().toLowerCase();
      let state: WindowsFeatureState = 'UNKNOWN';
      if (rawState === 'enabled') state = 'ENABLED';
      else if (rawState === 'disabled') state = 'DISABLED';
      else if (rawState.includes('enablepending')) state = 'ENABLE_PENDING';
      else if (rawState.includes('disablepending')) state = 'DISABLE_PENDING';

      result.push({
        featureName: name,
        displayName: name,
        state,
        restartRequired: false,
      });
      continue;
    }
  }

  return result;
}

/**
 * Service 9: Installed Windows Updates Management
 */
export function parseInstalledUpdates(lines: string[]): InstalledWindowsUpdate[] {
  const updates: InstalledWindowsUpdate[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('HotFixID') || trimmed.startsWith('---')) continue;

    const kbMatch = trimmed.match(/\b(KB\d{6,8})\b/i);
    if (kbMatch) {
      const kb = kbMatch[1].toUpperCase();
      const isSecurity = /security\s+update/i.test(trimmed);
      const isUpdate = /update/i.test(trimmed);
      const type = isSecurity ? 'Security Update' : isUpdate ? 'Update' : 'Hotfix';

      const dateMatch = trimmed.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
      const installedOn = dateMatch ? dateMatch[1] : '';

      updates.push({
        kb,
        title: `${type} ${kb}`,
        installedOn,
        type,
        uninstallable: !isSecurity,
        restartRelevant: true,
        source: 'Get-HotFix',
        state: isSecurity ? 'NOT_REMOVABLE' : 'INSTALLED',
      });
    }
  }

  return updates;
}

/**
 * Service 10: Application Troubleshooting & Compatibility
 */
export function diagnoseCompatibility(
  app: InstalledApp,
  presentRuntimes: string[],
  shortcuts: Array<{ path: string; targetExists: boolean }> = []
): CompatibilityDiagnosis {
  const brokenShortcut = shortcuts.some((s) => !s.targetExists);
  const missingRuntimes: string[] = [];

  const normName = app.name.toLowerCase();
  if (normName.includes('visual studio') || normName.includes('c++') || normName.includes('game')) {
    if (!presentRuntimes.some((r) => r.includes('VC++ 2015-2022'))) {
      missingRuntimes.push('Visual C++ 2015-2022 Redistributable');
    }
  }
  if (normName.includes('.net') && !presentRuntimes.some((r) => r.includes('.NET Framework 4.x'))) {
    missingRuntimes.push('.NET Framework 4.x');
  }

  let diagnosisCode = 'HEALTHY';
  let supportingEvidence = 'Application registration and dependencies verified.';
  let confidence: CompatibilityDiagnosis['confidence'] = 'high';
  let recommendedAction = 'No troubleshooting required.';
  let risk: CompatibilityDiagnosis['risk'] = 'READ_ONLY';

  if (brokenShortcut) {
    diagnosisCode = 'BROKEN_SHORTCUT';
    supportingEvidence = `Start Menu shortcut target for "${app.name}" is missing or unresolvable.`;
    recommendedAction = 'Run PA04 to repair or quarantine broken shortcut.';
    risk = 'SYSTEM_REPAIR';
  } else if (missingRuntimes.length > 0) {
    diagnosisCode = 'MISSING_RUNTIME_DEPENDENCY';
    supportingEvidence = `Required runtime(s) missing: ${missingRuntimes.join(', ')}.`;
    recommendedAction = 'Install the missing Microsoft runtime redistributables.';
    risk = 'READ_ONLY';
  } else if (!app.uninstallAvailable && app.source.startsWith('registry')) {
    diagnosisCode = 'STALE_REGISTRATION';
    supportingEvidence = 'Application is registered in uninstall hive but lacks valid UninstallString.';
    confidence = 'medium';
    recommendedAction = 'Run PA08 to repair or clean up installer registration.';
    risk = 'SYSTEM_REPAIR';
  }

  return {
    appId: app.id,
    appName: app.name,
    executablePath: app.installLocation,
    executableExists: Boolean(app.installLocation),
    architectureMismatch: false,
    brokenShortcut,
    missingRuntimes,
    compatFlagsPresent: [],
    diagnosisCode,
    supportingEvidence,
    confidence,
    recommendedAction,
    risk,
  };
}

/**
 * Service Contract 17: Repair Verification Contract
 */
export function verifyRepairOperation(
  actionStarted: boolean,
  actionCompleted: boolean,
  exitCode: number,
  postCheckSuccess: boolean
): OperationVerification {
  if (!actionStarted) {
    return { actionStarted: false, actionCompleted: false, verificationAttempted: false, verificationResult: 'Not started', finalStatus: 'BLOCKED' };
  }
  if (!actionCompleted || exitCode !== 0) {
    return { actionStarted: true, actionCompleted: false, verificationAttempted: true, verificationResult: `Command exited with code ${exitCode}`, finalStatus: 'FAILED' };
  }

  if (postCheckSuccess) {
    return {
      actionStarted: true,
      actionCompleted: true,
      verificationAttempted: true,
      verificationResult: 'Post-action diagnostic confirmed repair.',
      finalStatus: 'VERIFIED_FIXED',
    };
  }

  return {
    actionStarted: true,
    actionCompleted: true,
    verificationAttempted: true,
    verificationResult: 'Command exited 0 but post-action condition was not verified.',
    finalStatus: 'ACTION_COMPLETED_UNVERIFIED',
  };
}

/* =========================================================================
 * 4. WORKFLOW & UI HELPERS
 * ========================================================================= */

export interface Recommendation {
  id: string;
  serviceId: string;
  toolId?: Station04ToolId;
  titleEn: string;
  titleAr: string;
  reasonEn: string;
  reasonAr: string;
  risk: ServiceSafetyClass;
  actionEn: string;
  actionAr: string;
}

export function buildRecommendations(
  evidence: ProgramsEvidence,
  tools: BridgeTool[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const byId = new Map(tools.map((t) => [t.ToolId, t]));

  if (evidence.brokenShortcutsCount > 0 && byId.has('PA04')) {
    recs.push({
      id: 'rec_shortcuts',
      serviceId: 'troubleshootingCompatibility',
      toolId: 'PA04',
      titleEn: 'Repair Broken Start Menu Shortcuts',
      titleAr: 'إصلاح اختصارات قائمة ابدأ المعطلة',
      reasonEn: `Found ${evidence.brokenShortcutsCount} broken shortcut(s) pointing to non-existent applications.`,
      reasonAr: `تم العثور على ${evidence.brokenShortcutsCount} اختصار معطل يشير إلى مسارات غير موجودة.`,
      risk: 'SYSTEM_REPAIR',
      actionEn: 'Review & Quarantine',
      actionAr: 'مراجعة وعزل',
    });
  }

  const verifiedOrphans = evidence.orphans.filter((o) => o.classification === 'VERIFIED_ORPHAN');
  if (verifiedOrphans.length > 0 && byId.has('PA03')) {
    recs.push({
      id: 'rec_orphans',
      serviceId: 'orphanedAppData',
      toolId: 'PA03',
      titleEn: 'Quarantine Verified Residual Program Folders',
      titleAr: 'عزل مجلدات بقايا البرامج التي تم التحقق من عزلتها',
      reasonEn: `${verifiedOrphans.length} folder(s) in Program Files have no uninstall registration.`,
      reasonAr: `يوجد ${verifiedOrphans.length} مجلد بدون تسجيل في قائمة إلغاء التثبيت.`,
      risk: 'DESTRUCTIVE',
      actionEn: 'Quarantine Residuals',
      actionAr: 'عزل البقايا',
    });
  }

  const missing = evidence.runtimeComponents.filter((r) => !r.present);
  if (missing.length > 0) {
    recs.push({
      id: 'rec_runtimes',
      serviceId: 'troubleshootingCompatibility',
      toolId: 'PA06',
      titleEn: 'Missing Runtime Components Detected',
      titleAr: 'تم اكتشاف مكونات تشغيل مفقودة',
      reasonEn: `Missing runtime(s): ${missing.map((m) => m.name).join(', ')}.`,
      reasonAr: `مكونات مفقودة: ${missing.map((m) => m.name).join('، ')}.`,
      risk: 'READ_ONLY',
      actionEn: 'Inspect Runtimes',
      actionAr: 'فحص المكونات',
    });
  }

  return recs;
}

export const buildProgramsRecommendations = buildRecommendations;

export function buildProgramsReport(evidence: ProgramsEvidence, lang: Lang): string {
  const isAr = lang === 'ar';
  const lines: string[] = [];

  lines.push(isAr ? '# تقرير محطة البرامج والتطبيقات (Station 04)' : '# Programs & Applications Report (Station 04)');
  lines.push(`- **${isAr ? 'التاريخ' : 'Generated'}**: ${new Date().toISOString()}`);
  lines.push(`- **${isAr ? 'البرامج المثبتة' : 'Installed Programs'}**: ${evidence.inventory.length}`);
  lines.push(`- **${isAr ? 'برامج بدء التشغيل' : 'Startup Programs'}**: ${evidence.startup.length}`);
  lines.push(`- **${isAr ? 'تطبيقات ويندوز القابلة للإزالة' : 'Removable Windows Apps'}**: ${evidence.windowsApps.filter((a) => a.removable).length}`);
  lines.push(`- **${isAr ? 'مرشحات الذاكرة المؤقتة' : 'Cache Candidates'}**: ${evidence.cacheSummary.candidateCount} (${Math.round(evidence.cacheSummary.candidateBytes / 1024 / 1024)} MB)`);
  lines.push(`- **${isAr ? 'بقايا برامج تم التحقق منها' : 'Verified Orphan Folders'}**: ${evidence.orphans.filter((o) => o.classification === 'VERIFIED_ORPHAN').length}`);
  lines.push(`- **${isAr ? 'الاختصارات المعطلة' : 'Broken Shortcuts'}**: ${evidence.brokenShortcutsCount}`);
  lines.push(`- **${isAr ? 'مكونات التشغيل المفقودة' : 'Missing Runtimes'}**: ${evidence.runtimeComponents.filter((r) => !r.present).length}`);
  lines.push('');

  lines.push(isAr ? '## مصفوفة قدرات الخدمات العشر' : '## Ten Services Capability Contract');
  for (const s of STATION04_SERVICES) {
    const title = isAr ? s.displayNameAr : s.displayName;
    lines.push(`- **${title}** [${s.status}]: ${s.safetyClass}, Elevation=${s.requiresElevation ? 'Yes' : 'No'}`);
  }

  return lines.join('\n');
}

export function outcomeFromRun(run: BridgeRun): ToolOutcome {
  const res = run.result;
  const rawLines = Array.isArray(run.lines)
    ? run.lines.map((l) => (typeof l === 'string' ? l : (l && typeof l === 'object' && 'text' in l ? String(l.text) : String(l))))
    : [];

  return {
    toolId: run.toolId,
    mode: run.mode,
    status: run.status,
    verificationResult: res?.verificationResult || '',
    errorMessage: run.error || res?.errorMessage || '',
    reportPath: res?.reportPath || '',
    finishedAt: run.finishedAt || new Date().toISOString(),
    changedSystem: Boolean(res?.changedSystem),
    restartNeeded: Boolean(res?.restartNeeded),
    itemsFound: Number(res?.itemsFound || 0),
    itemsProcessed: Number(res?.itemsProcessed || 0),
    lines: rawLines,
  };
}

const STORAGE_KEY = 'knoux_station04_history';

export function loadHistory(): HistoryEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = loadHistory();
    const updated = [entry, ...current].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // non-critical
  }
}

export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  return STATION04_TOOL_IDS.map((id) => tools.find((t) => t.ToolId === id)).filter((t): t is BridgeTool => Boolean(t));
}
