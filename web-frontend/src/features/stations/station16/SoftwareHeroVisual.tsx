import React from 'react';
import type { Lang } from '../../../types';
import type { SoftwareCondition } from './softwareModel';

interface SoftwareHeroVisualProps {
  condition: SoftwareCondition;
  detectedRuntimes: number;
  missingRuntimes: number;
  totalSoftware: number;
  wingetAvailable: boolean;
  totalCacheBytes: number;
  lang: Lang;
}

export default function SoftwareHeroVisual({
  condition,
  detectedRuntimes,
  missingRuntimes,
  totalSoftware,
  wingetAvailable,
  totalCacheBytes,
  lang,
}: SoftwareHeroVisualProps) {
  const isOptimal = condition === 'optimal';
  const isAttention = condition === 'attention';

  const primaryColor = isOptimal ? '#10b981' : isAttention ? '#f59e0b' : '#3b82f6';
  const glowColor = isOptimal ? 'rgba(16, 185, 129, 0.25)' : isAttention ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.25)';

  return (
    <div className="software-hero-visual-root" style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
      <svg
        viewBox="0 0 520 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="software-hero-svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="swHubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="swAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <filter id="swGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagon Bus Wireframe */}
        <polygon
          points="260,25 445,75 445,205 260,255 75,205 75,75"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Inner Hub Polygon */}
        <polygon
          points="260,48 415,90 415,190 260,232 105,190 105,90"
          stroke={glowColor}
          strokeWidth="1.2"
          strokeDasharray="4 3"
          fill="url(#swHubGrad)"
        />

        {/* Cross Connectors / Bus Lines */}
        <line x1="105" y1="90" x2="260" y2="140" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
        <line x1="415" y1="90" x2="260" y2="140" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
        <line x1="260" y1="48" x2="260" y2="140" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.5" />
        <line x1="105" y1="190" x2="260" y2="140" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
        <line x1="415" y1="190" x2="260" y2="140" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
        <line x1="260" y1="232" x2="260" y2="140" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.5" />

        {/* Central Core Circle */}
        <circle cx="260" cy="140" r="46" fill="#0f172a" stroke={primaryColor} strokeWidth="2.5" filter="url(#swGlow)" />
        <circle cx="260" cy="140" r="38" fill="rgba(30, 41, 59, 0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* Package Stack in Center */}
        <g transform="translate(244, 122)">
          {/* Top package lid */}
          <polygon points="16,0 32,7 16,14 0,7" fill={primaryColor} fillOpacity="0.85" />
          {/* Package left side */}
          <polygon points="0,7 16,14 16,28 0,21" fill="rgba(255, 255, 255, 0.2)" />
          {/* Package right side */}
          <polygon points="16,14 32,7 32,21 16,28" fill="rgba(255, 255, 255, 0.35)" />
          {/* Center line */}
          <line x1="16" y1="14" x2="16" y2="28" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
        </g>

        {/* Hub Node 1: Top (Winget / Package Manager) */}
        <g transform="translate(260, 48)">
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke={wingetAvailable ? '#10b981' : '#64748b'} strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="700" fontFamily="monospace">W</text>
          <text x="0" y="-18" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'مدير الحزم' : 'Package Mgr'}
          </text>
        </g>

        {/* Hub Node 2: Top Right (Node / JS Runtimes) */}
        <g transform="translate(415, 90)">
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="700" fontFamily="monospace">JS</text>
          <text x="22" y="4" textAnchor="start" fill="#94a3b8" fontSize="10" fontWeight="600">
            Node / Web
          </text>
        </g>

        {/* Hub Node 3: Bottom Right (.NET / CLR Runtimes) */}
        <g transform="translate(415, 190)">
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke="#a855f7" strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#a855f7" fontSize="8" fontWeight="700" fontFamily="monospace">.NET</text>
          <text x="22" y="4" textAnchor="start" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'أطر دوت نت' : '.NET Stack'}
          </text>
        </g>

        {/* Hub Node 4: Bottom (Cache & Storage) */}
        <g transform="translate(260, 232)">
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke={totalCacheBytes > 1024 * 1024 * 1024 ? '#f59e0b' : '#64748b'} strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="8" fontWeight="700" fontFamily="monospace">C$</text>
          <text x="0" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'التخزين المؤقت' : 'Cache Store'}
          </text>
        </g>

        {/* Hub Node 5: Bottom Left (Python / Runtimes) */}
        <g transform="translate(105, 190)">
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke="#eab308" strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#eab308" fontSize="9" fontWeight="700" fontFamily="monospace">PY</text>
          <text x="-20" y="4" textAnchor="end" fill="#94a3b8" fontSize="10" fontWeight="600">
            Python
          </text>
        </g>

        {/* Hub Node 6: Top Left (App Catalog / Win32 & Appx) */}
        <g transform="translate(105, 90)">
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#06b6d4" fontSize="8" fontWeight="700" fontFamily="monospace">APP</text>
          <text x="-20" y="4" textAnchor="end" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'جرد البرامج' : 'App Catalog'}
          </text>
        </g>

        {/* Orbiting Telemetry Pills */}
        {/* Left Telemetry Pill */}
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="110" height="32" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="rgba(255,255,255,0.12)" />
          <text x="12" y="15" fill="#94a3b8" fontSize="9" fontWeight="500">
            {lang === 'ar' ? 'التطبيقات' : 'Applications'}
          </text>
          <text x="12" y="27" fill="#38bdf8" fontSize="11" fontWeight="700">
            {totalSoftware > 0 ? `${totalSoftware}` : '—'}
          </text>
        </g>

        {/* Right Telemetry Pill */}
        <g transform="translate(390, 20)">
          <rect x="0" y="0" width="110" height="32" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="rgba(255,255,255,0.12)" />
          <text x="12" y="15" fill="#94a3b8" fontSize="9" fontWeight="500">
            {lang === 'ar' ? 'البيئات النشطة' : 'Active Runtimes'}
          </text>
          <text x="12" y="27" fill="#10b981" fontSize="11" fontWeight="700">
            {detectedRuntimes > 0 ? `${detectedRuntimes} / ${detectedRuntimes + missingRuntimes}` : '—'}
          </text>
        </g>
      </svg>
    </div>
  );
}
