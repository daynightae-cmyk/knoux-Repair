import { useCallback, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2,
  Clock, Code2, Database, Loader2, Package, Play, Search, Shield,
  ShieldCheck, Sparkles, Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { FAMILIES } from '../../data/family-map';
import type { FamilyId, NavDestination, ServiceId } from '../../data/family-map';
import { api } from '../../lib/api';

export interface AIScanPageProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  toolCount: number | null;
  onNavigate: (dest: NavDestination) => void;
}

interface ScanFinding {
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

type AiWorkflowId = 'scan' | 'analyze' | 'understand' | 'repair';

const AI_WORKFLOW: Array<{
  id: AiWorkflowId;
  icon: React.ElementType;
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
}> = [
  { id: 'scan', icon: Search, titleEn: 'Scan', titleAr: 'فحص', detailEn: 'Collect registered system evidence.', detailAr: 'جمع أدلة النظام المسجلة.' },
  { id: 'analyze', icon: Activity, titleEn: 'Analyze', titleAr: 'تحليل', detailEn: 'Evaluate evidence without invented scores.', detailAr: 'تحليل الأدلة دون نتائج مختلقة.' },
  { id: 'understand', icon: BrainCircuit, titleEn: 'Understand', titleAr: 'فهم', detailEn: 'Explain findings and their impact.', detailAr: 'شرح النتائج وتأثيرها.' },
  { id: 'repair', icon: Wrench, titleEn: 'Repair Together', titleAr: 'الإصلاح معاً', detailEn: 'Open the registered tool for confirmed action.', detailAr: 'فتح الأداة المسجلة لتنفيذ الإجراء المؤكد.' },
];

const FAMILY_ICONS: Record<string, React.ElementType> = {
  vitality: Activity,
  recovery: Database,
  assurance: Shield,
  software: Package,
  workbench: Code2,
  investigation: Search,
};

export default function AIScanPage({ lang, bridgeOnline, toolCount, onNavigate }: AIScanPageProps) {
  const isRtl = lang === 'ar';
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [findings, setFindings] = useState<ScanFinding[] | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<AiWorkflowId>('scan');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [evidenceSourceCount, setEvidenceSourceCount] = useState(0);
  const [scanError, setScanError] = useState('');

  const runDiagnosticScan = useCallback(async () => {
    if (!bridgeOnline) return;
    setScanning(true);
    setScanError('');
    setEvidenceSourceCount(0);
    setSelectedFindingId(null);
    setSelectedWorkflow('scan');
    setScanStage(isRtl ? 'فحص مقاييس الحيوية والأداء...' : 'Inspecting system vitals & memory pressure...');

    const discoveredFindings: ScanFinding[] = [];
    let verifiedSources = 0;

    try {
      const sysRes = await api.system().catch(() => null);
      setScanStage(isRtl ? 'فحص سعة الأقراص والنظافة العامة...' : 'Evaluating disk capacity & hygiene...');

      if (sysRes?.system) {
        verifiedSources += 1;
        setSelectedWorkflow('analyze');
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
              actionLabelEn: 'Optimize Performance (PF01)',
              actionLabelAr: 'تحسين الأداء (PF01)',
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
              actionLabelEn: 'Audit Disk Space (DS01)',
              actionLabelAr: 'فحص مساحة القرص (DS01)',
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
            actionLabelEn: 'Check Security Posture (SE04)',
            actionLabelAr: 'فحص إعدادات الأمان (SE04)',
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
            actionLabelEn: 'Clean System Junk (SC01)',
            actionLabelAr: 'تنظيف المخلفات (SC01)',
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
            actionLabelEn: 'Audit Device Problems (DM02)',
            actionLabelAr: 'تشخيص أخطاء الأجهزة (DM02)',
          });
        }
      }

      setEvidenceSourceCount(verifiedSources);
      setFindings(discoveredFindings);
      setSelectedFindingId(discoveredFindings[0]?.id ?? null);
      setScanTimestamp(new Date().toLocaleTimeString());
      setScanStage(isRtl ? 'اكتمل الفحص' : 'Diagnostic scan complete');
      setSelectedWorkflow(discoveredFindings.length > 0 ? 'repair' : 'understand');
    } catch {
      setFindings([]);
      setSelectedFindingId(null);
      setEvidenceSourceCount(0);
      setScanError(isRtl ? 'تعذر جمع أدلة تشخيص موثوقة من الجسر.' : 'No verified diagnostic evidence was returned by the bridge.');
      setSelectedWorkflow('scan');
    } finally {
      setScanning(false);
    }
  }, [bridgeOnline, isRtl]);

  const selectedWorkflowContent = AI_WORKFLOW.find(step => step.id === selectedWorkflow) ?? AI_WORKFLOW[0];
  const selectedFinding = findings?.find(finding => finding.id === selectedFindingId) ?? null;
  const previewState = scanning
    ? (selectedWorkflow === 'analyze' ? (isRtl ? 'جارٍ التحليل' : 'Analyzing') : (isRtl ? 'جارٍ الفحص' : 'Scanning'))
    : findings !== null && evidenceSourceCount > 0
      ? (isRtl ? 'النتائج جاهزة' : 'Results ready')
      : bridgeOnline === true
        ? (isRtl ? 'جاهز' : 'Ready')
        : (isRtl ? 'غير متصل' : 'Not connected');

  const findingCounts = useMemo(() => ({
    critical: findings?.filter(finding => finding.severity === 'critical').length ?? 0,
    warning: findings?.filter(finding => finding.severity === 'warning').length ?? 0,
  }), [findings]);

  return (
    <div className="knoux-ai-command-center" dir={isRtl ? 'rtl' : 'ltr'}>
      <aside className="knoux-ai-rail knoux-ai-workflow-rail" aria-label={isRtl ? 'مراحل الفحص الذكي' : 'AI workflow'}>
        <header className="knoux-ai-rail-head">
          <span>KNOUX AI</span>
          <strong>{isRtl ? 'مسار التشخيص' : 'DIAGNOSTIC FLOW'}</strong>
        </header>
        <div className="knoux-ai-rail-scroll">
          {AI_WORKFLOW.map((step, index) => {
            const Icon = step.icon;
            const active = selectedWorkflow === step.id;
            return (
              <button
                key={step.id}
                type="button"
                className="knoux-ai-flow-card"
                data-active={active}
                aria-pressed={active}
                onClick={() => setSelectedWorkflow(step.id)}
              >
                <span className="knoux-ai-flow-index">0{index + 1}</span>
                <span className="knoux-ai-flow-icon"><Icon size={17} /></span>
                <span className="knoux-ai-flow-copy">
                  <strong>{isRtl ? step.titleAr : step.titleEn}</strong>
                  <small>{isRtl ? step.detailAr : step.detailEn}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="knoux-ai-family-coverage">
          <span>{isRtl ? 'تغطية العائلات' : 'FAMILY COVERAGE'}</span>
          {FAMILIES.filter(family => !['ai-scan', 'navigator'].includes(family.id)).map(family => {
            const Icon = FAMILY_ICONS[family.id] ?? Search;
            return (
              <button key={family.id} type="button" onClick={() => onNavigate({ family: family.id })} title={isRtl ? family.name.ar : family.name.en}>
                <Icon size={13} />
                <span>{isRtl ? family.name.ar : family.name.en}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="knoux-ai-live-column">
        <section className="knoux-ai-live-stage" data-state={scanning ? 'running' : 'idle'}>
          <div className="knoux-ai-grid" aria-hidden="true" />
          <header className="knoux-ai-live-head">
            <div>
              <span><Sparkles size={12} /> {isRtl ? 'مركز تشخيص KNOUX' : 'KNOUX DIAGNOSTIC CORE'}</span>
              <strong>AI Scan</strong>
            </div>
            <div className="knoux-ai-runtime-state" data-online={bridgeOnline === true}>
              <span aria-hidden="true" />
              {bridgeOnline === true ? (isRtl ? 'الجسر متصل' : 'Bridge connected') : bridgeOnline === false ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline') : (isRtl ? 'جارٍ التحقق' : 'Checking bridge')}
            </div>
          </header>

          <div className="knoux-ai-live-body">
            <div className="knoux-ai-core-copy">
              <span className="knoux-ai-context-label">{isRtl ? selectedWorkflowContent.titleAr : selectedWorkflowContent.titleEn}</span>
              <h1>{isRtl ? 'افحص. افهم. أصلح بثقة.' : 'Scan. Understand. Repair with evidence.'}</h1>
              <p>{isRtl ? selectedWorkflowContent.detailAr : selectedWorkflowContent.detailEn}</p>

              <div className="knoux-ai-query-box">
                <Search size={15} />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder={isRtl ? 'صف المشكلة أو اكتب سياقاً للبحث...' : 'Describe the issue or add search context...'}
                  aria-label={isRtl ? 'سياق الفحص' : 'Scan context'}
                />
              </div>

              <div className="knoux-ai-primary-actions">
                <button type="button" onClick={runDiagnosticScan} disabled={scanning || bridgeOnline !== true}>
                  {scanning ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} />}
                  {scanning ? (isRtl ? 'جارٍ جمع الأدلة...' : 'Collecting evidence...') : findings ? (isRtl ? 'إعادة الفحص' : 'Rerun AI Scan') : (isRtl ? 'بدء الفحص الذكي' : 'Start AI Scan')}
                </button>
                {selectedFinding && (
                  <button type="button" className="is-secondary" onClick={() => onNavigate(selectedFinding.dest)}>
                    <Wrench size={14} />
                    {isRtl ? selectedFinding.actionLabelAr : selectedFinding.actionLabelEn}
                  </button>
                )}
              </div>
            </div>

            <div className="knoux-ai-core-visual" aria-live="polite">
              <div className="knoux-ai-orbit knoux-ai-orbit-a" />
              <div className="knoux-ai-orbit knoux-ai-orbit-b" />
              <div className="knoux-ai-core-ring">
                <span>K</span>
              </div>
              <div className="knoux-ai-core-state" data-state={scanning ? 'active' : bridgeOnline === true ? 'ready' : 'offline'}>
                <span aria-hidden="true" />
                <strong>{previewState}</strong>
                <small>{scanStage || (isRtl ? 'بانتظار بدء الفحص' : 'Awaiting diagnostic scan')}</small>
              </div>
            </div>
          </div>

          <footer className="knoux-ai-truth-strip">
            <div><span>{isRtl ? 'أدوات مسجلة' : 'REGISTERED TOOLS'}</span><strong>{toolCount ?? '—'}</strong></div>
            <div><span>{isRtl ? 'مصادر أدلة موثقة' : 'VERIFIED SOURCES'}</span><strong>{findings === null && !scanning ? '—' : evidenceSourceCount}</strong></div>
            <div><span>{isRtl ? 'نتائج مثبتة' : 'EVIDENCE FINDINGS'}</span><strong>{findings === null ? '—' : findings.length}</strong></div>
            <div><span>{isRtl ? 'وقت آخر فحص' : 'LAST SCAN'}</span><strong>{scanTimestamp ?? '—'}</strong></div>
          </footer>
        </section>

        <section id="ai-recommendation-workspace" className="knoux-ai-context-workspace">
          <header>
            <div>
              <span>{isRtl ? 'سياق التشخيص' : 'DIAGNOSTIC CONTEXT'}</span>
              <strong>{selectedFinding ? (isRtl ? selectedFinding.titleAr : selectedFinding.titleEn) : (isRtl ? 'بانتظار نتيجة موثقة' : 'Awaiting verified finding')}</strong>
            </div>
            {selectedFinding?.metric && <b>{selectedFinding.metric}</b>}
          </header>

          {scanning ? (
            <div className="knoux-ai-workspace-state">
              <Loader2 size={22} className="animate-spin" />
              <div><strong>{isRtl ? 'يتم جمع الأدلة من الجسر' : 'Collecting bridge evidence'}</strong><p>{scanStage}</p></div>
            </div>
          ) : findings === null ? (
            <div className="knoux-ai-workspace-state">
              <BrainCircuit size={22} />
              <div><strong>{isRtl ? 'لم يبدأ الفحص بعد' : 'Scan has not started'}</strong><p>{isRtl ? 'لن تظهر أرقام أو حالة صحة قبل رجوع بيانات فعلية.' : 'No scores or health claims are shown before real evidence is returned.'}</p></div>
            </div>
          ) : evidenceSourceCount === 0 ? (
            <div className="knoux-ai-workspace-state is-error">
              <AlertTriangle size={22} />
              <div><strong>{isRtl ? 'نتيجة الفحص غير متاحة' : 'Diagnostic result unavailable'}</strong><p>{scanError || (isRtl ? 'لم يرجع الجسر أي مصدر دليل يمكن التحقق منه.' : 'The bridge returned no verifiable evidence source.')}</p></div>
            </div>
          ) : findings.length === 0 ? (
            <div className="knoux-ai-workspace-state is-success">
              <CheckCircle2 size={22} />
              <div><strong>{isRtl ? 'لم تُرصد مشكلة ضمن الفحوصات المكتملة' : 'No issue detected in completed checks'}</strong><p>{isRtl ? `تم التحقق من ${evidenceSourceCount} مصادر. هذا لا يعني أن الجهاز خالٍ من كل المشكلات.` : `${evidenceSourceCount} evidence sources completed. This does not claim the entire device is issue-free.`}</p></div>
            </div>
          ) : selectedFinding ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={selectedFinding.id} className="knoux-ai-selected-finding" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                <div className="knoux-ai-finding-severity" data-severity={selectedFinding.severity}>{selectedFinding.severity}</div>
                <p>{isRtl ? selectedFinding.detailAr : selectedFinding.detailEn}</p>
                <div className="knoux-ai-destination-path">
                  <span>{selectedFinding.dest.family}</span>
                  {selectedFinding.dest.service && <><b>/</b><span>{selectedFinding.dest.service}</span></>}
                  {selectedFinding.dest.toolId && <><b>/</b><strong>{selectedFinding.dest.toolId}</strong></>}
                </div>
                <button type="button" onClick={() => onNavigate(selectedFinding.dest)}>
                  {isRtl ? selectedFinding.actionLabelAr : selectedFinding.actionLabelEn}
                  {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                </button>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </section>
      </main>

      <aside className="knoux-ai-rail knoux-ai-findings-rail" aria-label={isRtl ? 'النتائج والتوصيات' : 'Findings and recommendations'}>
        <header className="knoux-ai-rail-head">
          <span>{isRtl ? 'الأدلة' : 'EVIDENCE'}</span>
          <strong>{isRtl ? 'النتائج' : 'FINDINGS'}</strong>
          <small>{findings === null ? '—' : findings.length}</small>
        </header>

        <div className="knoux-ai-findings-summary">
          <div data-kind="critical"><span>{isRtl ? 'حرج' : 'Critical'}</span><strong>{findings === null ? '—' : findingCounts.critical}</strong></div>
          <div data-kind="warning"><span>{isRtl ? 'تحذير' : 'Warning'}</span><strong>{findings === null ? '—' : findingCounts.warning}</strong></div>
          <div><span>{isRtl ? 'مصادر' : 'Sources'}</span><strong>{findings === null ? '—' : evidenceSourceCount}</strong></div>
        </div>

        <div className="knoux-ai-rail-scroll">
          {findings === null ? (
            <div className="knoux-ai-findings-empty">
              <ShieldCheck size={22} />
              <strong>{isRtl ? 'لا توجد نتائج بعد' : 'No findings yet'}</strong>
              <p>{isRtl ? 'ابدأ الفحص لجمع أدلة فعلية.' : 'Start AI Scan to collect real diagnostic evidence.'}</p>
            </div>
          ) : evidenceSourceCount === 0 ? (
            <div className="knoux-ai-findings-empty is-error">
              <AlertTriangle size={22} />
              <strong>{isRtl ? 'لا توجد أدلة موثقة' : 'No verified evidence'}</strong>
              <p>{scanError || (isRtl ? 'الجسر لم يرجع بيانات يمكن الاعتماد عليها.' : 'The bridge returned no trustworthy diagnostic source.')}</p>
            </div>
          ) : findings.length === 0 ? (
            <div className="knoux-ai-findings-empty is-success">
              <CheckCircle2 size={22} />
              <strong>{isRtl ? 'الفحوصات المكتملة بلا نتيجة سلبية' : 'Completed checks found no issue'}</strong>
              <p>{isRtl ? 'الحكم محصور في مصادر الأدلة التي اكتملت فقط.' : 'This statement is limited to the evidence sources that completed.'}</p>
            </div>
          ) : (
            findings.map(finding => (
              <button
                key={finding.id}
                type="button"
                className="knoux-ai-finding-card"
                data-active={selectedFindingId === finding.id}
                data-severity={finding.severity}
                onClick={() => setSelectedFindingId(finding.id)}
              >
                <span className="knoux-ai-finding-dot" />
                <span className="knoux-ai-finding-copy">
                  <strong>{isRtl ? finding.titleAr : finding.titleEn}</strong>
                  <small>{isRtl ? finding.detailAr : finding.detailEn}</small>
                </span>
                {finding.metric && <b>{finding.metric}</b>}
              </button>
            ))
          )}
        </div>

        <div className="knoux-ai-rail-foot">
          <Clock size={12} />
          <span>{scanTimestamp ? (isRtl ? `آخر فحص ${scanTimestamp}` : `Last scan ${scanTimestamp}`) : (isRtl ? 'لم يتم الفحص بعد' : 'Not scanned yet')}</span>
        </div>
      </aside>
    </div>
  );
}
