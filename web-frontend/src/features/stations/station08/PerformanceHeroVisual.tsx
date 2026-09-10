import React from 'react';
import type { Lang } from '../../../lib/i18n';
import type { PerformanceCondition } from './performanceModel';

interface PerformanceHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'sampling';
  cpuPercent?: number;
  memoryPercent?: number;
  condition?: PerformanceCondition;
  className?: string;
}

export const PerformanceHeroVisual: React.FC<PerformanceHeroVisualProps> = ({
  lang,
  stage = 'idle',
  cpuPercent = 28,
  memoryPercent = 45,
  condition = 'OPTIMAL',
  className = '',
}) => {
  const isSampling = stage === 'sampling';

  // Arc calculations for CPU and Memory rings
  const cpuRadius = 85;
  const cpuCircumference = 2 * Math.PI * cpuRadius;
  const cpuOffset = cpuCircumference - (Math.min(100, Math.max(0, cpuPercent)) / 100) * cpuCircumference;

  const memRadius = 65;
  const memCircumference = 2 * Math.PI * memRadius;
  const memOffset = memCircumference - (Math.min(100, Math.max(0, memoryPercent)) / 100) * memCircumference;

  // Condition color
  const conditionColor =
    condition === 'CRITICAL_LOAD'
      ? '#f43f5e'
      : condition === 'HIGH_LOAD'
      ? '#f59e0b'
      : condition === 'MODERATE'
      ? '#38bdf8'
      : '#10b981';

  return (
    <div
      className={`knoux-performance-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'نواة نبض أداء ومعالجة موارد الجهاز'
          : 'KNOUX Performance Resource Core & Processing Pulse'
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
        className="knoux-performance-hero-svg"
        viewBox="0 0 580 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          {/* Radial Ambient Glow */}
          <radialGradient id="pfCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={conditionColor} stopOpacity={isSampling ? 0.35 : 0.18} />
            <stop offset="60%" stopColor="#0284c7" stopOpacity={isSampling ? 0.12 : 0.05} />
            <stop offset="100%" stopColor="#030712" stopOpacity="0" />
          </radialGradient>

          {/* Core Hub Fill */}
          <linearGradient id="pfCoreFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(30, 41, 59, 0.9)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0.95)" />
          </linearGradient>

          {/* Pulse Beam Gradient */}
          <linearGradient id="pfCpuGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor={cpuPercent > 80 ? '#f43f5e' : '#6366f1'} />
          </linearGradient>

          <linearGradient id="pfMemGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Ambient Glow */}
        <circle cx="290" cy="120" r="115" fill="url(#pfCoreGlow)" />

        {/* Background Waveform Grid */}
        <path
          d="M 50 120 Q 120 90 190 120 T 330 120 T 470 120 T 530 120"
          stroke="rgba(56, 189, 248, 0.1)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M 50 120 Q 120 150 190 120 T 330 120 T 470 120 T 530 120"
          stroke="rgba(168, 85, 247, 0.08)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Outer Grid Orbit */}
        <circle
          cx="290"
          cy="120"
          r="105"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Core Ring Structure */}
        <g transform="translate(290, 120)">
          {/* Base Track Rings */}
          <circle r={cpuRadius} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="6" />
          <circle r={memRadius} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="5" />

          {/* Dynamic CPU Arc */}
          <circle
            r={cpuRadius}
            stroke="url(#pfCpuGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={cpuCircumference}
            strokeDashoffset={cpuOffset}
            transform="rotate(-90)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />

          {/* Dynamic Memory Arc */}
          <circle
            r={memRadius}
            stroke="url(#pfMemGradient)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={memCircumference}
            strokeDashoffset={memOffset}
            transform="rotate(-90)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />

          {/* Inner Processing Core */}
          <circle r="44" fill="url(#pfCoreFill)" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.5" />
          <circle r="28" fill="rgba(15, 23, 42, 0.8)" stroke={conditionColor} strokeWidth="2" />

          {/* Center Text */}
          <text y="-2" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="monospace">
            {cpuPercent}%
          </text>
          <text y="12" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">
            CPU LOAD
          </text>

          {/* Pulse Scanner Line if active */}
          {isSampling && (
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={-cpuRadius}
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transformOrigin: '0 0',
                animation: 'knoux-scan-spin 2.5s linear infinite',
              }}
            />
          )}
        </g>

        {/* Left Telemetry Pod: CPU Info */}
        <g transform="translate(60, 50)">
          <rect width="130" height="48" rx="8" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(56, 189, 248, 0.2)" />
          <circle cx="18" cy="24" r="6" fill="#38bdf8" />
          <text x="32" y="20" fill="#f8fafc" fontSize="11" fontWeight="600">
            CPU Pulse
          </text>
          <text x="32" y="34" fill="#94a3b8" fontSize="9" fontFamily="monospace">
            {cpuPercent}% Active Load
          </text>
          {/* Connector Line */}
          <path d="M 130 24 L 175 24 L 205 60" stroke="rgba(56, 189, 248, 0.25)" strokeDasharray="3 3" fill="none" />
        </g>

        {/* Right Telemetry Pod: Memory Info */}
        <g transform="translate(390, 140)">
          <rect width="135" height="48" rx="8" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(168, 85, 247, 0.2)" />
          <circle cx="18" cy="24" r="6" fill="#a855f7" />
          <text x="32" y="20" fill="#f8fafc" fontSize="11" fontWeight="600">
            Memory Pressure
          </text>
          <text x="32" y="34" fill="#94a3b8" fontSize="9" fontFamily="monospace">
            {memoryPercent}% Utilization
          </text>
          {/* Connector Line */}
          <path d="M 0 24 L -40 24 L -65 -5" stroke="rgba(168, 85, 247, 0.25)" strokeDasharray="3 3" fill="none" />
        </g>

        {/* Condition Tag */}
        <g transform="translate(240, 208)">
          <rect width="100" height="22" rx="6" fill="rgba(15, 23, 42, 0.85)" stroke={conditionColor} strokeWidth="1" />
          <text x="50" y="15" textAnchor="middle" fill={conditionColor} fontSize="9" fontWeight="bold" fontFamily="monospace">
            {condition}
          </text>
        </g>
      </svg>
    </div>
  );
};

export default PerformanceHeroVisual;
