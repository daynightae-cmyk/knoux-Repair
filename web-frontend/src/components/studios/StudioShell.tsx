import type { ReactNode } from 'react';
import StudioHeader from '../shell/StudioHeader';
import type { StudioHeaderMetric } from '../shell/StudioHeader';
import './studioShell.css';

/**
 * The shared shell of every studio landing.
 *
 * The families differ in what they measure, not in how they are built: the
 * header states where you are, the masthead carries the family's own visual
 * identity and the live context, the body holds the stations, and the closing
 * note states what the surface does and does not do. Keeping one shell is
 * what makes six studios read as one product instead of six pages.
 */

export interface StudioContextFact {
  label: string;
  value: string;
}

export interface StudioShellProps {
  /** The family-scoped class, e.g. `knoux-storage-studio`. */
  className: string;
  family: string;
  lang: 'en' | 'ar';
  probeState: 'idle' | 'loading' | 'settled';
  header: {
    kicker: string;
    title: string;
    description: string;
    icon: ReactNode;
    accent: string;
    metrics: StudioHeaderMetric[];
  };
  /** The family's own hero visual. It is decorative and never a claim. */
  visual?: ReactNode;
  contextTitle?: string;
  contextBadge?: string;
  context?: StudioContextFact[];
  contextNote?: string;
  /** Every reading that failed, reported instead of being swallowed. */
  failures: Array<{ id: string; message: string }>;
  failureLabel: string;
  /** The measurement body. */
  children: ReactNode;
  /** The family's own action surface, mounted under the stations. */
  spotlight?: ReactNode;
  /** What this surface is and is not allowed to do. */
  truth: ReactNode;
}

export default function StudioShell({
  className,
  family,
  lang,
  probeState,
  header,
  visual,
  contextTitle,
  contextBadge,
  context,
  contextNote,
  failures,
  failureLabel,
  children,
  spotlight,
  truth,
}: StudioShellProps) {
  const ar = lang === 'ar';
  return (
    <section className={className} data-family={family} data-probe={probeState} dir={ar ? 'rtl' : 'ltr'}>
      <StudioHeader
        kicker={header.kicker}
        title={header.title}
        description={header.description}
        icon={header.icon}
        accent={header.accent}
        metrics={header.metrics}
      />

      {visual || (context && context.length > 0) ? (
        <div className="knoux-studio-masthead">
          {visual ? <div className="knoux-studio-masthead__visual" aria-hidden="true">{visual}</div> : null}
          {context && context.length > 0 ? (
            <div className="knoux-studio-masthead__context">
              <header>
                <span>{contextTitle}</span>
                {contextBadge ? <b>{contextBadge}</b> : null}
              </header>
              <div className="knoux-studio-masthead__context-items">
                {context.map(item => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
              {contextNote ? <p>{contextNote}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}

      {failures.length > 0 ? (
        <p className="knoux-studio-notice" role="status">
          {failureLabel}{' '}
          {failures.map(failure => failure.message).join(' · ')}
        </p>
      ) : null}

      {spotlight ? <div className="knoux-studio-spotlight">{spotlight}</div> : null}

      <p className="knoux-studio-truth">{truth}</p>
    </section>
  );
}
