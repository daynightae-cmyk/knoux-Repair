import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AppWindow, ArchiveRestore, ArrowRight, BadgeCheck, BarChart3, Boxes, Check,
  CheckCircle2, ChevronRight, CircleAlert, CloudCog, Copy, Cpu, DatabaseZap, Download, FolderKanban, Gauge, HardDrive,
  HeartPulse, Layers3, ListChecks, LoaderCircle, LockKeyhole, MemoryStick, MonitorCog, Network, PackageCheck, Radar, RefreshCw,
  Rocket, ScanSearch, ShieldCheck, SlidersHorizontal, Sparkles, TimerReset, Trash2, TriangleAlert, UserRoundCheck,
  WandSparkles, Wrench,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { ActiveSection, ToolStatus } from '../types';
import type {
  BackupRecoveryPreview, BridgeTool, CleanupPreview, DiagnosticsPreview, DriversPreview, ExecutionMode,
  NetworkPreview, OperationsPreview, OptimizationPreview, PostInstallPreview, PrivacyPreview, SoftwarePreview,
  SystemSnapshot, ToolRunOptions,
} from '../lib/api';
import { api } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { pickName } from '../lib/i18n';
import ExecutionConfirmDialog from './ExecutionConfirmDialog';
import DuplicateOrganizerApp from './DuplicateOrganizerApp';
import ProjectSonarApp from './ProjectSonarApp';

interface ServiceAppsProps {
  activeSection: ActiveSection;
  tools: BridgeTool[];
  toolStatuses: Record<string, ToolStatus>;
  lang: Lang;
  bridgeElevated: boolean;
  onRunTool: (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions) => void;
  onCancelTool: () => void;
}

type Localized = Record<Lang, string>;
type DataLoader = () => Promise<unknown>;

const COPY = {
  en: {
    refresh: 'Refresh', loading: 'Reading your device', unavailable: 'Live device information will appear when the local service is ready.',
    recommend: 'Recommended next step', choices: 'Available actions', deviceReady: 'Device overview', noAction: 'No action in progress',
    review: 'Review', start: 'Start', stop: 'Stop', permission: 'Device permission needed', safe: 'Your control comes first',
    safeBody: 'KNOUX explains changes and asks for confirmation before it applies them.', system: 'System', details: 'Details',
    healthy: 'Looking good', attention: 'Needs attention', open: 'Open', free: 'free', available: 'available',
  },
  ar: {
    refresh: 'تحديث', loading: 'جارٍ قراءة جهازك', unavailable: 'ستظهر معلومات الجهاز الحية عندما تصبح الخدمة المحلية جاهزة.',
    recommend: 'الخطوة المقترحة التالية', choices: 'الإجراءات المتاحة', deviceReady: 'نظرة عامة على الجهاز', noAction: 'لا يوجد إجراء قيد التنفيذ',
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

function bytes(value: number | null | undefined, lang: Lang) {
  if (value === null || value === undefined) return '—';
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString(lang, { maximumFractionDigits: 1 })} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toLocaleString(lang, { maximumFractionDigits: 1 })} MB`;
  return `${value.toLocaleString(lang)} B`;
}
function number(value: number | null | undefined, lang: Lang) { return value === null || value === undefined ? '—' : value.toLocaleString(lang); }
function percent(value: number | null | undefined) { return Math.max(0, Math.min(100, value || 0)); }
function preferredMode(tool: BridgeTool): ExecutionMode { return tool.AnalyzeOnlySupported ? 'analyze' : tool.WhatIfSupported ? 'preview' : 'run'; }
function tone(status: ToolStatus | undefined) { return status === 'success' ? 'is-success' : status === 'error' ? 'is-error' : status === 'running' ? 'is-running' : ''; }

function LiveShell({ lang, title, eyebrow, icon: Icon, accent, loading, available, onRefresh, children }: {
  lang: Lang; title: string; eyebrow: string; icon: ElementType; accent: string; loading: boolean; available: boolean; onRefresh: () => void; children: React.ReactNode;
}) {
  const text = COPY[lang];
  return <section className="service-app-shell" style={{ '--app-accent': accent } as React.CSSProperties}>
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

function HealthApp({ data, lang, onRunHealthCheck }: { data: SystemSnapshot; lang: Lang; onRunHealthCheck?: () => void }) {
  const health = Math.max(40, Math.min(100, 100 - Math.round(data.CpuLoad * .32) - Math.round((1 - data.FreeRamGB / Math.max(1, data.TotalRamGB)) * 24)));
  const text = COPY[lang];
  const firewallOn = Boolean(data.Firewall?.length && data.Firewall.every((item) => item.Enabled));
  const healthItems = [
    { icon: Cpu, label: lang === 'ar' ? 'المعالج' : 'CPU', value: `${data.CpuLoad}%`, good: data.CpuLoad < 80 },
    { icon: MemoryStick, label: lang === 'ar' ? 'الذاكرة' : 'Memory', value: `${number(data.FreeRamGB, lang)} GB`, good: data.FreeRamGB / Math.max(1, data.TotalRamGB) > .18 },
    { icon: HardDrive, label: lang === 'ar' ? 'الأقراص' : 'Storage', value: `${number(data.Drives.reduce((sum, drive) => sum + drive.FreeGB, 0), lang)} GB`, good: data.Drives.every((drive) => drive.FreeGB / Math.max(1, drive.TotalGB) > .1) },
    { icon: ShieldCheck, label: lang === 'ar' ? 'الحماية' : 'Protection', value: data.DefenderRealtime && firewallOn ? (lang === 'ar' ? 'جاهزة' : 'Ready') : (lang === 'ar' ? 'راجع' : 'Review'), good: data.DefenderRealtime && firewallOn },
  ];
  return <div className="health-app-view health-product-view">
    <section className="product-command-hero health-command-hero">
      <div className="health-copy"><p>{lang === 'ar' ? 'مركز صحة الجهاز' : 'Device health center'}</p><h2>{health > 76 ? text.healthy : text.attention}</h2><span>{lang === 'ar' ? 'مؤشر إرشادي محسوب من المعالج والذاكرة والتخزين وحالة الحماية الحالية.' : 'A guidance score calculated from current CPU, memory, storage and protection status.'}</span>{onRunHealthCheck && <button type="button" className="product-primary-action" onClick={onRunHealthCheck}><HeartPulse size={16} />{lang === 'ar' ? 'مراجعة فحص الصحة' : 'Review health check'}</button>}</div>
      <div className="health-score" style={{ '--score': `${health * 3.6}deg` } as React.CSSProperties}><div><b>{health}</b><span>/ 100</span><small>{lang === 'ar' ? 'مؤشر إرشادي' : 'guidance score'}</small></div></div>
      <aside className="health-live-summary"><span><Activity size={14} />{lang === 'ar' ? 'لقطة حيّة' : 'Live snapshot'}</span><strong>{data.Machine || '—'}</strong><small>{data.Os || '—'}</small></aside>
    </section>
    <section className="health-status-grid">{healthItems.map((item) => { const Icon = item.icon; return <article className={item.good ? 'is-good' : 'is-review'} key={item.label}><span><Icon size={17} /></span><div><small>{item.label}</small><strong>{item.value}</strong></div>{item.good ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}</article>; })}</section>
    <section className="health-metric-ribbon"><Metric icon={Cpu} label={lang === 'ar' ? 'المعالج' : 'CPU'} value={`${data.CpuLoad}%`} /><Metric icon={Gauge} label={lang === 'ar' ? 'الذاكرة المتاحة' : 'Free memory'} value={`${number(data.FreeRamGB, lang)} GB`} /><Metric icon={TimerReset} label={lang === 'ar' ? 'وقت التشغيل' : 'Uptime'} value={`${Math.floor(data.UptimeSeconds / 3600)}h`} /><Metric icon={Activity} label={lang === 'ar' ? 'التطبيقات' : 'Processes'} value={number(data.Processes, lang)} /></section>
    <section className="health-drive-deck"><div className="app-section-title"><div><p>{lang === 'ar' ? 'مساحة الجهاز' : 'Device storage'}</p><h2>{lang === 'ar' ? 'الأقراص المتصلة' : 'Connected drives'}</h2></div><span className="product-evidence-badge"><DatabaseZap size={13} />{lang === 'ar' ? 'بيانات الجهاز' : 'Device data'}</span></div>{data.Drives.map((drive) => <div className="health-drive" key={drive.Name}><span>{drive.Name}</span><div><i style={{ width: `${percent(100 - (drive.FreeGB / Math.max(1, drive.TotalGB)) * 100)}%` }} /></div><strong>{number(drive.FreeGB, lang)} GB {text.free}</strong></div>)}</section>
  </div>;
}

function CleanerApp({ data, lang, reviewableToolIds, onReviewTarget }: { data: CleanupPreview; lang: Lang; reviewableToolIds: Set<string>; onReviewTarget: (toolId: string) => void }) {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const selected = data.Targets.find((target) => target.ToolId === selectedToolId) || null;
  return <div className="cleaner-app-view cleaner-product-view">
    <section className="product-command-hero cleaner-hero-meter"><div><p>{lang === 'ar' ? 'محلل التنظيف' : 'Cleanup analyzer'}</p><strong>{bytes(data.Summary.EstimatedReclaimableBytes, lang)}</strong><span>{lang === 'ar' ? 'مساحة قابلة للمراجعة من الفئات التي وجدها الفحص الحقيقي.' : 'Reviewable space from categories found by the real scan.'}</span><div className="product-hero-actions">{selected && reviewableToolIds.has(selected.ToolId) ? <button type="button" className="product-primary-action" onClick={() => onReviewTarget(selected.ToolId)}><ListChecks size={16} />{lang === 'ar' ? 'مراجعة الفئة المختارة' : 'Review selected category'}</button> : <span className="product-selection-hint"><SlidersHorizontal size={15} />{selected ? (lang === 'ar' ? 'لا توجد مراجعة مسجلة لهذه الفئة' : 'No registered review for this category') : (lang === 'ar' ? 'اختر فئة للمراجعة' : 'Choose a category to review')}</span>}</div></div><div className="cleaner-meter-orbit"><Trash2 size={34} /><span>{number(data.Summary.TotalFiles, lang)}</span><small>{lang === 'ar' ? 'ملفاً قابلاً للمراجعة' : 'reviewable files'}</small></div></section>
    <section className="cleaner-buckets">{data.Targets.slice(0, 8).map((target) => { const selectedTarget = selectedToolId === target.ToolId; return <button type="button" className={selectedTarget ? 'is-selected' : ''} key={`${target.ToolId}-${target.Path}`} onClick={() => setSelectedToolId(target.ToolId)}><div className="cleaner-bucket-icon"><Boxes size={16} /></div><strong>{target.Category}</strong><span>{bytes(target.SizeBytes, lang)}</span><small>{target.UserDataExcluded ? (lang === 'ar' ? 'لا تشمل ملفاتك الشخصية' : 'Your personal files مستثناة') : (lang === 'ar' ? 'تحتاج مراجعة قبل الإزالة' : 'Review before removal')}</small>{selectedTarget && <i><CheckCircle2 size={14} /></i>}</button>; })}</section>
    <section className="cleaner-review-summary"><div><span>{lang === 'ar' ? 'اختيار المراجعة' : 'Review selection'}</span><strong>{selected ? selected.Category : (lang === 'ar' ? 'لم تُحدّد فئة بعد' : 'No category selected yet')}</strong><small>{selected ? `${bytes(selected.SizeBytes, lang)} · ${number(selected.FileCount, lang)} ${lang === 'ar' ? 'ملف' : 'files'}` : (lang === 'ar' ? 'لن تُنفذ أي عملية قبل المراجعة والتأكيد.' : 'Nothing runs before review and confirmation.')}</small></div><ShieldCheck size={22} /></section>
    <section className="cleaner-protection"><ArchiveRestore size={22} /><div><strong>{lang === 'ar' ? 'منطقة استعادة محمية' : 'Protected recovery area'}</strong><span>{bytes(data.Summary.QuarantineBytes, lang)} {lang === 'ar' ? 'محفوظة للاستعادة عند الحاجة' : 'kept available for recovery when needed'}</span></div><BadgeCheck size={20} /></section>
  </div>;
}

function PerformanceApp({ data, lang, reviewableToolIds, onReviewSignal }: { data: OptimizationPreview; lang: Lang; reviewableToolIds: Set<string>; onReviewSignal: (toolId: string) => void }) {
  const text = COPY[lang];
  const severity = (level: string) => level.toUpperCase() === 'HIGH' || level.toUpperCase() === 'CRITICAL' ? (lang === 'ar' ? 'أثر مرتفع' : 'High impact') : level.toUpperCase() === 'MEDIUM' ? (lang === 'ar' ? 'أثر متوسط' : 'Medium impact') : (lang === 'ar' ? 'أثر محدود' : 'Low impact');
  return <div className="performance-app-view performance-product-view"><section className="performance-cockpit"><div className="performance-gauge"><Gauge size={27} /><strong>{data.Cpu.LoadPercent}%</strong><span>{lang === 'ar' ? 'تحميل المعالج' : 'CPU load'}</span></div><div className="performance-brief"><p>{lang === 'ar' ? 'مركز الأداء' : 'Performance center'}</p><h2>{data.Signals.length ? text.attention : text.healthy}</h2><span>{lang === 'ar' ? 'يتم توليد فرص التحسين من إشارات الجهاز الحالية فقط.' : 'Opportunities are generated only from current device signals.'}</span></div><div className="performance-memory"><span>{lang === 'ar' ? 'ضغط الذاكرة' : 'Memory pressure'}</span><strong>{data.Memory.LoadPercent}%</strong><i><b style={{ width: `${percent(data.Memory.LoadPercent)}%` }} /></i><small>{number(data.Memory.FreeGB, lang)} GB {lang === 'ar' ? 'متاحة' : 'available'}</small></div></section><section className="performance-metrics-grid"><Metric icon={Cpu} label={lang === 'ar' ? 'المعالج' : 'CPU'} value={`${data.Cpu.LoadPercent}%`} /><Metric icon={MemoryStick} label={lang === 'ar' ? 'الذاكرة المستخدمة' : 'Memory used'} value={`${number(data.Memory.UsedGB, lang)} GB`} /><Metric icon={HardDrive} label={lang === 'ar' ? 'الأقراص' : 'Drives'} value={number(data.Disks.length, lang)} /><Metric icon={Activity} label={lang === 'ar' ? 'العمليات' : 'Processes'} value={number(data.ProcessCount, lang)} /></section><section className="performance-signals product-findings">{data.Signals.length ? data.Signals.slice(0, 6).map((signal) => <article key={signal.Code}><span className={`signal-level ${signal.Level.toLowerCase()}`} /><div><strong>{signal.Message}</strong><small>{severity(signal.Level)} · {lang === 'ar' ? 'مبني على قراءة الجهاز' : 'based on device reading'}</small></div>{signal.SuggestedTool && reviewableToolIds.has(signal.SuggestedTool) ? <button type="button" onClick={() => onReviewSignal(signal.SuggestedTool)}>{lang === 'ar' ? 'راجع' : 'Review'}<ChevronRight size={15} className="rtl:rotate-180" /></button> : <ChevronRight size={16} className="rtl:rotate-180" />}</article>) : <article className="performance-positive"><CheckCircle2 size={19} />{lang === 'ar' ? 'لا توجد إشارات أداء عاجلة حالياً.' : 'No urgent performance signals right now.'}</article>}</section><section className="performance-process-strip"><div><div><p>{lang === 'ar' ? 'أعلى التطبيقات استخداماً' : 'Top active apps'}</p><h3>{lang === 'ar' ? 'لقطة الاستخدام' : 'Usage snapshot'}</h3></div><Activity size={22} /></div>{data.TopProcesses.slice(0, 6).map((process) => <span key={process.Id}><b>{process.Name}</b><small>{number(process.MemoryMB, lang)} MB</small></span>)}</section></div>;
}

function StorageApp({ data, lang }: { data: SystemSnapshot; lang: Lang }) {
  const text = COPY[lang]; const [activeDriveName, setActiveDriveName] = useState<string | null>(data.Drives[0]?.Name || null); const largest = data.Drives.reduce((current, drive) => drive.TotalGB > current.TotalGB ? drive : current, data.Drives[0]); const activeDrive = data.Drives.find((drive) => drive.Name === activeDriveName) || data.Drives[0]; const totalFree = data.Drives.reduce((total, drive) => total + drive.FreeGB, 0); const totalCapacity = data.Drives.reduce((total, drive) => total + drive.TotalGB, 0);
  return <div className="storage-app-view storage-product-view"><section className="product-command-hero storage-hero"><div><p>{lang === 'ar' ? 'مستكشف التخزين' : 'Storage explorer'}</p><h2>{number(totalFree, lang)} GB</h2><span>{lang === 'ar' ? 'مساحة متاحة عبر الأقراص المتصلة التي اكتشفها الجهاز.' : 'Available capacity across drives detected on this device.'}</span></div><HardDrive size={52} /><aside><span>{lang === 'ar' ? 'السعة الكلية' : 'Total capacity'}</span><strong>{number(totalCapacity, lang)} GB</strong><small>{lang === 'ar' ? `أكبر قرص: ${largest?.Name || '—'}` : `Largest drive: ${largest?.Name || '—'}`}</small></aside></section><section className="storage-drive-wall">{data.Drives.map((drive) => { const used = percent(100 - drive.FreeGB / Math.max(1, drive.TotalGB) * 100); const selected = activeDrive?.Name === drive.Name; return <button type="button" className={selected ? 'is-selected' : ''} key={drive.Name} onClick={() => setActiveDriveName(drive.Name)}><header><span>{drive.Name}</span><strong>{used.toFixed(0)}%</strong></header><div className="storage-bar"><i style={{ width: `${used}%` }} /></div><footer><span>{number(drive.FreeGB, lang)} GB {text.free}</span><span>{number(drive.TotalGB, lang)} GB</span></footer></button>; })}</section>{activeDrive && <section className="storage-inspector"><div><p>{lang === 'ar' ? 'تفاصيل القرص المختار' : 'Selected drive details'}</p><h3>{activeDrive.Name}</h3><span>{lang === 'ar' ? 'هذه القراءة تعرض السعة الفعلية فقط. تصفح المجلدات أو حذف الملفات غير متاحين من هذه الشاشة حتى تتوفر بيانات فهرسة حقيقية.' : 'This reading shows actual capacity only. Folder browsing or deletion is not available here until real indexing data is available.'}</span></div><div className="storage-inspector-number"><strong>{number(percent(100 - activeDrive.FreeGB / Math.max(1, activeDrive.TotalGB) * 100), lang)}%</strong><small>{lang === 'ar' ? 'مستخدم' : 'used'}</small></div></section>}</div>;
}

function NetworkApp({ data, lang }: { data: NetworkPreview; lang: Lang }) {
  const stages = [
    { label: lang === 'ar' ? 'المحوّل' : 'Adapter', detail: `${number(data.ActiveAdapters, lang)} ${lang === 'ar' ? 'واجهة نشطة' : 'active adapters'}`, ready: data.ActiveAdapters > 0 },
    { label: 'IPv4', detail: data.Adapters.some((adapter) => Boolean(adapter.IPv4)) ? (lang === 'ar' ? 'عنوان متاح' : 'Address available') : (lang === 'ar' ? 'لا يوجد عنوان' : 'No address'), ready: data.Adapters.some((adapter) => Boolean(adapter.IPv4)) },
    { label: lang === 'ar' ? 'البوابة' : 'Gateway', detail: `${number(data.WithGateway, lang)} ${lang === 'ar' ? 'مسار متاح' : 'available routes'}`, ready: data.WithGateway > 0 },
    { label: 'DNS', detail: `${number(data.WithDns, lang)} ${lang === 'ar' ? 'واجهة لديها DNS' : 'adapters with DNS'}`, ready: data.WithDns > 0 },
  ];
  return <div className="network-app-view network-product-view"><section className="network-map"><div className="network-node is-device"><MonitorCog size={22} /><span>{lang === 'ar' ? 'هذا الجهاز' : 'This device'}</span></div><i /><div className="network-node is-router"><Network size={23} /><span>{lang === 'ar' ? 'بوابة الشبكة' : 'Gateway'}</span></div><i /><div className="network-node is-world"><WandSparkles size={23} /><span>{lang === 'ar' ? 'الوجهة' : 'Destination'}</span></div></section><section className="network-summary"><article><span>{lang === 'ar' ? 'اتصالات نشطة' : 'Active connections'}</span><strong>{number(data.ActiveAdapters, lang)}</strong><small>{lang === 'ar' ? 'واجهة شبكة' : 'network adapters'}</small></article><article><span>{lang === 'ar' ? 'بوابة متاحة' : 'Gateway available'}</span><strong>{number(data.WithGateway, lang)}</strong><small>{lang === 'ar' ? 'اتصال جاهز' : 'ready links'}</small></article><article><span>{lang === 'ar' ? 'خدمة أسماء' : 'Name service'}</span><strong>{number(data.WithDns, lang)}</strong><small>DNS</small></article></section><section className="network-pipeline"><div className="app-section-title"><div><p>{lang === 'ar' ? 'مسار التشخيص' : 'Diagnostic pipeline'}</p><h2>{lang === 'ar' ? 'قراءات الاتصال الحالية' : 'Current connection readings'}</h2></div><span className="product-evidence-badge"><DatabaseZap size={13} />{lang === 'ar' ? 'قراءة حيّة' : 'Live read'}</span></div><div>{stages.map((stage, index) => <article className={stage.ready ? 'is-passed' : 'is-review'} key={stage.label}><span>{stage.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}</span><div><strong>{index + 1}. {stage.label}</strong><small>{stage.detail}</small></div></article>)}</div></section><section className="network-adapter-list"><div className="app-section-title"><div><p>{lang === 'ar' ? 'تفاصيل الاتصال' : 'Connection details'}</p><h2>{lang === 'ar' ? 'الواجهات المكتشفة' : 'Detected adapters'}</h2></div></div>{data.Adapters.slice(0, 6).map((adapter) => <article key={`${adapter.Description}-${adapter.MacAddress}`}><span className={adapter.Gateway ? 'network-status-dot' : 'network-status-dot is-review'} /><div><strong>{adapter.Description}</strong><small>{adapter.IPv4 || (lang === 'ar' ? 'لا يوجد عنوان حالي' : 'No current address')} · {adapter.DNS.length ? adapter.DNS.join(', ') : 'DNS —'}</small></div><b>{adapter.Gateway ? (lang === 'ar' ? 'متصل' : 'Connected') : (lang === 'ar' ? 'راجع' : 'Review')}</b></article>)}</section></div>;
}

function SecurityApp({ data, lang }: { data: SystemSnapshot; lang: Lang }) {
  const firewallOn = Boolean(data.Firewall?.length && data.Firewall.every((item) => item.Enabled)); const secure = data.DefenderRunning && data.DefenderRealtime && firewallOn;
  const findings = [
    { label: lang === 'ar' ? 'الحماية الفورية' : 'Real-time protection', active: data.DefenderRealtime, detail: lang === 'ar' ? 'تفحص ويندوز الملفات والتغييرات أثناء الاستخدام.' : 'Windows monitors files and changes while you work.' },
    { label: lang === 'ar' ? 'خدمة الحماية' : 'Protection service', active: data.DefenderRunning, detail: lang === 'ar' ? 'خدمة Windows Defender متاحة للنظام.' : 'The Windows Defender service is available to the system.' },
    { label: lang === 'ar' ? 'الجدار الناري' : 'Firewall', active: firewallOn, detail: lang === 'ar' ? 'كل ملفات تعريف الجدار الناري التي أمكن قراءتها مفعّلة.' : 'Every firewall profile that could be read is enabled.' },
  ];
  return <div className="security-app-view security-product-view"><section className={`security-shield ${secure ? 'is-secure' : 'is-review'}`}><ShieldCheck size={60} /><div><p>{lang === 'ar' ? 'مركز الحماية' : 'Protection center'}</p><h2>{secure ? (lang === 'ar' ? 'الحماية مفعّلة' : 'Protection is on') : (lang === 'ar' ? 'تحتاج الحماية مراجعة' : 'Protection needs review')}</h2><span>{lang === 'ar' ? 'تقييم مبني على Windows Defender وحالة الجدار الناري الحالية.' : 'An assessment based on current Windows Defender and firewall status.'}</span></div><span className="security-posture-chip">{secure ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}{secure ? (lang === 'ar' ? 'جاهز' : 'Ready') : (lang === 'ar' ? 'راجع' : 'Review')}</span></section><section className="security-checks">{findings.map((finding) => <SecurityCheck key={finding.label} icon={finding.label === 'Firewall' || finding.label === 'الجدار الناري' ? LockKeyhole : ShieldCheck} label={finding.label} value={finding.active} lang={lang} />)}</section><section className="security-finding-list">{findings.filter((finding) => !finding.active).length ? findings.filter((finding) => !finding.active).map((finding) => <article key={finding.label}><CircleAlert size={19} /><div><strong>{finding.label}</strong><span>{finding.detail}</span></div><small>{lang === 'ar' ? 'راجع إجراء الحماية المتاح أدناه.' : 'Review an available protection action below.'}</small></article>) : <article className="is-clear"><CheckCircle2 size={19} /><div><strong>{lang === 'ar' ? 'لا توجد ملاحظة حماية فورية' : 'No immediate protection finding'}</strong><span>{lang === 'ar' ? 'يعرض هذا الملخص فقط ما استطاع الجهاز التحقق منه الآن.' : 'This summary reports only what the device could verify now.'}</span></div></article>}</section><section className="security-signature"><BadgeCheck size={20} /><div><span>{lang === 'ar' ? 'آخر تعريفات الحماية' : 'Protection definitions'}</span><strong>{data.DefenderSignatures || '—'}</strong></div></section></div>;
}
function SecurityCheck({ icon: Icon, label, value, lang }: { icon: ElementType; label: string; value: boolean; lang: Lang }) { return <article className={value ? 'is-good' : 'is-review'}><Icon size={20} /><div><strong>{label}</strong><span>{value ? (lang === 'ar' ? 'جاهز' : 'Ready') : (lang === 'ar' ? 'تحتاج مراجعة' : 'Needs review')}</span></div>{value ? <Check size={18} /> : <TriangleAlert size={18} />}</article>; }

function DiagnosticsApp({ data, lang }: { data: DiagnosticsPreview; lang: Lang }) {
  const tests = [
    { label: lang === 'ar' ? 'أحداث النظام' : 'System events', state: data.Events.ErrorOrCriticalCount ? 'warning' : 'passed', detail: data.Events.ErrorOrCriticalCount ? `${number(data.Events.ErrorOrCriticalCount, lang)} ${lang === 'ar' ? 'حدث يحتاج مراجعة' : 'events need review'}` : (lang === 'ar' ? 'لا توجد أحداث حرجة في الفترة المقروءة' : 'No critical events in the observed period') },
    { label: lang === 'ar' ? 'الأجهزة' : 'Devices', state: data.Devices.ProblemsObserved ? 'warning' : 'passed', detail: data.Devices.ProblemsObserved ? `${number(data.Devices.ProblemsObserved, lang)} ${lang === 'ar' ? 'جهاز يحتاج انتباهاً' : 'devices need attention'}` : (lang === 'ar' ? 'لا توجد مشكلة جهاز مُكتشفة' : 'No detected device problem') },
    { label: lang === 'ar' ? 'التخزين الذكي' : 'Storage SMART', state: data.Storage.DisksObserved ? (data.Storage.SmartFailurePredicted ? 'warning' : 'passed') : 'unavailable', detail: data.Storage.DisksObserved ? (data.Storage.SmartFailurePredicted ? (lang === 'ar' ? 'هناك إشارة تخزين تحتاج متابعة' : 'A storage signal needs follow-up') : (lang === 'ar' ? 'لم تظهر إشارة فشل متوقعة' : 'No predicted failure signal observed')) : (lang === 'ar' ? 'لم تتوفر بيانات SMART' : 'SMART data unavailable') },
    { label: lang === 'ar' ? 'الاعتمادية' : 'Reliability', state: data.Reliability.RecordsObserved ? 'passed' : 'unavailable', detail: data.Reliability.RecordsObserved ? `${number(data.Reliability.RecordsObserved, lang)} ${lang === 'ar' ? 'سجل تمت قراءته' : 'records read'}` : (lang === 'ar' ? 'لا توجد سجلات متاحة' : 'No records available') },
  ];
  const score = Math.max(0, 100 - data.Events.ErrorOrCriticalCount * 2 - data.Devices.ProblemsObserved * 8 - data.Storage.SmartFailurePredicted * 18);
  return <div className="diagnostics-app-view diagnostics-product-view"><section className="diagnostic-scoreboard"><div className="diagnostic-score"><ScanSearch size={29} /><strong>{score}</strong><span>{lang === 'ar' ? 'مؤشر إرشادي' : 'guidance score'}</span></div><div><p>{lang === 'ar' ? 'مركز الفحص الاحترافي' : 'Professional checkup center'}</p><h2>{data.System.Os}</h2><span>{lang === 'ar' ? `قراءة النظام منذ ${data.System.UptimeHours.toLocaleString(lang)} ساعة تشغيل` : `System reading after ${data.System.UptimeHours.toLocaleString(lang)} hours of uptime`}</span></div><BarChart3 size={42} /></section><section className="diagnostic-finding-grid"><FindingCard icon={TriangleAlert} title={lang === 'ar' ? 'تنبيهات النظام' : 'System alerts'} value={data.Events.ErrorOrCriticalCount} detail={lang === 'ar' ? 'خلال الأيام الأخيرة' : 'in recent days'} lang={lang} /><FindingCard icon={Wrench} title={lang === 'ar' ? 'أجهزة تحتاج انتباهاً' : 'Devices needing attention'} value={data.Devices.ProblemsObserved} detail={lang === 'ar' ? 'ضمن الأجهزة المكتشفة' : 'among detected devices'} lang={lang} /><FindingCard icon={HardDrive} title={lang === 'ar' ? 'تحذيرات التخزين' : 'Storage warnings'} value={data.Storage.SmartFailurePredicted} detail={lang === 'ar' ? 'مؤشرات للمتابعة' : 'signals to follow up'} lang={lang} /></section><section className="diagnostic-test-list"><div className="app-section-title"><div><p>{lang === 'ar' ? 'نتائج الفحص' : 'Checkup results'}</p><h2>{lang === 'ar' ? 'اختبارات الجهاز والنظام' : 'System and device checks'}</h2></div></div>{tests.map((test) => <article className={`is-${test.state}`} key={test.label}><span>{test.state === 'passed' ? <CheckCircle2 size={17} /> : test.state === 'warning' ? <TriangleAlert size={17} /> : <CircleAlert size={17} />}</span><div><strong>{test.label}</strong><small>{test.detail}</small></div><b>{test.state === 'passed' ? (lang === 'ar' ? 'اجتاز' : 'Passed') : test.state === 'warning' ? (lang === 'ar' ? 'راجع' : 'Review') : (lang === 'ar' ? 'غير متاح' : 'Unavailable')}</b></article>)}</section><section className="diagnostic-report-card"><Download size={23} /><div><strong>{lang === 'ar' ? 'تقرير مبسط لجهازك' : 'A simple report for your device'}</strong><span>{lang === 'ar' ? 'يمكنك حفظ أو مشاركة دليل الدعم من نتيجة أي إجراء مكتمل.' : 'You can save or share support evidence from any completed action.'}</span></div><ChevronRight size={17} className="rtl:rotate-180" /></section></div>;
}
function FindingCard({ icon: Icon, title, value, detail, lang }: { icon: ElementType; title: string; value: number; detail: string; lang: Lang }) { return <article className={value ? 'has-finding' : 'is-clear'}><Icon size={20} /><strong>{number(value, lang)}</strong><span>{title}</span><small>{detail}</small></article>; }

function RecoveryApp({ data, lang }: { data: BackupRecoveryPreview; lang: Lang }) {
  const readiness = [
    { label: lang === 'ar' ? 'نقطة استعادة' : 'Restore point', ready: data.RestorePoints.Count > 0, detail: data.RestorePoints.Count ? `${number(data.RestorePoints.Count, lang)} ${lang === 'ar' ? 'متاحة' : 'available'}` : (lang === 'ar' ? 'لم تُكتشف نقطة حالياً' : 'No point detected') },
    { label: lang === 'ar' ? 'نسخة محلية' : 'Local backup', ready: Boolean(data.LocalBackups.Latest), detail: data.LocalBackups.Latest ? data.LocalBackups.Latest.Name : (lang === 'ar' ? 'لا توجد نسخة مكتشفة' : 'No backup discovered') },
    { label: lang === 'ar' ? 'نسخة ظل' : 'Shadow copy', ready: data.ShadowCopies.Count > 0, detail: data.ShadowCopies.Count ? `${number(data.ShadowCopies.Count, lang)} ${lang === 'ar' ? 'متاحة' : 'available'}` : (lang === 'ar' ? 'لا توجد نسخة ظل' : 'No shadow copy') },
  ];
  return <div className="recovery-app-view recovery-product-view"><section className="recovery-vault"><ArchiveRestore size={39} /><div><p>{lang === 'ar' ? 'مركز الحماية والاستعادة' : 'Protection & recovery center'}</p><h2>{number(readiness.filter((item) => item.ready).length, lang)} / {number(readiness.length, lang)} {lang === 'ar' ? 'خيارات جاهزة' : 'options ready'}</h2><span>{lang === 'ar' ? 'نظرة مبنية على نقاط الاستعادة والنسخ المحلية التي وجدها الجهاز.' : 'A view based on restore points and local backups found by the device.'}</span></div><BadgeCheck size={25} /></section><section className="recovery-readiness-grid">{readiness.map((item) => <article className={item.ready ? 'is-ready' : 'is-review'} key={item.label}><span>{item.ready ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></article>)}</section><section className="recovery-timeline">{data.RestorePoints.Items.slice(0, 4).map((point, index) => <article key={`${point.SequenceNumber}-${point.Description}`}><span>{index + 1}</span><div><strong>{point.Description}</strong><small>{point.CreatedAt || '—'}</small></div><CheckCircle2 size={16} /></article>)}</section><section className="recovery-backup-card"><HardDrive size={23} /><div><p>{lang === 'ar' ? 'أحدث نسخة محلية' : 'Latest local backup'}</p><strong>{data.LocalBackups.Latest?.Name || (lang === 'ar' ? 'لا توجد نسخة مكتشفة' : 'No backup discovered')}</strong><span>{data.LocalBackups.Latest ? `${bytes(data.LocalBackups.Latest.SizeBytes, lang)} · ${data.LocalBackups.Latest.FileCount.toLocaleString(lang)} ${lang === 'ar' ? 'ملف' : 'files'}` : (lang === 'ar' ? 'لا تعرض هذه الشاشة استعادة لا يمكن تأكيد مصدرها.' : 'This screen does not offer recovery without a confirmed source.')}</span></div></section></div>;
}

function LibraryApp({ data, lang, variant }: { data: SoftwarePreview; lang: Lang; variant: 'software' | 'apps' | 'developer' }) {
  const [filter, setFilter] = useState<'all' | 'desktop' | 'store'>('all'); const [selectedName, setSelectedName] = useState<string | null>(data.Items[0]?.Name || null);
  const labels = variant === 'developer' ? { title: lang === 'ar' ? 'بيئة العمل' : 'Work environment', subtitle: lang === 'ar' ? 'الأدوات والتطبيقات المحلية' : 'Local tools and applications' } : variant === 'apps' ? { title: lang === 'ar' ? 'مركز التطبيقات' : 'App center', subtitle: lang === 'ar' ? 'كل ما هو مثبت على الجهاز' : 'Everything installed on this device' } : { title: lang === 'ar' ? 'مكتبة البرامج' : 'Software library', subtitle: lang === 'ar' ? 'تطبيقاتك في مكان واحد' : 'Your applications in one place' };
  const items = data.Items.filter((item) => filter === 'all' || (filter === 'desktop' ? item.Kind === 'Desktop' : item.Kind === 'Appx')); const selected = items.find((item) => item.Name === selectedName) || data.Items.find((item) => item.Name === selectedName) || null;
  return <div className="library-app-view library-product-view"><section className="library-overview"><div><p>{labels.subtitle}</p><h2>{number(data.Total, lang)}</h2><span>{labels.title}</span></div><Boxes size={45} /><aside><span>{lang === 'ar' ? 'تطبيقات سطح المكتب' : 'Desktop apps'}</span><strong>{number(data.DesktopCount, lang)}</strong><span>{lang === 'ar' ? 'تطبيقات المتجر' : 'Store apps'}</span><strong>{number(data.AppxCount, lang)}</strong></aside></section><section className="library-toolbar"><div><span>{lang === 'ar' ? 'عرض' : 'Show'}</span>{([['all', lang === 'ar' ? 'الكل' : 'All'], ['desktop', lang === 'ar' ? 'سطح المكتب' : 'Desktop'], ['store', lang === 'ar' ? 'المتجر' : 'Store']] as const).map(([id, label]) => <button type="button" className={filter === id ? 'is-active' : ''} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div><small>{data.Truncated ? (lang === 'ar' ? 'تُعرض عينة من الجرد المتاح.' : 'A sample of the available inventory is displayed.') : (lang === 'ar' ? 'جرد التطبيقات مكتمل.' : 'Application inventory is complete.')}</small></section><section className="library-shelf">{items.slice(0, 12).map((item) => <button type="button" className={selected?.Name === item.Name ? 'is-selected' : ''} key={`${item.Name}-${item.Version}`} onClick={() => setSelectedName(item.Name)}><span>{item.Name.slice(0, 1).toUpperCase()}</span><div><strong>{item.Name}</strong><small>{item.Publisher || (lang === 'ar' ? 'تطبيق محلي' : 'Local application')}</small></div><b>{item.Version || '—'}</b></button>)}</section>{selected && <section className="library-detail-card"><div><p>{lang === 'ar' ? 'التطبيق المختار' : 'Selected application'}</p><h3>{selected.Name}</h3><span>{selected.Publisher || (lang === 'ar' ? 'ناشر غير معروف' : 'Unknown publisher')} · {selected.Version || '—'}</span></div><div><span>{lang === 'ar' ? 'المصدر' : 'Source'}</span><strong>{selected.Kind === 'Appx' ? (lang === 'ar' ? 'متجر ويندوز' : 'Windows Store') : (lang === 'ar' ? 'سطح المكتب' : 'Desktop')}</strong></div><div><span>{lang === 'ar' ? 'إزالة مسجلة' : 'Registered uninstall'}</span><strong>{selected.CanUninstall ? (lang === 'ar' ? 'متاحة عبر إجراء معتمد' : 'Available through an approved action') : (lang === 'ar' ? 'غير متاحة' : 'Unavailable')}</strong></div></section>}</div>;
}

function PrivacyApp({ data, lang }: { data: PrivacyPreview; lang: Lang }) { const [selectedId, setSelectedId] = useState<string | null>(data.Settings[0]?.Id || null); const selected = data.Settings.find((setting) => setting.Id === selectedId) || null; return <div className="privacy-app-view privacy-product-view"><section className="privacy-hero"><UserRoundCheck size={42} /><div><p>{lang === 'ar' ? 'مركز تدقيق الخصوصية' : 'Privacy audit center'}</p><h2>{number(data.Settings.filter((setting) => setting.Available).length, lang)} {lang === 'ar' ? 'خيارات جاهزة للمراجعة' : 'choices ready to review'}</h2><span>{lang === 'ar' ? 'الحالات أدناه مأخوذة من إعدادات الجهاز المتاحة الآن؛ أي تغيير يمر بالمراجعة والتأكيد.' : 'The states below come from device settings available now; every change goes through review and confirmation.'}</span></div></section><section className="privacy-choice-grid">{data.Settings.slice(0, 8).map((setting) => <button type="button" className={selected?.Id === setting.Id ? 'is-selected' : ''} key={setting.Id} onClick={() => setSelectedId(setting.Id)}><span className={setting.Available ? 'is-enabled' : 'is-muted'} /><div><strong>{setting.Name}</strong><small>{setting.Detail}</small></div><ChevronRight size={16} className="rtl:rotate-180" /></button>)}</section>{selected && <section className="privacy-detail-card"><div><p>{lang === 'ar' ? 'تفاصيل الاختيار' : 'Selection details'}</p><h3>{selected.Name}</h3><span>{selected.Detail}</span></div><div><span>{lang === 'ar' ? 'الحالة الحالية' : 'Current state'}</span><strong>{String(selected.State || '—')}</strong></div><div><span>{lang === 'ar' ? 'قابل للمراجعة' : 'Reviewable'}</span><strong>{selected.Available ? (lang === 'ar' ? 'نعم، بإجراء معتمد' : 'Yes, through an approved action') : (lang === 'ar' ? 'غير متاح حالياً' : 'Not currently available')}</strong></div></section>}<section className="privacy-activity"><Activity size={20} /><span>{lang === 'ar' ? 'النشاط المحلي المسجّل' : 'Local activity record'}</span><strong>{number(data.ActivityEvidence.RunHistoryEntryCount, lang)}</strong></section></div>; }

function DriverApp({ data, lang }: { data: DriversPreview; lang: Lang }) { const [selectedInf, setSelectedInf] = useState<string | null>(data.ReviewDrivers[0]?.InfName || null); const selected = data.ReviewDrivers.find((driver) => driver.InfName === selectedInf) || null; return <div className="driver-app-view driver-product-view"><section className="driver-garage-hero"><Wrench size={40} /><div><p>{lang === 'ar' ? 'مركز التعريفات والأجهزة' : 'Driver & device center'}</p><h2>{number(data.Summary.TotalDrivers, lang)} {lang === 'ar' ? 'تعريفاً مكتشفاً' : 'drivers discovered'}</h2><span>{lang === 'ar' ? 'يعرض هذا المركز جرداً فعلياً للتوقيع والحالة والإشارات التي تستحق المراجعة.' : 'This center shows a real inventory of signatures, status, and review signals.'}</span></div></section><section className="driver-stat-lane"><Metric icon={ShieldCheck} label={lang === 'ar' ? 'موثوق' : 'Trusted'} value={number(data.Summary.SignedDrivers, lang)} /><Metric icon={TriangleAlert} label={lang === 'ar' ? 'للمراجعة' : 'Review'} value={number(data.Summary.UnsignedDrivers + data.Summary.DeviceProblems, lang)} /><Metric icon={Layers3} label={lang === 'ar' ? 'من جهات أخرى' : 'Third party'} value={number(data.Summary.ThirdPartyDrivers, lang)} /></section><section className="driver-inventory"><div className="app-section-title"><div><p>{lang === 'ar' ? 'قائمة المراجعة' : 'Review inventory'}</p><h2>{lang === 'ar' ? 'التعريفات التي تحتاج تدقيقاً' : 'Drivers requiring attention'}</h2></div><span className="product-evidence-badge"><DatabaseZap size={13} />{lang === 'ar' ? 'جرد حي' : 'Live inventory'}</span></div>{data.ReviewDrivers.slice(0, 8).map((driver) => <button type="button" className={selected?.InfName === driver.InfName ? 'is-selected' : ''} key={`${driver.DeviceName}-${driver.InfName}`} onClick={() => setSelectedInf(driver.InfName)}><span className={driver.Signed ? 'is-signed' : 'is-review'} /><div><strong>{driver.DeviceName}</strong><small>{driver.Provider} · {driver.Version || '—'}</small></div><b>{driver.ReviewSignals.length ? driver.ReviewSignals.join(' · ') : (lang === 'ar' ? 'راجع الحالة' : 'Review status')}</b></button>)}</section>{selected && <section className="driver-detail-card"><div><p>{lang === 'ar' ? 'تفاصيل العنصر المختار' : 'Selected driver details'}</p><h3>{selected.DeviceName}</h3><span>{selected.Provider} · {selected.DeviceClass} · {selected.Version || '—'}</span></div><div><span>{lang === 'ar' ? 'التوقيع' : 'Signature'}</span><strong>{selected.Signed ? (lang === 'ar' ? 'موثّق' : 'Signed') : (lang === 'ar' ? 'غير موثّق' : 'Unsigned')}</strong></div><div><span>{lang === 'ar' ? 'إشارات المراجعة' : 'Review signals'}</span><strong>{selected.ReviewSignals.length ? selected.ReviewSignals.join(', ') : '—'}</strong></div></section>}</div>; }

function SetupApp({ data, lang }: { data: PostInstallPreview; lang: Lang }) { return <div className="setup-app-view"><section className="setup-hero"><Rocket size={44} /><div><p>{lang === 'ar' ? 'استعداد الجهاز' : 'Device readiness'}</p><h2>{data.System.Caption}</h2><span>{lang === 'ar' ? 'اختر ما تحتاجه فقط لإعداد جهازك.' : 'Choose only what you need to prepare your device.'}</span></div><span className="setup-ready-badge">{data.Winget.Available ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{data.Winget.Available ? (lang === 'ar' ? 'جاهز' : 'Ready') : (lang === 'ar' ? 'راجع' : 'Review')}</span></section><section className="setup-checklist"><SetupCheck label={lang === 'ar' ? 'عروض التعريفات' : 'Driver offers'} value={data.DriverOffers.Count || 0} lang={lang} /><SetupCheck label={lang === 'ar' ? 'تطبيقات أساسية' : 'Essential apps'} value={data.Catalog.filter((item) => !item.Detected).length} lang={lang} /><SetupCheck label={lang === 'ar' ? 'إعادة تشغيل معلقة' : 'Pending restart'} value={data.System.PendingRestartSignals.length} lang={lang} /></section><section className="setup-catalog-preview">{data.Catalog.slice(0, 4).map((item) => <article key={item.PackageId}><span className={item.Detected ? 'is-detected' : ''}><PackageCheck size={17} /></span><div><strong>{item.Name}</strong><small>{item.Category}</small></div><b>{item.Detected ? (lang === 'ar' ? 'موجود' : 'Installed') : (lang === 'ar' ? 'متاح' : 'Available')}</b></article>)}</section></div>; }
function SetupCheck({ label, value, lang }: { label: string; value: number; lang: Lang }) { return <article><span>{value}</span><strong>{label}</strong><small>{value ? (lang === 'ar' ? 'راجع الخيارات' : 'Review choices') : (lang === 'ar' ? 'مكتمل' : 'Complete')}</small></article>; }

function OperationsApp({ data, lang }: { data: OperationsPreview; lang: Lang }) { return <div className="operations-app-view"><section className="operations-radar"><div className="radar-grid"><i /><i /><i /><b /></div><div><p>{lang === 'ar' ? 'نشاط الجهاز' : 'Device activity'}</p><h2>{number(data.Processes.Total, lang)} {lang === 'ar' ? 'تطبيقاً نشطاً' : 'active processes'}</h2><span>{lang === 'ar' ? 'صورة مباشرة لاستخدام جهازك الآن.' : 'A live picture of how your device is being used.'}</span></div></section><section className="operations-columns"><article><header><Cpu size={18} /><span>{lang === 'ar' ? 'استخدام الذاكرة' : 'Memory use'}</span></header>{data.Processes.TopMemory.slice(0, 4).map((process) => <div key={process.ProcessId}><strong>{process.Name}</strong><span>{number(process.MemoryMB, lang)} MB</span></div>)}</article><article><header><Activity size={18} /><span>{lang === 'ar' ? 'الخدمات' : 'Services'}</span></header><div className="operations-service-stat"><strong>{number(data.Services.Running, lang)}</strong><span>{lang === 'ar' ? 'خدمة تعمل' : 'services running'}</span></div><div className="operations-service-stat"><strong>{number(data.Services.AutomaticStoppedForReview.length, lang)}</strong><span>{lang === 'ar' ? 'تحتاج مراجعة' : 'need review'}</span></div></article></section></div>; }



function GenericApp({ section, lang }: { section: ActiveSection; lang: Lang }) { const labels: Partial<Record<ActiveSection, Localized>> = { services: { en: 'Device activity room', ar: 'غرفة نشاط الجهاز' }, monitoring: { en: 'Live device monitor', ar: 'مراقب الجهاز الحي' } }; return <div className="generic-app-view"><MonitorCog size={45} /><h2>{labels[section]?.[lang] || (lang === 'ar' ? 'خدمة KNOUX' : 'KNOUX service')}</h2><span>{lang === 'ar' ? 'ستظهر المعلومات الفعلية والخطوات المناسبة هنا عندما تصبح الخدمة جاهزة.' : 'Live information and the right next steps will appear here when the service is ready.'}</span></div>; }
function OfflineScene({ section, lang, icon: Icon }: { section: ActiveSection; lang: Lang; icon: ElementType }) { const labels: Partial<Record<ActiveSection, Localized>> = { maintenance: { en: 'Ready to measure your device health', ar: 'جاهز لقياس صحة جهازك' }, cleanup: { en: 'Ready to map cleanable space', ar: 'جاهز لرسم المساحة القابلة للتنظيف' }, performance: { en: 'Ready to build a speed picture', ar: 'جاهز لبناء صورة عن أداء الجهاز' }, disk: { en: 'Ready to explore your storage', ar: 'جاهز لاستكشاف مساحة التخزين' }, network: { en: 'Ready to trace your connection', ar: 'جاهز لتتبّع اتصالك' }, security: { en: 'Ready to check your protection', ar: 'جاهز لفحص حمايتك' }, diagnostics: { en: 'Ready to prepare a device checkup', ar: 'جاهز لإعداد فحص للجهاز' }, backupRecovery: { en: 'Ready to open your recovery vault', ar: 'جاهز لفتح خزنة الاستعادة' }, privacy: { en: 'Ready to review your privacy choices', ar: 'جاهز لمراجعة خيارات الخصوصية' }, softwareEnvironment: { en: 'Ready to organise your software library', ar: 'جاهز لتنظيم مكتبة برامجك' }, postInstall: { en: 'Ready to prepare a new device', ar: 'جاهز لتجهيز جهاز جديد' } }; const title = labels[section]?.[lang] || (lang === 'ar' ? 'جاهز لعرض بيانات هذه الخدمة' : 'Ready to show this service'); return <section className={`offline-scene offline-${section}`}><div className="offline-scene-motif"><i /><i /><i /><Icon size={34} /></div><div><p>{lang === 'ar' ? 'تجربة الخدمة' : 'Service experience'}</p><h2>{title}</h2><span>{lang === 'ar' ? 'سيظهر مخطط الخدمة وبيانات جهازك الحقيقية فور جاهزية الاتصال المحلي.' : 'The service canvas and real device details appear as soon as the local connection is ready.'}</span></div></section>; }

function Metric({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) { return <article><Icon size={16} /><div><span>{label}</span><strong>{value}</strong></div></article>; }

export default function ServiceApps({ activeSection, tools, toolStatuses, lang, bridgeElevated, onRunTool, onCancelTool }: ServiceAppsProps) {
  const [pending, setPending] = useState<{ tool: BridgeTool; mode: ExecutionMode; options?: ToolRunOptions } | null>(null);
  const { data, loading, available, reload } = useServiceData(activeSection);
  const launch = (tool: BridgeTool) => setPending({ tool, mode: preferredMode(tool) });
  const prepareToolRun = useCallback((tool: BridgeTool, mode: ExecutionMode, options: ToolRunOptions = {}) => setPending({ tool, mode, options }), []);
  const reviewableToolIds = useMemo(() => new Set(tools.map((tool) => tool.ToolId)), [tools]);
  const launchToolById = useCallback((toolId: string) => {
    const tool = tools.find((candidate) => candidate.ToolId === toolId);
    if (tool) launch(tool);
  }, [tools]);
  const healthReviewTool = tools.find((tool) => tool.AnalyzeOnlySupported || tool.WhatIfSupported) || null;
  const specs: Partial<Record<ActiveSection, { title: Localized; eyebrow: Localized; icon: ElementType; accent: string }>> = {
    maintenance: { title: { en: 'Device Health', ar: 'صحة الجهاز' }, eyebrow: { en: 'HEALTH STUDIO', ar: 'استوديو الصحة' }, icon: HeartPulse, accent: '#58a6ff' },
    cleanup: { title: { en: 'Space Cleaner', ar: 'تنظيف المساحة' }, eyebrow: { en: 'CLEANUP PLAN', ar: 'خطة التنظيف' }, icon: Trash2, accent: '#43c98d' },
    performance: { title: { en: 'Speed Up', ar: 'تسريع الجهاز' }, eyebrow: { en: 'PERFORMANCE COCKPIT', ar: 'مقصورة الأداء' }, icon: Gauge, accent: '#f07868' },
    disk: { title: { en: 'Storage Space', ar: 'مساحة التخزين' }, eyebrow: { en: 'STORAGE EXPLORER', ar: 'مستكشف التخزين' }, icon: HardDrive, accent: '#ad79ff' },
    network: { title: { en: 'Connection Helper', ar: 'مساعد الاتصال' }, eyebrow: { en: 'CONNECTION MAP', ar: 'خريطة الاتصال' }, icon: Network, accent: '#35c9da' },
    security: { title: { en: 'Protection', ar: 'الحماية' }, eyebrow: { en: 'SECURITY CENTER', ar: 'مركز الحماية' }, icon: ShieldCheck, accent: '#46c5a8' },
    diagnostics: { title: { en: 'Device Checkup', ar: 'فحص الجهاز' }, eyebrow: { en: 'DIAGNOSTIC REPORT', ar: 'تقرير الفحص' }, icon: ScanSearch, accent: '#9079f5' },
    backupRecovery: { title: { en: 'Protect & Recover', ar: 'الحماية والاستعادة' }, eyebrow: { en: 'RECOVERY VAULT', ar: 'خزنة الاستعادة' }, icon: ArchiveRestore, accent: '#47c0e7' },
    programs: { title: { en: 'App Center', ar: 'مركز التطبيقات' }, eyebrow: { en: 'APPLICATION LIBRARY', ar: 'مكتبة التطبيقات' }, icon: AppWindow, accent: '#f19a55' },
    softwareEnvironment: { title: { en: 'Software Library', ar: 'مكتبة البرامج' }, eyebrow: { en: 'SOFTWARE SHELF', ar: 'رف البرامج' }, icon: PackageCheck, accent: '#5e8ef4' },
    developerTools: { title: { en: 'Development Environments', ar: 'بيئات التطوير' }, eyebrow: { en: 'WORKSPACE BENCH', ar: 'منضدة العمل' }, icon: FolderKanban, accent: '#a780f6' },
    privacy: { title: { en: 'Privacy', ar: 'الخصوصية' }, eyebrow: { en: 'PRIVACY CONTROL ROOM', ar: 'غرفة تحكم الخصوصية' }, icon: UserRoundCheck, accent: '#eb75a7' },
    drivers: { title: { en: 'Drivers & Devices', ar: 'التعريفات والأجهزة' }, eyebrow: { en: 'DEVICE GARAGE', ar: 'مرآب الأجهزة' }, icon: Wrench, accent: '#e5ab57' },
    monitoring: { title: { en: 'Device Monitor', ar: 'مراقبة الجهاز' }, eyebrow: { en: 'LIVE OPERATIONS', ar: 'العمليات الحية' }, icon: Activity, accent: '#52c89a' },
    services: { title: { en: 'Device Activity', ar: 'نشاط الجهاز' }, eyebrow: { en: 'ACTIVITY ROOM', ar: 'غرفة النشاط' }, icon: Activity, accent: '#ecb15f' },
    postInstall: { title: { en: 'New Device Setup', ar: 'إعداد جهاز جديد' }, eyebrow: { en: 'SETUP CHECKLIST', ar: 'قائمة الإعداد' }, icon: Rocket, accent: '#b06cf5' },
    duplicates: { title: { en: 'Duplicate Organizer', ar: 'منظّم الملفات المكررة' }, eyebrow: { en: 'FILE REVIEW DESK', ar: 'مكتب مراجعة الملفات' }, icon: Copy, accent: '#e76fa5' },
    projectSonar: { title: { en: 'Project Center', ar: 'مركز المشاريع' }, eyebrow: { en: 'PROJECT COMMAND BOARD', ar: 'لوحة قيادة المشاريع' }, icon: Radar, accent: '#42d4e8' },
  };
  const spec = specs[activeSection] || { title: { en: 'KNOUX', ar: 'KNOUX' }, eyebrow: { en: 'SERVICE', ar: 'خدمة' }, icon: Sparkles, accent: '#48c8dd' };
  const content = useMemo(() => {
    if (!available || !data) return null;
    switch (activeSection) {
      case 'maintenance': return <HealthApp data={data as SystemSnapshot} lang={lang} onRunHealthCheck={healthReviewTool ? () => launch(healthReviewTool) : undefined} />;
      case 'cleanup': return <CleanerApp data={data as CleanupPreview} lang={lang} reviewableToolIds={reviewableToolIds} onReviewTarget={launchToolById} />;
      case 'performance': return <PerformanceApp data={data as OptimizationPreview} lang={lang} reviewableToolIds={reviewableToolIds} onReviewSignal={launchToolById} />;
      case 'disk': return <StorageApp data={data as SystemSnapshot} lang={lang} />;
      case 'network': return <NetworkApp data={data as NetworkPreview} lang={lang} />;
      case 'security': return <SecurityApp data={data as SystemSnapshot} lang={lang} />;
      case 'diagnostics': return <DiagnosticsApp data={data as DiagnosticsPreview} lang={lang} />;
      case 'backupRecovery': return <RecoveryApp data={data as BackupRecoveryPreview} lang={lang} />;
      case 'programs': return <LibraryApp data={data as SoftwarePreview} lang={lang} variant="apps" />;
      case 'softwareEnvironment': return <LibraryApp data={data as SoftwarePreview} lang={lang} variant="software" />;
      case 'developerTools': return <LibraryApp data={data as SoftwarePreview} lang={lang} variant="developer" />;
      case 'privacy': return <PrivacyApp data={data as PrivacyPreview} lang={lang} />;
      case 'drivers': return <DriverApp data={data as DriversPreview} lang={lang} />;
      case 'postInstall': return <SetupApp data={data as PostInstallPreview} lang={lang} />;
      case 'monitoring': case 'services': return <OperationsApp data={data as OperationsPreview} lang={lang} />;
      default: return <GenericApp section={activeSection} lang={lang} />;
    }
  }, [activeSection, available, data, lang, healthReviewTool, launchToolById, reviewableToolIds]);
  const specialContent = activeSection === 'duplicates'
    ? <DuplicateOrganizerApp lang={lang} tools={tools} onPrepareRun={prepareToolRun} />
    : activeSection === 'projectSonar'
      ? <ProjectSonarApp lang={lang} tools={tools} onPrepareRun={prepareToolRun} />
      : null;
  const appContent = specialContent || content || <OfflineScene section={activeSection} lang={lang} icon={spec.icon} />;
  return <>
    <LiveShell lang={lang} title={spec.title[lang]} eyebrow={spec.eyebrow[lang]} icon={spec.icon} accent={spec.accent} loading={loading} available={available || Boolean(specialContent)} onRefresh={reload}>
      {appContent || <GenericApp section={activeSection} lang={lang} />}
      <div className="service-app-bottom"><ActionRail tools={tools} lang={lang} toolStatuses={toolStatuses} bridgeElevated={bridgeElevated} onLaunch={launch} onCancel={onCancelTool} /><SafetyNote lang={lang} /></div>
    </LiveShell>
    {pending && <ExecutionConfirmDialog tool={pending.tool} mode={pending.mode} lang={lang} initialOptions={pending.options} onCancel={() => setPending(null)} onConfirm={(options) => { onRunTool(pending.tool, pending.mode, options); setPending(null); }} />}
  </>;
}
