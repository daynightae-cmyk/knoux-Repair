import React from 'react';
import type { Lang } from '../../../lib/i18n';
import type { DriveVolume } from './diskSpaceModel';

interface DiskSpaceHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'scanning' | 'analyzed';
  volumes?: DriveVolume[];
  className?: string;
}

export const DiskSpaceHeroVisual: React.FC<DiskSpaceHeroVisualProps> = ({
  lang,
  stage = 'idle',
  volumes = [],
  className = '',
}) => {
  const isScanning = stage === 'scanning';

  // Compute primary system drive or first volume for topology projection
  const primary = volumes.find((v) => v.isSystem) || volumes[0];
  const usedPercent = primary ? primary.usedPercent : 68;

  // Arc calculation for radial segmented gauge
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (usedPercent / 100) * circumference;

  return (
    <div
      className={`knoux-disk-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'مخطط أطلس التخزين وطوبولوجيا الأقراص الذكية'
          : 'KNOUX Storage Atlas & Segmented Disk Topology'
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
        className="knoux-disk-hero-svg"
        viewBox="0 0 580 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          {/* Core Radial Glow */}
          <radialGradient id="dsCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={isScanning ? 0.35 : 0.18} />
            <stop offset="60%" stopColor="#6366f1" stopOpacity={isScanning ? 0.14 : 0.05} />
            <stop offset="100%" stopColor="#030712" stopOpacity="0" />
          </radialGradient>

          {/* Platter Gradient */}
          <linearGradient id="dsPlatterFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(30, 41, 59, 0.75)" />
            <stop offset="50%" stopColor="rgba(15, 23, 42, 0.85)" />
            <stop offset="100%" stopColor="rgba(3, 7, 18, 0.95)" />
          </linearGradient>

          {/* Luminous Arc Gradient */}
          <linearGradient id="dsUsageArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor={usedPercent > 90 ? '#f43f5e' : '#a855f7'} />
          </linearGradient>

          {/* Sector Highlight */}
          <linearGradient id="dsSectorGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
            <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
          </linearGradient>
        </defs>

        {/* Ambient Glow */}
        <circle cx="290" cy="120" r="110" fill="url(#dsCoreGlow)" />

        {/* Outer Coordinate Grid Ring */}
        <ellipse
          cx="290"
          cy="120"
          rx="210"
          ry="90"
          stroke="rgba(148, 163, 184, 0.12)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
        <ellipse
          cx="290"
          cy="120"
          rx="170"
          ry="72"
          stroke="rgba(99, 102, 241, 0.18)"
          strokeWidth="1"
        />

        {/* Platter Core Base */}
        <g transform="translate(290, 120)">
          {/* Base Platter Disc */}
          <circle
            r={radius}
            fill="url(#dsPlatterFill)"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="1.5"
          />

          {/* Track Rings */}
          <circle r="72" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" strokeDasharray="3 4" />
          <circle r="52" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" />
          <circle r="32" stroke="rgba(129, 140, 248, 0.2)" strokeWidth="1.5" />

          {/* Segmented Volume Arc */}
          <circle
            r={radius}
            stroke="url(#dsUsageArc)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90)"
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          {/* Hub Core */}
          <circle r="20" fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" strokeWidth="2" />
          <circle r="8" fill="#818cf8" />

          {/* Scanning Beam if active */}
          {isScanning && (
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={-radius}
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transformOrigin: '0 0',
                animation: 'knoux-scan-spin 3s linear infinite',
              }}
            />
          )}

          {/* Center Usage Text */}
          <text
            y="4"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {usedPercent}%
          </text>
        </g>

        {/* Left Drive Volume Pod */}
        <g transform="translate(60, 45)">
          <rect
            width="130"
            height="50"
            rx="8"
            fill="rgba(15, 23, 42, 0.75)"
            stroke="rgba(56, 189, 248, 0.25)"
            strokeWidth="1"
          />
          <circle cx="20" cy="25" r="8" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="36" y="22" fill="#f8fafc" fontSize="11" fontWeight="600">
            {primary ? primary.name : 'C:'} (System)
          </text>
          <text x="36" y="36" fill="#94a3b8" fontSize="9">
            {primary ? `${primary.usedPercent}% used` : 'Primary Volume'}
          </text>
          {/* Connector Line to Platter */}
          <path
            d="M 130 25 L 180 25 L 215 70"
            stroke="rgba(56, 189, 248, 0.3)"
            strokeWidth="1"
            strokeDasharray="3 3"
            fill="none"
          />
        </g>

        {/* Right Topology Diagnostics Pod */}
        <g transform="translate(390, 145)">
          <rect
            width="135"
            height="50"
            rx="8"
            fill="rgba(15, 23, 42, 0.75)"
            stroke="rgba(129, 140, 248, 0.25)"
            strokeWidth="1"
          />
          <circle cx="20" cy="25" r="8" fill="rgba(129, 140, 248, 0.2)" stroke="#818cf8" strokeWidth="1.5" />
          <text x="36" y="22" fill="#f8fafc" fontSize="11" fontWeight="600">
            {lang === 'ar' ? 'طوبولوجيا التخزين' : 'Atlas Topology'}
          </text>
          <text x="36" y="36" fill="#94a3b8" fontSize="9">
            {volumes.length ? `${volumes.length} ${lang === 'ar' ? 'أقراص نشطة' : 'volumes mapped'}` : (lang === 'ar' ? 'في انتظار الفحص' : 'Ready for scan')}
          </text>
          {/* Connector Line */}
          <path
            d="M 0 25 L -35 25 L -55 -10"
            stroke="rgba(129, 140, 248, 0.3)"
            strokeWidth="1"
            strokeDasharray="3 3"
            fill="none"
          />
        </g>

        {/* Hotspot Indicators */}
        <circle cx="160" cy="180" r="3" fill="#38bdf8" />
        <text x="170" y="183" fill="#64748b" fontSize="8" fontFamily="monospace">
          NTFS / REFS
        </text>

        <circle cx="430" cy="65" r="3" fill="#a855f7" />
        <text x="440" y="68" fill="#64748b" fontSize="8" fontFamily="monospace">
          SMART / STORAGE API
        </text>
      </svg>
    </div>
  );
};

export default DiskSpaceHeroVisual;
