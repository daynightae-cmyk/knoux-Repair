import type { ActiveSection } from '../types';

export type CategoryIconKey =
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
  | 'backup'
  | 'developer'
  | 'privacy'
  | 'drivers'
  | 'monitoring'
  | 'software'
  | 'setup'
  | 'sonar';

export interface CategoryDescriptor {
  section: ActiveSection;
  id: string;
  icon: CategoryIconKey;
  accent: string;
  name: { en: string; ar: string };
  purpose: { en: string; ar: string };
}

export const CATEGORIES: CategoryDescriptor[] = [
  { section: 'maintenance', id: '01-System-Maintenance', icon: 'maintenance', accent: '#3B82F6', name: { en: 'System Maintenance', ar: 'صيانة النظام' }, purpose: { en: 'Verify Windows files, component health, disk integrity, and update servicing.', ar: 'التحقق من ملفات ويندوز وصحة المكونات وسلامة القرص وخدمة التحديثات.' } },
  { section: 'cleanup', id: '02-System-Cleanup', icon: 'cleanup', accent: '#10B981', name: { en: 'System Cleanup', ar: 'تنظيف النظام' }, purpose: { en: 'Assess and remove temporary, cache, and maintenance data through the approved scripts.', ar: 'تقييم وإزالة البيانات المؤقتة وبيانات التخزين المؤقت والصيانة عبر السكربتات المعتمدة.' } },
  { section: 'network', id: '03-Network-Internet', icon: 'network', accent: '#06B6D4', name: { en: 'Network & Internet', ar: 'الشبكة والإنترنت' }, purpose: { en: 'Inspect connectivity and configuration, then apply network repair operations when required.', ar: 'فحص الاتصال والإعدادات ثم تنفيذ عمليات إصلاح الشبكة عند الحاجة.' } },
  { section: 'programs', id: '04-Programs-Applications', icon: 'programs', accent: '#F97316', name: { en: 'Programs & Applications', ar: 'البرامج والتطبيقات' }, purpose: { en: 'Inspect installed software, program runtimes, startup entries, and repair-related setup state.', ar: 'فحص البرامج المثبتة ومكونات التشغيل وعناصر بدء التشغيل وحالة الإعداد المرتبطة بالإصلاح.' } },
  { section: 'duplicates', id: '05-Duplicate-Files', icon: 'duplicates', accent: '#EC4899', name: { en: 'Duplicate Files', ar: 'الملفات المكررة' }, purpose: { en: 'Find duplicate content and apply only the available quarantine, move, and restoration workflows.', ar: 'العثور على المحتوى المكرر وتنفيذ مسارات العزل والنقل والاستعادة المتاحة فقط.' } },
  { section: 'disk', id: '06-Disk-Space', icon: 'disk', accent: '#8B5CF6', name: { en: 'Disk Space', ar: 'مساحة القرص' }, purpose: { en: 'Measure storage use, identify large content, and run supported recovery or cleanup operations.', ar: 'قياس استخدام التخزين وتحديد المحتوى الكبير وتشغيل عمليات الاسترداد أو التنظيف المدعومة.' } },
  { section: 'services', id: '07-Services-Processes', icon: 'services', accent: '#F59E0B', name: { en: 'Services & Processes', ar: 'الخدمات والعمليات' }, purpose: { en: 'Review Windows services and processes, then execute only the registered recovery actions.', ar: 'مراجعة خدمات وعمليات ويندوز ثم تنفيذ إجراءات الاسترداد المسجلة فقط.' } },
  { section: 'performance', id: '08-Performance', icon: 'performance', accent: '#EF4444', name: { en: 'Performance', ar: 'الأداء' }, purpose: { en: 'Collect evidence about startup, resource pressure, power plans, and system performance.', ar: 'جمع أدلة عن بدء التشغيل وضغط الموارد وخطط الطاقة وأداء النظام.' } },
  { section: 'security', id: '09-Security', icon: 'security', accent: '#14B8A6', name: { en: 'Security', ar: 'الأمان' }, purpose: { en: 'Audit Windows protection controls and execute only the available protection repair actions.', ar: 'تدقيق ضوابط حماية ويندوز وتنفيذ إجراءات إصلاح الحماية المتاحة فقط.' } },
  { section: 'diagnostics', id: '10-Diagnostics-Reports', icon: 'diagnostics', accent: '#6366F1', name: { en: 'Diagnostics & Reports', ar: 'التشخيص والتقارير' }, purpose: { en: 'Generate read-only evidence for system, hardware, event, driver, disk, memory, and performance state.', ar: 'إنشاء أدلة للقراءة فقط عن حالة النظام والعتاد والأحداث وبرامج التشغيل والقرص والذاكرة والأداء.' } },
  { section: 'backupRecovery', id: '11-Backup-Recovery', icon: 'backup', accent: '#0EA5E9', name: { en: 'Backup & Recovery', ar: 'النسخ الاحتياطي والاستعادة' }, purpose: { en: 'Create restore points, copy user data to local backup storage, and verify the latest backup inventory.', ar: 'إنشاء نقاط استعادة ونسخ بيانات المستخدم محليًا والتحقق من أحدث سجل نسخ احتياطي.' } },
  { section: 'developerTools', id: '12-Developer-Tools', icon: 'developer', accent: '#7C3AED', name: { en: 'Developer Tools', ar: 'أدوات المطور' }, purpose: { en: 'Audit local development runtimes, collect diagnostics, and quarantine supported user cache folders.', ar: 'تدقيق بيئات التشغيل للمطور وجمع التشخيصات وعزل ذواكر التخزين المؤقت للمستخدم عند الحاجة.' } },
  { section: 'privacy', id: '13-Privacy', icon: 'privacy', accent: '#DB2777', name: { en: 'Privacy', ar: 'الخصوصية' }, purpose: { en: 'Audit selected user privacy settings and manage only the registered local activity and DNS cache actions.', ar: 'تدقيق إعدادات الخصوصية للمستخدم وإدارة إجراءات النشاط المحلي وذاكرة DNS المسجلة فقط.' } },
  { section: 'drivers', id: '14-Driver-Management', icon: 'drivers', accent: '#D97706', name: { en: 'Driver Management', ar: 'إدارة التعريفات' }, purpose: { en: 'Inventory signed drivers, audit signature state, and export third-party driver packages when elevated.', ar: 'جرد التعريفات الموقعة وتدقيق حالة التوقيعات وتصدير حزم تعريفات الطرف الثالث عند توفر صلاحية المدير.' } },
  { section: 'monitoring', id: '15-System-Monitoring', icon: 'monitoring', accent: '#059669', name: { en: 'System Monitoring', ar: 'مراقبة النظام' }, purpose: { en: 'Capture resource snapshots, top resource consumers, and a recent event warning digest.', ar: 'التقاط لقطات الموارد وأعلى العمليات استهلاكًا وملخص التحذيرات الحديثة في سجل الأحداث.' } },
  { section: 'softwareEnvironment', id: '16-Software-Environment', icon: 'software', accent: '#2563EB', name: { en: 'Software & Environments', ar: 'البرامج والبيئات' }, purpose: { en: 'Inventory installed software, development environments and Chrome extensions, then control registered cache, update and uninstall workflows.', ar: 'جرد البرامج والبيئات وإضافات Chrome ثم التحكم في مسارات الكاش والتحديث والإزالة المسجلة فقط.' } },
  { section: 'postInstall', id: '17-PostInstall-Setup', icon: 'setup', accent: '#9333EA', name: { en: 'Post-Install Setup', ar: 'تجهيز ويندوز بعد التثبيت' }, purpose: { en: 'Discover Windows Update driver offers, review a transparent essentials catalog, and install only confirmed selections.', ar: 'البحث عن تعريفات Windows Update وعرض كتالوج تطبيقات أساسية شفاف وتثبيت الاختيارات المؤكدة فقط.' } },
  { section: 'projectSonar', id: '18-Project-Sonar', icon: 'sonar', accent: '#22D3EE', name: { en: 'Project Sonar', ar: 'سونار المشاريع' }, purpose: { en: 'Select a project workspace, map its real metadata, prioritize evidence-based gaps, and generate bilingual engineering handoff reports.', ar: 'اختر مساحة عمل مشروع، ثم ارسم بياناته الفعلية ورتّب فجواته المبنية على الأدلة وأنشئ تقارير تسليم هندسية ثنائية اللغة.' } },
];

export function getCategoryBySection(section: ActiveSection): CategoryDescriptor {
  const category = CATEGORIES.find((item) => item.section === section);
  if (!category) throw new Error(`Unknown category section: ${section}`);
  return category;
}

export function getCategoryById(id: string): CategoryDescriptor | undefined {
  return CATEGORIES.find((item) => item.id === id);
}
