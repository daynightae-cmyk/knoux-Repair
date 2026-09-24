import {
  Children,
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  DockviewReact,
  themeAbyss,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import './knoux-dock-workspace.css';

type SlotName = 'explorer' | 'center' | 'context';

interface WorkspaceSlotState {
  lang: 'en' | 'ar';
  slots: Record<SlotName, ReactNode>;
}

interface KnouxDockWorkspaceProps {
  lang: 'en' | 'ar';
  enabled: boolean;
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

export default function KnouxDockWorkspace({
  lang,
  enabled,
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

  const onReady = (event: DockviewReadyEvent) => {
    const center = event.api.addPanel({
      id: 'knoux-developer-center',
      component: 'center',
      title: lang === 'ar' ? 'مساحة المطور' : 'Developer Workspace',
      minimumWidth: 420,
      minimumHeight: 260,
      renderer: 'always',
    });

    event.api.addPanel({
      id: 'knoux-developer-explorer',
      component: 'explorer',
      title: lang === 'ar' ? 'المستكشف' : 'Explorer',
      position: {
        referencePanel: center,
        direction: 'left',
      },
      initialWidth: 230,
      minimumWidth: 170,
      maximumWidth: 360,
      renderer: 'always',
    });

    event.api.addPanel({
      id: 'knoux-developer-context',
      component: 'context',
      title: lang === 'ar' ? 'السياق والأدلة' : 'Context & Evidence',
      position: {
        referencePanel: center,
        direction: 'right',
      },
      initialWidth: 270,
      minimumWidth: 200,
      maximumWidth: 420,
      renderer: 'always',
    });
  };

  return (
    <WorkspaceSlotContext.Provider value={state}>
      <div
        className="knoux-dock-workspace"
        data-workspace="ide"
        data-workspace-shell="dockview-poc"
        data-runtime-owner="existing-knoux"
        dir="ltr"
      >
        <DockviewReact
          className="knoux-dockview"
          theme={themeAbyss}
          components={dockComponents}
          onReady={onReady}
        />
      </div>
    </WorkspaceSlotContext.Provider>
  );
}
