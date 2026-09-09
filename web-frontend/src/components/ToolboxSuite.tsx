import { useState, useMemo } from 'react';
import {
  Search,
  Zap,
  Shield,
  Trash2,
  Wrench,
  Layers,
  Cpu,
  Globe,
  HardDrive,
  RotateCcw,
  Sliders,
  Rocket,
  FolderLock,
  Files,
  Scissors,
  FileX,
  FileSearch,
  UserCheck,
  Server,
  Power,
  Sparkles,
  Boxes,
  Activity,
  AppWindow,
  Copy,
  Gauge,
  Radar,
  ArrowRight,
  SlidersHorizontal,
  EyeOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Lang } from '../lib/i18n';
import type { ActiveSection } from '../types';
import { SECTION_MAP } from '../types';
import type { BridgeTool } from '../lib/api';
import { CATEGORIES, type CategoryIconKey } from '../data/categories';

interface ToolboxSuiteProps {
  lang: Lang;
  onOpenSection: (section: ActiveSection) => void;
  toolsByCategory?: Record<string, BridgeTool[]>;
  bridgeElevated: boolean;
}

const CATEGORY_ICONS: Record<CategoryIconKey, React.ElementType> = {
  maintenance: Wrench,
  cleanup: Trash2,
  network: Globe,
  programs: AppWindow,
  duplicates: Copy,
  disk: HardDrive,
  services: Cpu,
  performance: Gauge,
  security: Shield,
  diagnostics: Activity,
  backup: HardDrive,
  developer: AppWindow,
  privacy: EyeOff,
  drivers: SlidersHorizontal,
  monitoring: Activity,
  software: Boxes,
  setup: Rocket,
  sonar: Radar,
};

interface ToolboxItem {
  id: string;
  name: { en: string; ar: string };
  desc: { en: string; ar: string };
  icon: typeof Wrench;
  badge?: 'PRO' | 'HOT' | 'NEW';
  targetSection: ActiveSection;
  iconBg: string;
  iconColor: string;
}

interface ToolboxColumn {
  id: string;
  title: { en: string; ar: string };
  subtitle: { en: string; ar: string };
  color: string;
  items: ToolboxItem[];
}

export default function ToolboxSuite({
  lang,
  onOpenSection,
  toolsByCategory = {},
  bridgeElevated,
}: ToolboxSuiteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'featured' | 'suites'>('featured');
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);

  const columns: ToolboxColumn[] = useMemo(() => [
    {
      id: 'featured',
      title: { en: 'Featured Products', ar: 'أهم الأدوات المميزة' },
      subtitle: { en: 'Flagship maintenance suites', ar: 'أقوى حزم الصيانة المتكاملة' },
      color: 'from-amber-500/20 border-amber-500/30 text-amber-400',
      items: [
        {
          id: 'uninstaller',
          name: { en: 'IObit Uninstaller Pro', ar: 'إلغاء التثبيت المتقدم' },
          desc: { en: 'Completely removes stubborn apps and leftovers', ar: 'إزالة البرامج المستعصية وبقايا الملفات من الجذور' },
          icon: Trash2,
          badge: 'HOT',
          targetSection: 'programs',
          iconBg: 'bg-amber-500/15',
          iconColor: 'text-amber-400',
        },
        {
          id: 'driver_booster',
          name: { en: 'Driver Booster Pro', ar: 'محدث التعريفات الشامل' },
          desc: { en: 'Updates outdated device drivers & game components', ar: 'تحديث تعريفات العتاد ومكونات تشغيل الألعاب' },
          icon: Cpu,
          badge: 'HOT',
          targetSection: 'drivers',
          iconBg: 'bg-blue-500/15',
          iconColor: 'text-blue-400',
        },
        {
          id: 'malware_fighter',
          name: { en: 'Malware Fighter Pro', ar: 'مكافح البرمجيات الخبيثة' },
          desc: { en: 'Guards against ransomware, trojans, and adware', ar: 'حماية مضاعفة ضد برامج الفدية والتروجان والبرمجيات الدعائية' },
          icon: Shield,
          badge: 'PRO',
          targetSection: 'security',
          iconBg: 'bg-emerald-500/15',
          iconColor: 'text-emerald-400',
        },
        {
          id: 'smart_defrag',
          name: { en: 'Smart Defrag Pro', ar: 'إلغاء التجزئة الذكي' },
          desc: { en: 'TRIM optimization & multi-threading defragmentation', ar: 'تحسين أوامر TRIM وإلغاء تجزئة الأقراص لتسريع القراءة' },
          icon: HardDrive,
          badge: 'PRO',
          targetSection: 'disk',
          iconBg: 'bg-cyan-500/15',
          iconColor: 'text-cyan-400',
        },
        {
          id: 'duplicate_finder',
          name: { en: 'Duplicate File Finder', ar: 'منظف الملفات المكررة' },
          desc: { en: 'Sha-256 deduplication & thumbnail visualization', ar: 'مطابقة البصمة الرقمية ومعاينة الصور واسترداد الجيجابايت' },
          icon: Files,
          badge: 'NEW',
          targetSection: 'duplicates',
          iconBg: 'bg-purple-500/15',
          iconColor: 'text-purple-400',
        },
        {
          id: 'protected_folder',
          name: { en: 'Protected Folder Pro', ar: 'حماية المجلدات والملفات' },
          desc: { en: 'Password-protects sensitive business & private data', ar: 'تشفير المجلدات الحساسة وحمايتها بكلمة مرور' },
          icon: FolderLock,
          badge: 'PRO',
          targetSection: 'security',
          iconBg: 'bg-rose-500/15',
          iconColor: 'text-rose-400',
        },
      ],
    },
    {
      id: 'optimize',
      title: { en: 'System Optimize', ar: 'تحسين النظام' },
      subtitle: { en: 'Tuning memory, boot, and network', ar: 'تسريع الذاكرة والإقلاع وتدفق الشبكة' },
      color: 'from-cyan-500/20 border-cyan-500/30 text-cyan-400',
      items: [
        {
          id: 'smart_ram',
          name: { en: 'Smart RAM', ar: 'الذاكرة الذكية (Smart RAM)' },
          desc: { en: 'Recycles idle memory blocks to stop slowdowns', ar: 'تحرير كتل الذاكرة غير المستخدمة لإنهاء التعليق' },
          icon: Zap,
          badge: 'PRO',
          targetSection: 'performance',
          iconBg: 'bg-cyan-500/15',
          iconColor: 'text-cyan-400',
        },
        {
          id: 'internet_booster',
          name: { en: 'Internet Booster', ar: 'مسرع الإنترنت والشبكة' },
          desc: { en: 'Optimizes TCP/IP parameters and DNS cache', ar: 'ضبط بارامترات بروتوكول TCP/IP وذاكرة الـ DNS' },
          icon: Globe,
          badge: 'PRO',
          targetSection: 'network',
          iconBg: 'bg-blue-500/15',
          iconColor: 'text-blue-400',
        },
        {
          id: 'startup_manager',
          name: { en: 'Startup Manager', ar: 'مدير بدء التشغيل' },
          desc: { en: 'Delays or disables auto-starting software', ar: 'تأخير أو تعطيل تشغيل البرامج التلقائي مع الويندوز' },
          icon: Rocket,
          targetSection: 'performance',
          iconBg: 'bg-amber-500/15',
          iconColor: 'text-amber-400',
        },
        {
          id: 'registry_defrag',
          name: { en: 'Registry Defrag', ar: 'ضغط سجل النظام' },
          desc: { en: 'Compact registry hives to reduce disk footprint', ar: 'دمج خلايا السجل وتقليص حجم ملفات النظام' },
          icon: Wrench,
          targetSection: 'maintenance',
          iconBg: 'bg-indigo-500/15',
          iconColor: 'text-indigo-400',
        },
        {
          id: 'system_info',
          name: { en: 'System Information', ar: 'معلومات العتاد والنظام' },
          desc: { en: 'Detailed hardware specs & motherboard telemetry', ar: 'مواصفات مفصلة للمعالج واللوحة الأم وكروت الشاشة' },
          icon: Server,
          targetSection: 'diagnostics',
          iconBg: 'bg-slate-500/15',
          iconColor: 'text-slate-300',
        },
        {
          id: 'auto_shutdown',
          name: { en: 'Auto Shutdown', ar: 'الإيقاف التلقائي المجدول' },
          desc: { en: 'Schedules PC power-off, hibernate, or restart', ar: 'جدولة إيقاف التشغيل أو السكون بعد اكتمال المهام' },
          icon: Power,
          targetSection: 'maintenance',
          iconBg: 'bg-red-500/15',
          iconColor: 'text-red-400',
        },
      ],
    },
    {
      id: 'security_repair',
      title: { en: 'Security & Repair', ar: 'الأمان والإصلاح' },
      subtitle: { en: 'Windows diagnostics and repair', ar: 'إصلاح أعطال الويندوز وجدار الحماية' },
      color: 'from-emerald-500/20 border-emerald-500/30 text-emerald-400',
      items: [
        {
          id: 'win_fix',
          name: { en: 'Win Fix Pro', ar: 'مصلح أخطاء الويندوز' },
          desc: { en: 'Fixes desktop icons, audio bugs, and system errors', ar: 'إصلاح اختفاء أيقونات سطح المكتب وأعطال الصوت والشاشة' },
          icon: Wrench,
          badge: 'PRO',
          targetSection: 'maintenance',
          iconBg: 'bg-emerald-500/15',
          iconColor: 'text-emerald-400',
        },
        {
          id: 'face_id',
          name: { en: 'FaceID / Access Guard', ar: 'حارس الوصول والمصادقة' },
          desc: { en: 'Intruder detection & system authentication logs', ar: 'كشف المتطفلين وتوثيق محاولات الدخول غير المصرح بها' },
          icon: UserCheck,
          targetSection: 'security',
          iconBg: 'bg-teal-500/15',
          iconColor: 'text-teal-400',
        },
        {
          id: 'context_menu',
          name: { en: 'Context Menu Manager', ar: 'مدير قائمة الزر الأيمن' },
          desc: { en: 'Removes clutters from right-click shell extensions', ar: 'تنظيف وتنسيق قائمة الزر الأيمن للماوس' },
          icon: Sliders,
          targetSection: 'maintenance',
          iconBg: 'bg-cyan-500/15',
          iconColor: 'text-cyan-400',
        },
        {
          id: 'disk_doctor',
          name: { en: 'Disk Doctor', ar: 'طبيب الأقراص والقطاعات' },
          desc: { en: 'Scans and fixes file system bad clusters (CHKDSK)', ar: 'فحص وإصلاح القطاعات المعطوبة في نظام الملفات' },
          icon: HardDrive,
          targetSection: 'disk',
          iconBg: 'bg-blue-500/15',
          iconColor: 'text-blue-400',
        },
        {
          id: 'dns_protector',
          name: { en: 'DNS Protector', ar: 'حامي بروتوكول DNS' },
          desc: { en: 'Locks DNS IP addresses against malware poisoning', ar: 'تأمين عناوين DNS ومنع التلاعب والتسميم' },
          icon: Globe,
          targetSection: 'security',
          iconBg: 'bg-indigo-500/15',
          iconColor: 'text-indigo-400',
        },
        {
          id: 'undelete',
          name: { en: 'Undelete & Restore', ar: 'استعادة الملفات المحذوفة' },
          desc: { en: 'Recovers files from quarantine and recycle bin', ar: 'استرجاع الملفات المحذوفة من منطقة العزل بأمان' },
          icon: RotateCcw,
          targetSection: 'backupRecovery',
          iconBg: 'bg-purple-500/15',
          iconColor: 'text-purple-400',
        },
      ],
    },
    {
      id: 'system_clean',
      title: { en: 'System Clean', ar: 'تنظيف النظام' },
      subtitle: { en: 'Deep file and registry sanitization', ar: 'تطهير عميق للقرص وسجلات المخلفات' },
      color: 'from-purple-500/20 border-purple-500/30 text-purple-400',
      items: [
        {
          id: 'registry_cleaner',
          name: { en: 'Registry Cleaner Pro', ar: 'منظف سجل النظام' },
          desc: { en: 'Cleans broken registry links and orphaned CLSIDs', ar: 'مسح مفاتيح السجل اليتيمة لتسريع الاستجابة' },
          icon: Wrench,
          badge: 'PRO',
          targetSection: 'maintenance',
          iconBg: 'bg-purple-500/15',
          iconColor: 'text-purple-400',
        },
        {
          id: 'disk_cleaner',
          name: { en: 'Disk Cleaner Pro', ar: 'منظف الأقراص السريع' },
          desc: { en: 'Frees gigabytes from installer & temporary caches', ar: 'استرداد مساحات تخزين ضخمة من مخلفات التحديثات' },
          icon: Trash2,
          badge: 'PRO',
          targetSection: 'cleanup',
          iconBg: 'bg-cyan-500/15',
          iconColor: 'text-cyan-400',
        },
        {
          id: 'file_shredder',
          name: { en: 'File Shredder (DoD)', ar: 'مفرمة الملفات الآمنة' },
          desc: { en: 'Irreversibly destroys files using DoD 5220.22-M algorithm', ar: 'حذف عسكري غير قابل للاسترجاع للملفات الحساسة' },
          icon: Scissors,
          targetSection: 'privacy',
          iconBg: 'bg-rose-500/15',
          iconColor: 'text-rose-400',
        },
        {
          id: 'empty_folders',
          name: { en: 'Empty Folder Scanner', ar: 'كاشف المجلدات الفارغة' },
          desc: { en: 'Scans and removes zero-byte orphaned folders', ar: 'البحث عن المجلدات الفارغة وحذفها بضغطة واحدة' },
          icon: FileX,
          targetSection: 'cleanup',
          iconBg: 'bg-amber-500/15',
          iconColor: 'text-amber-400',
        },
        {
          id: 'shortcut_fixer',
          name: { en: 'Shortcut Fixer', ar: 'مصلح الاختصارات' },
          desc: { en: 'Finds and resolves invalid desktop .lnk shortcuts', ar: 'البحث عن الاختصارات التالفة وحذفها تلقائياً' },
          icon: Layers,
          targetSection: 'maintenance',
          iconBg: 'bg-blue-500/15',
          iconColor: 'text-blue-400',
        },
        {
          id: 'large_files',
          name: { en: 'Large File Finder', ar: 'كاشف الملفات الكبيرة' },
          desc: { en: 'Locates space-consuming ISOs, dumps, and archives', ar: 'تحديد الملفات الضخمة التي تلتهم مساحة القرص' },
          icon: FileSearch,
          targetSection: 'cleanup',
          iconBg: 'bg-emerald-500/15',
          iconColor: 'text-emerald-400',
        },
      ],
    },
  ], []);

  // Filter items based on search query
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return columns;
    const q = searchQuery.toLowerCase();
    return columns.map((col) => ({
      ...col,
      items: col.items.filter(
        (it) =>
          it.name.en.toLowerCase().includes(q) ||
          it.name.ar.includes(q) ||
          it.desc.en.toLowerCase().includes(q) ||
          it.desc.ar.includes(q)
      ),
    }));
  }, [columns, searchQuery]);

  const handleToolClick = (tool: ToolboxItem) => {
    setQuickActionNotice(lang === 'ar' ? `فتح ${tool.name.ar}...` : `Launching ${tool.name.en}...`);
    setTimeout(() => {
      setQuickActionNotice(null);
      onOpenSection(tool.targetSection);
    }, 400);
  };

  // 18 Suites organized into 4 logical domain columns
  const suiteColumns = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const matchesFilter = (cat: typeof CATEGORIES[0]) => {
      if (!q) return true;
      return (
        cat.name.en.toLowerCase().includes(q) ||
        cat.name.ar.toLowerCase().includes(q) ||
        cat.purpose.en.toLowerCase().includes(q) ||
        cat.purpose.ar.toLowerCase().includes(q) ||
        cat.id.toLowerCase().includes(q)
      );
    };

    return [
      {
        id: 'col-maint',
        title: { en: 'Maintenance & Clean', ar: 'الصيانة والتنظيف' },
        subtitle: { en: 'Registry, disk & deep cleanup', ar: 'السجل والقرص وإزالة المخلفات' },
        items: CATEGORIES.filter((c) =>
          ['01-System-Maintenance', '02-System-Cleanup', '05-Duplicate-Files', '06-Disk-Space'].includes(c.id)
        ).filter(matchesFilter),
      },
      {
        id: 'col-perf',
        title: { en: 'Speed & Hardware', ar: 'السرعة والعتاد' },
        subtitle: { en: 'Power plans, drivers & startup', ar: 'خطط الطاقة والتعريفات والإقلاع' },
        items: CATEGORIES.filter((c) =>
          ['08-Performance', '04-Programs-Applications', '07-Services-Processes', '14-Driver-Management'].includes(c.id)
        ).filter(matchesFilter),
      },
      {
        id: 'col-sec',
        title: { en: 'Security & Privacy', ar: 'الأمان والخصوصية' },
        subtitle: { en: 'Defender, anti-tracking & backup', ar: 'الجدار الناري وحظر التتبع والنسخ' },
        items: CATEGORIES.filter((c) =>
          ['09-Security', '13-Privacy', '11-Backup-Recovery', '03-Network-Internet', '17-PostInstall-Setup'].includes(c.id)
        ).filter(matchesFilter),
      },
      {
        id: 'col-diag',
        title: { en: 'Diagnostics & Dev', ar: 'التشخيص والبيئات' },
        subtitle: { en: 'Event logs, dev cache & sonar', ar: 'سجلات الأحداث ومراقبة النظام وسونار' },
        items: CATEGORIES.filter((c) =>
          ['10-Diagnostics-Reports', '12-Developer-Tools', '15-System-Monitoring', '16-Software-Environment', '18-Project-Sonar'].includes(c.id)
        ).filter(matchesFilter),
      },
    ];
  }, [searchQuery]);

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-6 pr-1 custom-scrollbar">
      {/* ── Top Header with Search Bar ── */}
      <div className="flex flex-col gap-4 p-5 rounded-3xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-blue-950/40 border border-white/[0.08] backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Layers size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white font-display">
                  {lang === 'ar' ? 'صندوق الأدوات الشامل (4 أعمدة)' : 'Master Toolbox Suite'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {activeTab === 'featured' ? '24 PRO TOOLS' : '158 TOOLS / 18 SUITES'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  bridgeElevated
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {bridgeElevated ? (lang === 'ar' ? 'مسؤول' : 'ELEVATED') : (lang === 'ar' ? 'مستخدم' : 'STANDARD')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar'
                  ? 'توزيع استثنائي عالي الاحترافية يضم كافة أدوات التحسين والأمان والتنظيف بنقرة واحدة'
                  : 'All-in-one categorized 4-column matrix for deep Windows diagnostics, cleanup, and tuning'}
              </p>
            </div>
          </div>

          {/* Instant Search Bar */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث في الأدوات والمحطات...' : 'Search tools & suites...'}
              className="w-full pl-10 pr-4 rtl:pl-4 rtl:pr-10 py-2 rounded-xl bg-slate-950/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* View Mode Tabs (24 Tools vs 18 Suites) */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setActiveTab('featured')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'featured'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.07] border border-white/[0.05]'
            }`}
          >
            <Sparkles size={14} />
            <span>{lang === 'ar' ? 'الأدوات الـ 24 المميزة (4 أعمدة)' : '24 Featured Pro Tools (4-Col)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suites')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'suites'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.07] border border-white/[0.05]'
            }`}
          >
            <Boxes size={14} />
            <span>{lang === 'ar' ? 'محطات الصيانة الـ 18 الأصلية (158 أداة)' : 'All 18 Original Suites (158 Tools)'}</span>
          </button>
        </div>
      </div>

      {/* Quick Launch Notification Toast */}
      {quickActionNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <Sparkles size={14} className="animate-spin" />
          <span>{quickActionNotice}</span>
        </motion.div>
      )}

      {/* ── CONDITIONAL RENDER: 24 PRO TOOLS OR 18 ORIGINAL SUITES ── */}
      {activeTab === 'featured' ? (
        /* ── THE ICONIC 4-COLUMN GRID (Matching Images 1, 5, 8) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredColumns.map((column) => (
            <div
              key={column.id}
              className="flex flex-col rounded-3xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-xl p-4 shadow-xl space-y-3"
            >
              {/* Column Header */}
              <div className="pb-3 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-white tracking-wide">
                    {column.title[lang]}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {column.subtitle[lang]}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-full bg-white/[0.04]">
                  {column.items.length}
                </span>
              </div>

              {/* List of Tools in this Column */}
              <div className="space-y-2.5 flex-1">
                {column.items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {lang === 'ar' ? 'لا توجد أدوات مطابقة للبحث' : 'No tools matched search'}
                  </div>
                ) : (
                  column.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={item.id}
                        onClick={() => handleToolClick(item)}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="group p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.07] border border-white/[0.05] hover:border-cyan-500/30 transition-all duration-200 cursor-pointer select-none flex items-start gap-3 relative overflow-hidden"
                      >
                        {/* Subtle hover specular highlight */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                        {/* Glowing Circular Icon container */}
                        <div className={`w-11 h-11 rounded-2xl ${item.iconBg} border border-white/[0.08] flex items-center justify-center ${item.iconColor} shrink-0 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all`}>
                          <Icon size={20} className="group-hover:scale-110 transition-transform" />
                        </div>

                        {/* Tool Texts */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <h3 className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                              {item.name[lang]}
                            </h3>
                            {item.badge && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono tracking-wider ${
                                  item.badge === 'HOT'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : item.badge === 'PRO'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed group-hover:text-slate-300">
                            {item.desc[lang]}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── 18 ORIGINAL SPECIALIZED SUITES MATRIX (ORGANIZED IN 4 DOMAIN COLUMNS) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {suiteColumns.map((column) => (
            <div
              key={column.id}
              className="flex flex-col rounded-3xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-xl p-4 shadow-xl space-y-3"
            >
              {/* Column Header */}
              <div className="pb-3 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-white tracking-wide">
                    {column.title[lang]}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {column.subtitle[lang]}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 font-bold">
                  {column.items.length} {lang === 'ar' ? 'محطات' : 'Suites'}
                </span>
              </div>

              {/* List of Suites in this Column */}
              <div className="space-y-3 flex-1">
                {column.items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {lang === 'ar' ? 'لا توجد محطات مطابقة للبحث' : 'No suites matched search'}
                  </div>
                ) : (
                  column.items.map((cat) => {
                    const CatIcon = CATEGORY_ICONS[cat.icon] || Wrench;
                    const toolCount = toolsByCategory[cat.id]?.length || toolsByCategory[SECTION_MAP[cat.section]]?.length || 0;
                    return (
                      <motion.div
                        key={cat.id}
                        onClick={() => onOpenSection(cat.section)}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="group p-3.5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.07] border border-white/[0.05] hover:border-cyan-500/40 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110"
                              style={{
                                backgroundColor: `${cat.accent}18`,
                                borderColor: `${cat.accent}35`,
                                color: cat.accent,
                                boxShadow: `0 0 12px ${cat.accent}25`,
                              }}
                            >
                              <CatIcon size={20} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-500 font-bold">
                                  {cat.id.substring(0, 2)}
                                </span>
                                <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                                  {cat.name[lang]}
                                </h3>
                              </div>
                              <span className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 block leading-relaxed">
                                {cat.purpose[lang]}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-md bg-white/[0.04]">
                            {toolCount > 0 ? `${toolCount} ${lang === 'ar' ? 'أداة' : 'tools'}` : (lang === 'ar' ? 'محطة نشطة' : 'Active Suite')}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 group-hover:text-cyan-300">
                            <span>{lang === 'ar' ? 'فتح المحطة' : 'Open Suite'}</span>
                            <ArrowRight size={12} className="rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
