import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_MESSAGES = [
  'Initializing NEXUS CORE...',
  'Loading telemetry modules...',
  'Scanning system vectors...',
  'Establishing secure channel...',
  'Decrypting tool manifest...',
  'Calibrating diagnostics...',
  'System ready.',
];

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [done, setDone] = useState(false);

  const tick = useCallback(() => {
    setProgress(prev => {
      const next = prev + 9 + Math.max(0, 3 - Math.floor(prev / 35));
      return next >= 100 ? 100 : next;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(tick, 180);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    const idx = Math.min(
      Math.floor((progress / 100) * STATUS_MESSAGES.length),
      STATUS_MESSAGES.length - 1
    );
    setStatusIndex(idx);
  }, [progress]);

  useEffect(() => {
    if (progress >= 100 && !done) {
      setDone(true);
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
  }, [progress, done, onComplete]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Grid + Scanlines */}
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="absolute inset-0 scanlines opacity-30" />

          {/* Halo */}
          <motion.div
            className="absolute w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-cyan-500/20 blur-[120px]"
            animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Logo */}
          <motion.div
            className="relative z-10 mb-10"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl glass-panel neon-glow-strong flex items-center justify-center">
              <span className="font-display text-3xl md:text-4xl font-black text-cyan-400 text-glow-strong">K</span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            className="relative z-10 text-center mb-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1 className="font-display text-3xl md:text-4xl tracking-[0.2em] ml-[0.2em]">
              <span className="font-black text-white">KNOUX </span>
              <span className="font-light text-cyan-400">REPAIR</span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="relative z-10 font-mono text-[10px] md:text-xs text-cyan-400/60 tracking-[0.4em] ml-[0.4em] mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Advanced System Diagnostics // V2.0
          </motion.p>

          {/* Loading Bar */}
          <motion.div
            className="relative z-10 w-72 md:w-96"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {/* Status text */}
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] text-cyan-400/70 animate-pulse">
                {STATUS_MESSAGES[statusIndex]}
              </span>
              <span className="font-mono text-[10px] text-cyan-400/50">
                {Math.min(Math.round(progress), 100)}%
              </span>
            </div>

            {/* Track */}
            <div className="h-[3px] w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  background: 'linear-gradient(90deg, #00e5ff, #448aff, #00e676)',
                  boxShadow: '0 0 12px rgba(0, 229, 255, 0.5), 0 0 30px rgba(0, 229, 255, 0.2)',
                }}
                transition={{ duration: 0.15 }}
              />
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {STATUS_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full transition-all duration-300 ${
                    i <= statusIndex
                      ? 'bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.6)]'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
