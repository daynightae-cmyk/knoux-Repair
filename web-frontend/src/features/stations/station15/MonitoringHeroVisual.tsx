import type { ObservatoryCondition } from './monitoringModel';

interface MonitoringHeroVisualProps {
  condition: ObservatoryCondition;
  totalProcesses: number;
  unresponsiveCount: number;
  topMemoryProcessName: string | null;
  topMemoryMB: number;
  lang?: 'en' | 'ar';
}

export default function MonitoringHeroVisual({
  condition,
  totalProcesses,
  unresponsiveCount,
  topMemoryProcessName,
  topMemoryMB,
  lang = 'en',
}: MonitoringHeroVisualProps) {
  const isRtl = lang === 'ar';

  const conditionConfig = {
    NOMINAL: {
      color: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.35)',
      badge: '#38bdf8',
      label: isRtl ? 'حالة مستقرة' : 'NOMINAL OBSERVATORY',
      subtitle: isRtl ? 'كافة العمليات مستجيبة والذاكرة مستقرة' : 'Processes Responsive & Stable',
    },
    ELEVATED_LOAD: {
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.35)',
      badge: '#f59e0b',
      label: isRtl ? 'حمل تشغيلي مرتفع' : 'ELEVATED ACTIVITY',
      subtitle: isRtl ? 'استهلاك مرتفع للذاكرة من عدة عمليات' : 'High Memory Working Sets',
    },
    CRITICAL_BOTTLENECK: {
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.35)',
      badge: '#ef4444',
      label: isRtl ? 'عمليات غير مستجيبة' : 'UNRESPONSIVE TASKS',
      subtitle: isRtl ? 'اكتشاف عمليات متوقفة عن الاستجابة' : 'Processes Hanging Detected',
    },
    INCONCLUSIVE: {
      color: '#6366f1',
      glow: 'rgba(99, 102, 241, 0.35)',
      badge: '#6366f1',
      label: isRtl ? 'بانتظار الرصد' : 'OBSERVATORY READY',
      subtitle: isRtl ? 'جاهز لرصد العمليات والذاكرة' : 'Telemetry Ready',
    },
  }[condition] || {
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.35)',
    badge: '#6366f1',
    label: 'OBSERVATORY',
    subtitle: 'Telemetry Ready',
  };

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
        style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${conditionConfig.glow})` }}
      >
        <defs>
          <radialGradient id="moRadarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0b172a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
          </radialGradient>
          <linearGradient id="moRadarSweep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={conditionConfig.color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={conditionConfig.color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Outer Circular Observatory Base */}
        <circle cx="260" cy="116" r="94" fill="url(#moRadarBg)" stroke="#1e293b" strokeWidth="1.5" />

        {/* Concentric Range Rings */}
        <circle cx="260" cy="116" r="74" fill="none" stroke={conditionConfig.color} strokeWidth="1" strokeOpacity="0.2" />
        <circle cx="260" cy="116" r="50" fill="none" stroke={conditionConfig.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />
        <circle cx="260" cy="116" r="26" fill="none" stroke={conditionConfig.color} strokeWidth="1.2" strokeOpacity="0.5" />

        {/* Crosshair Axes */}
        <line x1="166" y1="116" x2="354" y2="116" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="260" y1="22" x2="260" y2="210" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />

        {/* Radar Sweep Arc */}
        <path
          d="M 260 116 L 330 60 A 94 94 0 0 1 354 116 Z"
          fill="url(#moRadarSweep)"
        />

        {/* Pulsing Core CPU Node */}
        <circle cx="260" cy="116" r="8" fill={conditionConfig.color}>
          <animate attributeName="r" values="7;10;7" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Orbiting Process Beacons */}
        <g transform="translate(260, 116)">
          <circle cx="56" cy="-28" r="4.5" fill="#38bdf8" />
          <text x="64" y="-24" fill="#94a3b8" fontSize="8" fontFamily="monospace">Proc A</text>

          <circle cx="-42" cy="46" r="4.5" fill="#a855f7" />
          <text x="-40" y="58" fill="#94a3b8" fontSize="8" fontFamily="monospace">Proc B</text>

          <circle cx="34" cy="54" r="5" fill="#10b981" />
          <text x="42" y="60" fill="#94a3b8" fontSize="8" fontFamily="monospace">Proc C</text>

          {unresponsiveCount > 0 && (
            <g transform="translate(-55, -35)">
              <circle cx="0" cy="0" r="6" fill="#ef4444">
                <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
              </circle>
              <text x="8" y="3" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="700">! HANG</text>
            </g>
          )}
        </g>

        {/* Top Telemetry Header */}
        <text x="260" y="44" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" letterSpacing="1">
          {totalProcesses > 0
            ? `${totalProcesses} TASKS MONITORED • TOP MEMORY: ${topMemoryProcessName || '—'} (${topMemoryMB} MB)`
            : 'WINDOWS REAL-TIME PROCESS OBSERVATORY'}
        </text>

        {/* Bottom Badge */}
        <g transform="translate(260, 204)">
          <rect
            x="-85"
            y="-12"
            width="170"
            height="24"
            rx="12"
            fill="#090d16"
            stroke={conditionConfig.badge}
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
            {conditionConfig.label}
          </text>
        </g>
      </svg>
    </div>
  );
}
