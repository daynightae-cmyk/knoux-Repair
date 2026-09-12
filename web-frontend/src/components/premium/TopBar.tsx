import { Search, Bell, Shield, Wifi, WifiOff, Settings, UserRound, CloudCog } from 'lucide-react';
import clsx from 'clsx';

export interface TopBarProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  accountLabel: string;
  accountConnected: boolean;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
  onAccountOpen: () => void;
}

export default function TopBar({
  lang,
  bridgeOnline,
  bridgeElevated,
  accountLabel,
  accountConnected,
  onSearchOpen,
  onSettingsOpen,
  onAccountOpen,
}: TopBarProps) {
  const isRtl = lang === 'ar';
  return (
    <header className="knoux-topbar" style={{ height: '52px', WebkitAppRegion: 'drag' } as React.CSSProperties} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 px-4 h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-white font-bold tracking-widest text-lg">KNOUX</span>
        <span className="text-[#A855F7] font-light text-lg">Repair</span>
      </div>

      <div className="flex-1 flex justify-center items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={onSearchOpen} className="flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-full px-4 py-1.5 w-80 max-w-full text-sm text-gray-400 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" aria-label={isRtl ? 'البحث عن الأدوات...' : 'Search tools...'}>
          <Search size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
          <span className="flex-1 text-left rtl:text-right">{isRtl ? 'البحث عن الأدوات...' : 'Search tools...'}</span>
          <div className="flex items-center gap-1 text-xs font-mono bg-black/30 px-1.5 py-0.5 rounded text-gray-500"><span>Ctrl</span><span>+</span><span>K</span></div>
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2 text-xs font-medium">
          {bridgeElevated && <div className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full"><Shield size={12}/><span>{isRtl ? 'مسؤول' : 'Admin'}</span></div>}
          <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full border', bridgeOnline === true ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : bridgeOnline === false ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-amber-400 bg-amber-400/10 border-amber-400/20')}>
            {bridgeOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}<span>{bridgeOnline === true ? (isRtl ? 'متصل' : 'Online') : bridgeOnline === false ? (isRtl ? 'غير متصل' : 'Offline') : (isRtl ? 'جارٍ الاتصال...' : 'Connecting...')}</span>
          </div>
        </div>

        <button type="button" className="knoux-mcp-topbar-trigger" onClick={() => window.dispatchEvent(new CustomEvent('knoux:mcp-open'))} title={isRtl ? 'اتصال MCP الخاص' : 'Private MCP connection'} aria-label={isRtl ? 'اتصال MCP الخاص' : 'Private MCP connection'}>
          <CloudCog size={15}/><span>MCP</span><i aria-hidden="true"/>
        </button>

        <button type="button" className={clsx('knoux-account-trigger', accountConnected && 'is-connected')} onClick={onAccountOpen} title={isRtl ? 'الحساب والاتصالات' : 'Account & connections'} aria-label={isRtl ? 'الحساب والاتصالات' : 'Account & connections'}>
          <span><UserRound size={16}/></span><b>{accountLabel}</b>
        </button>

        <button onClick={onSettingsOpen} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" title={isRtl ? 'الإعدادات' : 'Settings'} aria-label={isRtl ? 'الإعدادات' : 'Settings'}><Settings size={18}/></button>
        <button className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" aria-label={isRtl ? 'الإشعارات' : 'Notifications'}><Bell size={18}/></button>
      </div>
    </header>
  );
}
