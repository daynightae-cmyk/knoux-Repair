import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ElementType } from 'react';
import StatusIndicator from '../shell/StatusIndicator';
import './studioStations.css';

/**
 * The shared station grammar of the Adaptive Studio Shell.
 *
 * Every studio landing is a *measurement* surface: a set of stations, each
 * backed by one real bridge reading, and nothing else. The same rules apply
 * to every family:
 *
 *  - a station shows either measured readings or an explicit "not measured"
 *    line — never a plausible number with no source;
 *  - selecting a station opens the owning service; it never executes it,
 *    and quarantine/restore/delete stay inside their own station behind
 *    their own confirmation;
 *  - one failing reading never blanks the others, and a failure that is
 *    reported nowhere is a lie;
 *  - the surface publishes whether the measurement pass has finished, so a
 *    capture can tell "not started yet" apart from "read and found
 *    nothing" — the two look identical on screen but mean different things.
 */

export type StudioStationState = 'loading' | 'error' | 'measured' | 'empty' | 'offline';

export type StudioProbeStatus = 'idle' | 'loading' | 'ready' | 'error';

export type StudioReadingTone = 'data' | 'positive' | 'caution' | 'neutral' | 'danger' | 'brand';

export interface StudioReading {
  label: string;
  value: string;
  tone?: StudioReadingTone;
}

/** One station's bridge read. */
export interface StudioProbe {
  id: string;
  read: () => Promise<unknown>;
}

/** A station as it is rendered. */
export interface StudioStationView {
  id: string;
  icon: ElementType;
  title: string;
  purpose: string;
  state: StudioStationState;
  readings: StudioReading[];
  /** The number of registered actions in this service, or null when unknown. */
  toolCount: number | null;
  /** The line shown when the station has no reading. */
  emptyText: string;
}

export interface StudioProbesResult {
  /** The raw reading per station id. A null means "not read". */
  results: Record<string, unknown>;
  status: Record<string, StudioProbeStatus>;
  /** The state of the measurement pass itself. */
  probeState: 'idle' | 'loading' | 'settled';
  /** Every reading that failed, reported separately so one failure cannot hide the others. */
  failures: Array<{ id: string; message: string }>;
  reload: () => void;
}

/**
 * Runs one independent bridge read per station.
 *
 * The reads are settled separately: one failing reading never blanks the
 * others, and the failure is reported instead of being swallowed. Nothing
 * is counted while the bridge is offline.
 */
export function useStudioProbes(
  probes: StudioProbe[],
  bridgeOnline: boolean | null,
): StudioProbesResult {
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<Record<string, StudioProbeStatus>>({});
  const [failures, setFailures] = useState<Array<{ id: string; message: string }>>([]);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt(value => value + 1), []);

  // The read set is rebuilt by the caller on every render, so the effect
  // tracks it through a ref and restarts only when the bridge state or the
  // explicit retry counter changes.
  const probesRef = useRef(probes);
  probesRef.current = probes;

  useEffect(() => {
    if (bridgeOnline !== true) return;
    const active = probesRef.current;
    let cancelled = false;
        setFailures([]);
    setStatus(current => {
      const next = { ...current };
      for (const probe of active) next[probe.id] = 'loading';
      return next;
    });

    void Promise.allSettled(active.map(probe => probe.read())).then(settled => {
      if (cancelled) return;
      const nextResults: Record<string, unknown> = {};
      const nextStatus: Record<string, StudioProbeStatus> = {};
      const nextFailures: Array<{ id: string; message: string }> = [];
      settled.forEach((outcome, index) => {
        const id = active[index].id;
        if (outcome.status === 'fulfilled') {
          nextResults[id] = outcome.value;
          nextStatus[id] = 'ready';
        } else {
          nextResults[id] = null;
          nextStatus[id] = 'error';
          const reason = outcome.reason;
          nextFailures.push({
            id,
            message: reason instanceof Error ? reason.message : String(reason),
          });
        }
      });
      setResults(nextResults);
      setStatus(nextStatus);
      setFailures(nextFailures);
    });

    return () => { cancelled = true; };
  }, [bridgeOnline, attempt]);

  const probeState = useMemo<'idle' | 'loading' | 'settled'>(() => {
    const statuses = probes.map(probe => status[probe.id] ?? 'idle');
    if (statuses.every(value => value === 'idle')) return 'idle';
    if (statuses.some(value => value === 'loading')) return 'loading';
    return 'settled';
  }, [probes, status]);

  return { results, status, probeState, failures, reload };
}

function stationTone(state: StudioStationState): 'data' | 'danger' | 'caution' | 'neutral' {
  if (state === 'measured') return 'data';
  if (state === 'error') return 'danger';
  if (state === 'loading') return 'caution';
  return 'neutral';
}

/**
 * The state of one station.
 *
 * A station that has not been measured is never dressed up as one that has:
 * an offline bridge produces "offline", a failed read produces "error", and
 * a read that found nothing produces "empty" — three different meanings
 * that look the same if they are collapsed into one.
 */
export function stationStateFor(
  measured: boolean,
  probe: StudioProbeStatus,
  hasReading: boolean,
): StudioStationState {
  if (!measured) return 'offline';
  if (probe === 'error') return 'error';
  if (probe === 'loading') return 'loading';
  if (probe === 'ready') return hasReading ? 'measured' : 'empty';
  return 'empty';
}

export interface StudioStationGridProps {
  stations: StudioStationView[];
  lang: 'en' | 'ar';
  onSelectService: (id: string) => void;
  /** The label of the button that opens a station. */
  openLabel: string;
  actionsLabel: string;
  notMeasuredLabel: string;
}

/**
 * The station grid. Every studio landing renders its services through this
 * one component, so the grammar cannot drift between families.
 */
export function StudioStationGrid({
  stations,
  lang,
  onSelectService,
  openLabel,
  actionsLabel,
  notMeasuredLabel,
}: StudioStationGridProps) {
  const ar = lang === 'ar';
  return (
    <div className="knoux-studio-stations">
      {stations.map(station => {
        const Icon = station.icon;
        return (
          <article
            key={station.id}
            className="knoux-studio-station"
            data-service-id={station.id}
            data-state={station.state}
          >
            <header className="knoux-studio-station__head">
              <span className="knoux-studio-station__icon"><Icon size={18} aria-hidden="true" /></span>
              <div className="knoux-studio-station__titles">
                <h3>{station.title}</h3>
                <p>{station.purpose}</p>
              </div>
              <StatusIndicator
                tone={stationTone(station.state)}
                label={station.state === 'measured' ? (ar ? 'مقيس' : 'Measured')
                  : station.state === 'loading' ? (ar ? 'جارٍ القراءة' : 'Reading')
                  : station.state === 'error' ? (ar ? 'غير متاح' : 'Unavailable')
                  : notMeasuredLabel}
              />
            </header>

            <div className="knoux-studio-station__readings">
              {station.readings.length === 0 ? (
                <p className="knoux-studio-station__empty">{station.emptyText}</p>
              ) : station.readings.map(reading => (
                <div key={reading.label} className="knoux-studio-station__reading">
                  <span>{reading.label}</span>
                  <b>{reading.value}</b>
                </div>
              ))}
            </div>

            <footer className="knoux-studio-station__foot">
              <span className="knoux-studio-station__actions">
                {station.toolCount === null ? '—' : station.toolCount} {actionsLabel}
              </span>
              <button
                type="button"
                className="knoux-studio-btn knoux-studio-btn--secondary"
                data-tool-id={station.id}
                onClick={() => onSelectService(station.id)}
              >
                <span>{openLabel}</span>
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
