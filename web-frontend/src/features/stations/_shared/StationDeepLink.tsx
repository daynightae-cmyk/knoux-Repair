import type { ReactNode } from 'react';
import type { Lang } from '../../../lib/i18n';
import type { FamilyId, ServiceId } from '../../../data/family-map';
import { ArrowRight } from 'lucide-react';

export interface StationDeepLinkProps {
  lang: Lang;
  onNavigateService?: (family: FamilyId, serviceId: ServiceId) => void;
  family: FamilyId;
  serviceId: ServiceId;
  /** Human name of the destination, for the accessible label. */
  destinationName: { en: string; ar: string };
  /** What the link offers, shown as the visible copy. */
  label: { en: string; ar: string };
  children?: ReactNode;
}

/**
 * One cross-station hand-off.
 *
 * The product's rule is that a capability has ONE owner. A station that meets a
 * fact owned elsewhere must point at that station instead of duplicating the
 * engine — a second cleanup, a second process list, a second driver query.
 *
 * Renders nothing when no navigation is wired, so a station used outside the
 * shell degrades to plain text rather than a dead button.
 */
export function StationDeepLink({
  lang,
  onNavigateService,
  family,
  serviceId,
  destinationName,
  label,
  children,
}: StationDeepLinkProps) {
  const T = (copy: { en: string; ar: string }) => (lang === 'ar' ? copy.ar : copy.en);

  if (!onNavigateService) {
    return (
      <span className="knoux-deep-link knoux-deep-link--static">
        {children ?? T(label)}
        <span className="knoux-deep-link__dest">{T(destinationName)}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="knoux-deep-link"
      onClick={() => onNavigateService(family, serviceId)}
      aria-label={`${T(label)} — ${T(destinationName)}`}
    >
      {children ?? <span>{T(label)}</span>}
      <ArrowRight size={12} aria-hidden="true" />
    </button>
  );
}
