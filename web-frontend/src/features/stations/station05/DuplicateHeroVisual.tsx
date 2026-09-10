import React from 'react';
import type { Lang } from '../../../lib/i18n';

interface DuplicateHeroVisualProps {
  lang: Lang;
  stage?: 'idle' | 'scanning' | 'results' | 'quarantine' | 'verified';
  className?: string;
}

export const DuplicateHeroVisual: React.FC<DuplicateHeroVisualProps> = ({
  lang,
  stage = 'idle',
  className = '',
}) => {
  const isScanning = stage === 'scanning';
  const isVerified = stage === 'verified';

  return (
    <div
      className={`knoux-duplicate-hero-container ${stage} ${className}`}
      role="img"
      aria-label={
        lang === 'ar'
          ? 'رسم توضيحي لغرفة ذكاء الملفات المكررة الآمنة'
          : 'Illustration of KNOUX duplicate file intelligence core'
      }
    >
      <svg
        className="knoux-duplicate-hero-svg"
        viewBox="0 0 600 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Ambient Glow */}
          <radialGradient id="dfCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={isScanning ? 0.35 : 0.18} />
            <stop offset="60%" stopColor="#0284c7" stopOpacity={isScanning ? 0.15 : 0.06} />
            <stop offset="100%" stopColor="#030c17" stopOpacity="0" />
          </radialGradient>

          {/* Glass Gradients */}
          <linearGradient id="dfGlassFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.09)" />
            <stop offset="100%" stopColor="rgba(14, 28, 48, 0.65)" />
          </linearGradient>
          <linearGradient id="dfGlassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(125, 232, 255, 0.45)" />
            <stop offset="50%" stopColor="rgba(56, 189, 248, 0.15)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
          </linearGradient>

          {/* Card Fill Gradients */}
          <linearGradient id="dfCardFillLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(30, 48, 72, 0.7)" />
            <stop offset="100%" stopColor="rgba(12, 22, 38, 0.85)" />
          </linearGradient>
          <linearGradient id="dfCardFillRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(20, 36, 56, 0.65)" />
            <stop offset="100%" stopColor="rgba(8, 16, 28, 0.8)" />
          </linearGradient>
        </defs>

        {/* Ambient Core Aura */}
        <circle cx="300" cy="160" r="140" fill="url(#dfCoreGlow)" />

        {/* Background Orbit Track */}
        <ellipse
          cx="300"
          cy="160"
          rx="210"
          ry="100"
          stroke="rgba(56, 189, 248, 0.12)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          className={isScanning ? 'df-orbit-spin' : ''}
        />

        {/* Connection Trace Lines from Left (Keepers) & Right (Duplicates) to Core */}
        <path
          d="M 180 90 Q 230 110 260 145"
          stroke="rgba(56, 189, 248, 0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d="M 420 90 Q 370 110 340 145"
          stroke="rgba(244, 63, 94, 0.25)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d="M 160 210 Q 220 190 260 175"
          stroke="rgba(56, 189, 248, 0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d="M 440 210 Q 380 190 340 175"
          stroke="rgba(244, 63, 94, 0.25)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Direct Cross-Bridge: Duplicate Pair Connectors */}
        <path
          d="M 180 90 C 240 70, 360 70, 420 90"
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path
          d="M 160 210 C 230 235, 370 235, 440 210"
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* ========================================================================= */}
        {/* LEFT PAIR: PRESERVED FILE (Image / Photo) */}
        {/* ========================================================================= */}
        <g className="df-tile-left-top" transform="translate(110, 60)">
          <rect
            width="100"
            height="62"
            rx="10"
            fill="url(#dfCardFillLeft)"
            stroke="url(#dfGlassBorder)"
            strokeWidth="1"
          />
          <path d="M 2 12 Q 50 16 98 12 L 98 2 Q 50 2 2 2 Z" fill="rgba(255, 255, 255, 0.05)" />
          <rect x="10" y="10" width="22" height="22" rx="6" fill="rgba(56, 189, 248, 0.15)" />
          <path
            d="M 15 24 L 19 19 L 23 23 L 27 17 L 31 24"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="18" cy="15" r="1.5" fill="#38bdf8" />
          <text x="38" y="20" fill="#e2e8f0" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            IMG_4082.jpg
          </text>
          <text x="38" y="29" fill="#64748b" fontSize="7.5" fontFamily="monospace">
            4.2 MB · SHA-256
          </text>
          <g transform="translate(10, 40)">
            <rect width="64" height="15" rx="4" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="0.75" />
            <path d="M 6 8 L 8 10 L 12 5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
            <text x="16" y="10.5" fill="#10b981" fontSize="7" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'أصل محفوظ' : 'KEEP ORIGINAL'}
            </text>
          </g>
        </g>

        {/* ========================================================================= */}
        {/* RIGHT PAIR: DUPLICATE COPY (To Quarantine) */}
        {/* ========================================================================= */}
        <g className="df-tile-right-top" transform="translate(390, 60)">
          <rect
            width="100"
            height="62"
            rx="10"
            fill="url(#dfCardFillRight)"
            stroke="rgba(244, 63, 94, 0.3)"
            strokeWidth="1"
          />
          <path d="M 2 12 Q 50 16 98 12 L 98 2 Q 50 2 2 2 Z" fill="rgba(255, 255, 255, 0.04)" />
          <rect x="10" y="10" width="22" height="22" rx="6" fill="rgba(244, 63, 94, 0.12)" />
          <path
            d="M 15 24 L 19 19 L 23 23 L 27 17 L 31 24"
            stroke="#f43f5e"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="18" cy="15" r="1.5" fill="#f43f5e" />
          <text x="38" y="20" fill="#cbd5e1" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            IMG_4082 (1).jpg
          </text>
          <text x="38" y="29" fill="#64748b" fontSize="7.5" fontFamily="monospace">
            4.2 MB · MATCH
          </text>
          <g transform="translate(10, 40)">
            <rect width="64" height="15" rx="4" fill="rgba(244, 63, 94, 0.12)" stroke="rgba(244, 63, 94, 0.35)" strokeWidth="0.75" />
            <path d="M 6 5 L 12 11 M 12 5 L 6 11" stroke="#f43f5e" strokeWidth="1.2" strokeLinecap="round" />
            <text x="16" y="10.5" fill="#f43f5e" fontSize="7" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'نسخة للعزل' : 'QUARANTINE'}
            </text>
          </g>
        </g>

        {/* ========================================================================= */}
        {/* LOWER LEFT TILE: Document Pair Keeper */}
        {/* ========================================================================= */}
        <g className="df-tile-left-bottom" transform="translate(90, 180)">
          <rect
            width="96"
            height="58"
            rx="10"
            fill="url(#dfCardFillLeft)"
            stroke="url(#dfGlassBorder)"
            strokeWidth="1"
          />
          <rect x="8" y="9" width="20" height="20" rx="5" fill="rgba(99, 102, 241, 0.18)" />
          <path d="M 13 15 L 21 15 M 13 19 L 23 19 M 13 23 L 19 23" stroke="#818cf8" strokeWidth="1.3" strokeLinecap="round" />
          <text x="34" y="18" fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">
            Project_Spec.pdf
          </text>
          <text x="34" y="27" fill="#64748b" fontSize="7" fontFamily="monospace">
            18.6 MB · Verified
          </text>
          <g transform="translate(8, 36)">
            <rect width="58" height="14" rx="4" fill="rgba(16, 185, 129, 0.12)" stroke="rgba(16, 185, 129, 0.35)" strokeWidth="0.75" />
            <path d="M 5 7 L 7 9 L 11 4" stroke="#10b981" strokeWidth="1.1" strokeLinecap="round" />
            <text x="14" y="9.5" fill="#10b981" fontSize="6.5" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'محفوظ' : 'PRESERVED'}
            </text>
          </g>
        </g>

        {/* ========================================================================= */}
        {/* LOWER RIGHT TILE: Document Duplicate */}
        {/* ========================================================================= */}
        <g className="df-tile-right-bottom" transform="translate(414, 180)">
          <rect
            width="96"
            height="58"
            rx="10"
            fill="url(#dfCardFillRight)"
            stroke="rgba(244, 63, 94, 0.3)"
            strokeWidth="1"
          />
          <rect x="8" y="9" width="20" height="20" rx="5" fill="rgba(244, 63, 94, 0.12)" />
          <path d="M 13 15 L 21 15 M 13 19 L 23 19 M 13 23 L 19 23" stroke="#f43f5e" strokeWidth="1.3" strokeLinecap="round" />
          <text x="34" y="18" fill="#cbd5e1" fontSize="8.5" fontWeight="600" fontFamily="sans-serif">
            Copy_Spec.pdf
          </text>
          <text x="34" y="27" fill="#64748b" fontSize="7" fontFamily="monospace">
            18.6 MB · Extra
          </text>
          <g transform="translate(8, 36)">
            <rect width="58" height="14" rx="4" fill="rgba(244, 63, 94, 0.12)" stroke="rgba(244, 63, 94, 0.35)" strokeWidth="0.75" />
            <path d="M 5 4 L 9 10 M 9 4 L 5 10" stroke="#f43f5e" strokeWidth="1.1" strokeLinecap="round" />
            <text x="13" y="9.5" fill="#f43f5e" fontSize="6.5" fontWeight="600" fontFamily="sans-serif">
              {lang === 'ar' ? 'عزل آمن' : 'RECOVERABLE'}
            </text>
          </g>
        </g>

        {/* ========================================================================= */}
        {/* CENTRAL TRANSLUCENT STORAGE CORE */}
        {/* ========================================================================= */}
        <g className="df-central-chamber" transform="translate(300, 160)">
          {/* Outer Glass Ring */}
          <circle
            r="64"
            fill="url(#dfGlassFill)"
            stroke="url(#dfGlassBorder)"
            strokeWidth="1.5"
            className="df-outer-ring"
          />

          {/* Concentric Scanner Trace */}
          <circle
            r="54"
            fill="none"
            stroke="rgba(56, 189, 248, 0.25)"
            strokeWidth="1"
            strokeDasharray={isScanning ? '15 8' : '8 6'}
            className={isScanning ? 'df-scan-ring' : 'df-idle-ring'}
          />

          {/* Inner Chamber */}
          <circle
            r="42"
            fill="rgba(4, 15, 28, 0.85)"
            stroke="rgba(125, 232, 255, 0.3)"
            strokeWidth="1.2"
          />

          {/* Core Emblem / Brand Icon */}
          <g transform="translate(-18, -18)">
            <rect
              width="36"
              height="36"
              rx="9"
              fill="rgba(56, 189, 248, 0.12)"
              stroke="rgba(56, 189, 248, 0.4)"
              strokeWidth="1"
            />
            <rect
              x="9"
              y="11"
              width="14"
              height="16"
              rx="2.5"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.4"
            />
            <rect
              x="13"
              y="7"
              width="14"
              height="16"
              rx="2.5"
              fill="rgba(56, 189, 248, 0.2)"
              stroke="#7ee8ff"
              strokeWidth="1.4"
            />
          </g>

          {/* Status Label Beneath Center */}
          <text
            x="0"
            y="78"
            textAnchor="middle"
            fill="rgba(148, 163, 184, 0.85)"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="0.08em"
          >
            {isScanning
              ? (lang === 'ar' ? 'جارٍ مقارنة البصمات' : 'COMPARING SHA-256 HASHES')
              : isVerified
              ? (lang === 'ar' ? 'تم تأكيد التماثل' : 'CONTENT IDENTICAL')
              : (lang === 'ar' ? 'نواة فحص التكرارات' : 'INTEGRITY ENGINE')}
          </text>
        </g>
      </svg>
    </div>
  );
};
