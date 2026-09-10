import { Search, Bell, Shield, Wifi, WifiOff, Settings } from 'lucide-react';
import clsx from 'clsx';

export interface TopBarProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
}

export default function TopBar({
  lang,
  bridgeOnline,
  bridgeElevated,
  onSearchOpen,
  onSettingsOpen
}: TopBarProps) {
  const isRtl = lang === 'ar';
  
  return (
    <header className="knoux-topbar" style={{ height: '52px', WebkitAppRegion: 'drag' } as React.CSSProperties} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Left: Logo */}
      <div className="flex items-center gap-2 px-4 h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-white font-bold tracking-widest text-lg">KNOUX</span>
        <span className="text-[#22D3EE] font-light text-lg">Repair</span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button 
          onClick={onSearchOpen}
          className="flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-full px-4 py-1.5 w-80 max-w-full text-sm text-gray-400 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label={isRtl ? 'البحث عن الأدوات...' : 'Search tools...'}
        >
          <Search size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
          <span className="flex-1 text-left rtl:text-right">{isRtl ? 'البحث عن الأدوات...' : 'Search tools...'}</span>
          <div className="flex items-center gap-1 text-xs font-mono bg-black/30 px-1.5 py-0.5 rounded text-gray-500">
            <span>Ctrl</span><span>+</span><span>K</span>
          </div>
        </button>
      </div>

      {/* Right: Actions & Status */}
      <div className="flex items-center gap-3 px-4 h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2 text-xs font-medium">
          {bridgeElevated && (
            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
              <Shield size={12} />
              <span>{isRtl ? 'مسؤول' : 'Admin'}</span>
            </div>
          )}
          
          <div className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
            bridgeOnline === true
              ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" 
              : bridgeOnline === false
                ? "text-red-400 bg-red-400/10 border-red-400/20"
                : "text-amber-400 bg-amber-400/10 border-amber-400/20"
          )}>
            {bridgeOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>
              {bridgeOnline === true
                ? (isRtl ? 'متصل' : 'Online')
                : bridgeOnline === false
                  ? (isRtl ? 'غير متصل' : 'Offline')
                  : (isRtl ? 'جارٍ الاتصال...' : 'Connecting...')}
            </span>
          </div>
        </div>

        <button 
          onClick={onSettingsOpen}
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          title={isRtl ? 'الإعدادات' : 'Settings'}
          aria-label={isRtl ? 'الإعدادات' : 'Settings'}
        >
          <Settings size={18} />
        </button>

        <button 
          className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full border border-[#050714]" />
        </button>
      </div>
    </header>
  );
}
