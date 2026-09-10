import React from 'react';
import type { PrivacyStance } from './privacyModel';

interface PrivacyHeroVisualProps {
  stance: PrivacyStance;
  totalSettings: number;
  restrictedCount: number;
  runHistoryCount: number;
  dnsCacheCount: number | null;
  lang?: 'en' | 'ar';
}

export default function PrivacyHeroVisual({
  stance,
  totalSettings,
  restrictedCount,
  runHistoryCount,
  dnsCacheCount,
  lang = 'en',
}: PrivacyHeroVisualProps) {
  const isRtl = lang === 'ar';

  const stanceConfig = {
    HARDENED: {
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.35)',
      badge: '#10b981',
      label: isRtl ? 'خصوصية محكمة' : 'HARDENED POSTURE',
      subtitle: isRtl ? 'أغلب خيارات التتبع والمستشعرات مقيدة' : 'Telemetry & Sensors Restricted',
    },
    BALANCED: {
      color: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.35)',
      badge: '#06b6d4',
      label: isRtl ? 'خصوصية متوازنة' : 'BALANCED POSTURE',
      subtitle: isRtl ? 'توازن بين التخصيص وحماية البيانات' : 'Standard Protection & Access',
    },
    PERMISSIVE: {
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.35)',
      badge: '#f59e0b',
      label: isRtl ? 'صلاحيات مفتوحة' : 'PERMISSIVE POSTURE',
      subtitle: isRtl ? 'أغلب خيارات التتبع والوصول مفعلة' : 'Telemetry & Targeting Enabled',
    },
    INCONCLUSIVE: {
      color: '#6366f1',
      glow: 'rgba(99, 102, 241, 0.35)',
      badge: '#6366f1',
      label: isRtl ? 'بانتظار التدقيق' : 'AUDIT PENDING',
      subtitle: isRtl ? 'لم يتم استخراج سجلات الخصوصية بعد' : 'Awaiting Privacy Telemetry',
    },
  }[stance] || {
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.35)',
    badge: '#6366f1',
    label: 'PRIVACY AUDIT',
    subtitle: 'System Inspection Ready',
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
        style={{ overflow: 'visible', filter: `drop-shadow(0 0 16px ${stanceConfig.glow})` }}
      >
        <defs>
          <radialGradient id="prShieldBg" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
          </radialGradient>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stanceConfig.color} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Outer Background Hex Base */}
        <polygon
          points="260,18 470,60 470,180 260,222 50,180 50,60"
          fill="url(#prShieldBg)"
          stroke="#1e293b"
          strokeWidth="1.5"
        />

        {/* Concentric Radar Rings */}
        <circle cx="260" cy="118" r="90" fill="none" stroke={stanceConfig.color} strokeWidth="1" strokeOpacity="0.15" strokeDasharray="4 4" />
        <circle cx="260" cy="118" r="66" fill="none" stroke={stanceConfig.color} strokeWidth="1" strokeOpacity="0.25" />
        <circle cx="260" cy="118" r="42" fill="none" stroke={stanceConfig.color} strokeWidth="1.2" strokeOpacity="0.4" />

        {/* Central Privacy Crest / Shield */}
        <path
          d="M 260 76 L 296 90 C 296 126 278 148 260 158 C 242 148 224 126 224 90 Z"
          fill="url(#shieldGrad)"
          stroke={stanceConfig.color}
          strokeWidth="2"
        />

        {/* Keyhole / Biometric Iris Core */}
        <circle cx="260" cy="106" r="8" fill="#020617" stroke={stanceConfig.color} strokeWidth="2" />
        <path d="M 257 112 L 263 112 L 265 125 L 255 125 Z" fill={stanceConfig.color} />

        {/* Left Sensor Nodes (Camera & Microphone) */}
        <g transform="translate(100, 80)">
          <circle cx="0" cy="0" r="18" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <path d="M -8 -5 L 4 -5 L 4 5 L -8 5 Z" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M 4 -2 L 8 -5 L 8 5 L 4 2 Z" fill="#38bdf8" />
          <text x="0" y="28" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">Camera</text>
        </g>
        <line x1="118" y1="80" x2="224" y2="100" stroke={stanceConfig.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />

        <g transform="translate(100, 155)">
          <circle cx="0" cy="0" r="18" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <rect x="-4" y="-8" width="8" height="12" rx="4" fill="none" stroke="#a855f7" strokeWidth="1.5" />
          <path d="M -7 -1 C -7 5 7 5 7 -1" fill="none" stroke="#a855f7" strokeWidth="1.5" />
          <line x1="0" y1="6" x2="0" y2="10" stroke="#a855f7" strokeWidth="1.5" />
          <text x="0" y="28" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">Mic</text>
        </g>
        <line x1="118" y1="155" x2="224" y2="130" stroke={stanceConfig.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />

        {/* Right Sensor Nodes (Location & Activity) */}
        <g transform="translate(420, 80)">
          <circle cx="0" cy="0" r="18" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <circle cx="0" cy="-3" r="5" fill="none" stroke="#10b981" strokeWidth="1.5" />
          <path d="M -5 -2 L 0 8 L 5 -2 Z" fill="#10b981" />
          <text x="0" y="28" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">Location</text>
        </g>
        <line x1="402" y1="80" x2="296" y2="100" stroke={stanceConfig.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />

        <g transform="translate(420, 155)">
          <circle cx="0" cy="0" r="18" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="8" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          <polyline points="0,-5 0,0 4,2" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="0" y="28" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">Activity</text>
        </g>
        <line x1="402" y1="155" x2="296" y2="130" stroke={stanceConfig.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />

        {/* Dynamic Telemetry Stats Top */}
        <text x="260" y="44" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" letterSpacing="1">
          {totalSettings > 0 ? `${restrictedCount}/${totalSettings} CONTROLS HARDENED` : 'WINDOWS PRIVACY PERIMETER'}
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
            stroke={stanceConfig.badge}
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
            {stanceConfig.label}
          </text>
        </g>
      </svg>
    </div>
  );
}
