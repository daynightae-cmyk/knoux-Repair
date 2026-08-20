import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AppWindow, Archive, Boxes, ChevronDown, CircleAlert, Code2, Container, Copy, Cpu, Eye, FileSearch,
  Gauge, GitBranch, HardDrive, Info, LockKeyhole, Network, Play, Radar, Rocket, RotateCcw, Search, Shield,
  ShieldCheck, Square, Terminal, Trash2, Wrench,
} from 'lucide-react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { ActiveSection, ConsoleEntry, ToolStatus } from '../types';

import type { BridgeTool, ExecutionMode, OfflineCapability, ToolRunOptions } from '../lib/api';
import ExecutionConfirmDialog from './ExecutionConfirmDialog';
import DuplicateExplorerPanel from './DuplicateExplorerPanel';
import DiskPulsePanel from './DiskPulsePanel';
import SoftwareInventoryPanel from './SoftwareInventoryPanel';
import NetworkPulsePanel from './NetworkPulsePanel';
import SystemPulsePanel from './SystemPulsePanel';
import OperationsPulsePanel from './OperationsPulsePanel';
import PerformancePulsePanel from './PerformancePulsePanel';
import DiagnosticsReportPanel from './DiagnosticsReportPanel';
import BackupRecoveryPanel from './BackupRecoveryPanel';
import DriverManagementPanel from './DriverManagementPanel';
import PrivacyPanel from './PrivacyPanel';
import PostInstallPanel from './PostInstallPanel';
import ToolActivityRail from './ToolActivityRail';

import ProjectSonarPanel from './ProjectSonarPanel';
import type { Lang } from '../lib/i18n';
import { pickName } from '../lib/i18n';
import { getCategoryBySection, type CategoryIconKey } from '../data/categories';

interface ToolGridProps {
  activeSection: ActiveSection;
  toolStatuses: Record<string, ToolStatus>;
  tools: BridgeTool[];
  lang: Lang;
    bridgeElevated: boolean;
  activeTool: BridgeTool | null;
  activityEntries: ConsoleEntry[];
  activityStatus: ToolStatus;
  onRunTool: (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions) => void;

  onCancelTool: () => void;
}

type AccentStyle = CSSProperties & Record<'--accent', string>;
type RiskFilter = 'all' | BridgeTool['RiskLevel'];
type CapabilityFilter = 'all' | 'analyze' | 'preview';
type AdminFilter = 'all' | 'admin' | 'standard';
type OfflineFilter = 'all' | 'FULL' | 'PARTIAL' | 'NO';

const ICONS: Record<CategoryIconKey, ElementType> = {
  maintenance: Wrench,
  cleanup: Trash2,
  network: Network,
  programs: AppWindow,
  duplicates: Copy,
  disk: HardDrive,
  services: Cpu,
  performance: Gauge,
  security: Shield,
  diagnostics: Activity,
  backup: HardDrive,
  developer: AppWindow,
  privacy: Shield,
  drivers: Cpu,
  monitoring: Activity,
  software: Boxes,
  setup: Rocket,
  sonar: Radar,
};

const RISK_LABEL: Record<string, Record<Lang, string>> = {
  READ_ONLY: { en: 'READ ONLY', ar: 'قراءة فقط' },
  SAFE_CLEANUP: { en: 'SAFE CLEANUP', ar: 'تنظيف آمن' },
  SYSTEM_REPAIR: { en: 'SYSTEM REPAIR', ar: 'إصلاح النظام' },
  REBOOT_REQUIRED: { en: 'REBOOT REQUIRED', ar: 'يتطلب إعادة تشغيل' },
  DESTRUCTIVE: { en: 'DESTRUCTIVE', ar: 'تعديل دائم' },
};

const OFFLINE_LABEL: Record<OfflineCapability, Record<Lang, string>> = {
  FULL: { en: 'OFFLINE READY', ar: 'يعمل دون اتصال' },
  PARTIAL: { en: 'PARTIAL OFFLINE', ar: 'دعم جزئي دون اتصال' },
  NO: { en: 'ONLINE REQUIRED', ar: 'يتطلب اتصالًا' },
  '': { en: 'CAPABILITY UNKNOWN', ar: 'القدرة غير محددة' },
};

const COPY = {
  en: {
    currentCategory: 'CURRENT WORKSTATION',
    tools: 'TOOLS',
    realData: 'Manifest-backed capability resolution',
    search: 'Search this category',
    risk: 'Risk',
    capability: 'Capability',
    admin: 'Access',
    offline: 'Network',
    all: 'All',
    allCapabilities: 'All capabilities',
    analyze: 'Analyze',
    preview: 'Preview',
    adminOnly: 'Admin required',
    standard: 'Standard access',
    anyNetwork: 'Any network state',
    noResults: 'No real tools match the current filters.',
    clearFilters: 'Clear filters',
    recovery: 'Recovery & evidence',
    backup: 'Backup',
    rollback: 'Rollback',
    restart: 'Restart required',
    adminRequired: 'Administrator required for this action',
    analyzeAction: 'ANALYZE',
    previewAction: 'PREVIEW',
    cancel: 'CANCEL',
    resultIdle: 'Ready',
    resultRunning: 'Running',
    resultSuccess: 'Completed',
    resultError: 'Needs review',
    resultCancelled: 'Cancelled',
  },
  ar: {
    currentCategory: 'محطة العمل الحالية',
    tools: 'أدوات',
    realData: 'حلّ القدرات مستند إلى ملف الأدوات',
    search: 'ابحث في هذه الفئة',
    risk: 'المخاطر',
    capability: 'القدرة',
    admin: 'الصلاحية',
    offline: 'الاتصال',
    all: 'الكل',
    allCapabilities: 'كل القدرات',
    analyze: 'تحليل',
    preview: 'معاينة',
    adminOnly: 'يتطلب مديرًا',
    standard: 'صلاحية عادية',
    anyNetwork: 'أي حالة اتصال',
    noResults: 'لا توجد أدوات فعلية تطابق المرشحات الحالية.',
    clearFilters: 'مسح المرشحات',
    recovery: 'الاسترداد والأدلة',
    backup: 'النسخ الاحتياطي',
    rollback: 'التراجع',
    restart: 'إعادة تشغيل مطلوبة',
    adminRequired: 'تتطلب هذه العملية صلاحيات المدير',
    analyzeAction: 'تحليل',
    previewAction: 'معاينة',
    cancel: 'إيقاف',
    resultIdle: 'جاهز',
    resultRunning: 'يعمل',
    resultSuccess: 'اكتمل',
    resultError: 'يتطلب مراجعة',
    resultCancelled: 'أُلغي',
  },
};

function SelectField<T extends string>({
  label, value, onChange, children,
}: { label: string; value: T; onChange: (value: T) => void; children: ReactNode }) {
  return (
    <label className="nx-filter">
      <span>{label}</span>
      <span className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {children}
        </select>
        <ChevronDown size={13} aria-hidden="true" />
      </span>
    </label>
  );
}

function primaryVerb(tool: BridgeTool, lang: Lang): string {
  if (lang === 'ar') {
    if (/Report|Information|Summary|Snapshot/i.test(tool.EnglishName)) return 'إنشاء تقرير';
    if (/List|Show|Check|Find|Analyze|Audit|Test|Verify/i.test(tool.EnglishName)) return 'فحص';
    if (/Clean/i.test(tool.EnglishName)) return 'تنظيف';
    if (/Repair/i.test(tool.EnglishName)) return 'إصلاح';
    if (/Reset/i.test(tool.EnglishName)) return 'إعادة تعيين';
    if (/Restart/i.test(tool.EnglishName)) return 'إعادة تشغيل';
    if (/Remove/i.test(tool.EnglishName)) return 'إزالة';
    if (/Move/i.test(tool.EnglishName)) return 'نقل';
    if (/Restore/i.test(tool.EnglishName)) return 'استعادة';
    if (/Disable/i.test(tool.EnglishName)) return 'تعطيل';
    if (/Enable/i.test(tool.EnglishName)) return 'تفعيل';
    if (/Run/i.test(tool.EnglishName)) return 'تشغيل الفحص';
    if (/Schedule/i.test(tool.EnglishName)) return 'جدولة';
    return 'تنفيذ الأداة';
  }

  if (/Report|Information|Summary|Snapshot/i.test(tool.EnglishName)) return 'GENERATE REPORT';
  const match = tool.EnglishName.match(/^(Verify|Analyze|Check|Scan|Test|List|Show|Find|Clean|Repair|Reset|Restart|Remove|Move|Restore|Disable|Enable|Schedule|Manage|Run)/i);
  return match ? match[1].toUpperCase() : 'EXECUTE TOOL';
}

function Status({ status, lang }: { status: ToolStatus; lang: Lang }) {
  const text = COPY[lang];
  const statusMap: Record<ToolStatus, { label: string; className: string }> = {
    idle: { label: text.resultIdle, className: 'is-idle' },
    running: { label: text.resultRunning, className: 'is-running' },
    success: { label: text.resultSuccess, className: 'is-success' },
    error: { label: text.resultError, className: 'is-error' },
    cancelled: { label: text.resultCancelled, className: 'is-cancelled' },
  };
  const item = statusMap[status];
  return <span className={`tool-status ${item.className}`}>{item.label}</span>;
}



function StationBrief({ station, tools, lang }: { station: 'software' | 'setup'; tools: BridgeTool[]; lang: Lang }) {
  const readOnly = tools.filter((tool) => tool.RiskLevel === 'READ_ONLY').length;
  const changes = tools.filter((tool) => tool.RiskLevel !== 'READ_ONLY').length;
  const admin = tools.filter((tool) => tool.RequiresAdmin).length;
  const software = lang === 'ar'
    ? { title: 'مركز إدارة البرامج والبيئات', body: 'ابدأ بجرد البرامج وبيئات التطوير وإضافات Chrome. إجراءات الكاش والتحديث والإزالة لا تمر إلا عبر نافذة التأكيد ومعرّف حزمة دقيق.', facts: ['جرد البرامج والبيئات', 'إضافات Chrome محليًا', 'تحديث وإزالة بتأكيد'] }
    : { title: 'Software & environment control center', body: 'Start with software, developer environment and Chrome extension inventories. Cache, update and uninstall actions pass only through confirmation with an exact package identifier.', facts: ['Software & runtime inventory', 'Local Chrome extensions', 'Confirmed update and uninstall'] };
  const setup = lang === 'ar'
    ? { title: 'مركز تجهيز ويندوز بعد التثبيت', body: 'ابحث عن عروض تعريفات Windows Update أولًا، ثم راجع كتالوج التطبيقات بأرقام اختيار واضحة قبل تثبيت أي عنصر.', facts: ['تعريفات Windows Update', 'كتالوج تطبيقات شفاف', 'اختيار قبل التثبيت'] }
    : { title: 'Post-install setup center', body: 'Discover Windows Update driver offers first, then review a transparent numbered essentials catalog before installing any selection.', facts: ['Windows Update drivers', 'Transparent essentials catalog', 'Selection before install'] };
  const content = station === 'software' ? software : setup;
  const Icon = station === 'software' ? Boxes : Rocket;

  return (
    <aside className={`station-brief station-brief-${station}`} aria-label={content.title}>
      <div className="station-brief-icon"><Icon size={20} /></div>
      <div className="station-brief-copy"><p className="eyebrow">{content.title}</p><p>{content.body}</p></div>
      <div className="station-brief-facts">
        {content.facts.map((fact) => <span key={fact}>{fact}</span>)}
        <span><b>{readOnly}</b> {lang === 'ar' ? 'قرائية' : 'read-only'}</span>
        <span><b>{changes}</b> {lang === 'ar' ? 'تتطلب تأكيدًا' : 'need confirmation'}</span>
        {admin > 0 && <span><b>{admin}</b> {lang === 'ar' ? 'مدير' : 'admin'}</span>}
      </div>
    </aside>
  );
}

function DeveloperCommandCenter({ tools, lang }: { tools: BridgeTool[]; lang: Lang }) {
  const present = (ids: string[]) => tools.filter((tool) => ids.includes(tool.ToolId));
  const toolchain = present(['DT01', 'DT04']);
  const workspace = present(['DT05', 'DT08', 'DT13']);
  const runtime = present(['DT06', 'DT10', 'DT11']);
  const editor = present(['DT07', 'DT12']);
  const recovery = present(['DT02', 'DT03', 'DT09']);
  const projectAware = tools.filter((tool) => tool.Parameters.includes('LocalSourcePath')).length;
  const changes = tools.filter((tool) => tool.RiskLevel !== 'READ_ONLY').length;
  const copy = lang === 'ar'
    ? {
        title: 'مركز قيادة المطوّر',
        body: 'ابدأ بفحص البيئة، ثم افهم المشروع الفعلي، ثم راقب المنافذ والخدمات. لا ينفّذ النظام أي تنظيف أو إيقاف إلا بعد تأكيدك واختيارك المحدد.',
        scope: 'خدمات مرتبطة بمسار مشروع',
        changes: 'إجراءات محكومة بالتأكيد',
        rail: [
          { title: 'صحة الأدوات', body: 'نسخ الأدوات ومساراتها وتعارضات PATH', icon: Terminal, tools: toolchain },
          { title: 'ذكاء المشروع', body: 'المؤشرات والاعتمادات وGit وملفات القفل', icon: GitBranch, tools: workspace },
          { title: 'نبض وقت التشغيل', body: 'المنافذ وخوادم التطوير وحالة Docker', icon: Activity, tools: runtime },
          { title: 'بيئة التحرير والثقة', body: 'إضافات IDE وشهادات وخرائط التطوير المحلي', icon: Code2, tools: editor },
          { title: 'تنظيف قابل للتراجع', body: 'الكاش والتشخيص ومخلفات البناء المعزولة', icon: Archive, tools: recovery },
        ],
      }
    : {
        title: 'Developer command center',
        body: 'Check the workstation first, understand the real project next, then observe ports and services. Cleanup or server release runs only after explicit selection and confirmation.',
        scope: 'workspace-aware services',
        changes: 'confirmation-governed actions',
        rail: [
          { title: 'Toolchain health', body: 'Tool versions, command paths and PATH collisions', icon: Terminal, tools: toolchain },
          { title: 'Project intelligence', body: 'Markers, dependencies, Git and lockfiles', icon: GitBranch, tools: workspace },
          { title: 'Runtime pulse', body: 'Ports, development servers and Docker status', icon: Activity, tools: runtime },
          { title: 'Editor & trust', body: 'IDE extensions, local certificates and host mappings', icon: Code2, tools: editor },
          { title: 'Recoverable cleanup', body: 'Caches, diagnostics and quarantined build artifacts', icon: Archive, tools: recovery },
        ],
      };

  return (
    <aside className="developer-command-center" aria-label={copy.title}>
      <div className="developer-command-head">
        <div className="developer-command-orb"><Container size={22} /></div>
        <div><p className="eyebrow">{copy.title}</p><p>{copy.body}</p></div>
        <div className="developer-command-metrics">
          <span><b>{projectAware}</b> {copy.scope}</span>
          <span><b>{changes}</b> {copy.changes}</span>
        </div>
      </div>
      <div className="developer-command-rail">
        {copy.rail.map((item) => {
          const RailIcon = item.icon;
          return (
            <div className="developer-command-node" key={item.title}>
              <span className="developer-command-node-icon"><RailIcon size={16} /></span>
              <div><strong>{item.title}</strong><p>{item.body}</p></div>
              <span className="developer-command-node-count">{item.tools.length}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ToolCard({
  tool, lang, status, bridgeElevated, accent, onRequestExecution, onCancelTool,
}: {
  tool: BridgeTool;
  lang: Lang;
  status: ToolStatus;
  bridgeElevated: boolean;
  accent: string;
  onRequestExecution: (tool: BridgeTool, mode: ExecutionMode) => void;
  onCancelTool: () => void;
}) {
  const text = COPY[lang];
  const isRunning = status === 'running';
  const isReadOnly = tool.RiskLevel === 'READ_ONLY';
  const requiresAdminForRun = tool.RequiresAdmin && !bridgeElevated;
  const style: AccentStyle = { '--accent': accent };
  const hasRecovery = [tool.BackupMethod, tool.RollbackMethod]
    .some((method) => Boolean(method && !/^none(?:\b|\s)/i.test(method.trim())));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={`tool-card ${isRunning ? 'is-running' : ''}`}
      style={style}
    >
      <div className="tool-card-topline" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="tool-name">{pickName(tool, lang)}</h3>
          <p className="tool-purpose">{tool.Purpose}</p>
        </div>
        <Status status={status} lang={lang} />
      </div>

      <div className="tool-chip-row">
        <span className={`tool-chip risk-${tool.RiskLevel.toLowerCase()}`}>{RISK_LABEL[tool.RiskLevel]?.[lang] || tool.RiskLevel}</span>
        {tool.RequiresAdmin && <span className="tool-chip"><LockKeyhole size={11} /> {lang === 'ar' ? 'مدير' : 'ADMIN'}</span>}
        {tool.RequiresRestart && <span className="tool-chip"><RotateCcw size={11} /> {text.restart}</span>}
        {tool.OfflineCapability && <span className="tool-chip"><Network size={11} /> {OFFLINE_LABEL[tool.OfflineCapability]?.[lang]}</span>}
      </div>

      <div className="tool-actions" aria-label={lang === 'ar' ? 'إجراءات الأداة' : 'Tool actions'}>
        {isRunning ? (
          <button type="button" className="tool-action tool-action-cancel" onClick={onCancelTool}>
            <Square size={13} /> {text.cancel}
          </button>
        ) : (
          <>
            {tool.AnalyzeOnlySupported && !isReadOnly && (
              <button type="button" className="tool-action tool-action-secondary" onClick={() => onRequestExecution(tool, 'analyze')}>
                <FileSearch size={14} /> {text.analyzeAction}
              </button>
            )}
            {tool.WhatIfSupported && !isReadOnly && (
              <button type="button" className="tool-action tool-action-secondary" onClick={() => onRequestExecution(tool, 'preview')}>
                <Eye size={14} /> {text.previewAction}
              </button>
            )}
            <button
              type="button"
              className="tool-action tool-action-primary"
              disabled={requiresAdminForRun}
              title={requiresAdminForRun ? text.adminRequired : undefined}
              onClick={() => onRequestExecution(tool, 'run')}
            >
              {isReadOnly ? <ShieldCheck size={14} /> : <Play size={14} />}
              {primaryVerb(tool, lang)}
            </button>
          </>
        )}
      </div>

      {requiresAdminForRun && !isRunning && <p className="tool-access-note"><LockKeyhole size={11} /> {text.adminRequired}</p>}

      {hasRecovery && (
        <details className="tool-evidence">
          <summary><Info size={13} /> {text.recovery}</summary>
          <dl>
            <div><dt>{text.backup}</dt><dd>{tool.BackupMethod || '—'}</dd></div>
            <div><dt>{text.rollback}</dt><dd>{tool.RollbackMethod || '—'}</dd></div>
          </dl>
        </details>
      )}

      <span className="tool-id" aria-label={`Tool ID ${tool.ToolId}`}>{tool.ToolId}</span>
    </motion.article>
  );
}

export default function ToolGrid({
    activeSection, toolStatuses, tools, lang, bridgeElevated, activeTool, activityEntries, activityStatus, onRunTool, onCancelTool,

}: ToolGridProps) {
  const [query, setQuery] = useState('');
  const [pendingExecution, setPendingExecution] = useState<{ tool: BridgeTool; mode: ExecutionMode; options?: ToolRunOptions } | null>(null);
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [capability, setCapability] = useState<CapabilityFilter>('all');
  const [admin, setAdmin] = useState<AdminFilter>('all');
  const [offline, setOffline] = useState<OfflineFilter>('all');
  const category = getCategoryBySection(activeSection);
  const Icon = ICONS[category.icon];
  const text = COPY[lang];
  const style: AccentStyle = { '--accent': category.accent };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return tools.filter((tool) => {
      const matchesQuery = !normalized || [tool.ToolId, tool.EnglishName, tool.ArabicName, tool.Purpose]
        .some((value) => (value || '').toLocaleLowerCase().includes(normalized));
      const matchesRisk = risk === 'all' || tool.RiskLevel === risk;
      const matchesCapability = capability === 'all'
        || (capability === 'analyze' && tool.AnalyzeOnlySupported)
        || (capability === 'preview' && tool.WhatIfSupported);
      const matchesAdmin = admin === 'all' || (admin === 'admin' ? tool.RequiresAdmin : !tool.RequiresAdmin);
      const matchesOffline = offline === 'all' || tool.OfflineCapability === offline;
      return matchesQuery && matchesRisk && matchesCapability && matchesAdmin && matchesOffline;
    });
  }, [tools, query, risk, capability, admin, offline]);

  const stats = useMemo(() => ({
    admin: tools.filter((tool) => tool.RequiresAdmin).length,
    offline: tools.filter((tool) => tool.OfflineCapability === 'FULL').length,
    preview: tools.filter((tool) => tool.WhatIfSupported).length,
    destructive: tools.filter((tool) => tool.RiskLevel === 'DESTRUCTIVE').length,
  }), [tools]);

  const clearFilters = () => {
    setQuery('');
    setRisk('all');
    setCapability('all');
    setAdmin('all');
    setOffline('all');
  };

  return (
    <section className="workstation" style={style} aria-labelledby="category-title">
      <header className="category-hero">
        <div className="category-hero-icon"><Icon size={30} strokeWidth={1.8} /></div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{text.currentCategory}</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="category-title">{category.name[lang]}</h2>
            <span className="category-total">{tools.length} {text.tools}</span>
          </div>
          <p className="category-purpose">{category.purpose[lang]}</p>
        </div>
        <div className="category-live-summary" aria-label={text.realData}>
          <span><LockKeyhole size={13} /> {stats.admin}</span>
          <span><Network size={13} /> {stats.offline}</span>
          <span><Eye size={13} /> {stats.preview}</span>
          <span title={lang === 'ar' ? 'إجراءات مدمّرة تؤكد قبل التشغيل' : 'Destructive actions requiring confirmation'}><CircleAlert size={13} /> {stats.destructive}</span>
        </div>
            </header>

      <ToolActivityRail lang={lang} tool={activeTool} status={activityStatus} entries={activityEntries} />

            {category.id === '05-Duplicate-Files' && <DuplicateExplorerPanel lang={lang} tools={tools} onRequestExecution={(tool, options) => setPendingExecution({ tool, mode: 'run', options })} />}

            {category.id === '01-System-Maintenance' && <SystemPulsePanel lang={lang} mode="maintenance" />}
      {category.id === '09-Security' && <SystemPulsePanel lang={lang} mode="security" />}
      {category.id === '15-System-Monitoring' && <SystemPulsePanel lang={lang} mode="monitoring" />}
      {category.id === '03-Network-Internet' && <NetworkPulsePanel lang={lang} />}
      {category.id === '06-Disk-Space' && <DiskPulsePanel lang={lang} />}
      {category.id === '07-Services-Processes' && <OperationsPulsePanel lang={lang} tools={tools} onRequestExecution={(tool) => setPendingExecution({ tool, mode: 'run' })} />}
      {category.id === '08-Performance' && <PerformancePulsePanel lang={lang} tools={tools} onRequestExecution={(tool) => setPendingExecution({ tool, mode: 'run' })} />}
      {category.id === '10-Diagnostics-Reports' && <DiagnosticsReportPanel lang={lang} tools={tools} onRequestExecution={(tool) => setPendingExecution({ tool, mode: 'run' })} />}
      {category.id === '11-Backup-Recovery' && <BackupRecoveryPanel lang={lang} tools={tools} onRequestExecution={(tool, mode = 'run', options) => setPendingExecution({ tool, mode, options })} />}
      {category.id === '13-Privacy' && <PrivacyPanel lang={lang} tools={tools} onRequestExecution={(tool) => setPendingExecution({ tool, mode: 'run' })} />}
      {category.id === '14-Driver-Management' && <DriverManagementPanel lang={lang} tools={tools} onRequestExecution={(tool) => setPendingExecution({ tool, mode: 'run' })} />}
            {category.id === '16-Software-Environment' && <SoftwareInventoryPanel lang={lang} />}
      {category.id === '16-Software-Environment' && <StationBrief station="software" tools={tools} lang={lang} />}

      {category.id === '17-PostInstall-Setup' && <PostInstallPanel lang={lang} tools={tools} onRequestExecution={(tool, mode = 'run', options) => setPendingExecution({ tool, mode, options })} />}

      {category.id === '12-Developer-Tools' && <DeveloperCommandCenter tools={tools} lang={lang} />}
      {category.id === '18-Project-Sonar' && <ProjectSonarPanel lang={lang} tools={tools} onRequestExecution={(tool, options) => setPendingExecution({ tool, mode: 'run', options })} />}

      <div className="category-toolbar">
        <label className="category-search">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
        </label>
        <div className="category-filters">
          <SelectField label={text.risk} value={risk} onChange={setRisk}>
            <option value="all">{text.all}</option>
            {Object.keys(RISK_LABEL).map((value) => <option key={value} value={value}>{RISK_LABEL[value][lang]}</option>)}
          </SelectField>
          <SelectField label={text.capability} value={capability} onChange={setCapability}>
            <option value="all">{text.allCapabilities}</option>
            <option value="analyze">{text.analyze}</option>
            <option value="preview">{text.preview}</option>
          </SelectField>
          <SelectField label={text.admin} value={admin} onChange={setAdmin}>
            <option value="all">{text.all}</option>
            <option value="admin">{text.adminOnly}</option>
            <option value="standard">{text.standard}</option>
          </SelectField>
          <SelectField label={text.offline} value={offline} onChange={setOffline}>
            <option value="all">{text.anyNetwork}</option>
            <option value="FULL">{OFFLINE_LABEL.FULL[lang]}</option>
            <option value="PARTIAL">{OFFLINE_LABEL.PARTIAL[lang]}</option>
            <option value="NO">{OFFLINE_LABEL.NO[lang]}</option>
          </SelectField>
        </div>
        <p className="toolbar-count">{filtered.length} / {tools.length}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="no-tool-results">
          <CircleAlert size={22} />
          <p>{text.noResults}</p>
          <button type="button" onClick={clearFilters}>{text.clearFilters}</button>
        </div>
      ) : (
        <div className="tool-grid">
          <AnimatePresence mode="popLayout">
            {filtered.map((tool) => (
              <ToolCard
                key={tool.ToolId}
                tool={tool}
                lang={lang}
                status={toolStatuses[tool.ToolId] || 'idle'}
                bridgeElevated={bridgeElevated}
                accent={category.accent}
                onRequestExecution={(tool, mode) => setPendingExecution({ tool, mode })}
                onCancelTool={onCancelTool}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {pendingExecution && (
        <ExecutionConfirmDialog
          tool={pendingExecution.tool}
          mode={pendingExecution.mode}
          lang={lang}
          onCancel={() => setPendingExecution(null)}
          initialOptions={pendingExecution.options}
          onConfirm={(options) => {
            onRunTool(pendingExecution.tool, pendingExecution.mode, { ...pendingExecution.options, ...options });
            setPendingExecution(null);
          }}
        />
      )}
    </section>
  );
}
