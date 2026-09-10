/**
 * KNOUX Repair — Canonical Family → Service → Tool Map
 *
 * SINGLE SOURCE OF TRUTH for the product's information architecture.
 * All navigation surfaces, search, AI Scan findings, and Action Center
 * consume this map. No duplicated mapping elsewhere.
 *
 * 6 Families → 18 Services → 158 Tools
 */

import type { ActiveSection } from '../types';

// ── Family identifiers ──
export type FamilyId =
  | 'ai-scan'
  | 'vitality'
  | 'recovery'
  | 'assurance'
  | 'software'
  | 'workbench'
  | 'investigation';

// ── Service identifiers (matching backend category IDs) ──
export type ServiceId =
  | '01-System-Maintenance'
  | '02-System-Cleanup'
  | '03-Network-Internet'
  | '04-Programs-Applications'
  | '05-Duplicate-Files'
  | '06-Disk-Space'
  | '07-Services-Processes'
  | '08-Performance'
  | '09-Security'
  | '10-Diagnostics-Reports'
  | '11-Backup-Recovery'
  | '12-Developer-Tools'
  | '13-Privacy'
  | '14-Driver-Management'
  | '15-System-Monitoring'
  | '16-Software-Environment'
  | '17-PostInstall-Setup'
  | '18-Project-Sonar';

// ── Navigation destination ──
export interface NavDestination {
  family: FamilyId;
  service?: ServiceId;
  toolId?: string;
}

// ── Service definition ──
export interface ServiceDefinition {
  id: ServiceId;
  name: { en: string; ar: string };
  purpose: { en: string; ar: string };
  expectedTools: number;
  icon: string;
  legacySection: ActiveSection;
}

// ── Family definition ──
export interface FamilyDefinition {
  id: FamilyId;
  name: { en: string; ar: string };
  tagline: { en: string; ar: string };
  icon: string;
  accentVar: string;
  services: ServiceDefinition[];
  expectedTools: number;
}

// ══════════════════════════════════════════════════════════════
// FAMILY DEFINITIONS
// ══════════════════════════════════════════════════════════════

export const FAMILIES: FamilyDefinition[] = [
  {
    id: 'vitality',
    name: { en: 'System Vitality', ar: 'حيوية النظام' },
    tagline: { en: 'Health. Performance. Stability.', ar: 'الصحة. الأداء. الاستقرار.' },
    icon: 'Activity',
    accentVar: '--knoux-family-vitality',
    expectedTools: 26,
    services: [
      {
        id: '01-System-Maintenance',
        name: { en: 'System Maintenance', ar: 'صيانة النظام' },
        purpose: { en: 'Verify Windows files, component health, disk integrity, and update servicing.', ar: 'التحقق من ملفات ويندوز وصحة المكونات وسلامة القرص وخدمة التحديثات.' },
        expectedTools: 10,
        icon: 'Wrench',
        legacySection: 'maintenance',
      },
      {
        id: '08-Performance',
        name: { en: 'Performance', ar: 'الأداء' },
        purpose: { en: 'Collect evidence about startup, resource pressure, power plans, and system performance.', ar: 'جمع أدلة عن بدء التشغيل وضغط الموارد وخطط الطاقة وأداء النظام.' },
        expectedTools: 12,
        icon: 'Gauge',
        legacySection: 'performance',
      },
      {
        id: '15-System-Monitoring',
        name: { en: 'System Monitoring', ar: 'مراقبة النظام' },
        purpose: { en: 'Capture resource snapshots, top resource consumers, and a recent event warning digest.', ar: 'التقاط لقطات الموارد وأعلى العمليات استهلاكًا وملخص التحذيرات الحديثة.' },
        expectedTools: 4,
        icon: 'Monitor',
        legacySection: 'monitoring',
      },
    ],
  },
  {
    id: 'recovery',
    name: { en: 'Recovery & Storage', ar: 'الاستعادة والتخزين' },
    tagline: { en: 'Clean. Recover. Protect your data.', ar: 'نظّف. استعد. احمِ بياناتك.' },
    icon: 'Database',
    accentVar: '--knoux-family-recovery',
    expectedTools: 37,
    services: [
      {
        id: '02-System-Cleanup',
        name: { en: 'System Cleanup', ar: 'تنظيف النظام' },
        purpose: { en: 'Assess and remove temporary, cache, and maintenance data through approved scripts.', ar: 'تقييم وإزالة البيانات المؤقتة والتخزين المؤقت والصيانة عبر السكربتات المعتمدة.' },
        expectedTools: 11,
        icon: 'Trash2',
        legacySection: 'cleanup',
      },
      {
        id: '05-Duplicate-Files',
        name: { en: 'Duplicate Files', ar: 'الملفات المكررة' },
        purpose: { en: 'Find duplicate content and apply quarantine, move, and restoration workflows.', ar: 'العثور على المحتوى المكرر وتنفيذ مسارات العزل والنقل والاستعادة.' },
        expectedTools: 11,
        icon: 'Copy',
        legacySection: 'duplicates',
      },
      {
        id: '06-Disk-Space',
        name: { en: 'Disk Space', ar: 'مساحة القرص' },
        purpose: { en: 'Measure storage use, identify large content, and run supported recovery or cleanup operations.', ar: 'قياس استخدام التخزين وتحديد المحتوى الكبير وتشغيل عمليات الاسترداد أو التنظيف.' },
        expectedTools: 10,
        icon: 'HardDrive',
        legacySection: 'disk',
      },
      {
        id: '11-Backup-Recovery',
        name: { en: 'Backup & Recovery', ar: 'النسخ الاحتياطي والاستعادة' },
        purpose: { en: 'Create restore points, copy user data to local backup storage, and verify backup inventory.', ar: 'إنشاء نقاط استعادة ونسخ بيانات المستخدم محليًا والتحقق من سجل النسخ.' },
        expectedTools: 5,
        icon: 'RotateCcw',
        legacySection: 'backupRecovery',
      },
    ],
  },
  {
    id: 'assurance',
    name: { en: 'Assurance', ar: 'الضمان والحماية' },
    tagline: { en: 'Protect. Connect. Trust.', ar: 'احمِ. اتصل. ثق.' },
    icon: 'Shield',
    accentVar: '--knoux-family-assurance',
    expectedTools: 29,
    services: [
      {
        id: '03-Network-Internet',
        name: { en: 'Network & Internet', ar: 'الشبكة والإنترنت' },
        purpose: { en: 'Inspect connectivity and configuration, then apply network repair operations when required.', ar: 'فحص الاتصال والإعدادات ثم تنفيذ عمليات إصلاح الشبكة عند الحاجة.' },
        expectedTools: 11,
        icon: 'Wifi',
        legacySection: 'network',
      },
      {
        id: '09-Security',
        name: { en: 'Security', ar: 'الأمان' },
        purpose: { en: 'Audit Windows protection controls and execute available protection repair actions.', ar: 'تدقيق ضوابط حماية ويندوز وتنفيذ إجراءات إصلاح الحماية المتاحة.' },
        expectedTools: 10,
        icon: 'Lock',
        legacySection: 'security',
      },
      {
        id: '13-Privacy',
        name: { en: 'Privacy', ar: 'الخصوصية' },
        purpose: { en: 'Audit selected user privacy settings and manage registered local activity and DNS cache actions.', ar: 'تدقيق إعدادات الخصوصية وإدارة إجراءات النشاط المحلي وذاكرة DNS.' },
        expectedTools: 4,
        icon: 'Eye',
        legacySection: 'privacy',
      },
      {
        id: '14-Driver-Management',
        name: { en: 'Driver Management', ar: 'إدارة التعريفات' },
        purpose: { en: 'Inventory signed drivers, audit signature state, and export third-party driver packages.', ar: 'جرد التعريفات الموقعة وتدقيق حالة التوقيعات وتصدير حزم التعريفات.' },
        expectedTools: 4,
        icon: 'Cpu',
        legacySection: 'drivers',
      },
    ],
  },
  {
    id: 'software',
    name: { en: 'Software Library', ar: 'مكتبة البرامج' },
    tagline: { en: 'Organize. Update. Ready.', ar: 'نظّم. حدّث. جاهز.' },
    icon: 'Package',
    accentVar: '--knoux-family-software',
    expectedTools: 24,
    services: [
      {
        id: '04-Programs-Applications',
        name: { en: 'Programs & Applications', ar: 'البرامج والتطبيقات' },
        purpose: { en: 'Inspect installed software, program runtimes, startup entries, and repair-related setup state.', ar: 'فحص البرامج المثبتة ومكونات التشغيل وعناصر بدء التشغيل.' },
        expectedTools: 10,
        icon: 'AppWindow',
        legacySection: 'programs',
      },
      {
        id: '16-Software-Environment',
        name: { en: 'Software Environment', ar: 'بيئة البرامج' },
        purpose: { en: 'Inventory installed software, development environments and Chrome extensions.', ar: 'جرد البرامج والبيئات وإضافات Chrome.' },
        expectedTools: 8,
        icon: 'Layers',
        legacySection: 'softwareEnvironment',
      },
      {
        id: '17-PostInstall-Setup',
        name: { en: 'Post-Install Setup', ar: 'تجهيز ما بعد التثبيت' },
        purpose: { en: 'Discover Windows Update driver offers, review essentials catalog, and install confirmed selections.', ar: 'البحث عن تعريفات Windows Update وعرض كتالوج التطبيقات الأساسية.' },
        expectedTools: 6,
        icon: 'Download',
        legacySection: 'postInstall',
      },
    ],
  },
  {
    id: 'workbench',
    name: { en: 'Engineering Workbench', ar: 'ورشة الهندسة' },
    tagline: { en: 'Build. Analyze. Ship.', ar: 'ابنِ. حلّل. أطلِق.' },
    icon: 'Code2',
    accentVar: '--knoux-family-workbench',
    expectedTools: 20,
    services: [
      {
        id: '12-Developer-Tools',
        name: { en: 'Developer Tools', ar: 'أدوات المطور' },
        purpose: { en: 'Audit local development runtimes, collect diagnostics, and manage supported user cache folders.', ar: 'تدقيق بيئات التشغيل وجمع التشخيصات وإدارة ذواكر التخزين المؤقت.' },
        expectedTools: 13,
        icon: 'Terminal',
        legacySection: 'developerTools',
      },
      {
        id: '18-Project-Sonar',
        name: { en: 'Project Sonar', ar: 'سونار المشاريع' },
        purpose: { en: 'Select a workspace, map metadata, prioritize evidence-based gaps, and generate handoff reports.', ar: 'اختر مساحة عمل ورسم بياناتها وأنشئ تقارير تسليم هندسية.' },
        expectedTools: 7,
        icon: 'Radar',
        legacySection: 'projectSonar',
      },
    ],
  },
  {
    id: 'investigation',
    name: { en: 'Investigation', ar: 'التحقيق' },
    tagline: { en: 'Observe. Diagnose. Evidence.', ar: 'راقب. شخّص. وثّق.' },
    icon: 'Search',
    accentVar: '--knoux-family-investigation',
    expectedTools: 22,
    services: [
      {
        id: '10-Diagnostics-Reports',
        name: { en: 'Diagnostics & Reports', ar: 'التشخيص والتقارير' },
        purpose: { en: 'Generate read-only evidence for system, hardware, event, driver, disk, memory, and performance state.', ar: 'إنشاء أدلة للقراءة فقط عن حالة النظام والعتاد والأحداث.' },
        expectedTools: 11,
        icon: 'FileText',
        legacySection: 'diagnostics',
      },
      {
        id: '07-Services-Processes',
        name: { en: 'Services & Processes', ar: 'الخدمات والعمليات' },
        purpose: { en: 'Review Windows services and processes, then execute only registered recovery actions.', ar: 'مراجعة خدمات وعمليات ويندوز ثم تنفيذ إجراءات الاسترداد المسجلة.' },
        expectedTools: 11,
        icon: 'Activity',
        legacySection: 'services',
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// COMPUTED LOOKUPS
// ══════════════════════════════════════════════════════════════

/** All services across all families */
export const ALL_SERVICES: ServiceDefinition[] = FAMILIES.flatMap(f => f.services);

/** Service lookup by ID */
export const SERVICE_BY_ID = new Map<ServiceId, ServiceDefinition>(
  ALL_SERVICES.map(s => [s.id, s])
);

/** Family lookup by ID */
export const FAMILY_BY_ID = new Map<FamilyId, FamilyDefinition>(
  FAMILIES.map(f => [f.id, f])
);

/** Service → Family lookup */
export const SERVICE_TO_FAMILY = new Map<ServiceId, FamilyDefinition>(
  FAMILIES.flatMap(f => f.services.map(s => [s.id, f] as [ServiceId, FamilyDefinition]))
);

/** Legacy section → new destination mapping */
export const LEGACY_SECTION_MAP = new Map<ActiveSection, NavDestination>(
  FAMILIES.flatMap(f =>
    f.services.map(s => [
      s.legacySection,
      { family: f.id, service: s.id },
    ] as [ActiveSection, NavDestination])
  )
);

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/** Get family that owns a given service ID */
export function getFamilyForService(serviceId: ServiceId): FamilyDefinition | undefined {
  return SERVICE_TO_FAMILY.get(serviceId);
}

/** Get new nav destination from legacy section */
export function resolveLegacySection(section: ActiveSection): NavDestination | undefined {
  return LEGACY_SECTION_MAP.get(section);
}

/** Count invariants — these must pass or investigation is needed */
export const INVARIANTS = {
  families: 6,
  services: 18,
  tools: 158,
} as const;

/** Verify family map integrity */
export function verifyFamilyMap(): { valid: boolean; familyCount: number; serviceCount: number; expectedToolCount: number } {
  const familyCount = FAMILIES.length;
  const serviceCount = ALL_SERVICES.length;
  const expectedToolCount = FAMILIES.reduce((sum, f) => sum + f.expectedTools, 0);

  // Verify no service appears in multiple families
  const serviceIds = new Set<string>();
  for (const s of ALL_SERVICES) {
    if (serviceIds.has(s.id)) {
      return { valid: false, familyCount, serviceCount, expectedToolCount };
    }
    serviceIds.add(s.id);
  }

  return {
    valid: familyCount === INVARIANTS.families
      && serviceCount === INVARIANTS.services
      && expectedToolCount === INVARIANTS.tools,
    familyCount,
    serviceCount,
    expectedToolCount,
  };
}
