import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * A truthful empty state.
 *
 * It never says "no data" when nothing was measured — the caller passes
 * the real reason (not checked, bridge offline, no match) as the title, and
 * a recovery path as the action.
 */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="knoux-empty-state" role="status">
      {icon}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
