import { useState } from 'react';
import { Search, Bell, Settings, BrainCircuit, House, CloudCog, UserRound } from 'lucide-react';
import clsx from 'clsx';

export interface TopBarProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  accountLabel: string;
  accountConnected: boolean;
  homeActive: boolean;
  aiProviderState?: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  onHomeOpen: () => void;
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
  homeActive,
  aiProviderState = 'UNCONFIGURED',
  onHomeOpen,
  onSearchOpen,
  onSettingsOpen,
  onAccountOpen,
}: TopBarProps) {
  const isRtl = lang === 'ar';
  const [brandStage, setBrandStage] = useState<'wide' | 'legacy' | 'text'>('wide');
  return (
    <header className={clsx('knoux-topbar', homeActive && 'is-home')} style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="knoux-topbar-brand" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="knoux-brand knoux-brand-lockup" aria-label="KNOUX Repair">
          {brandStage === 'wide' ? (
            <img
              className="knoux-brand__img knoux-brand-lockup__wide"
              src="/brand/knoux-repair-wordmark-wide.png"
              alt="KNOUX Repair"
              draggable={false}
              onError={() => setBrandStage('legacy')}
            />
          ) : brandStage === 'legacy' ? (
            <img
              className="knoux-brand__img knoux-brand-lockup__wide"
              src="/brand/knoux-repair-logo.png"
              alt="KNOUX Repair"
              draggable={false}
              onError={() => setBrandStage('text')}
            />
          ) : (
            <span className="knoux-brand__text">
              <span className="text-white font-bold tracking-widest text-lg">KNOUX</span>
              <span className="text-[#A855F7] font-light text-lg">Repair</span>
            </span>
          )}
          <span className="knoux-brand__compact knoux-brand-lockup__compact" aria-hidden="true">K</span>
        </span>
      </div>

      <button
        type="button"
        className="knoux-topbar-home"
        data-nav-view="home"
        data-active={homeActive}
        aria-current={homeActive ? 'page' : undefined}
        aria-label={isRtl ? 'الرئيسية' : 'Home'}
        onClick={onHomeOpen}
      >
        <House size={18} />
        <span>{isRtl ? 'الرئيسية' : 'Home'}</span>
      </button>

      <div className="flex-1 flex justify-center items-center h-full px-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-full px-4 py-1.5 w-[420px] max-w-full text-xs text-gray-400 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label={isRtl ? 'البحث في الخدمات والأدوات...' : 'Search services, tools, issues, or get help...'}
        >
          <Search size={15} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
          <span className="flex-1 text-left rtl:text-right truncate">
            {isRtl ? 'البحث في الخدمات، والأدوات، والمشكلات، أو طلب المساعدة...' : 'Search services, tools, issues, or get help...'}
          </span>
          <div className="flex items-center gap-1 text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-gray-400">
            <span>Ctrl</span><span>+</span><span>K</span>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2.5 px-3 h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* AI State Badge (with knoux:ai-open event) */}
        <button
          type="button"
          className="knoux-mcp-topbar-trigger flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('knoux:ai-open'))}
          title={isRtl ? 'فتح KNOUX AI' : 'Open KNOUX AI'}
          aria-label={isRtl ? 'فتح KNOUX AI' : 'Open KNOUX AI'}
        >
          <BrainCircuit size={14} className={aiProviderState === 'CONFIGURED' ? 'text-violet-400' : 'text-slate-400'} />
          <span className="text-[11px] font-medium">{aiProviderState === 'CONFIGURED' ? (isRtl ? 'الذكاء مفعل' : 'AI On') : (isRtl ? 'الذكاء معطل' : 'AI Off')}</span>
          <i aria-hidden="true" className="hidden" />
        </button>

        {/* MCP trigger (preserving shell contract) */}
        <button
          type="button"
          className="knoux-mcp-topbar-trigger"
          style={{ display: 'none' }}
          onClick={() => window.dispatchEvent(new CustomEvent('knoux:mcp-open'))}
          title={isRtl ? 'اتصال MCP الخاص' : 'Private MCP connection'}
          aria-label={isRtl ? 'اتصال MCP الخاص' : 'Private MCP connection'}
        >
          <CloudCog size={15} /><span>MCP</span><i aria-hidden="true" />
        </button>

        {/* Runtime State Badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300"
          title={`Runtime: ${bridgeOnline === false ? 'Offline' : 'Ready'}${bridgeElevated ? ' (Admin)' : ''}`}
        >
          <div className={clsx('w-2 h-2 rounded-full', bridgeOnline !== false ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]' : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]')} />
          <span className="text-[11px] font-medium">{isRtl ? 'بيئة تشغيل محلية' : 'Runtime Local PC'}</span>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-visible:outline-none"
          aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
        >
          <Bell size={16} />
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsOpen}
          className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-visible:outline-none"
          title={isRtl ? 'الإعدادات' : 'Settings'}
          aria-label={isRtl ? 'الإعدادات' : 'Settings'}
        >
          <Settings size={16} />
        </button>

        {/* Account Trigger (preserving contract) */}
        <button
          type="button"
          className={clsx('knoux-account-trigger', accountConnected && 'is-connected')}
          style={{ display: 'none' }}
          onClick={onAccountOpen}
          title={isRtl ? 'الحساب والاتصالات' : 'Account & connections'}
          aria-label={isRtl ? 'الحساب والاتصالات' : 'Account & connections'}
        >
          <span><UserRound size={16} /></span><b>{accountLabel}</b>
        </button>

        {/* Desktop Window Controls */}
        <div className="flex items-center gap-1 ml-1 text-slate-400 font-mono text-xs">
          <button className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded" aria-label="Minimize">—</button>
          <button className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded text-[10px]" aria-label="Maximize">□</button>
          <button className="w-6 h-6 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 rounded text-xs" aria-label="Close">✕</button>
        </div>
      </div>
    </header>
  );
}
