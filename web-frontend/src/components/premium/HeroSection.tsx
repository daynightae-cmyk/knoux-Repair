import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Activity, CircleDot, Layers3, Radio, RotateCcw, ShieldCheck } from 'lucide-react';
import type { FamilyDefinition, ServiceDefinition } from '../../data/family-map';
import { FAMILY_PREVIEW_CONFIG, SERVICE_PREVIEW_CONFIG } from '../../data/family-preview-config';
import type { BridgeTool, SystemSnapshot } from '../../lib/api';
import type { ToolStatus } from '../../types';
import {
  VitalityHoloVisual,
  RecoveryHoloVisual,
  AssuranceHoloVisual,
  SoftwareHoloVisual,
  WorkbenchHoloVisual,
  InvestigationHoloVisual,
} from './HeroVisuals';

interface HeroSectionProps {
  family: FamilyDefinition;
  service: ServiceDefinition;
  selectedTool: BridgeTool | null;
  executionTool: BridgeTool | null;
  familyToolCount: number;
  serviceToolCount: number;
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  selectedToolStatus: ToolStatus;
  executionToolStatus: ToolStatus;
  systemSnapshot?: SystemSnapshot | null;
  onClearTool: () => void;
}

const TOOL_STATUS_LABEL: Record<ToolStatus, { en: string; ar: string }> = {
  idle: { en: 'Ready', ar: 'جاهز' },
  running: { en: 'Running', ar: 'قيد التشغيل' },
  success: { en: 'Completed', ar: 'مكتمل' },
  error: { en: 'Failed', ar: 'فشل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  inconclusive: { en: 'Inconclusive', ar: 'غير حاسم' },
};

function Scene({ family, lang, systemSnapshot }: Pick<HeroSectionProps, 'family' | 'lang' | 'systemSnapshot'>) {
  if (family.id === 'vitality') return <VitalityHoloVisual lang={lang} systemSnapshot={systemSnapshot} />;
  if (family.id === 'recovery') return <RecoveryHoloVisual lang={lang} />;
  if (family.id === 'assurance') return <AssuranceHoloVisual lang={lang} systemSnapshot={systemSnapshot} />;
  if (family.id === 'software') return <SoftwareHoloVisual lang={lang} />;
  if (family.id === 'workbench') return <WorkbenchHoloVisual lang={lang} />;
  return <InvestigationHoloVisual lang={lang} systemSnapshot={systemSnapshot} />;
}

export default function HeroSection({
  family,
  service,
  selectedTool,
  executionTool,
  familyToolCount,
  serviceToolCount,
  lang,
  bridgeOnline,
  bridgeElevated,
  selectedToolStatus,
  executionToolStatus,
  systemSnapshot,
  onClearTool,
}: HeroSectionProps) {
  const isRtl = lang === 'ar';
  const familyConfig = FAMILY_PREVIEW_CONFIG[family.id as keyof typeof FAMILY_PREVIEW_CONFIG];
  const serviceConfig = SERVICE_PREVIEW_CONFIG[service.id];
  const ServiceIcon = (LucideIcons as unknown as Record<string, React.ElementType>)[service.icon] ?? LucideIcons.Wrench;
  const hasSnapshot = Boolean(systemSnapshot) && ['vitality', 'assurance', 'investigation'].includes(family.id);
  const runtimeLabel = bridgeOnline === true
    ? (isRtl ? 'الجسر متصل' : 'Bridge connected')
    : bridgeOnline === false
      ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline')
      : (isRtl ? 'جارٍ فحص الجسر' : 'Checking bridge');

  const focusTool = executionTool?.ToolId && executionToolStatus === 'running' ? executionTool : selectedTool ?? executionTool;
  const focusStatus = focusTool?.ToolId === executionTool?.ToolId ? executionToolStatus : selectedToolStatus;
  const contextTitle = focusTool
    ? (isRtl ? focusTool.ArabicName : focusTool.EnglishName)
    : (isRtl ? service.name.ar : service.name.en);
  const contextId = focusTool?.ToolId ?? service.id;
  const truthLabel = hasSnapshot
    ? (isRtl ? 'لقطة نظام فعلية' : 'Live system snapshot')
    : (isRtl ? 'معاينة سياقية — دون قياسات مختلقة' : 'Context preview — no synthetic telemetry');
  const executionIsDifferent = Boolean(
    executionTool && selectedTool && executionTool.ToolId !== selectedTool.ToolId && executionToolStatus === 'running'
  );

  return (
    <section
      className="knoux-preview-hero knoux-command-preview"
      data-family={family.id}
      data-tool-selected={Boolean(selectedTool)}
      data-execution-active={executionToolStatus === 'running'}
      style={{
        '--preview-accent': serviceConfig?.accent ?? familyConfig.accent,
        '--preview-accent-rgb': serviceConfig?.accentRgb ?? familyConfig.accentRgb,
      } as React.CSSProperties}
      aria-labelledby={`family-${family.id}-title`}
    >
      <div className="knoux-preview-grid" aria-hidden="true" />
      <div className="knoux-preview-beam" aria-hidden="true" />

      <header className="knoux-preview-header">
        <div className="knoux-preview-eyebrow">
          <CircleDot size={12} />
          <span>{isRtl ? familyConfig.eyebrow.ar : familyConfig.eyebrow.en}</span>
        </div>
        <div className="knoux-preview-path" aria-live="polite">
          <span>{isRtl ? family.name.ar : family.name.en}</span>
          <b>/</b>
          <strong>{isRtl ? service.name.ar : service.name.en}</strong>
          {selectedTool && <><b>/</b><em>{selectedTool.ToolId}</em></>}
        </div>
        <div className="knoux-preview-runtime" data-state={bridgeOnline === true ? 'online' : bridgeOnline === false ? 'offline' : 'pending'}>
          <span aria-hidden="true" />
          {runtimeLabel}
        </div>
      </header>

      <div className="knoux-preview-body knoux-command-preview-body">
        <div className="knoux-preview-copy knoux-command-preview-copy">
          <span className="knoux-command-preview-kicker">{isRtl ? 'مساحة العمل الحية' : 'LIVE WORKSPACE'}</span>
          <h1 id={`family-${family.id}-title`}>
            <span>{isRtl ? family.name.ar : family.name.en}</span>
            <strong>{contextTitle}</strong>
          </h1>
          <p className="knoux-preview-description">
            {focusTool?.Purpose ?? (isRtl ? service.purpose.ar : service.purpose.en)}
          </p>

          <div className="knoux-command-status-strip">
            <div>
              <Layers3 size={14} />
              <span>{isRtl ? 'الخدمة' : 'SERVICE'}</span>
              <strong>{isRtl ? service.name.ar : service.name.en}</strong>
            </div>
            <div>
              <Activity size={14} />
              <span>{isRtl ? 'السياق' : 'CONTEXT'}</span>
              <strong>{contextId}</strong>
            </div>
            <div data-status={focusStatus}>
              <Radio size={14} />
              <span>{isRtl ? 'الحالة' : 'STATE'}</span>
              <strong>{isRtl ? TOOL_STATUS_LABEL[focusStatus].ar : TOOL_STATUS_LABEL[focusStatus].en}</strong>
            </div>
          </div>

          {executionIsDifferent && executionTool && (
            <div className="knoux-command-running-notice" role="status">
              <span aria-hidden="true" />
              <div>
                <small>{isRtl ? 'تنفيذ مستمر' : 'EXECUTION CONTINUES'}</small>
                <strong>{executionTool.ToolId} · {isRtl ? executionTool.ArabicName : executionTool.EnglishName}</strong>
              </div>
            </div>
          )}

          {selectedTool && (
            <button type="button" className="knoux-command-context-reset" onClick={onClearTool}>
              <RotateCcw size={13} />
              {isRtl ? 'العودة لسياق الخدمة' : 'Return to service context'}
            </button>
          )}
        </div>

        <motion.div
          key={`${family.id}-${service.id}-${focusTool?.ToolId ?? 'service'}-${focusStatus}`}
          className="knoux-preview-scene knoux-command-preview-scene"
          initial={{ opacity: 0, y: 8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="knoux-preview-scene-frame">
            <Scene family={family} lang={lang} systemSnapshot={systemSnapshot} />
          </div>

          <div className="knoux-preview-context-card">
            <div className="knoux-preview-context-icon"><ServiceIcon size={20} /></div>
            <div>
              <span>{focusTool ? (isRtl ? 'سياق التنفيذ / الأداة' : 'TOOL / EXECUTION CONTEXT') : (isRtl ? 'الخدمة المحددة' : 'SELECTED SERVICE')}</span>
              <strong>{contextTitle}</strong>
              <small>{isRtl ? serviceConfig.mode.ar : serviceConfig.mode.en}</small>
            </div>
            <b data-status={focusStatus}>{isRtl ? TOOL_STATUS_LABEL[focusStatus].ar : TOOL_STATUS_LABEL[focusStatus].en}</b>
          </div>

          <div className="knoux-preview-truth-badge" data-live={hasSnapshot}>
            <span aria-hidden="true" />
            {truthLabel}
          </div>
        </motion.div>
      </div>

      <footer className="knoux-command-preview-footer">
        <div><span>{isRtl ? 'أدوات العائلة' : 'FAMILY TOOLS'}</span><strong>{bridgeOnline === true ? familyToolCount : '—'}</strong></div>
        <div><span>{isRtl ? 'أدوات الخدمة' : 'SERVICE TOOLS'}</span><strong>{bridgeOnline === true ? serviceToolCount : '—'}</strong></div>
        <div><ShieldCheck size={13} /><span>{isRtl ? 'صلاحيات المسؤول' : 'ELEVATED'}</span><strong>{bridgeOnline === true ? (bridgeElevated ? (isRtl ? 'متاح' : 'YES') : (isRtl ? 'لا' : 'NO')) : '—'}</strong></div>
      </footer>
    </section>
  );
}
