import { motion } from 'framer-motion';
import { FileText, Archive, Database, Settings, Info, Shield, HardDrive, LayoutDashboard } from 'lucide-react';
import type { ActiveSection } from '../types';

interface PlaceholderPageProps {
  section: ActiveSection;
}

const PAGE_CONFIG: Record<ActiveSection, { title: string; subtitle: string; icon: React.ReactNode; desc: string }> = {
  dashboard: { title: 'DASHBOARD', subtitle: 'SYS.OVERVIEW // NEXUS CORE', icon: <LayoutDashboard size={32} />, desc: 'Welcome to KNOUX REPAIR NEXUS. Select a module from the navigation to begin system diagnostics and repair.' },
  reports: { title: 'REPORTS', subtitle: 'SYS.REPORTS // TELEMETRY ARCHIVE', icon: <FileText size={32} />, desc: 'System diagnostic reports and execution logs are stored here. Run tools to generate reports.' },
  quarantine: { title: 'QUARANTINE', subtitle: 'SYS.QUARANTINE // ISOLATION VAULT', icon: <Archive size={32} />, desc: 'Modified system files are quarantined before any repair operation. Restore or purge from here.' },
  backups: { title: 'BACKUPS', subtitle: 'SYS.BACKUP // SNAPSHOT REPOSITORY', icon: <Database size={32} />, desc: 'System state backups created before destructive operations. Restore points managed here.' },
  settings: { title: 'SETTINGS', subtitle: 'SYS.CONFIG // CORE PARAMETERS', icon: <Settings size={32} />, desc: 'Configure NEXUS CORE behavior, language preferences, and safety policies.' },
  about: { title: 'ABOUT', subtitle: 'SYS.INFO // NEXUS CORE v2.0', icon: <Info size={32} />, desc: 'KNOUX REPAIR — Advanced System Diagnostics & Repair Toolkit. Built with precision.' },
  maintenance: { title: 'MAINTENANCE', subtitle: '', icon: null, desc: '' },
  cleanup: { title: 'CLEANUP', subtitle: '', icon: null, desc: '' },
  network: { title: 'NETWORK', subtitle: '', icon: null, desc: '' },
  programs: { title: 'PROGRAMS', subtitle: '', icon: null, desc: '' },
  duplicates: { title: 'DUPLICATES', subtitle: '', icon: null, desc: '' },
  disk: { title: 'DISK', subtitle: '', icon: null, desc: '' },
  services: { title: 'SERVICES', subtitle: '', icon: null, desc: '' },
  performance: { title: 'PERFORMANCE', subtitle: '', icon: null, desc: '' },
  security: { title: 'SECURITY', subtitle: '', icon: null, desc: '' },
  diagnostics: { title: 'DIAGNOSTICS', subtitle: '', icon: null, desc: '' },
};

export default function PlaceholderPage({ section }: PlaceholderPageProps) {
  const config = PAGE_CONFIG[section];

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
          {config.icon}
        </div>
        <h2 className="font-display text-xl font-bold tracking-wider text-white text-glow mb-2">
          {config.title}
        </h2>
        <p className="font-mono text-[9px] text-cyan-400/40 tracking-[0.3em] mb-6">
          {config.subtitle}
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          {config.desc}
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-[9px] font-mono text-white/15">
            <Shield size={10} /> SAFETY: ENFORCED
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-white/15">
            <HardDrive size={10} /> STATUS: ONLINE
          </div>
        </div>
      </div>
    </motion.div>
  );
}
