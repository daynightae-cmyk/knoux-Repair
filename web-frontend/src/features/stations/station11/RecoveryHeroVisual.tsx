import type { RecoveryReadinessState } from './recoveryModel';

export interface RecoveryHeroVisualProps {
  state: RecoveryReadinessState;
  restorePointsCount: number;
  shadowCopiesCount: number;
  localBackupsCount: number;
  className?: string;
}

export default function RecoveryHeroVisual({
  state,
  restorePointsCount,
  shadowCopiesCount,
  localBackupsCount,
  className = '',
}: RecoveryHeroVisualProps) {
  const accentColor =
    state === 'READY'
      ? '#38bdf8'
      : state === 'PARTIAL_COVERAGE'
      ? '#f59e0b'
      : state === 'UNPROTECTED'
      ? '#f43f5e'
      : '#64748b';

  return (
    <div
      className={`relative flex items-center justify-center w-full max-w-[340px] aspect-square mx-auto select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full drop-shadow-[0_0_25px_rgba(56,189,248,0.22)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="vaultGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="65%" stopColor={accentColor} stopOpacity="0.05" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>

          <linearGradient id="vaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="doorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <filter id="glowVault" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient background glow */}
        <circle cx="200" cy="200" r="170" fill="url(#vaultGlow)" />

        {/* Outer Vault Gear & Rim */}
        <circle
          cx="200"
          cy="200"
          r="160"
          stroke={accentColor}
          strokeWidth="2"
          strokeDasharray="12 16"
          opacity="0.6"
          className="animate-[spin_60s_linear_infinite]"
        />

        {/* Vault Dial Combination Markers */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg}
            x1="200"
            y1="48"
            x2="200"
            y2="58"
            stroke={accentColor}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.75"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}

        {/* Outer Heavy Steel Door */}
        <circle
          cx="200"
          cy="200"
          r="135"
          fill="url(#doorGrad)"
          stroke="url(#vaultGrad)"
          strokeWidth="3"
        />

        {/* Rotating Locking Ring */}
        <circle
          cx="200"
          cy="200"
          r="105"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeDasharray="6 8"
          opacity="0.8"
          className="animate-[spin_35s_linear_infinite_reverse]"
        />

        {/* Three Vault Lock Bolts (Restore Points, VSS, Local Backup) */}
        <g filter="url(#glowVault)">
          {/* Top Bolt: Restore Points */}
          <circle cx="200" cy="95" r="6.5" fill={restorePointsCount > 0 ? '#10b981' : '#f43f5e'} />
          <line x1="200" y1="95" x2="200" y2="120" stroke={restorePointsCount > 0 ? '#10b981' : '#f43f5e'} strokeWidth="2.5" />

          {/* Bottom Left Bolt: Shadow Copies */}
          <circle cx="109" cy="252" r="6.5" fill={shadowCopiesCount > 0 ? '#38bdf8' : '#64748b'} />
          <line x1="109" y1="252" x2="130" y2="238" stroke={shadowCopiesCount > 0 ? '#38bdf8' : '#64748b'} strokeWidth="2.5" />

          {/* Bottom Right Bolt: Local Backup */}
          <circle cx="291" cy="252" r="6.5" fill={localBackupsCount > 0 ? '#10b981' : '#f59e0b'} />
          <line x1="291" y1="252" x2="270" y2="238" stroke={localBackupsCount > 0 ? '#10b981' : '#f59e0b'} strokeWidth="2.5" />
        </g>

        {/* Central Vault Wheel Core */}
        <circle cx="200" cy="200" r="55" fill="#0f172a" stroke={accentColor} strokeWidth="2.5" />

        {/* Three-Spoke Wheel Handle */}
        {[0, 120, 240].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 200 200)`}>
            <line x1="200" y1="200" x2="200" y2="152" stroke={accentColor} strokeWidth="4" strokeLinecap="round" />
            <circle cx="200" cy="150" r="6" fill={accentColor} />
          </g>
        ))}

        {/* Center Keyhole Hub */}
        <circle cx="200" cy="200" r="18" fill="#1e293b" stroke={accentColor} strokeWidth="1.5" />
        <path
          d="M 197 194 A 3.5 3.5 0 1 1 203 194 L 204 205 A 1.5 1.5 0 0 1 202.5 206.5 L 197.5 206.5 A 1.5 1.5 0 0 1 196 205 Z"
          fill={accentColor}
        />
      </svg>
    </div>
  );
}
