import { Menu, Bell } from 'lucide-react';

interface TopBarProps {
  onMenuToggle: () => void;
  title: string;
}

export default function TopBar({ onMenuToggle, title }: TopBarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.04] relative z-20 shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-900/5 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 relative z-10">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-cyan-400 hover:text-cyan-300 transition-colors p-1"
        >
          <Menu size={18} />
        </button>
        <h2 className="font-mono text-xs tracking-[0.15em] text-white/70 uppercase">{title}</h2>
      </div>
      <div className="flex items-center gap-3 relative z-10">
        <button className="relative text-white/30 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/[0.03]">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyan-400 rounded-full" style={{ boxShadow: '0 0 6px rgba(0,229,255,0.6)' }} />
        </button>
      </div>
    </header>
  );
}
