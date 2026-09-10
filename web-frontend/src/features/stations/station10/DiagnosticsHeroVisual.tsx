import type { DiagnosticCondition } from './diagnosticsModel';

export interface DiagnosticsHeroVisualProps {
  condition: DiagnosticCondition;
  errorCount: number;
  problemDevices: number;
  smartFailures: number;
  className?: string;
}

export default function DiagnosticsHeroVisual({
  condition,
  errorCount,
  problemDevices,
  smartFailures,
  className = '',
}: DiagnosticsHeroVisualProps) {
  const accentColor =
    condition === 'HEALTHY'
      ? '#818cf8'
      : condition === 'ATTENTION_RECOMMENDED'
      ? '#f59e0b'
      : condition === 'CRITICAL_FINDINGS'
      ? '#f43f5e'
      : '#64748b';

  return (
    <div
      className={`relative flex items-center justify-center w-full max-w-[340px] aspect-square mx-auto select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full drop-shadow-[0_0_30px_rgba(129,140,248,0.2)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="diagGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.28" />
            <stop offset="65%" stopColor={accentColor} stopOpacity="0.06" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>

          <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.1" />
            <stop offset="35%" stopColor={accentColor} stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="65%" stopColor={accentColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.1" />
          </linearGradient>

          <pattern id="diagGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>

          <filter id="diagFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Glow */}
        <circle cx="200" cy="200" r="170" fill="url(#diagGlow)" />

        {/* Oscilloscope Circular Screen Frame */}
        <circle
          cx="200"
          cy="200"
          r="165"
          fill="rgba(15, 23, 42, 0.85)"
          stroke={accentColor}
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity="0.8"
        />

        {/* Circular Grid Matrix */}
        <circle cx="200" cy="200" r="150" fill="url(#diagGrid)" />
        <circle cx="200" cy="200" r="115" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="200" cy="200" r="65" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />

        {/* Coordinate Crosshairs */}
        <line x1="50" y1="200" x2="350" y2="200" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1="200" y1="50" x2="200" y2="350" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* ECG Vital Waveform Path */}
        <path
          d="M 50 200 L 95 200 L 110 185 L 120 215 L 130 200 L 150 200 L 165 130 L 180 270 L 195 160 L 210 220 L 225 195 L 240 200 L 270 200 L 285 175 L 300 225 L 315 200 L 350 200"
          stroke="url(#ecgGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#diagFilter)"
        />

        {/* Radar sweep indicator */}
        <line
          x1="200"
          y1="200"
          x2="320"
          y2="80"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
          className="animate-[spin_8s_linear_infinite] origin-center"
        />

        {/* Diagnostic Probes Nodes */}
        <g filter="url(#diagFilter)">
          {/* Top: Event Log Probe */}
          <circle cx="200" cy="85" r="7" fill={errorCount > 0 ? '#f59e0b' : '#10b981'} />
          <circle cx="200" cy="85" r="14" stroke={errorCount > 0 ? '#f59e0b' : '#10b981'} strokeWidth="1.5" opacity="0.4" />

          {/* Right: Device Manager Probe */}
          <circle cx="315" cy="200" r="7" fill={problemDevices > 0 ? '#f43f5e' : '#10b981'} />
          <circle cx="315" cy="200" r="14" stroke={problemDevices > 0 ? '#f43f5e' : '#10b981'} strokeWidth="1.5" opacity="0.4" />

          {/* Bottom: Storage SMART Probe */}
          <circle cx="200" cy="315" r="7" fill={smartFailures > 0 ? '#f43f5e' : '#10b981'} />
          <circle cx="200" cy="315" r="14" stroke={smartFailures > 0 ? '#f43f5e' : '#10b981'} strokeWidth="1.5" opacity="0.4" />

          {/* Left: Memory & Reliability Probe */}
          <circle cx="85" cy="200" r="7" fill={accentColor} />
          <circle cx="85" cy="200" r="14" stroke={accentColor} strokeWidth="1.5" opacity="0.4" />
        </g>

        {/* Center Diagnostic Scope Ring */}
        <circle cx="200" cy="200" r="28" fill="rgba(15, 23, 42, 0.9)" stroke={accentColor} strokeWidth="2" />
        <circle cx="200" cy="200" r="6" fill={accentColor} className="animate-ping" />
        <circle cx="200" cy="200" r="6" fill="#ffffff" />
      </svg>
    </div>
  );
}
