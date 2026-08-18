import { motion } from 'framer-motion';
import { FileText, Archive, Database, Settings, Info, MonitorDown } from 'lucide-react';
import type { ActiveSection } from '../types';
import type { Lang } from '../lib/i18n';
import { STRINGS } from '../lib/i18n';

interface PlaceholderPageProps {
  section: ActiveSection;
  lang: Lang;
}

const PAGE_CONFIG: Record<string, { icon: React.ElementType; title: string }> = {
  reports: { icon: FileText, title: 'REPORTS' },
  quarantine: { icon: Archive, title: 'QUARANTINE' },
  backups: { icon: Database, title: 'BACKUPS' },
  settings: { icon: Settings, title: 'SETTINGS' },
  about: { icon: Info, title: 'ABOUT' },
};

export default function PlaceholderPage({ section, lang }: PlaceholderPageProps) {
  const t = STRINGS[lang];
  const config = PAGE_CONFIG[section] || { icon: Info, title: section.toUpperCase() };
  const Icon = config.icon;

  return (
    <motion.div
      key={section}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex items-center justify-center"
    >
      <div className="glass-panel rounded-2xl p-12 max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-panel-light neon-glow mb-6 text-cyan-400">
          <Icon size={32} />
        </div>
        <h2 className="font-display text-xl font-bold tracking-wider text-white text-glow mb-2">
          {config.title}
        </h2>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 font-mono text-[9px] tracking-widest mb-6">
          <MonitorDown size={10} />
          {t.desktopOnlyTitle}
        </div>
        <p className="text-sm text-slate-400 leading-relaxed" dir="auto">
          {t.desktopOnlyBody}
        </p>
      </div>
    </motion.div>
  );
}
