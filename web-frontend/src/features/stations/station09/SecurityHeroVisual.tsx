import type { SecurityPostureStatus } from './securityModel';

export interface SecurityHeroVisualProps {
  posture: SecurityPostureStatus;
  defenderActive: boolean;
  firewallActive: boolean;
  uacActive: boolean | null;
  className?: string;
}

export default function SecurityHeroVisual({
  posture,
  defenderActive,
  firewallActive,
  uacActive,
  className = '',
}: SecurityHeroVisualProps) {
  const postureColor =
    posture === 'SECURE'
      ? '#10b981'
      : posture === 'PROTECTED_WITH_WARNINGS'
      ? '#f59e0b'
      : posture === 'EXPOSED'
      ? '#ef4444'
      : '#64748b';

  const firewallRingColor = firewallActive ? '#2dd4bf' : '#f87171';
  const uacRingColor = uacActive === false ? '#f87171' : uacActive === true ? '#06b6d4' : '#64748b';
  const defenderCoreColor = defenderActive ? '#10b981' : '#f87171';

  return (
    <div
      className={`relative flex items-center justify-center w-full max-w-[340px] aspect-square mx-auto select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full drop-shadow-[0_0_25px_rgba(45,212,191,0.18)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="secGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={postureColor} stopOpacity="0.25" />
            <stop offset="60%" stopColor={postureColor} stopOpacity="0.06" />
            <stop offset="100%" stopColor={postureColor} stopOpacity="0" />
          </radialGradient>

          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={postureColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={defenderCoreColor} stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={firewallRingColor} stopOpacity="0.9" />
            <stop offset="50%" stopColor={uacRingColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={firewallRingColor} stopOpacity="0.9" />
          </linearGradient>

          <filter id="glowSec" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient background glow */}
        <circle cx="200" cy="200" r="170" fill="url(#secGlow)" />

        {/* Outer Perimeter Ring: Firewall Defense */}
        <circle
          cx="200"
          cy="200"
          r="160"
          stroke={firewallRingColor}
          strokeWidth="1.5"
          strokeDasharray="6 8"
          opacity="0.6"
          className="animate-[spin_40s_linear_infinite]"
        />

        {/* Outer segmented radar ticks */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="200"
            y1="24"
            x2="200"
            y2="34"
            stroke={firewallRingColor}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}

        {/* Middle Ring: UAC & Policy Barrier */}
        <circle
          cx="200"
          cy="200"
          r="125"
          stroke={uacRingColor}
          strokeWidth="2"
          strokeDasharray="14 10"
          opacity="0.75"
          className="animate-[spin_28s_linear_infinite_reverse]"
        />

        {/* Inner Ring: Defender Sensor Orbit */}
        <circle
          cx="200"
          cy="200"
          r="90"
          stroke={defenderCoreColor}
          strokeWidth="1.5"
          strokeDasharray="4 6"
          opacity="0.7"
        />

        {/* Sentinel Nodes on Orbit */}
        <circle cx="200" cy="110" r="4.5" fill={defenderCoreColor} filter="url(#glowSec)" />
        <circle cx="290" cy="200" r="4.5" fill={uacRingColor} filter="url(#glowSec)" />
        <circle cx="200" cy="290" r="4.5" fill={firewallRingColor} filter="url(#glowSec)" />
        <circle cx="110" cy="200" r="4.5" fill={postureColor} filter="url(#glowSec)" />

        {/* Central Hexagonal / Shield Core */}
        <path
          d="M 200 135 L 255 160 L 255 220 L 200 265 L 145 220 L 145 160 Z"
          fill="rgba(15, 23, 42, 0.75)"
          stroke="url(#shieldGrad)"
          strokeWidth="2.5"
          filter="url(#glowSec)"
        />

        {/* Core Shield Emblem */}
        <path
          d="M 200 152 L 236 168 C 236 205 219 232 200 246 C 181 232 164 205 164 168 Z"
          fill={postureColor}
          fillOpacity="0.16"
          stroke={postureColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Inner Sentinel Checkmark or Warning */}
        {posture === 'SECURE' ? (
          <path
            d="M 188 198 L 197 207 L 214 186"
            stroke="#10b981"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : posture === 'EXPOSED' ? (
          <path
            d="M 191 189 L 209 207 M 209 189 L 191 207"
            stroke="#ef4444"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M 200 185 L 200 201 M 200 209 L 200 211"
            stroke="#f59e0b"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}

        {/* Coordinate crosshairs */}
        <line x1="165" y1="200" x2="175" y2="200" stroke={postureColor} strokeWidth="1.5" opacity="0.4" />
        <line x1="225" y1="200" x2="235" y2="200" stroke={postureColor} strokeWidth="1.5" opacity="0.4" />
        <line x1="200" y1="165" x2="200" y2="175" stroke={postureColor} strokeWidth="1.5" opacity="0.4" />
        <line x1="200" y1="225" x2="200" y2="235" stroke={postureColor} strokeWidth="1.5" opacity="0.4" />
      </svg>
    </div>
  );
}
