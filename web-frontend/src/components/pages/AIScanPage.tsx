import { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Box,
  CheckCircle2,
  Clock,
  Code2,
  Crosshair,
  Database,
  FileText,
  Layers,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Monitor,
  Play,
  Rocket,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import type { FamilyId, NavDestination, ServiceId } from '../../data/family-map';
import { api } from '../../lib/api';
import type { SystemSnapshot } from '../../lib/api';

export interface AIScanPageProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  toolCount: number | null;
  onNavigate: (dest: NavDestination) => void;
  systemSnapshot?: SystemSnapshot | null;
  aiProviderState?: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  onTargetChange?: (target: string | null) => void;
  onEvidenceUpdate?: (evidenceCount: number, findingCount: number) => void;
}

export interface ScanFinding {
  id: string;
  severity: 'critical' | 'warning' | 'optimal';
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  metric?: string;
  dest: {
    family: FamilyId;
    service?: ServiceId;
    toolId?: string;
  };
  actionLabelEn: string;
  actionLabelAr: string;
}

type TargetOption = {
  id: string;
  family: FamilyId;
  service?: ServiceId;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
};

const TARGET_OPTIONS: TargetOption[] = [
  {
    id: 'system',
    family: 'vitality',
    service: '01-System-Maintenance',
    labelEn: 'Full System Vitals',
    labelAr: 'فحص حيوية النظام الشامل',
    descEn: 'Evaluate hardware, RAM pressure, and core health',
    descAr: 'تحليل العتاد وضغط الذاكرة وصحة النظام',
  },
  {
    id: 'performance',
    family: 'vitality',
    service: '08-Performance',
    labelEn: 'System Performance',
    labelAr: 'أداء النظام والاستجابة',
    descEn: 'Audit execution speed, memory leaks, and CPU pressure',
    descAr: 'فحص سرعة التنفيذ وتسريب الذاكرة وضغط المعالج',
  },
  {
    id: 'storage',
    family: 'recovery',
    service: '06-Disk-Space',
    labelEn: 'Storage & Cleanup',
    labelAr: 'التخزين وتفريغ المساحة',
    descEn: 'Identify junk caches, disk volume usage, and temp bloat',
    descAr: 'رصد مخلفات التخزين والمساحة المستهلكة',
  },
  {
    id: 'security',
    family: 'assurance',
    service: '09-Security',
    labelEn: 'Security & Assurance',
    labelAr: 'الأمان والضمان',
    descEn: 'Verify Defender status, firewall, and device drivers',
    descAr: 'التأكد من حالة الحماية والجدار الناري وتعريفات العتاد',
  },
  {
    id: 'software',
    family: 'software',
    service: '04-Programs-Applications',
    labelEn: 'Software Environment',
    labelAr: 'بيئة البرمجيات والتطبيقات',
    descEn: 'Inspect application health, runtime runtimes, and packages',
    descAr: 'فحص سلامة البرامج والحزم وحزم التشغيل',
  },
  {
    id: 'workbench',
    family: 'workbench',
    service: '12-Developer-Tools',
    labelEn: 'Developer Project',
    labelAr: 'مشروع المطور والبيئة الهندسية',
    descEn: 'Audit repo manifests, developer toolchains, and Sonar telemetry',
    descAr: 'فحص مستودعات المشاريع وأدوات المطور وتقارير سونار',
  },
];

export default function AIScanPage({
  lang,
  bridgeOnline,
  toolCount: _toolCount,
  onNavigate,
  systemSnapshot,
  aiProviderState: _aiProviderState = 'UNCONFIGURED',
  onTargetChange,
  onEvidenceUpdate,
}: AIScanPageProps) {
  const isRtl = lang === 'ar';
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [evidenceSourceCount, setEvidenceSourceCount] = useState(0);
  const [scanError, setScanError] = useState('');

  const [selectedTarget, setSelectedTarget] = useState<TargetOption | null>(null);
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);

  const handleSelectTarget = useCallback((target: TargetOption | null) => {
    setSelectedTarget(target);
    setTargetPickerOpen(false);
    onTargetChange?.(target ? (isRtl ? target.labelAr : target.labelEn) : null);
  }, [isRtl, onTargetChange]);

  const handleChipClick = useCallback((chipId: string) => {
    if (selectedChipId === chipId) {
      setSelectedChipId(null);
      handleSelectTarget(null);
      return;
    }
    setSelectedChipId(chipId);
    const matched = TARGET_OPTIONS.find(t => t.id === chipId) ?? null;
    handleSelectTarget(matched);
  }, [handleSelectTarget, selectedChipId]);

  const runDiagnosticScan = useCallback(async () => {
    if (bridgeOnline !== true) return;

    setScanning(true);
    setScanError('');
    setEvidenceSourceCount(0);
    setSelectedFindingId(null);
    setScanStage(isRtl ? 'فحص مقاييس الحيوية والأداء...' : 'Inspecting system vitals & memory pressure...');

    const discoveredFindings: ScanFinding[] = [];
    let verifiedSources = 0;

    try {
      const sysRes = await api.system().catch(() => null);
      setScanStage(isRtl ? 'فحص سعة الأقراص والنظافة العامة...' : 'Evaluating disk capacity & hygiene...');

      if (sysRes?.system) {
        verifiedSources += 1;
        const sys = sysRes.system;

        if (sys.TotalRamGB && sys.FreeRamGB !== undefined) {
          const usedGB = sys.TotalRamGB - sys.FreeRamGB;
          const ramPct = Math.round((usedGB / sys.TotalRamGB) * 100);
          if (ramPct > 85) {
            discoveredFindings.push({
              id: 'ram-pressure',
              severity: 'warning',
              titleEn: 'Elevated Memory Consumption',
              titleAr: 'استهلاك مرتفع للذاكرة العشوائية',
              detailEn: `Active memory usage is at ${ramPct}% (${usedGB.toFixed(1)} GB of ${sys.TotalRamGB.toFixed(1)} GB).`,
              detailAr: `استهلاك الذاكرة النشط وصل إلى ${ramPct}٪ (${usedGB.toFixed(1)} جيجابايت من أصل ${sys.TotalRamGB.toFixed(1)} جيجابايت).`,
              metric: `${ramPct}% RAM`,
              dest: { family: 'vitality', service: '08-Performance', toolId: 'PF01' },
              actionLabelEn: 'Optimize Performance',
              actionLabelAr: 'تحسين الأداء',
            });
          }
        }

        const sysDrive = sys.Drives?.find(drive => drive.IsSystem || drive.Name === sys.SystemDrive) ?? sys.Drives?.[0];
        if (sysDrive && sysDrive.FreeGB !== undefined && sysDrive.TotalGB) {
          const usedPct = Math.round(((sysDrive.TotalGB - sysDrive.FreeGB) / sysDrive.TotalGB) * 100);
          if (sysDrive.FreeGB < 20 || usedPct > 88) {
            discoveredFindings.push({
              id: 'disk-space-low',
              severity: sysDrive.FreeGB < 10 ? 'critical' : 'warning',
              titleEn: 'System Drive Storage Pressure',
              titleAr: 'ضغط على مساحة قرص النظام',
              detailEn: `System drive (${sysDrive.Name || 'C:'}) has ${sysDrive.FreeGB.toFixed(1)} GB free (${usedPct}% occupied).`,
              detailAr: `قرص النظام (${sysDrive.Name || 'C:'}) يتبقى به ${sysDrive.FreeGB.toFixed(1)} جيجابايت فقط (${usedPct}٪ مستغل).`,
              metric: `${sysDrive.FreeGB.toFixed(1)} GB Free`,
              dest: { family: 'recovery', service: '06-Disk-Space', toolId: 'DS01' },
              actionLabelEn: 'Audit Disk Space',
              actionLabelAr: 'فحص مساحة القرص',
            });
          }
        }

        if (sys.DefenderRealtime === false) {
          discoveredFindings.push({
            id: 'defender-disabled',
            severity: 'critical',
            titleEn: 'Real-Time Protection Disabled',
            titleAr: 'الحماية في الوقت الفعلي معطلة',
            detailEn: 'Windows Defender real-time protection is inactive, leaving the system exposed.',
            detailAr: 'الحماية الفورية لويندوز ديفندر متوقفة حالياً، مما يجعل النظام غير محمي.',
            metric: 'Security Alert',
            dest: { family: 'assurance', service: '09-Security', toolId: 'SE04' },
            actionLabelEn: 'Check Security Posture',
            actionLabelAr: 'فحص إعدادات الأمان',
          });
        }
      }

      setScanStage(isRtl ? 'تحليل مخلفات النظام المؤكدة...' : 'Analyzing reclaimable temporary files...');
      const cleanRes = await api.cleanupPreview().catch(() => null);
      if (cleanRes?.preview) {
        verifiedSources += 1;
        const bytes = cleanRes.preview.Summary?.EstimatedReclaimableBytes ?? 0;
        const mb = Math.round(bytes / (1024 * 1024));
        if (mb > 500) {
          discoveredFindings.push({
            id: 'cleanup-cache-bloat',
            severity: mb > 2048 ? 'critical' : 'warning',
            titleEn: 'Safe Reclaimable Disk Space',
            titleAr: 'مساحة قابلة للاسترجاع بأمان',
            detailEn: `Found approx. ${mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`} of dispensable caches and temporary files.`,
            detailAr: `تم العثور على ما يقارب ${mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجابايت` : `${mb} ميجابايت`} من الملفات المؤقتة والذاكرة المخبأة الآمن حذفها.`,
            metric: mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`,
            dest: { family: 'recovery', service: '02-System-Cleanup', toolId: 'SC01' },
            actionLabelEn: 'Clean System Junk',
            actionLabelAr: 'تنظيف المخلفات',
          });
        }
      }

      setScanStage(isRtl ? 'فحص سلامة التعريفات وتوقيعات العتاد...' : 'Verifying driver signatures & hardware stability...');
      const driverRes = await api.driversPreview().catch(() => null);
      if (driverRes?.preview) {
        verifiedSources += 1;
        const problems = driverRes.preview.DeviceProblems ?? [];
        if (problems.length > 0) {
          discoveredFindings.push({
            id: 'device-hardware-problems',
            severity: 'critical',
            titleEn: 'Device Manager Hardware Faults',
            titleAr: 'أخطاء في إدارة الأجهزة والعتاد',
            detailEn: `${problems.length} hardware device(s) report error states or missing drivers.`,
            detailAr: `تم رصد ${problems.length} جهاز يعاني من تعارض أو نقص في برامج التشغيل.`,
            metric: `${problems.length} Device Alert`,
            dest: { family: 'assurance', service: '14-Driver-Management', toolId: 'DM02' },
            actionLabelEn: 'Audit Device Problems',
            actionLabelAr: 'تشخيص أخطاء الأجهزة',
          });
        }
      }

      setEvidenceSourceCount(verifiedSources);
      setFindings(discoveredFindings);
      setSelectedFindingId(discoveredFindings[0]?.id ?? null);
      setScanTimestamp(new Date().toLocaleTimeString());
      setScanStage(isRtl ? 'اكتمل الفحص' : 'Diagnostic scan complete');
      onEvidenceUpdate?.(verifiedSources, discoveredFindings.length);
    } catch {
      setFindings([]);
      setSelectedFindingId(null);
      setEvidenceSourceCount(0);
      setScanError(isRtl ? 'تعذر جمع أدلة تشخيص موثوقة من الجسر.' : 'The bridge returned no verifiable evidence source.');
      onEvidenceUpdate?.(0, 0);
    } finally {
      setScanning(false);
    }
  }, [bridgeOnline, isRtl, onEvidenceUpdate]);

  const selectedFinding = useMemo(() => {
    return findings?.find(f => f.id === selectedFindingId) ?? findings?.[0] ?? null;
  }, [findings, selectedFindingId]);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase().trim();
    if (q.includes('ram') || q.includes('perf') || q.includes('slow') || q.includes('memory')) {
      handleChipClick('performance');
    } else if (q.includes('disk') || q.includes('clean') || q.includes('space') || q.includes('junk')) {
      handleChipClick('storage');
    } else if (q.includes('sec') || q.includes('virus') || q.includes('defender') || q.includes('protect')) {
      handleChipClick('security');
    } else if (q.includes('soft') || q.includes('app') || q.includes('program')) {
      handleChipClick('software');
    } else if (q.includes('dev') || q.includes('code') || q.includes('git') || q.includes('repo')) {
      handleChipClick('workbench');
    } else {
      handleChipClick('system');
    }
  };

  const currentSystemSummary = useMemo(() => {
    if (!systemSnapshot) return isRtl ? 'لم يتم تحديد هدف.' : 'No target selected.';
    const os = systemSnapshot.Os || 'Windows 11';
    const ram = systemSnapshot.TotalRamGB ? `${systemSnapshot.TotalRamGB} GB RAM` : '';
    const sysDrive = systemSnapshot.Drives?.find(d => d.IsSystem) || systemSnapshot.Drives?.[0];
    const free = sysDrive ? `${sysDrive.FreeGB.toFixed(0)} GB Free` : '';
    return [os, ram, free].filter(Boolean).join(' • ');
  }, [systemSnapshot, isRtl]);

  const suggestedAction = useMemo(() => {
    if (!findings || findings.length === 0) return null;
    return findings[0];
  }, [findings]);

  return (
    <div className="knoux-ai-command-center knoux-ai-reference-experience" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Central Diagnostic Reactor & Core Visual ── */}
      <section className="knoux-ai-hero-viewport" aria-label="KNOUX AI Diagnostic Core">
        <div className="knoux-ai-reactor-assembly" data-scanning={scanning}>
          {/* Background ECG heartbeat wave lines */}
          <div className="knoux-ai-ecg-backdrop" aria-hidden="true">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="knoux-ai-ecg-svg">
              <defs>
                <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(34, 211, 238, 0)" />
                  <stop offset="25%" stopColor="rgba(34, 211, 238, 0.4)" />
                  <stop offset="50%" stopColor="rgba(168, 85, 247, 0.7)" />
                  <stop offset="75%" stopColor="rgba(34, 211, 238, 0.4)" />
                  <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
                </linearGradient>
                <filter id="ecgGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M 0 60 L 260 60 L 280 42 L 295 78 L 310 32 L 325 70 L 340 54 L 355 60 L 840 60 L 855 42 L 870 78 L 885 30 L 900 74 L 915 54 L 930 60 L 1200 60"
                fill="none"
                stroke="url(#ecgGrad)"
                strokeWidth="1.8"
                filter="url(#ecgGlow)"
                className="knoux-ai-ecg-path"
              />
            </svg>
          </div>

          {/* Left Flanking Technical Monospace Copy */}
          <div className="knoux-ai-tech-flank is-left" aria-hidden="true">
            <div className="knoux-ai-tech-group">
              <span className={scanning && scanStage.includes('Inspect') ? 'is-active' : ''}>ANALYZE</span>
              <span className={scanning && scanStage.includes('Evaluat') ? 'is-active' : ''}>DETECT</span>
              <span className={scanning ? 'is-active' : ''}>CORRELATE</span>
              <span>UNDERSTAND</span>
              <span>RECOMMEND</span>
              <span>SOLVE</span>
            </div>
            <div className="knoux-ai-tech-group is-secondary">
              <span>YOUR PC</span>
              <span>IN CONTEXT</span>
              <span>DEEPER INSIGHTS</span>
              <span>REAL SOLUTIONS</span>
            </div>
          </div>

          {/* Precision Diagnostic Core & Radar */}
          <div className="knoux-ai-diagnostic-core" aria-label="Diagnostic Core Reactor">
            {/* Concentric Calibration Rings */}
            <div className="knoux-ai-ring knoux-ai-ring-outer" />
            <div className="knoux-ai-ring knoux-ai-ring-ticks" />
            <div className="knoux-ai-ring knoux-ai-ring-radar" />
            <div className="knoux-ai-ring knoux-ai-ring-inner" />

            {/* Radar Conical Sweep Effect */}
            <div className="knoux-ai-radar-beam" />

            {/* Constellation Nodes inside the core */}
            <svg className="knoux-ai-constellation" viewBox="0 0 320 320" aria-hidden="true">
              <defs>
                <radialGradient id="meshCenter" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(34, 211, 238, 0.4)" />
                  <stop offset="100%" stopColor="rgba(124, 58, 237, 0)" />
                </radialGradient>
              </defs>
              <circle cx="160" cy="160" r="130" fill="url(#meshCenter)" opacity="0.25" />
              {/* Geometric axes */}
              <line x1="160" y1="20" x2="160" y2="300" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="20" y1="160" x2="300" y2="160" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="60" y1="60" x2="260" y2="260" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="1" />
              <line x1="60" y1="260" x2="260" y2="60" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="1" />
              {/* Star nodes */}
              <circle cx="95" cy="115" r="2.5" fill="#67e8f9" />
              <circle cx="225" cy="115" r="2.5" fill="#67e8f9" />
              <circle cx="85" cy="190" r="2.5" fill="#67e8f9" />
              <circle cx="235" cy="190" r="2.5" fill="#67e8f9" />
              <line x1="95" y1="115" x2="160" y2="160" stroke="rgba(34, 211, 238, 0.2)" strokeWidth="1" />
              <line x1="225" y1="115" x2="160" y2="160" stroke="rgba(34, 211, 238, 0.2)" strokeWidth="1" />
              <line x1="85" y1="190" x2="160" y2="160" stroke="rgba(34, 211, 238, 0.2)" strokeWidth="1" />
              <line x1="235" y1="190" x2="160" y2="160" stroke="rgba(34, 211, 238, 0.2)" strokeWidth="1" />
            </svg>

            {/* Central Crystal K Lockup */}
            <div className="knoux-ai-center-crystal">
              <div className="knoux-ai-crystal-glow" />
              <div className="knoux-ai-crystal-mark">
                <span className="knoux-ai-crystal-letter">K</span>
              </div>
            </div>

            {/* 6 Peripheral Orbit Nodes Connected via Bus Lines */}
            <div className="knoux-ai-orbit-node is-node-top-left" title={isRtl ? 'الشاشات والعرض' : 'Display & Hardware'}>
              <Monitor size={15} />
            </div>
            <div className="knoux-ai-orbit-node is-node-mid-left" title={isRtl ? 'التخزين وقواعد البيانات' : 'Storage & Volumes'}>
              <Database size={15} />
            </div>
            <div className="knoux-ai-orbit-node is-node-bottom-left" title={isRtl ? 'العمليات والتكوين' : 'System Configuration'}>
              <Settings size={15} />
            </div>
            <div className="knoux-ai-orbit-node is-node-top-right" title={isRtl ? 'التقارير والأدلة' : 'Reports & Evidence'}>
              <FileText size={15} />
            </div>
            <div className="knoux-ai-orbit-node is-node-mid-right" title={isRtl ? 'الحماية والضمان' : 'Security & Assurance'}>
              <Shield size={15} />
            </div>
            <div className="knoux-ai-orbit-node is-node-bottom-right" title={isRtl ? 'الحزم والبرمجيات' : 'Software Components'}>
              <Box size={15} />
            </div>
          </div>

          {/* Right Flanking Technical Monospace Copy */}
          <div className="knoux-ai-tech-flank is-right" aria-hidden="true">
            <div className="knoux-ai-tech-group">
              <span>INTELLIGENT</span>
              <span>DIAGNOSTICS</span>
              <span>FOR A HEALTHIER</span>
              <span>TOMORROW</span>
            </div>
            <div className="knoux-ai-tech-group is-secondary">
              <span>SAME</span>
              <span>ECOSYSTEM</span>
              <span>A HEALTHIER</span>
              <span>TOMORROW</span>
            </div>
          </div>
        </div>

        {/* Hero Title & Subtitle Matching Reference */}
        <div className="knoux-ai-hero-headings">
          <h1 className="knoux-ai-hero-title">AI SCAN</h1>
          <p className="knoux-ai-hero-subtitle">{isRtl ? 'دع نوكس يكتشف ما يهم حقاً.' : 'Let KNOUX find what matters.'}</p>
        </div>

        {/* Real Query / Issue Input */}
        <form onSubmit={handleQuerySubmit} className="knoux-ai-query-form">
          <div className="knoux-ai-query-box">
            <Search size={17} className="knoux-ai-query-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'صف مشكلة، أو اسأل KNOUX عن أي شيء...' : 'Describe an issue, or ask KNOUX anything...'}
              aria-label={isRtl ? 'صف المشكلة' : 'Describe an issue'}
            />
            <button
              type="submit"
              className="knoux-ai-query-submit"
              title={isRtl ? 'إرسال الاستعلام' : 'Submit query context'}
              aria-label={isRtl ? 'إرسال' : 'Submit'}
            >
              {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </button>
          </div>
        </form>

        {/* Quick Context Chips */}
        <div className="knoux-ai-quick-chips" role="group" aria-label={isRtl ? 'سياقات سريعة' : 'Quick contexts'}>
          <button
            type="button"
            className="knoux-ai-chip"
            data-active={selectedChipId === 'system'}
            onClick={() => handleChipClick('system')}
          >
            <Monitor size={13} />
            <span>{isRtl ? 'مشكلة بالنظام' : 'System issue'}</span>
          </button>
          <button
            type="button"
            className="knoux-ai-chip"
            data-active={selectedChipId === 'performance'}
            onClick={() => handleChipClick('performance')}
          >
            <Activity size={13} />
            <span>{isRtl ? 'الأداء' : 'Performance'}</span>
          </button>
          <button
            type="button"
            className="knoux-ai-chip"
            data-active={selectedChipId === 'storage'}
            onClick={() => handleChipClick('storage')}
          >
            <Database size={13} />
            <span>{isRtl ? 'التخزين' : 'Storage'}</span>
          </button>
          <button
            type="button"
            className="knoux-ai-chip"
            data-active={selectedChipId === 'security'}
            onClick={() => handleChipClick('security')}
          >
            <ShieldCheck size={13} />
            <span>{isRtl ? 'الأمان' : 'Security'}</span>
          </button>
          <button
            type="button"
            className="knoux-ai-chip"
            data-active={selectedChipId === 'software'}
            onClick={() => handleChipClick('software')}
          >
            <LayoutGrid size={13} />
            <span>{isRtl ? 'البرمجيات' : 'Software'}</span>
          </button>
          <button
            type="button"
            className="knoux-ai-chip"
            data-active={selectedChipId === 'workbench'}
            onClick={() => handleChipClick('workbench')}
          >
            <Code2 size={13} />
            <span>{isRtl ? 'مشروع المطور' : 'Developer project'}</span>
          </button>
        </div>
      </section>

      {/* ── Primary Action Row Matching Reference ── */}
      <section className="knoux-ai-primary-actions" aria-label="Primary Actions">
        {/* 1. Start AI Scan */}
        <button
          type="button"
          className="knoux-ai-action-card is-primary"
          onClick={runDiagnosticScan}
          disabled={scanning || bridgeOnline !== true}
        >
          <div className="knoux-ai-action-icon is-play">
            {scanning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
          </div>
          <div className="knoux-ai-action-text">
            <strong>
              {scanning
                ? (isRtl ? 'جارٍ جمع الأدلة...' : 'Collecting evidence...')
                : findings !== null
                  ? (isRtl ? 'إعادة الفحص الذكي' : 'Start AI Scan')
                  : (isRtl ? 'بدء الفحص الذكي' : 'Start AI Scan')}
            </strong>
            <small>{isRtl ? 'فحص مع استخبارات نوكس' : 'Scan with KNOUX intelligence'}</small>
          </div>
        </button>

        {/* 2. Choose Target */}
        <button
          type="button"
          className="knoux-ai-action-card"
          onClick={() => setTargetPickerOpen(prev => !prev)}
        >
          <div className="knoux-ai-action-icon">
            <Crosshair size={18} />
          </div>
          <div className="knoux-ai-action-text">
            <strong>{selectedTarget ? (isRtl ? selectedTarget.labelAr : selectedTarget.labelEn) : (isRtl ? 'تحديد الهدف' : 'Choose Target')}</strong>
            <small>{isRtl ? 'حدد ما ترغب في تحليله' : 'Select what to analyze'}</small>
          </div>
        </button>

        {/* 3. Explore Repair Families */}
        <button
          type="button"
          className="knoux-ai-action-card"
          onClick={() => onNavigate({ family: 'navigator' as FamilyId })}
        >
          <div className="knoux-ai-action-icon">
            <Layers size={18} />
          </div>
          <div className="knoux-ai-action-text">
            <strong>{isRtl ? 'استكشاف عائلات الإصلاح' : 'Explore Repair Families'}</strong>
            <small>{isRtl ? 'فتح أداة معتمدة ومسجلة لتنفيذ الإجراء المؤكد.' : 'Discover tools and solutions'}</small>
          </div>
        </button>
      </section>

      {/* Target Picker Modal/Popover if triggered */}
      {targetPickerOpen && (
        <div className="knoux-ai-target-modal" role="dialog" aria-modal="true">
          <div className="knoux-ai-target-modal-header">
            <div className="flex items-center gap-2">
              <Crosshair size={15} className="text-cyan-400" />
              <strong>{isRtl ? 'اختر هدف التشخيص' : 'Select Diagnostic Target'}</strong>
            </div>
            <button type="button" onClick={() => setTargetPickerOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>
          <div className="knoux-ai-target-modal-grid">
            {TARGET_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                className="knoux-ai-target-option"
                data-selected={selectedTarget?.id === opt.id}
                onClick={() => handleSelectTarget(opt)}
              >
                <strong>{isRtl ? opt.labelAr : opt.labelEn}</strong>
                <small>{isRtl ? opt.descAr : opt.descEn}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Secondary Context Modules Matching Reference ── */}
      <section className="knoux-ai-context-modules" aria-label="Context Modules">
        {/* Module 1: System Context */}
        <div className="knoux-ai-context-card">
          <div className="knoux-ai-context-card-head">
            <div className="knoux-ai-context-icon">
              <Monitor size={16} />
            </div>
            <div className="knoux-ai-context-info">
              <strong>{isRtl ? 'سياق النظام' : 'System Context'}</strong>
              <p>{isRtl ? 'العتاد، والبرامج، والتكوين، وصحة النظام.' : 'Hardware, software, configuration, and system health.'}</p>
            </div>
            <ArrowRight size={14} className="knoux-ai-context-chevron rtl:rotate-180" />
          </div>
          <div className="knoux-ai-context-status">
            <span>{currentSystemSummary}</span>
          </div>
        </div>

        {/* Module 2: Repair Family Context */}
        <div className="knoux-ai-context-card">
          <div className="knoux-ai-context-card-head">
            <div className="knoux-ai-context-icon">
              <Database size={16} />
            </div>
            <div className="knoux-ai-context-info">
              <strong>{isRtl ? 'سياق عائلة الإصلاح' : 'Repair Family Context'}</strong>
              <p>{isRtl ? 'الأدوات والمعارف المناسبة للهدف المحدد.' : 'Relevant tools and knowledge for the selected target.'}</p>
            </div>
            <ArrowRight size={14} className="knoux-ai-context-chevron rtl:rotate-180" />
          </div>
          <div className="knoux-ai-context-status">
            <span>{selectedTarget ? (isRtl ? selectedTarget.labelAr : selectedTarget.labelEn) : (isRtl ? 'لم يُحدد هدف.' : 'None selected.')}</span>
          </div>
        </div>

        {/* Module 3: Project Context */}
        <div className="knoux-ai-context-card">
          <div className="knoux-ai-context-card-head">
            <div className="knoux-ai-context-icon">
              <FileText size={16} />
            </div>
            <div className="knoux-ai-context-info">
              <strong>{isRtl ? 'سياق المشروع' : 'Project Context'}</strong>
              <p>{isRtl ? 'ربط مشروع إصلاح، والملاحظات، وتاريخ العمل.' : 'Link a repair project, notes, and work history.'}</p>
            </div>
            <ArrowRight size={14} className="knoux-ai-context-chevron rtl:rotate-180" />
          </div>
          <div className="knoux-ai-context-status">
            <span>{isRtl ? 'لا يوجد مشروع محدد.' : 'No project selected.'}</span>
          </div>
        </div>
      </section>

      {/* ── Lower Operational Row Matching Reference ── */}
      <section className="knoux-ai-operational-row" aria-label="Operational Actions and Recent History">
        {/* 1. Suggested Actions */}
        <div className="knoux-ai-operational-card">
          <div className="knoux-ai-operational-head">
            <div className="flex items-center gap-2">
              <Lightbulb size={15} className="text-amber-400" />
              <strong>{isRtl ? 'الإجراءات المقترحة' : 'Suggested Actions'}</strong>
            </div>
            <ArrowRight size={13} className="text-slate-500 rtl:rotate-180" />
          </div>
          <div className="knoux-ai-operational-body">
            {suggestedAction ? (
              <div className="knoux-ai-operational-suggestion">
                <span className="knoux-ai-finding-severity" data-severity={suggestedAction.severity}>
                  {suggestedAction.severity}
                </span>
                <p>{isRtl ? suggestedAction.titleAr : suggestedAction.titleEn}</p>
                <button
                  type="button"
                  className="knoux-ai-op-action-btn"
                  onClick={() => onNavigate(suggestedAction.dest)}
                >
                  <Wrench size={12} />
                  <span>{isRtl ? suggestedAction.actionLabelAr : suggestedAction.actionLabelEn}</span>
                </button>
              </div>
            ) : (
              <>
                <p className="font-semibold text-slate-300 text-[11px]">{isRtl ? 'لا توجد اقتراحات بعد.' : 'No suggestions yet.'}</p>
                <small className="text-slate-500 text-[10px] leading-relaxed block mt-1">
                  {isRtl ? 'صف مشكلة أعلاه أو اختر هدفاً للحصول على توصيات موجهة.' : 'Describe an issue above or choose a target to get personalized recommendations.'}
                </small>
              </>
            )}
          </div>
        </div>

        {/* 2. Recent Scans */}
        <div className="knoux-ai-operational-card">
          <div className="knoux-ai-operational-head">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-cyan-400" />
              <strong>{isRtl ? 'الفحوصات الأخيرة' : 'Recent Scans'}</strong>
            </div>
            <ArrowRight size={13} className="text-slate-500 rtl:rotate-180" />
          </div>
          <div className="knoux-ai-operational-body">
            {scanTimestamp ? (
              <div className="knoux-ai-operational-recent">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{isRtl ? 'فحص تشخيصي محلي' : 'Local Diagnostic Scan'}</span>
                  <span className="font-mono text-cyan-400">{scanTimestamp}</span>
                </div>
                <small className="text-slate-500 text-[10px] block mt-1">
                  {isRtl
                    ? `تم توثيق ${evidenceSourceCount} مصادر أدلة • ${findings?.length ?? 0} نتائج`
                    : `${evidenceSourceCount} verified sources • ${findings?.length ?? 0} findings recorded`}
                </small>
              </div>
            ) : (
              <>
                <p className="font-semibold text-slate-300 text-[11px]">{isRtl ? 'لا توجد فحوصات سابقة.' : 'No recent scans.'}</p>
                <small className="text-slate-500 text-[10px] leading-relaxed block mt-1">
                  {isRtl ? 'سجل الفحوصات سيظهر هنا فور اكتمال أول فحص.' : 'Your scan history will appear here.'}
                </small>
              </>
            )}
          </div>
        </div>

        {/* 3. Quick Launch */}
        <div className="knoux-ai-operational-card">
          <div className="knoux-ai-operational-head">
            <div className="flex items-center gap-2">
              <Rocket size={15} className="text-violet-400" />
              <strong>{isRtl ? 'التشغيل السريع' : 'Quick Launch'}</strong>
            </div>
            <ArrowRight size={13} className="text-slate-500 rtl:rotate-180" />
          </div>
          <div className="knoux-ai-operational-body">
            {selectedTarget ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button
                  type="button"
                  className="knoux-ai-op-action-btn"
                  onClick={() => onNavigate({ family: selectedTarget.family, service: selectedTarget.service })}
                >
                  <Wrench size={11} />
                  <span>{isRtl ? selectedTarget.labelAr : selectedTarget.labelEn}</span>
                </button>
              </div>
            ) : (
              <>
                <p className="font-semibold text-slate-300 text-[11px]">{isRtl ? 'لا توجد إجراءات سريعة بعد.' : 'No quick actions yet.'}</p>
                <small className="text-slate-500 text-[10px] leading-relaxed block mt-1">
                  {isRtl ? 'ستظهر الأدوات والمهام الشائعة بعد اختيار الهدف.' : 'Common tools and tasks will appear here after you select a target.'}
                </small>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Active Scanning Progress Banner (Real Pipeline) ── */}
      {scanning && (
        <section className="knoux-ai-scan-banner" aria-live="polite">
          <Loader2 size={18} className="animate-spin text-cyan-400" />
          <div className="flex-1">
            <strong>{isRtl ? 'جمع أدلة الفحص المعتمدة من النظام' : 'Collecting verified system evidence'}</strong>
            <p className="text-cyan-200/80 font-mono text-[11px] mt-0.5">{scanStage}</p>
          </div>
        </section>
      )}

      {/* ── Evidence / Findings Expansion Workspace ── */}
      {(findings !== null || scanError) && (
        <section id="ai-recommendation-workspace" className="knoux-ai-findings-workspace" aria-label="Scan Results">
          <header className="knoux-ai-findings-head">
            <div>
              <span className="knoux-ai-context-label">{isRtl ? 'نتائج الفحص والأدلة' : 'DIAGNOSTIC EVIDENCE'}</span>
              <strong>
                {findings === null || findings.length === 0
                  ? (isRtl ? 'اكتمال فحص الأدلة' : 'Completed Evidence Audit')
                  : (isRtl ? `${findings.length} نتائج موثقة بالأدلة` : `${findings.length} Evidence-Backed Findings`)}
              </strong>
            </div>
            {selectedFinding?.metric && <b className="knoux-ai-metric-pill">{selectedFinding.metric}</b>}
          </header>

          {evidenceSourceCount === 0 && !scanning ? (
            <div className="knoux-ai-workspace-state is-error">
              <AlertTriangle size={24} />
              <div>
                <strong>{isRtl ? 'نتيجة الفحص غير متاحة' : 'Diagnostic result unavailable'}</strong>
                <p>{scanError || (isRtl ? 'تعذر جمع أدلة تشخيص موثوقة من الجسر.' : 'The bridge returned no verifiable evidence source.')}</p>
              </div>
            </div>
          ) : findings?.length === 0 && !scanning ? (
            <div className="knoux-ai-workspace-state is-success">
              <CheckCircle2 size={24} />
              <div>
                <strong>{isRtl ? 'لم تُرصد مشكلة ضمن الفحوصات المكتملة' : 'No issue detected in completed checks'}</strong>
                <p>
                  {isRtl
                    ? `تم التحقق من ${evidenceSourceCount} مصادر أدلة بنجاح. هذا لا يعني أن الجهاز خالٍ من كل المشكلات.`
                    : `${evidenceSourceCount} evidence sources completed without detected pressure. This does not claim the entire device is issue-free.`}
                </p>
              </div>
            </div>
          ) : findings && findings.length > 0 ? (
            <div className="knoux-ai-findings-list">
              {findings.map(finding => (
                <div
                  key={finding.id}
                  className="knoux-ai-finding-card"
                  data-active={selectedFindingId === finding.id}
                  data-severity={finding.severity}
                  onClick={() => setSelectedFindingId(finding.id)}
                >
                  <div className="knoux-ai-finding-header">
                    <span className="knoux-ai-finding-dot" />
                    <span className="knoux-ai-finding-severity" data-severity={finding.severity}>
                      {finding.severity}
                    </span>
                    <strong className="knoux-ai-finding-title">
                      {isRtl ? finding.titleAr : finding.titleEn}
                    </strong>
                    {finding.metric && <span className="knoux-ai-metric-tag">{finding.metric}</span>}
                  </div>
                  <p className="knoux-ai-finding-desc">
                    {isRtl ? finding.detailAr : finding.detailEn}
                  </p>
                  <div className="knoux-ai-finding-actions">
                    <button
                      type="button"
                      className="knoux-ai-navigate-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedFinding) {
                          onNavigate(selectedFinding.dest);
                        } else {
                          onNavigate(finding.dest);
                        }
                      }}
                    >
                      <Wrench size={13} />
                      <span>{isRtl ? finding.actionLabelAr : finding.actionLabelEn}</span>
                      {isRtl ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
