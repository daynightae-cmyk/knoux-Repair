import type { ReactNode } from 'react';

export interface OperationToolbarAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'default' | 'danger';
  title?: string;
}

export interface OperationToolbarProps {
  label: string;
  children?: ReactNode;
  actions?: OperationToolbarAction[];
  /** Free-form right-hand content (status chips, filters). */
  trailing?: ReactNode;
}

/**
 * The toolbar that sits above a work surface and owns the operations that
 * can be performed on what is currently selected.
 */
export default function OperationToolbar({ label, children, actions = [], trailing }: OperationToolbarProps) {
  return (
    <div className="knoux-operation-toolbar" data-role="operation-toolbar">
      <div className="knoux-operation-toolbar-group">
        <span className="knoux-operation-toolbar-label">{label}</span>
        {children}
      </div>
      <div className="knoux-operation-toolbar-group">
        {trailing}
        {actions.map(action => (
          <button
            key={action.id}
            type="button"
            className="knoux-studio-btn"
            data-variant={action.variant ?? 'default'}
            data-action-id={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
