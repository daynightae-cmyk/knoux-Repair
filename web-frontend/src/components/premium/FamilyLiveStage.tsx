import { AnimatePresence, motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Activity, ShieldCheck, Wifi, Layers3 } from 'lucide-react';
import type { BridgeTool, ExecutionMode } from '../../lib/api';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../data/family-map';
import type { ToolStatus, ConsoleEntry } from '../../types';
import ToolWorkspace from './ToolWorkspace';

interface FamilyLiveStageProps {
  family: FamilyDefinition;
  service: ServiceDefinition;
  selectedTool: BridgeTool | null;
  familyTools: BridgeTool[];
  serviceTools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  toolStatuses: Record<string, ToolStatus>;
  onRunTool: (tool: BridgeTool, mode?: ExecutionMode) => void;
  onCancelTool: () => void;
  onClearTool: () => void;
  onSelectService: (id: ServiceId) => void;
  consoleEntries?: ConsoleEntry[];
  activeToolId?: string | null;
}

export default function FamilyLiveStage({
  family,
  service,
  selectedTool,
  familyTools,
  serviceTools,
  lang,
  bridgeOnline,
  bridgeElevated,
  toolStatuses,
  onRunTool,
  onCancelTool,
  onClearTool,
  onSelectService,
  consoleEntries,
  activeToolId,
}: FamilyLiveStageProps) {
  const isRtl = lang === 'ar';
  const FamilyIcon = (LucideIcons as unknown as Record<string, React.ElementType>)[family.icon] ?? LucideIcons.Activity;
  const bridgeLabel = bridgeOnline === true
    ? (isRtl ? 'الجسر متصل' : 'Bridge online')
    : bridgeOnline === false
      ? (isRtl ? 'الجسر غير متصل' : 'Bridge offline')
      : (isRtl ? 'جارٍ فحص الجسر' : 'Checking bridge');

  return (
    <section className="knoux-live-stage" data-mode={selectedTool ? 'tool' : 'family'} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="knoux-stage-grid" aria-hidden="true" />
      <div className="knoux-stage-scanline" aria-hidden="true" />

      <header className="knoux-stage-header">
        <div className="knoux-stage-kicker">
          <Activity size={13} />
          <span>{isRtl ? 'منصة العمل الحية' : 'LIVE TOOL STAGE'}</span>
        </div>
        <div className="knoux-stage-context">
          <span>{isRtl ? family.name.ar : family.name.en}</span>
          <span className="knoux-stage-separator">/</span>
          <strong>{selectedTool ? (isRtl ? selectedTool.ArabicName : selectedTool.EnglishName) : (isRtl ? service.name.ar : service.name.en)}</strong>
        </div>
        <div className="knoux-stage-runtime">
          <span className={bridgeOnline === true ? 'is-online' : bridgeOnline === false ? 'is-offline' : 'is-pending'} />
          {bridgeLabel}
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {selectedTool ? (
          <motion.div
            key={selectedTool.ToolId}
            className="knoux-stage-tool"
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <ToolWorkspace
              tool={selectedTool}
              family={family}
              service={service}
              lang={lang}
              bridgeElevated={bridgeElevated}
              toolStatus={toolStatuses[selectedTool.ToolId] ?? 'idle'}
              onRun={(mode) => onRunTool(selectedTool, mode)}
              onCancel={onCancelTool}
              consoleEntries={consoleEntries}
              activeToolId={activeToolId}
              onBack={onClearTool}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`${family.id}-overview`}
            className="knoux-stage-family"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="knoux-stage-family-visual">
              <div className="knoux-stage-orbit orbit-one" />
              <div className="knoux-stage-orbit orbit-two" />
              <div className="knoux-stage-core">
                <FamilyIcon size={54} />
              </div>
              {family.services.map((entry, index) => {
                const EntryIcon = (LucideIcons as unknown as Record<string, React.ElementType>)[entry.icon] ?? LucideIcons.Wrench;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="knoux-stage-service-node"
                    data-active={entry.id === service.id}
                    style={{ '--node-angle': `${(360 / Math.max(family.services.length, 1)) * index}deg` } as React.CSSProperties}
                    onClick={() => onSelectService(entry.id)}
                    title={isRtl ? entry.name.ar : entry.name.en}
                  >
                    <EntryIcon size={18} />
                  </button>
                );
              })}
            </div>

            <div className="knoux-stage-family-copy">
              <span className="knoux-stage-overline">{isRtl ? 'مساحة عائلة تفاعلية' : 'INTERACTIVE FAMILY WORKSPACE'}</span>
              <h2>{isRtl ? family.name.ar : family.name.en}</h2>
              <p>{isRtl ? service.purpose.ar : service.purpose.en}</p>

              <div className="knoux-stage-facts">
                <div>
                  <Layers3 size={16} />
                  <strong>{familyTools.length}</strong>
                  <span>{isRtl ? 'أداة محمّلة' : 'loaded tools'}</span>
                </div>
                <div>
                  <ShieldCheck size={16} />
                  <strong>{family.services.length}</strong>
                  <span>{isRtl ? 'خدمات' : 'services'}</span>
                </div>
                <div>
                  <Wifi size={16} />
                  <strong>{serviceTools.length}</strong>
                  <span>{isRtl ? 'في الخدمة الحالية' : 'in active service'}</span>
                </div>
                <div>
                  <ShieldCheck size={16} />
                  <strong>{bridgeElevated ? (isRtl ? 'متوفر' : 'Yes') : (isRtl ? 'غير متوفر' : 'No')}</strong>
                  <span>{isRtl ? 'صلاحيات المسؤول' : 'elevated runtime'}</span>
                </div>
              </div>

              <div className="knoux-stage-hint">
                {isRtl
                  ? 'اختر بطاقة أداة بالأسفل لتحويل هذه المنصة فوراً إلى مساحة تنفيذ الأداة الحقيقية.'
                  : 'Select a tool card below and this same stage becomes its real execution workspace.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
