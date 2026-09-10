import type { Lang } from '../../../lib/i18n';

export interface CleanupHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'scanning' | 'cleaning' | 'verified';
  activeTier?: 'safe' | 'review' | 'sensitive' | 'destructive';
  className?: string;
}

export default function CleanupHeroVisual({
  lang,
  stage = 'idle',
  activeTier = 'safe',
  className = '',
}: CleanupHeroVisualProps) {
  const isAr = lang === 'ar';

  // Dynamic accents based on activeTier
  const accentColor =
    activeTier === 'destructive' ? '#f43f5e' :
    activeTier === 'sensitive' ? '#fb923c' :
    activeTier === 'review' ? '#fbbf24' :
    '#38bdf8';

  return (
    <div className={`knoux-cleanup-hero-container ${className}`} data-stage={stage} data-tier={activeTier}>
      <svg
        viewBox="0 0 540 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="knoux-cleanup-hero-svg"
        aria-hidden="true"
      >
        <defs>
          {/* Neon Glow Filter */}
          <filter id="cleanNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="cleanCoreGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradients */}
          <radialGradient id="cleanRadarGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="60%" stopColor={accentColor} stopOpacity="0.08" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>

          <linearGradient id="cleanPlatterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          <linearGradient id="cleanDiskRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="cleanQuarantineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="cleanPurgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#881337" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* ── Background Radar Grid ── */}
        <circle cx="270" cy="155" r="140" stroke="rgba(56, 189, 248, 0.08)" strokeDasharray="4 6" />
        <circle cx="270" cy="155" r="105" stroke="rgba(56, 189, 248, 0.12)" strokeDasharray="3 5" />
        <circle cx="270" cy="155" r="70" stroke="rgba(56, 189, 248, 0.16)" />

        {/* Ambient Radar Area */}
        <circle cx="270" cy="155" r="140" fill="url(#cleanRadarGrad)" />

        {/* Radar Crosshairs */}
        <line x1="270" y1="15" x2="270" y2="295" stroke="rgba(56, 189, 248, 0.08)" strokeDasharray="2 4" />
        <line x1="130" y1="155" x2="410" y2="155" stroke="rgba(56, 189, 248, 0.08)" strokeDasharray="2 4" />

        {/* ── Rotating Scanning Sweep Beam (Active when scanning or cleaning) ── */}
        {(stage === 'scanning' || stage === 'cleaning') && (
          <g className="clean-radar-sweep" style={{ transformOrigin: '270px 155px', animation: 'cleanScanRadar 3.5s linear infinite' }}>
            <path
              d="M 270 155 L 410 155 A 140 140 0 0 0 368 56 Z"
              fill="url(#cleanRadarGrad)"
              opacity="0.6"
            />
            <line x1="270" y1="155" x2="410" y2="155" stroke={accentColor} strokeWidth="1.75" filter="url(#cleanNeonGlow)" />
          </g>
        )}

        {/* ── Central 3D Storage Cylinder & Platter Stack ── */}
        <g className="clean-disk-stack" transform="translate(270, 155)">
          {/* Base Layer */}
          <ellipse cx="0" cy="28" rx="72" ry="24" fill="#090d16" stroke="rgba(255, 255, 255, 0.06)" />
          <path d="M -72 20 C -72 32 72 32 72 20 L 72 28 C 72 40 -72 40 -72 28 Z" fill="#0b111e" stroke="rgba(255, 255, 255, 0.04)" />

          {/* Middle Platter */}
          <ellipse cx="0" cy="12" rx="68" ry="22" fill="#0f172a" stroke="rgba(56, 189, 248, 0.2)" />
          <path d="M -68 6 C -68 18 68 18 68 6 L 68 12 C 68 24 -68 24 -68 12 Z" fill="#111c34" />

          {/* Top Platter */}
          <ellipse cx="0" cy="-6" rx="64" ry="20" fill="url(#cleanPlatterGrad)" stroke={accentColor} strokeWidth="1.2" filter="url(#cleanNeonGlow)" />

          {/* Concentric Platter Grooves / Data Tracks */}
          <ellipse cx="0" cy="-6" rx="48" ry="15" fill="none" stroke="rgba(56, 189, 248, 0.25)" strokeDasharray="6 4" />
          <ellipse cx="0" cy="-6" rx="32" ry="10" fill="none" stroke="rgba(56, 189, 248, 0.35)" strokeDasharray="3 3" />
          <ellipse cx="0" cy="-6" rx="16" ry="5" fill="#020617" stroke={accentColor} strokeWidth="1.5" />

          {/* Center Spindle Core */}
          <circle cx="0" cy="-6" r="6" fill={accentColor} filter="url(#cleanCoreGlow)" />
        </g>

        {/* ── Dynamic Orbiting Sector Arc ── */}
        <g style={{ transformOrigin: '270px 155px', animation: stage === 'cleaning' ? 'cleanOrbitFast 8s linear infinite' : 'cleanOrbitSlow 22s linear infinite' }}>
          <circle cx="270" cy="155" r="105" fill="none" stroke="url(#cleanDiskRing)" strokeWidth="1.5" strokeDasharray="60 30 15 45" />
        </g>

        {/* ── SATELLITE 1: User & Browser Caches (Top-Left) ── */}
        <g className="clean-satellite clean-sat-cache" transform="translate(95, 80)">
          <rect x="-65" y="-30" width="130" height="60" rx="12" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.2" />
          <circle cx="-42" cy="0" r="16" fill="rgba(56, 189, 248, 0.12)" />
          {/* Cache Icon / Sparkle Vector */}
          <path d="M -42 -8 L -39 -2 L -33 0 L -39 2 L -42 8 L -45 2 L -51 0 L -45 -2 Z" fill="#38bdf8" />
          <text x="-18" y="-5" fill="#e2e8f0" fontSize="10.5" fontWeight="700" fontFamily="system-ui, sans-serif">
            {isAr ? 'ذاكرة التخزين المؤقت' : 'User & Web Cache'}
          </text>
          <text x="-18" y="11" fill="#94a3b8" fontSize="8" fontFamily="ui-monospace, Menlo, monospace">
            SC01 · SC03 · SC08
          </text>
          {/* Connection Line */}
          <line x1="65" y1="10" x2="135" y2="50" stroke="rgba(56, 189, 248, 0.2)" strokeDasharray="3 3" />
        </g>

        {/* ── SATELLITE 2: System Temp & Updates (Top-Right) ── */}
        <g className="clean-satellite clean-sat-system" transform="translate(445, 80)">
          <rect x="-65" y="-30" width="130" height="60" rx="12" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(251, 191, 36, 0.25)" strokeWidth="1.2" />
          <circle cx="-42" cy="0" r="16" fill="rgba(251, 191, 36, 0.12)" />
          {/* System Gear Vector */}
          <circle cx="-42" cy="0" r="7" fill="none" stroke="#fbbf24" strokeWidth="2" />
          <circle cx="-42" cy="0" r="2.5" fill="#fbbf24" />
          <text x="-18" y="-5" fill="#e2e8f0" fontSize="10.5" fontWeight="700" fontFamily="system-ui, sans-serif">
            {isAr ? 'مؤقتات النظام والتحديث' : 'System & Updates'}
          </text>
          <text x="-18" y="11" fill="#94a3b8" fontSize="8" fontFamily="ui-monospace, Menlo, monospace">
            SC04 · SC05 · SC07
          </text>
          {/* Connection Line */}
          <line x1="-65" y1="10" x2="-135" y2="50" stroke="rgba(251, 191, 36, 0.2)" strokeDasharray="3 3" />
        </g>

        {/* ── SATELLITE 3: Quarantine Vault (Bottom-Left) ── */}
        <g className="clean-satellite clean-sat-quarantine" transform="translate(95, 230)">
          <rect x="-65" y="-30" width="130" height="60" rx="12" fill="url(#cleanQuarantineGrad)" stroke="rgba(52, 211, 153, 0.35)" strokeWidth="1.2" />
          <circle cx="-42" cy="0" r="16" fill="rgba(52, 211, 153, 0.15)" />
          {/* Shield & Lock Vector */}
          <path d="M -42 -7 L -36 -4 L -36 2 C -36 6 -42 9 -42 9 C -42 9 -48 6 -48 2 L -48 -4 Z" fill="#34d399" />
          <text x="-18" y="-5" fill="#e2e8f0" fontSize="10.5" fontWeight="700" fontFamily="system-ui, sans-serif">
            {isAr ? 'عزل آمن مسترد' : 'Safe Quarantine Vault'}
          </text>
          <text x="-18" y="11" fill="#6ee7b7" fontSize="8" fontWeight="600" fontFamily="system-ui, sans-serif">
            {isAr ? 'حماية من الحذف المباشر' : 'Reversible Isolation'}
          </text>
          {/* Connection Line */}
          <line x1="65" y1="-10" x2="135" y2="-50" stroke="rgba(52, 211, 153, 0.25)" strokeDasharray="3 3" />
        </g>

        {/* ── SATELLITE 4: Verified Purge & Bin (Bottom-Right) ── */}
        <g className="clean-satellite clean-sat-purge" transform="translate(445, 230)">
          <rect x="-65" y="-30" width="130" height="60" rx="12" fill="url(#cleanPurgeGrad)" stroke="rgba(244, 63, 94, 0.35)" strokeWidth="1.2" />
          <circle cx="-42" cy="0" r="16" fill="rgba(244, 63, 94, 0.15)" />
          {/* Trash & Purge Vector */}
          <path d="M -46 -5 L -38 -5 L -39 5 L -45 5 Z M -47 -7 L -37 -7 M -43 -9 L -41 -9" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <text x="-18" y="-5" fill="#e2e8f0" fontSize="10.5" fontWeight="700" fontFamily="system-ui, sans-serif">
            {isAr ? 'سلة المحذوفات والمؤقتات' : 'Recycle & Deep Clean'}
          </text>
          <text x="-18" y="11" fill="#fda4af" fontSize="8" fontWeight="600" fontFamily="system-ui, sans-serif">
            {isAr ? 'SC02 · بتأكيد كتابي' : 'SC02 · Typed Confirm'}
          </text>
          {/* Connection Line */}
          <line x1="-65" y1="-10" x2="-135" y2="-50" stroke="rgba(244, 63, 94, 0.25)" strokeDasharray="3 3" />
        </g>

        {/* ── Stage Badge (Bottom Center) ── */}
        <g transform="translate(270, 285)">
          <rect x="-85" y="-14" width="170" height="28" rx="14" fill="rgba(15, 23, 42, 0.9)" stroke={accentColor} strokeWidth="1" filter="url(#cleanNeonGlow)" />
          <circle cx="-62" cy="0" r="4" fill={accentColor} />
          <text x="5" y="4" fill="#f8fafc" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">
            {stage === 'scanning'
              ? (isAr ? 'جارٍ مسح الملفات القابلة للاسترداد…' : 'Scanning Reclaimable Sectors…')
              : stage === 'cleaning'
              ? (isAr ? 'جارٍ العزل والتنظيف الآمن…' : 'Executing Safe Quarantine & Cleanup…')
              : stage === 'verified'
              ? (isAr ? 'اكتمل التنظيف وتم التحقق من النتائج' : 'Cleanup Completed & Verified')
              : (isAr ? 'محرك التنظيف الآمن جاهز' : 'Safe Cleanup Engine Ready')}
          </text>
        </g>
      </svg>
    </div>
  );
}
