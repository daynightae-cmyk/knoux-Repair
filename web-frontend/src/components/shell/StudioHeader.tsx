import type { ReactNode } from 'react';
import StatusIndicator from './StatusIndicator';
import type { StatusTone } from './StatusIndicator';

export interface StudioHeaderMetric {
  label: string;
  value: string;
  tone?: StatusTone;
}

export interface StudioHeaderProps {
  kicker: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  metrics?: StudioHeaderMetric[];
  actions?: ReactNode;
  /** CSS color for the studio accent, e.g. `var(--knoux-family-vitality)`. */
  accent?: string;
}

/**
 * The header of a studio or a service workspace.
 *
 * It states where you are, what this place is for, and the few numbers
 * that matter — then gets out of the way. It never grows into a hero.
 */
export default function StudioHeader({
  kicker,
  title,
  description,
  icon,
  metrics = [],
  actions,
  accent,
}: StudioHeaderProps) {
  return (
    <header
      className="knoux-studio-header"
      style={accent ? ({ ['--studio-accent' as string]: accent } as React.CSSProperties) : undefined}
    >
      <div className="knoux-studio-header-identity">
        {icon ? <span className="knoux-studio-header-mark">{icon}</span> : null}
        <div className="knoux-studio-header-titles">
          <div className="knoux-studio-header-kicker">{kicker}</div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="knoux-studio-header-trail">
        {metrics.length > 0 ? (
          <div className="knoux-studio-header-metrics">
            {metrics.map(metric => (
              <div className="knoux-studio-header-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>
                  {metric.tone ? <StatusIndicator tone={metric.tone} label={metric.value} /> : metric.value}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
        {actions}
      </div>
    </header>
  );
}
