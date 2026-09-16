import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../lib/i18n';
import {
  canActivateSplash,
  getSplashPresentation,
  isSplashActivationKey,
  SPLASH_PROGRESS_STEPS,
  SPLASH_TIMING,
} from './splashModel';
import './NexusSplash.css';

export interface NexusSplashProps {
  visible: boolean;
  onDone: () => void;
  lang: Lang;
  bridgeOnline: boolean | null;
  toolCount: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export default function NexusSplash({ visible, onDone, lang, bridgeOnline, toolCount }: NexusSplashProps) {
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');

  const doneRef = useRef(false);
  const leavingRef = useRef(false);
  const startedAtRef = useRef(0);
  const onDoneRef = useRef(onDone);
  const entryButtonRef = useRef<HTMLButtonElement>(null);
  const progressTimersRef = useRef<number[]>([]);
  const readinessTimerRef = useRef<number | null>(null);
  const unresolvedTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const clearTimer = useCallback((timer: number | null) => {
    if (timer !== null) window.clearTimeout(timer);
  }, []);

  const clearAllTimers = useCallback(() => {
    for (const timer of progressTimersRef.current) window.clearTimeout(timer);
    progressTimersRef.current = [];
    clearTimer(readinessTimerRef.current);
    clearTimer(unresolvedTimerRef.current);
    clearTimer(exitTimerRef.current);
    readinessTimerRef.current = null;
    unresolvedTimerRef.current = null;
    exitTimerRef.current = null;
  }, [clearTimer]);

  const completeOnce = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    clearAllTimers();
    if (!visible) {
      doneRef.current = false;
      leavingRef.current = false;
      setLeaving(false);
      setTimedOut(false);
      setProgress(0);
      return;
    }

    doneRef.current = false;
    leavingRef.current = false;
    startedAtRef.current = performance.now();
    setLeaving(false);
    setTimedOut(false);
    setProgress(0);

    for (const step of SPLASH_PROGRESS_STEPS) {
      progressTimersRef.current.push(window.setTimeout(() => {
        if (!leavingRef.current && !doneRef.current) setProgress(step.value);
      }, reducedMotion ? Math.min(step.at, 260) : step.at));
    }

    unresolvedTimerRef.current = window.setTimeout(() => {
      if (leavingRef.current || doneRef.current) return;
      setTimedOut(true);
      setProgress(100);
    }, reducedMotion ? SPLASH_TIMING.minimumVisualMs : SPLASH_TIMING.unresolvedBridgeTimeoutMs);

    return clearAllTimers;
  }, [clearAllTimers, reducedMotion, visible]);

  useEffect(() => {
    if (!visible || bridgeOnline === null || leavingRef.current || doneRef.current) return;
    clearTimer(unresolvedTimerRef.current);
    unresolvedTimerRef.current = null;
    clearTimer(readinessTimerRef.current);
    const elapsed = performance.now() - startedAtRef.current;
    const remainingMinimum = Math.max(0, SPLASH_TIMING.minimumVisualMs - elapsed);
    readinessTimerRef.current = window.setTimeout(() => setProgress(100), remainingMinimum);
    return () => clearTimer(readinessTimerRef.current);
  }, [bridgeOnline, clearTimer, visible]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const presentation = useMemo(
    () => getSplashPresentation({ lang, progress, bridgeOnline, toolCount, timedOut }),
    [bridgeOnline, lang, progress, timedOut, toolCount],
  );
  const canEnter = canActivateSplash({
    progress,
    bridgeOnline,
    timedOut,
    imageSettled: imageState !== 'loading',
  });

  const requestEnter = useCallback(() => {
    if (!visible || !canEnter || leavingRef.current || doneRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    exitTimerRef.current = window.setTimeout(completeOnce, reducedMotion ? 170 : SPLASH_TIMING.exitMs);
  }, [canEnter, completeOnce, reducedMotion, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSplashActivationKey(event.key, event.code) || isEditableTarget(event.target)) return;
      event.preventDefault();
      requestEnter();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestEnter, visible]);

  useEffect(() => {
    if (canEnter && visible) entryButtonRef.current?.focus({ preventScroll: true });
  }, [canEnter, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          className={`kr-entry${leaving ? ' is-leaving' : ''}${imageState === 'error' ? ' has-fallback' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'ar' ? 'بوابة دخول KNOUX Repair' : 'KNOUX Repair workstation entry'}
          initial={{ opacity: 1 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{ duration: reducedMotion ? 0.17 : SPLASH_TIMING.exitMs / 1000, ease: [0.16, 1, 0.3, 1] }}
        >
          <img className="kr-entry__backdrop" src="/brand/knoux-entry-cinematic.png" alt="" aria-hidden="true" draggable={false} />

          <motion.div
            className="kr-entry__frame"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
            animate={leaving && !reducedMotion
              ? { opacity: 0, scale: 1.025 }
              : { opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0.16 : leaving ? 0.62 : 0.72, ease: [0.16, 1, 0.3, 1] }}
          >
            {imageState !== 'error' ? (
              <img
                className="kr-entry__art"
                src="/brand/knoux-entry-cinematic.png"
                alt="KNOUX Repair — Precision Windows Engineering Workstation"
                draggable={false}
                fetchPriority="high"
                onLoad={() => setImageState('ready')}
                onError={() => setImageState('error')}
              />
            ) : (
              <div className="kr-entry__fallback" role="img" aria-label="KNOUX Repair">
                <div className="kr-entry__fallback-mark"><img src="/brand/knoux-mark-crystal.png" alt="" draggable={false} /></div>
                <img className="kr-entry__fallback-wordmark" src="/brand/knoux-repair-wordmark-wide.png" alt="KNOUX Repair" draggable={false} />
              </div>
            )}

            <div className="kr-entry__energy" aria-hidden="true"><i /><i /><i /></div>
            <div className="kr-entry__particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>

            <div className="kr-entry__live-status" role="status" aria-live="polite" aria-atomic="true">
              <span className={`kr-entry__state-dot${canEnter ? ' is-ready' : ''}`} />
              <strong>{presentation.stageLabel}</strong>
              <span className="kr-entry__divider" />
              <span>{presentation.bridgeLabel}</span>
              <span className="kr-entry__divider" />
              <span>{presentation.toolsLabel}</span>
            </div>

            <button
              ref={entryButtonRef}
              type="button"
              className="kr-entry__button"
              onClick={requestEnter}
              disabled={!canEnter || leaving}
              aria-label={lang === 'ar' ? 'دخول محطة عمل KNOUX Repair' : 'Enter KNOUX Repair workstation'}
            >
              <span>
                <b>{canEnter ? presentation.action : presentation.instruction}</b>
                <small>{canEnter ? presentation.instruction : presentation.stageLabel}</small>
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
