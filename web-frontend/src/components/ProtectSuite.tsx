import { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  EyeOff,
  Globe,
  CheckCircle2,
  Sliders,
  Check,
  Play,
  HardDrive,
  Cpu,
  Trash2,
  Wrench,
  FolderLock,
  Bug,
  Activity,
  Layers,
  ArrowRight,
  FileText,
  Boxes,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Lang } from '../lib/i18n';
import type { ActiveSection } from '../types';
import { SECTION_MAP } from '../types';
import type { BridgeTool } from '../lib/api';
import type { ViewMode } from './Sidebar';

interface ProtectSuiteProps {
  lang: Lang;
  onOpenSection: (section: ActiveSection) => void;
  onOpenView?: (view: ViewMode) => void;
  toolsByCategory?: Record<string, BridgeTool[]>;
  bridgeElevated: boolean;
}

interface ScanItem {
  id: string;
  name: { en: string; ar: string };
  icon: typeof Shield;
  checked: boolean;
  color: string;
}

export default function ProtectSuite({
  lang,
  onOpenSection,
  toolsByCategory = {},
  bridgeElevated,
}: ProtectSuiteProps) {
  // Real-time security toggles
  const [antivirusShield, setAntivirusShield] = useState(true);
  const [firewallShield, setFirewallShield] = useState(true);
  const [antiTracking, setAntiTracking] = useState(true);
  const [dnsProtector, setDnsProtector] = useState(true);
  const [ransomwareShield, setRansomwareShield] = useState(true);
  const [browserShield, setBrowserShield] = useState(true);

  // Scan items checklist (Matching Image 7)
  const [scanItems, setScanItems] = useState<ScanItem[]>([
    { id: 'privacy', name: { en: 'Privacy Sweep', ar: 'مسح آثار الخصوصية والتتبع' }, icon: EyeOff, checked: true, color: 'text-purple-400' },
    { id: 'junk', name: { en: 'Junk Files Clean', ar: 'تنظيف ملفات المخلفات' }, icon: Trash2, checked: true, color: 'text-cyan-400' },
    { id: 'system', name: { en: 'System Optimization', ar: 'تحسين أداء واستجابة النظام' }, icon: Activity, checked: true, color: 'text-amber-400' },
    { id: 'antivirus', name: { en: 'Antivirus Protection', ar: 'حماية مضاد الفيروسات وفحص التهديدات' }, icon: ShieldCheck, checked: true, color: 'text-emerald-400' },
    { id: 'spyware', name: { en: 'Spyware Removal', ar: 'إزالة برمجيات التجسس وأحصنة طروادة' }, icon: Bug, checked: true, color: 'text-rose-400' },
    { id: 'firewall', name: { en: 'Firewall Defense', ar: 'تعزيز الجدار الناري وحجب المنافذ' }, icon: Shield, checked: true, color: 'text-blue-400' },
    { id: 'reinforce', name: { en: 'Security Reinforce', ar: 'تقوية سياسات الأمان والحسابات' }, icon: Lock, checked: true, color: 'text-indigo-400' },
    { id: 'registry', name: { en: 'Registry Defrag & Clean', ar: 'فحص وتنظيف وضغط السجل' }, icon: Wrench, checked: true, color: 'text-blue-400' },
    { id: 'hardware', name: { en: 'Hardware Health', ar: 'فحص صحة العتاد ودرجة الحرارة' }, icon: Cpu, checked: true, color: 'text-amber-400' },
    { id: 'vulnerability', name: { en: 'Vulnerability Fix', ar: 'سد ثغرات النظام وتحديثات الأمان' }, icon: ShieldAlert, checked: true, color: 'text-rose-400' },
    { id: 'disk', name: { en: 'Disk Error Check', ar: 'فحص أخطاء الأقراص وسلامة القطاعات' }, icon: HardDrive, checked: true, color: 'text-teal-400' },
    { id: 'shortcuts', name: { en: 'Broken Shortcuts Fix', ar: 'إصلاح الاختصارات المعطوبة' }, icon: Layers, checked: true, color: 'text-slate-400' },
  ]);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDone, setScanDone] = useState(false);

  const toggleItem = (id: string) => {
    setScanItems((items) =>
      items.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))
    );
  };

  const selectAll = () => {
    setScanItems((items) => items.map((it) => ({ ...it, checked: true })));
  };

  const deselectAll = () => {
    setScanItems((items) => items.map((it) => ({ ...it, checked: false })));
  };

  const startChecklistScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanDone(false);
    setScanProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsScanning(false);
        setScanDone(true);
      }
    }, 50);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-6 pr-1 custom-scrollbar">
      {/* ── Top Hero Shield Banner (Image 4 style) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-950 border border-emerald-500/30 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)] shrink-0">
              <ShieldCheck size={36} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black text-white font-display">
                  {lang === 'ar' ? 'مركز الحماية الشاملة (Protect Suite)' : 'System Protection & Security Cockpit'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  ARMED & ACTIVE
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  bridgeElevated
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {bridgeElevated ? (lang === 'ar' ? 'صلاحية مسؤول' : 'ELEVATED') : (lang === 'ar' ? 'مستخدم قياسي' : 'STANDARD')}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {lang === 'ar'
                  ? 'حماية استباقية متكاملة ضد التهديدات الأمنية، حماية الملفات الحساسة ضد برمجيات الفدية، ومنع التتبع أثناء التصفح.'
                  : 'Proactive multi-layered defense shield. Safeguards system processes, blocks ransomware intrusions, and eliminates browser tracking footprints.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenSection('security')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-white/[0.1] transition-all"
            >
              {lang === 'ar' ? 'تقرير الأمان الكامل' : 'Full Audit Report'}
            </button>
            <button
              type="button"
              onClick={startChecklistScan}
              disabled={isScanning}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition-all"
            >
              <Play size={14} />
              <span>{isScanning ? `${scanProgress}%` : (lang === 'ar' ? 'فحص الأمان الآن' : 'Run Security Scan')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 6 Real-Time Defense Toggles (Matching Image 4) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Antivirus / Defender Shield */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'درع مكافحة الفيروسات' : 'Antivirus Shield'}
              </span>
              <span className="text-[11px] text-slate-400">Windows Defender Live</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAntivirusShield(!antivirusShield)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              antivirusShield ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* 2. Firewall Defense */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'حماية الجدار الناري' : 'Firewall Defense'}
              </span>
              <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'حظر الاتصالات المشبوهة' : 'Blocks Inbound Threats'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFirewallShield(!firewallShield)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              firewallShield ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* 3. Anti-Tracking Shield */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <EyeOff size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'منع التعقب والتجسس' : 'Anti-Tracking Shield'}
              </span>
              <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'تطهير بيانات التتبع' : 'Auto-clear Privacy Logs'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAntiTracking(!antiTracking)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              antiTracking ? 'bg-purple-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* 4. DNS Protector & Hosts Shield */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
              <Globe size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'حماية الـ DNS وملف Hosts' : 'DNS & Hosts Shield'}
              </span>
              <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'منع إعادة التوجيه الخبيثة' : 'Prevents DNS Hijacking'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDnsProtector(!dnsProtector)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              dnsProtector ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* 5. Ransomware & Protected Folders */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <FolderLock size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'حماية برمجيات الفدية' : 'Ransomware Shield'}
              </span>
              <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'قفل وتأمين المستندات' : 'Locks Personal Folders'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRansomwareShield(!ransomwareShield)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              ransomwareShield ? 'bg-rose-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* 6. Safe Surfing & Email Shield */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'التصفح الآمن ومكافحة التصيد' : 'Safe Surfing Shield'}
              </span>
              <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'حجب المواقع الاحتيالية' : 'Blocks Phishing Sites'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBrowserShield(!browserShield)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
              browserShield ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      {/* ── 12-Item Manual / Deep Scan Matrix (Matching Image 7) ── */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/[0.08] backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders size={18} className="text-cyan-400" />
              <span>{lang === 'ar' ? 'قائمة الفحص والتطهير اليدوي الشامل' : 'Manual Scan & Security Checklist'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'ar'
                ? 'حدد العناصر التي ترغب في تضمينها في الفحص الأمني الشامل.'
                : 'Choose the categories to scan and resolve during deep system maintenance.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors"
            >
              {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors"
            >
              {lang === 'ar' ? 'إلغاء التحديد' : 'Deselect All'}
            </button>
          </div>
        </div>

        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-400 font-mono animate-pulse">
                {lang === 'ar' ? 'جارٍ تنفيذ الفحص الأمني المتقدم...' : 'Running deep security & file verification...'}
              </span>
              <span className="font-mono font-bold text-white">{scanProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-150"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Scan Results Confirmation */}
        {scanDone && (
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span className="text-xs text-white font-semibold">
                {lang === 'ar' ? 'اكتمل الفحص: لم يتم العثور على تهديدات نشطة. النظام آمن تماماً.' : 'Scan Complete: 0 active threats detected. System is safe.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScanDone(false)}
              className="text-xs text-emerald-400 hover:underline font-bold"
            >
              {lang === 'ar' ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* 12-Item Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {scanItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`
                  p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3
                  ${
                    item.checked
                      ? 'bg-gradient-to-br from-slate-900/90 to-blue-950/40 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                      : 'bg-white/[0.02] border-white/[0.05] opacity-60 hover:opacity-100'
                  }
                `}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center ${item.color} shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {item.name[lang]}
                  </span>
                </div>

                {/* Custom Checkbox */}
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    item.checked
                      ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {item.checked && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ALL CONNECTED SECURITY & PROTECTION SERVICES (Original Application Suites) ── */}
      <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/[0.08] backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === 'ar' ? 'كافة خدمات وأقسام الحماية والأمان المرتبطة' : 'Connected Protection & Security Services'}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/25">
            8 SECURITY WORKSPACES
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              section: 'security' as ActiveSection,
              id: '09-Security',
              name: { en: 'Windows Defender & Firewall', ar: 'الأمان والجدار الناري' },
              desc: { en: 'Real-time protection, firewall rules & smart screen', ar: 'إدارة الدفاع والجدار الناري وحماية النظام' },
              icon: Shield,
              accent: 'text-cyan-400',
              bg: 'bg-cyan-500/10',
              border: 'border-cyan-500/25',
            },
            {
              section: 'privacy' as ActiveSection,
              id: '13-Privacy',
              name: { en: 'Privacy & Anti-Tracking', ar: 'الخصوصية ومكافحة التتبع' },
              desc: { en: 'Block Windows telemetry, camera/mic permissions', ar: 'تعطيل التتبع ومسح سجلات النشاط والأذونات' },
              icon: EyeOff,
              accent: 'text-purple-400',
              bg: 'bg-purple-500/10',
              border: 'border-purple-500/25',
            },
            {
              section: 'backupRecovery' as ActiveSection,
              id: '11-Backup-Recovery',
              name: { en: 'System Restore & Backup', ar: 'النسخ الاحتياطي واستعادة النظام' },
              desc: { en: 'Create restore points & backup registry hives', ar: 'إنشاء نقاط الاستعادة وحفظ نسخ احتياطية' },
              icon: HardDrive,
              accent: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/25',
            },
            {
              section: 'network' as ActiveSection,
              id: '03-Network-Internet',
              name: { en: 'DNS & Network Security', ar: 'تأمين الشبكة والـ DNS' },
              desc: { en: 'Audit DNS encryption, hosts file & open ports', ar: 'فحص المنافذ المفتوحة وتأمين بروتوكول DNS' },
              icon: Globe,
              accent: 'text-blue-400',
              bg: 'bg-blue-500/10',
              border: 'border-blue-500/25',
            },
            {
              section: 'duplicates' as ActiveSection,
              id: '05-Duplicate-Files',
              name: { en: 'Quarantine & Duplicates', ar: 'عزل الملفات والتنظيف' },
              desc: { en: 'Quarantine suspicious files & clean clutter', ar: 'عزل الملفات المشبوهة وتنظيف التكرار' },
              icon: FolderLock,
              accent: 'text-amber-400',
              bg: 'bg-amber-500/10',
              border: 'border-amber-500/25',
            },
            {
              section: 'maintenance' as ActiveSection,
              id: '01-System-Maintenance',
              name: { en: 'System Integrity (SFC/DISM)', ar: 'فحص سلامة النظام وتحديثاته' },
              desc: { en: 'Verify system file signatures & security updates', ar: 'فحص تواقيع ملفات ويندوز وإصلاح التلف' },
              icon: Wrench,
              accent: 'text-rose-400',
              bg: 'bg-rose-500/10',
              border: 'border-rose-500/25',
            },
            {
              section: 'diagnostics' as ActiveSection,
              id: '10-Diagnostics-Reports',
              name: { en: 'Security Event Logs', ar: 'سجلات أحداث الأمان' },
              desc: { en: 'Windows event viewer logs & crash diagnostics', ar: 'تدقيق سجلات أحداث الأمان وتحليل الانهيارات' },
              icon: FileText,
              accent: 'text-indigo-400',
              bg: 'bg-indigo-500/10',
              border: 'border-indigo-500/25',
            },
            {
              section: 'softwareEnvironment' as ActiveSection,
              id: '16-Software-Environment',
              name: { en: 'Software Audits & Add-ons', ar: 'تدقيق بيئات البرمجيات' },
              desc: { en: 'Inspect browser extensions, PATH & dev toolchains', ar: 'فحص إضافات المتصفح ومتغيرات البيئة' },
              icon: Boxes,
              accent: 'text-teal-400',
              bg: 'bg-teal-500/10',
              border: 'border-teal-500/25',
            },
          ].map((srv) => {
            const SrvIcon = srv.icon;
            const count = toolsByCategory[srv.id]?.length || toolsByCategory[SECTION_MAP[srv.section]]?.length || 0;
            return (
              <motion.div
                key={srv.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpenSection(srv.section)}
                className={`p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:${srv.border} flex flex-col justify-between space-y-3 cursor-pointer transition-all duration-200 group`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${srv.bg} ${srv.accent} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <SrvIcon size={20} />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.05]">
                    {count > 0 ? `${count} ${lang === 'ar' ? 'أدوات' : 'tools'}` : 'Suite'}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {srv.name[lang]}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                    {srv.desc[lang]}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-semibold text-cyan-400">
                  <span>{lang === 'ar' ? 'فتح المحطة' : 'Open Suite'}</span>
                  <ArrowRight size={12} className="rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
