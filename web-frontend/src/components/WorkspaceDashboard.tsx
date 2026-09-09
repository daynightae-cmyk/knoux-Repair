import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  ChevronDown,
  CircleDot,
  FolderKanban,
  LayoutGrid,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Plus,
  Search,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ActiveSection } from '../types';
import type { BridgeTool } from '../lib/api';
import type { Lang } from '../lib/i18n';

type WorkspaceState = 'active' | 'pinned' | 'archived';
type SortKey = 'name' | 'tools' | 'activity';

interface Workspace {
  id: string;
  name: Record<Lang, string>;
  code: string;
  section: ActiveSection;
  category: string;
  state: WorkspaceState;
  accent: string;
  icon: string;
  lastActivity: Record<Lang, string> | null;
  status: Record<Lang, string>;
  owner: Record<Lang, string>;
}

interface WorkspaceDashboardProps {
  lang: Lang;
  toolsByCategory: Record<string, BridgeTool[]>;
  onOpenSection: (section: ActiveSection) => void;
  onOpenNavigation: () => void;
}

const SEED_WORKSPACES: Workspace[] = [
  { id: 'sonar', name: { en: 'Project Sonar', ar: 'مشروع سونار' }, code: 'SONAR-01', section: 'projectSonar', category: '18-Project-Sonar', state: 'active', accent: '#25c8dd', icon: '◉', lastActivity: null, status: { en: 'Live inventory', ar: 'جرد حي' }, owner: { en: 'Project intelligence', ar: 'ذكاء المشروع' } },
  { id: 'system', name: { en: 'System Care', ar: 'عناية النظام' }, code: 'SYS-CORE', section: 'maintenance', category: '01-System-Maintenance', state: 'active', accent: '#5d8dff', icon: '✦', lastActivity: null, status: { en: 'Ready for diagnosis', ar: 'جاهز للتشخيص' }, owner: { en: 'System health', ar: 'صحة النظام' } },
  { id: 'network', name: { en: 'Network Pulse', ar: 'نبض الشبكة' }, code: 'NET-24', section: 'network', category: '03-Network-Internet', state: 'active', accent: '#32c4d7', icon: '⌁', lastActivity: null, status: { en: 'Connection preview', ar: 'معاينة الاتصال' }, owner: { en: 'Connectivity', ar: 'الاتصال' } },
  { id: 'security', name: { en: 'Security Sentinel', ar: 'حارس الأمان' }, code: 'SEC-09', section: 'security', category: '09-Security', state: 'active', accent: '#31c88b', icon: '◆', lastActivity: null, status: { en: 'Protection preview', ar: 'معاينة الحماية' }, owner: { en: 'Protection posture', ar: 'حالة الحماية' } },
  { id: 'diagnostics', name: { en: 'Diagnostics Hub', ar: 'مركز التشخيص' }, code: 'DIA-10', section: 'diagnostics', category: '10-Diagnostics-Reports', state: 'active', accent: '#8d7aff', icon: '⌘', lastActivity: null, status: { en: 'Evidence preview', ar: 'معاينة الأدلة' }, owner: { en: 'System evidence', ar: 'أدلة النظام' } },
  { id: 'performance', name: { en: 'Performance Lab', ar: 'مختبر الأداء' }, code: 'PERF-08', section: 'performance', category: '08-Performance', state: 'active', accent: '#f0954f', icon: '↗', lastActivity: null, status: { en: 'Performance preview', ar: 'معاينة الأداء' }, owner: { en: 'Performance', ar: 'الأداء' } },
  { id: 'recovery', name: { en: 'Recovery Vault', ar: 'خزنة الاستعادة' }, code: 'REC-11', section: 'backupRecovery', category: '11-Backup-Recovery', state: 'active', accent: '#4cc6b2', icon: '◌', lastActivity: null, status: { en: 'Recovery preview', ar: 'معاينة الاستعادة' }, owner: { en: 'Recovery points', ar: 'نقاط الاستعادة' } },
  { id: 'developer', name: { en: 'Developer Station', ar: 'محطة المطوّر' }, code: 'DEV-12', section: 'developerTools', category: '12-Developer-Tools', state: 'active', accent: '#d36adb', icon: '⌘', lastActivity: null, status: { en: 'Toolchain preview', ar: 'معاينة الأدوات' }, owner: { en: 'Local environments', ar: 'البيئات المحلية' } },
  { id: 'disk', name: { en: 'Disk Pulse', ar: 'نبض القرص' }, code: 'DISK-06', section: 'disk', category: '06-Disk-Space', state: 'pinned', accent: '#a66cff', icon: '◒', lastActivity: null, status: { en: 'Storage preview', ar: 'معاينة التخزين' }, owner: { en: 'Storage capacity', ar: 'سعة التخزين' } },
  { id: 'privacy', name: { en: 'Privacy Guard', ar: 'حارس الخصوصية' }, code: 'PRIV-13', section: 'privacy', category: '13-Privacy', state: 'pinned', accent: '#e46e9d', icon: '◐', lastActivity: null, status: { en: 'Privacy preview', ar: 'معاينة الخصوصية' }, owner: { en: 'Privacy controls', ar: 'ضوابط الخصوصية' } },
  { id: 'software', name: { en: 'Software Inventory', ar: 'جرد البرامج' }, code: 'SOFT-16', section: 'softwareEnvironment', category: '16-Software-Environment', state: 'archived', accent: '#7d91a8', icon: '□', lastActivity: null, status: { en: 'Software preview', ar: 'معاينة البرامج' }, owner: { en: 'Software estate', ar: 'بيئة البرامج' } },
];

const COPY = {
  en: {
    title: 'Workspaces',
    subtitle: 'Operational spaces mapped to live repair workstations.',
    add: 'Add Workspace',
    search: 'Search workspaces',
    active: 'Active',
    pinned: 'Pinned',
    archived: 'Archived',
    workspace: 'WORKSPACE',
    tools: 'AVAILABLE TOOLS',
    code: 'WORKSPACE CODE',
    activity: 'LAST ACTIVITY',
    status: 'STATUS',
    actions: 'OPTIONS',
    open: 'Open workstation',
    sort: 'Sort',
    live: 'Live bridge',
    ready: 'ready',
    workspaceCreated: 'New Workspace',
    noResults: 'No workspaces match your search.',
  },
  ar: {
    title: 'مساحات العمل',
    subtitle: 'مساحات تشغيل مرتبطة بمحطات الإصلاح الفعلية.',
    add: 'إضافة مساحة عمل',
    search: 'ابحث في مساحات العمل',
    active: 'النشطة',
    pinned: 'المثبّتة',
    archived: 'المؤرشفة',
    workspace: 'مساحة العمل',
    tools: 'الأدوات المتاحة',
    code: 'رمز المساحة',
    activity: 'آخر نشاط',
    status: 'الحالة',
    actions: 'خيارات',
    open: 'فتح المحطة',
    sort: 'ترتيب',
    live: 'الجسر المحلي',
    ready: 'جاهز',
    workspaceCreated: 'مساحة عمل جديدة',
    noResults: 'لا توجد مساحات عمل مطابقة لبحثك.',
  },
};

function operationCount(workspace: Workspace, toolsByCategory: Record<string, BridgeTool[]>): number {
  return toolsByCategory[workspace.category]?.length ?? 0;
}

function WorkspaceMark({ workspace }: { workspace: Workspace }) {
  return (
    <span className="workspace-mark" style={{ '--workspace-accent': workspace.accent } as React.CSSProperties} aria-hidden="true">
      {workspace.icon}
    </span>
  );
}

export default function WorkspaceDashboard({ lang, toolsByCategory, onOpenSection, onOpenNavigation }: WorkspaceDashboardProps) {
  const copy = COPY[lang];
  const [workspaces, setWorkspaces] = useState<Workspace[]>(SEED_WORKSPACES);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [expanded, setExpanded] = useState<Record<WorkspaceState, boolean>>({ active: true, pinned: false, archived: false });
  const [selectedId, setSelectedId] = useState('sonar');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = (workspace: Workspace) => !normalized || [workspace.name.en, workspace.name.ar, workspace.code, workspace.owner.en, workspace.owner.ar]
      .some((value) => value.toLocaleLowerCase().includes(normalized));
    const compare = (a: Workspace, b: Workspace) => {
      if (sort === 'tools') return operationCount(b, toolsByCategory) - operationCount(a, toolsByCategory);
      if (sort === 'activity') return (b.lastActivity?.en || '').localeCompare(a.lastActivity?.en || '') || a.name[lang].localeCompare(b.name[lang]);
      return a.name[lang].localeCompare(b.name[lang]);
    };
    return workspaces.filter(matches).sort(compare);
  }, [lang, query, sort, toolsByCategory, workspaces]);

  const grouped = (state: WorkspaceState) => filtered.filter((workspace) => workspace.state === state);
  const totalTools = Object.values(toolsByCategory).reduce((total, tools) => total + tools.length, 0);

  const addWorkspace = () => {
    const ordinal = workspaces.length + 1;
    setWorkspaces((current) => [
      ...current,
      {
        id: `custom-${ordinal}`,
        name: { en: `${copy.workspaceCreated} ${ordinal}`, ar: `${copy.workspaceCreated} ${ordinal}` },
        code: `LOCAL-${String(ordinal).padStart(2, '0')}`,
        section: 'maintenance',
        category: '01-System-Maintenance',
        state: 'active',
        accent: '#25c8dd',
        icon: '+',
        lastActivity: { en: new Date().toLocaleString('en'), ar: new Date().toLocaleString('ar') },
        status: { en: 'Draft workspace', ar: 'مساحة مسودة' },
        owner: { en: 'Local workspace', ar: 'مساحة محلية' },
      },
    ]);
    setExpanded((current) => ({ ...current, active: true }));
  };

  const renderRows = (rows: Workspace[]) => {
    if (rows.length === 0) return <p className="workspace-empty">{copy.noResults}</p>;
    return rows.map((workspace) => {
      const tools = operationCount(workspace, toolsByCategory);
      const selected = selectedId === workspace.id;
      return (
        <div className={`workspace-row ${selected ? 'is-selected' : ''}`} key={workspace.id}>
          <button type="button" className="workspace-row-select" aria-label={`${copy.open}: ${workspace.name[lang]}`} onClick={() => { setSelectedId(workspace.id); onOpenSection(workspace.section); }}>
            <span className="workspace-radio" aria-hidden="true" />
          </button>
          <button type="button" className="workspace-identity" onClick={() => { setSelectedId(workspace.id); onOpenSection(workspace.section); }}>
            <WorkspaceMark workspace={workspace} />
            <span>
              <strong>{workspace.name[lang]}</strong>
              <small>{workspace.owner[lang]}</small>
            </span>
          </button>
          <span className="workspace-cell workspace-tools" data-label={copy.tools}><b>{tools}</b><small>{lang === 'ar' ? 'عملية' : 'tools'}</small></span>
          <span className="workspace-cell workspace-code" data-label={copy.code}>{workspace.code}</span>
          <span className="workspace-cell workspace-activity" data-label={copy.activity}>{workspace.lastActivity?.[lang] || '—'}</span>
          <span className="workspace-cell workspace-status" data-label={copy.status}>{workspace.status[lang]}</span>
          <div className="workspace-row-actions">
            <button type="button" className="workspace-open-button" onClick={() => { setSelectedId(workspace.id); onOpenSection(workspace.section); }}><Wrench size={14} />{copy.open}</button>
            <button type="button" className="workspace-more-button" aria-label={`${copy.actions}: ${workspace.name[lang]}`}><MoreHorizontal size={17} /></button>
          </div>
        </div>
      );
    });
  };

  const renderGroup = (state: WorkspaceState, Icon: typeof LayoutGrid) => {
    const rows = grouped(state);
    const isExpanded = expanded[state];
    const labels: Record<WorkspaceState, string> = { active: copy.active, pinned: copy.pinned, archived: copy.archived };
    return (
      <section className={`workspace-group workspace-group-${state}`}>
        <button type="button" className="workspace-group-header" onClick={() => setExpanded((current) => ({ ...current, [state]: !current[state] }))} aria-expanded={isExpanded}>
          <span className="workspace-group-label"><Icon size={15} />{labels[state]} <b>{rows.length}</b></span>
          <ChevronDown size={18} className={isExpanded ? 'is-open' : ''} />
        </button>
        {isExpanded && (
          <div className="workspace-group-content">
            {state === 'active' && (
              <div className="workspace-table-head" aria-hidden="true">
                <span />
                <span>{copy.workspace}</span>
                <span>{copy.tools}</span>
                <span>{copy.code}</span>
                <span>{copy.activity}</span>
                <span>{copy.status}</span>
                <span>{copy.actions}</span>
              </div>
            )}
            <div className="workspace-table-body">{renderRows(rows)}</div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="workspace-dashboard">
      <header className="workspace-header">
        <div className="workspace-title-block">
          <button type="button" className="workspace-mobile-menu" onClick={onOpenNavigation} aria-label={lang === 'ar' ? 'فتح التنقل' : 'Open navigation'}><PanelLeft size={19} /></button>
          <div>
            <div className="workspace-kicker"><span /><span>{copy.live}</span><span className="workspace-kicker-dot" /> <span>{totalTools} {copy.ready}</span></div>
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>
        </div>
        <button type="button" className="workspace-add-button" onClick={addWorkspace}><Plus size={17} />{copy.add}</button>
      </header>

      <div className="workspace-toolbar">
        <label className="workspace-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
        </label>
        <label className="workspace-sort">
          <ArrowUpDown size={15} />
          <span>{copy.sort}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label={copy.sort}>
            <option value="name">{lang === 'ar' ? 'الاسم' : 'Name'}</option>
            <option value="tools">{lang === 'ar' ? 'الأدوات' : 'Tools'}</option>
            <option value="activity">{lang === 'ar' ? 'النشاط' : 'Activity'}</option>
          </select>
        </label>
      </div>

      <div className="workspace-summary-strip">
        <div><CircleDot size={16} /><span><b>{grouped('active').length}</b>{copy.active}</span></div>
        <div><Pin size={15} /><span><b>{grouped('pinned').length}</b>{copy.pinned}</span></div>
        <div><Archive size={15} /><span><b>{grouped('archived').length}</b>{copy.archived}</span></div>
        <div><Zap size={15} /><span><b>{totalTools}</b>{lang === 'ar' ? 'قدرة متاحة' : 'available operations'}</span></div>
      </div>

      <div className="workspace-groups">
        {renderGroup('active', FolderKanban)}
        {renderGroup('pinned', Pin)}
        {renderGroup('archived', Archive)}
      </div>
    </div>
  );
}
