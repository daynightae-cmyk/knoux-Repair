import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { ArrowLeft, ArrowRight, Braces, CircleDot, Layers3, Radio, RotateCcw, ShieldCheck } from 'lucide-react';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../data/family-map';
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
  familyToolCount: number;
  serviceToolCount: number;
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatus: ToolStatus;
  systemSnapshot?: SystemSnapshot | null;
  onExplore: () => void;
  onOpenWorkspace: () => void;
  onClearTool: () => void;
  onSelectService: (id: ServiceId) => void;
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
  familyToolCount,
  serviceToolCount,
  lang,
  bridgeOnline,
  bridgeElevated,
  toolStatus,
  systemSnapshot,
  onExplore,
  onOpenWorkspace,
  onClearTool,
  onSelectService,
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
  const contextTitle = selectedTool
    ? (isRtl ? selectedTool.ArabicName : selectedTool.EnglishName)
    : (isRtl ? service.name.ar : service.name.en);
  const truthLabel = hasSnapshot
    ? (isRtl ? 'لقطة نظام فعلية' : 'Live system snapshot')
    : (isRtl ? 'معاينة سياقية — البيانات غير متصلة' : 'Context preview — runtime data not connected');

  return (
    <section
      className="knoux-preview-hero"
      data-family={family.id}
      data-tool-selected={Boolean(selectedTool)}
      style={{
        '--preview-accent': serviceConfig?.accent ?? familyConfig.accent,
        '--preview-accent-rgb': serviceConfig?.accentRgb ?? familyConfig.accentRgb,
      } as React.CSSProperties}
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-labelledby={`family-${family.id}-title`}
    >
      <div className="knoux-preview-grid" aria-hidden="true" />
      <div className="knoux-preview-beam" aria-hidden="true" />

      <header className="knoux-preview-header">
        <div className="knoux-preview-eyebrow">
          <CircleDot size={12} />
          <span>{isRtl ? familyConfig.eyebrow.ar : familyConfig.eyebrow.en}</span>
        </div>
        <div className="knoux-preview-runtime" data-state={bridgeOnline === true ? 'online' : bridgeOnline === false ? 'offline' : 'pending'}>
          <span aria-hidden="true" />
          {runtimeLabel}
        </div>
      </header>

      <div className="knoux-preview-body">
        <div className="knoux-preview-copy">
          <div className="knoux-preview-path" aria-live="polite">
            <span>{isRtl ? family.name.ar : family.name.en}</span>
            <b>/</b>
            <strong>{isRtl ? service.name.ar : service.name.en}</strong>
            {selectedTool && <><b>/</b><em>{selectedTool.ToolId}</em></>}
          </div>

          <h1 id={`family-${family.id}-title`}>
            <span>{isRtl ? family.name.ar : family.name.en}</span>
            <strong>{isRtl ? familyConfig.headline.ar : familyConfig.headline.en}</strong>
          </h1>

          <p className="knoux-preview-description">
            {selectedTool
              ? selectedTool.Purpose
              : (isRtl ? service.purpose.ar : service.purpose.en)}
          </p>

          <div className="knoux-preview-actions">
            <button type="button" className="knoux-preview-primary" onClick={selectedTool ? onOpenWorkspace : onExplore}>
              {selectedTool
                ? (isRtl ? 'فتح مساحة الأداة' : 'Open tool workspace')
                : (isRtl ? serviceConfig.action.ar : serviceConfig.action.en)}
              {isRtl ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
            </button>
            {selectedTool ? (
              <button type="button" className="knoux-preview-secondary" onClick={onClearTool}>
                <RotateCcw size={14} />
                {isRtl ? 'العودة للخدمة' : 'Back to service'}
              </button>
            ) : (
              <button type="button" className="knoux-preview-secondary" onClick={onExplore}>
                <Braces size={14} />
                {isRtl ? 'عرض الأدوات المتصلة' : 'View connected tools'}
              </button>
            )}
          </div>

          <div className="knoux-preview-truth-row">
            <div>
              <Layers3 size={14} />
              <strong>{bridgeOnline === true ? familyToolCount : '—'}</strong>
              <span>{isRtl ? 'أداة محمّلة' : 'loaded family tools'}</span>
            </div>
            <div>
              <Radio size={14} />
              <strong>{bridgeOnline === true ? serviceToolCount : '—'}</strong>
              <span>{isRtl ? 'في الخدمة النشطة' : 'in selected service'}</span>
            </div>
            <div>
              <ShieldCheck size={14} />
              <strong>{bridgeOnline === true ? (bridgeElevated ? (isRtl ? 'متاح' : 'Yes') : (isRtl ? 'لا' : 'No')) : '—'}</strong>
              <span>{isRtl ? 'تشغيل بصلاحيات مسؤول' : 'elevated runtime'}</span>
            </div>
          </div>
        </div>

        <motion.div
          key={`${family.id}-${service.id}-${selectedTool?.ToolId ?? 'service'}`}
          className="knoux-preview-scene"
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div className="knoux-preview-scene-frame">
            <Scene family={family} lang={lang} systemSnapshot={systemSnapshot} />
          </div>
          <div className="knoux-preview-context-card">
            <div className="knoux-preview-context-icon"><ServiceIcon size={20} /></div>
            <div>
              <span>{selectedTool ? (isRtl ? 'سياق الأداة المحددة' : 'SELECTED TOOL CONTEXT') : (isRtl ? 'الخدمة المحددة' : 'SELECTED SERVICE')}</span>
              <strong>{contextTitle}</strong>
              <small>{isRtl ? serviceConfig.mode.ar : serviceConfig.mode.en}</small>
            </div>
            {selectedTool && <b data-status={toolStatus}>{isRtl ? TOOL_STATUS_LABEL[toolStatus].ar : TOOL_STATUS_LABEL[toolStatus].en}</b>}
          </div>
          <div className="knoux-preview-truth-badge" data-live={hasSnapshot}>
            <span aria-hidden="true" />
            {truthLabel}
          </div>
        </motion.div>
      </div>

      <nav className="knoux-preview-service-switcher" aria-label={isRtl ? 'تغيير الخدمة النشطة' : 'Change active service'}>
        {family.services.map((entry) => {
          const EntryIcon = (LucideIcons as unknown as Record<string, React.ElementType>)[entry.icon] ?? LucideIcons.Wrench;
          const active = entry.id === service.id;
          return (
            <button key={entry.id} type="button" data-active={active} aria-pressed={active} onClick={() => onSelectService(entry.id)}>
              <EntryIcon size={15} />
              <span>{isRtl ? entry.name.ar : entry.name.en}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
