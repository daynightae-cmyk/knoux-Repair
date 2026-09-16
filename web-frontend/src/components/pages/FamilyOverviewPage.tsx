import {
  Activity,
  ArrowRight,
  Binary,
  Boxes,
  CircleDot,
  Database,
  FileSearch,
  Gauge,
  HardDrive,
  LockKeyhole,
  Network,
  PackageCheck,
  Radio,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import type { FamilyDefinition, FamilyId, ServiceId } from '../../data/family-map';
import type { BridgeTool, SystemSnapshot } from '../../lib/api';
import {
  AssuranceHoloVisual,
  InvestigationHoloVisual,
  RecoveryHoloVisual,
  VitalityHoloVisual,
  WorkbenchHoloVisual,
} from '../premium/HeroVisuals';
import './FamilyOverviewPage.css';

interface FamilyOverviewPageProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  systemSnapshot?: SystemSnapshot | null;
  onSelectService: (id: ServiceId) => void;
}

type FamilyCopy = {
  eyebrow: { en: string; ar: string };
  headline: { en: string; ar: string };
  body: { en: string; ar: string };
  action: { en: string; ar: string };
};

const COPY: Partial<Record<FamilyId, FamilyCopy>> = {
  vitality: {
    eyebrow: { en: 'HEALTH • PERFORMANCE • STABILITY', ar: 'الصحة • الأداء • الاستقرار' },
    headline: { en: 'System Vitality', ar: 'حيوية النظام' },
    body: { en: 'Inspect Windows integrity, performance pressure and monitoring evidence before choosing a repair path.', ar: 'افحص سلامة ويندوز وضغط الأداء وأدلة المراقبة قبل اختيار مسار الإصلاح.' },
    action: { en: 'Open health workspace', ar: 'فتح مساحة صحة النظام' },
  },
  recovery: {
    eyebrow: { en: 'CLEAN • RECOVER • PROTECT DATA', ar: 'نظّف • استعد • احمِ البيانات' },
    headline: { en: 'Recovery & Storage', ar: 'الاستعادة والتخزين' },
    body: { en: 'Move from storage evidence to duplicates, cleanup, disk analysis and recovery without destructive defaults.', ar: 'انتقل من أدلة التخزين إلى التكرارات والتنظيف وتحليل الأقراص والاستعادة بدون اختيارات تدميرية تلقائية.' },
    action: { en: 'Open storage workspace', ar: 'فتح مساحة التخزين' },
  },
  assurance: {
    eyebrow: { en: 'NETWORK • TRUST • PRIVACY • DRIVERS', ar: 'الشبكة • الثقة • الخصوصية • التعريفات' },
    headline: { en: 'Assurance', ar: 'الضمان والحماية' },
    body: { en: 'Inspect protection, connectivity, privacy and driver evidence. Unknown stays unknown until Windows reports it.', ar: 'افحص أدلة الحماية والاتصال والخصوصية والتعريفات. غير المعروف يظل غير معروف حتى يبلّغ به ويندوز.' },
    action: { en: 'Open assurance workspace', ar: 'فتح مساحة الحماية' },
  },
  workbench: {
    eyebrow: { en: 'ENGINEER • ANALYZE • SHIP', ar: 'هندس • حلّل • أطلق' },
    headline: { en: 'Engineering Workbench', ar: 'ورشة الهندسة' },
    body: { en: 'A repository-aware engineering station for real toolchain evidence, project intelligence, ports, Git and Project Sonar.', ar: 'محطة هندسية مرتبطة بالمشروع لأدلة الأدوات الفعلية وذكاء المشروع والمنافذ وGit وسونار المشاريع.' },
    action: { en: 'Enter engineering workspace', ar: 'دخول مساحة الهندسة' },
  },
  investigation: {
    eyebrow: { en: 'OBSERVE • DIAGNOSE • EVIDENCE', ar: 'راقب • شخّص • وثّق' },
    headline: { en: 'Investigation', ar: 'التحقيق' },
    body: { en: 'Correlate services, processes and diagnostic reports into evidence you can inspect, export and revisit.', ar: 'اربط الخدمات والعمليات والتقارير التشخيصية في أدلة قابلة للفحص والتصدير والمراجعة.' },
    action: { en: 'Open investigation workspace', ar: 'فتح مساحة التحقيق' },
  },
};

const SERVICE_ICONS: Record<string, ElementType> = {
  '01-System-Maintenance': ShieldCheck,
  '02-System-Cleanup': Boxes,
  '03-Network-Internet': Network,
  '05-Duplicate-Files': Database,
  '06-Disk-Space': HardDrive,
  '07-Services-Processes': Binary,
  '08-Performance': Gauge,
  '09-Security': LockKeyhole,
  '10-Diagnostics-Reports': FileSearch,
  '11-Backup-Recovery': Database,
  '12-Developer-Tools': TerminalSquare,
  '13-Privacy': ShieldCheck,
  '14-Driver-Management': PackageCheck,
  '15-System-Monitoring': Activity,
  '18-Project-Sonar': Radio,
};

function Visual({ family, lang, snapshot }: { family: FamilyDefinition; lang: 'en' | 'ar'; snapshot?: SystemSnapshot | null }) {
  switch (family.id) {
    case 'vitality': return <VitalityHoloVisual lang={lang} systemSnapshot={snapshot} />;
    case 'recovery': return <RecoveryHoloVisual lang={lang} />;
    case 'assurance': return <AssuranceHoloVisual lang={lang} systemSnapshot={snapshot} />;
    case 'workbench': return <WorkbenchHoloVisual lang={lang} />;
    case 'investigation': return <InvestigationHoloVisual lang={lang} systemSnapshot={snapshot} />;
    default: return null;
  }
}

function truthItems(family: FamilyDefinition, snapshot: SystemSnapshot | null | undefined, lang: 'en' | 'ar'): ReactNode {
  const ar = lang === 'ar';
  const unknown = ar ? 'غير متاح' : 'UNAVAILABLE';
  if (!snapshot) {
    return <div className="family-overview-truth__empty"><CircleDot size={16} />{ar ? 'لم تصل لقطة نظام فعلية بعد.' : 'No live system snapshot has been received yet.'}</div>;
  }

  if (family.id === 'vitality') {
    const usedRam = snapshot.TotalRamGB > 0 ? Math.round(((snapshot.TotalRamGB - snapshot.FreeRamGB) / snapshot.TotalRamGB) * 100) : null;
    return <>
      <div><span>CPU</span><b>{Number.isFinite(snapshot.CpuLoad) ? `${snapshot.CpuLoad}%` : unknown}</b></div>
      <div><span>{ar ? 'الذاكرة' : 'MEMORY'}</span><b>{usedRam === null ? unknown : `${usedRam}%`}</b></div>
      <div><span>{ar ? 'العمليات' : 'PROCESSES'}</span><b>{snapshot.Processes ?? unknown}</b></div>
    </>;
  }
  if (family.id === 'recovery') {
    return <>
      <div><span>{ar ? 'الأقراص' : 'VOLUMES'}</span><b>{snapshot.Drives?.length ?? unknown}</b></div>
      <div><span>{ar ? 'قرص النظام' : 'SYSTEM DRIVE'}</span><b>{snapshot.SystemDrive || unknown}</b></div>
      <div><span>{ar ? 'الجهاز' : 'MACHINE'}</span><b>{snapshot.Machine || unknown}</b></div>
    </>;
  }
  if (family.id === 'assurance') {
    const firewallObserved = Array.isArray(snapshot.Firewall) && snapshot.Firewall.length > 0;
    const firewallEnabled = firewallObserved ? snapshot.Firewall!.every(profile => profile.Enabled) : null;
    const defenderRunning = snapshot.DefenderRunning === true
      ? (ar ? 'يعمل' : 'RUNNING')
      : snapshot.DefenderRunning === false
        ? (ar ? 'لا يعمل' : 'NOT RUNNING')
        : unknown;
    const defenderRealtime = snapshot.DefenderRealtime === true
      ? (ar ? 'مفعلة' : 'ENABLED')
      : snapshot.DefenderRealtime === false
        ? (ar ? 'معطلة' : 'DISABLED')
        : unknown;
    return <>
      <div><span>DEFENDER</span><b>{defenderRunning}</b></div>
      <div><span>{ar ? 'الحماية الفورية' : 'REALTIME'}</span><b>{defenderRealtime}</b></div>
      <div><span>FIREWALL</span><b>{firewallEnabled === null ? unknown : firewallEnabled ? (ar ? 'مفعّل' : 'ENABLED') : (ar ? 'يحتاج مراجعة' : 'REVIEW')}</b></div>
    </>;
  }
  if (family.id === 'investigation') {
    return <>
      <div><span>{ar ? 'النظام' : 'OS'}</span><b>{snapshot.Os || unknown}</b></div>
      <div><span>{ar ? 'البنية' : 'BUILD'}</span><b>{snapshot.Build || unknown}</b></div>
      <div><span>{ar ? 'العمليات' : 'PROCESSES'}</span><b>{snapshot.Processes ?? unknown}</b></div>
    </>;
  }
  return <>
    <div><span>{ar ? 'النظام' : 'OS'}</span><b>{snapshot.Os || unknown}</b></div>
    <div><span>{ar ? 'الجهاز' : 'MACHINE'}</span><b>{snapshot.Machine || unknown}</b></div>
    <div><span>{ar ? 'البنية' : 'BUILD'}</span><b>{snapshot.Build || unknown}</b></div>
  </>;
}

export default function FamilyOverviewPage({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  systemSnapshot,
  onSelectService,
}: FamilyOverviewPageProps) {
  const ar = lang === 'ar';
  const copy = COPY[family.id];
  if (!copy) return null;
  const loadedFamilyTools = tools.filter(tool => family.services.some(service => service.id === tool.Category));
  const firstService = family.services[0];

  return (
    <section className="family-overview" data-family={family.id} dir={ar ? 'rtl' : 'ltr'}>
      <div className="family-overview__grid" aria-hidden="true" />
      <header className="family-overview-hero">
        <div className="family-overview-copy">
          <p className="family-overview-eyebrow">{ar ? copy.eyebrow.ar : copy.eyebrow.en}</p>
          <h1>{ar ? copy.headline.ar : copy.headline.en}</h1>
          <p className="family-overview-lead">{ar ? copy.body.ar : copy.body.en}</p>
          <div className="family-overview-runtime" data-state={bridgeOnline === true ? 'online' : bridgeOnline === false ? 'offline' : 'checking'}>
            <CircleDot size={13} />
            <span>{bridgeOnline === true ? (ar ? 'الجسر متصل' : 'LOCAL BRIDGE CONNECTED') : bridgeOnline === false ? (ar ? 'الجسر غير متصل' : 'LOCAL BRIDGE OFFLINE') : (ar ? 'جارٍ فحص الجسر' : 'CHECKING LOCAL BRIDGE')}</span>
            <b>{bridgeOnline === true ? `${loadedFamilyTools.length} ${ar ? 'إجراء' : 'ACTIONS'}` : '—'}</b>
          </div>
          <button type="button" className="family-overview-primary" onClick={() => onSelectService(firstService.id)}>
            <span>{ar ? copy.action.ar : copy.action.en}</span><ArrowRight size={18} />
          </button>
        </div>
        <div className="family-overview-visual"><Visual family={family} lang={lang} snapshot={systemSnapshot} /></div>
      </header>

      <div className="family-overview-body">
        <section className="family-overview-services" aria-label={ar ? 'خدمات العائلة' : 'Family services'}>
          <header><span>{ar ? 'مسارات العمل' : 'WORKSPACES'}</span><strong>{family.services.length} {ar ? 'خدمة' : 'services'}</strong></header>
          <div className="family-overview-service-grid">
            {family.services.map((service, index) => {
              const Icon = SERVICE_ICONS[service.id] ?? Activity;
              const count = bridgeOnline === true ? tools.filter(tool => tool.Category === service.id).length : null;
              return (
                <button key={service.id} type="button" className="family-overview-service" data-index={index} onClick={() => onSelectService(service.id)}>
                  <span className="family-overview-service__icon"><Icon size={21} /></span>
                  <span className="family-overview-service__copy"><strong>{ar ? service.name.ar : service.name.en}</strong><small>{ar ? service.purpose.ar : service.purpose.en}</small></span>
                  <span className="family-overview-service__count"><b>{count ?? '—'}</b><small>{count === null ? (ar ? 'غير متصل' : 'offline') : (ar ? 'إجراءات' : 'actions')}</small></span>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="family-overview-truth">
          <header><span>{ar ? 'السياق المباشر' : 'LIVE CONTEXT'}</span><b>{bridgeElevated ? (ar ? 'صلاحيات مرتفعة' : 'ELEVATED') : (ar ? 'صلاحيات قياسية' : 'STANDARD')}</b></header>
          <div className="family-overview-truth__items">{truthItems(family, systemSnapshot, lang)}</div>
          <p>{ar ? 'القيم هنا من لقطة النظام الحالية فقط. لا يتم ملء الفراغات ببيانات تجريبية.' : 'Values here come only from the current system snapshot. Empty evidence is never replaced with demo telemetry.'}</p>
        </aside>
      </div>
    </section>
  );
}
