import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clipboard, Code2, FileDown, FileOutput, FileText, FolderOpen, LoaderCircle, Radio, Radar, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { api, type BridgeTool, type ProjectSonarAiAnalysis, type ProjectSonarAiStatus, type ProjectSonarPreview, type SonarSeverity, type ToolRunOptions } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { pickName } from '../lib/i18n';
import WorkspaceFolderPicker from './WorkspaceFolderPicker';

interface ProjectSonarPanelProps {
  lang: Lang;
  tools: BridgeTool[];
  onRequestExecution: (tool: BridgeTool, options: ToolRunOptions) => void;
}

const COPY = {
  en: {
    kicker: 'PROJECT SONAR · LOCAL EVIDENCE ENGINE',
    title: 'Project Sonar',
    body: 'Choose a project, inspect the real workspace metadata, preview prioritized findings, then run only the report you need. Source-file contents and local secrets are excluded from the handoff prompt.',
    choose: 'Choose project folder',
    change: 'Change folder',
    inspect: 'Preview project',
    waiting: 'Choose a project folder to begin.',
    working: 'Building a local evidence preview…',
    tools: 'Sonar service',
    run: 'Open selected service',
    overview: 'Workspace signal',
    files: 'files observed',
    languages: 'languages',
    gitReady: 'Git work tree',
    gitNo: 'not detected',
    findings: 'Prioritized findings',
    noFindings: 'No rule-based completeness gaps were found in the scanned evidence.',
    evidence: 'Evidence',
    recommended: 'Recommended next step',
    plan: 'Previewed service plan',
    noChanges: 'read-only · no project change',
    prompts: 'Model-neutral engineering prompts',
    arabic: 'Arabic prompt',
    english: 'English prompt',
    copy: 'Copy prompt',
    copied: 'Copied',
    reports: 'Evidence reports',
    live: 'Live project preview',
    liveIdle: 'Awaiting a selected workspace',
    liveScanning: 'Reading bounded local evidence',
    liveReady: 'Evidence preview is current',
    coverage: 'Evidence coverage',
    activities: 'Live activity',
    export: 'Export report',
    exportPdf: 'PDF',
    exportMarkdown: 'Markdown',
    exporting: 'Exporting…',
    exportReady: 'Saved locally and ready to download',
    ai: 'Optional AI relay',
    aiBody: 'The local Sonar preview remains available without AI. When enabled, only a sanitized evidence summary is sent to the configured model — never source-file contents, workspace paths, or local secrets.',
    aiRun: 'Generate AI engineering brief',
    aiWorking: 'Generating a sanitized engineering brief…',
    aiReady: 'AI relay connected',
    aiUnavailable: 'AI relay is not configured locally.',
    aiResult: 'AI engineering brief',
    aiPrivacy: 'Sanitized: no source contents · no workspace path · no local secrets',
    serviceHint: 'Opening a service always shows the mandatory confirmation screen. The selected project path is prefilled and can be changed there.',
  },
  ar: {
    kicker: 'PROJECT SONAR · محرك أدلة محلي',
    title: 'سونار المشاريع',
    body: 'اختر مشروعًا، ثم افحص بيانات مساحة العمل الفعلية، وعاين النتائج المرتبة بالأولوية، ثم شغّل التقرير الذي تحتاجه فقط. لا تُدرج محتويات ملفات المصدر أو الأسرار المحلية في Prompt التسليم.',
    choose: 'اختيار مجلد المشروع',
    change: 'تغيير المجلد',
    inspect: 'معاينة المشروع',
    waiting: 'اختر مجلد مشروع للبدء.',
    working: 'يجري بناء معاينة أدلة محلية…',
    tools: 'خدمة السونار',
    run: 'فتح الخدمة المختارة',
    overview: 'إشارة مساحة العمل',
    files: 'ملف مرصود',
    languages: 'لغات',
    gitReady: 'مساحة عمل Git',
    gitNo: 'غير مكتشفة',
    findings: 'النتائج المرتبة',
    noFindings: 'لم تُكتشف فجوات اكتمال مبنية على القواعد في الأدلة المفحوصة.',
    evidence: 'الدليل',
    recommended: 'الخطوة المقترحة التالية',
    plan: 'خطة الخدمات في المعاينة',
    noChanges: 'قراءة فقط · بلا تغيير للمشروع',
    prompts: 'Prompts هندسية محايدة للنموذج',
    arabic: 'Prompt عربي',
    english: 'Prompt إنجليزي',
    copy: 'نسخ Prompt',
    copied: 'تم النسخ',
    reports: 'تقارير الأدلة',
    live: 'المعاينة الحية للمشروع',
    liveIdle: 'بانتظار اختيار مساحة عمل',
    liveScanning: 'تجري قراءة أدلة محلية محددة',
    liveReady: 'معاينة الأدلة محدّثة',
    coverage: 'تغطية الأدلة',
    activities: 'النشاط الحي',
    export: 'تصدير التقرير',
    exportPdf: 'PDF',
    exportMarkdown: 'Markdown',
    exporting: 'يجري التصدير…',
    exportReady: 'حُفظ محليًا وجاهز للتنزيل',
    ai: 'ربط ذكاء اصطناعي اختياري',
    aiBody: 'تبقى معاينة Sonar المحلية متاحة بلا ذكاء اصطناعي. عند التفعيل، يُرسل فقط ملخص الأدلة المنقح إلى النموذج المحدد؛ ولا تُرسل محتويات ملفات المصدر أو مسار مساحة العمل أو الأسرار المحلية.',
    aiRun: 'إنشاء موجز هندسي ذكي',
    aiWorking: 'يجري إنشاء موجز هندسي منقح…',
    aiReady: 'ربط الذكاء الاصطناعي متصل',
    aiUnavailable: 'ربط الذكاء الاصطناعي غير مُعد محليًا.',
    aiResult: 'الموجز الهندسي الذكي',
    aiPrivacy: 'منقح: لا محتويات مصدر · لا مسار مساحة عمل · لا أسرار محلية',
    serviceHint: 'فتح أي خدمة يعرض نافذة التأكيد الإلزامية دائمًا. يُملأ مسار المشروع المختار مسبقًا ويمكن تغييره هناك.',
  },
};

const SEVERITY_RANK: Record<SonarSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_LABEL: Record<SonarSeverity, Record<Lang, string>> = {
  CRITICAL: { en: 'CRITICAL', ar: 'حرج' },
  HIGH: { en: 'HIGH', ar: 'مرتفع' },
  MEDIUM: { en: 'MEDIUM', ar: 'متوسط' },
  LOW: { en: 'LOW', ar: 'منخفض' },
};

export default function ProjectSonarPanel({ lang, tools, onRequestExecution }: ProjectSonarPanelProps) {
  const text = COPY[lang];
  const [workspace, setWorkspace] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState('SN05');
  const [preview, setPreview] = useState<ProjectSonarPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [promptLanguage, setPromptLanguage] = useState<Lang>('ar');
  const [copied, setCopied] = useState(false);
  const [aiStatus, setAiStatus] = useState<ProjectSonarAiStatus>({ configured: false, model: null });
  const [aiAnalysis, setAiAnalysis] = useState<ProjectSonarAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'markdown' | null>(null);
  const [exportError, setExportError] = useState('');
  const [lastExport, setLastExport] = useState<{ name: string; path: string } | null>(null);

  const sonarTools = useMemo(() => tools.filter((tool) => /^SN\d+$/.test(tool.ToolId)).sort((a, b) => a.ToolId.localeCompare(b.ToolId)), [tools]);
  const selectedTool = sonarTools.find((tool) => tool.ToolId === selectedToolId) || sonarTools[0];
  const findings = useMemo(() => [...(preview?.Findings || [])].sort((a, b) => SEVERITY_RANK[a.Severity] - SEVERITY_RANK[b.Severity]), [preview]);
  const currentPrompt = promptLanguage === 'ar' ? preview?.PromptArabic || '' : preview?.PromptEnglish || '';

  useEffect(() => {
    api.sonarAiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, model: null }));
  }, []);

  const inspect = async () => {
    if (!workspace || loading) return;
    setLoading(true);
    setError('');
    try {
      const { preview: data } = await api.sonarPreview(workspace);
      setPreview(data);
      setAiAnalysis(null);
      setAiError('');
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!workspace || !aiStatus.configured || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      setAiAnalysis(await api.sonarAnalysis(workspace, lang));
    } catch (e) {
      setAiAnalysis(null);
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'markdown') => {
    if (!workspace || exporting) return;
    setExporting(format);
    setExportError('');
    try {
      const { export: result } = await api.sonarExport(workspace, format, lang);
      setLastExport({ name: result.name, path: result.path });
      const download = document.createElement('a');
      download.href = `http://127.0.0.1:8787${result.downloadUrl}`;
      download.download = result.name;
      document.body.appendChild(download);
      download.click();
      download.remove();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  const copyPrompt = async () => {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };

  return (
    <section className="project-sonar" aria-label={text.title}>
      <header className="project-sonar-hero">
        <div className="project-sonar-radar"><Radar size={26} /></div>
        <div className="project-sonar-heading"><p className="eyebrow">{text.kicker}</p><h2>{text.title}</h2><p>{text.body}</p></div>
        <div className="project-sonar-safe"><ShieldCheck size={15} /><span>{lang === 'ar' ? 'محلي · قراءة فقط' : 'LOCAL · READ ONLY'}</span></div>
      </header>

      <section className="project-sonar-live-deck" aria-label={text.live}>
        <div className="project-sonar-live-head"><div><Radio size={15} className={loading ? 'is-pulsing' : ''} /><span>{text.live}</span><small className={preview ? 'is-ready' : ''}>{loading ? text.liveScanning : preview ? text.liveReady : text.liveIdle}</small></div><div className="project-sonar-live-export"><span>{text.export}</span><button type="button" onClick={() => exportReport('markdown')} disabled={!workspace || Boolean(exporting)}><FileText size={14} />{exporting === 'markdown' ? text.exporting : text.exportMarkdown}</button><button type="button" onClick={() => exportReport('pdf')} disabled={!workspace || Boolean(exporting)}><FileDown size={14} />{exporting === 'pdf' ? text.exporting : text.exportPdf}</button></div></div>
        <div className="project-sonar-live-grid">
          <div className="project-sonar-live-radar"><div className={loading ? 'is-scanning' : ''}><Radar size={33} /></div><span>{preview ? `${findings.length} ${lang === 'ar' ? 'نتيجة' : 'findings'}` : '—'}</span><small>{preview ? preview.Workspace : (workspace || text.liveIdle)}</small></div>
          <div className="project-sonar-live-activity"><p>{text.activities}</p><span className={workspace ? 'is-complete' : ''}><i />{workspace ? `${lang === 'ar' ? 'مساحة العمل' : 'Workspace'}: ${workspace}` : text.liveIdle}</span><span className={preview ? 'is-complete' : loading ? 'is-active' : ''}><i />{preview ? `${preview.Snapshot.FileCount.toLocaleString()} ${text.files} · ${preview.Snapshot.Languages.length} ${text.languages}` : loading ? text.liveScanning : (lang === 'ar' ? 'المعاينة لم تبدأ' : 'Preview has not started')}</span><span className={preview ? 'is-complete' : ''}><i />{preview ? `${preview.SeverityCounts.Critical} ${lang === 'ar' ? 'حرج' : 'critical'} · ${preview.SeverityCounts.High} ${lang === 'ar' ? 'مرتفع' : 'high'}` : (lang === 'ar' ? 'الأولويات تظهر بعد المعاينة' : 'Priorities appear after preview')}</span></div>
          <div className="project-sonar-live-coverage"><p>{text.coverage}</p><div><b>{preview ? Math.min(100, Math.round((preview.Snapshot.FileCount > 0 ? 58 : 0) + (preview.Snapshot.Languages.length ? 20 : 0) + (preview.Snapshot.Git.Repository ? 12 : 0) + (preview.Snapshot.PackageName ? 10 : 0))) : 0}%</b><span>{preview ? (lang === 'ar' ? 'مؤشرات محلية مكتشفة' : 'local markers observed') : (lang === 'ar' ? 'لا توجد أدلة بعد' : 'no evidence yet')}</span></div><div className="project-sonar-live-bars"><i className={preview?.Snapshot.FileCount ? 'is-full' : ''} /><i className={preview?.Snapshot.Languages.length ? 'is-full' : ''} /><i className={preview?.Snapshot.Git.Repository ? 'is-full' : ''} /><i className={preview?.Snapshot.PackageName ? 'is-full' : ''} /></div></div>
        </div>
        {(lastExport || exportError) && <div className="project-sonar-export-status">{lastExport && <span><CheckCircle2 size={14} />{text.exportReady}: <code>{lastExport.name}</code><small>{lastExport.path}</small></span>}{exportError && <span className="is-error"><AlertTriangle size={14} />{exportError}</span>}</div>}
      </section>

      <div className="project-sonar-controlbar">
        <div className="project-sonar-workspace">
          <FolderOpen size={17} />
          <div><span>{lang === 'ar' ? 'مساحة العمل المختارة' : 'Selected workspace'}</span><strong>{workspace || (lang === 'ar' ? 'لم يُحدد بعد' : 'Not selected yet')}</strong></div>
          <button type="button" onClick={() => setPickerOpen(true)}>{workspace ? text.change : text.choose}</button>
        </div>
        <label className="project-sonar-service"><span>{text.tools}</span><select value={selectedToolId} onChange={(event) => setSelectedToolId(event.target.value)}>{sonarTools.map((tool) => <option key={tool.ToolId} value={tool.ToolId}>{tool.ToolId} · {pickName(tool, lang)}</option>)}</select></label>
        <button type="button" className="project-sonar-preview-btn" disabled={!workspace || loading} onClick={inspect}>{loading ? <LoaderCircle size={16} className="is-spinning" /> : <ScanSearch size={16} />}{text.inspect}</button>
        <button type="button" className="project-sonar-run-btn" disabled={!workspace || !selectedTool} onClick={() => selectedTool && onRequestExecution(selectedTool, { localSourcePath: workspace })}><FileOutput size={16} />{text.run}</button>
      </div>
      <p className="project-sonar-hint"><AlertTriangle size={14} />{text.serviceHint}</p>

      <AnimatePresence mode="wait">
        {!preview && !loading && !error && <motion.div key="waiting" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="project-sonar-empty"><Radar size={28} /><p>{text.waiting}</p></motion.div>}
        {loading && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="project-sonar-empty"><LoaderCircle size={25} className="is-spinning" /><p>{text.working}</p></motion.div>}
        {error && <motion.div key="error" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="project-sonar-error"><AlertTriangle size={20} /><p>{error}</p></motion.div>}
        {preview && !loading && <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="project-sonar-results">
          <section className="project-sonar-overview">
            <div className="project-sonar-section-title"><Code2 size={16} /><span>{text.overview}</span><small>{preview.Workspace}</small></div>
            <div className="project-sonar-metrics">
              <span><b>{preview.Snapshot.FileCount.toLocaleString()}</b>{text.files}</span>
              <span><b>{preview.Snapshot.Languages.length}</b>{text.languages}</span>
              <span><b>{preview.Snapshot.Git.Repository ? <CheckCircle2 size={15} /> : '—'}</b>{preview.Snapshot.Git.Repository ? text.gitReady : text.gitNo}</span>
              <span><b>{preview.Snapshot.PackageName || '—'}</b>{lang === 'ar' ? 'حزمة' : 'package'}</span>
            </div>
            <div className="project-sonar-language-row">{preview.Snapshot.Languages.length ? preview.Snapshot.Languages.map((item) => <span key={item}>{item}</span>) : <span>—</span>}</div>
          </section>

          <section className="project-sonar-findings">
            <div className="project-sonar-section-title"><AlertTriangle size={16} /><span>{text.findings}</span><div className="project-sonar-counts"><i className="critical">{preview.SeverityCounts.Critical}</i><i className="high">{preview.SeverityCounts.High}</i><i className="medium">{preview.SeverityCounts.Medium}</i><i className="low">{preview.SeverityCounts.Low}</i></div></div>
            {findings.length === 0 ? <div className="project-sonar-no-findings"><CheckCircle2 size={18} />{text.noFindings}</div> : <div className="project-sonar-finding-list">{findings.map((finding) => <article className={`project-sonar-finding severity-${finding.Severity.toLowerCase()}`} key={finding.Code}><div><span>{SEVERITY_LABEL[finding.Severity][lang]}</span><code>{finding.Code}</code></div><h3>{lang === 'ar' ? finding.TitleAr : finding.TitleEn}</h3><p><b>{text.evidence}:</b> {finding.Evidence}</p><p><b>{text.recommended}:</b> {lang === 'ar' ? finding.FixAr : finding.FixEn}</p></article>)}</div>}
          </section>

          <section className="project-sonar-plan">
            <div className="project-sonar-section-title"><Sparkles size={16} /><span>{text.plan}</span></div>
            <div className="project-sonar-plan-grid">{preview.ServicePlan.map((item) => { const tool = sonarTools.find((candidate) => candidate.ToolId === item.ToolId); return <div key={item.ToolId}><code>{item.ToolId}</code><strong>{tool ? pickName(tool, lang) : item.Action}</strong><small>{lang === 'ar' ? 'قراءة فقط · لا تغيير للمشروع' : text.noChanges}</small></div>; })}</div>
          </section>

          <section className="project-sonar-prompts">
            <div className="project-sonar-section-title"><Clipboard size={16} /><span>{text.prompts}</span><div className="project-sonar-tabs"><button type="button" className={promptLanguage === 'ar' ? 'is-active' : ''} onClick={() => setPromptLanguage('ar')}>{text.arabic}</button><button type="button" className={promptLanguage === 'en' ? 'is-active' : ''} onClick={() => setPromptLanguage('en')}>{text.english}</button></div></div>
            <pre>{currentPrompt}</pre>
            <div className="project-sonar-prompt-footer"><span><FileOutput size={14} />{text.reports}: <code>{preview.ReportsFolder}</code></span><button type="button" onClick={copyPrompt}><Clipboard size={14} />{copied ? text.copied : text.copy}</button></div>
          </section>

          <aside className="project-sonar-ai"><Sparkles size={18} /><div className="project-sonar-ai-body"><div className="project-sonar-ai-head"><strong>{text.ai}</strong><span className={aiStatus.configured ? 'is-ready' : 'is-offline'}>{aiStatus.configured ? text.aiReady : text.aiUnavailable}</span></div><p>{text.aiBody}</p>{aiStatus.configured && <div className="project-sonar-ai-controls"><code>{aiStatus.model}</code><button type="button" onClick={runAiAnalysis} disabled={aiLoading}>{aiLoading ? <LoaderCircle size={14} className="is-spinning" /> : <Sparkles size={14} />}{aiLoading ? text.aiWorking : text.aiRun}</button></div>}{aiError && <p className="project-sonar-ai-error">{aiError}</p>}{aiAnalysis && <div className="project-sonar-ai-result"><div><span>{text.aiResult}</span><code>{aiAnalysis.model}</code></div><pre>{aiAnalysis.analysis}</pre><small><ShieldCheck size={13} />{text.aiPrivacy}</small></div>}</div></aside>
        </motion.div>}
      </AnimatePresence>

      {pickerOpen && <WorkspaceFolderPicker lang={lang} initialPath={workspace} onClose={() => setPickerOpen(false)} onSelect={(path) => { setWorkspace(path); setPickerOpen(false); setPreview(null); setError(''); }} />}
    </section>
  );
}
