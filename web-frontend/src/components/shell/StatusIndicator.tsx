import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'positive' | 'caution' | 'danger' | 'data' | 'brand';

export interface StatusIndicatorProps {
  tone?: StatusTone;
  label: string;
  icon?: ReactNode;
  title?: string;
  pulse?: boolean;
}

/**
 * The single truth chip of the product.
 *
 * Tone is a claim about state, never decoration: `positive` means the
 * system confirmed something, `caution` means a human should look, `danger`
 * means something failed, `data` means measured information.
 */
export default function StatusIndicator({
  tone = 'neutral',
  label,
  icon,
  title,
  pulse = false,
}: StatusIndicatorProps) {
  return (
    <span className="knoux-status-indicator" data-tone={tone} title={title}>
      {icon ?? <span className="knoux-status-indicator-dot" style={pulse ? { animation: 'knoux-shimmer 1.4s ease-in-out infinite' } : undefined} />}
      <span>{label}</span>
    </span>
  );
}
