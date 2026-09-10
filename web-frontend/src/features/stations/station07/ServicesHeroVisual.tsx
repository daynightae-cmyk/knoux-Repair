import React from 'react';
import type { Lang } from '../../../lib/i18n';
import type { ServiceTopology } from './servicesModel';

interface ServicesHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'scanning';
  topology?: ServiceTopology;
  className?: string;
}

export const ServicesHeroVisual: React.FC<ServicesHeroVisualProps> = ({
  lang,
  stage = 'idle',
  topology,
  className = '',
}) => {
  const isScanning = stage === 'scanning';
  const running = topology ? topology.running : 85;
  const stopped = topology ? topology.stopped : 32;
  const total = topology ? topology.total : 117;
  const attention = topology ? topology.attentionCount : 4;

  return (
    <div
      className={`knoux-services-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'كوكبة تبعيات وخدمات ويندوز التفاعلية'
          : 'KNOUX Windows Service Operations Constellation'
      }
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 580,
        height: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <svg
        className="knoux-services-hero-svg"
        viewBox="0 0 580 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          {/* Radial Ambient Glow */}
          <radialGradient id="spCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ecb15f" stopOpacity={isScanning ? 0.35 : 0.18} />
            <stop offset="60%" stopColor="#d97706" stopOpacity={isScanning ? 0.14 : 0.05} />
            <stop offset="100%" stopColor="#030712" stopOpacity="0" />
          </radialGradient>

          {/* Node Gradients */}
          <linearGradient id="spRunningNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <linearGradient id="spStoppedNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          <linearGradient id="spAttentionNode" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* Ambient Glow */}
        <circle cx="290" cy="120" r="115" fill="url(#spCoreGlow)" />

        {/* Constellation Link Web */}
        <g stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="3 4">
          <line x1="290" y1="120" x2="180" y2="70" />
          <line x1="290" y1="120" x2="400" y2="70" />
          <line x1="290" y1="120" x2="160" y2="170" />
          <line x1="290" y1="120" x2="420" y2="170" />
          <line x1="180" y1="70" x2="100" y2="110" />
          <line x1="400" y1="70" x2="480" y2="110" />
          <line x1="160" y1="170" x2="230" y2="200" />
          <line x1="420" y1="170" x2="350" y2="200" />
        </g>

        {/* Orbit track */}
        <circle
          cx="290"
          cy="120"
          r="80"
          stroke="rgba(236, 177, 95, 0.15)"
          strokeWidth="1.2"
          strokeDasharray="6 6"
        />

        {/* Core Hub: Service Master */}
        <g transform="translate(290, 120)">
          <circle r="32" fill="rgba(15, 23, 42, 0.9)" stroke="#ecb15f" strokeWidth="2" />
          <circle r="24" fill="rgba(236, 177, 95, 0.15)" />
          {isScanning && (
            <circle
              r="40"
              stroke="#ecb15f"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              style={{ animation: 'knoux-scan-spin 4s linear infinite' }}
            />
          )}
          <text y="-4" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
            {running}
          </text>
          <text y="10" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">
            ACTIVE
          </text>
        </g>

        {/* Constellation Nodes */}
        {/* Node 1: Running (RPCS) */}
        <g transform="translate(180, 70)">
          <circle r="12" fill="url(#spRunningNode)" />
          <circle r="16" stroke="#10b981" strokeWidth="1" strokeOpacity="0.4" />
          <text x="18" y="4" fill="#e2e8f0" fontSize="9" fontWeight="600">
            RPCSS
          </text>
        </g>

        {/* Node 2: Running (Winmgmt) */}
        <g transform="translate(400, 70)">
          <circle r="12" fill="url(#spRunningNode)" />
          <circle r="16" stroke="#10b981" strokeWidth="1" strokeOpacity="0.4" />
          <text x="18" y="4" fill="#e2e8f0" fontSize="9" fontWeight="600">
            WMI
          </text>
        </g>

        {/* Node 3: Stopped (Spooler) */}
        <g transform="translate(160, 170)">
          <circle r="10" fill="url(#spStoppedNode)" />
          <text x="16" y="4" fill="#94a3b8" fontSize="9">
            Spooler
          </text>
        </g>

        {/* Node 4: Attention (wuauserv or Stopped Automatic) */}
        <g transform="translate(420, 170)">
          <circle r="12" fill="url(#spAttentionNode)" />
          <circle r="16" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.5" />
          <text x="18" y="4" fill="#fcd34d" fontSize="9" fontWeight="600">
            {attention > 0 ? `${attention} Review` : 'WU'}
          </text>
        </g>

        {/* Node 5: DcomLaunch */}
        <g transform="translate(100, 110)">
          <circle r="8" fill="url(#spRunningNode)" />
          <text x="-4" y="-12" textAnchor="middle" fill="#64748b" fontSize="8">
            DCOM
          </text>
        </g>

        {/* Node 6: CryptSvc */}
        <g transform="translate(480, 110)">
          <circle r="8" fill="url(#spRunningNode)" />
          <text x="4" y="-12" textAnchor="middle" fill="#64748b" fontSize="8">
            CryptSvc
          </text>
        </g>

        {/* Topology Summary Chips */}
        <g transform="translate(50, 205)">
          <rect width="130" height="24" rx="6" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(255, 255, 255, 0.08)" />
          <circle cx="12" cy="12" r="4" fill="#34d399" />
          <text x="24" y="15" fill="#e2e8f0" fontSize="10" fontFamily="monospace">
            {running} Running ({total} total)
          </text>
        </g>

        <g transform="translate(400, 205)">
          <rect width="130" height="24" rx="6" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(255, 255, 255, 0.08)" />
          <circle cx="12" cy="12" r="4" fill="#94a3b8" />
          <text x="24" y="15" fill="#cbd5e1" fontSize="10" fontFamily="monospace">
            {stopped} Stopped
          </text>
        </g>
      </svg>
    </div>
  );
};

export default ServicesHeroVisual;
