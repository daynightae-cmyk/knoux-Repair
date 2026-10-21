export interface EvidenceEvent {
  id: string;
  title: string;
  detail?: string;
  at?: string;
  tone?: 'neutral' | 'positive' | 'caution' | 'danger' | 'data';
}

export interface EvidenceTimelineProps {
  events: EvidenceEvent[];
  emptyTitle: string;
}

/**
 * The chronological record of what actually happened.
 *
 * Only real observations belong here — a scanned volume, a confirmed
 * elevation, a finished run. Nothing in this component generates content.
 */
export default function EvidenceTimeline({ events, emptyTitle }: EvidenceTimelineProps) {
  if (events.length === 0) {
    return <p className="knoux-evidence-timeline-empty">{emptyTitle}</p>;
  }

  return (
    <ol className="knoux-evidence-timeline">
      {events.map(event => (
        <li key={event.id} data-tone={event.tone ?? 'neutral'}>
          <strong>{event.title}</strong>
          {event.detail ? <small>{event.detail}</small> : null}
          {event.at ? <small>{event.at}</small> : null}
        </li>
      ))}
    </ol>
  );
}
