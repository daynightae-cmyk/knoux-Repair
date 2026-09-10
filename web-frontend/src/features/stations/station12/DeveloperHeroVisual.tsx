import type { DeveloperWorkbenchState } from './developerModel';

interface DeveloperHeroVisualProps {
  state: DeveloperWorkbenchState;
  runtimesCount: number;
  portsCount: number;
  collisionsCount: number;
  gitBranch?: string;
  lang?: 'en' | 'ar';
}

export default function DeveloperHeroVisual({
  state,
  runtimesCount,
  portsCount,
  collisionsCount,
  gitBranch,
  lang = 'en',
}: DeveloperHeroVisualProps) {
  const isRtl = lang === 'ar';

  const stateColors = {
    OPTIMAL: { stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.35)', badge: '#10b981', text: isRtl ? 'بيئة مثالية' : 'OPTIMAL WORKBENCH' },
    ATTENTION_NEEDED: { stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)', badge: '#f59e0b', text: isRtl ? 'تنبيهات مسارات' : 'ATTENTION NEEDED' },
    DEGRADED: { stroke: '#ef4444', glow: 'rgba(239, 68, 68, 0.35)', badge: '#ef4444', text: isRtl ? 'أدوات مفقودة' : 'TOOLCHAIN DEGRADED' },
    INCONCLUSIVE: { stroke: '#6366f1', glow: 'rgba(99, 102, 241, 0.35)', badge: '#6366f1', text: isRtl ? 'بانتظار الفحص' : 'AUDIT READY' },
  }[state] || { stroke: '#6366f1', glow: 'rgba(99, 102, 241, 0.35)', badge: '#6366f1', text: 'DEVELOPER LAB' };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        height: 240,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 520 240"
        width="100%"
        height="100%"
        style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${stateColors.glow})` }}
      >
        <defs>
          <linearGradient id="dtBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b1329" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#040915" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="dtGridGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={stateColors.stroke} stopOpacity="0.1" />
            <stop offset="50%" stopColor={stateColors.stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stateColors.stroke} stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="terminalBar" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Outer Hex/Circuit Frame */}
        <path
          d="M 40 40 L 480 40 L 500 60 L 500 180 L 480 200 L 40 200 L 20 180 L 20 60 Z"
          fill="url(#dtBgGrad)"
          stroke={stateColors.stroke}
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />

        {/* Subtle Circuit Bus Traces */}
        <line x1="20" y1="80" x2="60" y2="80" stroke={stateColors.stroke} strokeWidth="1" strokeOpacity="0.4" />
        <circle cx="60" cy="80" r="3" fill={stateColors.stroke} fillOpacity="0.8" />
        <line x1="20" y1="160" x2="70" y2="160" stroke={stateColors.stroke} strokeWidth="1" strokeOpacity="0.4" />
        <circle cx="70" cy="160" r="3" fill={stateColors.stroke} fillOpacity="0.8" />

        <line x1="500" y1="80" x2="460" y2="80" stroke={stateColors.stroke} strokeWidth="1" strokeOpacity="0.4" />
        <circle cx="460" cy="80" r="3" fill={stateColors.stroke} fillOpacity="0.8" />
        <line x1="500" y1="160" x2="450" y2="160" stroke={stateColors.stroke} strokeWidth="1" strokeOpacity="0.4" />
        <circle cx="450" cy="160" r="3" fill={stateColors.stroke} fillOpacity="0.8" />

        {/* Central Terminal Console Frame */}
        <rect x="80" y="55" width="360" height="130" rx="8" fill="#030712" stroke="#334155" strokeWidth="1" />

        {/* Console Header Bar */}
        <rect x="80" y="55" width="360" height="26" rx="8" fill="url(#terminalBar)" />
        {/* Terminal Window Controls */}
        <circle cx="96" cy="68" r="4" fill="#ef4444" opacity="0.8" />
        <circle cx="110" cy="68" r="4" fill="#f59e0b" opacity="0.8" />
        <circle cx="124" cy="68" r="4" fill="#10b981" opacity="0.8" />

        {/* Console Title */}
        <text
          x="260"
          y="71"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="10"
          fontFamily="monospace"
          letterSpacing="1"
        >
          KNOUX_DEV_TERMINAL :: 12-DEVELOPER-TOOLS
        </text>

        {/* Terminal Line 1: Prompt & Toolchain count */}
        <text x="96" y="102" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="600">
          $&gt; knoux doctor --toolchain
        </text>
        <text x="320" y="102" fill="#a7f3d0" fontSize="11" fontFamily="monospace">
          [{runtimesCount} runtimes]
        </text>

        {/* Terminal Line 2: Ports / Listeners */}
        <text x="96" y="124" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
          ports: {portsCount} active listener(s)
        </text>
        {portsCount > 0 && (
          <circle cx="310" cy="120" r="3.5" fill="#10b981">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Terminal Line 3: Branch or Collisions */}
        <text x="96" y="146" fill={collisionsCount > 0 ? '#fbbf24' : '#94a3b8'} fontSize="11" fontFamily="monospace">
          {collisionsCount > 0
            ? `! collision: ${collisionsCount} binary duplicate(s)`
            : gitBranch
            ? `git: on branch '${gitBranch}'`
            : 'toolchain: no path collisions detected'}
        </text>

        {/* Terminal Line 4: Blinking Cursor */}
        <text x="96" y="168" fill="#a855f7" fontSize="11" fontFamily="monospace">
          $&gt; _
        </text>
        <rect x="114" y="157" width="7" height="12" fill={stateColors.stroke}>
          <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
        </rect>

        {/* Bottom Badge */}
        <g transform="translate(260, 200)">
          <rect
            x="-70"
            y="-12"
            width="140"
            height="24"
            rx="12"
            fill="#090d16"
            stroke={stateColors.badge}
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fill="#f8fafc"
            fontSize="10"
            fontFamily="sans-serif"
            fontWeight="700"
            letterSpacing="0.8"
          >
            {stateColors.text}
          </text>
        </g>
      </svg>
    </div>
  );
}
