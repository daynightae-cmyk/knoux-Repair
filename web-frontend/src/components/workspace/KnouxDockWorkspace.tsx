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

type WorkspaceKind = 'developer' | 'sonar';

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

  const panelText = workspace === 'sonar'
    ? {
        prefix: 'knoux-sonar',
        center: lang === 'ar' ? 'مساحة سونار' : 'Project Sonar Workspace',
        explorer: lang === 'ar' ? 'مستكشف المشروع' : 'Project Explorer',
        context: lang === 'ar' ? 'الأدلة والنتائج' : 'Evidence & Findings',
      }
    : {
        prefix: 'knoux-developer',
        center: lang === 'ar' ? 'مساحة المطور' : 'Developer Workspace',
        explorer: lang === 'ar' ? 'المستكشف' : 'Explorer',
        context: lang === 'ar' ? 'السياق والأدلة' : 'Context & Evidence',
      };

  const onReady = (event: DockviewReadyEvent) => {
    const center = event.api.addPanel({
      id: `${panelText.prefix}-center`,
      component: 'center',
      title: panelText.center,
      minimumWidth: 420,
      minimumHeight: 260,
      renderer: 'always',
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
      initialWidth: 230,
      minimumWidth: 170,
      maximumWidth: 360,
      renderer: 'always',
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
      initialWidth: 270,
      minimumWidth: 200,
      maximumWidth: 420,
      renderer: 'always',
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
