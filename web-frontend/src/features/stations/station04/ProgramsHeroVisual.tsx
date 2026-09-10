import React from 'react';
import type { Lang } from '../../../lib/i18n';

interface ProgramsHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'scanning' | 'healthy' | 'review';
  activeDomain?: 'inventory' | 'startup' | 'residuals' | 'features' | null;
  appCount?: number | null;
  startupCount?: number | null;
  className?: string;
}

export const ProgramsHeroVisual: React.FC<ProgramsHeroVisualProps> = ({
  lang,
  stage = 'idle',
  activeDomain = null,
  appCount = null,
  startupCount = null,
  className = '',
}) => {
  const isScanning = stage === 'scanning';
  const isHealthy = stage === 'healthy';

  const accentColor = isScanning
    ? '#38bdf8'
    : isHealthy
    ? '#34d399'
    : '#f97316';

  return (
    <div
      className={`knoux-programs-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'نواة إدارة البرامج والتطبيقات - KNOUX Application Studio Core'
          : 'KNOUX Application Management and Software Studio Vector Illustration'
      }
    >
      <svg
        className="knoux-programs-hero-svg"
        viewBox="0 0 620 310"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Ambient Core Aura */}
          <radialGradient id="progAuraGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity={isScanning ? 0.35 : 0.2} />
            <stop offset="65%" stopColor="#431407" stopOpacity={isScanning ? 0.15 : 0.06} />
            <stop offset="100%" stopColor="#030c17" stopOpacity="0" />
          </radialGradient>

          {/* Node Glass Surfaces */}
          <linearGradient id="progGlassNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.14)" />
            <stop offset="100%" stopColor="rgba(20, 14, 28, 0.85)" />
          </linearGradient>

          {/* Active Node Gradient */}
          <linearGradient id="progActiveNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(249, 115, 22, 0.4)" />
            <stop offset="100%" stopColor="rgba(67, 20, 7, 0.9)" />
          </linearGradient>

          {/* Border Gradient */}
          <linearGradient id="progBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(254, 215, 170, 0.6)" />
            <stop offset="50%" stopColor="rgba(249, 115, 22, 0.3)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
          </linearGradient>

          {/* Isometric Cube Gradients */}
          <linearGradient id="cubeTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(251, 146, 60, 0.85)" />
            <stop offset="100%" stopColor="rgba(234, 88, 12, 0.65)" />
          </linearGradient>
          <linearGradient id="cubeLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(194, 65, 12, 0.85)" />
            <stop offset="100%" stopColor="rgba(124, 45, 18, 0.95)" />
          </linearGradient>
          <linearGradient id="cubeRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(249, 115, 22, 0.75)" />
            <stop offset="100%" stopColor="rgba(154, 52, 18, 0.9)" />
          </linearGradient>

          {/* Glow Filter */}
          <filter id="progGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background Ambient Aura ── */}
        <circle cx="310" cy="155" r="145" fill="url(#progAuraGlow)" />

        {/* ── Concentric Orbit Shells ── */}
        <ellipse cx="310" cy="155" rx="220" ry="105" stroke="rgba(249, 115, 22, 0.14)" strokeWidth="1.2" strokeDasharray="5 7" />
        <ellipse cx="310" cy="155" rx="160" ry="75" stroke="rgba(249, 115, 22, 0.18)" strokeWidth="1.2" strokeDasharray="3 5" />
        <circle cx="310" cy="155" r="70" stroke="rgba(249, 115, 22, 0.22)" strokeWidth="1" strokeDasharray="2 4" />

        {/* ── Bus Conduit Traces (Center to 4 Domains) ── */}
        {/* Trace 1: Center to Installed Apps (Top-Left) */}
        <path
          d="M 310 155 L 220 155 L 140 85"
          stroke={activeDomain === 'inventory' ? '#f97316' : 'rgba(249, 115, 22, 0.25)'}
          strokeWidth={activeDomain === 'inventory' ? '2.4' : '1.3'}
          strokeDasharray={isScanning ? '4 4' : 'none'}
          className={isScanning ? 'prog-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 2: Center to Startup Programs (Bottom-Left) */}
        <path
          d="M 310 155 L 220 155 L 140 225"
          stroke={activeDomain === 'startup' ? '#f97316' : 'rgba(249, 115, 22, 0.25)'}
          strokeWidth={activeDomain === 'startup' ? '2.4' : '1.3'}
          strokeDasharray={isScanning ? '4 4' : 'none'}
          className={isScanning ? 'prog-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 3: Center to Residuals & Cache (Top-Right) */}
        <path
          d="M 310 155 L 400 155 L 480 85"
          stroke={activeDomain === 'residuals' ? '#f97316' : 'rgba(249, 115, 22, 0.25)'}
          strokeWidth={activeDomain === 'residuals' ? '2.4' : '1.3'}
          strokeDasharray={isScanning ? '4 4' : 'none'}
          className={isScanning ? 'prog-trace-flow' : ''}
          fill="none"
        />

        {/* Trace 4: Center to Windows Features (Bottom-Right) */}
        <path
          d="M 310 155 L 400 155 L 480 225"
          stroke={activeDomain === 'features' ? '#f97316' : 'rgba(249, 115, 22, 0.25)'}
          strokeWidth={activeDomain === 'features' ? '2.4' : '1.3'}
          strokeDasharray={isScanning ? '4 4' : 'none'}
          className={isScanning ? 'prog-trace-flow' : ''}
          fill="none"
        />

        {/* ── Satellite 1: Installed Apps (Top-Left: 140, 85) ── */}
        <g transform="translate(140, 85)" className="prog-satellite-node">
          <circle
            r="30"
            fill={activeDomain === 'inventory' ? 'url(#progActiveNode)' : 'url(#progGlassNode)'}
            stroke={activeDomain === 'inventory' ? '#f97316' : 'url(#progBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* App Windows Grid Icon */}
          <rect x="-10" y="-10" width="9" height="9" rx="2" fill="#fb923c" />
          <rect x="1" y="-10" width="9" height="9" rx="2" fill="rgba(251, 146, 60, 0.6)" />
          <rect x="-10" y="1" width="9" height="9" rx="2" fill="rgba(251, 146, 60, 0.6)" />
          <rect x="1" y="1" width="9" height="9" rx="2" fill="#fed7aa" />
          {/* Label Badge */}
          <rect x="-56" y="34" width="112" height="18" rx="9" fill="rgba(20, 10, 5, 0.88)" stroke="rgba(249, 115, 22, 0.25)" strokeWidth="0.8" />
          <text x="0" y="46" textAnchor="middle" fill="#fed7aa" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'التطبيقات المثبتة' : 'Installed Apps'}
          </text>
        </g>

        {/* ── Satellite 2: Startup Programs (Bottom-Left: 140, 225) ── */}
        <g transform="translate(140, 225)" className="prog-satellite-node">
          <circle
            r="30"
            fill={activeDomain === 'startup' ? 'url(#progActiveNode)' : 'url(#progGlassNode)'}
            stroke={activeDomain === 'startup' ? '#f97316' : 'url(#progBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* Rocket Auto-start Icon */}
          <path
            d="M -5 7 L 0 -11 L 5 7 L 0 4 Z"
            fill="#fb923c"
          />
          <circle cx="0" cy="-2" r="2.5" fill="#fff" />
          <path d="M -8 8 Q -10 11 -8 13" stroke="#fed7aa" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M 8 8 Q 10 11 8 13" stroke="#fed7aa" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          {/* Label Badge */}
          <rect x="-54" y="34" width="108" height="18" rx="9" fill="rgba(20, 10, 5, 0.88)" stroke="rgba(249, 115, 22, 0.25)" strokeWidth="0.8" />
          <text x="0" y="46" textAnchor="middle" fill="#fed7aa" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'برامج بدء التشغيل' : 'Startup Programs'}
          </text>
        </g>

        {/* ── Satellite 3: Residuals & Cache (Top-Right: 480, 85) ── */}
        <g transform="translate(480, 85)" className="prog-satellite-node">
          <circle
            r="30"
            fill={activeDomain === 'residuals' ? 'url(#progActiveNode)' : 'url(#progGlassNode)'}
            stroke={activeDomain === 'residuals' ? '#f97316' : 'url(#progBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* Residual Broom / Shield Icon */}
          <path
            d="M -7 -8 L 7 -8 L 5 8 L -5 8 Z"
            fill="none"
            stroke="#fb923c"
            strokeWidth="1.4"
          />
          <line x1="-3" y1="-4" x2="-3" y2="4" stroke="#fed7aa" strokeWidth="1" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#fed7aa" strokeWidth="1" />
          <line x1="3" y1="-4" x2="3" y2="4" stroke="#fed7aa" strokeWidth="1" />
          {/* Label Badge */}
          <rect x="-52" y="34" width="104" height="18" rx="9" fill="rgba(20, 10, 5, 0.88)" stroke="rgba(249, 115, 22, 0.25)" strokeWidth="0.8" />
          <text x="0" y="46" textAnchor="middle" fill="#fed7aa" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'الكاش والبقايا' : 'Cache & Residuals'}
          </text>
        </g>

        {/* ── Satellite 4: Windows Features (Bottom-Right: 480, 225) ── */}
        <g transform="translate(480, 225)" className="prog-satellite-node">
          <circle
            r="30"
            fill={activeDomain === 'features' ? 'url(#progActiveNode)' : 'url(#progGlassNode)'}
            stroke={activeDomain === 'features' ? '#f97316' : 'url(#progBorderGrad)'}
            strokeWidth="1.4"
          />
          {/* Layers / Package Gear Icon */}
          <polygon points="0,-10 10,-4 10,6 0,12 -10,6 -10,-4" fill="none" stroke="#fb923c" strokeWidth="1.3" />
          <circle cx="0" cy="1" r="3" fill="#fed7aa" />
          {/* Label Badge */}
          <rect x="-50" y="34" width="100" height="18" rx="9" fill="rgba(20, 10, 5, 0.88)" stroke="rgba(249, 115, 22, 0.25)" strokeWidth="0.8" />
          <text x="0" y="46" textAnchor="middle" fill="#fed7aa" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'ميزات ويندوز' : 'OS Features'}
          </text>
        </g>

        {/* ── Central Application Studio Core (310, 155) ── */}
        <g transform="translate(310, 155)">
          {/* Outer Glass Shield */}
          <polygon
            points="0,-48 44,-24 44,24 0,48 -44,24 -44,-24"
            fill="rgba(24, 14, 10, 0.9)"
            stroke="url(#progBorderGrad)"
            strokeWidth="1.5"
            filter="url(#progGlowFilter)"
          />

          {/* Isometric Software Package Cube */}
          <g transform="translate(0, -6)">
            {/* Top Face */}
            <polygon points="0,-20 18,-10 0,0 -18,-10" fill="url(#cubeTop)" />
            {/* Left Face */}
            <polygon points="-18,-10 0,0 0,20 -18,10" fill="url(#cubeLeft)" />
            {/* Right Face */}
            <polygon points="0,0 18,-10 18,10 0,20" fill="url(#cubeRight)" />
            {/* Seam Lines */}
            <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="0.8" />
            <line x1="0" y1="0" x2="-18" y2="-10" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="0.8" />
            <line x1="0" y1="0" x2="18" y2="-10" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="0.8" />
          </g>

          {/* Dynamic Core Text Badge */}
          <text
            x="0"
            y="30"
            textAnchor="middle"
            fill="#fed7aa"
            fontSize="6"
            fontWeight="700"
            letterSpacing="0.08em"
            fontFamily="monospace"
          >
            {isScanning
              ? (lang === 'ar' ? 'فحص التطبيقات...' : 'SCANNING SOFTWARE...')
              : isHealthy
              ? (lang === 'ar' ? 'البرامج سليمة' : 'SOFTWARE READY')
              : (lang === 'ar' ? 'استوديو البرامج' : 'PROGRAMS STUDIO')}
          </text>
        </g>

        {/* ── Telemetry HUD Badges ── */}
        {/* Top-Left: App Count HUD */}
        <g transform="translate(30, 20)">
          <rect width="135" height="24" rx="6" fill="rgba(20, 10, 5, 0.85)" stroke="rgba(249, 115, 22, 0.22)" strokeWidth="0.8" />
          <circle cx="12" cy="12" r="3.5" fill="#f97316" />
          <text x="24" y="15" fill="#fed7aa" fontSize="7.5" fontWeight="600" fontFamily="monospace">
            {appCount !== null
              ? `${appCount} APPS`
              : (lang === 'ar' ? 'جرد البرامج' : 'INVENTORY READY')}
          </text>
        </g>

        {/* Top-Right: Startup Count HUD */}
        <g transform="translate(465, 20)">
          <rect width="125" height="24" rx="6" fill="rgba(20, 10, 5, 0.85)" stroke="rgba(249, 115, 22, 0.22)" strokeWidth="0.8" />
          <text x="15" y="15" fill="#fb923c" fontSize="7.5" fontWeight="600" fontFamily="monospace">
            {startupCount !== null
              ? `${startupCount} STARTUP ITEMS`
              : (lang === 'ar' ? '١٠ خدمات معتمدة' : '10 SERVICES')}
          </text>
        </g>
      </svg>
    </div>
  );
};

export default ProgramsHeroVisual;
