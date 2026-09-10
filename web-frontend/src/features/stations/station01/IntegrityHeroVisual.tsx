import React from 'react';
import type { Lang } from '../../../lib/i18n';

interface IntegrityHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'scanning' | 'results' | 'repaired' | 'compact';
  activeLayer?: 'files' | 'store' | 'image' | 'disk' | 'servicing' | null;
  className?: string;
}

export const IntegrityHeroVisual: React.FC<IntegrityHeroVisualProps> = ({
  lang,
  stage = 'idle',
  activeLayer = null,
  className = '',
}) => {
  const isScanning = stage === 'scanning';
  const isRepaired = stage === 'repaired';
  const isCompact = stage === 'compact';

  return (
    <div
      className={`knoux-integrity-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'نواة سلامة نظام ويندوز المتوهجة - KNOUX System Integrity Core'
          : 'KNOUX Windows System Integrity Core Vector Illustration'
      }
    >
      <svg
        className="knoux-integrity-hero-svg"
        viewBox="0 0 600 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Ambient Core Aura */}
          <radialGradient id="smCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={isScanning ? 0.38 : isRepaired ? 0.45 : 0.2} />
            <stop offset="60%" stopColor="#0284c7" stopOpacity={isScanning ? 0.18 : 0.08} />
            <stop offset="100%" stopColor="#030c17" stopOpacity="0" />
          </radialGradient>

          {/* Core Glass Surface */}
          <linearGradient id="smGlassFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.12)" />
            <stop offset="100%" stopColor="rgba(14, 28, 48, 0.7)" />
          </linearGradient>

          {/* Concentric Border Shimmer */}
          <linearGradient id="smBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(125, 232, 255, 0.55)" />
            <stop offset="50%" stopColor="rgba(56, 189, 248, 0.2)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
          </linearGradient>

          {/* Floating Pill Gradients */}
          <linearGradient id="smPillLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(30, 48, 72, 0.75)" />
            <stop offset="100%" stopColor="rgba(12, 22, 38, 0.88)" />
          </linearGradient>
          <linearGradient id="smPillRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(24, 40, 62, 0.7)" />
            <stop offset="100%" stopColor="rgba(8, 16, 28, 0.85)" />
          </linearGradient>
        </defs>

        {/* ── Outer Ambient Glow ── */}
        <circle cx="300" cy="160" r={isCompact ? 100 : 145} fill="url(#smCoreGlow)" />

        {/* ── Orbital System Rings (Concentric Integrity Shells) ── */}
        {/* Ring 1: Windows Update Servicing */}
        <ellipse
          cx="300"
          cy="160"
          rx="240"
          ry="115"
          stroke={activeLayer === 'servicing' ? '#38bdf8' : 'rgba(56, 189, 248, 0.12)'}
          strokeWidth={activeLayer === 'servicing' ? '2' : '1.2'}
          strokeDasharray="6 8"
          className={isScanning ? 'sm-orbit-spin-slow' : ''}
        />

        {/* Ring 2: Disk & Storage Integrity */}
        <ellipse
          cx="300"
          cy="160"
          rx="195"
          ry="92"
          stroke={activeLayer === 'disk' ? '#38bdf8' : 'rgba(56, 189, 248, 0.18)'}
          strokeWidth={activeLayer === 'disk' ? '2' : '1.2'}
          strokeDasharray="4 6"
          className={isScanning ? 'sm-orbit-spin-reverse' : ''}
        />

        {/* Ring 3: System Image & Component Store */}
        <ellipse
          cx="300"
          cy="160"
          rx="150"
          ry="72"
          stroke={activeLayer === 'store' || activeLayer === 'image' ? '#38bdf8' : 'rgba(125, 232, 255, 0.25)'}
          strokeWidth={activeLayer === 'store' || activeLayer === 'image' ? '2.2' : '1.4'}
          strokeDasharray={isScanning ? '12 6' : '3 5'}
          className={isScanning ? 'sm-orbit-spin' : ''}
        />

        {/* ── Connecting Diagnostic Trace Lines ── */}
        <path d="M 180 80 Q 235 105 265 140" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 420 80 Q 365 105 335 140" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 160 220 Q 220 200 260 178" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 440 220 Q 380 200 340 178" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* ── TOP-LEFT SATELLITE: System Files (SFC / CBS) ── */}
        <g className={`sm-sat-tile ${activeLayer === 'files' ? 'is-active-layer' : ''}`} transform="translate(100, 52)">
          <rect width="112" height="56" rx="10" fill="url(#smPillLeft)" stroke="url(#smBorderGrad)" strokeWidth="1" />
          <rect x="10" y="10" width="20" height="20" rx="5" fill="rgba(56, 189, 248, 0.16)" />
          {/* File Icon */}
          <path d="M 16 16 L 24 16 M 16 20 L 22 20 M 16 24 L 20 24" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" />
          <text x="36" y="18" fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'ملفات النظام' : 'System Files'}
          </text>
          <text x="36" y="27" fill="#64748b" fontSize="7" fontFamily="monospace">
            SFC / SM01–02
          </text>
          <g transform="translate(10, 35)">
            <rect width="72" height="13" rx="3.5" fill="rgba(56, 189, 248, 0.1)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="0.75" />
            <circle cx="7" cy="6.5" r="2.5" fill="#38bdf8" />
            <text x="13" y="9.5" fill="#7dd3fc" fontSize="6.5" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'أصل محمي' : 'VERIFIED HASH'}
            </text>
          </g>
        </g>

        {/* ── TOP-RIGHT SATELLITE: Component Store & Image (DISM) ── */}
        <g className={`sm-sat-tile ${activeLayer === 'store' || activeLayer === 'image' ? 'is-active-layer' : ''}`} transform="translate(388, 52)">
          <rect width="112" height="56" rx="10" fill="url(#smPillRight)" stroke="url(#smBorderGrad)" strokeWidth="1" />
          <rect x="10" y="10" width="20" height="20" rx="5" fill="rgba(99, 102, 241, 0.18)" />
          {/* Layers/Store Icon */}
          <path d="M 15 17 L 25 17 M 15 21 L 25 21 M 15 25 L 25 25" stroke="#818cf8" strokeWidth="1.4" strokeLinecap="round" />
          <text x="36" y="18" fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'مخزن المكونات' : 'Component Store'}
          </text>
          <text x="36" y="27" fill="#64748b" fontSize="7" fontFamily="monospace">
            DISM / SM03–05
          </text>
          <g transform="translate(10, 35)">
            <rect width="72" height="13" rx="3.5" fill="rgba(99, 102, 241, 0.1)" stroke="rgba(99, 102, 241, 0.25)" strokeWidth="0.75" />
            <circle cx="7" cy="6.5" r="2.5" fill="#818cf8" />
            <text x="13" y="9.5" fill="#a5b4fc" fontSize="6.5" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'حالة المخزن' : 'WIM / PAYLOAD'}
            </text>
          </g>
        </g>

        {/* ── BOTTOM-LEFT SATELLITE: Disk Readiness (Chkdsk) ── */}
        <g className={`sm-sat-tile ${activeLayer === 'disk' ? 'is-active-layer' : ''}`} transform="translate(90, 192)">
          <rect width="112" height="56" rx="10" fill="url(#smPillLeft)" stroke="url(#smBorderGrad)" strokeWidth="1" />
          <rect x="10" y="10" width="20" height="20" rx="5" fill="rgba(16, 185, 129, 0.16)" />
          {/* Disk Icon */}
          <rect x="14" y="15" width="12" height="10" rx="2" stroke="#10b981" strokeWidth="1.3" fill="none" />
          <circle cx="23" cy="20" r="1" fill="#10b981" />
          <text x="36" y="18" fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'سلامة القرص' : 'Disk Integrity'}
          </text>
          <text x="36" y="27" fill="#64748b" fontSize="7" fontFamily="monospace">
            CHKDSK / SM06–07
          </text>
          <g transform="translate(10, 35)">
            <rect width="78" height="13" rx="3.5" fill="rgba(16, 185, 129, 0.1)" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="0.75" />
            <circle cx="7" cy="6.5" r="2.5" fill="#10b981" />
            <text x="13" y="9.5" fill="#6ee7b7" fontSize="6.5" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'نظام الملفات' : 'VOLUME READINESS'}
            </text>
          </g>
        </g>

        {/* ── BOTTOM-RIGHT SATELLITE: Servicing & Update (WUA) ── */}
        <g className={`sm-sat-tile ${activeLayer === 'servicing' ? 'is-active-layer' : ''}`} transform="translate(398, 192)">
          <rect width="112" height="56" rx="10" fill="url(#smPillRight)" stroke="url(#smBorderGrad)" strokeWidth="1" />
          <rect x="10" y="10" width="20" height="20" rx="5" fill="rgba(245, 158, 11, 0.16)" />
          {/* Update / Loop Icon */}
          <path d="M 16 18 A 4 4 0 1 1 24 22 M 24 22 L 21 22" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="36" y="18" fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">
            {lang === 'ar' ? 'تحديثات ويندوز' : 'Windows Update'}
          </text>
          <text x="36" y="27" fill="#64748b" fontSize="7" fontFamily="monospace">
            SERVICING / SM09
          </text>
          <g transform="translate(10, 35)">
            <rect width="78" height="13" rx="3.5" fill="rgba(245, 158, 11, 0.1)" stroke="rgba(245, 158, 11, 0.25)" strokeWidth="0.75" />
            <circle cx="7" cy="6.5" r="2.5" fill="#f59e0b" />
            <text x="13" y="9.5" fill="#fcd34d" fontSize="6.5" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'بنية التحديث' : 'CATALOG REPAIR'}
            </text>
          </g>
        </g>

        {/* ── CENTRAL TRANSLUCENT SYSTEM INTEGRITY CORE ── */}
        <g className="sm-central-core" transform="translate(300, 160)">
          {/* Outer Glass Chamber */}
          <circle
            r="62"
            fill="url(#smGlassFill)"
            stroke="url(#smBorderGrad)"
            strokeWidth="1.5"
            className="sm-outer-glass"
          />

          {/* Concentric Rotating Scanner Ring */}
          <circle
            r="52"
            fill="none"
            stroke="rgba(56, 189, 248, 0.3)"
            strokeWidth="1.2"
            strokeDasharray={isScanning ? '14 7' : '8 5'}
            className={isScanning ? 'sm-scan-radar' : 'sm-idle-radar'}
          />

          {/* Inner Titanium Core */}
          <circle
            r="40"
            fill="rgba(4, 15, 28, 0.88)"
            stroke="rgba(125, 232, 255, 0.35)"
            strokeWidth="1.3"
          />

          {/* Central Windows Authority Shield Icon */}
          <g transform="translate(-16, -16)">
            <rect
              width="32"
              height="32"
              rx="8"
              fill="rgba(56, 189, 248, 0.14)"
              stroke="rgba(56, 189, 248, 0.45)"
              strokeWidth="1"
            />
            {/* Windows 4-Pane Diamond Glyph */}
            <path
              d="M 10 11 L 15 10 L 15 15 L 10 15 Z M 17 9.6 L 22 8.8 L 22 15 L 17 15 Z M 10 17 L 15 17 L 15 22 L 10 21 Z M 17 17 L 22 17 L 22 23.2 L 17 22.4 Z"
              fill="#38bdf8"
            />
          </g>

          {/* Status Label Under Core */}
          <text
            x="0"
            y="32"
            textAnchor="middle"
            fill="#7dd3fc"
            fontSize="6.5"
            fontWeight="700"
            letterSpacing="0.1em"
            fontFamily="monospace"
          >
            {isScanning
              ? (lang === 'ar' ? 'فحص الأدلة...' : 'SCANNING INTEGRITY...')
              : isRepaired
              ? (lang === 'ar' ? 'تم الإصلاح والتحقق' : 'REPAIR VERIFIED')
              : (lang === 'ar' ? 'أصل النظام محمي' : 'WINDOWS INTEGRITY CORE')}
          </text>
        </g>
      </svg>
    </div>
  );
};

export default IntegrityHeroVisual;
