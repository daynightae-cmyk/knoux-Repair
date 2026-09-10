import type { Lang } from '../lib/i18n';

export const SPLASH_TIMING = {
  minimumVisualMs: 900,
  unresolvedBridgeTimeoutMs: 2200,
  completionHoldMs: 180,
  exitMs: 560,
} as const;

export const SPLASH_PROGRESS_STEPS = [
  { at: 120, value: 22 },
  { at: 340, value: 48 },
  { at: 580, value: 72 },
  { at: 800, value: 90 },
] as const;

export type SplashStage = 'preparing' | 'connecting' | 'ready' | 'offline' | 'continuing';

const COPY = {
  en: {
    subtitle: 'SYSTEM REPAIR WORKSTATION',
    preparing: 'Preparing workspace',
    connecting: 'Connecting local bridge',
    ready: 'System ready',
    offline: 'Workspace ready — local bridge unavailable',
    continuing: 'Opening workspace — local bridge still connecting',
    bridgeConnected: 'CONNECTED',
    bridgeConnecting: 'CONNECTING',
    bridgeOffline: 'OFFLINE',
    toolsReady: (count: number) => `${count.toLocaleString('en')} TOOLS READY`,
    toolsSyncing: 'TOOLS SYNCING',
    localBridge: 'LOCAL BRIDGE',
    footer: 'LOCAL-FIRST WINDOWS ENGINEERING',
  },
  ar: {
    subtitle: 'محطة إصلاح وتشخيص النظام',
    preparing: 'تهيئة مساحة العمل',
    connecting: 'الاتصال بمحرك التنفيذ المحلي',
    ready: 'النظام جاهز',
    offline: 'مساحة العمل جاهزة — محرك التنفيذ المحلي غير متاح',
    continuing: 'فتح مساحة العمل — ما زال الاتصال بالمحرك جاريًا',
    bridgeConnected: 'متصل',
    bridgeConnecting: 'جارٍ الاتصال',
    bridgeOffline: 'غير متصل',
    toolsReady: (count: number) => `${count.toLocaleString('ar')} أداة جاهزة`,
    toolsSyncing: 'جارٍ مزامنة الأدوات',
    localBridge: 'المحرك المحلي',
    footer: 'هندسة ويندوز محلية أولًا',
  },
} satisfies Record<Lang, Record<string, string | ((count: number) => string)>>;

export function resolveSplashStage(
  progress: number,
  bridgeOnline: boolean | null,
  timedOut: boolean,
): SplashStage {
  if (progress < 48) return 'preparing';
  if (progress < 90) return 'connecting';
  if (bridgeOnline === true && progress >= 100) return 'ready';
  if (bridgeOnline === false && progress >= 100) return 'offline';
  if (bridgeOnline === null && timedOut && progress >= 100) return 'continuing';
  return 'connecting';
}

export function getSplashPresentation({
  lang,
  progress,
  bridgeOnline,
  toolCount,
  timedOut,
}: {
  lang: Lang;
  progress: number;
  bridgeOnline: boolean | null;
  toolCount: number;
  timedOut: boolean;
}) {
  const c = COPY[lang];
  const stage = resolveSplashStage(progress, bridgeOnline, timedOut);
  const stageLabel = c[stage] as string;
  const bridgeLabel = bridgeOnline === true
    ? c.bridgeConnected
    : bridgeOnline === false
      ? c.bridgeOffline
      : c.bridgeConnecting;
  const toolsLabel = bridgeOnline === false
    ? (c.bridgeOffline as string)
    : toolCount > 0 ? c.toolsReady(toolCount) : c.toolsSyncing;

  return {
    stage,
    stageLabel,
    subtitle: c.subtitle,
    bridgeLabel,
    toolsLabel,
    localBridge: c.localBridge,
    footer: c.footer,
  };
}
