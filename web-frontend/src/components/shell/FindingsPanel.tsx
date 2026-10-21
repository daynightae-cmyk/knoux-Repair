import type { ReactNode } from 'react';
import EmptyState from './EmptyState';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail?: string;
  action?: ReactNode;
}

export interface FindingsPanelProps {
  title: string;
  findings: Finding[];
  /** Shown when the panel holds no findings — must state the real reason. */
  emptyTitle: string;
  emptyDescription?: string;
  children?: ReactNode;
}

/**
 * A findings list with severity as a visual, not a colour palette.
 *
 * A finding is a claim backed by evidence. The panel never invents one, and
 * it distinguishes "nothing found" from "not measured yet" through the
 * empty copy the caller supplies.
 */
export default function FindingsPanel({
  title,
  findings,
  emptyTitle,
  emptyDescription,
  children,
}: FindingsPanelProps) {
  return (
    <section className="knoux-panel" data-role="findings-panel">
      <header>
        <h3>{title}</h3>
        <span className="knoux-status-indicator" data-tone={findings.length ? 'caution' : 'neutral'}>
          <span className="knoux-status-indicator-dot" />
          <span>{findings.length}</span>
        </span>
      </header>
      <div className="knoux-panel-body">
        {findings.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="knoux-findings-list">
            {findings.map(finding => (
              <article key={finding.id} className="knoux-finding" data-severity={finding.severity}>
                <span className="knoux-finding-bar" aria-hidden="true" />
                <div className="knoux-finding-body">
                  <strong>{finding.title}</strong>
                  {finding.detail ? <p>{finding.detail}</p> : null}
                  {finding.action}
                </div>
              </article>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
