import * as LucideIcons from 'lucide-react';
import type { ServiceDefinition } from '../../data/family-map';
import { SERVICE_PREVIEW_CONFIG } from '../../data/family-preview-config';
import type { ToolStatus } from '../../types';

interface ServiceCoreVisualProps {
  service: ServiceDefinition;
  lang: 'en' | 'ar';
  toolCount: number;
  bridgeOnline: boolean | null;
  status: ToolStatus;
}

export default function ServiceCoreVisual({ service, lang, toolCount, bridgeOnline, status }: ServiceCoreVisualProps) {
  const isRtl = lang === 'ar';
  const config = SERVICE_PREVIEW_CONFIG[service.id];
  const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[service.icon] ?? LucideIcons.Wrench;
  const visibleSegments = bridgeOnline === true ? Math.min(toolCount, 12) : 0;
  const stateLabel = bridgeOnline === null ? (isRtl ? 'جارٍ التحقق' : 'CHECKING')
    : bridgeOnline === false ? (isRtl ? 'غير متصل' : 'OFFLINE')
      : status === 'running' ? (isRtl ? 'قيد التنفيذ' : 'RUNNING')
        : status === 'success' ? (isRtl ? 'مكتمل' : 'COMPLETED')
          : status === 'error' ? (isRtl ? 'فشل' : 'FAILED')
            : (isRtl ? 'جاهز' : 'READY');

  return <div className="knoux-service-core" data-state={status} data-bridge={bridgeOnline === true ? 'online' : bridgeOnline === false ? 'offline' : 'checking'}>
    <div className="knoux-service-core-orbit" aria-hidden="true">{Array.from({ length: visibleSegments }, (_, index) => <i key={index} style={{ '--segment-index': index, '--segment-count': Math.max(visibleSegments, 1) } as React.CSSProperties} />)}</div>
    <div className="knoux-service-core-ring knoux-service-core-ring-outer" aria-hidden="true" />
    <div className="knoux-service-core-ring knoux-service-core-ring-inner" aria-hidden="true" />
    <div className="knoux-service-core-center"><Icon size={38} aria-hidden="true" /><strong>{isRtl ? service.name.ar : service.name.en}</strong><span>{isRtl ? config.mode.ar : config.mode.en}</span></div>
    <div className="knoux-service-core-state" role="status"><b>{stateLabel}</b><span>{bridgeOnline === true ? `${toolCount} ${isRtl ? 'إجراء فعلي' : 'LOADED ACTIONS'}` : '—'}</span></div>
  </div>;
}
