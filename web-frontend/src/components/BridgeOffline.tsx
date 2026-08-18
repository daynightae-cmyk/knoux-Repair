import { motion } from 'framer-motion';
import { Unplug, RefreshCw } from 'lucide-react';
import type { Lang } from '../lib/i18n';
import { STRINGS } from '../lib/i18n';

interface BridgeOfflineProps {
  error: string;
  lang: Lang;
  onRetry: () => void;
}

export default function BridgeOffline({ error, lang, onRetry }: BridgeOfflineProps) {
  const t = STRINGS[lang];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center justify-center"
    >
      <div className="glass-panel rounded-2xl p-10 max-w-lg text-center border-amber-500/25">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 mb-6">
          <Unplug size={26} />
        </div>
        <h2 className="font-display text-xl font-bold tracking-wider text-white text-glow mb-3">
          {t.bridgeOfflineTitle}
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-4" dir="auto">
          {t.bridgeOfflineBody}
        </p>
        <p className="font-mono text-[10px] text-amber-300/70 tracking-wider mb-6">
          {error}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-xs font-semibold tracking-wider text-cyan-400 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 transition-all"
        >
          <RefreshCw size={13} />
          {t.bridgeOfflineRetry}
        </button>
      </div>
    </motion.div>
  );
}
