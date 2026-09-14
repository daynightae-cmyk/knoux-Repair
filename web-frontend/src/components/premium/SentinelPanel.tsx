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
}

export default function SentinelPanel({
  lang,
  bridgeOnline,
  activeFamily,
  activeTasks,
  systemSnapshot
}: SentinelPanelProps) {
  const isRtl = lang === 'ar';
  const [liveSystem, setLiveSystem] = useState<SystemSnapshot | null>(systemSnapshot ?? null);
  const [apiHealth, setApiHealth] = useState<BridgeHealth | null>(null);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [developerPreview, setDeveloperPreview] = useState<AdvancedSoftwarePreview | null>(null);
  const [sonarAiConfigured, setSonarAiConfigured] = useState<boolean | null>(null);
  const [probeState, setProbeState] = useState<'idle' | 'checking' | 'online' | 'partial' | 'offline'>('idle');
  const [probeLatency, setProbeLatency] = useState<number | null>(null);
  const [lastProbeAt, setLastProbeAt] = useState<number | null>(null);
  const probeTimer = useRef<number | null>(null);
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
      const [healthResult, toolsResult, developerResult, sonarResult, systemResult] = await Promise.allSettled([
        api.health(),
        api.tools(),
        api.advancedSoftwarePreview(),
        api.sonarAiStatus(),
        api.system(),
      ]);
      if (!mounted) return;
      const successful = [healthResult, toolsResult, developerResult, sonarResult, systemResult]
        .filter(result => result.status === 'fulfilled').length;
      if (healthResult.status === 'fulfilled') setApiHealth(healthResult.value);
      if (toolsResult.status === 'fulfilled') setToolCount(toolsResult.value.tools.length);
      if (developerResult.status === 'fulfilled') setDeveloperPreview(developerResult.value.preview);
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
          <Circle size={8} className={clsx("fill-current animate-pulse", health.color)} />
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
                          "h-full rounded-full transition-all duration-500",
                          diskPercent > 90 ? "bg-red-500" : diskPercent > 75 ? "bg-amber-400" : "bg-cyan-400"
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
                <ShieldCheck size={14} className={system.DefenderRealtime ? "text-emerald-400" : "text-amber-400"} />
                <span>Windows Defender</span>
              </span>
              <span className={clsx("font-medium", system.DefenderRealtime ? "text-emerald-400" : "text-amber-400")}>
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
                  {probeState === 'online' ? 'ONLINE' : probeState === 'partial' ? 'PARTIAL' : probeState === 'checking' ? 'CHECKING' : '—'}
                </b>
                <small className="text-[9px] text-gray-500">{apiHealth?.version || (isRtl ? 'غير متوفر' : 'unavailable')}</small>
              </div>
              <div className="p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Boxes size={12} className="text-blue-300" /> Developer API</div>
                <b className="block mt-1 text-sm text-white">{toolCount !== null ? toolCount : '—'}</b>
                <small className="text-[9px] text-gray-500">{isRtl ? 'أداة مسجلة' : 'registered tools'}</small>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Activity size={12} className="text-emerald-300" /> Dev signals</div>
                <b className="block mt-1 text-sm text-white">{developerPreview ? developerPreview.DeveloperTools.filter(item => item.Available).length : '—'}</b>
                <small className="text-[9px] text-gray-500">{isRtl ? 'بيئات متاحة' : 'runtimes available'}</small>
              </div>
            </div>
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
