import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AppWindow, ArchiveRestore, ArrowRight,
  CloudCog, Copy, FolderKanban, Gauge, HardDrive,
  HeartPulse, LoaderCircle, LockKeyhole, MonitorCog, Network, PackageCheck, Radar, RefreshCw,
  Rocket, ScanSearch, ShieldCheck, Sparkles, Trash2, UserRoundCheck,
  Wrench,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { ActiveSection, ToolStatus } from '../types';
import type {
  BridgeTool, ExecutionMode,
  ToolRunConfirmation, ToolRunOptions,
} from '../lib/api';
import { api } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { pickName } from '../lib/i18n';
import ExecutionConfirmDialog from './ExecutionConfirmDialog';
import MaintenanceStation from '../features/stations/station01/MaintenanceStation';
import CleanupStation from '../features/stations/station02/CleanupStation';
import NetworkStation from '../features/stations/station03/NetworkStation';
import ProgramsStation from '../features/stations/station04/ProgramsStation';
import DuplicateStation from '../features/stations/station05/DuplicateStation';
import DiskSpaceStation from '../features/stations/station06/DiskSpaceStation';
import ServicesStation from '../features/stations/station07/ServicesStation';
import PerformanceStation from '../features/stations/station08/PerformanceStation';
import SecurityStation from '../features/stations/station09/SecurityStation';
import DiagnosticsStation from '../features/stations/station10/DiagnosticsStation';
import RecoveryStation from '../features/stations/station11/RecoveryStation';
import DeveloperStation from '../features/stations/station12/DeveloperStation';
import PrivacyStation from '../features/stations/station13/PrivacyStation';
import DriversStation from '../features/stations/station14/DriversStation';
import MonitoringStation from '../features/stations/station15/MonitoringStation';
import SoftwareStation from '../features/stations/station16/SoftwareStation';
import PostInstallStation from '../features/stations/station17/PostInstallStation';
import ProjectSonarStation from '../features/stations/station18/ProjectSonarStation';

interface ServiceAppsProps {
  activeSection: ActiveSection;
  tools: BridgeTool[];
  toolStatuses: Record<string, ToolStatus>;
  lang: Lang;
  bridgeElevated: boolean;
  bridgeOnline?: boolean | null;
  onRetryBridge?: () => void;
  onToolStatus?: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
  onRunTool: (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  onCancelTool: () => void;
  /** Render only the canonical station surface when a parent workspace already owns the chrome. */
  embedded?: boolean;
}

type Localized = Record<Lang, string>;
type DataLoader = () => Promise<unknown>;

const COPY = {
  en: {
    refresh: 'Refresh', loading: 'Reading your device', unavailable: 'Live device information will appear when the local service is ready.',
    recommend: 'Quick actions', choices: 'Available actions', deviceReady: 'Device overview', noAction: 'No action in progress',
    review: 'Review', start: 'Start', stop: 'Stop', permission: 'Device permission needed', safe: 'Your control comes first',
    safeBody: 'KNOUX explains changes and asks for confirmation before it applies them.', system: 'System', details: 'Details',
    healthy: 'Looking good', attention: 'Needs attention', open: 'Open', free: 'free', available: 'available',
  },
  ar: {
    refresh: 'تحديث', loading: 'جارٍ قراءة جهازك', unavailable: 'ستظهر معلومات الجهاز الحية عندما تصبح الخدمة المحلية جاهزة.',
    recommend: 'إجراءات سريعة', choices: 'الإجراءات المتاحة', deviceReady: 'نظرة عامة على الجهاز', noAction: 'لا يوجد إجراء قيد التنفيذ',
    review: 'مراجعة', start: 'ابدأ', stop: 'إيقاف', permission: 'تحتاج إذن الجهاز', safe: 'تحكمك يأتي أولاً',
    safeBody: 'يشرح KNOUX التغييرات ويطلب التأكيد قبل تطبيقها.', system: 'النظام', details: 'التفاصيل',
    healthy: 'الحالة جيدة', attention: 'يحتاج انتباهاً', open: 'فتح', free: 'متاح', available: 'متاحة',
  },
};

const LOADERS: Partial<Record<ActiveSection, DataLoader>> = {
  maintenance: async () => (await api.system()).system,
  cleanup: async () => (await api.cleanupPreview()).preview,
  network: async () => (await api.networkPreview()).preview,
  programs: async () => (await api.softwarePreview()).preview,
  disk: async () => (await api.system()).system,
  services: async () => (await api.operationsPreview()).preview,
  performance: async () => (await api.optimizationPreview()).preview,
  security: async () => (await api.system()).system,
  diagnostics: async () => (await api.diagnosticsPreview()).preview,
  backupRecovery: async () => (await api.backupRecoveryPreview()).preview,
  developerTools: async () => (await api.softwarePreview()).preview,
  privacy: async () => (await api.privacyPreview()).preview,
  drivers: async () => (await api.driversPreview()).preview,
  monitoring: async () => (await api.operationsPreview()).preview,
  softwareEnvironment: async () => (await api.softwarePreview()).preview,
  postInstall: async () => (await api.postInstallPreview()).preview,
};

function useServiceData(section: ActiveSection) {
  const loader = LOADERS[section];
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(loader));
  const [available, setAvailable] = useState(false);
  const load = useCallback(async () => {
    if (!loader) { setLoading(false); return; }
    setLoading(true);
    try { setData(await loader()); setAvailable(true); } catch { setData(null); setAvailable(false); } finally { setLoading(false); }
  }, [loader]);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, available, reload: load };
}

function preferredMode(tool: BridgeTool): ExecutionMode { return tool.AnalyzeOnlySupported ? 'analyze' : tool.WhatIfSupported ? 'preview' : 'run'; }
function tone(status: ToolStatus | undefined) { return status === 'success' ? 'is-success' : status === 'error' ? 'is-error' : status === 'running' ? 'is-running' : ''; }

function LiveShell({ lang, title, eyebrow, icon: Icon, accent, serviceId, loading, available, onRefresh, children }: {
  lang: Lang; title: string; eyebrow: string; icon: ElementType; accent: string; serviceId: ActiveSection; loading: boolean; available: boolean; onRefresh: () => void; children: React.ReactNode;
}) {
  const text = COPY[lang];
  return <section className={`service-app-shell service-app-shell--${serviceId}`} data-service-id={serviceId} style={{ '--app-accent': accent } as React.CSSProperties}>
    <header className="service-app-topbar"><div className="service-app-brand"><span className="service-app-icon"><Icon size={20} /></span><div><p>{eyebrow}</p><h1>{title}</h1></div></div><button type="button" className="service-app-refresh" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />{text.refresh}</button></header>
    {loading ? <div className="service-app-loading"><LoaderCircle size={20} className="animate-spin" /><span>{text.loading}</span></div> : <>{!available && <div className="service-app-offline-banner"><CloudCog size={17} /><span>{text.unavailable}</span></div>}{children}</>}
  </section>;
}

function ActionRail({ tools, lang, toolStatuses, bridgeElevated, onLaunch, onCancel }: {
  tools: BridgeTool[]; lang: Lang; toolStatuses: Record<string, ToolStatus>; bridgeElevated: boolean; onLaunch: (tool: BridgeTool) => void; onCancel: () => void;
}) {
  const text = COPY[lang];
  const actions = tools.slice(0, 4);
  if (!actions.length) return null;
  return <section className="app-action-rail"><div className="app-section-title"><p>{text.choices}</p><h2>{text.recommend}</h2></div><div className="app-action-list">{actions.map((tool) => {
    const status = toolStatuses[tool.ToolId]; const isRunning = status === 'running'; const needsPermission = tool.RequiresAdmin && !bridgeElevated;
    return <article className={`app-action ${tone(status)}`} key={tool.ToolId}><div className="app-action-dot" /><div><strong>{pickName(tool, lang)}</strong><span>{tool.RiskLevel === 'READ_ONLY' ? (lang === 'ar' ? 'فحص فقط دون تغيير الجهاز' : 'Check only — no device changes') : (lang === 'ar' ? 'سيطلب KNOUX التأكيد قبل التغيير' : 'KNOUX asks for confirmation before changes')}</span>{needsPermission && <small><LockKeyhole size={11} />{text.permission}</small>}</div>{isRunning ? <button type="button" onClick={onCancel}><RefreshCw size={14} className="animate-spin" />{text.stop}</button> : <button type="button" disabled={needsPermission} onClick={() => onLaunch(tool)}>{preferredMode(tool) === 'run' ? text.start : text.review}<ArrowRight size={14} className="rtl:rotate-180" /></button>}</article>;
  })}</div></section>;
}

function SafetyNote({ lang }: { lang: Lang }) { const text = COPY[lang]; return <aside className="app-safety-note"><ShieldCheck size={18} /><div><strong>{text.safe}</strong><span>{text.safeBody}</span></div></aside>; }

function GenericApp({ section, lang }: { section: ActiveSection; lang: Lang }) { const labels: Partial<Record<ActiveSection, Localized>> = { services: { en: 'Device activity room', ar: 'غرفة نشاط الجهاز' }, monitoring: { en: 'Live device monitor', ar: 'مراقب الجهاز الحي' } }; return <div className="generic-app-view"><MonitorCog size={45} /><h2>{labels[section]?.[lang] || (lang === 'ar' ? 'خدمة KNOUX' : 'KNOUX service')}</h2><span>{lang === 'ar' ? 'ستظهر المعلومات الفعلية والخطوات المناسبة هنا عندما تصبح الخدمة جاهزة.' : 'Live information and the right next steps will appear here when the service is ready.'}</span></div>; }
function OfflineScene({ section, lang, icon: Icon }: { section: ActiveSection; lang: Lang; icon: ElementType }) { const labels: Partial<Record<ActiveSection, Localized>> = { maintenance: { en: 'Ready to measure your device health', ar: 'جاهز لقياس صحة جهازك' }, cleanup: { en: 'Ready to map cleanable space', ar: 'جاهز لرسم المساحة القابلة للتنظيف' }, performance: { en: 'Ready to build a speed picture', ar: 'جاهز لبناء صورة عن أداء الجهاز' }, disk: { en: 'Ready to explore your storage', ar: 'جاهز لاستكشاف مساحة التخزين' }, network: { en: 'Ready to trace your connection', ar: 'جاهز لتتبّع اتصالك' }, security: { en: 'Ready to check your protection', ar: 'جاهز لفحص حمايتك' }, diagnostics: { en: 'Ready to prepare a device checkup', ar: 'جاهز لإعداد فحص للجهاز' }, backupRecovery: { en: 'Ready to open your recovery vault', ar: 'جاهز لفتح خزنة الاستعادة' }, privacy: { en: 'Ready to review your privacy choices', ar: 'جاهز لمراجعة خيارات الخصوصية' }, softwareEnvironment: { en: 'Ready to organise your software library', ar: 'جاهز لتنظيم مكتبة برامجك' }, postInstall: { en: 'Ready to prepare a new device', ar: 'جاهز لتجهيز جهاز جديد' } }; const title = labels[section]?.[lang] || (lang === 'ar' ? 'جاهز لعرض بيانات هذه الخدمة' : 'Ready to show this service'); return <section className={`offline-scene offline-${section}`}><div className="offline-scene-motif"><i /><i /><i /><Icon size={34} /></div><div><p>{lang === 'ar' ? 'تجربة الخدمة' : 'Service experience'}</p><h2>{title}</h2><span>{lang === 'ar' ? 'سيظهر مخطط الخدمة وبيانات جهازك الحقيقية فور جاهزية الاتصال المحلي.' : 'The service canvas and real device details appear as soon as the local connection is ready.'}</span></div></section>; }

export default function ServiceApps({ activeSection, tools, toolStatuses, lang, bridgeElevated, bridgeOnline = null, onRetryBridge, onToolStatus, onRunTool, onCancelTool, embedded = false }: ServiceAppsProps) {
  const [pending, setPending] = useState<{ tool: BridgeTool; mode: ExecutionMode; options?: ToolRunOptions } | null>(null);
  const { data, loading, available, reload } = useServiceData(activeSection);
  const launch = (tool: BridgeTool) => setPending({ tool, mode: preferredMode(tool) });
  const prepareToolRun = useCallback((tool: BridgeTool, mode: ExecutionMode, options: ToolRunOptions = {}) => setPending({ tool, mode, options }), []);
  const reviewableToolIds = useMemo(() => new Set(tools.map((tool) => tool.ToolId)), [tools]);
  const launchToolById = useCallback((toolId: string) => {
    const tool = tools.find((candidate) => candidate.ToolId === toolId);
    if (tool) launch(tool);
  }, [tools]);
  const specs: Partial<Record<ActiveSection, { title: Localized; eyebrow: Localized; icon: ElementType; accent: string }>> = {
    maintenance: { title: { en: 'KNOUX Care', ar: 'عناية KNOUX' }, eyebrow: { en: 'WINDOWS REPAIR CORE', ar: 'نواة إصلاح ويندوز' }, icon: HeartPulse, accent: '#58a6ff' },
    cleanup: { title: { en: 'Space Cleaner', ar: 'منظف المساحة' }, eyebrow: { en: 'CLEANUP & RECLAIM', ar: 'تنظيف واستعادة المساحة' }, icon: Trash2, accent: '#43c98d' },
    performance: { title: { en: 'Performance Observatory', ar: 'مرصد الأداء' }, eyebrow: { en: 'RESOURCE EVIDENCE', ar: 'أدلة الموارد' }, icon: Gauge, accent: '#f07868' },
    disk: { title: { en: 'Storage Map', ar: 'خريطة التخزين' }, eyebrow: { en: 'DISK & VOLUME EVIDENCE', ar: 'أدلة الأقراص ووحدات التخزين' }, icon: HardDrive, accent: '#ad79ff' },
    network: { title: { en: 'Connection Map', ar: 'خريطة الاتصال' }, eyebrow: { en: 'NETWORK PATH', ar: 'مسار الشبكة' }, icon: Network, accent: '#35c9da' },
    security: { title: { en: 'Security Evidence Center', ar: 'مركز أدلة الأمان' }, eyebrow: { en: 'ASSURANCE', ar: 'الضمان والحماية' }, icon: ShieldCheck, accent: '#46c5a8' },
    diagnostics: { title: { en: 'Diagnostic Evidence Lab', ar: 'مختبر الأدلة التشخيصية' }, eyebrow: { en: 'INVESTIGATION', ar: 'التحقيق' }, icon: ScanSearch, accent: '#9079f5' },
    backupRecovery: { title: { en: 'Recovery Vault', ar: 'خزنة الاستعادة' }, eyebrow: { en: 'BACKUP & RECOVERY', ar: 'النسخ الاحتياطي والاستعادة' }, icon: ArchiveRestore, accent: '#47c0e7' },
    programs: { title: { en: 'Application Studio', ar: 'استوديو التطبيقات' }, eyebrow: { en: 'APPLICATION MATRIX', ar: 'مصفوفة التطبيقات' }, icon: AppWindow, accent: '#f19a55' },
    softwareEnvironment: { title: { en: 'Runtime Matrix', ar: 'مصفوفة بيئات التشغيل' }, eyebrow: { en: 'SOFTWARE ENVIRONMENT', ar: 'بيئة البرامج' }, icon: PackageCheck, accent: '#5e8ef4' },
    developerTools: { title: { en: 'Engineering Workbench', ar: 'منضدة العمل الهندسية' }, eyebrow: { en: 'DEVELOPER TOOLS', ar: 'أدوات المطور' }, icon: FolderKanban, accent: '#a780f6' },
    privacy: { title: { en: 'Privacy Control Center', ar: 'مركز التحكم بالخصوصية' }, eyebrow: { en: 'PRIVACY', ar: 'الخصوصية' }, icon: UserRoundCheck, accent: '#eb75a7' },
    drivers: { title: { en: 'Driver Matrix', ar: 'مصفوفة التعريفات' }, eyebrow: { en: 'DRIVERS & DEVICES', ar: 'التعريفات والأجهزة' }, icon: Wrench, accent: '#e5ab57' },
    monitoring: { title: { en: 'Live Observatory', ar: 'المرصد الحي' }, eyebrow: { en: 'SYSTEM MONITORING', ar: 'مراقبة النظام' }, icon: Activity, accent: '#52c89a' },
    services: { title: { en: 'System Topology', ar: 'طوبولوجيا النظام' }, eyebrow: { en: 'SERVICES & PROCESSES', ar: 'الخدمات والعمليات' }, icon: Activity, accent: '#ecb15f' },
    postInstall: { title: { en: 'Provisioning Pipeline', ar: 'مسار التجهيز' }, eyebrow: { en: 'POST-INSTALL SETUP', ar: 'إعداد ما بعد التثبيت' }, icon: Rocket, accent: '#b06cf5' },
    duplicates: { title: { en: 'Duplicate Intelligence', ar: 'استخبارات الملفات المكررة' }, eyebrow: { en: 'DUPLICATE FILES', ar: 'الملفات المكررة' }, icon: Copy, accent: '#e76fa5' },
    projectSonar: { title: { en: 'Project Intelligence Sonar', ar: 'سونار ذكاء المشاريع' }, eyebrow: { en: 'PROJECT SONAR', ar: 'سونار المشاريع' }, icon: Radar, accent: '#42d4e8' },
  };
  const spec = specs[activeSection] || { title: { en: 'KNOUX', ar: 'KNOUX' }, eyebrow: { en: 'SERVICE', ar: 'خدمة' }, icon: Sparkles, accent: '#48c8dd' };
  const content = useMemo(() => {
    // Canonical stations own their evidence lifecycle and render honest states before a scan.
    if (activeSection === 'maintenance') {
      return (
        <MaintenanceStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'network') {
      return (
        <NetworkStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'programs') {
      return (
        <ProgramsStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'cleanup') {
      return (
        <CleanupStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'disk') {
      return (
        <DiskSpaceStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'services') {
      return (
        <ServicesStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'performance') {
      return (
        <PerformanceStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'security') {
      return (
        <SecurityStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'diagnostics') {
      return (
        <DiagnosticsStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'backupRecovery') {
      return (
        <RecoveryStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'developerTools') {
      return (
        <DeveloperStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'privacy') {
      return (
        <PrivacyStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'drivers') {
      return (
        <DriversStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'monitoring') {
      return (
        <MonitoringStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'softwareEnvironment') {
      return (
        <SoftwareStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'postInstall') {
      return (
        <PostInstallStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
        />
      );
    }
    if (activeSection === 'projectSonar') {
      return (
        <ProjectSonarStation
          lang={lang}
          tools={tools}
          toolStatuses={toolStatuses}
          bridgeElevated={bridgeElevated}
          bridgeOnline={bridgeOnline}
          onRetryBridge={onRetryBridge || reload}
          onToolStatus={onToolStatus || (() => {})}
          onPrepareRun={prepareToolRun}
        />
      );
    }
    if (!available || !data) return null;
    return <GenericApp section={activeSection} lang={lang} />;
  }, [activeSection, available, data, lang, launchToolById, prepareToolRun, reviewableToolIds, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge, onToolStatus, reload]);
  const specialContent = activeSection === 'duplicates'
    ? <DuplicateStation lang={lang} tools={tools} onPrepareRun={prepareToolRun} />
    : null;
  const appContent = specialContent || content || <OfflineScene section={activeSection} lang={lang} icon={spec.icon} />;
  const showSharedActionRail = !specialContent && !content;
  const stationOwnsLifecycle = activeSection === 'maintenance'
    || activeSection === 'performance'
    || activeSection === 'monitoring'
    || activeSection === 'cleanup'
    || activeSection === 'disk'
    || activeSection === 'backupRecovery'
    || activeSection === 'network'
    || activeSection === 'security'
    || activeSection === 'privacy'
    || activeSection === 'drivers'
    || activeSection === 'services'
    || activeSection === 'diagnostics';
  const confirmDialog = pending && <ExecutionConfirmDialog tool={pending.tool} mode={pending.mode} lang={lang} initialOptions={pending.options} onCancel={() => setPending(null)} onConfirm={(options, confirmation) => { onRunTool(pending.tool, pending.mode, options, confirmation); setPending(null); }} />;

  if (embedded) {
    return <>
      <section className={`service-app-embedded service-app-embedded--${activeSection}`} data-service-surface={activeSection}>
        {appContent || <GenericApp section={activeSection} lang={lang} />}
      </section>
      {confirmDialog}
    </>;
  }
  return <>
    <LiveShell lang={lang} title={spec.title[lang]} eyebrow={spec.eyebrow[lang]} icon={spec.icon} accent={spec.accent} serviceId={activeSection} loading={loading && !stationOwnsLifecycle} available={available || activeSection === 'maintenance' || activeSection === 'cleanup' || activeSection === 'network' || activeSection === 'programs' || activeSection === 'disk' || activeSection === 'services' || activeSection === 'performance' || activeSection === 'security' || activeSection === 'diagnostics' || activeSection === 'backupRecovery' || activeSection === 'developerTools' || activeSection === 'privacy' || activeSection === 'drivers' || activeSection === 'monitoring' || activeSection === 'softwareEnvironment' || activeSection === 'postInstall' || activeSection === 'projectSonar' || Boolean(specialContent)} onRefresh={reload}>
      {appContent || <GenericApp section={activeSection} lang={lang} />}
      <div className={`service-app-bottom ${showSharedActionRail ? '' : 'service-app-bottom--contextual'}`}>
        {showSharedActionRail && <ActionRail tools={tools} lang={lang} toolStatuses={toolStatuses} bridgeElevated={bridgeElevated} onLaunch={launch} onCancel={onCancelTool} />}
        <SafetyNote lang={lang} />
      </div>
    </LiveShell>
    {confirmDialog}
  </>;
}
