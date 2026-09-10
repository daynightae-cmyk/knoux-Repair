import React from 'react';
import type { Lang } from '../../../types';
import type { SonarCondition } from './sonarModel';

interface SonarHeroVisualProps {
  condition: SonarCondition;
  fileCount: number;
  isGitRepo: boolean;
  gitBranch: string | null;
  criticalCount: number;
  highCount: number;
  totalFindings: number;
  languages: string[];
  lang: Lang;
}

export default function SonarHeroVisual({
  condition,
  fileCount,
  isGitRepo,
  gitBranch,
  criticalCount,
  highCount,
  totalFindings,
  languages,
  lang,
}: SonarHeroVisualProps) {
  const isCritical = condition === 'critical';
  const isAttention = condition === 'attention';
  const isHealthy = condition === 'healthy';

  const primaryColor = isCritical ? '#ef4444' : isAttention ? '#f59e0b' : isHealthy ? '#10b981' : '#38bdf8';
  const glowColor = isCritical ? 'rgba(239, 68, 68, 0.25)' : isAttention ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)';

  return (
    <div className="sonar-hero-visual-root" style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
      <svg
        viewBox="0 0 520 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="sonar-hero-svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="sonarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
          <filter id="sonarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Ring & Grid */}
        <circle cx="260" cy="140" r="115" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2" />
        <circle cx="260" cy="140" r="85" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="260" cy="140" r="55" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />

        {/* Crosshair Axes */}
        <line x1="145" y1="140" x2="375" y2="140" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <line x1="260" y1="25" x2="260" y2="255" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

        {/* Angle Ticks */}
        <line x1="179" y1="59" x2="341" y2="221" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
        <line x1="179" y1="221" x2="341" y2="59" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />

        {/* Sonar Radar Sweep Arc (Dynamic Sweep Wedge) */}
        <path
          d="M 260 140 L 260 25 A 115 115 0 0 1 370 110 Z"
          fill="url(#sonarSweepGrad)"
        />

        {/* Active Ping Rings */}
        <circle cx="260" cy="140" r="100" stroke={glowColor} strokeWidth="1.5" />

        {/* Central Core: Repository & Project Hub */}
        <circle cx="260" cy="140" r="32" fill="#0f172a" stroke={primaryColor} strokeWidth="2.5" filter="url(#sonarGlow)" />
        <circle cx="260" cy="140" r="26" fill="#1e293b" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* Git Branch Icon in Center */}
        <g transform="translate(260, 140) scale(0.85)">
          <circle cx="-6" cy="-8" r="3.5" fill={primaryColor} />
          <circle cx="-6" cy="8" r="3.5" fill={primaryColor} />
          <circle cx="8" cy="-2" r="3.5" fill="#38bdf8" />
          <line x1="-6" y1="-5" x2="-6" y2="5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" />
          <path d="M -6 2 Q 2 2 8 -2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" fill="none" />
        </g>

        {/* Target 1: Git Branch Node (Top Right) */}
        <g transform="translate(330, 80)">
          <circle cx="0" cy="0" r="12" fill="#0f172a" stroke={isGitRepo ? '#10b981' : '#64748b'} strokeWidth="1.8" />
          <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="8" fontWeight="700">GIT</text>
          <text x="18" y="4" textAnchor="start" fill="#94a3b8" fontSize="9" fontWeight="600">
            {gitBranch || (isGitRepo ? 'Repo' : 'No Git')}
          </text>
        </g>

        {/* Target 2: Languages Node (Bottom Right) */}
        <g transform="translate(330, 200)">
          <circle cx="0" cy="0" r="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
          <text x="0" y="4" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="700">DEV</text>
          <text x="18" y="4" textAnchor="start" fill="#94a3b8" fontSize="9" fontWeight="600">
            {languages.length > 0 ? languages.slice(0, 2).join(' · ') : '—'}
          </text>
        </g>

        {/* Target 3: Findings Radar Blip (Top Left) */}
        <g transform="translate(190, 80)">
          <circle cx="0" cy="0" r="12" fill="#0f172a" stroke={isCritical ? '#ef4444' : isAttention ? '#f59e0b' : '#10b981'} strokeWidth="1.8" />
          <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="8" fontWeight="700">
            {totalFindings}
          </text>
          <text x="-16" y="4" textAnchor="end" fill="#94a3b8" fontSize="9" fontWeight="600">
            {lang === 'ar' ? 'نتائج الفحص' : 'Findings'}
          </text>
        </g>

        {/* Target 4: Files Target (Bottom Left) */}
        <g transform="translate(190, 200)">
          <circle cx="0" cy="0" r="12" fill="#0f172a" stroke="#a855f7" strokeWidth="1.8" />
          <text x="0" y="4" textAnchor="middle" fill="#a855f7" fontSize="7" fontWeight="700">DOC</text>
          <text x="-16" y="4" textAnchor="end" fill="#94a3b8" fontSize="9" fontWeight="600">
            {fileCount > 0 ? `${fileCount} files` : '—'}
          </text>
        </g>

        {/* Telemetry Pills */}
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="115" height="32" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="rgba(255,255,255,0.12)" />
          <text x="12" y="15" fill="#94a3b8" fontSize="9" fontWeight="500">
            {lang === 'ar' ? 'حالة السونار' : 'Sonar State'}
          </text>
          <text x="12" y="27" fill={primaryColor} fontSize="11" fontWeight="700">
            {condition.toUpperCase()}
          </text>
        </g>

        <g transform="translate(385, 20)">
          <rect x="0" y="0" width="115" height="32" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="rgba(255,255,255,0.12)" />
          <text x="12" y="15" fill="#94a3b8" fontSize="9" fontWeight="500">
            {lang === 'ar' ? 'النتائج الحرجة' : 'Critical Issues'}
          </text>
          <text x="12" y="27" fill={criticalCount > 0 ? '#ef4444' : '#10b981'} fontSize="11" fontWeight="700">
            {criticalCount > 0 ? `${criticalCount} / ${criticalCount + highCount}` : '0 Clean'}
          </text>
        </g>
      </svg>
    </div>
  );
}
