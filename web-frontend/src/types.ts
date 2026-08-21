export interface Tool {
  ToolId: string;
  Category: string;
  ScriptPath: string;
  EnglishName: string;
  ArabicName: string;
  Purpose: string;
  RiskLevel: RiskLevel;
  RequiresAdmin: boolean;
}

export type RiskLevel =
  | 'READ_ONLY'
  | 'SAFE_CLEANUP'
  | 'SYSTEM_REPAIR'
  | 'REBOOT_REQUIRED'
  | 'DESTRUCTIVE';

export type ToolStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

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
  | 'backupRecovery'
  | 'developerTools'
  | 'privacy'
  | 'drivers'
  | 'monitoring'
  | 'softwareEnvironment'
  | 'postInstall'
  | 'projectSonar'
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
  backupRecovery: '11-Backup-Recovery',
  developerTools: '12-Developer-Tools',
  privacy: '13-Privacy',
  drivers: '14-Driver-Management',
  monitoring: '15-System-Monitoring',
  softwareEnvironment: '16-Software-Environment',
  postInstall: '17-PostInstall-Setup',
  projectSonar: '18-Project-Sonar',
  reports: '',
  quarantine: '',
  backups: '',
  settings: '',
  about: '',
};

export interface CategoryConfig {
  id: string;
  name: string;
  arabicName: string;
  purpose: string;
  arabicPurpose: string;
  accent: string;
  gradientFrom: string;
  gradientTo: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  '01-System-Maintenance': {
    id: '01-System-Maintenance',
    name: 'System Maintenance',
    arabicName: 'صيانة النظام',
    purpose: 'Health verification, component repair, and system file integrity',
    arabicPurpose: 'التحقق من الصحة وإصلاح المكونات وسلامة ملفات النظام',
    accent: '#3B82F6',
    gradientFrom: 'from-blue-900/20',
    gradientTo: 'to-blue-500/5',
  },
  '02-System-Cleanup': {
    id: '02-System-Cleanup',
    name: 'System Cleanup',
    arabicName: 'تنظيف النظام',
    purpose: 'Safe removal of temporary files, cache, and recoverable space',
    arabicPurpose: 'الإزالة الآمنة للملفات المؤقتة والذاكرة والمساحة القابلة للاسترداد',
    accent: '#10B981',
    gradientFrom: 'from-emerald-900/20',
    gradientTo: 'to-emerald-500/5',
  },
  '03-Network-Internet': {
    id: '03-Network-Internet',
    name: 'Network & Internet',
    arabicName: 'الشبكة والإنترنت',
    purpose: 'Network diagnostics, connectivity tests, and stack repair',
    arabicPurpose: 'تشخيص الشبكة واختبارات الاتصال وإصلاح المكدس',
    accent: '#06B6D4',
    gradientFrom: 'from-cyan-900/20',
    gradientTo: 'to-cyan-500/5',
  },
  '04-Programs-Applications': {
    id: '04-Programs-Applications',
    name: 'Programs & Applications',
    arabicName: 'البرامج والتطبيقات',
    purpose: 'Application management, startup control, and installation repair',
    arabicPurpose: 'إدارة التطبيقات والتحكم ببدء التشغيل وإصلاح التثبيتات',
    accent: '#F97316',
    gradientFrom: 'from-orange-900/20',
    gradientTo: 'to-orange-500/5',
  },
  '05-Duplicate-Files': {
    id: '05-Duplicate-Files',
    name: 'Duplicate Files',
    arabicName: 'الملفات المكررة',
    purpose: 'Content hashing, duplicate detection, and quarantine recovery',
    arabicPurpose: 'تجزئة المحتوى وكشف التكرارات واستعادة الحجر الصحي',
    accent: '#EC4899',
    gradientFrom: 'from-pink-900/20',
    gradientTo: 'to-pink-500/5',
  },
  '06-Disk-Space': {
    id: '06-Disk-Space',
    name: 'Disk Space',
    arabicName: 'مساحة القرص',
    purpose: 'Storage analysis, large file discovery, and capacity recovery',
    arabicPurpose: 'تحليل التخزين واكتشاف الملفات الكبيرة واستعادة السعة',
    accent: '#8B5CF6',
    gradientFrom: 'from-violet-900/20',
    gradientTo: 'to-violet-500/5',
  },
  '07-Services-Processes': {
    id: '07-Services-Processes',
    name: 'Services & Processes',
    arabicName: 'الخدمات والعمليات',
    purpose: 'Service administration, process monitoring, and dependency analysis',
    arabicPurpose: 'إدارة الخدمات ومراقبة العمليات وتحليل التبعيات',
    accent: '#F59E0B',
    gradientFrom: 'from-amber-900/20',
    gradientTo: 'to-amber-500/5',
  },
  '08-Performance': {
    id: '08-Performance',
    name: 'Performance',
    arabicName: 'الأداء',
    purpose: 'Resource sampling, boot analysis, and thermal monitoring',
    arabicPurpose: 'أخذ عينات الموارد وتحليل الإقلاع ومراقبة الحرارة',
    accent: '#EF4444',
    gradientFrom: 'from-red-900/20',
    gradientTo: 'to-red-500/5',
  },
  '09-Security': {
    id: '09-Security',
    name: 'Security',
    arabicName: 'الأمان',
    purpose: 'Security posture audit, Defender status, and firewall control',
    arabicPurpose: 'تدقيق الوضع الأمني وحالة Defender والتحكم بالجدار الناري',
    accent: '#14B8A6',
    gradientFrom: 'from-teal-900/20',
    gradientTo: 'to-teal-500/5',
  },
  '10-Diagnostics-Reports': {
    id: '10-Diagnostics-Reports',
    name: 'Diagnostics & Reports',
    arabicName: 'التشخيص والتقارير',
    purpose: 'System information, hardware summary, and diagnostic evidence',
    arabicPurpose: 'معلومات النظام وملخص العتاد والأدلة التشخيصية',
    accent: '#6366F1',
    gradientFrom: 'from-indigo-900/20',
    gradientTo: 'to-indigo-500/5',
  },
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
  '11-Backup-Recovery': 'BACKUP & RECOVERY',
  '12-Developer-Tools': 'DEVELOPER TOOLS',
  '13-Privacy': 'PRIVACY',
  '14-Driver-Management': 'DRIVER MANAGEMENT',
  '15-System-Monitoring': 'SYSTEM MONITORING',
  '16-Software-Environment': 'SOFTWARE & ENVIRONMENTS',
  '17-PostInstall-Setup': 'POST-INSTALL SETUP',
  '18-Project-Sonar': 'PROJECT SONAR',
};