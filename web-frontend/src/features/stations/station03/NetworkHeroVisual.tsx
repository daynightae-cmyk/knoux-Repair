import React from 'react';
import type { Lang } from '../../../lib/i18n';
import type { ConnectionLayerId } from './networkModel';

interface NetworkHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'diagnosing' | 'connected' | 'degraded' | 'disconnected';
  activeLayer?: ConnectionLayerId | null;
  lossPercent?: number | null;
  avgMs?: number | null;
  className?: string;
}

export const NetworkHeroVisual: React.FC<NetworkHeroVisualProps> = ({
  lang,
  stage = 'idle',
  activeLayer = null,
  lossPercent = null,
  avgMs = null,
  className = '',
}) => {
  const isDiagnosing = stage === 'diagnosing';
  const isConnected = stage === 'connected';
  const isDegraded = stage === 'degraded';
  const isDisconnected = stage === 'disconnected';

  const accentColor = isDisconnected
    ? '#f87171'
    : isDegraded
    ? '#fbbf24'
    : isConnected
    ? '#34d399'
    : '#35c9da';

  return (
    <div
      className={`knoux-network-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'خريطة طبقات الشبكة ورادار الاتصال - KNOUX Network Topology Radar'
          : 'KNOUX Network Topology and Layer Radar Vector Illustration'
      }
    >
      <svg
        className="knoux-network-hero-svg"
        viewBox="0 0 620 310"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Ambient Core Aura */}
          <radialGradient id="netAuraGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity={isDiagnosing ? 0.32 : isConnected ? 0.26 : 0.15} />
            <stop offset="65%" stopColor="#083344" stopOpacity={isDiagnosing ? 0.14 : 0.06} />
            <stop offset="100%" stopColor="#030c17" stopOpacity="0" />
          </radialGradient>

          {/* Radar Sweep Gradient */}
          <linearGradient id="netRadarBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#35c9da" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#030c17" stopOpacity="0" />
          </linearGradient>

          {/* Node Glass Surfaces */}
          <linearGradient id="netGlassNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.14)" />
            <stop offset="100%" stopColor="rgba(10, 26, 42, 0.82)" />
          </linearGradient>

          {/* Active Node Highlight */}
          <linearGradient id="netActiveNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(53, 201, 218, 0.35)" />
            <stop offset="100%" stopColor="rgba(8, 47, 73, 0.9)" />
          </linearGradient>

          {/* Node Border Glow */}
          <linearGradient id="netBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(125, 232, 255, 0.6)" />
            <stop offset="50%" stopColor="rgba(53, 201, 218, 0.25)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
          </linearGradient>

          {/* Glow Filter */}
          <filter id="netGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background Radar Ambient Aura ── */}
        <circle cx="310" cy="155" r="145" fill="url(#netAuraGlow)" />

        {/* ── Concentric Radar Grid Rings ── */}
        <circle cx="310" cy="155" r="50" stroke="rgba(53, 201, 218, 0.18)" strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="310" cy="155" r="95" stroke="rgba(53, 201, 218, 0.14)" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="310" cy="155" r="140" stroke="rgba(53, 201, 218, 0.11)" strokeWidth="1" />
        <circle cx="310" cy="155" r="185" stroke="rgba(53, 201, 218, 0.07)" strokeWidth="1" strokeDasharray="2 8" />

        {/* Radar Crosshairs */}
        <line x1="125" y1="155" x2="495" y2="155" stroke="rgba(53, 201, 218, 0.1)" strokeWidth="1" strokeDasharray="5 7" />
        <line x1="310" y1="15" x2="310" y2="295" stroke="rgba(53, 201, 218, 0.1)" strokeWidth="1" strokeDasharray="5 7" />

        {/* Radar Rotating Sweep Sector (Animated in diagnosing mode) */}
        {isDiagnosing && (
          <g className="net-radar-sweep-anim" transform-origin="310 155">
            <path
              d="M 310 155 L 450 155 A 140 140 0 0 0 409 56 Z"
              fill="url(#netRadarBeam)"
            />
            <line x1="310" y1="155" x2="450" y2="155" stroke="#35c9da" strokeWidth="1.5" filter="url(#netGlowFilter)" />
          </g>
        )}

        {/* Oscilloscope Waveform at the Bottom */}
        <g opacity="0.45">
          <path
            d="M 60 280 L 140 280 L 160 270 L 175 290 L 190 274 L 205 284 L 220 280 L 390 280 L 405 268 L 420 292 L 435 272 L 450 285 L 465 280 L 560 280"
            stroke="rgba(53, 201, 218, 0.35)"
            strokeWidth="1.2"
            fill="none"
          />
        </g>

        {/* ── Bus Conduit Traces (From Center to Satellites) ── */}
        {/* Trace 1: Center to Adapter (Top-Left) */}
        <path
          d="M 310 155 L 230 155 L 140 95"
          stroke={activeLayer === 'adapter' ? '#35c9da' : 'rgba(53, 201, 218, 0.22)'}
          strokeWidth={activeLayer === 'adapter' ? '2.2' : '1.2'}
          strokeDasharray={isDiagnosing ? '4 4' : 'none'}
          className={isDiagnosing ? 'net-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 2: Center to IP Config (Bottom-Left) */}
        <path
          d="M 310 155 L 220 155 L 140 220"
          stroke={activeLayer === 'ip' ? '#35c9da' : 'rgba(53, 201, 218, 0.22)'}
          strokeWidth={activeLayer === 'ip' ? '2.2' : '1.2'}
          strokeDasharray={isDiagnosing ? '4 4' : 'none'}
          className={isDiagnosing ? 'net-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 3: Center to Gateway (Top-Center) */}
        <path
          d="M 310 155 L 310 65"
          stroke={activeLayer === 'gateway' ? '#35c9da' : 'rgba(53, 201, 218, 0.22)'}
          strokeWidth={activeLayer === 'gateway' ? '2.2' : '1.2'}
          strokeDasharray={isDiagnosing ? '4 4' : 'none'}
          className={isDiagnosing ? 'net-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 4: Center to DNS (Top-Right) */}
        <path
          d="M 310 155 L 390 155 L 480 95"
          stroke={activeLayer === 'dns' ? '#35c9da' : 'rgba(53, 201, 218, 0.22)'}
          strokeWidth={activeLayer === 'dns' ? '2.2' : '1.2'}
          strokeDasharray={isDiagnosing ? '4 4' : 'none'}
          className={isDiagnosing ? 'net-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 5: Center to Internet (Bottom-Right) */}
        <path
          d="M 310 155 L 400 155 L 480 220"
          stroke={activeLayer === 'internet' ? '#35c9da' : 'rgba(53, 201, 218, 0.22)'}
          strokeWidth={activeLayer === 'internet' ? '2.2' : '1.2'}
          strokeDasharray={isDiagnosing ? '4 4' : 'none'}
          className={isDiagnosing ? 'net-trace-flow' : ''}
          fill="none"
        />

        {/* ── Satellite Nodes ── */}

        {/* Node 1: Physical Adapter (140, 95) */}
        <g transform="translate(140, 95)" className="net-satellite-node">
          <circle
            r="28"
            fill={activeLayer === 'adapter' ? 'url(#netActiveNode)' : 'url(#netGlassNode)'}
            stroke={activeLayer === 'adapter' ? '#35c9da' : 'url(#netBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* Wi-Fi / NIC Waves Icon */}
          <path
            d="M -10 -4 A 14 14 0 0 1 10 -4 M -6 0 A 9 9 0 0 1 6 0 M -2 4 A 3 3 0 0 1 2 4"
            stroke="#7dd3fc"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="0" cy="7" r="1.5" fill="#38bdf8" />
          {/* Label Pill */}
          <rect x="-56" y="32" width="112" height="18" rx="9" fill="rgba(6, 18, 30, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          <text x="0" y="44" textAnchor="middle" fill="#cce9f5" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'محول الشبكة' : 'Physical Adapter'}
          </text>
        </g>

        {/* Node 2: IP & DHCP Config (140, 220) */}
        <g transform="translate(140, 220)" className="net-satellite-node">
          <circle
            r="28"
            fill={activeLayer === 'ip' ? 'url(#netActiveNode)' : 'url(#netGlassNode)'}
            stroke={activeLayer === 'ip' ? '#35c9da' : 'url(#netBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* Subnet Matrix Icon */}
          <rect x="-8" y="-8" width="6" height="6" rx="1.5" fill="#38bdf8" />
          <rect x="2" y="-8" width="6" height="6" rx="1.5" fill="rgba(56, 189, 248, 0.5)" />
          <rect x="-8" y="2" width="6" height="6" rx="1.5" fill="rgba(56, 189, 248, 0.5)" />
          <rect x="2" y="2" width="6" height="6" rx="1.5" fill="#38bdf8" />
          {/* Label Pill */}
          <rect x="-50" y="32" width="100" height="18" rx="9" fill="rgba(6, 18, 30, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          <text x="0" y="44" textAnchor="middle" fill="#cce9f5" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'إعداد IP و DHCP' : 'IP & DHCP'}
          </text>
        </g>

        {/* Node 3: Default Gateway (310, 50) */}
        <g transform="translate(310, 50)" className="net-satellite-node">
          <circle
            r="28"
            fill={activeLayer === 'gateway' ? 'url(#netActiveNode)' : 'url(#netGlassNode)'}
            stroke={activeLayer === 'gateway' ? '#35c9da' : 'url(#netBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* Router Gateway Icon */}
          <rect x="-10" y="-5" width="20" height="10" rx="3" fill="none" stroke="#7dd3fc" strokeWidth="1.4" />
          <circle cx="-5" cy="0" r="1.5" fill="#34d399" />
          <circle cx="0" cy="0" r="1.5" fill="#38bdf8" />
          <circle cx="5" cy="0" r="1.5" fill="#38bdf8" />
          <line x1="-6" y1="-5" x2="-6" y2="-9" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="-5" x2="6" y2="-9" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
          {/* Label Pill */}
          <rect x="-54" y="-30" width="108" height="18" rx="9" fill="rgba(6, 18, 30, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          <text x="0" y="-18" textAnchor="middle" fill="#cce9f5" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'البوابة الافتراضية' : 'Default Gateway'}
          </text>
        </g>

        {/* Node 4: DNS Resolver (480, 95) */}
        <g transform="translate(480, 95)" className="net-satellite-node">
          <circle
            r="28"
            fill={activeLayer === 'dns' ? 'url(#netActiveNode)' : 'url(#netGlassNode)'}
            stroke={activeLayer === 'dns' ? '#35c9da' : 'url(#netBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* DNS Lookup Hierarchy Tree Icon */}
          <circle cx="0" cy="-6" r="3" fill="#38bdf8" />
          <line x1="0" y1="-3" x2="-6" y2="4" stroke="#7dd3fc" strokeWidth="1.2" />
          <line x1="0" y1="-3" x2="6" y2="4" stroke="#7dd3fc" strokeWidth="1.2" />
          <circle cx="-6" cy="6" r="2.5" fill="#7dd3fc" />
          <circle cx="6" cy="6" r="2.5" fill="#7dd3fc" />
          {/* Label Pill */}
          <rect x="-52" y="32" width="104" height="18" rx="9" fill="rgba(6, 18, 30, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          <text x="0" y="44" textAnchor="middle" fill="#cce9f5" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'حل أسماء DNS' : 'DNS Resolver'}
          </text>
        </g>

        {/* Node 5: WAN / Internet Cloud (480, 220) */}
        <g transform="translate(480, 220)" className="net-satellite-node">
          <circle
            r="28"
            fill={activeLayer === 'internet' ? 'url(#netActiveNode)' : 'url(#netGlassNode)'}
            stroke={activeLayer === 'internet' ? '#35c9da' : 'url(#netBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* WAN Globe / Cloud Icon */}
          <circle cx="0" cy="0" r="10" stroke="#7dd3fc" strokeWidth="1.4" fill="none" />
          <ellipse cx="0" cy="0" rx="4.5" ry="10" stroke="#38bdf8" strokeWidth="1.1" fill="none" />
          <line x1="-10" y1="0" x2="10" y2="0" stroke="#38bdf8" strokeWidth="1.1" />
          {/* Label Pill */}
          <rect x="-50" y="32" width="100" height="18" rx="9" fill="rgba(6, 18, 30, 0.88)" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.8" />
          <text x="0" y="44" textAnchor="middle" fill="#cce9f5" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'الإنترنت / WAN' : 'Internet / WAN'}
          </text>
        </g>

        {/* ── Central Network Authority Core (310, 155) ── */}
        <g transform="translate(310, 155)">
          {/* Outer Glass Hexagon Ring */}
          <polygon
            points="0,-48 42,-24 42,24 0,48 -42,24 -42,-24"
            fill="rgba(10, 26, 44, 0.85)"
            stroke="url(#netBorderGrad)"
            strokeWidth="1.5"
            filter="url(#netGlowFilter)"
          />

          {/* Inner Titanium Ring */}
          <circle
            r="32"
            fill="rgba(4, 15, 28, 0.94)"
            stroke="rgba(53, 201, 218, 0.4)"
            strokeWidth="1.2"
          />

          {/* Central Topology Hub Insignia */}
          <g transform="translate(-14, -14)">
            <rect
              width="28"
              height="28"
              rx="7"
              fill="rgba(53, 201, 218, 0.15)"
              stroke="rgba(53, 201, 218, 0.5)"
              strokeWidth="1"
            />
            {/* 4 Interconnected Nodes */}
            <circle cx="8" cy="8" r="2.5" fill="#35c9da" />
            <circle cx="20" cy="8" r="2.5" fill="#38bdf8" />
            <circle cx="8" cy="20" r="2.5" fill="#38bdf8" />
            <circle cx="20" cy="20" r="2.5" fill="#34d399" />
            <line x1="8" y1="8" x2="20" y2="8" stroke="rgba(53, 201, 218, 0.7)" strokeWidth="1" />
            <line x1="8" y1="8" x2="8" y2="20" stroke="rgba(53, 201, 218, 0.7)" strokeWidth="1" />
            <line x1="20" y1="8" x2="20" y2="20" stroke="rgba(53, 201, 218, 0.7)" strokeWidth="1" />
            <line x1="8" y1="20" x2="20" y2="20" stroke="rgba(53, 201, 218, 0.7)" strokeWidth="1" />
          </g>

          {/* Dynamic Core Text Badge */}
          <text
            x="0"
            y="26"
            textAnchor="middle"
            fill="#7dd3fc"
            fontSize="6"
            fontWeight="700"
            letterSpacing="0.08em"
            fontFamily="monospace"
          >
            {isDiagnosing
              ? (lang === 'ar' ? 'فحص المسار...' : 'DIAGNOSING PATH...')
              : isConnected
              ? (lang === 'ar' ? 'المسار متصل' : 'LINK VERIFIED')
              : isDegraded
              ? (lang === 'ar' ? 'تدهور في المسار' : 'LINK DEGRADED')
              : isDisconnected
              ? (lang === 'ar' ? 'المسار مقطوع' : 'LINK UNREACHABLE')
              : (lang === 'ar' ? 'نواة تشخيص الشبكة' : 'NETWORK RADAR')}
          </text>
        </g>

        {/* ── Telemetry HUD Badges ── */}
        {/* Top-Left: Measured Signal Capsule */}
        <g transform="translate(30, 20)">
          <rect width="135" height="24" rx="6" fill="rgba(8, 20, 34, 0.85)" stroke="rgba(53, 201, 218, 0.2)" strokeWidth="0.8" />
          <circle cx="12" cy="12" r="3.5" fill={lossPercent === 0 ? '#34d399' : lossPercent !== null ? '#fbbf24' : '#35c9da'} />
          <text x="24" y="15" fill="#a5f3fc" fontSize="7.5" fontWeight="600" fontFamily="monospace">
            {avgMs !== null
              ? `LATENCY ${avgMs}ms`
              : (lang === 'ar' ? 'جاهز للفحص' : 'PROBE READY')}
          </text>
          {lossPercent !== null && (
            <text x="95" y="15" fill="#fed7aa" fontSize="7.5" fontWeight="600" fontFamily="monospace">
              {`LOSS ${lossPercent}%`}
            </text>
          )}
        </g>

        {/* Top-Right: Layer Architecture Capsule */}
        <g transform="translate(465, 20)">
          <rect width="125" height="24" rx="6" fill="rgba(8, 20, 34, 0.85)" stroke="rgba(53, 201, 218, 0.2)" strokeWidth="0.8" />
          <text x="15" y="15" fill="#7dd3fc" fontSize="7.5" fontWeight="600" fontFamily="monospace">
            {lang === 'ar' ? '٥ طبقات تشخيص' : '5 LAYER AUDIT'}
          </text>
        </g>
      </svg>
    </div>
  );
};

export default NetworkHeroVisual;
