/**
 * KNOUX Repair — Studio Registry
 *
 * A *presentation* layer over the canonical navigation registry.
 *
 * The information architecture of the product is owned by
 * `src/data/family-map.ts` (6 families, 18 services, 158 tools). This
 * module never re-declares a family, a service, a tool id or a route —
 * every studio entry below is derived from `FAMILIES`, so there is exactly
 * one source of truth for "what exists" and "where it lives".
 *
 * What this module adds is only what the information architecture cannot
 * express: the studio's display name, its operational intent, and the
 * cross-cutting destinations (Home, AI Scan, Action Center, Settings) that
 * are product destinations rather than canonical service families.
 */

import type { FamilyDefinition, FamilyId, ServiceDefinition, ServiceId } from './family-map';
import { FAMILIES, ALL_SERVICES, SERVICE_TO_FAMILY } from './family-map';
import { CROSS_CUTTING_ICONS, FAMILY_ICONS, SERVICE_ICONS } from './studio-icons';
import type { IconComponent } from './studio-icons';

export type { FamilyId, ServiceId };

/** Product destinations that cut across the six canonical families. */
export type CrossCuttingId = 'home' | 'ai-scan' | 'action-center' | 'settings';

export interface CrossCuttingDestination {
  id: CrossCuttingId;
  labelEn: string;
  labelAr: string;
  hintEn: string;
  hintAr: string;
  icon: IconComponent;
  /** Position in the navigation spine. */
  order: number;
}

export const CROSS_CUTTING_DESTINATIONS: CrossCuttingDestination[] = [
  {
    id: 'home',
    labelEn: 'Home',
    labelAr: 'الرئيسية',
    hintEn: 'Command launcher and system readiness',
    hintAr: 'منصة إطلاق الأوامر وحالة النظام',
    icon: CROSS_CUTTING_ICONS.home,
    order: 0,
  },
  {
    id: 'ai-scan',
    labelEn: 'AI Scan',
    labelAr: 'فحص ذكي',
    hintEn: 'Guided, evidence-driven investigation',
    hintAr: 'تحقيق موجّه قائم على الأدلة',
    icon: CROSS_CUTTING_ICONS['ai-scan'],
    order: 1,
  },
  {
    id: 'action-center',
    labelEn: 'Action Center',
    labelAr: 'مركز الإجراءات',
    hintEn: 'Jobs, confirmations and execution records',
    hintAr: 'المهام والتأكيدات وسجلات التنفيذ',
    icon: CROSS_CUTTING_ICONS['action-center'],
    order: 2,
  },
  {
    id: 'settings',
    labelEn: 'Settings',
    labelAr: 'الإعدادات',
    hintEn: 'Language, theme, account and runtime',
    hintAr: 'اللغة والمظهر والحساب وبيئة التشغيل',
    icon: CROSS_CUTTING_ICONS.settings,
    order: 3,
  },
];

export interface StudioDefinition {
  /** Canonical family id — the same value the rest of the app navigates by. */
  id: FamilyId;
  /** Canonical family display name (from family-map). */
  name: { en: string; ar: string };
  /** Canonical family tagline (from family-map). */
  tagline: { en: string; ar: string };
  /** The studio's own product name — e.g. "Storage Atlas". */
  studioNameEn: string;
  studioNameAr: string;
  /** What this studio is for, in one operational sentence. */
  intentEn: string;
  intentAr: string;
  icon: IconComponent;
  accentVar: string;
  services: ServiceDefinition[];
  expectedTools: number;
  /** Services owned by this studio, resolved from the canonical map. */
  serviceIds: ServiceId[];
}

const STUDIO_PRESENTATION: Record<FamilyId, {
  studioNameEn: string;
  studioNameAr: string;
  intentEn: string;
  intentAr: string;
}> = {
  vitality: {
    studioNameEn: 'Health & Performance Lab',
    studioNameAr: 'مختبر الصحة والأداء',
    intentEn: 'Live Windows condition, pressure sources and verified repair evidence.',
    intentAr: 'حالة ويندوز الحية ومصادر الضغط وأدلة الإصلاح الموثقة.',
  },
  recovery: {
    studioNameEn: 'Storage Atlas',
    studioNameAr: 'أطلس التخزين',
    intentEn: 'Volumes, large files, duplicate content and verified reclaim outcomes.',
    intentAr: 'الأحجام والملفات الكبيرة والمحتوى المكرر ونتائج الاسترجاع الموثقة.',
  },
  assurance: {
    studioNameEn: 'Security Operations',
    studioNameAr: 'عمليات الأمان',
    intentEn: 'Network, protection, privacy and driver truth, with real evidence.',
    intentAr: 'الشبكة والحماية والخصوصية والسائقون بأدلة حقيقية.',
  },
  software: {
    studioNameEn: 'Application Studio',
    studioNameAr: 'استوديو التطبيقات',
    intentEn: 'Installed inventory, runtime readiness and controlled setup workflows.',
    intentAr: 'المخزون المثبّت وجاهزية بيئة التشغيل ومسارات الإعداد المحكومة.',
  },
  workbench: {
    studioNameEn: 'Developer Arsenal',
    studioNameAr: 'ترسانة المطورين',
    intentEn: 'Local toolchain reality and project intelligence in one console.',
    intentAr: 'حقيقة بيئة التطوير واستخبارات المشاريع في وحدة واحدة.',
  },
  investigation: {
    studioNameEn: 'Evidence & Diagnostics',
    studioNameAr: 'الأدلة والتشخيص',
    intentEn: 'Observed system evidence, events, services and processes.',
    intentAr: 'أدلة النظام المرصودة والأحداث والخدمات والعمليات.',
  },
  'ai-scan': {
    studioNameEn: 'AI Scan',
    studioNameAr: 'فحص ذكي',
    intentEn: 'Guided investigation across the whole product.',
    intentAr: 'تحقيق موجّه عبر المنتج كله.',
  },
  navigator: {
    studioNameEn: 'All Services',
    studioNameAr: 'كل الخدمات',
    intentEn: 'Every canonical service in one index.',
    intentAr: 'كل خدمة معيارية في فهرس واحد.',
  },
};

function buildStudio(family: FamilyDefinition): StudioDefinition {
  const presentation = STUDIO_PRESENTATION[family.id];
  return {
    id: family.id,
    name: family.name,
    tagline: family.tagline,
    studioNameEn: presentation.studioNameEn,
    studioNameAr: presentation.studioNameAr,
    intentEn: presentation.intentEn,
    intentAr: presentation.intentAr,
    icon: FAMILY_ICONS[family.id],
    accentVar: family.accentVar,
    services: family.services,
    expectedTools: family.expectedTools,
    serviceIds: family.services.map(service => service.id),
  };
}

/** The six operational studios, derived from the canonical family map. */
export const STUDIOS: StudioDefinition[] = FAMILIES.map(buildStudio);

export const STUDIO_BY_ID: Map<FamilyId, StudioDefinition> = new Map(STUDIOS.map(studio => [studio.id, studio]));

export function studioForFamily(family: FamilyDefinition): StudioDefinition {
  return STUDIO_BY_ID.get(family.id) ?? buildStudio(family);
}

/** Every service with its owning studio, resolved from the canonical map. */
export const SERVICE_STUDIO: Map<ServiceId, StudioDefinition> = new Map(
  ALL_SERVICES.map(service => [service.id, STUDIO_BY_ID.get(SERVICE_TO_FAMILY.get(service.id)!.id)!]),
);

export function serviceIcon(serviceId: ServiceId): IconComponent {
  return SERVICE_ICONS[serviceId];
}

export function studioDisplayName(studio: StudioDefinition, lang: 'en' | 'ar'): string {
  return lang === 'ar' ? studio.studioNameAr : studio.studioNameEn;
}

export function studioIntent(studio: StudioDefinition, lang: 'en' | 'ar'): string {
  return lang === 'ar' ? studio.intentAr : studio.intentEn;
}
