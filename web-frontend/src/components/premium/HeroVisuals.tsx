import {
  Cpu, Layers, Shield, Wifi,
  FileText, Database, Globe,
  Terminal, Activity, Radio, Code2
} from 'lucide-react';
import type { SystemSnapshot } from '../../lib/api';

interface FamilyHeroVisualProps {
  lang: 'en' | 'ar';
  systemSnapshot?: SystemSnapshot | null;
}

/**
 * 1. SYSTEM VITALITY HERO SCENE (P0-03 & P1-02)
 * - 420x260 Cinematic Holographic Scene vector-locked to the hero banner
 * - 3D perspective floor grid receding to a glowing horizon line
 * - Concentric vital aura resonance rings with radial calibration tick marks
 * - Dynamic sweeping neon cardiogram heartbeat waveform spanning the lower midground
 * - Right-side uppercase slogan: REAL-TIME / HEALTH / LASTING / PERFORMANCE
 * - Truthful telemetry from systemSnapshot (CPU, RAM) or "Unavailable" (NEVER fake)
 */
export function VitalityHoloVisual({ lang, systemSnapshot }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  const cpuDisplay = typeof systemSnapshot?.CpuLoad === 'number'
    ? `${systemSnapshot.CpuLoad}%`
    : (isRtl ? 'غير متوفر' : 'Unavailable');

  const hasRam = typeof systemSnapshot?.TotalRamGB === 'number' &&
    typeof systemSnapshot?.FreeRamGB === 'number' &&
    systemSnapshot.TotalRamGB > 0;

  const ramPct = hasRam
    ? Math.round(((systemSnapshot!.TotalRamGB - systemSnapshot!.FreeRamGB!) / systemSnapshot!.TotalRamGB) * 100)
    : null;

  const ramDisplay = ramPct !== null
    ? `${ramPct}%`
    : (isRtl ? 'غير متوفر' : 'Unavailable');

  return (
    <div className="relative w-full max-w-[420px] h-[260px] flex items-center justify-center select-none overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Volumetric Radial Glows */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-56 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-violet-600/25 rounded-full blur-3xl pointer-events-none" />

      <svg className="w-full h-full" viewBox="0 0 420 260" fill="none">
        <defs>
          <linearGradient id="vitHeartbeatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
            <stop offset="25%" stopColor="#22D3EE" />
            <stop offset="55%" stopColor="#818CF8" />
            <stop offset="75%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.15)" />
          </linearGradient>
          <linearGradient id="vitRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
          <filter id="vitGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background: 3D Perspective Grid Floor ── */}
        <g opacity="0.32" stroke="rgba(34,211,238,0.25)" strokeWidth="0.8">
          <line x1="15" y1="205" x2="405" y2="205" />
          <line x1="10" y1="222" x2="410" y2="222" />
          <line x1="5" y1="242" x2="415" y2="242" />
          {/* Perspective Vanishing Rays */}
          <line x1="155" y1="170" x2="15" y2="255" strokeDasharray="3 3" />
          <line x1="155" y1="170" x2="85" y2="255" strokeDasharray="3 3" />
          <line x1="155" y1="170" x2="155" y2="255" />
          <line x1="155" y1="170" x2="235" y2="255" strokeDasharray="3 3" />
          <line x1="155" y1="170" x2="315" y2="255" strokeDasharray="3 3" />
          <line x1="155" y1="170" x2="405" y2="255" strokeDasharray="3 3" />
        </g>

        {/* ── Midground: Concentric Vital Resonance Rings ── */}
        <g transform="translate(155, 105)">
          {/* Calibration Ring with Tick Marks */}
          <circle cx="0" cy="0" r="70" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          {[...Array(24)].map((_, i) => {
            const angle = (i * 15 * Math.PI) / 180;
            const x1 = Math.cos(angle) * 67;
            const y1 = Math.sin(angle) * 67;
            const x2 = Math.cos(angle) * 72;
            const y2 = Math.sin(angle) * 72;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 === 0 ? '#22D3EE' : 'rgba(255,255,255,0.18)'} strokeWidth={i % 3 === 0 ? 1.5 : 0.8} />;
          })}

          {/* Main Luminous Vital Ring */}
          <circle cx="0" cy="0" r="58" stroke="url(#vitRingGrad)" strokeWidth="2.8" filter="url(#vitGlow)" />
          <circle cx="0" cy="0" r="48" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" strokeDasharray="4 6" />
          <circle cx="0" cy="0" r="38" fill="rgba(8,14,35,0.88)" stroke="rgba(34,211,238,0.5)" strokeWidth="1.4" />

          {/* Center Vital Resonance Symbol */}
          <path
            d="M -20,0 L -10,0 L -5,-14 L 0,14 L 5,-8 L 10,0 L 20,0"
            stroke="#22D3EE"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#vitGlow)"
          />
        </g>

        {/* ── Sweeping Neon Cardiogram Wave Across Lower Ground ── */}
        <g transform="translate(0, 5)">
          <path
            d="M 15,185 L 75,185 L 86,168 L 96,204 L 106,155 L 116,202 L 126,185 L 180,185 L 190,168 L 200,208 L 210,150 L 220,204 L 230,185 L 290,185 L 300,168 L 310,204 L 320,155 L 330,202 L 340,185 L 405,185"
            stroke="rgba(34,211,238,0.38)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#vitGlow)"
          />
          <path
            d="M 15,185 L 75,185 L 86,168 L 96,204 L 106,155 L 116,202 L 126,185 L 180,185 L 190,168 L 200,208 L 210,150 L 220,204 L 230,185 L 290,185 L 300,168 L 310,204 L 320,155 L 330,202 L 340,185 L 405,185"
            stroke="url(#vitHeartbeatGrad)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* Floating Telemetry Chips (Factual / Truthful Only) */}
      <div className="absolute top-4 left-3 flex flex-col gap-1.5 z-10 w-[125px]">
        {/* CPU Chip */}
        <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-cyan-500/30 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
            <Cpu size={12} className="text-cyan-400" />
            <span>CPU</span>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-300">{cpuDisplay}</span>
        </div>

        {/* RAM Chip */}
        <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-violet-500/30 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
            <Layers size={12} className="text-violet-400" />
            <span>RAM</span>
          </div>
          <span className="text-xs font-mono font-bold text-violet-300">{ramDisplay}</span>
        </div>
      </div>

      {/* Right Column: Slogan Language Pack (From P1-02) */}
      <div className="absolute top-6 right-3 flex flex-col items-end text-right z-10 select-none">
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'في الوقت الفعلي' : 'REAL-TIME'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'صحة النظام' : 'HEALTH'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-violet-400/90 leading-tight uppercase mt-0.5">
          {isRtl ? 'كفاءة دائمة' : 'LASTING'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-violet-400/90 leading-tight uppercase">
          {isRtl ? 'أداء متفوق' : 'PERFORMANCE'}
        </div>
      </div>

      {/* Bottom Conceptual Ground Tag */}
      <div className="absolute bottom-1 w-full text-center text-[9px] font-mono font-bold tracking-widest text-cyan-300/70 uppercase">
        {isRtl ? 'مراقبة صحة النظام • تشخيص فوري' : 'VITALITY TELEMETRY • ACTIVE MONITOR'}
      </div>
    </div>
  );
}

/**
 * 2. RECOVERY & STORAGE HERO SCENE (P0-04 & P1-02)
 * - 420x260 Cinematic Holographic Scene vector-locked to the hero banner
 * - Large 4-tier 3D cylindrical storage disk stack with glowing platters and laser bus lines
 * - Base concentric ground ripples with radial tick tracks
 * - Translucent floating data cards (Partition Architecture, Volume Shadow)
 * - Right-side uppercase slogan: SAFE / RECOVERY / BRIGHTER / TOMORROWS
 * - Purely architectural conceptual labels, ZERO fabricated numbers
 */
export function RecoveryHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative w-full max-w-[420px] h-[260px] flex items-center justify-center select-none overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Volumetric Radial Bloom */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-56 bg-cyan-500/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-sky-600/20 rounded-full blur-3xl pointer-events-none" />

      <svg className="w-full h-full" viewBox="0 0 420 260" fill="none">
        <defs>
          <linearGradient id="recCylTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id="recCylBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#082F49" />
            <stop offset="50%" stopColor="#0E7490" />
            <stop offset="100%" stopColor="#083344" />
          </linearGradient>
          <linearGradient id="recRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#00F2FE" />
          </linearGradient>
          <filter id="recGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background: Elliptical Recovery Orbit Field ── */}
        <g opacity="0.35" stroke="rgba(34,211,238,0.4)" strokeWidth="1.1">
          <ellipse cx="185" cy="130" rx="170" ry="60" fill="none" strokeDasharray="6 6" />
          <ellipse cx="185" cy="130" rx="130" ry="44" fill="none" stroke="rgba(56,189,248,0.3)" />
        </g>

        {/* ── Base Concentric Ground Stage ── */}
        <ellipse cx="185" cy="205" rx="125" ry="26" fill="rgba(6,182,212,0.06)" stroke="rgba(34,211,238,0.4)" strokeWidth="1.4" strokeDasharray="8 6" />
        <ellipse cx="185" cy="205" rx="90" ry="18" fill="none" stroke="#22D3EE" strokeWidth="1" opacity="0.6" />

        {/* ── Midground: 4-Tier 3D Cylindrical Storage Stack ── */}
        <g transform="translate(185, 115)">
          {/* Tier 1 (Bottom Platter) */}
          <path d="M -58,38 C -58,52 58,52 58,38 L 58,62 C 58,76 -58,76 -58,62 Z" fill="url(#recCylBodyGrad)" stroke="#0284C7" strokeWidth="1.4" />
          <ellipse cx="0" cy="38" rx="58" ry="14" fill="url(#recCylTopGrad)" fillOpacity="0.45" stroke="url(#recRingGrad)" strokeWidth="1.8" />
          <ellipse cx="0" cy="50" rx="58" ry="14" fill="none" stroke="#22D3EE" strokeWidth="1.4" opacity="0.7" />

          {/* Tier 2 (Lower-Middle Platter) */}
          <path d="M -58,8 C -58,22 58,22 58,8 L 58,32 C 58,46 -58,46 -58,32 Z" fill="url(#recCylBodyGrad)" stroke="#0284C7" strokeWidth="1.4" />
          <ellipse cx="0" cy="8" rx="58" ry="14" fill="url(#recCylTopGrad)" fillOpacity="0.55" stroke="url(#recRingGrad)" strokeWidth="1.8" />
          <ellipse cx="0" cy="20" rx="58" ry="14" fill="none" stroke="#22D3EE" strokeWidth="1.4" opacity="0.7" />

          {/* Tier 3 (Upper-Middle Platter) */}
          <path d="M -58,-22 C -58,-8 58,-8 58,-22 L 58,2 C 58,16 -58,16 -58,2 Z" fill="url(#recCylBodyGrad)" stroke="#0284C7" strokeWidth="1.4" />
          <ellipse cx="0" cy="-22" rx="58" ry="14" fill="url(#recCylTopGrad)" fillOpacity="0.65" stroke="url(#recRingGrad)" strokeWidth="1.8" />
          <ellipse cx="0" cy="-10" rx="58" ry="14" fill="none" stroke="#22D3EE" strokeWidth="1.4" opacity="0.7" />

          {/* Tier 4 (Top Platter) */}
          <path d="M -58,-52 C -58,-38 58,-38 58,-52 L 58,-28 C 58,-14 -58,-14 -58,-28 Z" fill="url(#recCylBodyGrad)" stroke="#0284C7" strokeWidth="1.4" />
          <ellipse cx="0" cy="-52" rx="58" ry="14" fill="url(#recCylTopGrad)" fillOpacity="0.85" stroke="url(#recRingGrad)" strokeWidth="2.2" filter="url(#recGlow)" />
          <ellipse cx="0" cy="-40" rx="58" ry="14" fill="none" stroke="#22D3EE" strokeWidth="1.6" opacity="0.8" />

          {/* Vertical Bus Rays */}
          <line x1="-52" y1="-46" x2="-52" y2="60" stroke="#38BDF8" strokeWidth="1.4" opacity="0.7" strokeDasharray="3 3" />
          <line x1="52" y1="-46" x2="52" y2="60" stroke="#38BDF8" strokeWidth="1.4" opacity="0.7" strokeDasharray="3 3" />
          <line x1="0" y1="-46" x2="0" y2="60" stroke="#22D3EE" strokeWidth="1.8" opacity="0.8" />
        </g>

        {/* Floating Restore Shield Core at Tower Center */}
        <g transform="translate(185, 115)">
          <circle cx="0" cy="0" r="19" fill="rgba(8,14,35,0.9)" stroke="#22D3EE" strokeWidth="1.8" filter="url(#recGlow)" />
          <path d="M 0,-10 L 8,-4 L 7,5 C 5,10 0,13 0,13 C 0,13 -5,10 -7,5 L -8,-4 Z" fill="rgba(34,211,238,0.3)" stroke="#38BDF8" strokeWidth="1.4" />
        </g>
      </svg>

      {/* Floating Glass Data Cards (Conceptual / No Fabricated Telemetry) */}
      <div className="absolute top-4 left-3 px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_18px_rgba(34,211,238,0.25)] flex items-center gap-2 z-10 transform -rotate-2">
        <FileText size={13} className="text-cyan-400" />
        <span className="text-[11px] font-bold text-white">{isRtl ? 'بنية التقسيم' : 'Partition Map'}</span>
      </div>

      <div className="absolute bottom-7 left-4 px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_18px_rgba(34,211,238,0.25)] flex items-center gap-2 z-10 transform rotate-2">
        <Database size={13} className="text-sky-400" />
        <span className="text-[11px] font-bold text-white">{isRtl ? 'نسخ الظل' : 'Volume Shadow'}</span>
      </div>

      {/* Right Column: Slogan Language Pack (From P1-02) */}
      <div className="absolute top-6 right-3 flex flex-col items-end text-right z-10 select-none">
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'استعادة' : 'SAFE'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'آمنة' : 'RECOVERY'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-sky-400/90 leading-tight uppercase mt-0.5">
          {isRtl ? 'مستقبل' : 'BRIGHTER'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-sky-400/90 leading-tight uppercase">
          {isRtl ? 'أفضل' : 'TOMORROWS'}
        </div>
      </div>

      {/* Bottom Ground Tag */}
      <div className="absolute bottom-1 w-full text-center text-[9px] font-mono font-bold tracking-widest text-cyan-300/70 uppercase">
        {isRtl ? 'استعادة البيانات • حماية ما يهمك' : 'RECOVER MORE • LOSE LESS'}
      </div>
    </div>
  );
}

/**
 * 3. ASSURANCE HERO SCENE (P0-05 & P1-02)
 * - 420x260 Cinematic Holographic Scene vector-locked to the hero banner
 * - Large 3D faceted crystal security shield (140px) standing on concentric base pedestal
 * - Perimeter cyber topology traces connecting satellite security nodes
 * - Right-side uppercase slogan: PROTECTION / YOU CAN TRUST / TODAY / TOMORROW / ALWAYS
 * - Uses real Defender state from systemSnapshot or "Evidence Unavailable", NO fake statuses
 */
export function AssuranceHoloVisual({ lang, systemSnapshot }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  const defenderStatus = systemSnapshot?.DefenderRealtime === true
    ? (isRtl ? 'نشط' : 'Active')
    : systemSnapshot?.DefenderRealtime === false
      ? (isRtl ? 'معطل' : 'Inactive')
      : (isRtl ? 'غير متوفر' : 'Unavailable');

  return (
    <div className="relative w-full max-w-[420px] h-[260px] flex items-center justify-center select-none overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Volumetric Radial Bloom */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

      <svg className="w-full h-full" viewBox="0 0 420 260" fill="none">
        <defs>
          <linearGradient id="assShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="45%" stopColor="#06B6FF" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <filter id="assGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background: Cyber Security Grid & Perimeter Rings ── */}
        <g opacity="0.32" stroke="rgba(52,211,153,0.35)" strokeWidth="0.9">
          <ellipse cx="180" cy="130" rx="165" ry="62" fill="none" strokeDasharray="6 6" />
          <ellipse cx="180" cy="130" rx="125" ry="44" fill="none" stroke="rgba(34,211,238,0.3)" />
        </g>

        {/* Base Stage Pedestal */}
        <ellipse cx="180" cy="205" rx="115" ry="24" fill="rgba(16,185,129,0.08)" stroke="#10B981" strokeWidth="1.4" strokeDasharray="6 4" />
        <ellipse cx="180" cy="205" rx="80" ry="16" fill="none" stroke="#22D3EE" strokeWidth="1" opacity="0.7" />

        {/* Connecting Topology Bus Lines */}
        <g stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="4 4">
          <line x1="85" y1="65" x2="145" y2="105" />
          <line x1="80" y1="175" x2="145" y2="145" />
          <line x1="275" y1="65" x2="215" y2="105" />
        </g>

        {/* ── Midground: Majestic Faceted 3D Security Shield ── */}
        <g transform="translate(180, 110)">
          <path
            d="M 0,-64 L 48,-38 L 40,20 C 33,50 0,68 0,68 C 0,68 -33,50 -40,20 L -48,-38 Z"
            fill="url(#assShieldGrad)"
            fillOpacity="0.25"
            stroke="url(#assShieldGrad)"
            strokeWidth="2.5"
            filter="url(#assGlow)"
          />
          <path
            d="M 0,-64 L 0,68 M 0,-64 L 40,20 M 0,-64 L -40,20"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.2"
          />
          <path
            d="M -18,-5 L -5,9 L 20,-17"
            stroke="#22D3EE"
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#assGlow)"
          />
        </g>
      </svg>

      {/* Floating Topology Nodes (Conceptual + Factual Defender State) */}
      <div className="absolute top-4 left-3 px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center gap-1.5 z-10">
        <Wifi size={12} className="text-cyan-400" />
        <span className="text-[11px] font-bold text-white">{isRtl ? 'جدار الحماية' : 'Firewall Bus'}</span>
      </div>

      <div className="absolute bottom-7 left-4 px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-emerald-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center gap-1.5 z-10">
        <Shield size={12} className="text-emerald-400" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-white">{isRtl ? 'ديفندر' : 'Defender'}</span>
          <span className="text-[9px] font-mono text-emerald-300">{defenderStatus}</span>
        </div>
      </div>

      {/* Right Column: Slogan Language Pack (From P1-02) */}
      <div className="absolute top-6 right-3 flex flex-col items-end text-right z-10 select-none">
        <div className="text-[10px] font-mono font-black tracking-widest text-emerald-400/90 leading-tight uppercase">
          {isRtl ? 'حماية' : 'PROTECTION'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-emerald-400/90 leading-tight uppercase">
          {isRtl ? 'تثق بها' : 'YOU CAN TRUST'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase mt-0.5">
          {isRtl ? 'اليوم' : 'TODAY'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'غداً' : 'TOMORROW'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'ودائماً' : 'ALWAYS'}
        </div>
      </div>

      {/* Bottom Ground Tag */}
      <div className="absolute bottom-1 w-full text-center text-[9px] font-mono font-bold tracking-widest text-emerald-300/70 uppercase">
        {isRtl ? 'ضمان أمان النظام • وقاية استباقية' : 'PREVENT ISSUES • STAY SECURE'}
      </div>
    </div>
  );
}

/**
 * 4. SOFTWARE LIBRARY HERO SCENE (P0-06 & P1-02)
 * - 420x260 Cinematic Holographic Scene vector-locked to the hero banner
 * - Cluster of 5 distinct 3D isometric app cubes floating in space at varied depths and elevations
 * - Circular multi-tier luminous platform stage with projection rays
 * - Right-side uppercase slogan: DISCOVER / INSTALL / OPTIMIZE / DO MORE
 * - Purely conceptual software architecture, ZERO fabricated counts
 */
export function SoftwareHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative w-full max-w-[420px] h-[260px] flex items-center justify-center select-none overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Volumetric Radial Bloom */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-56 bg-purple-500/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      <svg className="w-full h-full" viewBox="0 0 420 260" fill="none">
        <defs>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background: Radial Platform Rings ── */}
        <g opacity="0.35" stroke="rgba(192,132,252,0.4)" strokeWidth="1.1">
          <ellipse cx="180" cy="130" rx="170" ry="60" fill="none" strokeDasharray="6 6" />
          <ellipse cx="180" cy="130" rx="130" ry="44" fill="none" stroke="rgba(56,189,248,0.3)" />
        </g>

        {/* Base Stage */}
        <ellipse cx="180" cy="205" rx="120" ry="26" fill="rgba(168,85,247,0.08)" stroke="#A855F7" strokeWidth="1.4" strokeDasharray="6 4" />
        <ellipse cx="180" cy="205" rx="85" ry="17" fill="none" stroke="#22D3EE" strokeWidth="1" opacity="0.7" />

        {/* Laser Projection Rays from Stage to Cubes */}
        <g stroke="rgba(192,132,252,0.35)" strokeWidth="1.1" strokeDasharray="3 3">
          <line x1="180" y1="205" x2="180" y2="110" />
          <line x1="180" y1="205" x2="105" y2="75" />
          <line x1="180" y1="205" x2="255" y2="75" />
          <line x1="180" y1="205" x2="90" y2="155" />
          <line x1="180" y1="205" x2="265" y2="155" />
        </g>

        {/* ── Cube 1: Central Hero App Cube (Center) ── */}
        <g transform="translate(180, 110)">
          <polygon points="0,-32 28,-16 0,0 -28,-16" fill="rgba(192,132,252,0.45)" stroke="#C084FC" strokeWidth="1.5" filter="url(#softGlow)" />
          <polygon points="-28,-16 0,0 0,32 -28,16" fill="rgba(147,51,234,0.35)" stroke="#A855F7" strokeWidth="1.5" />
          <polygon points="0,0 28,-16 28,16 0,32" fill="rgba(59,130,246,0.3)" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="-10" y1="16" x2="10" y2="16" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" filter="url(#softGlow)" />
          <line x1="0" y1="6" x2="0" y2="26" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" filter="url(#softGlow)" />
        </g>

        {/* ── Cube 2: Web & Browser Cube (Upper-Left) ── */}
        <g transform="translate(105, 75)">
          <polygon points="0,-20 18,-10 0,0 -18,-10" fill="rgba(34,211,238,0.4)" stroke="#22D3EE" strokeWidth="1.3" />
          <polygon points="-18,-10 0,0 0,20 -18,10" fill="rgba(14,165,233,0.3)" stroke="#0284C7" strokeWidth="1.3" />
          <polygon points="0,0 18,-10 18,10 0,20" fill="rgba(99,102,241,0.3)" stroke="#6366F1" strokeWidth="1.3" />
        </g>

        {/* ── Cube 3: Dev & Code Cube (Upper-Right) ── */}
        <g transform="translate(255, 75)">
          <polygon points="0,-20 18,-10 0,0 -18,-10" fill="rgba(168,85,247,0.4)" stroke="#A855F7" strokeWidth="1.3" />
          <polygon points="-18,-10 0,0 0,20 -18,10" fill="rgba(124,58,237,0.3)" stroke="#7C3AED" strokeWidth="1.3" />
          <polygon points="0,0 18,-10 18,10 0,20" fill="rgba(236,72,153,0.3)" stroke="#EC4899" strokeWidth="1.3" />
        </g>

        {/* ── Cube 4: Terminal / CLI Cube (Lower-Left) ── */}
        <g transform="translate(90, 155)">
          <polygon points="0,-16 15,-8 0,0 -15,-8" fill="rgba(129,140,248,0.4)" stroke="#818CF8" strokeWidth="1.1" />
          <polygon points="-15,-8 0,0 0,16 -15,8" fill="rgba(99,102,241,0.3)" stroke="#6366F1" strokeWidth="1.1" />
          <polygon points="0,0 15,-8 15,8 0,16" fill="rgba(34,211,238,0.3)" stroke="#22D3EE" strokeWidth="1.1" />
        </g>

        {/* ── Cube 5: Packages & Frameworks Cube (Lower-Right) ── */}
        <g transform="translate(265, 155)">
          <polygon points="0,-16 15,-8 0,0 -15,-8" fill="rgba(236,72,153,0.4)" stroke="#EC4899" strokeWidth="1.1" />
          <polygon points="-15,-8 0,0 0,16 -15,8" fill="rgba(217,70,239,0.3)" stroke="#D946EF" strokeWidth="1.1" />
          <polygon points="0,0 15,-8 15,8 0,16" fill="rgba(168,85,247,0.3)" stroke="#A855F7" strokeWidth="1.1" />
        </g>
      </svg>

      {/* Floating Module Labels (Conceptual Only) */}
      <div className="absolute top-4 left-3 px-2 py-1.5 rounded-xl bg-slate-900/85 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center gap-1.5 z-10 transform -rotate-2">
        <Globe size={12} className="text-cyan-300" />
        <span className="text-[10px] font-bold text-white">{isRtl ? 'المتصفحات' : 'Web Hub'}</span>
      </div>

      <div className="absolute bottom-7 left-4 px-2 py-1.5 rounded-xl bg-slate-900/85 border border-purple-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.25)] flex items-center gap-1.5 z-10 transform rotate-2">
        <Terminal size={12} className="text-purple-300" />
        <span className="text-[10px] font-bold text-white">{isRtl ? 'بيئات التطوير' : 'Dev Runtimes'}</span>
      </div>

      {/* Right Column: Slogan Language Pack (From P1-02) */}
      <div className="absolute top-6 right-3 flex flex-col items-end text-right z-10 select-none">
        <div className="text-[10px] font-mono font-black tracking-widest text-purple-400/90 leading-tight uppercase">
          {isRtl ? 'اكتشف' : 'DISCOVER'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-purple-400/90 leading-tight uppercase">
          {isRtl ? 'تثبيت' : 'INSTALL'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase mt-0.5">
          {isRtl ? 'تحسين' : 'OPTIMIZE'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'المزيد' : 'DO MORE'}
        </div>
      </div>

      {/* Bottom Ground Tag */}
      <div className="absolute bottom-1 w-full text-center text-[9px] font-mono font-bold tracking-widest text-purple-300/70 uppercase">
        {isRtl ? 'جميع البرامج في مكان واحد' : 'ALL THE TOOLS • A BRIGHTER PC'}
      </div>
    </div>
  );
}

/**
 * 5. ENGINEERING WORKBENCH HERO SCENE (P0-07 & P1-02)
 * - 420x260 Cinematic Holographic Scene vector-locked to the hero banner
 * - 3-tier stacked isometric glass architecture planes (Presentation, API, Core Runtime)
 * - Vertical interconnect conduits and neon corner pillars
 * - Floating framework runtime chips (React, Node.js, Python, Docker)
 * - Right-side uppercase slogan: DEEP INSIGHTS / REAL-TIME DATA / PRODUCTION / READY
 * - Purely architectural conceptual syntax, ZERO fabricated telemetry
 */
export function WorkbenchHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative w-full max-w-[420px] h-[260px] flex items-center justify-center select-none overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Volumetric Radial Bloom */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-56 bg-violet-500/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      <svg className="w-full h-full" viewBox="0 0 420 260" fill="none">
        <defs>
          <linearGradient id="wbPlane1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.5)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0.15)" />
          </linearGradient>
          <linearGradient id="wbPlane2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(129,140,248,0.5)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0.15)" />
          </linearGradient>
          <linearGradient id="wbPlane3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(192,132,252,0.5)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.15)" />
          </linearGradient>
          <filter id="wbGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background: Blueprint Technical Grid ── */}
        <g opacity="0.28" stroke="rgba(129,140,248,0.3)" strokeWidth="0.8">
          <line x1="15" y1="200" x2="405" y2="200" />
          <line x1="30" y1="220" x2="390" y2="220" />
          <line x1="180" y1="25" x2="180" y2="245" strokeDasharray="3 3" />
        </g>

        {/* ── 3-Tier Stacked Isometric Architecture Planes ── */}
        <g transform="translate(180, 110)">
          {/* Bottom Layer: Core & Storage */}
          <polygon points="0,52 65,20 0,-12 -65,20" fill="url(#wbPlane3)" stroke="#A855F7" strokeWidth="1.5" />
          {/* Middle Layer: Services & API */}
          <polygon points="0,20 65,-12 0,-44 -65,-12" fill="url(#wbPlane2)" stroke="#818CF8" strokeWidth="1.5" />
          {/* Top Layer: Presentation & UI */}
          <polygon points="0,-12 65,-44 0,-76 -65,-44" fill="url(#wbPlane1)" stroke="#22D3EE" strokeWidth="1.8" filter="url(#wbGlow)" />

          {/* Vertical Interconnect Conduits */}
          <line x1="0" y1="-76" x2="0" y2="52" stroke="#22D3EE" strokeWidth="1.6" strokeDasharray="4 3" />
          <line x1="-65" y1="-44" x2="-65" y2="20" stroke="#818CF8" strokeWidth="1.1" opacity="0.7" />
          <line x1="65" y1="-44" x2="65" y2="20" stroke="#818CF8" strokeWidth="1.1" opacity="0.7" />
        </g>

        {/* Connecting Traces to Floating Framework Chips */}
        <g stroke="rgba(34,211,238,0.4)" strokeWidth="1.1" strokeDasharray="3 3">
          <line x1="85" y1="65" x2="140" y2="80" />
          <line x1="85" y1="170" x2="140" y2="145" />
          <line x1="275" y1="65" x2="220" y2="80" />
        </g>
      </svg>

      {/* Floating Runtime Chips (Conceptual Architecture Tags) */}
      <div className="absolute top-4 left-3 px-2 py-1 rounded-xl bg-slate-900/90 border border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.3)] flex items-center gap-1.5 z-10">
        <Code2 size={11} className="text-cyan-400" />
        <span className="text-[10px] font-bold font-mono text-cyan-300">React • Node.js</span>
      </div>

      <div className="absolute bottom-7 left-4 px-2 py-1 rounded-xl bg-slate-900/90 border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 z-10">
        <Terminal size={11} className="text-emerald-400" />
        <span className="text-[10px] font-bold font-mono text-emerald-300">Python • Docker</span>
      </div>

      {/* Right Column: Slogan Language Pack (From P1-02) */}
      <div className="absolute top-6 right-3 flex flex-col items-end text-right z-10 select-none">
        <div className="text-[10px] font-mono font-black tracking-widest text-indigo-400/90 leading-tight uppercase">
          {isRtl ? 'رؤى عميقة' : 'DEEP INSIGHTS'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'بيانات لحظية' : 'REAL-TIME DATA'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-violet-400/90 leading-tight uppercase mt-0.5">
          {isRtl ? 'جاهزية كاملة' : 'PRODUCTION'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-violet-400/90 leading-tight uppercase">
          {isRtl ? 'للإنتاج' : 'READY'}
        </div>
      </div>

      {/* Bottom Ground Tag */}
      <div className="absolute bottom-1 w-full text-center text-[9px] font-mono font-bold tracking-widest text-indigo-300/70 uppercase">
        {isRtl ? 'بناء أذكى • نشر أكثر أماناً' : 'BUILD SMARTER • SHIP SAFER'}
      </div>
    </div>
  );
}

/**
 * 6. INVESTIGATION HERO SCENE (P0-08 & P1-02)
 * - 420x260 Cinematic Holographic Scene vector-locked to the hero banner
 * - Large holographic forensic optical lens (155px) with targeting reticle and radar sweep beam
 * - Polar coordinate radar grid with 360° degree markers and range circles
 * - Floating HUD telemetry panes using real Processes from systemSnapshot or "Evidence Unavailable"
 * - Right-side uppercase slogan: DEEPER / INSIGHTS / CLEARER / ANSWERS
 * - ZERO fabricated error/warning counts or fake health statuses
 */
export function InvestigationHoloVisual({ lang, systemSnapshot }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  const processDisplay = typeof systemSnapshot?.Processes === 'number'
    ? `${systemSnapshot.Processes} Processes`
    : (isRtl ? 'غير متوفر' : 'Unavailable');

  return (
    <div className="relative w-full max-w-[420px] h-[260px] flex items-center justify-center select-none overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Volumetric Radial Bloom */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-56 bg-blue-500/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

      <svg className="w-full h-full" viewBox="0 0 420 260" fill="none">
        <defs>
          <linearGradient id="invRadarBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.65)" />
            <stop offset="60%" stopColor="rgba(6,182,212,0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="invGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background: Polar Radar Coordinates ── */}
        <g opacity="0.32" stroke="rgba(34,211,238,0.35)" strokeWidth="0.8">
          <circle cx="180" cy="110" r="90" fill="none" />
          <circle cx="180" cy="110" r="68" fill="none" strokeDasharray="4 4" />
          <circle cx="180" cy="110" r="45" fill="none" />
          <circle cx="180" cy="110" r="22" fill="none" />
          {/* Crosshair Axes */}
          <line x1="75" y1="110" x2="285" y2="110" strokeDasharray="3 3" />
          <line x1="180" y1="15" x2="180" y2="205" strokeDasharray="3 3" />
        </g>

        {/* Rotating Radar Sweep Sector */}
        <path
          d="M 180,110 L 245,45 A 90 90 0 0 1 270,110 Z"
          fill="url(#invRadarBeam)"
          filter="url(#invGlow)"
        />

        {/* ── Midground: 3D Holographic Forensic Magnifying Lens ── */}
        <g transform="translate(180, 110)">
          {/* Outer Lens Metallic Rim with Glow */}
          <circle cx="0" cy="0" r="70" stroke="#22D3EE" strokeWidth="2.8" fill="none" filter="url(#invGlow)" />
          <circle cx="0" cy="0" r="66" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />

          {/* Lens Handle */}
          <path d="M 50,50 L 92,92 L 84,100 L 42,58 Z" fill="url(#invRadarBeam)" stroke="#22D3EE" strokeWidth="1.6" />

          {/* Focal Crosshair & Reticle */}
          <circle cx="0" cy="0" r="5" fill="#22D3EE" filter="url(#invGlow)" />
          <circle cx="0" cy="0" r="12" stroke="#22D3EE" strokeWidth="1.4" fill="none" />

          {/* Target Lock Brackets around Focus */}
          <path d="M -18,-10 L -18,-18 L -10,-18" stroke="#22D3EE" strokeWidth="1.8" fill="none" />
          <path d="M 18,-10 L 18,-18 L 10,-18" stroke="#22D3EE" strokeWidth="1.8" fill="none" />
          <path d="M -18,10 L -18,18 L -10,18" stroke="#22D3EE" strokeWidth="1.8" fill="none" />
          <path d="M 18,10 L 18,18 L 10,18" stroke="#22D3EE" strokeWidth="1.8" fill="none" />
        </g>
      </svg>

      {/* Floating HUD Telemetry Panes (Truthful Only) */}
      <div className="absolute top-4 left-3 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center gap-1.5 z-10">
        <Radio size={12} className="text-cyan-400 animate-pulse" />
        <span className="text-[11px] font-bold text-white">{isRtl ? 'تدفق الأحداث' : 'Event Stream'}</span>
      </div>

      <div className="absolute bottom-7 left-4 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-blue-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.25)] flex items-center gap-1.5 z-10">
        <Activity size={12} className="text-sky-400" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-white">{isRtl ? 'العمليات' : 'Processes'}</span>
          <span className="text-[9px] font-mono text-sky-300">{processDisplay}</span>
        </div>
      </div>

      {/* Right Column: Slogan Language Pack (From P1-02) */}
      <div className="absolute top-6 right-3 flex flex-col items-end text-right z-10 select-none">
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'رؤى' : 'DEEPER'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/90 leading-tight uppercase">
          {isRtl ? 'أعمق' : 'INSIGHTS'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-sky-400/90 leading-tight uppercase mt-0.5">
          {isRtl ? 'إجابات' : 'CLEARER'}
        </div>
        <div className="text-[10px] font-mono font-black tracking-widest text-sky-400/90 leading-tight uppercase">
          {isRtl ? 'أوضح' : 'ANSWERS'}
        </div>
      </div>

      {/* Bottom Ground Tag */}
      <div className="absolute bottom-1 w-full text-center text-[9px] font-mono font-bold tracking-widest text-cyan-300/70 uppercase">
        {isRtl ? 'اكتشف ما يحدث • كشف الحقائق' : 'FIND ANSWERS • MOVE FORWARD'}
      </div>
    </div>
  );
}
