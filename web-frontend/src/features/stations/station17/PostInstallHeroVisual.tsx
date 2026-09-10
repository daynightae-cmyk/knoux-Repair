import type { Lang } from '../../../types';
import type { ProvisioningReadiness } from './postInstallModel';

interface PostInstallHeroVisualProps {
  readiness: ProvisioningReadiness;
  installedAppsCount: number;
  catalogDetected: number;
  catalogTotal: number;
  driverOffersCount: number;
  pendingRestartCount: number;
  wingetAvailable: boolean;
  lang: Lang;
}

export default function PostInstallHeroVisual({
  readiness,
  installedAppsCount,
  catalogDetected,
  catalogTotal,
  driverOffersCount,
  wingetAvailable,
  lang,
}: PostInstallHeroVisualProps) {
  const isReady = readiness === 'ready';
  const isPendingRestart = readiness === 'pending_restart';
  const isAttention = readiness === 'attention';

  const primaryColor = isPendingRestart ? '#f59e0b' : isReady ? '#10b981' : isAttention ? '#3b82f6' : '#64748b';
  const glowColor = isPendingRestart ? 'rgba(245, 158, 11, 0.25)' : isReady ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)';

  return (
    <div className="post-install-hero-visual-root" style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
      <svg
        viewBox="0 0 520 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="post-install-hero-svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="piRocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="piThrusterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="piGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Orbit track circles */}
        <circle cx="260" cy="140" r="115" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="260" cy="140" r="85" stroke={glowColor} strokeWidth="1.5" />

        {/* 4 Staged Segment Arcs */}
        {/* Stage 1: Baseline */}
        <path
          d="M 175 140 A 85 85 0 0 1 260 55"
          stroke="#10b981"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Stage 2: Drivers */}
        <path
          d="M 260 55 A 85 85 0 0 1 345 140"
          stroke={driverOffersCount > 0 ? '#38bdf8' : '#10b981'}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Stage 3: Catalog */}
        <path
          d="M 345 140 A 85 85 0 0 1 260 225"
          stroke={catalogDetected < catalogTotal ? '#f59e0b' : '#10b981'}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Stage 4: Ready */}
        <path
          d="M 260 225 A 85 85 0 0 1 175 140"
          stroke={isPendingRestart ? '#ef4444' : '#10b981'}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Center Station Hub */}
        <circle cx="260" cy="140" r="48" fill="#0f172a" stroke={primaryColor} strokeWidth="2" filter="url(#piGlow)" />
        <circle cx="260" cy="140" r="40" fill="#1e293b" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

        {/* Center Rocket Vector */}
        <g transform="translate(260, 140) scale(0.95)">
          {/* Rocket Nose and Body */}
          <path
            d="M 0 -26 C 6 -14 10 2 10 14 L -10 14 C -10 2 -6 -14 0 -26 Z"
            fill="url(#piRocketGrad)"
          />
          {/* Cockpit Window */}
          <circle cx="0" cy="-6" r="4" fill="#f8fafc" />
          <circle cx="0" cy="-6" r="2.5" fill="#38bdf8" />
          {/* Left Fin */}
          <path d="M -10 4 L -18 16 L -10 14 Z" fill="#1d4ed8" />
          {/* Right Fin */}
          <path d="M 10 4 L 18 16 L 10 14 Z" fill="#1d4ed8" />
          {/* Thruster Flame */}
          <path d="M -6 14 Q 0 30 6 14 Q 0 22 -6 14 Z" fill="url(#piThrusterGrad)" />
        </g>

        {/* Stage Node 1: Top (Baseline) */}
        <g transform="translate(260, 55)">
          <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">✓</text>
          <text x="0" y="-18" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'الأساس' : 'Baseline'}
          </text>
        </g>

        {/* Stage Node 2: Right (Drivers) */}
        <g transform="translate(345, 140)">
          <circle cx="0" cy="0" r="14" fill="#0f172a" stroke={driverOffersCount > 0 ? '#38bdf8' : '#10b981'} strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="700">
            {driverOffersCount > 0 ? `${driverOffersCount}` : '✓'}
          </text>
          <text x="20" y="4" textAnchor="start" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'التعريفات' : 'Drivers'}
          </text>
        </g>

        {/* Stage Node 3: Bottom (Catalog) */}
        <g transform="translate(260, 225)">
          <circle cx="0" cy="0" r="14" fill="#0f172a" stroke={catalogDetected === catalogTotal ? '#10b981' : '#f59e0b'} strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="8" fontWeight="700">
            {catalogDetected}/{catalogTotal}
          </text>
          <text x="0" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'التطبيقات' : 'Apps'}
          </text>
        </g>

        {/* Stage Node 4: Left (Readiness / Reboot) */}
        <g transform="translate(175, 140)">
          <circle cx="0" cy="0" r="14" fill="#0f172a" stroke={isPendingRestart ? '#ef4444' : '#10b981'} strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fill={isPendingRestart ? '#ef4444' : '#10b981'} fontSize="9" fontWeight="700">
            {isPendingRestart ? '!' : 'OK'}
          </text>
          <text x="-20" y="4" textAnchor="end" fill="#94a3b8" fontSize="10" fontWeight="600">
            {lang === 'ar' ? 'الجاهزية' : 'Readiness'}
          </text>
        </g>

        {/* Status Badges in Corners */}
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="115" height="32" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="rgba(255,255,255,0.12)" />
          <text x="12" y="15" fill="#94a3b8" fontSize="9" fontWeight="500">
            {lang === 'ar' ? 'البرامج المسجلة' : 'Registered Apps'}
          </text>
          <text x="12" y="27" fill="#38bdf8" fontSize="11" fontWeight="700">
            {installedAppsCount > 0 ? `${installedAppsCount}` : '—'}
          </text>
        </g>

        <g transform="translate(385, 20)">
          <rect x="0" y="0" width="115" height="32" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="rgba(255,255,255,0.12)" />
          <text x="12" y="15" fill="#94a3b8" fontSize="9" fontWeight="500">
            {lang === 'ar' ? 'بيئة Winget' : 'Winget Client'}
          </text>
          <text x="12" y="27" fill={wingetAvailable ? '#10b981' : '#f59e0b'} fontSize="11" fontWeight="700">
            {wingetAvailable ? (lang === 'ar' ? 'جاهز' : 'Available') : (lang === 'ar' ? 'غير متوفر' : 'Missing')}
          </text>
        </g>
      </svg>
    </div>
  );
}
