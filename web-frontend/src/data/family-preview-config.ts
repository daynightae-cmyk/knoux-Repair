import type { FamilyId, ServiceId } from './family-map';

export type PreviewSceneId =
  | 'vitality'
  | 'recovery'
  | 'assurance'
  | 'software'
  | 'workbench'
  | 'investigation';

export interface FamilyPreviewConfig {
  scene: PreviewSceneId;
  eyebrow: { en: string; ar: string };
  headline: { en: string; ar: string };
  description: { en: string; ar: string };
  accent: string;
  accentRgb: string;
}

export interface ServicePreviewConfig {
  mode: { en: string; ar: string };
  action: { en: string; ar: string };
  accent: string;
  accentRgb: string;
}

type RepairFamilyId = Exclude<FamilyId, 'ai-scan' | 'navigator'>;

export const FAMILY_PREVIEW_CONFIG: Record<RepairFamilyId, FamilyPreviewConfig> = {
  vitality: {
    scene: 'vitality',
    eyebrow: { en: 'SYSTEM VITALITY • MAINTAIN • OPTIMIZE • MONITOR', ar: 'حيوية النظام • صيانة • تحسين • مراقبة' },
    headline: { en: 'A healthier PC. A smoother you.', ar: 'حاسوب أكثر كفاءة. تجربة أكثر سلاسة.' },
    description: { en: 'A connected command surface for maintenance, performance evidence, and system monitoring.', ar: 'منصة مترابطة للصيانة وأدلة الأداء ومراقبة النظام.' },
    accent: '#8b5cf6',
    accentRgb: '139, 92, 246',
  },
  recovery: {
    scene: 'recovery',
    eyebrow: { en: 'RECOVERY & STORAGE • CLEAN • PROTECT • RESTORE', ar: 'الاستعادة والتخزين • تنظيف • حماية • استرداد' },
    headline: { en: 'Keep what matters. Recover with evidence.', ar: 'احتفظ بما يهمك. واستعد بياناتك بالدليل.' },
    description: { en: 'Storage analysis, cleanup, backup, and recovery paths remain explicit and confirmation-aware.', ar: 'تحليل التخزين والتنظيف والنسخ والاستعادة بمسارات واضحة وتأكيدات آمنة.' },
    accent: '#22d3ee',
    accentRgb: '34, 211, 238',
  },
  assurance: {
    scene: 'assurance',
    eyebrow: { en: 'ASSURANCE • CONNECT • VERIFY • PROTECT', ar: 'الضمان والحماية • اتصال • تحقق • حماية' },
    headline: { en: 'Stronger connections. Safer decisions.', ar: 'اتصالات أقوى. قرارات أكثر أماناً.' },
    description: { en: 'Network, security, privacy, and driver controls share one evidence-led protection surface.', ar: 'الشبكة والأمان والخصوصية والتعريفات في مساحة حماية واحدة مبنية على الأدلة.' },
    accent: '#34d399',
    accentRgb: '52, 211, 153',
  },
  software: {
    scene: 'software',
    eyebrow: { en: 'SOFTWARE LIBRARY • INVENTORY • RUNTIMES • SETUP', ar: 'مكتبة البرامج • جرد • بيئات تشغيل • إعداد' },
    headline: { en: 'The right software. Ready on purpose.', ar: 'البرامج المناسبة. جاهزة عن قصد.' },
    description: { en: 'Inspect applications, runtime environments, and post-install work without fabricated inventory counts.', ar: 'افحص التطبيقات وبيئات التشغيل وتجهيز ما بعد التثبيت دون أرقام جرد وهمية.' },
    accent: '#c084fc',
    accentRgb: '192, 132, 252',
  },
  workbench: {
    scene: 'workbench',
    eyebrow: { en: 'ENGINEERING WORKBENCH • BUILD • ANALYZE • SHIP', ar: 'ورشة الهندسة • بناء • تحليل • إطلاق' },
    headline: { en: 'Build smarter. Ship with context.', ar: 'ابنِ بذكاء. وأطلق بسياق واضح.' },
    description: { en: 'Developer utilities and Project Sonar stay tied to the real selected workspace and tool contracts.', ar: 'أدوات المطور وسونار المشاريع يظلان مرتبطين بمساحة العمل وعقود الأدوات الحقيقية.' },
    accent: '#818cf8',
    accentRgb: '129, 140, 248',
  },
  investigation: {
    scene: 'investigation',
    eyebrow: { en: 'INVESTIGATION • OBSERVE • DIAGNOSE • PROVE', ar: 'التحقيق • مراقبة • تشخيص • إثبات' },
    headline: { en: "See what's happening. Keep the evidence.", ar: 'اكتشف ما يحدث. واحتفظ بالدليل.' },
    description: { en: 'Diagnostics, reports, services, and processes remain separated from unverified alerts or invented events.', ar: 'التشخيص والتقارير والخدمات والعمليات دون تنبيهات أو أحداث مختلقة.' },
    accent: '#38bdf8',
    accentRgb: '56, 189, 248',
  },
};

export const SERVICE_PREVIEW_CONFIG: Record<ServiceId, ServicePreviewConfig> = {
  '01-System-Maintenance': { mode: { en: 'Maintenance lane', ar: 'مسار الصيانة' }, action: { en: 'Explore maintenance tools', ar: 'استعراض أدوات الصيانة' }, accent: '#fb923c', accentRgb: '251, 146, 60' },
  '02-System-Cleanup': { mode: { en: 'Cleanup lane', ar: 'مسار التنظيف' }, action: { en: 'Review cleanup tools', ar: 'مراجعة أدوات التنظيف' }, accent: '#22d3ee', accentRgb: '34, 211, 238' },
  '03-Network-Internet': { mode: { en: 'Connection path', ar: 'مسار الاتصال' }, action: { en: 'Inspect network tools', ar: 'فحص أدوات الشبكة' }, accent: '#38bdf8', accentRgb: '56, 189, 248' },
  '04-Programs-Applications': { mode: { en: 'Application inventory', ar: 'جرد التطبيقات' }, action: { en: 'Browse application tools', ar: 'تصفح أدوات التطبيقات' }, accent: '#c084fc', accentRgb: '192, 132, 252' },
  '05-Duplicate-Files': { mode: { en: 'Duplicate analysis', ar: 'تحليل الملفات المكررة' }, action: { en: 'Find duplicate tools', ar: 'فتح أدوات الملفات المكررة' }, accent: '#a78bfa', accentRgb: '167, 139, 250' },
  '06-Disk-Space': { mode: { en: 'Storage analysis', ar: 'تحليل التخزين' }, action: { en: 'Explore disk tools', ar: 'استعراض أدوات الأقراص' }, accent: '#0ea5e9', accentRgb: '14, 165, 233' },
  '07-Services-Processes': { mode: { en: 'Process evidence', ar: 'أدلة العمليات' }, action: { en: 'Inspect services and processes', ar: 'فحص الخدمات والعمليات' }, accent: '#60a5fa', accentRgb: '96, 165, 250' },
  '08-Performance': { mode: { en: 'Performance lane', ar: 'مسار الأداء' }, action: { en: 'Review performance tools', ar: 'مراجعة أدوات الأداء' }, accent: '#c084fc', accentRgb: '192, 132, 252' },
  '09-Security': { mode: { en: 'Protection controls', ar: 'ضوابط الحماية' }, action: { en: 'Open security tools', ar: 'فتح أدوات الأمان' }, accent: '#34d399', accentRgb: '52, 211, 153' },
  '10-Diagnostics-Reports': { mode: { en: 'Evidence workspace', ar: 'مساحة الأدلة' }, action: { en: 'Review diagnostic tools', ar: 'مراجعة أدوات التشخيص' }, accent: '#38bdf8', accentRgb: '56, 189, 248' },
  '11-Backup-Recovery': { mode: { en: 'Recovery path', ar: 'مسار الاستعادة' }, action: { en: 'Open recovery tools', ar: 'فتح أدوات الاستعادة' }, accent: '#2dd4bf', accentRgb: '45, 212, 191' },
  '12-Developer-Tools': { mode: { en: 'Developer stack', ar: 'حزمة المطور' }, action: { en: 'Explore developer tools', ar: 'استعراض أدوات المطور' }, accent: '#a78bfa', accentRgb: '167, 139, 250' },
  '13-Privacy': { mode: { en: 'Privacy layer', ar: 'طبقة الخصوصية' }, action: { en: 'Review privacy tools', ar: 'مراجعة أدوات الخصوصية' }, accent: '#e879f9', accentRgb: '232, 121, 249' },
  '14-Driver-Management': { mode: { en: 'Driver topology', ar: 'شبكة التعريفات' }, action: { en: 'Inspect driver tools', ar: 'فحص أدوات التعريفات' }, accent: '#818cf8', accentRgb: '129, 140, 248' },
  '15-System-Monitoring': { mode: { en: 'Monitoring plane', ar: 'منصة المراقبة' }, action: { en: 'Open monitoring tools', ar: 'فتح أدوات المراقبة' }, accent: '#2dd4bf', accentRgb: '45, 212, 191' },
  '16-Software-Environment': { mode: { en: 'Runtime environment', ar: 'بيئة التشغيل' }, action: { en: 'Inspect runtime tools', ar: 'فحص أدوات بيئة التشغيل' }, accent: '#22d3ee', accentRgb: '34, 211, 238' },
  '17-PostInstall-Setup': { mode: { en: 'Setup sequence', ar: 'تسلسل الإعداد' }, action: { en: 'Open setup tools', ar: 'فتح أدوات الإعداد' }, accent: '#f472b6', accentRgb: '244, 114, 182' },
  '18-Project-Sonar': { mode: { en: 'Project sonar', ar: 'سونار المشروع' }, action: { en: 'Explore Project Sonar', ar: 'استعراض سونار المشروع' }, accent: '#22d3ee', accentRgb: '34, 211, 238' },
};
