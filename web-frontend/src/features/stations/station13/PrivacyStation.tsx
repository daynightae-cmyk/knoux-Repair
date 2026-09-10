import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Lock, EyeOff, Camera, Mic,
  MapPin, RefreshCw, Play, CheckCircle2, AlertTriangle,
  Trash2, History, FileText, UserCheck, Activity
} from 'lucide-react';
import type {
  BridgeTool, ExecutionMode, PrivacyPreview,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type PrivacySummary, type PrivacySignal, type StationHistoryEntry,
  summarizePrivacy, detectPrivacySignals, stationTools,
  outcomeFromRun, filterSettingsByCategory
} from './privacyModel';
import PrivacyHeroVisual from './PrivacyHeroVisual';

export interface PrivacyStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'permissions' | 'activity' | 'personalization' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'PRIVACY CONTROL & TELEMETRY POSTURE',
    title: 'Privacy Control Center',
    subtitle: 'Audit Windows privacy controls, inspect camera/mic/location app permissions, and clear user activity footprints.',
    tabOverview: 'Overview',
    tabPermissions: 'App Permissions',
    tabActivity: 'Activity & Footprint',
    tabPersonalization: 'Personalization & Ads',
    tabActions: 'Privacy Tools',
    tabReport: 'Privacy Audit',
    tabHistory: 'History',
    refresh: 'Query Privacy',
    refreshing: 'Reading privacy registry...',
    stanceLabel: 'Privacy Stance',
    totalSettings: 'Audited Controls',
    restrictedCount: 'Controls Hardened',
    allowedCount: 'Active / Permitted',
    runHistoryCount: 'Run Dialog Traces',
    dnsCacheCount: 'DNS Cache Queries',
    quickAudit: 'Audit Privacy (PR01)',
    quickClearRun: 'Clear Run History (PR02)',
    quickFlushDns: 'Flush DNS Cache (PR03)',
    signalsTitle: 'Privacy Findings & Exposure Vectors',
    noSignals: 'All privacy vectors and permissions are operating within standard hardened baseline.',
    permissionsTitle: 'Hardware & Sensor App Permissions',
    permissionsSubtitle: 'Audited state of Windows CapabilityAccessManager consent store (Camera, Mic, Location).',
    activityTitle: 'User Activity & Execution Footprints',
    activitySubtitle: 'Cached command lines in Explorer RunMRU and local DNS resolver destinations.',
    clearRunDialogTitle: 'Clear RunMRU Dialog History (PR02)',
    clearRunDialogDesc: 'Removes cached command histories stored in registry HKCU Explorer RunMRU with safe pre-action JSON backup.',
    clearRunDialogBtn: 'Clear Run History',
    flushDnsTitle: 'Flush DNS Privacy Cache (PR03)',
    flushDnsDesc: 'Clears the local Windows DNS resolver cache to prevent local inspection of resolved domain names.',
    flushDnsBtn: 'Flush DNS Cache',
    personalizationTitle: 'Advertising & Diagnostics Telemetry',
    personalizationSubtitle: 'Telemetry policies, advertising identifiers, and tailored customer experience settings.',
    actionsTitle: 'Station 13 Tool Catalog',
    emptyHistory: 'No privacy operations executed yet in this session.',
    stateLabel: 'State',
    categoryLabel: 'Category',
    detailLabel: 'Registry Detail',
    runTool: 'Execute Tool',
    adminRequired: 'Admin Required',
  },
  ar: {
    eyebrow: 'مركز التحكم بالخصوصية والبيانات',
    title: 'مركز حماية الخصوصية والأثر الرقمي',
    subtitle: 'تدقيق خيارات الخصوصية في ويندوز، فحص أذونات الكاميرا والميكروفون والموقع، ومسح آثار الأنشطة المحلية.',
    tabOverview: 'نظرة عامة',
    tabPermissions: 'أذونات التطبيقات',
    tabActivity: 'النشاط والأثر المحلي',
    tabPersonalization: 'التخصيص والإعلانات',
    tabActions: 'أدوات الخصوصية',
    tabReport: 'تدقيق الخصوصية',
    tabHistory: 'السجل',
    refresh: 'فحص الخصوصية',
    refreshing: 'جارٍ قراءة سجلات الخصوصية...',
    stanceLabel: 'مستوى الخصوصية',
    totalSettings: 'الإعدادات المفحوصة',
    restrictedCount: 'الخيارات المحمية',
    allowedCount: 'الخيارات المفتوحة',
    runHistoryCount: 'آثار نافذة التشغيل',
    dnsCacheCount: 'استعلامات مخزن DNS',
    quickAudit: 'تدقيق الخصوصية (PR01)',
    quickClearRun: 'مسح سجل التشغيل (PR02)',
    quickFlushDns: 'مسح ذاكرة DNS (PR03)',
    signalsTitle: 'ملاحظات الخصوصية ومسارات التعرض',
    noSignals: 'كافة إعدادات الخصوصية والأذونات تعمل ضمن المستوى القياسي المحكم.',
    permissionsTitle: 'أذونات المستشعرات والأجهزة',
    permissionsSubtitle: 'الحالة المدققة لمتجر أذونات ويندوز CapabilityAccessManager (الكاميرا، المايك، الموقع).',
    activityTitle: 'النشاط المحلي والأثر الرقمي',
    activitySubtitle: 'الأوامر المخزنة في RunMRU بمستكشف ويندوز وعناوين خوادم DNS المحلية.',
    clearRunDialogTitle: 'مسح سجل أوامر نافذة التشغيل (PR02)',
    clearRunDialogDesc: 'إزالة سجل الأوامر المنفذة من سجل النظام مع إنشاء نسخة احتياطية آمنة JSON قبل الإزالة.',
    clearRunDialogBtn: 'مسح سجل الأوامر',
    flushDnsTitle: 'مسح مخزن DNS للخصوصية (PR03)',
    flushDnsDesc: 'تفريغ الذاكرة المؤقتة لمحلل DNS المحلي لمنع كشف أسماء النطاقات والمواقع التي تمت زيارتها.',
    flushDnsBtn: 'تفريغ مخزن DNS',
    personalizationTitle: 'التخصيص ومحددات التشخيص الإعلانية',
    personalizationSubtitle: 'سياسات جمع بيانات التشخيص، المعرف الإعلاني، وإعدادات التجارب المخصصة.',
    actionsTitle: 'فهرس أدوات المحطة 13',
    emptyHistory: 'لم يتم تنفيذ أي أدوات خصوصية خلال هذه الجلسة بعد.',
    stateLabel: 'الحالة',
    categoryLabel: 'الفئة',
    detailLabel: 'تفاصيل السجل',
    runTool: 'تنفيذ الأداة',
    adminRequired: 'يتطلب صلاحية المسؤول',
  },
};

export default function PrivacyStation(props: PrivacyStationProps) {
  return (
    <StationErrorBoundary lang={props.lang}>
      <PrivacyStationContent {...props} />
    </StationErrorBoundary>
  );
}

function PrivacyStationContent({
  lang,
  tools,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: PrivacyStationProps) {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PrivacyPreview | null>(null);
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);

  const availableStationTools = useMemo(() => stationTools(tools), [tools]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.privacyPreview();
      if (res?.preview) {
        setPreview(res.preview);
      }
    } catch {
      // Preview will remain null or previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bridgeOnline) {
      void loadPreview();
    }
  }, [bridgeOnline, loadPreview]);

  const summary = useMemo<PrivacySummary>(() => {
    return summarizePrivacy(preview);
  }, [preview]);

  const signals = useMemo<PrivacySignal[]>(() => {
    return detectPrivacySignals(preview);
  }, [preview]);

  const appPermissions = useMemo(() => {
    return filterSettingsByCategory(preview?.Settings || [], 'App permissions');
  }, [preview]);

  const activitySettings = useMemo(() => {
    return filterSettingsByCategory(preview?.Settings || [], 'Activity');
  }, [preview]);

  const personalizationSettings = useMemo(() => {
    return filterSettingsByCategory(preview?.Settings || [], 'Personalization').concat(
      filterSettingsByCategory(preview?.Settings || [], 'Policy')
    );
  }, [preview]);

  const handleLaunchTool = (tool: BridgeTool, mode: ExecutionMode = 'analyze') => {
    setPendingTool({ tool, mode });
  };

  const handleConfirmRun = async (options?: ToolRunOptions, confirmation?: ToolRunConfirmation) => {
    if (!pendingTool) return;
    const { tool, mode } = pendingTool;
    setPendingTool(null);

    try {
      onToolStatus(tool.ToolId, 'running');
      const runId = await startExecution({ tool, mode, options, confirmation });
      const finalRun = await pollExecution(runId);

      const outcome = outcomeFromRun(finalRun.result);
      onToolStatus(
        tool.ToolId,
        outcome === 'SUCCESS' ? 'success' : outcome === 'WARNING' ? 'inconclusive' : 'error'
      );

      const newEntry: StationHistoryEntry = {
        id: `${tool.ToolId}-${Date.now()}`,
        toolId: tool.ToolId,
        toolName: pickName(tool, lang),
        timestamp: new Date().toLocaleTimeString(),
        status: outcome,
        itemsProcessed: finalRun.result?.itemsProcessed || 0,
        summary: finalRun.result?.output?.slice(0, 180) || 'Execution completed.',
      };
      setHistory((prev) => [newEntry, ...prev]);

      void loadPreview();
    } catch {
      onToolStatus(tool.ToolId, 'error');
    }
  };

  if (bridgeOnline === false) {
    return (
      <StationOfflineState
        lang={lang}
        reason="BRIDGE_DISCONNECTED"
        onRetry={onRetryBridge}
      />
    );
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#06b6d4', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            <Lock size={14} />
            <span>{t.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 6px 0', color: '#f8fafc' }}>
            {t.title}
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, maxWidth: 680, lineHeight: 1.5 }}>
            {t.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            backgroundColor: '#0891b2',
            border: '1px solid #06b6d4',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? t.refreshing : t.refresh}</span>
        </button>
      </div>

      {/* Hero Visual Block */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.12), transparent 70%), rgba(15, 23, 42, 0.65)',
          borderRadius: 14,
          padding: 16,
          border: '1px solid rgba(6, 182, 212, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <PrivacyHeroVisual
          stance={summary.stance}
          totalSettings={summary.totalSettings}
          restrictedCount={summary.restrictedCount}
          runHistoryCount={summary.runHistoryCount}
          dnsCacheCount={summary.dnsCacheCount}
          lang={lang}
        />
      </div>

      {/* Metric Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.restrictedCount}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            {summary.restrictedCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>of {summary.totalSettings} monitored settings</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.allowedCount}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: summary.allowedCount > 4 ? '#f59e0b' : '#38bdf8', marginTop: 4 }}>
            {summary.allowedCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Permitted access vectors</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.runHistoryCount}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: summary.runHistoryCount > 0 ? '#fbbf24' : '#10b981', marginTop: 4 }}>
            {summary.runHistoryCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Explorer RunMRU traces</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.dnsCacheCount}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#a855f7', marginTop: 4 }}>
            {summary.dnsCacheCount !== null ? summary.dnsCacheCount : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Resolved domain traces</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'overview', label: t.tabOverview, icon: ShieldCheck },
          { key: 'permissions', label: t.tabPermissions, icon: UserCheck },
          { key: 'activity', label: t.tabActivity, icon: Activity },
          { key: 'personalization', label: t.tabPersonalization, icon: EyeOff },
          { key: 'actions', label: t.tabActions, icon: Play },
          { key: 'report', label: t.tabReport, icon: FileText },
          { key: 'history', label: t.tabHistory, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #06b6d4' : '2px solid transparent',
                color: isActive ? '#06b6d4' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {tools.find((t) => t.ToolId === 'PR01') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'PR01')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#0e7490',
                  border: '1px solid #06b6d4',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickAudit}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'PR02') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'PR02')!, 'repair')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#b45309',
                  border: '1px solid #f59e0b',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={13} />
                <span>{t.quickClearRun}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'PR03') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'PR03')!, 'repair')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#4338ca',
                  border: '1px solid #6366f1',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                <span>{t.quickFlushDns}</span>
              </button>
            )}
          </div>

          {/* Signals */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: '#e2e8f0' }}>
              {t.signalsTitle}
            </h3>
            {signals.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontSize: 13 }}>
                <CheckCircle2 size={16} />
                <span>{t.noSignals}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {signals.map((sig) => (
                  <div
                    key={sig.code}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 12,
                      background: 'rgba(2, 6, 23, 0.6)',
                      borderRadius: 8,
                      borderLeft: `4px solid ${sig.level === 'HIGH' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#06b6d4'}`,
                    }}
                  >
                    <AlertTriangle size={16} color={sig.level === 'HIGH' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#06b6d4'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                        {lang === 'ar' ? sig.messageAr : sig.messageEn}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Source: {sig.evidenceSource} • Suggested Tool: {sig.suggestedTool}
                      </div>
                    </div>
                    {tools.find((t) => t.ToolId === sig.suggestedTool) && (
                      <button
                        type="button"
                        onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === sig.suggestedTool)!, 'analyze')}
                        style={{
                          background: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid #06b6d4',
                          color: '#06b6d4',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t.runTool}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: App Permissions */}
      {activeTab === 'permissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.permissionsTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.permissionsSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {appPermissions.map((s) => {
              const state = (s.State || '').toLowerCase();
              const isRestricted = state === 'restricted' || state === 'denied' || state === 'disabled';
              return (
                <div
                  key={s.Id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid #1e293b',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.Id === 'cameraAccess' && <Camera size={16} color="#38bdf8" />}
                      {s.Id === 'microphoneAccess' && <Mic size={16} color="#a855f7" />}
                      {s.Id === 'locationAccess' && <MapPin size={16} color="#10b981" />}
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>{s.Name}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 8,
                        background: isRestricted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isRestricted ? '#10b981' : '#f59e0b',
                        border: `1px solid ${isRestricted ? '#10b981' : '#f59e0b'}`,
                      }}
                    >
                      {s.State || 'Unknown'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.Detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Activity & Footprint */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.activityTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.activitySubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={18} color="#f59e0b" />
                <h4 style={{ margin: 0, fontSize: 14, color: '#f8fafc' }}>{t.clearRunDialogTitle}</h4>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                {t.clearRunDialogDesc}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
                  {summary.runHistoryCount} entries detected
                </span>
                {tools.find((t) => t.ToolId === 'PR02') && (
                  <button
                    type="button"
                    onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'PR02')!, 'repair')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      background: '#b45309',
                      border: '1px solid #f59e0b',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t.clearRunDialogBtn}</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RefreshCw size={18} color="#a855f7" />
                <h4 style={{ margin: 0, fontSize: 14, color: '#f8fafc' }}>{t.flushDnsTitle}</h4>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                {t.flushDnsDesc}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#c084fc', fontWeight: 600 }}>
                  {summary.dnsCacheCount !== null ? `${summary.dnsCacheCount} queries cached` : 'DNS cache ready'}
                </span>
                {tools.find((t) => t.ToolId === 'PR03') && (
                  <button
                    type="button"
                    onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'PR03')!, 'repair')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      background: '#6b21a8',
                      border: '1px solid #a855f7',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>{t.flushDnsBtn}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 10 }}>
            {activitySettings.map((s) => (
              <div
                key={s.Id}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{s.Name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.Detail}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{s.State}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Personalization */}
      {activeTab === 'personalization' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.personalizationTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.personalizationSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {personalizationSettings.map((s) => (
              <div
                key={s.Id}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{s.Name}</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#cbd5e1' }}>
                    {s.State}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.Detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Actions */}
      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.actionsTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>Category: 13-Privacy ({availableStationTools.length} tools)</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
            {availableStationTools.map((tool) => (
              <div
                key={tool.ToolId}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#06b6d4' }}>{tool.ToolId}</span>
                    <h4 style={{ margin: '2px 0 0 0', fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                      {pickName(tool, lang)}
                    </h4>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background:
                        tool.RiskLevel === 'READ_ONLY'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : tool.RiskLevel === 'DESTRUCTIVE'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        tool.RiskLevel === 'READ_ONLY'
                          ? '#10b981'
                          : tool.RiskLevel === 'DESTRUCTIVE'
                          ? '#ef4444'
                          : '#f59e0b',
                    }}
                  >
                    {tool.RiskLevel}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  {tool.Purpose || 'No description available.'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    {tool.RequiresAdmin ? t.adminRequired : 'User Execution'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {tool.AnalyzeOnlySupported && (
                      <button
                        type="button"
                        onClick={() => handleLaunchTool(tool, 'analyze')}
                        style={{
                          padding: '5px 10px',
                          background: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid #06b6d4',
                          borderRadius: 6,
                          color: '#06b6d4',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Analyze
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLaunchTool(tool, 'repair')}
                      style={{
                        padding: '5px 10px',
                        background: '#0891b2',
                        border: '1px solid #06b6d4',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Execute
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Report */}
      {activeTab === 'report' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#f8fafc' }}>{t.tabReport}</h3>
          <pre
            style={{
              background: '#030712',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: 12,
              color: '#38bdf8',
              fontFamily: 'monospace',
              fontSize: 11,
              overflowX: 'auto',
              maxHeight: 340,
            }}
          >
            {JSON.stringify(
              {
                station: '13-Privacy',
                summary,
                signals,
                preview,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* Tab 7: History */}
      {activeTab === 'history' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#f8fafc' }}>{t.tabHistory}</h3>
          {history.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 12 }}>{t.emptyHistory}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.5)',
                    padding: 10,
                    borderRadius: 6,
                    borderLeft: `3px solid ${entry.status === 'SUCCESS' ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                      {entry.toolId} — {entry.toolName}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{entry.summary}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: entry.status === 'SUCCESS' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {entry.status}
                    </span>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{entry.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Execution Confirmation Dialog */}
      {pendingTool && (
        <ExecutionConfirmDialog
          tool={pendingTool.tool}
          mode={pendingTool.mode}
          lang={lang}
          onCancel={() => setPendingTool(null)}
          onConfirm={(options, confirmation) => {
            void handleConfirmRun(options, confirmation);
          }}
        />
      )}
    </div>
  );
}
