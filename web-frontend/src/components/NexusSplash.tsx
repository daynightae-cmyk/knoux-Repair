import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../lib/i18n';
import {
  getSplashPresentation,
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

export default function NexusSplash({
  visible,
  onDone,
  lang,
  bridgeOnline,
  toolCount,
}: NexusSplashProps) {
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const startedAtRef = useRef(0);
  const doneRef = useRef(false);
  const leavingRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const progressTimersRef = useRef<number[]>([]);
  const readinessTimerRef = useRef<number | null>(null);
  const unresolvedTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

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

  const beginExit = useCallback(() => {
    if (doneRef.current || leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    exitTimerRef.current = window.setTimeout(
      completeOnce,
      reducedMotion ? 170 : SPLASH_TIMING.exitMs,
    );
  }, [completeOnce, reducedMotion]);

  const finishBoot = useCallback(() => {
    if (doneRef.current || leavingRef.current) return;
    setProgress(100);
    readinessTimerRef.current = window.setTimeout(
      beginExit,
      reducedMotion ? 80 : SPLASH_TIMING.completionHoldMs,
    );
  }, [beginExit, reducedMotion]);

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
      const timer = window.setTimeout(() => {
        if (!leavingRef.current && !doneRef.current) setProgress(step.value);
      }, reducedMotion ? Math.min(step.at, 260) : step.at);
      progressTimersRef.current.push(timer);
    }

    unresolvedTimerRef.current = window.setTimeout(() => {
      if (doneRef.current || leavingRef.current) return;
      setTimedOut(true);
      finishBoot();
    }, reducedMotion ? 900 : SPLASH_TIMING.unresolvedBridgeTimeoutMs);

    return clearAllTimers;
  }, [clearAllTimers, finishBoot, reducedMotion, visible]);

  useEffect(() => {
    if (!visible || bridgeOnline === null || doneRef.current || leavingRef.current) return;

    clearTimer(unresolvedTimerRef.current);
    unresolvedTimerRef.current = null;
    clearTimer(readinessTimerRef.current);

    const elapsed = performance.now() - startedAtRef.current;
    const remainingMinimum = Math.max(0, SPLASH_TIMING.minimumVisualMs - elapsed);
    readinessTimerRef.current = window.setTimeout(finishBoot, reducedMotion ? 0 : remainingMinimum);

    return () => clearTimer(readinessTimerRef.current);
  }, [bridgeOnline, clearTimer, finishBoot, reducedMotion, visible]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const presentation = useMemo(
    () => getSplashPresentation({ lang, progress, bridgeOnline, toolCount, timedOut }),
    [bridgeOnline, lang, progress, timedOut, toolCount],
  );

  const requestSkip = useCallback(() => {
    if (!visible || leavingRef.current || doneRef.current) return;
    const elapsed = performance.now() - startedAtRef.current;
    const safeToContinue = bridgeOnline !== null || timedOut;
    if (elapsed < SPLASH_TIMING.minimumVisualMs || !safeToContinue) return;
    finishBoot();
  }, [bridgeOnline, finishBoot, timedOut, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        requestSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestSkip, visible]);

  const progressValue = Math.max(0, Math.min(progress, 100));
  const readyVisual = presentation.stage === 'ready';

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          className="kr-splash"
          data-lang={lang}
          role="dialog"
          aria-modal="true"
          aria-label="KNOUX Repair"
          initial={{ opacity: 1 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{
            duration: reducedMotion ? 0.17 : SPLASH_TIMING.exitMs / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
          onPointerUp={requestSkip}
        >
          <motion.div
            className="kr-splash__ambient kr-splash__ambient--one"
            aria-hidden="true"
            animate={{ opacity: leaving ? 0.27 : 0.2 }}
            transition={{ duration: reducedMotion ? 0 : 0.42 }}
          />
          <motion.div
            className="kr-splash__ambient kr-splash__ambient--two"
            aria-hidden="true"
            animate={{ opacity: leaving ? 0.22 : 0.16 }}
            transition={{ duration: reducedMotion ? 0 : 0.42 }}
          />
          <div className="kr-splash__grain" aria-hidden="true" />

          <motion.main
            className="kr-splash__scene"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            animate={
              leaving
                ? reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.015, filter: 'blur(10px)' }
                : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
            }
            transition={{
              duration: reducedMotion ? 0.18 : leaving ? 0.52 : 0.72,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <motion.div
              className="kr-splash__emblem"
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94, y: 8, filter: 'blur(8px)' }
              }
              animate={{ opacity: 1, scale: leaving && !reducedMotion ? 1.015 : 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: reducedMotion ? 0.16 : 0.78, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                className="kr-splash__logo"
                src="/brand/knoux-repair-logo.png"
                alt="KNOUX Repair"
                draggable={false}
              />
              {!reducedMotion && (
                <motion.span
                  className="kr-splash__reflection"
                  aria-hidden="true"
                  initial={{ x: '-12%' }}
                  animate={{ x: '590%' }}
                  transition={{ delay: 0.62, duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.22, duration: reducedMotion ? 0.15 : 0.54, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="kr-splash__brand" dir="ltr">
                <span className="kr-splash__brand-main">KNOUX</span>
                <span className="kr-splash__brand-accent">REPAIR</span>
              </h1>
              <p className="kr-splash__subtitle">{presentation.subtitle}</p>
            </motion.div>

            <motion.section
              className="kr-splash__boot"
              aria-label={lang === 'ar' ? 'حالة بدء التشغيل' : 'Boot status'}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.46, duration: reducedMotion ? 0.15 : 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="kr-splash__status-row">
                <div className="kr-splash__status" aria-live="polite" aria-atomic="true">
                  <span className={`kr-splash__status-dot${readyVisual ? ' is-ready' : ''}`} aria-hidden="true" />
                  <span>{presentation.stageLabel}</span>
                </div>
                <span className="kr-splash__percentage" aria-hidden="true">{progressValue}%</span>
              </div>

              <div
                className="kr-splash__progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressValue}
                aria-label={lang === 'ar' ? 'تقدم تهيئة النظام' : 'System initialization progress'}
              >
                <div className="kr-splash__progress-fill" style={{ width: `${progressValue}%` }} />
              </div>

              <div className="kr-splash__meta">
                <span>{presentation.localBridge}</span>
                <span
                  className={`kr-splash__meta-bridge${bridgeOnline === true ? ' is-connected' : ''}`}
                >
                  {presentation.bridgeLabel}
                </span>
                <span className="kr-splash__meta-divider" aria-hidden="true" />
                <span>{presentation.toolsLabel}</span>
              </div>
            </motion.section>
          </motion.main>

          <div className="kr-splash__footer">{presentation.footer}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
