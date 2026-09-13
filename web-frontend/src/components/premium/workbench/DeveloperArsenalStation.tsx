import { useState } from 'react';
import {
  FileCode, Database, Globe, Key,
  Copy, Check,
  Hash, Terminal
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation } from '../../../lib/api';
import { api } from '../../../lib/api';

interface DeveloperArsenalProps {
  lang: 'en' | 'ar';
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  isUnlocked?: boolean;
  sessionToken?: string | null;
  onUnlockRequest?: () => void;
}

type StudioTab = 'code' | 'data-web' | 'crypto-hash' | 'env-toolchain' | 'vault';

export default function DeveloperArsenal({
  lang,
  tools: _tools,
  toolStatuses: _toolStatuses,
  bridgeOnline: _bridgeOnline,
  bridgeElevated: _bridgeElevated,
  onRunTool: _onRunTool,
  isUnlocked = false,
  sessionToken: _sessionToken = null,
  onUnlockRequest,
}: DeveloperArsenalProps) {
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<StudioTab>('code');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // --- 1. CODE STUDIO STATE ---
  const [codeSnippet, setCodeSnippet] = useState('{\n  "service": "knoux-workbench",\n  "status": "active",\n  "count": 158\n}');
  const [codeOutput, setCodeOutput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [regexPattern, setRegexPattern] = useState('[a-zA-Z0-9_-]+');
  const [regexFlags, setRegexFlags] = useState('g');
  const [regexTestText, setRegexTestText] = useState('Sample text with test_123 and ABC-999');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(codeSnippet);
      setCodeOutput(JSON.stringify(parsed, null, 2));
      setCodeError(null);
    } catch (err: any) {
      setCodeError(err?.message || 'Invalid JSON');
      setCodeOutput('');
    }
  };

  const handleMinifyJson = () => {
    try {
      const parsed = JSON.parse(codeSnippet);
      setCodeOutput(JSON.stringify(parsed));
      setCodeError(null);
    } catch (err: any) {
      setCodeError(err?.message || 'Invalid JSON');
      setCodeOutput('');
    }
  };

  const handleTestRegex = () => {
    try {
      const re = new RegExp(regexPattern, regexFlags);
      const matches = regexTestText.match(re) || [];
      setRegexMatches(Array.from(matches));
      setCodeError(null);
    } catch (err: any) {
      setCodeError(err?.message || 'Invalid Regular Expression');
      setRegexMatches([]);
    }
  };

  // --- 2. DATA & WEB LAB STATE ---
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [httpUrl, setHttpUrl] = useState('http://127.0.0.1:8787/api/health');
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [httpResponse, setHttpResponse] = useState<string>('');
  const [httpLoading, setHttpLoading] = useState(false);
  const [jwtInput, setJwtInput] = useState('');
  const [jwtDecoded, setJwtDecoded] = useState<{ header: any; payload: any } | null>(null);

  const executeHttpRequest = async () => {
    setHttpLoading(true);
    setHttpResponse('');
    setHttpStatus(null);
    try {
      const res = await fetch(httpUrl, { method: httpMethod });
      setHttpStatus(res.status);
      const text = await res.text();
      try {
        setHttpResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setHttpResponse(text);
      }
    } catch (err: any) {
      setHttpStatus(0);
      setHttpResponse(err?.message || 'Connection failed');
    } finally {
      setHttpLoading(false);
    }
  };

  const decodeJwt = () => {
    try {
      const parts = jwtInput.trim().split('.');
      if (parts.length < 2) throw new Error('JWT must have at least 2 parts');
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      setJwtDecoded({ header, payload });
    } catch {
      setJwtDecoded(null);
    }
  };

  // --- 3. CRYPTO & HASH STUDIO STATE ---
  const [hashInput, setHashInput] = useState('Knoux-System-Payload');
  const [hashResults, setHashResults] = useState<{ sha256: string; sha512: string; uuid: string } | null>(null);

  const computeHashes = async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(hashInput);

    const sha256Buf = await crypto.subtle.digest('SHA-256', data);
    const sha512Buf = await crypto.subtle.digest('SHA-512', data);

    const toHex = (buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const uuid = crypto.randomUUID();
    setHashResults({
      sha256: toHex(sha256Buf),
      sha512: toHex(sha512Buf),
      uuid,
    });
  };

  // --- 4. ENVIRONMENT & TOOLCHAIN STATE ---
  const [toolchainData, setToolchainData] = useState<Array<{ tool: string; available: boolean; version: string; primaryPath: string; candidates: string[] }>>([]);
  const [toolchainLoading, setToolchainLoading] = useState(false);
  const [portsData, setPortsData] = useState<Array<{ port: number; address: string; processId: number | null }>>([]);

  const loadToolchain = async () => {
    setToolchainLoading(true);
    try {
      const res = await api.workbenchToolchain();
      if (res.ok) setToolchainData(res.toolchain);
    } catch {
      // offline
    } finally {
      setToolchainLoading(false);
    }
  };

  const loadPorts = async () => {
    try {
      const res = await api.workbenchPorts();
      if (res.ok) setPortsData(res.ports);
    } catch {
      // offline
    }
  };

  // Curated Command Recipes
  const RECIPES = [
    { id: 'git-status', title: 'Git Short Status', desc: 'Inspect worktree modifications cleanly', cmd: 'git status -s' },
    { id: 'git-branches', title: 'Git Branches & Commit', desc: 'List local & remote tracking branches with commit hash', cmd: 'git branch -vva' },
    { id: 'pwsh-listeners', title: 'Developer Port Listeners', desc: 'Inspect processes bound to localhost development ports', cmd: 'Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,8080,8787,5173,5000 }' },
    { id: 'node-clean', title: 'Purge Node Modules Cache', desc: 'Safe verify of local npm package store', cmd: 'npm cache verify' },
    { id: 'win-dns', title: 'Flush Local DNS Cache', desc: 'Clear local resolver resolution entries', cmd: 'Clear-DnsClientCache' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#050714] text-slate-200" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Studio Navigation Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.08] bg-slate-950/60 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'code' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <FileCode size={13} />
          <span>{isRtl ? 'مختبر الأكواد والصيغ' : 'Code & Syntax Lab'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('data-web')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'data-web' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Globe size={13} />
          <span>{isRtl ? 'الويب والبيانات (API/JWT)' : 'Web & API Lab'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('crypto-hash')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'crypto-hash' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Key size={13} />
          <span>{isRtl ? 'التشفير والبصمات الرقمية' : 'Crypto & Hash'}</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('env-toolchain'); loadToolchain(); loadPorts(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'env-toolchain' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Terminal size={13} />
          <span>{isRtl ? 'بيئة التشغيل والمنافذ' : 'Toolchain & Ports'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vault')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'vault' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Database size={13} />
          <span>{isRtl ? 'خزينة الأوامر والوصفات' : 'Script Vault'}</span>
        </button>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* 1. CODE STUDIO */}
        {activeTab === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full min-h-[500px]">
            {/* JSON / Formatter */}
            <div className="flex flex-col bg-slate-900/40 border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileCode size={14} className="text-cyan-400" />
                  <span>{isRtl ? 'منسق ومدقق JSON' : 'JSON Formatter & Validator'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleFormatJson} className="px-2.5 py-1 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 rounded-lg text-[11px] font-medium transition">
                    {isRtl ? 'تنسيق جميل' : 'Beautify'}
                  </button>
                  <button type="button" onClick={handleMinifyJson} className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 rounded-lg text-[11px] font-medium transition">
                    {isRtl ? 'ضغط' : 'Minify'}
                  </button>
                </div>
              </div>
              <textarea
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                placeholder="Paste JSON content here..."
                rows={8}
                className="w-full flex-1 bg-slate-950/80 border border-white/10 rounded-xl p-3 text-xs font-mono text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 resize-none mb-3"
              />
              {codeError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-mono mb-2">
                  {codeError}
                </div>
              )}
              {codeOutput && (
                <div className="relative">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>{isRtl ? 'النتيجة المنسقة:' : 'Formatted Output:'}</span>
                    <button type="button" onClick={() => copyText(codeOutput, 'json-out')} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      {copiedKey === 'json-out' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === 'json-out' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950/90 border border-white/10 rounded-xl text-xs font-mono text-emerald-300 max-h-48 overflow-y-auto">
                    {codeOutput}
                  </pre>
                </div>
              )}
            </div>

            {/* Regex Tester */}
            <div className="flex flex-col bg-slate-900/40 border border-white/[0.08] rounded-2xl p-4">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5 mb-3">
                <Hash size={14} className="text-violet-400" />
                <span>{isRtl ? 'مختبر التعابير النمطية (Regex Tester)' : 'Live Regular Expression Tester'}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-400 block mb-1">Pattern</label>
                  <input
                    type="text"
                    value={regexPattern}
                    onChange={(e) => setRegexPattern(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Flags</label>
                  <input
                    type="text"
                    value={regexFlags}
                    onChange={(e) => setRegexFlags(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>
              <label className="text-[10px] text-slate-400 block mb-1">Test Text</label>
              <textarea
                value={regexTestText}
                onChange={(e) => setRegexTestText(e.target.value)}
                rows={4}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-400 resize-none mb-3"
              />
              <button
                type="button"
                onClick={handleTestRegex}
                className="w-full py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-medium transition mb-3"
              >
                {isRtl ? 'فحص التطابق' : 'Evaluate Expression'}
              </button>
              <div className="flex-1 bg-slate-950/90 border border-white/10 rounded-xl p-3 overflow-y-auto">
                <div className="text-[11px] text-slate-400 mb-2 font-medium">
                  {regexMatches.length} {isRtl ? 'مطابقات مرصودة' : 'Matches Found'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {regexMatches.map((m, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-violet-500/15 border border-violet-500/30 text-violet-200 rounded-md font-mono text-xs">
                      {m}
                    </span>
                  ))}
                  {regexMatches.length === 0 && (
                    <span className="text-slate-600 text-xs italic">{isRtl ? 'لا توجد مطابقات حالية.' : 'No matches found.'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. DATA & WEB LAB */}
        {activeTab === 'data-web' && (
          <div className="space-y-6">
            {/* Quick HTTP Request Probe */}
            <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl p-5">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5 mb-1">
                <Globe size={14} className="text-cyan-400" />
                <span>{isRtl ? 'مسبار اتصالات HTTP وفحص الصحة المحلي' : 'Local HTTP Probe & Health Ping'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                {isRtl
                  ? 'فحص استجابة وحالة نقاط النهاية المحلية (Local endpoints) والخوادم قيد التطوير بدون محاكاة.'
                  : 'Quick connectivity probe and health check for local development endpoints and services.'}
              </p>
              <div className="flex gap-2 mb-3">
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value as any)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  type="text"
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={executeHttpRequest}
                  disabled={httpLoading}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-xs rounded-xl transition hover:brightness-110 disabled:opacity-40"
                >
                  {httpLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
              {httpStatus !== null && (
                <div className="flex items-center gap-2 mb-2 text-xs font-mono">
                  <span className="text-slate-400">HTTP Status:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${httpStatus >= 200 && httpStatus < 300 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {httpStatus || 'ERR'}
                  </span>
                </div>
              )}
              {httpResponse && (
                <pre className="p-3 bg-slate-950 border border-white/10 rounded-xl text-xs font-mono text-slate-200 max-h-60 overflow-y-auto">
                  {httpResponse}
                </pre>
              )}
            </div>

            {/* JWT Decoder */}
            <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl p-5">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                <Key size={14} className="text-amber-400" />
                <span>{isRtl ? 'مفسر رموز JWT الآمن (فك ترميز محلي بدون إرسال)' : 'Offline JWT Inspector (Plain client-side decode)'}</span>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={jwtInput}
                  onChange={(e) => setJwtInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={decodeJwt}
                  className="px-4 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-medium hover:bg-amber-500/25 transition"
                >
                  Decode
                </button>
              </div>
              {jwtDecoded && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-950 border border-white/10 rounded-xl">
                    <div className="text-[10px] text-amber-400 font-bold mb-1 uppercase tracking-wider">Header</div>
                    <pre className="text-xs font-mono text-slate-300">{JSON.stringify(jwtDecoded.header, null, 2)}</pre>
                  </div>
                  <div className="p-3 bg-slate-950 border border-white/10 rounded-xl">
                    <div className="text-[10px] text-cyan-400 font-bold mb-1 uppercase tracking-wider">Payload</div>
                    <pre className="text-xs font-mono text-slate-300">{JSON.stringify(jwtDecoded.payload, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. CRYPTO & HASH */}
        {activeTab === 'crypto-hash' && (
          <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5 mb-3">
              <Key size={14} className="text-cyan-400" />
              <span>{isRtl ? 'مولد البصمات والمفاتيح المشفرة' : 'Cryptographic Hash & Identifier Station'}</span>
            </div>
            <label className="text-[10px] text-slate-400 block mb-1">Source String / Secret Seed</label>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={computeHashes}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-xs rounded-xl transition hover:brightness-110"
              >
                Compute Hashes
              </button>
            </div>

            {hashResults && (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-slate-950/80 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                    <span>SHA-256</span>
                    <button type="button" onClick={() => copyText(hashResults.sha256, 'h-256')} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      {copiedKey === 'h-256' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === 'h-256' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-cyan-300 break-all">{hashResults.sha256}</div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                    <span>SHA-512</span>
                    <button type="button" onClick={() => copyText(hashResults.sha512, 'h-512')} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      {copiedKey === 'h-512' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === 'h-512' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-violet-300 break-all text-[11px]">{hashResults.sha512}</div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                    <span>UUID v4 Identifier</span>
                    <button type="button" onClick={() => copyText(hashResults.uuid, 'h-uuid')} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      {copiedKey === 'h-uuid' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === 'h-uuid' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-emerald-300 break-all">{hashResults.uuid}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. TOOLCHAIN & PORTS */}
        {activeTab === 'env-toolchain' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">{isRtl ? 'بيئة التشغيل المحلية والمنافذ' : 'Local Toolchain & Active Developer Ports'}</h4>
                <p className="text-xs text-slate-400">{isRtl ? 'قراءات حقيقية مباشرة من النظام بدون أي بيانات مصطنعة.' : 'Real live system readings directly from local environment.'}</p>
              </div>
              <button
                type="button"
                onClick={() => { loadToolchain(); loadPorts(); }}
                disabled={toolchainLoading}
                className="px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs flex items-center gap-1.5 hover:bg-cyan-500/25 transition"
              >
                <span className={toolchainLoading ? 'animate-spin' : ''}>↻</span>
                <span>{isRtl ? 'تحديث الفحص' : 'Refresh Telemetry'}</span>
              </button>
            </div>

            {/* Toolchain Table */}
            <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-950/80 border-b border-white/[0.08] text-xs font-semibold text-white">
                {isRtl ? 'أدوات ومترجمات البرمجة' : 'Installed Compilers & Runtimes'}
              </div>
              <div className="divide-y divide-white/[0.04]">
                {toolchainData.map((item) => (
                  <div key={item.tool} className="px-4 py-3 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${item.available ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <strong className="text-white capitalize">{item.tool}</strong>
                      {item.available && (
                        <span className="text-cyan-300 text-[11px] bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          {item.version}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px] truncate max-w-sm">
                      {item.primaryPath || (isRtl ? 'غير متوفر في المسار' : 'Not found in PATH')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Port Observatory */}
            <div className="bg-slate-900/40 border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-950/80 border-b border-white/[0.08] text-xs font-semibold text-white flex items-center justify-between">
                <span>{isRtl ? 'المنافذ قيد الاستماع (Listening TCP)' : 'Active Listening Ports (TCP)'}</span>
                <span className="text-[11px] text-slate-400 font-mono">{portsData.length} ports</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
                {portsData.map((p, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-300 font-bold">Port {p.port}</span>
                      <span className="text-slate-500 text-[11px]">({p.address})</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      PID: {p.processId ?? '—'}
                    </div>
                  </div>
                ))}
                {portsData.length === 0 && (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    {isRtl ? 'لا توجد منافذ استماع نشطة ملتقطة.' : 'No active listening ports captured.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. SCRIPT VAULT */}
        {activeTab === 'vault' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">{isRtl ? 'خزينة الأوامر والوصفات الجاهزة' : 'Script Vault & Verified Engineering Recipes'}</h4>
                <p className="text-xs text-slate-400">{isRtl ? 'وصفات تشخيصية دقيقة قابلة للنسخ أو المراجعة المباشرة بدون مخاطر.' : 'Exact diagnostic recipes with exact script preview and one-click copy.'}</p>
              </div>
              {!isUnlocked && (
                <button
                  type="button"
                  onClick={onUnlockRequest}
                  className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-medium transition"
                >
                  {isRtl ? 'فتح الوصول الكامل' : 'Unlock Pro Recipes'}
                </button>
              )}
            </div>

            {!isUnlocked ? (
              <div className="p-8 bg-slate-900/40 border border-white/[0.08] rounded-2xl text-center max-w-lg mx-auto space-y-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mx-auto">
                  <Database size={24} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white mb-1">
                    {isRtl ? 'خزينة الوصفات المتقدمة مقفلة' : 'Pro Engineering Recipes Protected'}
                  </h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isRtl
                      ? 'الأدوات الأساسية (مختبر الأكواد، مسبار HTTP، التشفير، والمنافذ) متاحة مجاناً. تتطلب الخزينة التحقق من مفتاح المحطة.'
                      : 'Basic tools (Code Lab, HTTP Probe, Crypto Hash, Toolchain & Ports) are unlocked. Pro recipes require station key.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onUnlockRequest}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-cyan-500/10 hover:brightness-110 transition"
                >
                  {isRtl ? 'إدخال مفتاح المحطة' : 'Enter Station Key'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RECIPES.map((r) => (
                  <div key={r.id} className="bg-slate-900/40 border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <strong className="text-xs font-bold text-white">{r.title}</strong>
                        <button
                          type="button"
                          onClick={() => copyText(r.cmd, r.id)}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-mono"
                        >
                          {copiedKey === r.id ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedKey === r.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">{r.desc}</p>
                    </div>
                    <pre className="p-2.5 bg-slate-950/90 border border-white/10 rounded-xl text-xs font-mono text-cyan-200 overflow-x-auto">
                      {r.cmd}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
