import { useState, useEffect } from 'react';
import {
  Radar, Terminal, Code2, Lock, Unlock, ShieldCheck, ShieldAlert
} from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunOptions, ToolRunConfirmation, SystemSnapshot } from '../../../lib/api';
import { api } from '../../../lib/api';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../../types';
import PremiumGate from './PremiumGate';
import ProjectSonarStation from './ProjectSonarStation';
import DeveloperArsenal from './DeveloperArsenalStation';

export interface EngineeringWorkbenchStationProps {
  family: FamilyDefinition;
  familyTools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatuses: Record<string, ToolStatus>;
  activeService: ServiceDefinition;
  onSelectService: (id: ServiceId) => void;
  selectedTool: BridgeTool | null;
  onSelectTool: (id: string | null) => void;
  runningTool: BridgeTool | null;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode, options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => void;
  onCancelTool: () => void;
  onRetryBridge: () => void;
  systemSnapshot?: SystemSnapshot | null;
  consoleEntries?: ConsoleEntry[];
}

export type LockOutcome = 'NONE' | 'REVOKED' | 'LOCAL_LOCK_ONLY_SERVER_UNCONFIRMED' | 'BRIDGE_UNAVAILABLE';

export default function EngineeringWorkbenchStation(props: EngineeringWorkbenchStationProps) {
  const {
    lang,
    activeService,
    onSelectService,
    familyTools,
    toolStatuses,
    bridgeOnline,
    bridgeElevated,
    onRunTool,
  } = props;

  const isRtl = lang === 'ar';
  const [unlockedToken, setUnlockedToken] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [lockOutcome, setLockOutcome] = useState<LockOutcome>('NONE');
  const [showGateModal, setShowGateModal] = useState(false);

  // Validate any existing token on mount via backend revalidation
  useEffect(() => {
    let mounted = true;
    let storedToken: string | null = null;
    try {
      storedToken = sessionStorage.getItem('knoux-workbench-token') || null;
    } catch {
      storedToken = null;
    }

    if (!storedToken) {
      setUnlockedToken(null);
      setSessionChecked(true);
      return;
    }

    api.workbenchValidateSession(storedToken)
      .then((res) => {
        if (!mounted) return;
        if (res.valid) {
          setUnlockedToken(storedToken);
        } else {
          try { sessionStorage.removeItem('knoux-workbench-token'); } catch { /* ignore */ }
          setUnlockedToken(null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        // On error/offline, do not trust unverified string in storage
        try { sessionStorage.removeItem('knoux-workbench-token'); } catch { /* ignore */ }
        setUnlockedToken(null);
      })
      .finally(() => {
        if (mounted) setSessionChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Active operational world: '18-Project-Sonar' vs '12-Developer-Tools'
  const isSonar = activeService.id === '18-Project-Sonar';

  const handleUnlocked = (token: string) => {
    setUnlockedToken(token);
    setLockOutcome('NONE');
    try {
      sessionStorage.setItem('knoux-workbench-token', token);
    } catch {
      // ignore
    }
    setShowGateModal(false);
  };

  const handleLockStation = async () => {
    const tokenToRevoke = unlockedToken;
    setUnlockedToken(null);
    try {
      sessionStorage.removeItem('knoux-workbench-token');
    } catch {
      // ignore
    }

    if (tokenToRevoke) {
      try {
        const res = await api.workbenchLockStation(tokenToRevoke);
        if (res.ok && res.revoked) {
          setLockOutcome('REVOKED');
        } else {
          setLockOutcome('LOCAL_LOCK_ONLY_SERVER_UNCONFIRMED');
        }
      } catch {
        setLockOutcome('BRIDGE_UNAVAILABLE');
      }
    } else {
      setLockOutcome('REVOKED');
    }
    setTimeout(() => setLockOutcome('NONE'), 6000);
  };

  return (
    <div className="flex flex-col h-full bg-[#050714] text-white overflow-hidden rounded-2xl border border-white/[0.08]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Workbench Station Header Rail */}
      <div className="px-5 py-3 border-b border-white/[0.08] bg-slate-950/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <Code2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">
                {isRtl ? 'محطة هندسة البرمجيات المتكاملة' : 'Engineering Workbench Station'}
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-[10px] font-mono text-violet-300">
                PRO INTEL
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRtl ? 'بيئة العمليات الهندسية: سونار المشاريع ومختبر المطورين' : 'Unified Operations Station: Project Sonar & Developer Arsenal'}
            </p>
          </div>
        </div>

        {/* Operational World Switcher & Station Lock */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-white/[0.08] rounded-xl">
            <button
              type="button"
              onClick={() => onSelectService('18-Project-Sonar')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isSonar
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radar size={14} />
              <span>Project Sonar</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectService('12-Developer-Tools')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !isSonar
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal size={14} />
              <span>Developer Arsenal</span>
            </button>
          </div>

          {/* Lock state notification badge */}
          {lockOutcome === 'REVOKED' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-lg">
              <ShieldCheck size={12} />
              <span>{isRtl ? 'تم إلغاء الجلسة من الخادم بنجاح' : 'Server session revoked'}</span>
            </div>
          )}
          {lockOutcome === 'LOCAL_LOCK_ONLY_SERVER_UNCONFIRMED' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] rounded-lg">
              <ShieldAlert size={12} />
              <span>{isRtl ? 'قفل محلي فقط (لم يؤكد الخادم)' : 'Local lock only (server unconfirmed)'}</span>
            </div>
          )}
          {lockOutcome === 'BRIDGE_UNAVAILABLE' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] rounded-lg">
              <ShieldAlert size={12} />
              <span>{isRtl ? 'قفل محلي (الجسر غير متاح)' : 'Local lock (bridge unreachable)'}</span>
            </div>
          )}

          {unlockedToken ? (
            <button
              type="button"
              onClick={handleLockStation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 rounded-xl text-xs font-medium transition"
              title={isRtl ? 'قفل الوصول المتقدم للمحطة وإلغاء الجلسة' : 'Lock station and revoke server session'}
            >
              <Lock size={13} />
              <span>{isRtl ? 'قفل المحطة' : 'Lock Station'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowGateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 rounded-xl text-xs font-medium transition"
              title={isRtl ? 'فتح ميزات المحطة المتقدمة' : 'Unlock Pro station capabilities'}
            >
              <Unlock size={13} />
              <span>{isRtl ? 'فتح الميزات المميزة' : 'Unlock Pro'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Body - Open Access to Sonar and Arsenal */}
      <div className="flex-1 min-h-0 relative">
        {isSonar ? (
          <ProjectSonarStation
            lang={lang}
            tools={familyTools}
            bridgeOnline={bridgeOnline}
            bridgeElevated={bridgeElevated}
            onRunTool={onRunTool}
            isUnlocked={Boolean(unlockedToken)}
            sessionToken={unlockedToken}
            onUnlockRequest={() => setShowGateModal(true)}
          />
        ) : (
          <DeveloperArsenal
            lang={lang}
            tools={familyTools}
            toolStatuses={toolStatuses}
            bridgeOnline={bridgeOnline}
            bridgeElevated={bridgeElevated}
            onRunTool={onRunTool}
            isUnlocked={Boolean(unlockedToken)}
            sessionToken={unlockedToken}
            onUnlockRequest={() => setShowGateModal(true)}
          />
        )}
      </div>

      {/* Optional Pro Gate Modal */}
      {showGateModal && (
        <PremiumGate
          lang={lang}
          isUnlocked={Boolean(unlockedToken)}
          onUnlocked={handleUnlocked}
          onClose={() => setShowGateModal(false)}
        />
      )}
    </div>
  );
}
