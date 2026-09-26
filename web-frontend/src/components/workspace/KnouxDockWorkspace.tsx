import {
  Children,
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  DockviewDefaultTab,
  DockviewReact,
  themeAbyss,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import './knoux-dock-workspace.css';

type SlotName = 'explorer' | 'center' | 'context';

interface WorkspaceSlotState {
  lang: 'en' | 'ar';
  slots: Record<SlotName, ReactNode>;
}

export type WorkspaceKind =
  | 'developer'
  | 'sonar'
  | 'programs'
  | 'software'
  | 'postinstall'
  | 'diagnostics'
  | 'performance'
  | 'security'
  | 'recovery'
  | 'services'
  | 'maintenance'
  | 'cleanup'
  | 'network'
  | 'duplicates'
  | 'disk'
  | 'privacy'
  | 'drivers'
  | 'monitoring';

interface PanelText {
  prefix: string;
  center: string;
  explorer: string;
  context: string;
  explorerWidth: number;
  explorerMin: number;
  explorerMax: number;
  contextWidth: number;
  contextMin: number;
  contextMax: number;
}

function panelText(lang: 'en' | 'ar', en: string, ar: string): string {
  return lang === 'ar' ? ar : en;
}

function buildPanelText(workspace: WorkspaceKind, lang: 'en' | 'ar'): PanelText {
  const standard = {
    explorerWidth: 180,
    explorerMin: 150,
    explorerMax: 260,
    contextWidth: 200,
    contextMin: 170,
    contextMax: 300,
  };
  const labels: Record<WorkspaceKind, Omit<PanelText, keyof typeof standard>> = {
    developer: {
      prefix: 'knoux-developer',
      center: panelText(lang, 'Developer Workspace', 'مساحة المطور'),
      explorer: panelText(lang, 'Explorer', 'المستكشف'),
      context: panelText(lang, 'Context & Evidence', 'السياق والأدلة'),
    },
    sonar: {
      prefix: 'knoux-sonar',
      center: panelText(lang, 'Project Sonar Workspace', 'مساحة سونار'),
      explorer: panelText(lang, 'Project Explorer', 'مستكشف المشروع'),
      context: panelText(lang, 'Evidence & Findings', 'الأدلة والنتائج'),
    },
    programs: {
      prefix: 'knoux-programs',
      center: panelText(lang, 'Application Studio', 'استوديو التطبيقات'),
      explorer: panelText(lang, 'Program Tools', 'أدوات البرامج'),
      context: panelText(lang, 'Runtime & Evidence', 'التشغيل والأدلة'),
    },
    software: {
      prefix: 'knoux-software',
      center: panelText(lang, 'Runtime Matrix', 'مصفوفة بيئة التشغيل'),
      explorer: panelText(lang, 'Environment Tools', 'أدوات البيئة'),
      context: panelText(lang, 'Environment Evidence', 'أدلة البيئة'),
    },
    postinstall: {
      prefix: 'knoux-postinstall',
      center: panelText(lang, 'Provisioning Pipeline', 'مسار التجهيز'),
      explorer: panelText(lang, 'Provisioning Tools', 'أدوات التجهيز'),
      context: panelText(lang, 'Install Evidence', 'أدلة التثبيت'),
    },
    diagnostics: {
      prefix: 'knoux-diagnostics',
      center: panelText(lang, 'Evidence Lab', 'مختبر الأدلة'),
      explorer: panelText(lang, 'Diagnostic Tools', 'أدوات التشخيص'),
      context: panelText(lang, 'Findings & Reports', 'النتائج والتقارير'),
    },
    performance: {
      prefix: 'knoux-performance',
      center: panelText(lang, 'Performance Observatory', 'مرصد الأداء'),
      explorer: panelText(lang, 'Performance Tools', 'أدوات الأداء'),
      context: panelText(lang, 'Resource Evidence', 'أدلة الموارد'),
    },
    security: {
      prefix: 'knoux-security',
      center: panelText(lang, 'Security Evidence Center', 'مركز أدلة الأمان'),
      explorer: panelText(lang, 'Security Tools', 'أدوات الأمان'),
      context: panelText(lang, 'Protection Evidence', 'أدلة الحماية'),
    },
    recovery: {
      prefix: 'knoux-recovery',
      center: panelText(lang, 'Recovery Vault', 'خزنة الاستعادة'),
      explorer: panelText(lang, 'Recovery Tools', 'أدوات الاستعادة'),
      context: panelText(lang, 'Continuity Evidence', 'أدلة الاستمرارية'),
    },
    services: {
      prefix: 'knoux-services',
      center: panelText(lang, 'System Topology', 'طوبولوجيا النظام'),
      explorer: panelText(lang, 'Service Tools', 'أدوات الخدمات'),
      context: panelText(lang, 'Process Evidence', 'أدلة العمليات'),
    },
    maintenance: {
      prefix: 'knoux-maintenance',
      center: panelText(lang, 'System Integrity Center', 'مركز سلامة النظام'),
      explorer: panelText(lang, 'Maintenance Tools', 'أدوات الصيانة'),
      context: panelText(lang, 'Scan Evidence', 'أدلة الفحص'),
    },
    cleanup: {
      prefix: 'knoux-cleanup',
      center: panelText(lang, 'Space Recovery Map', 'مخطط استعادة المساحة'),
      explorer: panelText(lang, 'Cleanup Tools', 'أدوات التنظيف'),
      context: panelText(lang, 'Reclaim Evidence', 'أدلة الاستعادة'),
    },
    network: {
      prefix: 'knoux-network',
      center: panelText(lang, 'Network Topology', 'طوبولوجيا الشبكة'),
      explorer: panelText(lang, 'Network Tools', 'أدوات الشبكة'),
      context: panelText(lang, 'Path Evidence', 'أدلة المسار'),
    },
    duplicates: {
      prefix: 'knoux-duplicates',
      center: panelText(lang, 'Duplicate Intelligence Lab', 'مختبر استخبارات التكرارات'),
      explorer: panelText(lang, 'Duplicate Tools', 'أدوات التكرارات'),
      context: panelText(lang, 'Restore Evidence', 'أدلة الاسترجاع'),
    },
    disk: {
      prefix: 'knoux-disk',
      center: panelText(lang, 'Storage Atlas', 'أطلس التخزين'),
      explorer: panelText(lang, 'Storage Tools', 'أدوات التخزين'),
      context: panelText(lang, 'Capacity Evidence', 'أدلة السعة'),
    },
    privacy: {
      prefix: 'knoux-privacy',
      center: panelText(lang, 'Privacy Audit Center', 'مركز تدقيق الخصوصية'),
      explorer: panelText(lang, 'Privacy Tools', 'أدوات الخصوصية'),
      context: panelText(lang, 'Permission Evidence', 'أدلة الأذونات'),
    },
    drivers: {
      prefix: 'knoux-drivers',
      center: panelText(lang, 'Driver Matrix', 'مصفوفة التعريفات'),
      explorer: panelText(lang, 'Driver Tools', 'أدوات التعريفات'),
      context: panelText(lang, 'Device Evidence', 'أدلة الأجهزة'),
    },
    monitoring: {
      prefix: 'knoux-monitoring',
      center: panelText(lang, 'Live Resource Observatory', 'مرصد الموارد الحي'),
      explorer: panelText(lang, 'Monitoring Tools', 'أدوات المراقبة'),
      context: panelText(lang, 'Sample Evidence', 'أدلة العيّنات'),
    },
  };
  const text = labels[workspace];
  if (workspace === 'developer' || workspace === 'sonar') {
    return {
      ...text,
      explorerWidth: 230,
      explorerMin: 170,
      explorerMax: 360,
      contextWidth: 270,
      contextMin: 200,
      contextMax: 420,
    };
  }
  if (workspace === 'services') {
    return {
      ...text,
      explorerWidth: 140,
      explorerMin: 120,
      explorerMax: 220,
      contextWidth: 150,
      contextMin: 130,
      contextMax: 220,
    };
  }
  return { ...text, ...standard };
}

/** Stations whose center stage owns a multi-tab operational surface and needs the wider floor. */
const WIDE_CENTER_WORKSPACES: ReadonlySet<WorkspaceKind> = new Set<WorkspaceKind>([
  'performance',
  'security',
  'recovery',
  'maintenance',
  'cleanup',
  'network',
  'duplicates',
  'disk',
  'privacy',
  'drivers',
  'monitoring',
]);

interface KnouxDockWorkspaceProps {
  lang: 'en' | 'ar';
  enabled: boolean;
  workspace: WorkspaceKind;
  children: ReactNode;
}

const WorkspaceSlotContext = createContext<WorkspaceSlotState | null>(null);

function WorkspaceSlot({ name }: { name: SlotName }) {
  const state = useContext(WorkspaceSlotContext);
  if (!state) return null;

  return (
    <div
      className={`knoux-dock-slot knoux-dock-slot--${name}`}
      data-dock-slot={name}
      dir={state.lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {state.slots[name]}
    </div>
  );
}

const dockComponents = {
  explorer: (_props: IDockviewPanelProps) => <WorkspaceSlot name="explorer" />,
  center: (_props: IDockviewPanelProps) => <WorkspaceSlot name="center" />,
  context: (_props: IDockviewPanelProps) => <WorkspaceSlot name="context" />,
};

function LockedWorkspaceTab(props: IDockviewPanelHeaderProps) {
  return <DockviewDefaultTab {...props} hideClose />;
}

const tabComponents = {
  locked: LockedWorkspaceTab,
};

export default function KnouxDockWorkspace({
  lang,
  enabled,
  workspace,
  children,
}: KnouxDockWorkspaceProps) {
  const nodes = Children.toArray(children);
  const state = useMemo<WorkspaceSlotState>(
    () => ({
      lang,
      slots: {
        explorer: nodes[0] ?? null,
        center: nodes[1] ?? null,
        context: nodes[2] ?? null,
      },
    }),
    [lang, nodes[0], nodes[1], nodes[2]],
  );

  if (!enabled) {
    return (
      <div className="knoux-deck-workspace" data-workspace="ide">
        {children}
      </div>
    );
  }

  const panelText = buildPanelText(workspace, lang);

  const onReady = (event: DockviewReadyEvent) => {
    const center = event.api.addPanel({
      id: `${panelText.prefix}-center`,
      component: 'center',
      title: panelText.center,
      minimumWidth: WIDE_CENTER_WORKSPACES.has(workspace)
        ? 560
        : workspace === 'performance' || workspace === 'security' || workspace === 'recovery' ? 560 : workspace === 'services' ? 640 : 420,
      minimumHeight: 260,
      renderer: 'onlyWhenVisible',
      tabComponent: 'locked',
    });

    event.api.addPanel({
      id: `${panelText.prefix}-explorer`,
      component: 'explorer',
      title: panelText.explorer,
      position: {
        referencePanel: center,
        direction: 'left',
      },
      initialWidth: panelText.explorerWidth,
      minimumWidth: panelText.explorerMin,
      maximumWidth: panelText.explorerMax,
      renderer: 'onlyWhenVisible',
      tabComponent: 'locked',
    });

    event.api.addPanel({
      id: `${panelText.prefix}-context`,
      component: 'context',
      title: panelText.context,
      position: {
        referencePanel: center,
        direction: 'right',
      },
      initialWidth: panelText.contextWidth,
      minimumWidth: panelText.contextMin,
      maximumWidth: panelText.contextMax,
      renderer: 'onlyWhenVisible',
      tabComponent: 'locked',
    });
  };

  return (
    <WorkspaceSlotContext.Provider value={state}>
      <div
        className="knoux-dock-workspace"
        data-workspace="ide"
        data-workspace-shell="dockview"
        data-workspace-kind={workspace}
        data-runtime-owner="existing-knoux"
        dir="ltr"
      >
        <DockviewReact
          className="knoux-dockview"
          theme={themeAbyss}
          components={dockComponents}
          tabComponents={tabComponents}
          onReady={onReady}
        />
      </div>
    </WorkspaceSlotContext.Provider>
  );
}
