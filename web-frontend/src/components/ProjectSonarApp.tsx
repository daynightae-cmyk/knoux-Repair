import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, CheckCircle2, ChevronRight, Download, FileCode2, FolderKanban, GitBranch, LoaderCircle, Radar, ShieldCheck, Sparkles, TriangleAlert, WandSparkles } from 'lucide-react';
import { api, BRIDGE_URL, type BridgeTool, type ProjectSonarAiAnalysis, type ProjectSonarPreview, type SonarSeverity, type ToolRunOptions } from '../lib/api';
import type { Lang } from '../lib/i18n';
import WorkspaceFolderPicker from './WorkspaceFolderPicker';

interface ProjectSonarAppProps {
  lang: Lang;
  tools: BridgeTool[];
  onPrepareRun: (tool: BridgeTool, mode: 'run' | 'analyze' | 'preview', options: ToolRunOptions) => void;
}

type SeverityFilter = 'ALL' | SonarSeverity;
const SEVERITIES: SonarSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function severityLabel(severity: SonarSeverity, lang: Lang) {
  const labels: Record<SonarSeverity, [string, string]> = { CRITICAL: ['حرج', 'Critical'], HIGH: ['مرتفع', 'High'], MEDIUM: ['متوسط', 'Medium'], LOW: ['منخفض', 'Low'] };
  return labels[severity][lang === 'ar' ? 0 : 1];
}

export default function ProjectSonarApp({ lang, tools, onPrepareRun }: ProjectSonarAppProps) {
  const [workspace, setWorkspace] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<ProjectSonarPreview | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'markdown' | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<ProjectSonarAiAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.sonarAiStatus().then((status) => setAiReady(status.configured)).catch(() => setAiReady(false)); }, []);
  const scan = useCallback(async () => {
    if (!workspace.trim()) { setError(lang === 'ar' ? 'اختر مجلد المشروع قبل تشغيل سونار.' : 'Choose a project folder before running Sonar.'); return; }
    setLoading(true); setError(''); setPreview(null); setAnalysis(null); setSelectedCode(null);
    try { const response = await api.sonarPreview(workspace); setPreview(response.preview); } catch { setError(lang === 'ar' ? 'تعذر فحص مساحة العمل. تأكد من تشغيل خدمة KNOUX ومن أن مجلد المشروع متاح.' : 'KNOUX could not scan this workspace. Check that the local service is running and the project folder is available.'); } finally { setLoading(false); }
  }, [lang, workspace]);
  const filteredFindings = useMemo(() => preview?.Findings.filter((finding) => filter === 'ALL' || finding.Severity === filter) || [], [filter, preview]);
  const selected = filteredFindings.find((finding) => finding.Code === selectedCode) || preview?.Findings.find((finding) => finding.Code === selectedCode) || filteredFindings[0] || null;
  const exportReport = async (format: 'pdf' | 'markdown') => {
    if (!workspace) return; setExporting(format); setError('');
    try { const { export: item } = await api.sonarExport(workspace, format, lang); window.open(`${BRIDGE_URL}${item.downloadUrl}`, '_blank', 'noopener,noreferrer'); } catch { setError(lang === 'ar' ? 'تعذر إنشاء التقرير المطلوب محلياً.' : 'KNOUX could not create the requested local report.'); } finally { setExporting(null); }
  };
  const runAnalysis = async () => {
    if (!workspace || !aiReady) return; setAnalysisLoading(true); setError('');
    try { setAnalysis(await api.sonarAnalysis(workspace, lang)); } catch { setError(lang === 'ar' ? 'تعذر إنشاء التحليل الاختياري للمشروع.' : 'The optional project analysis could not be generated.'); } finally { setAnalysisLoading(false); }
  };
  const openPlanAction = (toolId: string) => { const tool = tools.find((candidate) => candidate.ToolId === toolId); if (tool) onPrepareRun(tool, tool.AnalyzeOnlySupported ? 'analyze' : tool.WhatIfSupported ? 'preview' : 'run', {}); };

  return <div className="project-sonar-app">
    <section className="sonar-command-hero"><div className="sonar-radar-icon"><Radar size={32} /></div><div><p>{lang === 'ar' ? 'Project Sonar' : 'Project Sonar'}</p><h2>{lang === 'ar' ? 'افهم مشروعك قبل الخطوة التالية' : 'Understand your project before the next step'}</h2><span>{lang === 'ar' ? 'تحليل محلي لمساحة العمل، يركز على بنية المشروع وGit والنتائج ذات الأولوية من دون عرض محتويات الشيفرة أو الأسرار.' : 'A local workspace analysis focused on project structure, Git and prioritised findings without displaying source contents or secrets.'}</span></div><div className="sonar-privacy-chip"><ShieldCheck size={15} /><span>{lang === 'ar' ? 'دليل محلي فقط' : 'Local evidence only'}</span></div></section>
    <section className="sonar-scan-setup"><div className="app-section-title"><div><p>{lang === 'ar' ? 'مساحة العمل' : 'Workspace'}</p><h2>{lang === 'ar' ? 'اختر مشروعاً لفحصه' : 'Choose a project to scan'}</h2></div></div><div className="sonar-workspace-row"><FolderKanban size={20} /><div><small>{lang === 'ar' ? 'المشروع المختار' : 'Selected project'}</small><strong>{workspace || (lang === 'ar' ? 'لم يتم اختيار مشروع' : 'No project selected')}</strong></div><button type="button" onClick={() => setPickerOpen(true)}>{lang === 'ar' ? 'اختيار مشروع' : 'Choose project'}</button><button type="button" className="sonar-scan-button" onClick={scan} disabled={loading || !workspace.trim()}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : <Radar size={16} />}{loading ? (lang === 'ar' ? 'جارٍ التحليل...' : 'Analysing…') : (lang === 'ar' ? 'تشغيل سونار' : 'Run Sonar')}</button></div>{error && <p className="sonar-error"><TriangleAlert size={15} />{error}</p>}</section>
    {preview && <>
      <section className="sonar-workspace-snapshot"><article><FileCode2 size={19} /><div><span>{lang === 'ar' ? 'الملفات المرصودة' : 'Files observed'}</span><strong>{preview.Snapshot.FileCount.toLocaleString(lang)}</strong></div></article><article><GitBranch size={19} /><div><span>Git</span><strong>{preview.Snapshot.Git.Repository ? (preview.Snapshot.Git.Branch || (lang === 'ar' ? 'مستودع مكتشف' : 'Repository found')) : (lang === 'ar' ? 'غير مكتشف' : 'Not detected')}</strong></div></article><article><BarChart3 size={19} /><div><span>{lang === 'ar' ? 'اللغات' : 'Languages'}</span><strong>{preview.Snapshot.Languages.join(' · ') || '—'}</strong></div></article><article><Sparkles size={19} /><div><span>{lang === 'ar' ? 'الحزمة' : 'Package'}</span><strong>{preview.Snapshot.PackageName || '—'}</strong></div></article></section>
      <section className="sonar-findings-board"><div className="app-section-title"><div><p>{lang === 'ar' ? 'لوحة الأولويات' : 'Priority board'}</p><h2>{lang === 'ar' ? 'النتائج المبنية على الأدلة' : 'Evidence-backed findings'}</h2></div><div className="sonar-severity-filter"><button type="button" className={filter === 'ALL' ? 'is-active' : ''} onClick={() => setFilter('ALL')}>{lang === 'ar' ? 'الكل' : 'All'}</button>{SEVERITIES.map((severity) => <button type="button" className={filter === severity ? `is-active is-${severity.toLowerCase()}` : `is-${severity.toLowerCase()}`} key={severity} onClick={() => setFilter(severity)}>{severityLabel(severity, lang)} {preview.SeverityCounts[severity[0] + severity.slice(1).toLowerCase() as keyof typeof preview.SeverityCounts] || 0}</button>)}</div></div><div className="sonar-findings-layout"><div className="sonar-finding-list">{filteredFindings.length ? filteredFindings.map((finding) => <button type="button" className={selected?.Code === finding.Code ? `is-selected is-${finding.Severity.toLowerCase()}` : `is-${finding.Severity.toLowerCase()}`} key={finding.Code} onClick={() => setSelectedCode(finding.Code)}><span>{severityLabel(finding.Severity, lang)}</span><div><strong>{lang === 'ar' ? finding.TitleAr : finding.TitleEn}</strong><small>{finding.Evidence}</small></div><ChevronRight size={16} className="rtl:rotate-180" /></button>) : <div className="sonar-clear-state"><CheckCircle2 size={20} />{lang === 'ar' ? 'لا توجد نتائج ضمن هذا المرشح.' : 'No findings match this filter.'}</div>}</div>{selected && <aside className="sonar-finding-detail"><span className={`sonar-severity-badge is-${selected.Severity.toLowerCase()}`}>{severityLabel(selected.Severity, lang)}</span><h3>{lang === 'ar' ? selected.TitleAr : selected.TitleEn}</h3><div><small>{lang === 'ar' ? 'الدليل' : 'Evidence'}</small><p>{selected.Evidence}</p></div><div><small>{lang === 'ar' ? 'الخطوة المقترحة' : 'Recommended next step'}</small><p>{lang === 'ar' ? selected.FixAr : selected.FixEn}</p></div></aside>}</div></section>
      <section className="sonar-plan-export-grid"><article className="sonar-service-plan"><div className="app-section-title"><div><p>{lang === 'ar' ? 'الخطة الموجهة' : 'Guided plan'}</p><h2>{lang === 'ar' ? 'إجراءات جاهزة للمراجعة' : 'Actions ready to review'}</h2></div></div>{preview.ServicePlan.length ? preview.ServicePlan.map((item) => <button type="button" key={`${item.ToolId}-${item.Action}`} onClick={() => openPlanAction(item.ToolId)} disabled={!tools.some((tool) => tool.ToolId === item.ToolId)}><span><Check size={14} /></span><div><strong>{item.Action}</strong><small>{item.Changes ? (lang === 'ar' ? 'قد يغيّر الجهاز بعد التأكيد' : 'May change the device after confirmation') : (lang === 'ar' ? 'فحص أو مراجعة فقط' : 'Review or check only')}</small></div><ChevronRight size={15} className="rtl:rotate-180" /></button>) : <p>{lang === 'ar' ? 'لا توجد خطوة خدمة مسجلة من نتائج الفحص الحالية.' : 'No registered service action is suggested by the current scan.'}</p>}</article><article className="sonar-export-center"><div><p>{lang === 'ar' ? 'مركز التصدير' : 'Export center'}</p><h2>{lang === 'ar' ? 'شارك تقريراً قابلاً للتدقيق' : 'Share an auditable report'}</h2><span>{lang === 'ar' ? 'يُنشأ التقرير من دليل Sonar المحلي، ولا يتضمن محتويات ملفات المصدر أو الأسرار.' : 'Reports are generated from local Sonar evidence and do not include source contents or secrets.'}</span><div><button type="button" onClick={() => exportReport('markdown')} disabled={exporting !== null}><Download size={15} />{exporting === 'markdown' ? '…' : 'Markdown'}</button><button type="button" onClick={() => exportReport('pdf')} disabled={exporting !== null}><Download size={15} />{exporting === 'pdf' ? '…' : 'PDF'}</button></div></div>{aiReady && <button type="button" className="sonar-analysis-button" onClick={runAnalysis} disabled={analysisLoading}>{analysisLoading ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}{lang === 'ar' ? 'إنشاء تحليل اختياري' : 'Create optional analysis'}</button>}{aiReady === false && <small>{lang === 'ar' ? 'التحليل الاختياري غير مهيأ في الخدمة المحلية.' : 'Optional analysis is not configured in the local service.'}</small>}</article></section>
      {analysis && <section className="sonar-analysis-result"><div><WandSparkles size={20} /><strong>{lang === 'ar' ? 'تحليل المشروع' : 'Project analysis'}</strong><small>{analysis.model}</small></div><pre>{analysis.analysis}</pre></section>}
    </>}
    {pickerOpen && <WorkspaceFolderPicker lang={lang} initialPath={workspace} onClose={() => setPickerOpen(false)} onSelect={(path) => { setWorkspace(path); setPickerOpen(false); }} />}
  </div>;
}
