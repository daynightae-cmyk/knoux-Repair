import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Code2,
  Terminal,
  Cpu,
  Layers,
  Copy,
  Check,
  Download,
  Database,
  Cloud,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Server,
  Key,
} from 'lucide-react';
import type { Lang } from '../lib/i18n';
import {
  FREE_AI_MODELS,
  REPAIR_TEMPLATES,
  type AiTemplateItem,
} from '../lib/aiModelsData';
import { api, type AiGenerateResponse } from '../lib/api';
import { auth, getCachedAccessToken } from '../lib/firebase';
import {
  createMaintenanceReportDoc,
  uploadToDrive,
} from '../lib/workspaceApis';

interface OpenCodeZenHubProps {
  lang: Lang;
  bridgeElevated: boolean;
  onSendToTerminal?: (code: string) => void;
}

type TabType = 'studio' | 'templates' | 'providers' | 'history';

export default function OpenCodeZenHub({
  lang,
  bridgeElevated,
  onSendToTerminal,
}: OpenCodeZenHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('studio');

  // Model Selection
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.8-flash');
  const [customOpenRouterKey, setCustomOpenRouterKey] = useState<string>(() => {
    return localStorage.getItem('knoux-openrouter-key') || '';
  });

  // Studio inputs
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [systemInstructions, setSystemInstructions] = useState<string>(
    'You are Open Code Zen, an expert software diagnostic, Windows systems engineer, and code repair assistant. Provide clear, safe, production-grade PowerShell, CMD, or SQL code with markdown formatting.'
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Execution states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<AiGenerateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Cloud SQL logs
  const [cloudSqlLogs, setCloudSqlLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Template custom params
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});

  const activeModel = FREE_AI_MODELS.find((m) => m.id === selectedModelId) || FREE_AI_MODELS[0];

  // Save custom OpenRouter key to localStorage
  const handleSaveOpenRouterKey = (key: string) => {
    setCustomOpenRouterKey(key);
    localStorage.setItem('knoux-openrouter-key', key);
  };

  // Fetch Cloud SQL repair logs for history tab
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const uid = auth.currentUser?.uid || 'anonymous';
      const res = await fetch(`/api/cloudsql/repair-logs?uid=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        setCloudSqlLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Failed to fetch Cloud SQL logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  // Handle generation
  const handleGenerate = async (overridePrompt?: string, templateOverrideId?: string) => {
    const promptToUse = overridePrompt || userPrompt;
    if (!promptToUse.trim()) {
      setErrorMessage(lang === 'ar' ? 'يرجى كتابة وصف المشكلة أو الأمر المطلوب توليده' : 'Please enter a prompt or problem description');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setActionSuccessMsg(null);

    try {
      const uid = auth.currentUser?.uid || 'anonymous';
      const response = await api.aiGenerate({
        modelId: selectedModelId,
        prompt: promptToUse,
        systemPrompt: systemInstructions,
        customApiKey: customOpenRouterKey.trim() || undefined,
        templateId: templateOverrideId || selectedTemplateId || undefined,
        uid,
      });

      setGenerationResult(response);
    } catch (err: any) {
      console.error('AI generation failed:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل التوليد، يرجى المحاولة مرة أخرى' : 'Generation failed. Please retry.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodeIndex(index);
      setTimeout(() => setCopiedCodeIndex(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Download code as script file
  const handleDownloadCode = (code: string, filename = 'Knoux_Repair_Script.ps1') => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Send to Bridge Terminal
  const handleSendToTerminal = (code: string) => {
    if (onSendToTerminal) {
      onSendToTerminal(code);
      setActionSuccessMsg(lang === 'ar' ? 'تم إرسال السكربت إلى طرفية التشخيص!' : 'Script dispatched to diagnostic terminal!');
    } else {
      handleCopyCode(code, 999);
      setActionSuccessMsg(lang === 'ar' ? 'تم نسخ السكربت لتشغيله في الطرفية' : 'Script copied for terminal execution');
    }
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Export to Google Workspace
  const handleExportToGoogleDocs = async (content: string) => {
    const token = getCachedAccessToken();
    if (!token) {
      setActionSuccessMsg(lang === 'ar' ? 'يرجى تسجيل الدخول في سحابة Google أولاً لتصدير المستند' : 'Please connect Google Workspace in the Cloud Hub first');
      setTimeout(() => setActionSuccessMsg(null), 5000);
      return;
    }

    try {
      const doc = await createMaintenanceReportDoc(
        token,
        `KNOUX Code Zen Report — ${activeModel.name}`,
        content
      );
      setActionSuccessMsg(lang === 'ar' ? `تم إنشاء المستند بنجاح: ${doc.title}` : `Created Google Doc: ${doc.title}`);
    } catch (e: any) {
      setActionSuccessMsg(`Export error: ${e.message}`);
    }
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  // Save to Google Drive
  const handleSaveToDrive = async (content: string) => {
    const token = getCachedAccessToken();
    if (!token) {
      setActionSuccessMsg(lang === 'ar' ? 'يرجى تسجيل الدخول في سحابة Google أولاً' : 'Please connect Google Workspace in the Cloud Hub first');
      setTimeout(() => setActionSuccessMsg(null), 5000);
      return;
    }

    try {
      const file = await uploadToDrive(
        token,
        `Knoux_CodeZen_${Date.now()}.ps1`,
        content,
        'text/plain'
      );
      setActionSuccessMsg(lang === 'ar' ? `تم الحفظ في Google Drive: ${file.name}` : `Saved to Drive: ${file.name}`);
    } catch (e: any) {
      setActionSuccessMsg(`Drive error: ${e.message}`);
    }
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  // Load a template into the studio
  const handleApplyTemplate = (tmpl: AiTemplateItem) => {
    setSelectedTemplateId(tmpl.id);
    setSelectedModelId(tmpl.suggestedModel);

    // Build prompt based on template params
    let prompt = lang === 'ar' ? tmpl.defaultPromptAr : tmpl.defaultPromptEn;
    for (const p of tmpl.params) {
      const val = templateParams[p.id] || p.defaultValue;
      prompt = prompt.replace(`{${p.id}}`, val);
    }

    setUserPrompt(prompt);
    setActiveTab('studio');
    handleGenerate(prompt, tmpl.id);
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto px-1 pb-8 custom-scrollbar">
      {/* Top Banner & Header */}
      <div className="rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/25 shadow-[0_0_35px_rgba(99,102,241,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Code2 size={20} />
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles size={11} />
                {lang === 'ar' ? 'موديلات مجانية مدعومة فعلياً' : 'FREE PRODUCTION AI MODELS'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                OPEN CODE ZEN 2.0
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${bridgeElevated ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-white/[0.08]'}`}>
                {bridgeElevated ? (lang === 'ar' ? 'صلاحيات مسؤول' : 'ELEVATED') : (lang === 'ar' ? 'مستخدم قياسي' : 'STANDARD')}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">
              {lang === 'ar' ? 'محرك كود زن والموديلات المجانية' : 'Open Code Zen & Free Models Studio'}
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              {lang === 'ar'
                ? 'استغل القوة القصوى لموديلات الذكاء الاصطناعي المجانية (Gemini 3.8 Flash, DeepSeek R1, Qwen 2.5 Coder, Llama 3) لتوليد سكربتات الصيانة والإصلاح وتشخيص الأخطاء فورياً.'
                : 'Harness the full capabilities of free AI models (Gemini 3.8 Flash, DeepSeek R1, Qwen 2.5 Coder, Llama 3) to generate bulletproof Windows repair scripts, debug errors, and automate workstation health.'}
            </p>
          </div>

          {/* Quick Stats / Active Engine Pill */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-white/[0.08] flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  {lang === 'ar' ? 'الموديل النشط' : 'Active Model'}
                </p>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  {activeModel.name}
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-indigo-500/30 text-indigo-200">
                    {activeModel.speed}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="relative z-10 flex items-center gap-2 mt-6 pt-4 border-t border-white/[0.08] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'studio'
                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles size={14} />
            <span>{lang === 'ar' ? 'استوديو كود زن (توليد مباشر)' : 'Code Zen Studio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers size={14} />
            <span>{lang === 'ar' ? 'النماذج الجاهزة المعتمدة' : 'Repair Templates'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/30 text-indigo-200">
              {REPAIR_TEMPLATES.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'providers'
                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Server size={14} />
            <span>{lang === 'ar' ? 'إعدادات النماذج و OpenRouter' : 'Model Hub & OpenRouter'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database size={14} />
            <span>{lang === 'ar' ? 'سجل Cloud SQL والتوليد' : 'Cloud SQL Audit Logs'}</span>
          </button>
        </div>
      </div>

      {/* Action Success or Error Notification */}
      {actionSuccessMsg && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="px-4 py-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: CODE ZEN STUDIO */}
      {activeTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Model Picker & Prompt Input (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Model Selector Card */}
            <div className="rounded-2xl p-4 bg-slate-900/70 border border-white/[0.08] space-y-3">
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Cpu size={14} className="text-indigo-400" />
                  {lang === 'ar' ? 'اختر الموديل المجاني' : 'Select Free AI Model'}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">100% Free / Zero-Cost</span>
              </label>

              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {FREE_AI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModelId(m.id)}
                    className={`p-2.5 rounded-xl border text-start transition-all ${
                      selectedModelId === m.id
                        ? 'bg-indigo-950/70 border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                        : 'bg-slate-950/50 border-white/[0.05] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{m.name}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {lang === 'ar' ? m.descriptionAr : m.descriptionEn}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Inspiration Chips */}
            <div className="rounded-2xl p-4 bg-slate-900/70 border border-white/[0.08] space-y-2">
              <span className="text-[11px] font-bold text-slate-300 block">
                {lang === 'ar' ? 'أمثلة سريعة جاهزة للتجربة:' : 'Quick Prompt Starters:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { labelAr: 'إصلاح DISM و SFC', labelEn: 'DISM & SFC Healing', prompt: 'Write an elevated, bulletproof PowerShell script that runs DISM /Online /Cleanup-Image with CheckHealth, ScanHealth, and RestoreHealth, followed by SFC /scannow.' },
                  { labelAr: 'تحليل شاشة الموت 0x7E', labelEn: 'Parse BSOD 0x7E', prompt: 'Analyze BSOD Stop Code SYSTEM_THREAD_EXCEPTION_NOT_HANDLED (0x0000007E) and generate PowerShell script to extract Event ID 41 and 1001 details.' },
                  { labelAr: 'تصفير Winsock و DNS', labelEn: 'Flush DNS & Winsock', prompt: 'Create a clean, self-contained PowerShell script that safely flushes the DNS resolver cache, resets the TCP/IP stack via netsh, and re-leases DHCP.' },
                  { labelAr: 'تحصين ضد برامج الفدية', labelEn: 'Anti-Ransomware Guard', prompt: 'Write a PowerShell script that hardens Windows 10/11: enable Microsoft Defender Controlled Folder Access and key Attack Surface Reduction (ASR) rules in Block mode.' },
                  { labelAr: 'فهرسة SQL سريعة', labelEn: 'Optimize SQL Index', prompt: 'Provide optimal PostgreSQL DDL statements to create compound B-tree indexes on repair_logs for fast filtering by uid and created_at.' },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setUserPrompt(chip.prompt);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/[0.06] transition-colors"
                  >
                    {lang === 'ar' ? chip.labelAr : chip.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* User Prompt Textarea */}
            <div className="rounded-2xl p-4 bg-slate-900/70 border border-white/[0.08] space-y-3">
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Terminal size={14} className="text-cyan-400" />
                  {lang === 'ar' ? 'طلبك البرمجي أو وصف المشكلة' : 'Repair Request / Prompt'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">PowerShell / CMD / SQL</span>
              </label>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-mono">
                  {lang === 'ar' ? 'توجيهات النظام (System Instructions)' : 'System Persona & Directives'}
                </label>
                <input
                  type="text"
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'مثال: اكتب سكربت PowerShell لفحص وتفريغ كاش البرامج المؤقتة وإصلاح مشاكل بطء الإقلاع مع فحص الأمان...'
                    : 'e.g., Write an elevated PowerShell script that diagnoses slow boot processes, purges stale temp caches safely, and checks memory dump logs...'
                }
                rows={4}
                className="w-full rounded-xl bg-slate-950/80 border border-white/[0.1] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar resize-none"
              />

              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating || !userPrompt.trim()}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isGenerating || !userPrompt.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]'
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{lang === 'ar' ? 'جاري التحليل وتوليد الكود...' : 'Synthesizing with Code Zen...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>{lang === 'ar' ? 'توليد كود الإصلاح الآن' : 'Generate Repair Script'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Code Zen Terminal & Output Box (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="rounded-2xl bg-slate-950 border border-white/[0.1] overflow-hidden flex flex-col h-full shadow-2xl">
              {/* Terminal Titlebar */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 ml-2">
                    KNOUX-ZEN-TERMINAL &mdash; {activeModel.name}
                  </span>
                </div>

                {generationResult && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-emerald-400">
                      {generationResult.executionTimeMs}ms
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {generationResult.provider}
                    </span>
                  </div>
                )}
              </div>

              {/* Code / Markdown View Area */}
              <div className="p-4 flex-1 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed">
                {isGenerating ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                      <Sparkles size={16} className="absolute inset-0 m-auto text-indigo-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-slate-200 font-bold">
                        {lang === 'ar' ? 'جاري المعالجة البرمجية عبر كود زن...' : 'Open Code Zen Reasoning Engine Active...'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {lang === 'ar' ? `الموديل: ${activeModel.name}` : `Querying: ${activeModel.name}`}
                      </p>
                    </div>
                  </div>
                ) : generationResult ? (
                  <div className="space-y-4">
                    {/* Primary Script Code Snippet if extracted */}
                    {generationResult.codeSnippets.length > 0 ? (
                      generationResult.codeSnippets.map((snippet, idx) => (
                        <div key={idx} className="rounded-xl bg-slate-900/90 border border-indigo-500/30 overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-800/80 border-b border-white/[0.06] flex items-center justify-between">
                            <span className="text-[10px] text-cyan-300 font-bold">
                              {lang === 'ar' ? `سكربت التنفيذ المباشر [${idx + 1}]` : `Executable Script [${idx + 1}]`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyCode(snippet, idx)}
                                className="px-2 py-0.5 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1 transition-colors"
                              >
                                {copiedCodeIndex === idx ? (
                                  <>
                                    <Check size={10} className="text-emerald-400" />
                                    <span className="text-emerald-400">{lang === 'ar' ? 'تم النسخ' : 'Copied'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={10} />
                                    <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadCode(snippet, `Knoux_Repair_${idx + 1}.ps1`)}
                                className="px-2 py-0.5 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1 transition-colors"
                              >
                                <Download size={10} />
                                <span>.ps1</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendToTerminal(snippet)}
                                className="px-2 py-0.5 rounded text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1 transition-colors"
                              >
                                <Play size={10} />
                                <span>{lang === 'ar' ? 'تشغيل في الطرفية' : 'Run in Terminal'}</span>
                              </button>
                            </div>
                          </div>
                          <pre className="p-3.5 text-[11px] text-emerald-300 overflow-x-auto whitespace-pre custom-scrollbar">
                            <code>{snippet}</code>
                          </pre>
                        </div>
                      ))
                    ) : null}

                    {/* Explanatory text */}
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-slate-300 whitespace-pre-wrap text-[12px] leading-relaxed">
                      {generationResult.text}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center space-y-2 text-slate-500">
                    <Terminal size={32} className="opacity-40" />
                    <p className="text-xs">
                      {lang === 'ar'
                        ? 'اختر موديلاً أو نموذجاً، واضغط "توليد كود الإصلاح" لبدء هندسة الأكواد.'
                        : 'Select a free model, enter your requirements, and click "Generate Repair Script".'}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Ribbon below output */}
              {generationResult && (
                <div className="px-4 py-2.5 bg-slate-900 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(generationResult.text, 999)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Copy size={12} />
                      <span>{lang === 'ar' ? 'نسخ التحليل كاملاً' : 'Copy Full Analysis'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportToGoogleDocs(generationResult.text)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 transition-colors"
                    >
                      <FileText size={12} />
                      <span>{lang === 'ar' ? 'تصدير إلى Google Docs' : 'Export to Docs'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveToDrive(generationResult.text)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 transition-colors"
                    >
                      <Cloud size={12} />
                      <span>{lang === 'ar' ? 'حفظ في Drive' : 'Save to Drive'}</span>
                    </button>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {lang === 'ar' ? 'تم الحفظ في سجلات التدقيق' : 'Logged to Cloud SQL'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CERTIFIED REPAIR TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' ? 'نماذج الصيانة الذكية الجاهزة' : 'Engineered System Repair Templates'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'نماذج متخصصة ومحققة بالكامل لمعالجة أعطال ويندوز الحرجة بنقرة واحدة.'
                  : 'Certified production templates designed for one-click diagnostic and script generation.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPAIR_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-5 rounded-2xl bg-slate-900/70 border border-white/[0.08] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                      <Sparkles size={16} />
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase ${
                        tmpl.safetyLevel === 'SAFE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {tmpl.safetyLevel === 'ADMIN_REQUIRED'
                        ? (lang === 'ar' ? 'يتطلب صلاحيات مسؤول' : 'ADMIN REQUIRED')
                        : (lang === 'ar' ? 'آمن تماماً' : 'SAFE')}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {lang === 'ar' ? tmpl.titleAr : tmpl.titleEn}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {lang === 'ar' ? tmpl.descriptionAr : tmpl.descriptionEn}
                  </p>

                  {/* Template Params preview */}
                  <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
                    {tmpl.params.map((p) => (
                      <div key={p.id} className="text-[11px] flex items-center justify-between text-slate-400 gap-2">
                        <span className="truncate">{lang === 'ar' ? p.labelAr : p.labelEn}:</span>
                        <input
                          type="text"
                          value={templateParams[p.id] ?? p.defaultValue}
                          onChange={(e) => setTemplateParams((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-36 px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-indigo-500 text-right"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play size={12} />
                    <span>{lang === 'ar' ? 'تطبيق وتوليد السكربت' : 'Apply & Generate'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PROVIDERS & OPENROUTER HUB */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Provider Card: Google AI Studio (Native) */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Server size={18} />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white">Google AI Studio</h4>
                  <p className="text-xs text-slate-400">{lang === 'ar' ? 'المحرك السحابي الافتراضي' : 'Default Server Engine'}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE & OPERATIONAL
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'يعمل محرك Google Gemini تلقائياً وبشكل مجاني تماماً على الخادم، مما يتيح لك سرعة فائقة في معالجة الأوامر دون الحاجة لأي مفاتيح أو ضبط يدوي.'
                : 'Native server-side Google Gemini integration provides blazing-fast reasoning, large context windows, and zero-configuration execution directly out of the box.'}
            </p>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{lang === 'ar' ? 'الموديل الرئيسي' : 'Flagship Model'}</span>
                <span className="font-mono text-white font-bold">Gemini 3.8 Flash</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{lang === 'ar' ? 'حجم نافذة السياق' : 'Context Window'}</span>
                <span className="font-mono text-emerald-400 font-bold">1,000,000 Tokens</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{lang === 'ar' ? 'التكلفة' : 'Cost'}</span>
                <span className="font-mono text-emerald-400 font-bold">$0.00 (Free Tier)</span>
              </div>
            </div>
          </div>

          {/* Provider Card: OpenRouter Free Models */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-indigo-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Key size={18} />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white">OpenRouter Gateway</h4>
                  <p className="text-xs text-slate-400">{lang === 'ar' ? 'بوابة الموديلات المفتوحة والمجانية' : 'Open Source Free Models'}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                MULTI-MODEL
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'يدعم تطبيقك تشغيل موديلات DeepSeek R1 و Qwen 2.5 Coder 32B و Meta Llama مجاناً. يمكنك إدخال مفتاح OpenRouter الخاص بك إذا رغبت، أو الاعتماد على التوجيه التلقائي المدمج.'
                : 'Supports community open models (DeepSeek R1, Qwen 2.5 Coder 32B, Llama 3.2). You can enter an optional OpenRouter API key, or enjoy zero-config autonomous synthesis.'}
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>{lang === 'ar' ? 'مفتاح OpenRouter API (اختياري)' : 'OpenRouter API Key (Optional)'}</span>
                <span className="text-[10px] text-slate-400">{lang === 'ar' ? 'يحفظ محلياً في متصفحك' : 'Stored locally in browser'}</span>
              </label>
              <input
                type="password"
                value={customOpenRouterKey}
                onChange={(e) => handleSaveOpenRouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded-xl bg-slate-950/80 border border-white/[0.1] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD SQL AUDIT LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' ? 'سجل عمليات التوليد المحفوظة في Cloud SQL' : 'Cloud SQL AI Audit Trail'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'يتم توثيق كل عملية توليد وإصلاح تلقائياً في قاعدة بيانات PostgreSQL.'
                  : 'Every AI diagnostic session and script synthesis is persisted to PostgreSQL for compliance.'}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
              <span>{lang === 'ar' ? 'تحديث السجل' : 'Refresh Logs'}</span>
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/70 border border-white/[0.08] overflow-hidden">
            {loadingLogs ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw size={16} className="animate-spin mx-auto mb-2 text-indigo-400" />
                <span>{lang === 'ar' ? 'جاري تحميل السجلات من Cloud SQL...' : 'Fetching logs from Cloud SQL...'}</span>
              </div>
            ) : cloudSqlLogs.length > 0 ? (
              <div className="divide-y divide-white/[0.05]">
                {cloudSqlLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{log.toolName}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                          {log.toolId}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {log.details ? JSON.stringify(log.details) : 'Executed repair synthesis'}
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {log.status}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        {log.durationMs}ms &bull; {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                <Database size={24} className="mx-auto mb-2 opacity-30" />
                <span>{lang === 'ar' ? 'لا توجد سجلات محفوظة بعد. قم بتوليد أول سكربت ليتم تسجيله!' : 'No audit records found yet. Generate your first script!'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
