import { useEffect, useRef, useState } from 'react';
import { Circle, Cpu, HardDrive, ShieldCheck, Activity, Terminal, Radar, Zap, Server, Boxes, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import type { FamilyId } from '../../data/family-map';
import { api } from '../../lib/api';
import type { SystemSnapshot, BridgeTool, ExecutionMode, AdvancedSoftwarePreview, BridgeHealth } from '../../lib/api';

export interface SentinelTask {
  runId: string;
  tool: BridgeTool;
  mode: ExecutionMode;
  status: 'running' | 'success' | 'error' | 'cancelled' | 'inconclusive';
}

export interface SentinelPanelProps {
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  activeFamily: FamilyId | null;
  activeTasks: SentinelTask[];
  systemSnapshot?: SystemSnapshot | null;
  activeView?: string;
  aiProviderState?: 'CHECKING' | 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'ERROR';
  selectedTarget?: string | null;
  evidenceCount?: number | null;
  findingsCount?: number | null;
}

type ProbeState = 'idle' | 'checking' | 'online' | 'partial' | 'offline';
type DeepProbeState = 'idle' | 'loading' | 'ready' | 'unavailable';

export default function SentinelPanel({
  lang,
  bridgeOnline,
  activeFamily,
  activeTasks,
  systemSnapshot,
  activeView,
  aiProviderState = 'UNCONFIGURED',
  selectedTarget,
  evidenceCount,
  findingsCount,
}: SentinelPanelProps) {
  const isRtl = lang === 'ar';
  const isAiScan = activeView === 'ai-scan' || (!activeFamily && activeView !== 'home');
  const [liveSystem, setLiveSystem] = useState<SystemSnapshot | null>(systemSnapshot ?? null);
  const [apiHealth, setApiHealth] = useState<BridgeHealth | null>(null);
  const [developerToolCount, setDeveloperToolCount] = useState<number | null>(null);
  const [sonarToolCount, setSonarToolCount] = useState<number | null>(null);
  const [developerPreview, setDeveloperPreview] = useState<AdvancedSoftwarePreview | null>(null);
  const [developerProbeState, setDeveloperProbeState] = useState<DeepProbeState>('idle');
  const [sonarAiConfigured, setSonarAiConfigured] = useState<boolean | null>(null);
  const [probeState, setProbeState] = useState<ProbeState>('idle');
  const [probeLatency, setProbeLatency] = useState<number | null>(null);
  const [lastProbeAt, setLastProbeAt] = useState<number | null>(null);
  const probeTimer = useRef<number | null>(null);
  const developerProbeGeneration = useRef(0);
  const isWorkbench = activeFamily === 'workbench';

  useEffect(() => {
    if (!systemSnapshot) return;
    setLiveSystem(systemSnapshot);
  }, [systemSnapshot]);

  useEffect(() => {
    if (!isWorkbench || bridgeOnline !== true) {
      setProbeState(bridgeOnline === false ? 'offline' : 'idle');
      return;
    }

    let mounted = true;
    const probe = async () => {
      const started = performance.now();
      if (mounted) setProbeState('checking');

      const [healthResult, developerToolsResult, sonarToolsResult, sonarResult, systemResult] = await Promise.allSettled([
        api.health(),
        api.categoryTools('12-Developer-Tools'),
        api.categoryTools('18-Project-Sonar'),
        api.sonarAiStatus(),
        api.system(),
      ]);

      if (!mounted) return;

      const successful = [healthResult, developerToolsResult, sonarToolsResult, sonarResult, systemResult]
        .filter(result => result.status === 'fulfilled').length;

      if (healthResult.status === 'fulfilled') setApiHealth(healthResult.value);
      if (developerToolsResult.status === 'fulfilled') setDeveloperToolCount(developerToolsResult.value.tools.length);
      if (sonarToolsResult.status === 'fulfilled') setSonarToolCount(sonarToolsResult.value.tools.length);
      if (sonarResult.status === 'fulfilled') setSonarAiConfigured(sonarResult.value.configured);
      if (systemResult.status === 'fulfilled') setLiveSystem(systemResult.value.system);

      setProbeLatency(Math.round(performance.now() - started));
      setLastProbeAt(Date.now());
      setProbeState(successful === 5 ? 'online' : successful > 0 ? 'partial' : 'offline');
      probeTimer.current = window.setTimeout(() => void probe(), 8000);
    };

    void probe();

    return () => {
      mounted = false;
      if (probeTimer.current) window.clearTimeout(probeTimer.current);
    };
  }, [bridgeOnline, isWorkbench]);

  useEffect(() => {
    if (!isWorkbench || bridgeOnline !== true) {
      developerProbeGeneration.current += 1;
      setDeveloperPreview(null);
      setDeveloperProbeState('idle');
    }
  }, [bridgeOnline, isWorkbench]);

  const runDeveloperDeepProbe = async () => {
    if (!isWorkbench || bridgeOnline !== true || developerProbeState === 'loading') return;
    const generation = developerProbeGeneration.current + 1;
    developerProbeGeneration.current = generation;
    setDeveloperProbeState('loading');
    try {
      const response = await api.advancedSoftwarePreview();
      if (developerProbeGeneration.current !== generation) return;
      setDeveloperPreview(response.preview);
      setDeveloperProbeState('ready');
    } catch {
      if (developerProbeGeneration.current !== generation) return;
      setDeveloperPreview(null);
      setDeveloperProbeState('unavailable');
    }
  };

  const system = liveSystem;

  const memoryUsedGB = system && system.TotalRamGB && system.FreeRamGB
    ? Math.max(0, system.TotalRamGB - system.FreeRamGB)
    : null;
  const memoryPercent = system && system.TotalRamGB && memoryUsedGB !== null
    ? Math.round((memoryUsedGB / system.TotalRamGB) * 100)
    : null;

  const sysDrive = system?.Drives?.find(d => d.IsSystem || d.Name === system.SystemDrive) ?? system?.Drives?.[0];
  const diskPercent = sysDrive && sysDrive.TotalGB
    ? Math.round(((sysDrive.TotalGB - sysDrive.FreeGB) / sysDrive.TotalGB) * 100)
    : null;

  const getHealthStatus = () => {
    if (bridgeOnline === false) return { text: isRtl ? 'الجسر غير متصل' : 'Bridge Offline', color: 'text-red-500' };
    if (bridgeOnline === null) return { text: isRtl ? 'جارٍ الاتصال...' : 'Connecting...', color: 'text-amber-400' };
    if (activeTasks.some(t => t.status === 'running')) return { text: isRtl ? 'مهمة قيد التشغيل' : 'Active Job', color: 'text-cyan-400' };

    const isHighDisk = diskPercent !== null && diskPercent > 90;
    const isHighMemory = memoryPercent !== null && memoryPercent > 90;
    const isHighCpu = system?.CpuLoad !== undefined && system.CpuLoad > 90;
    const isDefenderOff = system?.DefenderRealtime === false;

    if (isHighDisk || isHighMemory || isHighCpu || isDefenderOff) {
      return { text: isRtl ? 'تنبيه مطلوب' : 'Attention Required', color: 'text-amber-400' };
    }

    return { text: isRtl ? 'النظام جاهز' : 'Ready', color: 'text-emerald-400' };
  };

  const health = getHealthStatus();
  const availableDevRuntimes = developerPreview
    ? developerPreview.DeveloperTools.filter(item => item.Available).length
    : null;

  if (isAiScan) {
    const aiStatusText = aiProviderState === 'CONFIGURED' ? 'AI — CONFIGURED' : aiProviderState === 'CHECKING' ? 'AI — CHECKING' : aiProviderState === 'UNAVAILABLE' ? 'AI — UNAVAILABLE' : 'AI — OFF';
    const aiDetailText = aiProviderState === 'CONFIGURED' ? (isRtl ? 'الميزات الذكية مفعلة' : 'AI features active') : (isRtl ? 'الميزات الذكية معطلة' : 'AI features disabled');
    const bridgeStatusText = bridgeOnline === true ? (isRtl ? 'متصل' : 'CONNECTED') : bridgeOnline === false ? (isRtl ? 'غير متصل' : 'OFFLINE') : (isRtl ? 'لم يُفحص' : 'NOT CHECKED');
    const bridgeDetailText = bridgeOnline === true ? (isRtl ? 'الجسر متصل' : 'Bridge connected') : (isRtl ? 'غير متصل' : 'Not connected');
    const evidenceStatusText = findingsCount !== null && findingsCount !== undefined
      ? (findingsCount === 0 ? (isRtl ? 'سليم' : 'CLEAN') : `${findingsCount} ${isRtl ? 'نتائج' : findingsCount === 1 ? 'FINDING' : 'FINDINGS'}`)
      : (isRtl ? 'لا يوجد' : 'NONE');
    const evidenceDetailText = evidenceCount
      ? (isRtl ? `تم توثيق ${evidenceCount} مصادر` : `${evidenceCount} sources verified`)
      : (isRtl ? 'لا توجد نتائج فحص' : 'No scan results');

    return (
      <aside className="knoux-sentinel w-[280px] h-full flex flex-col bg-[#040817]/85 backdrop-blur-xl border-l border-white/10 shrink-0 select-none" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Sentinel Live Context Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-bold tracking-wider text-white flex items-center gap-1.5">
              <span>KNOUX SENTINEL</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-medium">{isRtl ? 'السياق المباشر' : 'LIVE CONTEXT'}</span>
            </h2>
          </div>
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse" />
        </div>

        {/* Live Context Cards Stack Matching Reference */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {/* 1. KNOUX AI */}
          <div className="knoux-sentinel-card group hover:border-violet-500/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/35 flex items-center justify-center text-violet-400 shrink-0">
              <Zap size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label">KNOUX AI</span>
              <strong className="knoux-sentinel-card-val">{aiStatusText}</strong>
              <small className="knoux-sentinel-card-sub">{aiDetailText}</small>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180">›</span>
          </div>

          {/* 2. PROVIDER */}
          <div className="knoux-sentinel-card group hover:border-cyan-500/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Server size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label">{isRtl ? 'المزود' : 'PROVIDER'}</span>
              <strong className="knoux-sentinel-card-val">{aiProviderState === 'CONFIGURED' ? 'LOCAL GATEWAY' : 'NONE'}</strong>
              <small className="knoux-sentinel-card-sub">{aiProviderState === 'CONFIGURED' ? (isRtl ? 'مزود متصل' : 'Active connection') : (isRtl ? 'غير مهيأ' : 'Not configured')}</small>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180">›</span>
          </div>

          {/* 3. SYSTEM BRIDGE */}
          <div className="knoux-sentinel-card group hover:border-cyan-500/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Cpu size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label">{isRtl ? 'جسر النظام' : 'SYSTEM BRIDGE'}</span>
              <strong className={clsx('knoux-sentinel-card-val', bridgeOnline === true ? 'text-emerald-400' : 'text-slate-200')}>
                {bridgeStatusText}
              </strong>
              <small className="knoux-sentinel-card-sub">{bridgeDetailText}</small>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180">›</span>
          </div>

          {/* 4. TARGET */}
          <div className="knoux-sentinel-card group hover:border-cyan-500/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Radar size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label">{isRtl ? 'الهدف' : 'TARGET'}</span>
              <strong className="knoux-sentinel-card-val">{selectedTarget ? selectedTarget.toUpperCase() : 'NONE'}</strong>
              <small className="knoux-sentinel-card-sub">{selectedTarget || (isRtl ? 'لم يُحدد هدف' : 'No target selected')}</small>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180">›</span>
          </div>

          {/* 5. SESSION */}
          <div className="knoux-sentinel-card group hover:border-cyan-500/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Terminal size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label">{isRtl ? 'الجلسة' : 'SESSION'}</span>
              <strong className="knoux-sentinel-card-val">NONE</strong>
              <small className="knoux-sentinel-card-sub">{isRtl ? 'لا توجد جلسة نشطة' : 'No active session'}</small>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180">›</span>
          </div>

          {/* 6. EVIDENCE */}
          <div className="knoux-sentinel-card group hover:border-cyan-500/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label">{isRtl ? 'الأدلة' : 'EVIDENCE'}</span>
              <strong className="knoux-sentinel-card-val">{evidenceStatusText}</strong>
              <small className="knoux-sentinel-card-sub">{evidenceDetailText}</small>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180">›</span>
          </div>

          {/* 7. GET STARTED */}
          <div className="knoux-sentinel-card is-get-started group hover:border-amber-500/40 transition-colors mt-1">
            <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <span className="text-sm">💡</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="knoux-sentinel-card-label text-amber-400/90">{isRtl ? 'ابدأ الآن' : 'GET STARTED'}</span>
              <p className="text-[10px] text-slate-300 leading-relaxed mt-1">
                {isRtl
                  ? 'صف مشكلة، أو اختر هدفاً، أو ابدأ الفحص الذكي لإطلاق قوة KNOUX الكاملة.'
                  : 'Describe an issue, choose a target, or start an AI scan to unlock the full power of KNOUX.'}
              </p>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs rtl:rotate-180 self-center">›</span>
          </div>

          {/* 8. Bottom Quote Card */}
          <div className="mt-auto p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div>
              <p className="text-[10.5px] italic text-slate-400">
                {isRtl ? '«أدوات دقيقة لمشاكل حقيقية.»' : '“Precision tools for real problems.”'}
              </p>
              <span className="block mt-1 font-mono text-[9px] font-bold tracking-[0.25em] text-slate-500">
                K N O U X
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Activity size={16} />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="knoux-sentinel w-[280px] h-full flex flex-col bg-black/30 backdrop-blur-xl border-l border-white/10 shrink-0" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">

        <div className="flex items-center gap-2">
          <Activity size={16} className="text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide text-white">
            {isRtl ? 'حارس نوكس' : 'KNOUX Sentinel'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{health.text}</span>
          <Circle size={8} className={clsx('fill-current animate-pulse', health.color)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {isRtl ? 'المقاييس الحية' : 'Live Telemetry'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 p-3 bg-white/5 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Cpu size={14} className="text-cyan-400" />
                <span>{isRtl ? 'المعالج' : 'CPU Load'}</span>
              </div>
              <div className="text-base font-semibold text-white">
                {system?.CpuLoad !== undefined ? `${system.CpuLoad}%` : (isRtl ? 'غير متوفر' : 'Not available')}
              </div>
            </div>

            <div className="flex flex-col gap-1 p-3 bg-white/5 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Activity size={14} className="text-violet-400" />
                <span>{isRtl ? 'الذاكرة' : 'Memory'}</span>
              </div>
              <div className="text-base font-semibold text-white">
                {memoryPercent !== null ? `${memoryPercent}%` : (isRtl ? 'غير متوفر' : 'Not available')}
              </div>
            </div>

            <div className="flex flex-col gap-1 p-3 bg-white/5 rounded-lg border border-white/5 col-span-2">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <HardDrive size={14} className="text-teal-400" />
                  <span>{isRtl ? 'القرص الرئيسي' : 'System Disk'} ({sysDrive?.Name || 'C:'})</span>
                </span>
                <span>{sysDrive ? `${sysDrive.FreeGB.toFixed(1)} GB ${isRtl ? 'متاح' : 'free'}` : ''}</span>
              </div>
              <div className="text-sm font-semibold text-white">
                {diskPercent !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          diskPercent > 90 ? 'bg-red-500' : diskPercent > 75 ? 'bg-amber-400' : 'bg-cyan-400'
                        )}
                        style={{ width: `${diskPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-300">{diskPercent}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">{isRtl ? 'غير متوفر' : 'Not available'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {system && (
          <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg border border-white/5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5">
                <ShieldCheck size={14} className={system.DefenderRealtime ? 'text-emerald-400' : 'text-amber-400'} />
                <span>Windows Defender</span>
              </span>
              <span className={clsx('font-medium', system.DefenderRealtime ? 'text-emerald-400' : 'text-amber-400')}>
                {system.DefenderRealtime
                  ? (isRtl ? 'الحماية نشطة' : 'Real-time On')
                  : (isRtl ? 'غير نشطة' : 'Disabled')}
              </span>
            </div>
            {system.Processes > 0 && (
              <div className="flex items-center justify-between text-gray-400 pt-1 border-t border-white/5">
                <span>{isRtl ? 'العمليات النشطة' : 'Processes'}</span>
                <span className="text-white font-mono">{system.Processes}</span>
              </div>
            )}
          </div>
        )}

        {isWorkbench && (
          <div className="flex flex-col gap-3" aria-live="polite">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Radar size={13} className="text-cyan-400" />
                {isRtl ? 'شبكة استشعار Sonar' : 'Sonar Sensor Mesh'}
              </h3>
              <span className="text-[10px] text-gray-500 font-mono">
                {lastProbeAt ? new Date(lastProbeAt).toLocaleTimeString() : '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Zap size={12} className="text-cyan-300" /> API latency</div>
                <b className="block mt-1 text-sm text-white">{probeLatency !== null ? `${probeLatency} ms` : '—'}</b>
                <small className="text-[9px] text-gray-500">{probeState === 'checking' ? (isRtl ? 'جارٍ القياس' : 'probing') : (isRtl ? 'آخر دورة' : 'last cycle')}</small>
              </div>

              <div className="p-2.5 rounded-lg border border-violet-500/20 bg-violet-500/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Server size={12} className="text-violet-300" /> Bridge health</div>
                <b className={clsx('block mt-1 text-sm', probeState === 'online' ? 'text-emerald-300' : probeState === 'partial' ? 'text-amber-300' : 'text-gray-300')}>
                  {probeState === 'online' ? 'ONLINE' : probeState === 'partial' ? 'PARTIAL' : probeState === 'checking' ? 'CHECKING' : probeState === 'offline' ? 'OFFLINE' : '—'}
                </b>
                <small className="text-[9px] text-gray-500">{apiHealth?.version || (isRtl ? 'غير متوفر' : 'unavailable')}</small>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Boxes size={12} className="text-blue-300" /> Developer Tools</div>
                <b className="block mt-1 text-sm text-white">{developerToolCount ?? '—'}</b>
                <small className="text-[9px] text-gray-500">{isRtl ? 'أداة مسجلة' : 'registered tools'}</small>
              </div>

              <div className="p-2.5 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Radar size={12} className="text-fuchsia-300" /> Project Sonar</div>
                <b className="block mt-1 text-sm text-white">{sonarToolCount ?? '—'}</b>
                <small className="text-[9px] text-gray-500">{isRtl ? 'أداة سونار' : 'registered tools'}</small>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void runDeveloperDeepProbe()}
              disabled={bridgeOnline !== true || developerProbeState === 'loading'}
              className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-left disabled:opacity-50"
            >
              <span>
                <span className="block text-[10px] text-gray-400">{isRtl ? 'فحص بيئات التطوير العميق' : 'Deep developer runtime probe'}</span>
                <b className="block mt-0.5 text-xs text-white">
                  {developerProbeState === 'loading'
                    ? (isRtl ? 'جارٍ الفحص…' : 'Scanning…')
                    : developerProbeState === 'ready'
                      ? `${availableDevRuntimes ?? 0} ${isRtl ? 'بيئة متاحة' : 'runtimes available'}`
                      : developerProbeState === 'unavailable'
                        ? (isRtl ? 'غير متاح' : 'Unavailable')
                        : (isRtl ? 'لم يُفحص بعد' : 'Not checked yet')}
                </b>
              </span>
              <RefreshCw size={13} className={developerProbeState === 'loading' ? 'animate-spin text-emerald-300' : 'text-emerald-400'} />
            </button>

            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>{isRtl ? 'AI Sonar' : 'Sonar AI'}: {sonarAiConfigured === true ? (isRtl ? 'مهيأ' : 'configured') : sonarAiConfigured === false ? (isRtl ? 'غير مهيأ' : 'not configured') : '—'}</span>
              <RefreshCw size={12} className={probeState === 'checking' ? 'animate-spin text-cyan-300' : 'text-gray-600'} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {isRtl ? 'المهام الجارية' : 'Active Tasks'}
          </h3>
          {activeTasks.length === 0 ? (
            <div className="text-xs text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5 flex items-center gap-2">
              <Terminal size={14} className="text-gray-500" />
              <span>{isRtl ? 'لا توجد مهام نشطة حالياً.' : 'No active tasks running.'}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeTasks.map((task) => (
                <div key={task.runId} className="text-xs p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-200 flex items-center justify-between">
                  <span className="font-medium truncate max-w-[170px]">
                    {isRtl ? task.tool.ArabicName : task.tool.EnglishName}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {isRtl ? 'سياق العمل' : 'Context Guidance'}
          </h3>
          <div className="text-xs text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5 leading-relaxed">
            {activeFamily === 'ai-scan' && (isRtl ? 'ابدأ بالفحص الذكي لتشخيص الحالة الشاملة للنظام وتلقي توصيات موجهة.' : 'Start with AI Scan for a full system health assessment and targeted repair steps.')}
            {activeFamily === 'vitality' && (isRtl ? 'راجع سلامة ملفات النظام ومراقبة الموارد وخطط الأداء.' : 'Review Windows file integrity, startup pressure, and resource stability.')}
            {activeFamily === 'recovery' && (isRtl ? 'استرداد المساحة وحذف الملفات المكررة والتحقق من نقاط الاستعادة.' : 'Reclaim drive capacity, isolate duplicate content, and verify restore points.')}
            {activeFamily === 'assurance' && (isRtl ? 'تدقيق الحماية واختبار الاتصال والتأكد من توقيع التعريفات.' : 'Audit firewall & Defender posture, network latency, and driver signatures.')}
            {activeFamily === 'software' && (isRtl ? 'إدارة بيئات التطوير، والتطبيقات المثبتة وتحديثات الحزم.' : 'Audit runtimes, installed software inventory, and winget packages.')}
            {activeFamily === 'workbench' && (isRtl ? 'منصة هندسة المشاريع وفحص التبعيات وتقارير سونار.' : 'Engineering workspace, project metadata mapping, and Project Sonar audits.')}
            {activeFamily === 'investigation' && (isRtl ? 'مختبر التشخيص العميق وسجلات الأحداث وفحص العمليات الحساسة.' : 'Forensic diagnostics, Windows event warnings, and service dependency logs.')}
            {!activeFamily && (isRtl ? 'النظام جاهز لتلقي أوامر الفحص والإصلاح.' : 'KNOUX Repair engine is ready for diagnosis and repair.')}
          </div>
        </div>
      </div>
    </aside>
  );
}
