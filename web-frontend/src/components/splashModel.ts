import type { Lang } from '../lib/i18n';

export const SPLASH_TIMING = {
  minimumVisualMs: 1300,
  unresolvedBridgeTimeoutMs: 3000,
  exitMs: 720,
} as const;

export const SPLASH_PROGRESS_STEPS = [
  { at: 180, value: 22 },
  { at: 480, value: 48 },
  { at: 820, value: 72 },
  { at: 1120, value: 90 },
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
    toolsRegistered: (count: number) => `${count.toLocaleString('en')} TOOLS REGISTERED`,
    toolsSyncing: 'TOOLS SYNCING',
    localBridge: 'LOCAL BRIDGE',
    footer: 'LOCAL-FIRST WINDOWS ENGINEERING',
    action: 'Enter Workstation',
    waitingAction: 'CORE INITIALIZING',
    readyInstruction: 'READY — PRESS ENTER',
    offlineInstruction: 'BRIDGE OFFLINE — ENTER LOCAL WORKSPACE',
    continuingInstruction: 'BRIDGE STILL CONNECTING — ENTER WORKSPACE',
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
    toolsRegistered: (count: number) => `${count.toLocaleString('ar')} أداة مسجلة`,
    toolsSyncing: 'جارٍ مزامنة الأدوات',
    localBridge: 'المحرك المحلي',
    footer: 'هندسة ويندوز محلية أولًا',
    action: 'دخول محطة العمل',
    waitingAction: 'جارٍ تهيئة المحرك',
    readyInstruction: 'جاهز — اضغط ENTER',
    offlineInstruction: 'المحرك غير متصل — دخول الوضع المحلي',
    continuingInstruction: 'الاتصال ما زال جاريًا — دخول مساحة العمل',
  },
} satisfies Record<Lang, Record<string, string | ((count: number) => string)>>;

export function isSplashActivationKey(key: string, code = ''): boolean {
  return key === 'Enter' || code === 'NumpadEnter';
}

export function canActivateSplash({
  progress,
  bridgeOnline,
  timedOut,
  imageSettled,
}: {
  progress: number;
  bridgeOnline: boolean | null;
  timedOut: boolean;
  imageSettled: boolean;
}): boolean {
  return progress >= 100 && imageSettled && (bridgeOnline !== null || timedOut);
}

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
    : toolCount > 0 ? c.toolsRegistered(toolCount) : c.toolsSyncing;
  const instruction = stage === 'ready'
    ? c.readyInstruction
    : stage === 'offline'
      ? c.offlineInstruction
      : stage === 'continuing'
        ? c.continuingInstruction
        : c.waitingAction;

  return {
    stage,
    stageLabel,
    subtitle: c.subtitle,
    bridgeLabel,
    toolsLabel,
    localBridge: c.localBridge,
    footer: c.footer,
    action: c.action,
    instruction,
  };
}
