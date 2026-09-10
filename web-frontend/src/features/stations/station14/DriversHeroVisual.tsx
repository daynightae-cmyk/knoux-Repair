import React from 'react';
import type { DriverCondition } from './driversModel';

interface DriversHeroVisualProps {
  condition: DriverCondition;
  totalDrivers: number;
  signedDrivers: number;
  unsignedDrivers: number;
  deviceProblemsCount: number;
  lang?: 'en' | 'ar';
}

export default function DriversHeroVisual({
  condition,
  totalDrivers,
  signedDrivers,
  unsignedDrivers,
  deviceProblemsCount,
  lang = 'en',
}: DriversHeroVisualProps) {
  const isRtl = lang === 'ar';

  const conditionConfig = {
    HEALTHY: {
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.35)',
      badge: '#10b981',
      label: isRtl ? 'تعريفات موثوقة' : 'DRIVERS VERIFIED',
      subtitle: isRtl ? 'جميع التعريفات موقعة وبدون مشاكل عتاد' : 'All Drivers Signed & Nominal',
    },
    NEEDS_ATTENTION: {
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.35)',
      badge: '#f59e0b',
      label: isRtl ? 'تحتاج تدقيقاً' : 'ATTENTION REQUIRED',
      subtitle: isRtl ? 'يوجد تعريفات غير موقعة أو قديمة' : 'Unsigned or Legacy Drivers Found',
    },
    CRITICAL: {
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.35)',
      badge: '#ef4444',
      label: isRtl ? 'أجهزة بمشاكل' : 'HARDWARE PROBLEMS',
      subtitle: isRtl ? 'أجهزة برمز خطأ في إدارة الأجهزة' : 'Physical Device Manager Errors',
    },
    INCONCLUSIVE: {
      color: '#6366f1',
      glow: 'rgba(99, 102, 241, 0.35)',
      badge: '#6366f1',
      label: isRtl ? 'بانتظار الفحص' : 'INVENTORY READY',
      subtitle: isRtl ? 'جاهز لقراءة سجلات التعريفات' : 'Ready to Query Drivers',
    },
  }[condition] || {
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.35)',
    badge: '#6366f1',
    label: 'DRIVER LAB',
    subtitle: 'System Hardware Interface',
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
          <linearGradient id="dmPcbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b172a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#030712" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="dmChipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="dmBusTrace" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor={conditionConfig.color} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Outer Motherboard / PCB Plate */}
        <rect
          x="30"
          y="30"
          width="460"
          height="180"
          rx="10"
          fill="url(#dmPcbGrad)"
          stroke="#1e293b"
          strokeWidth="1.5"
        />

        {/* Gold PCI-e / Expansion Finger Pins */}
        {Array.from({ length: 22 }).map((_, i) => (
          <rect
            key={i}
            x={50 + i * 19}
            y="200"
            width="8"
            height="10"
            rx="1"
            fill="#eab308"
            opacity="0.85"
          />
        ))}

        {/* Central Silicon Controller Chip */}
        <rect
          x="200"
          y="65"
          width="120"
          height="100"
          rx="6"
          fill="url(#dmChipGrad)"
          stroke={conditionConfig.color}
          strokeWidth="1.5"
        />

        {/* Microcontroller Pins (Top & Bottom) */}
        {Array.from({ length: 6 }).map((_, i) => (
          <React.Fragment key={i}>
            <line x1={215 + i * 18} y1="58" x2={215 + i * 18} y2="65" stroke="#94a3b8" strokeWidth="2" />
            <line x1={215 + i * 18} y1="165" x2={215 + i * 18} y2="172" stroke="#94a3b8" strokeWidth="2" />
          </React.Fragment>
        ))}

        {/* Chip Die Core / Signature Stamp */}
        <circle cx="260" cy="115" r="24" fill="#020617" stroke={conditionConfig.color} strokeWidth="1.5" />
        <path
          d="M 252 115 L 258 121 L 270 109"
          fill="none"
          stroke={conditionConfig.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Chip Title Label */}
        <text
          x="260"
          y="84"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="700"
          letterSpacing="1"
        >
          KNOUX_PNP_CORE
        </text>

        {/* Left Peripheral Bus (Network & Display) */}
        <path d="M 60 90 L 160 90 L 200 105" fill="none" stroke="url(#dmBusTrace)" strokeWidth="1.5" />
        <circle cx="60" cy="90" r="4" fill="#38bdf8" />
        <text x="70" y="85" fill="#38bdf8" fontSize="9" fontFamily="monospace">PCIe Bus 0</text>

        <path d="M 60 145 L 150 145 L 200 125" fill="none" stroke="url(#dmBusTrace)" strokeWidth="1.5" />
        <circle cx="60" cy="145" r="4" fill="#a855f7" />
        <text x="70" y="140" fill="#a855f7" fontSize="9" fontFamily="monospace">USB Root Hub</text>

        {/* Right Peripheral Bus (Storage & Audio) */}
        <path d="M 460 90 L 360 90 L 320 105" fill="none" stroke="url(#dmBusTrace)" strokeWidth="1.5" />
        <circle cx="460" cy="90" r="4" fill="#10b981" />
        <text x="450" y="85" textAnchor="end" fill="#10b981" fontSize="9" fontFamily="monospace">ACPI Host</text>

        <path d="M 460 145 L 370 145 L 320 125" fill="none" stroke="url(#dmBusTrace)" strokeWidth="1.5" />
        <circle cx="460" cy="145" r="4" fill={deviceProblemsCount > 0 ? '#ef4444' : '#10b981'} />
        <text x="450" y="140" textAnchor="end" fill={deviceProblemsCount > 0 ? '#ef4444' : '#94a3b8'} fontSize="9" fontFamily="monospace">
          {deviceProblemsCount > 0 ? `Problem Device (${deviceProblemsCount})` : 'PnP Devices OK'}
        </text>

        {/* Dynamic Metric Top */}
        <text x="260" y="48" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" letterSpacing="1">
          {totalDrivers > 0 ? `${signedDrivers}/${totalDrivers} DRIVERS DIGITALLY SIGNED` : 'WINDOWS DEVICE & DRIVER LAB'}
        </text>

        {/* Bottom Badge */}
        <g transform="translate(260, 204)">
          <rect
            x="-80"
            y="-12"
            width="160"
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
