import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wrench, ShieldCheck, TriangleAlert, Layers3,
  HardDrive, RefreshCw, Play, CheckCircle2, AlertTriangle,
  XCircle, Download, History, FileText, Cpu, Search,
  FolderArchive, DatabaseZap
} from 'lucide-react';
import type {
  BridgeTool, ExecutionMode,
  DriverPreviewItem, DriversPreview,
  ToolRunConfirmation, ToolRunOptions
} from '../../../lib/api';
import { api } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary, StationOfflineState } from '../_shared';
import { startExecution, pollExecution } from '../_shared/StationExecutionController';
import {
  type DriverSummary, type DriverSignal, type StationHistoryEntry,
  summarizeDrivers, detectDriverSignals, stationTools,
  outcomeFromRun, filterDriversByQuery, filterDriversByClass
} from './driversModel';
import DriversHeroVisual from './DriversHeroVisual';

export interface DriversStationProps {
  lang: Lang;
  tools: BridgeTool[];
  toolStatuses: Record<string, string>;
  bridgeElevated: boolean;
  bridgeOnline: boolean | null;
  onRetryBridge: () => void;
  onToolStatus: (toolId: string, status: 'success' | 'error' | 'cancelled' | 'inconclusive' | 'running') => void;
}

type TabKey = 'overview' | 'review' | 'inventory' | 'classes' | 'problems' | 'export' | 'actions' | 'report' | 'history';

const COPY = {
  en: {
    eyebrow: 'DEVICE DRIVER & HARDWARE LAB',
    title: 'Driver Management & Hardware Interface',
    subtitle: 'Audit device drivers, verify digital signatures, diagnose Device Manager problem codes, and backup third-party packages.',
    tabOverview: 'Overview',
    tabReview: 'Requiring Attention',
    tabInventory: 'Driver Inventory',
    tabClasses: 'Device Classes',
    tabProblems: 'Device Problems',
    tabExport: 'Driver Backup (DV03)',
    tabActions: 'Driver Tools',
    tabReport: 'Diagnostics Report',
    tabHistory: 'History',
    refresh: 'Query Drivers',
    refreshing: 'Inspecting device driver registry...',
    totalDrivers: 'Total Drivers',
    signedDrivers: 'Digitally Signed',
    unsignedDrivers: 'Unsigned Packages',
    thirdPartyDrivers: 'Third-Party / OEM',
    deviceProblems: 'Hardware Problem Codes',
    olderDateSignals: 'Legacy Drivers (>5 yrs)',
    quickInventory: 'Driver Inventory (DV01)',
    quickSignatures: 'Signature Audit (DV02)',
    quickExport: 'Export OEM Drivers (DV03)',
    signalsTitle: 'Driver Findings & Hardware Signals',
    noSignals: 'All hardware drivers are signed, verified, and operating without PnP problem codes.',
    reviewTitle: 'Drivers Requiring Engineering Review',
    reviewSubtitle: 'Drivers flagged for lack of digital signature, old release dates, or device problem codes.',
    noReviewNeeded: 'No drivers currently flagged for review.',
    inventoryTitle: 'Complete System Driver Inventory',
    inventorySubtitle: 'Live registry and PnP inventory of all active device drivers on this machine.',
    classesTitle: 'Device Class Distribution',
    classesSubtitle: 'Driver breakdown categorized by Windows hardware classification.',
    problemsTitle: 'Physical Device Problem Codes',
    problemsSubtitle: 'PnP devices currently in an error state in Windows Device Manager.',
    noProblems: 'Zero physical devices currently reporting Windows problem codes.',
    exportTitle: 'Third-Party Driver Export & Backup (DV03)',
    exportSubtitle: 'Export all non-Microsoft driver packages from the Driver Store into a portable backup folder via pnputil.',
    exportBtn: 'Export OEM Drivers',
    exportNotice: 'Requires administrator privileges. Driver packages will be exported to the Knoux Backups directory.',
    actionsTitle: 'Station 14 Tool Catalog',
    emptyHistory: 'No driver management tools executed yet in this session.',
    searchPlaceholder: 'Search drivers by device, provider, class or INF...',
    runTool: 'Execute Tool',
    adminRequired: 'Admin Required',
    deviceName: 'Device Name',
    provider: 'Provider',
    version: 'Version',
    date: 'Driver Date',
    inf: 'INF File',
    signed: 'Signed',
    unsigned: 'Unsigned',
  },
  ar: {
    eyebrow: 'مختبر تعريفات الأجهزة والعتاد',
    title: 'مركز إدارة التعريفات وواجهات العتاد',
    subtitle: 'تدقيق تعريفات الأجهزة، التحقق من التواقيع الرقمية، تشخيص رموز أعطال الأجهزة، وحفظ نسخ احتياطية لتعريفات OEM.',
    tabOverview: 'نظرة عامة',
    tabReview: 'تحتاج تدقيقاً',
    tabInventory: 'جرد التعريفات',
    tabClasses: 'فئات العتاد',
    tabProblems: 'مشاكل الأجهزة',
    tabExport: 'تصدير التعريفات (DV03)',
    tabActions: 'أدوات التعريفات',
    tabReport: 'تقرير التشخيص',
    tabHistory: 'السجل',
    refresh: 'فحص التعريفات',
    refreshing: 'جارٍ فحص سجلات التعريفات...',
    totalDrivers: 'إجمالي التعريفات',
    signedDrivers: 'موقعة رقمياً',
    unsignedDrivers: 'بدون توقيع رقمي',
    thirdPartyDrivers: 'تعريفات الطرف الثالث / OEM',
    deviceProblems: 'أجهزة برموز خطأ',
    olderDateSignals: 'تعريفات قديمة (>5 سنوات)',
    quickInventory: 'جرد التعريفات (DV01)',
    quickSignatures: 'تدقيق التواقيع (DV02)',
    quickExport: 'تصدير تعريفات OEM (DV03)',
    signalsTitle: 'ملاحظات التعريفات وإشارات العتاد',
    noSignals: 'كافة تعريفات الأجهزة موقعة رقمياً وتعمل بدون أي رموز أعطال في إدارة الأجهزة.',
    reviewTitle: 'التعريفات التي تحتاج تدقيقاً هندسياً',
    reviewSubtitle: 'التعريفات المحددة بسبب غياب التوقيع الرقمي، أو قِدم تاريخ الإصدار، أو ارتباطها بجهاز به عطل.',
    noReviewNeeded: 'لا توجد تعريفات تحتاج تدقيقاً حالياً.',
    inventoryTitle: 'جرد تعريفات النظام الكامل',
    inventorySubtitle: 'سجل حي لكافة تعريفات الأجهزة النشطة المثبتة على هذا الحاسوب.',
    classesTitle: 'توزيع فئات العتاد',
    classesSubtitle: 'توزيع التعريفات حسب التصنيف العتادي المعتمد في ويندوز.',
    problemsTitle: 'رموز أعطال الأجهزة الفعلية',
    problemsSubtitle: 'أجهزة PnP التي تسجل حالة خطأ حالياً في إدارة أجهزة ويندوز.',
    noProblems: 'لا توجد أجهزة تسجل أي رموز أعطال في إدارة الأجهزة حالياً.',
    exportTitle: 'تصدير وحفظ تعريفات الطرف الثالث (DV03)',
    exportSubtitle: 'تصدير كافة حزم التعريفات غير التابعة لمايكروسوفت من Driver Store إلى مجلد نسخ احتياطي عبر pnputil.',
    exportBtn: 'تصدير تعريفات OEM',
    exportNotice: 'يتطلب صلاحية المسؤول. سيتم تصدير حزم التعريفات إلى مجلد Backups الخاص بنظام Knoux.',
    actionsTitle: 'فهرس أدوات المحطة 14',
    emptyHistory: 'لم يتم تنفيذ أي أدوات تعريفات خلال هذه الجلسة بعد.',
    searchPlaceholder: 'بحث في التعريفات باسم الجهاز، المزود، الفئة أو ملف INF...',
    runTool: 'تنفيذ الأداة',
    adminRequired: 'يتطلب صلاحية المسؤول',
    deviceName: 'اسم الجهاز',
    provider: 'المزود',
    version: 'الإصدار',
    date: 'تاريخ التعريف',
    inf: 'ملف INF',
    signed: 'موثّق',
    unsigned: 'غير موثّق',
  },
};

export default function DriversStation(props: DriversStationProps) {
  return (
    <StationErrorBoundary lang={props.lang}>
      <DriversStationContent {...props} />
    </StationErrorBoundary>
  );
}

function DriversStationContent({
  lang,
  tools,
  toolStatuses,
  bridgeElevated,
  bridgeOnline,
  onRetryBridge,
  onToolStatus,
}: DriversStationProps) {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DriversPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [history, setHistory] = useState<StationHistoryEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);

  const availableStationTools = useMemo(() => stationTools(tools), [tools]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.driversPreview();
      if (res?.preview) {
        setPreview(res.preview);
      }
    } catch {
      // Retain null/existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bridgeOnline) {
      void loadPreview();
    }
  }, [bridgeOnline, loadPreview]);

  const summary = useMemo<DriverSummary>(() => {
    return summarizeDrivers(preview);
  }, [preview]);

  const signals = useMemo<DriverSignal[]>(() => {
    return detectDriverSignals(preview);
  }, [preview]);

  const allDrivers = useMemo(() => {
    const list: DriverPreviewItem[] = [];
    if (preview?.ReviewDrivers) list.push(...preview.ReviewDrivers);
    if (preview?.RecentInventory) {
      for (const d of preview.RecentInventory) {
        if (!list.some((existing) => existing.InfName === d.InfName)) {
          list.push(d);
        }
      }
    }
    return list;
  }, [preview]);

  const filteredInventory = useMemo(() => {
    let result = allDrivers;
    if (selectedClass !== 'ALL') {
      result = filterDriversByClass(result, selectedClass);
    }
    if (searchQuery.trim()) {
      result = filterDriversByQuery(result, searchQuery);
    }
    return result;
  }, [allDrivers, selectedClass, searchQuery]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            <Wrench size={14} />
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
            backgroundColor: '#059669',
            border: '1px solid #10b981',
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
          background: 'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.12), transparent 70%), rgba(15, 23, 42, 0.65)',
          borderRadius: 14,
          padding: 16,
          border: '1px solid rgba(16, 185, 129, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <DriversHeroVisual
          condition={summary.condition}
          totalDrivers={summary.totalDrivers}
          signedDrivers={summary.signedDrivers}
          unsignedDrivers={summary.unsignedDrivers}
          deviceProblemsCount={summary.deviceProblemsCount}
          lang={lang}
        />
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.totalDrivers}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
            {summary.totalDrivers}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Across {summary.classesCount} device classes</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.signedDrivers}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            {summary.signedDrivers}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>WHQL / Authenticode valid</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.thirdPartyDrivers}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {summary.thirdPartyDrivers}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>OEM Driver Store packages</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.deviceProblems}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: summary.deviceProblemsCount > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
            {summary.deviceProblemsCount}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {summary.deviceProblemsCount > 0 ? 'PnP problem codes flagged' : 'No device errors'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'overview', label: t.tabOverview, icon: ShieldCheck },
          { key: 'review', label: t.tabReview, icon: TriangleAlert },
          { key: 'inventory', label: t.tabInventory, icon: DatabaseZap },
          { key: 'classes', label: t.tabClasses, icon: Layers3 },
          { key: 'problems', label: t.tabProblems, icon: XCircle },
          { key: 'export', label: t.tabExport, icon: Download },
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
                background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                color: isActive ? '#10b981' : '#94a3b8',
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
            {tools.find((t) => t.ToolId === 'DV01') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DV01')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#047857',
                  border: '1px solid #10b981',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickInventory}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'DV02') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DV02')!, 'analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#0284c7',
                  border: '1px solid #38bdf8',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Play size={13} />
                <span>{t.quickSignatures}</span>
              </button>
            )}
            {tools.find((t) => t.ToolId === 'DV03') && (
              <button
                type="button"
                onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DV03')!, 'repair')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  background: '#4f46e5',
                  border: '1px solid #6366f1',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={13} />
                <span>{t.quickExport}</span>
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
                      borderLeft: `4px solid ${sig.level === 'CRITICAL' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#38bdf8'}`,
                    }}
                  >
                    <AlertTriangle size={16} color={sig.level === 'CRITICAL' ? '#ef4444' : sig.level === 'MEDIUM' ? '#f59e0b' : '#38bdf8'} />
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
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid #10b981',
                          color: '#10b981',
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

      {/* Tab 2: Requiring Attention */}
      {activeTab === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.reviewTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.reviewSubtitle}</p>
          </div>

          {(!preview?.ReviewDrivers || preview.ReviewDrivers.length === 0) ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: 8, padding: 24, textAlign: 'center', color: '#10b981', fontSize: 13 }}>
              <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto' }} />
              <div>{t.noReviewNeeded}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
              {preview.ReviewDrivers.map((driver) => (
                <div
                  key={driver.InfName}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                      {driver.DeviceName}
                    </h4>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: driver.Signed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: driver.Signed ? '#10b981' : '#ef4444',
                      }}
                    >
                      {driver.Signed ? t.signed : t.unsigned}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    <strong>{t.provider}:</strong> {driver.Provider} ({driver.ProviderGroup})
                  </div>
                  <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                    <strong>{t.version}:</strong> {driver.Version || '—'} • <strong>{t.inf}:</strong> {driver.InfName}
                  </div>
                  {driver.DriverDate && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      <strong>{t.date}:</strong> {driver.DriverDate} {driver.AgeYears ? `(${driver.AgeYears} yrs)` : ''}
                    </div>
                  )}

                  {driver.ReviewSignals?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {driver.ReviewSignals.map((signal) => (
                        <span key={signal} style={{ fontSize: 10, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: 4 }}>
                          ⚠️ {signal}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Driver Inventory */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.inventoryTitle}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                Showing {filteredInventory.length} driver package(s)
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '6px 12px',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <option value="ALL">All Device Classes</option>
                {preview?.ClassSummary?.map((c) => (
                  <option key={c.Class} value={c.Class}>
                    {c.Class} ({c.Count})
                  </option>
                ))}
              </select>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '6px 12px 6px 30px',
                    color: '#fff',
                    fontSize: 12,
                    minWidth: 240,
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {filteredInventory.slice(0, 48).map((driver) => (
              <div
                key={driver.InfName}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                    {driver.DeviceName}
                  </span>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: driver.Signed ? '#064e3b' : '#7f1d1d', color: driver.Signed ? '#6ee7b7' : '#fca5a5' }}>
                    {driver.Signed ? t.signed : t.unsigned}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{driver.Provider} • {driver.DeviceClass}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{driver.InfName} • v{driver.Version || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Device Classes */}
      {activeTab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.classesTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.classesSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {preview?.ClassSummary?.map((c) => (
              <div
                key={c.Class}
                onClick={() => {
                  setSelectedClass(c.Class);
                  setActiveTab('inventory');
                }}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{c.Class}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Device Class</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{c.Count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Device Problems */}
      {activeTab === 'problems' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.problemsTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.problemsSubtitle}</p>
          </div>

          {(!preview?.DeviceProblems || preview.DeviceProblems.length === 0) ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: 8, padding: 24, textAlign: 'center', color: '#10b981', fontSize: 13 }}>
              <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto' }} />
              <div>{t.noProblems}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
              {preview.DeviceProblems.map((prob) => (
                <div
                  key={prob.DeviceId}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fca5a5' }}>{prob.Name}</h4>
                    <span style={{ fontSize: 10, background: '#7f1d1d', color: '#fca5a5', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      Code {prob.ErrorCode}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Status: {prob.Status}</div>
                  <div style={{ fontSize: 10, color: '#64748b', wordBreak: 'break-all' }}>Device ID: {prob.DeviceId}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Export Backup */}
      {activeTab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.exportTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>{t.exportSubtitle}</p>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: 8, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FolderArchive size={24} color="#6366f1" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                  {summary.thirdPartyDrivers} OEM Driver Packages Ready for Export
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t.exportNotice}</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              {tools.find((t) => t.ToolId === 'DV03') && (
                <button
                  type="button"
                  onClick={() => handleLaunchTool(tools.find((t) => t.ToolId === 'DV03')!, 'repair')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    background: '#4f46e5',
                    border: '1px solid #6366f1',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} />
                  <span>{t.exportBtn}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Actions */}
      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t.actionsTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>Category: 14-Driver-Management ({availableStationTools.length} tools)</p>
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
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>{tool.ToolId}</span>
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
                          : 'rgba(99, 102, 241, 0.15)',
                      color:
                        tool.RiskLevel === 'READ_ONLY'
                          ? '#10b981'
                          : '#818cf8',
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
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid #10b981',
                          borderRadius: 6,
                          color: '#10b981',
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
                        background: '#059669',
                        border: '1px solid #10b981',
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

      {/* Tab 8: Report */}
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
                station: '14-Driver-Management',
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

      {/* Tab 9: History */}
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
