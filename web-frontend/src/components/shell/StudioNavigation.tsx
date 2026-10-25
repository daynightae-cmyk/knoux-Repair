import type { ReactNode } from 'react';

export interface StudioNavigationItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** A measured count, e.g. the number of tools the service owns. */
  count?: number | null;
  title?: string;
}

export interface StudioNavigationProps {
  items: StudioNavigationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** CSS color for the studio accent. */
  accent?: string;
  label?: string;
}

/**
 * The contextual navigation of a studio.
 *
 * Selecting a family changes the navigation context to that family's real
 * services. This replaces the permanent family + service + tool rail
 * stack: one horizontal strip, inside the workspace, that never eats the
 * width of the work surface.
 */
export default function StudioNavigation({
  items,
  activeId,
  onSelect,
  accent,
  label,
}: StudioNavigationProps) {
  return (
    <nav
      className="knoux-studio-nav-strip"
      aria-label={label ?? 'Studio services'}
      style={accent ? ({ ['--studio-accent' as string]: accent } as React.CSSProperties) : undefined}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className="knoux-studio-nav-tab"
          data-active={activeId === item.id}
          data-nav-id={item.id}
          aria-current={activeId === item.id ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
          title={item.title ?? item.label}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.count === null || item.count === undefined ? null : <em>{item.count}</em>}
        </button>
      ))}
    </nav>
  );
}
