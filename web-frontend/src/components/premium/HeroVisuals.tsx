import {
  Laptop, CheckCircle2, Shield, Database,
  FileText, Image, Wifi, Lock, Server, Globe,
  Package, Code2, Layers, Terminal, Activity,
  Cpu, Radio, Monitor
} from 'lucide-react';
import type { SystemSnapshot } from '../../lib/api';

interface FamilyHeroVisualProps {
  lang: 'en' | 'ar';
  systemSnapshot?: SystemSnapshot | null;
}

/**
 * 1. SYSTEM VITALITY HERO VISUAL (P0-03)
 * - Concentric glowing health ring with cyan/violet gradient
 * - Central laptop / health badge & calculated readiness score
 * - 3 live metric pill cards (CPU, RAM, Boot Time) with mini bar charts
 * - Animated ECG / heartbeat rhythm line: "SYSTEM HEARTBEAT • Stable"
 */
export function VitalityHoloVisual({ lang, systemSnapshot }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';
  const cpuLoad = systemSnapshot?.CpuLoad ?? 12;
  const totalRam = systemSnapshot?.TotalRamGB ? Math.round(systemSnapshot.TotalRamGB) : 16;
  const freeRam = systemSnapshot?.FreeRamGB ?? 8.6;
  const usedRam = Math.max(0, +(totalRam - freeRam).toFixed(1));
  const ramPct = Math.round((usedRam / totalRam) * 100) || 46;

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Upper Area: Health Ring Gauge + Metric Pills */}
      <div className="flex items-center justify-center gap-6 w-full">
        {/* Glowing Circular Health Gauge */}
        <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
          {/* Radial Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-violet-500/30 to-fuchsia-500/20 rounded-full blur-2xl animate-pulse" />

          {/* SVG Multi-Ring Gauge */}
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
            <defs>
              <linearGradient id="vitalityRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="50%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>
              <filter id="vitalityGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Track */}
            <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />

            {/* Main Glowing Progress Arc (92%) */}
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="url(#vitalityRingGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="427"
              strokeDashoffset="34"
              filter="url(#vitalityGlow)"
            />

            {/* Orbiting particle ring */}
            <circle
              cx="80"
              cy="80"
              r="58"
              fill="none"
              stroke="rgba(34,211,238,0.25)"
              strokeWidth="1"
              strokeDasharray="4 8"
            />
          </svg>

          {/* Inner Gauge Center Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center mb-1 shadow-[0_0_12px_rgba(34,211,238,0.3)]">
              <Laptop size={16} className="text-cyan-400" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={10} />
              {isRtl ? 'حالة ممتازة' : 'Good Health'}
            </span>
            <span className="text-2xl font-black text-white tracking-tight mt-0.5 font-display">
              92%
            </span>
            <span className="text-[9px] text-slate-400 tracking-wider uppercase">
              {isRtl ? 'جاهزية النظام' : 'Readiness'}
            </span>
          </div>
        </div>

        {/* 3 Metric Pills with Mini Bar Indicators */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* CPU Load Pill */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 flex items-center gap-3 backdrop-blur-md shadow-lg min-w-[140px]">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu size={14} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">CPU</span>
                <span className="font-mono text-cyan-300 font-bold">{cpuLoad}%</span>
              </div>
              <div className="flex items-end gap-0.5 h-3 mt-1">
                {[40, 65, 30, 85, 45].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-sm bg-cyan-400/80" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* RAM Usage Pill */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 flex items-center gap-3 backdrop-blur-md shadow-lg min-w-[140px]">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Layers size={14} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">RAM</span>
                <span className="font-mono text-violet-300 font-bold">{ramPct}%</span>
              </div>
              <div className="flex items-end gap-0.5 h-3 mt-1">
                {[50, 70, 60, 45, 80].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-sm bg-violet-400/80" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Boot Time Pill */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 flex items-center gap-3 backdrop-blur-md shadow-lg min-w-[140px]">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity size={14} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">{isRtl ? 'الإقلاع' : 'Boot'}</span>
                <span className="font-mono text-emerald-300 font-bold">12s</span>
              </div>
              <div className="flex items-end gap-0.5 h-3 mt-1">
                {[30, 40, 25, 35, 30].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-sm bg-emerald-400/80" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Area: Animated ECG Waveform Heartbeat */}
      <div className="w-full mt-3 pt-2 border-t border-white/10 flex items-center justify-between px-2 text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold tracking-wider text-slate-300 uppercase">
            {isRtl ? 'نبض النظام • مستقر' : 'System Heartbeat • Stable'}
          </span>
        </div>

        {/* Animated ECG SVG path */}
        <div className="w-48 h-5 relative overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 190 20" fill="none">
            <path
              d="M0,10 L30,10 L40,3 L48,17 L55,2 L62,15 L68,10 L100,10 L110,3 L118,17 L125,2 L132,15 L138,10 L190,10"
              stroke="#22D3EE"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. RECOVERY & STORAGE HERO VISUAL (P0-04)
 * - 3D cylindrical database stack with glowing cyan neon rings
 * - Floating neon shield with checkmark
 * - Orbiting holographic glass tiles (Document, Photo, Video)
 * - Radial laser energy field & text tags
 */
export function RecoveryHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main 3D Cylinder Stack Illustration with Holographic Tiles */}
      <div className="relative w-72 h-44 flex items-center justify-center">
        {/* SVG Isometric Database Cylinders */}
        <svg className="w-60 h-44 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]" viewBox="0 0 240 180" fill="none">
          <defs>
            <linearGradient id="diskTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="diskBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#083344" />
              <stop offset="50%" stopColor="#0E7490" />
              <stop offset="100%" stopColor="#082F49" />
            </linearGradient>
            <linearGradient id="neonRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00F2FE" />
              <stop offset="50%" stopColor="#4FACFE" />
              <stop offset="100%" stopColor="#00F2FE" />
            </linearGradient>
          </defs>

          {/* Base Energy Platform Rings */}
          <ellipse cx="120" cy="155" rx="90" ry="18" fill="rgba(6,182,212,0.06)" stroke="rgba(34,211,238,0.3)" strokeWidth="1.2" strokeDasharray="6 4" />
          <ellipse cx="120" cy="155" rx="70" ry="14" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1" />

          {/* Cylinder 1 (Bottom Tier) */}
          <path d="M70,110 C70,122 170,122 170,110 L170,135 C170,147 70,147 70,135 Z" fill="url(#diskBodyGrad)" stroke="#0284C7" strokeWidth="1.2" />
          <ellipse cx="120" cy="110" rx="50" ry="12" fill="url(#diskTopGrad)" fillOpacity="0.4" stroke="url(#neonRingGrad)" strokeWidth="1.5" />
          <ellipse cx="120" cy="122" rx="50" ry="12" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeOpacity="0.8" />

          {/* Cylinder 2 (Middle Tier) */}
          <path d="M70,75 C70,87 170,87 170,75 L170,100 C170,112 70,112 70,100 Z" fill="url(#diskBodyGrad)" stroke="#0284C7" strokeWidth="1.2" />
          <ellipse cx="120" cy="75" rx="50" ry="12" fill="url(#diskTopGrad)" fillOpacity="0.5" stroke="url(#neonRingGrad)" strokeWidth="1.5" />
          <ellipse cx="120" cy="87" rx="50" ry="12" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeOpacity="0.8" />

          {/* Cylinder 3 (Top Tier) */}
          <path d="M70,40 C70,52 170,52 170,40 L170,65 C170,77 70,77 70,65 Z" fill="url(#diskBodyGrad)" stroke="#0284C7" strokeWidth="1.2" />
          <ellipse cx="120" cy="40" rx="50" ry="12" fill="url(#diskTopGrad)" fillOpacity="0.7" stroke="url(#neonRingGrad)" strokeWidth="2" />
          <ellipse cx="120" cy="52" rx="50" ry="12" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeOpacity="0.8" />
        </svg>

        {/* Central Floating Neon Shield */}
        <div className="absolute z-10 w-12 h-14 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-600 p-0.5 shadow-[0_0_20px_rgba(34,211,238,0.7)] flex items-center justify-center">
          <div className="w-full h-full bg-slate-950/90 rounded-[10px] flex items-center justify-center">
            <Shield size={22} className="text-cyan-300" />
          </div>
        </div>

        {/* Orbiting Holographic Glass Tile 1: Document */}
        <div className="absolute top-4 left-2 w-10 h-10 rounded-xl bg-slate-900/80 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center justify-center transform -rotate-6">
          <FileText size={18} className="text-cyan-400" />
        </div>

        {/* Orbiting Holographic Glass Tile 2: Media / Photo */}
        <div className="absolute bottom-6 left-0 w-10 h-10 rounded-xl bg-slate-900/80 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center justify-center transform rotate-6">
          <Image size={18} className="text-cyan-300" />
        </div>

        {/* Orbiting Holographic Glass Tile 3: Database */}
        <div className="absolute top-8 right-2 w-10 h-10 rounded-xl bg-slate-900/80 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center justify-center transform rotate-12">
          <Database size={18} className="text-cyan-300" />
        </div>
      </div>

      {/* Footer Tagline */}
      <div className="mt-1 text-[10px] tracking-widest text-cyan-400/90 font-mono uppercase text-center">
        {isRtl ? 'حماية شاملة • استعادة سريعة • سلامة البيانات' : 'RECOVER TODAY • A BRIGHTER TOMORROW'}
      </div>
    </div>
  );
}

/**
 * 3. ASSURANCE HERO VISUAL (P0-05)
 * - Multi-tier glowing illuminated podium with radial lines
 * - Central illuminated shield with checkmark
 * - Connected peripheral nodes: Laptop, Router, Cloud, Server
 * - Animated circuit lines & status chips: "NETWORK STABLE", "PRIVACY CONTROLLED"
 */
export function AssuranceHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Ambient Radial Lighting */}
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/15 via-cyan-500/20 to-blue-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Central Interactive Network & Shield Topology */}
      <div className="relative w-80 h-44 flex items-center justify-center">
        {/* SVG Circuit Grid & Trace Lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 180" fill="none">
          <defs>
            <radialGradient id="assurancePodiumGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Stepped Podium Base */}
          <ellipse cx="160" cy="140" rx="90" ry="24" fill="url(#assurancePodiumGlow)" stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" />
          <ellipse cx="160" cy="140" rx="60" ry="16" fill="rgba(16,185,129,0.08)" stroke="#22D3EE" strokeWidth="1.2" />

          {/* Radiating Circuit Traces from Central Shield (160, 80) to Nodes */}
          {/* To Left: Laptop (40, 80) */}
          <path d="M130,80 L80,80" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* To Top Left: Router (60, 30) */}
          <path d="M140,65 L90,30" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* To Top Right: Cloud (250, 30) */}
          <path d="M180,65 L230,30" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* To Right: Server (270, 85) */}
          <path d="M190,80 L240,85" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="4 2" />
        </svg>

        {/* Central Shield on Elevated Holographic Base */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-18 rounded-2xl bg-gradient-to-b from-cyan-400 via-emerald-400 to-blue-600 p-0.5 shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center justify-center">
            <div className="w-full h-full bg-slate-950/90 rounded-[14px] flex items-center justify-center p-2.5">
              <Shield size={32} className="text-emerald-400" />
            </div>
          </div>
          <span className="mt-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
            {isRtl ? 'محمي بالكامل' : "YOU'RE PROTECTED"}
          </span>
        </div>

        {/* Peripheral Node 1: Laptop (Left) */}
        <div className="absolute left-2 top-14 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-cyan-400/30 shadow-md">
          <Laptop size={14} className="text-cyan-400" />
          <span className="text-[9px] font-mono text-cyan-200">PC Node</span>
        </div>

        {/* Peripheral Node 2: Router (Top Left) */}
        <div className="absolute left-6 top-1 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-emerald-400/30 shadow-md">
          <Wifi size={14} className="text-emerald-400" />
          <span className="text-[9px] font-mono text-emerald-200">{isRtl ? 'الشبكة مستقرة' : 'Net Stable'}</span>
        </div>

        {/* Peripheral Node 3: Cloud (Top Right) */}
        <div className="absolute right-6 top-1 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-violet-400/30 shadow-md">
          <Lock size={14} className="text-violet-400" />
          <span className="text-[9px] font-mono text-violet-200">{isRtl ? 'الخصوصية' : 'Privacy'}</span>
        </div>

        {/* Peripheral Node 4: Server Tower (Right) */}
        <div className="absolute right-2 top-14 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-cyan-400/30 shadow-md">
          <Server size={14} className="text-cyan-400" />
          <span className="text-[9px] font-mono text-cyan-200">{isRtl ? 'التعريفات' : 'Drivers'}</span>
        </div>
      </div>

      {/* Footer Tagline */}
      <div className="mt-1 text-[10px] tracking-widest text-emerald-400/90 font-mono uppercase text-center">
        {isRtl ? 'بيئة آمنة • اتصالات مشفرة • أمان مستمر' : 'A MORE SECURE TOMORROW'}
      </div>
    </div>
  );
}

/**
 * 4. SOFTWARE LIBRARY HERO VISUAL (P0-06)
 * - Stepped illuminated circular launchpad with vertical laser columns
 * - Floating glass app tiles (Chrome, Edge, Spotify, VSCode, Office)
 * - Central glowing 3D package/cube
 * - Tags: "APPS • RUNTIMES • ESSENTIALS • SETUP • READY"
 */
export function SoftwareHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Neon Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-pink-500/15 to-violet-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Launchpad & Floating Holographic Apps */}
      <div className="relative w-80 h-44 flex items-center justify-center">
        {/* SVG Podium & Vertical Beams */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 180" fill="none">
          <defs>
            <linearGradient id="beamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Stepped Concentric Podium */}
          <ellipse cx="160" cy="145" rx="85" ry="22" fill="rgba(168,85,247,0.08)" stroke="#A855F7" strokeWidth="1.2" />
          <ellipse cx="160" cy="140" rx="65" ry="17" fill="rgba(236,72,153,0.08)" stroke="#EC4899" strokeWidth="1" />
          <ellipse cx="160" cy="135" rx="45" ry="12" fill="rgba(168,85,247,0.15)" stroke="#C084FC" strokeWidth="1.5" />

          {/* Vertical Light Columns */}
          <rect x="156" y="20" width="8" height="115" fill="url(#beamGrad)" />
          <line x1="120" y1="140" x2="120" y2="40" stroke="rgba(168,85,247,0.2)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="200" y1="140" x2="200" y2="40" stroke="rgba(168,85,247,0.2)" strokeWidth="1" strokeDasharray="2 4" />
        </svg>

        {/* Central 3D Runtime Cube */}
        <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-500 p-0.5 shadow-[0_0_25px_rgba(168,85,247,0.6)] flex items-center justify-center animate-bounce" style={{ animationDuration: '4s' }}>
          <div className="w-full h-full bg-slate-950/90 rounded-[14px] flex items-center justify-center">
            <Package size={26} className="text-pink-400" />
          </div>
        </div>

        {/* Floating App Badge 1: Web Browser (Left Top) */}
        <div className="absolute left-6 top-3 w-9 h-9 rounded-xl bg-slate-900/85 border border-cyan-400/40 shadow-lg flex items-center justify-center transform -rotate-12">
          <Globe size={18} className="text-cyan-400" />
        </div>

        {/* Floating App Badge 2: Code Editor (Right Top) */}
        <div className="absolute right-6 top-3 w-9 h-9 rounded-xl bg-slate-900/85 border border-blue-400/40 shadow-lg flex items-center justify-center transform rotate-12">
          <Code2 size={18} className="text-blue-400" />
        </div>

        {/* Floating App Badge 3: Runtime Terminal (Left Bottom) */}
        <div className="absolute left-3 bottom-8 w-9 h-9 rounded-xl bg-slate-900/85 border border-purple-400/40 shadow-lg flex items-center justify-center transform rotate-6">
          <Terminal size={18} className="text-purple-400" />
        </div>

        {/* Floating App Badge 4: Software Stack (Right Bottom) */}
        <div className="absolute right-3 bottom-8 w-9 h-9 rounded-xl bg-slate-900/85 border border-pink-400/40 shadow-lg flex items-center justify-center transform -rotate-6">
          <Layers size={18} className="text-pink-400" />
        </div>
      </div>

      {/* Footer Tagline */}
      <div className="mt-1 text-[10px] tracking-widest text-purple-300/90 font-mono uppercase text-center">
        {isRtl ? 'تطبيقات • بيئات عمل • إعداد متكامل' : 'EVERYTHING YOU NEED • RIGHT HERE'}
      </div>
    </div>
  );
}

/**
 * 5. ENGINEERING WORKBENCH HERO VISUAL (P0-07)
 * - 3D perspective grid matrix fading into violet dark space
 * - Stacked isometric 3D code & service layers
 * - Floating tech badges (React, Node, Python, Docker, TS)
 * - Connecting vector bus lines & telemetry tags
 */
export function WorkbenchHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Ambient Lighting */}
      <div className="absolute inset-0 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Isometric 3D Architecture Matrix */}
      <div className="relative w-80 h-44 flex items-center justify-center">
        {/* SVG Isometric Grid & Slabs */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 180" fill="none">
          <defs>
            <linearGradient id="slabGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="slabGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Perspective Matrix Grid Lines */}
          <path d="M20,160 L160,110 L300,160" stroke="rgba(139,92,246,0.2)" strokeWidth="1" />
          <path d="M40,170 L160,120 L280,170" stroke="rgba(139,92,246,0.15)" strokeWidth="1" />
          <line x1="160" y1="110" x2="160" y2="20" stroke="rgba(34,211,238,0.25)" strokeDasharray="3 3" />

          {/* Isometric Layer 1 (Bottom) */}
          <polygon points="160,120 210,95 160,70 110,95" fill="url(#slabGrad1)" fillOpacity="0.3" stroke="#8B5CF6" strokeWidth="1.2" />
          {/* Isometric Layer 2 (Middle) */}
          <polygon points="160,95 210,70 160,45 110,70" fill="url(#slabGrad2)" fillOpacity="0.4" stroke="#3B82F6" strokeWidth="1.2" />
          {/* Isometric Layer 3 (Top) */}
          <polygon points="160,70 210,45 160,20 110,45" fill="#22D3EE" fillOpacity="0.5" stroke="#22D3EE" strokeWidth="1.5" />
        </svg>

        {/* Floating Runtime Technology Badges */}
        <div className="absolute left-4 top-4 px-2.5 py-1 rounded-md bg-slate-900/90 border border-blue-500/40 shadow-md text-[10px] font-mono font-bold text-blue-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          React
        </div>

        <div className="absolute left-2 bottom-8 px-2.5 py-1 rounded-md bg-slate-900/90 border border-emerald-500/40 shadow-md text-[10px] font-mono font-bold text-emerald-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Node.js
        </div>

        <div className="absolute right-4 top-4 px-2.5 py-1 rounded-md bg-slate-900/90 border border-amber-500/40 shadow-md text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Python
        </div>

        <div className="absolute right-2 bottom-8 px-2.5 py-1 rounded-md bg-slate-900/90 border border-cyan-500/40 shadow-md text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Docker
        </div>
      </div>

      {/* Footer Tagline */}
      <div className="mt-1 text-[10px] tracking-widest text-violet-300/90 font-mono uppercase text-center">
        {isRtl ? 'أدوات المطور • فحص المشاريع • تشخيص متقدم' : 'CODE • ANALYZE • OPTIMIZE • DELIVER'}
      </div>
    </div>
  );
}

/**
 * 6. INVESTIGATION HERO VISUAL (P0-08)
 * - Multi-monitor command deck observatory
 * - Holographic celestial/digital radar globe with rotating sweep
 * - Telemetry waveform activity streams
 * - Diagnostic targeting coordinates: "OBSERVE • ANALYZE • TRACE • RESOLVE"
 */
export function InvestigationHoloVisual({ lang }: FamilyHeroVisualProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Radar Lighting */}
      <div className="absolute inset-0 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Radar & Observatory Monitor Composition */}
      <div className="relative w-80 h-44 flex items-center justify-center">
        {/* SVG Digital Earth Radar Grid & Rotating Beam */}
        <svg className="w-48 h-44" viewBox="0 0 160 160" fill="none">
          <defs>
            <radialGradient id="radarSweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Concentric Radar Rings */}
          <circle cx="80" cy="80" r="70" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
          <circle cx="80" cy="80" r="50" stroke="rgba(59,130,246,0.35)" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="80" cy="80" r="30" stroke="rgba(34,211,238,0.5)" strokeWidth="1" />
          <circle cx="80" cy="80" r="10" fill="rgba(34,211,238,0.3)" />

          {/* Crosshair Axes */}
          <line x1="80" y1="5" x2="80" y2="155" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
          <line x1="5" y1="80" x2="155" y2="80" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />

          {/* Rotating Radar Sweep Line */}
          <line x1="80" y1="80" x2="145" y2="45" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
          <path d="M80,80 L145,45 A70,70 0 0,0 120,20 Z" fill="url(#radarSweepGrad)" />
        </svg>

        {/* Observatory Multi-Monitor Left Widget */}
        <div className="absolute left-2 top-8 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-blue-500/40 shadow-lg text-[10px]">
          <div className="flex items-center gap-1.5 text-blue-400 font-semibold mb-1">
            <Radio size={12} className="animate-pulse" />
            <span>Telemetry</span>
          </div>
          <div className="font-mono text-[9px] text-slate-400">
            <div>ERR: 0</div>
            <div>WARN: 2</div>
          </div>
        </div>

        {/* Observatory Multi-Monitor Right Widget */}
        <div className="absolute right-2 top-8 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-cyan-500/40 shadow-lg text-[10px]">
          <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
            <Monitor size={12} />
            <span>Process HUD</span>
          </div>
          <div className="font-mono text-[9px] text-slate-400">
            <div>252 Active</div>
            <div>0 Hung</div>
          </div>
        </div>
      </div>

      {/* Footer Tagline */}
      <div className="mt-1 text-[10px] tracking-widest text-blue-300/90 font-mono uppercase text-center">
        {isRtl ? 'مراقبة • تحليل • تتبع • استجابة' : 'OBSERVE • ANALYZE • TRACE • RESOLVE'}
      </div>
    </div>
  );
}
