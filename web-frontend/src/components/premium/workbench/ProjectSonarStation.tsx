import { useState, useCallback, useEffect } from 'react';
import {
  Radar, FolderKanban, BarChart3,
  FileCode2, GitBranch, Sparkles, ChevronRight,
  Download, WandSparkles, LoaderCircle, TriangleAlert,
  ShieldAlert, Layers
} from 'lucide-react';
import type {
  BridgeTool, ProjectSonarPreview,
  ProjectSonarAiAnalysis, SonarSeverity, ToolRunOptions,
  ExecutionMode, ToolRunConfirmation
} from '../../../lib/api';
import { api, BRIDGE_URL } from '../../../lib/api';
import WorkspaceFolderPicker from '../../WorkspaceFolderPicker';

interface ProjectSonarStationProps {
  lang: 'en' | 'ar';
  tools: BridgeTool[];
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  isUnlocked?: boolean;
  sessionToken?: string | null;
  onUnlockRequest?: () => void;
}

type SonarSubView = 'dashboard' | 'topology' | 'archive-inspector';

export default function ProjectSonarStation({
  lang,
  tools: _tools,
  bridgeOnline: _bridgeOnline,
  bridgeElevated: _bridgeElevated,
  onRunTool: _onRunTool,
  isUnlocked = false,
  sessionToken = null,
  onUnlockRequest,
}: ProjectSonarStationProps) {
  const isRtl = lang === 'ar';
  const [activeSubView, setActiveSubView] = useState<SonarSubView>('dashboard');
  const [workspace, setWorkspace] = useState(() => {
    try {
      return localStorage.getItem('knoux-last-sonar-workspace') || '';
    } catch {
      return '';
    }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<ProjectSonarPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | SonarSeverity>('ALL');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'markdown' | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<ProjectSonarAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Archive inspection state
  const [archivePath, setArchivePath] = useState('');
  const [archiveResult, setArchiveResult] = useState<any>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const scanWorkspace = useCallback(async () => {
    if (!workspace.trim()) return;
    setLoading(true);
    setError(null);
    try {
      try { localStorage.setItem('knoux-last-sonar-workspace', workspace.trim()); } catch { /* ignore */ }
      const res = await api.sonarPreview(workspace.trim());
      setPreview(res.preview);
      if (res.preview.Findings?.length > 0) {
        setSelectedCode(res.preview.Findings[0].Code);
      }
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر فحص مساحة العمل المحددة.' : 'Failed to scan workspace.'));
    } finally {
      setLoading(false);
    }
  }, [workspace, isRtl]);

  useEffect(() => {
    if (workspace.trim()) {
      scanWorkspace();
    }
  }, [scanWorkspace]);

  const handleExport = async (format: 'pdf' | 'markdown') => {
    if (!workspace) return;
    setExporting(format);
    try {
      const { export: item } = await api.sonarExport(workspace, format, lang);
      window.open(`${BRIDGE_URL}${item.downloadUrl}`, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleAiAnalysis = async () => {
    if (!workspace) return;
    setAiLoading(true);
    try {
      const analysis = await api.sonarAnalysis(workspace, lang, sessionToken);
      setAiAnalysis(analysis);
    } catch (err: any) {
      setError(err?.message || 'AI Analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleInspectArchive = async () => {
    if (!archivePath.trim()) return;
    setArchiveLoading(true);
    try {
      const res = await api.workbenchInspectArchive(archivePath.trim());
      setArchiveResult(res);
    } catch (err: any) {
      setArchiveResult({ ok: false, message: err?.message || 'Failed to inspect archive' });
    } finally {
      setArchiveLoading(false);
    }
  };

  const filteredFindings = preview?.Findings?.filter(
    (f) => filter === 'ALL' || f.Severity === filter
  ) || [];

  const selectedFinding = preview?.Findings?.find((f) => f.Code === selectedCode) || filteredFindings[0];

  return (
    <div className="flex flex-col h-full bg-[#050714] text-slate-200" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Workspace Header & Intake */}
      <div className="p-4 border-b border-white/[0.08] bg-slate-950/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
            <Radar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Project Sonar</h3>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-mono text-cyan-300">
                Code Forensics & Radar
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md">
              {workspace || (isRtl ? 'لم يتم تحديد مسار' : 'No workspace path set')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
          >
            <FolderKanban size={13} />
            <span>{isRtl ? 'تغيير المجلد' : 'Choose Path'}</span>
          </button>
          <button
            type="button"
            onClick={scanWorkspace}
            disabled={loading || !workspace}
            className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-xs font-medium rounded-xl transition hover:brightness-110 disabled:opacity-40 flex items-center gap-1.5 shadow-lg shadow-cyan-500/10"
          >
            {loading ? <LoaderCircle size={13} className="animate-spin" /> : <Radar size={13} />}
            <span>{loading ? (isRtl ? 'جارٍ الفحص...' : 'Scanning...') : (isRtl ? 'إعادة الفحص' : 'Scan Sonar')}</span>
          </button>
        </div>
      </div>

      {/* Sub-nav Tabs */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.04] bg-slate-950/40 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveSubView('dashboard')}
          className={`px-3 py-1 rounded-lg transition ${activeSubView === 'dashboard' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
        >
          {isRtl ? 'لوحة النتائج والأدلة' : 'Findings & Evidence'}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('topology')}
          className={`px-3 py-1 rounded-lg transition ${activeSubView === 'topology' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
        >
          {isRtl ? 'تضاريس المشروع (Radar Topology)' : 'Project Topology'}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('archive-inspector')}
          className={`px-3 py-1 rounded-lg transition ${activeSubView === 'archive-inspector' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
        >
          {isRtl ? 'فاحص الأرشيف الدفاعي (Safe Zip)' : 'Defensive Zip Inspector'}
        </button>
      </div>

      {/* Viewport Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2 mb-4">
            <TriangleAlert size={14} />
            <span>{error}</span>
          </div>
        )}

        {!workspace && activeSubView !== 'archive-inspector' && (
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 mb-4">
              <FolderKanban size={26} />
            </div>
            <h4 className="text-base font-bold text-white mb-1.5">
              {isRtl ? 'اختر مسار مشروع للبدء بالفحص' : 'Select a Project Folder to Begin'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              {isRtl
                ? 'حدد مجلد المشروع المحلي لتشغيل رادار سونار وكشف البنية والمخاطر والتبعيات مباشرة.'
                : 'Choose a local project folder to trigger Sonar Radar diagnostics and structural forensics.'}
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-xs rounded-xl transition hover:brightness-110 flex items-center gap-2 shadow-lg shadow-cyan-500/10"
            >
              <FolderKanban size={14} />
              <span>{isRtl ? 'استعراض واختيار المجلد' : 'Browse Project Folder'}</span>
            </button>
          </div>
        )}

        {/* 1. FINDINGS & DASHBOARD */}
        {activeSubView === 'dashboard' && preview && (
          <div className="space-y-5">
            {/* Snapshot Metrics Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-900/40 border border-white/[0.08] rounded-xl flex items-center gap-3">
                <FileCode2 size={20} className="text-cyan-400" />
                <div>
                  <div className="text-[10px] text-slate-400">{isRtl ? 'الملفات المرصودة' : 'Files Observed'}</div>
                  <div className="text-sm font-bold text-white">{preview.Snapshot?.FileCount?.toLocaleString() || '—'}</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/40 border border-white/[0.08] rounded-xl flex items-center gap-3">
                <GitBranch size={20} className="text-emerald-400" />
                <div>
                  <div className="text-[10px] text-slate-400">Git Branch</div>
                  <div className="text-sm font-bold text-emerald-300 truncate max-w-[120px]">
                    {preview.Snapshot?.Git?.Repository ? preview.Snapshot.Git.Branch : (isRtl ? 'غير متوفر' : 'No Repo')}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/40 border border-white/[0.08] rounded-xl flex items-center gap-3">
                <BarChart3 size={20} className="text-violet-400" />
                <div>
                  <div className="text-[10px] text-slate-400">{isRtl ? 'اللغات' : 'Languages'}</div>
                  <div className="text-xs font-bold text-violet-300 truncate max-w-[140px]">
                    {preview.Snapshot?.Languages?.join(' · ') || '—'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/40 border border-white/[0.08] rounded-xl flex items-center gap-3">
                <Sparkles size={20} className="text-amber-400" />
                <div>
                  <div className="text-[10px] text-slate-400">{isRtl ? 'الحزمة' : 'Package'}</div>
                  <div className="text-xs font-bold text-amber-300 truncate max-w-[140px]">
                    {preview.Snapshot?.PackageName || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Findings Board */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Findings List */}
              <div className="lg:col-span-1 bg-slate-900/40 border border-white/[0.08] rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-white">{isRtl ? 'النتائج ذات الأولوية' : 'Priority Findings'}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {filteredFindings.length} / {preview.Findings?.length || 0}
                  </span>
                </div>

                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setFilter(sev)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition ${
                        filter === sev ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[380px] flex-1">
                  {filteredFindings.map((f) => {
                    const isSel = selectedCode === f.Code;
                    return (
                      <button
                        key={f.Code}
                        type="button"
                        onClick={() => setSelectedCode(f.Code)}
                        className={`w-full text-start p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                          isSel
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-white'
                            : 'bg-slate-950/60 border-white/[0.05] text-slate-300 hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono ${
                              f.Severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                              f.Severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-cyan-500/20 text-cyan-300'
                            }`}>
                              {f.Severity}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[150px]">
                              {isRtl ? f.TitleAr : f.TitleEn}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                            {f.Evidence}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 mt-1 shrink-0" />
                      </button>
                    );
                  })}
                  {filteredFindings.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-500">
                      {isRtl ? 'لا توجد نتائج مطابقة لهذا المرشح.' : 'No findings match filter.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Finding Detail & Guided Fix */}
              <div className="lg:col-span-2 bg-slate-900/40 border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between">
                {selectedFinding ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          selectedFinding.Severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                          selectedFinding.Severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {selectedFinding.Severity}
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {isRtl ? selectedFinding.TitleAr : selectedFinding.TitleEn}
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-slate-500">{selectedFinding.Code}</span>
                    </div>

                    <div className="bg-slate-950/80 border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{isRtl ? 'الدليل الرقمي الملتقط' : 'Captured Evidence'}</div>
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{selectedFinding.Evidence}</pre>
                    </div>

                    <div className="bg-slate-950/80 border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{isRtl ? 'خطوة المعالجة الموصى بها' : 'Recommended Fix'}</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{isRtl ? selectedFinding.FixAr : selectedFinding.FixEn}</p>
                    </div>

                    {/* AI Analysis Preview if requested */}
                    {aiAnalysis && (
                      <div className="bg-violet-950/20 border border-violet-500/20 rounded-xl p-3.5 space-y-1.5">
                        <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                          <WandSparkles size={13} />
                          <span>KNOUX AI Synthesis</span>
                        </div>
                        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {aiAnalysis.analysis}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    {isRtl ? 'حدد نتيجة لعرض تفاصيلها ودليلها الهندسي.' : 'Select a finding to inspect its forensic evidence.'}
                  </div>
                )}

                {/* Report Generation & Actions */}
                <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport('markdown')}
                      disabled={exporting !== null}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-medium flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>{exporting === 'markdown' ? '…' : 'Export Markdown'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('pdf')}
                      disabled={exporting !== null}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-medium flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>{exporting === 'pdf' ? '…' : 'Export PDF'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked && onUnlockRequest) {
                        onUnlockRequest();
                      } else {
                        handleAiAnalysis();
                      }
                    }}
                    disabled={aiLoading}
                    className="px-3.5 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    {aiLoading ? <LoaderCircle size={13} className="animate-spin" /> : <WandSparkles size={13} />}
                    <span>{aiLoading ? (isRtl ? 'جارٍ التحليل...' : 'Synthesizing...') : (isRtl ? 'تحليل ذكي (KNOUX AI)' : 'Synthesize with KNOUX AI')}</span>
                    {!isUnlocked && (
                      <span className="px-1.5 py-0.2 rounded bg-violet-500/30 text-[9px] font-mono text-violet-200">
                        PRO
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TOPOLOGY MAP */}
        {activeSubView === 'topology' && preview && (
          <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">{isRtl ? 'خريطة التضاريس والوحدات' : 'Project Topology & Folder Radar'}</h4>
                <p className="text-xs text-slate-400">{isRtl ? 'توزيع الوحدات ومجلدات المشروع المرصودة.' : 'Structural directory mapping and file distribution.'}</p>
              </div>
              <span className="text-xs font-mono text-cyan-400">{preview.Snapshot?.TopDirectories?.length || 0} top folders</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {preview.Snapshot?.TopDirectories?.map((dir) => (
                <div key={dir} className="p-3 bg-slate-950/80 border border-white/[0.08] rounded-xl flex items-center gap-2.5">
                  <Layers size={16} className="text-cyan-400 shrink-0" />
                  <span className="text-xs font-mono text-slate-200 truncate">{dir}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. DEFENSIVE ARCHIVE INSPECTOR */}
        {activeSubView === 'archive-inspector' && (
          <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl p-5 space-y-4 max-w-3xl">
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">{isRtl ? 'فاحص الأرشيف الدفاعي (Safe Zip Inspector)' : 'Safe Zip Archive Inspector'}</h4>
              <p className="text-xs text-slate-400">{isRtl ? 'فحص آمن لملفات الأرشيف بدون استخراج لمنع هجمات Zip Slip واختراق المسار.' : 'Inspect zip contents without extraction to prevent Zip Slip and path traversal vulnerabilities.'}</p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={archivePath}
                onChange={(e) => setArchivePath(e.target.value)}
                placeholder="C:\path\to\archive.zip"
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleInspectArchive}
                disabled={archiveLoading || !archivePath.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-xs rounded-xl transition hover:brightness-110 disabled:opacity-40"
              >
                {archiveLoading ? 'Inspecting...' : 'Inspect Archive'}
              </button>
            </div>

            {archiveResult && (
              <div className="space-y-3 font-mono text-xs">
                {archiveResult.hasPathTraversal && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 flex items-center gap-2 font-bold">
                    <ShieldAlert size={16} />
                    <span>HIGH RISK: Path traversal entries (..) detected in archive headers!</span>
                  </div>
                )}

                <div className="p-3 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-between">
                  <span>Total Files: <strong className="text-white">{archiveResult.totalFiles}</strong></span>
                  <span>Uncompressed Size: <strong className="text-cyan-300">{((archiveResult.uncompressedBytesTotal || 0) / 1024 / 1024).toFixed(2)} MB</strong></span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04] bg-slate-950 border border-white/10 rounded-xl">
                  {archiveResult.files?.map((f: any, idx: number) => (
                    <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                      <span className={f.pathTraversalRisk ? 'text-rose-400 font-bold' : 'text-slate-300'}>{f.name}</span>
                      <span className="text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {pickerOpen && (
        <WorkspaceFolderPicker
          lang={lang}
          initialPath={workspace}
          onClose={() => setPickerOpen(false)}
          onSelect={(path) => { setWorkspace(path); setPickerOpen(false); }}
        />
      )}
    </div>
  );
}
