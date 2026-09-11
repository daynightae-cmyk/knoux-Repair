import type { ServiceDefinition } from '../../data/family-map';
import * as LucideIcons from 'lucide-react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ServiceCardProps {
  service: ServiceDefinition;
  toolCount: number;
  active: boolean;
  onClick: () => void;
  lang: 'en' | 'ar';
  accentColor?: string;
}

export default function ServiceCard({ service, toolCount, active, onClick, lang, accentColor }: ServiceCardProps) {
  const isRtl = lang === 'ar';
  const name = isRtl ? service.name.ar : service.name.en;
  const purpose = isRtl ? service.purpose.ar : service.purpose.en;
  const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[service.icon] ?? LucideIcons.Wrench;
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      className="knoux-service-card"
      data-active={active}
      onClick={onClick}
      aria-pressed={active}
      style={active ? {
        borderColor: accentColor ? `color-mix(in srgb, ${accentColor} 55%, transparent)` : undefined,
        boxShadow: accentColor ? `0 18px 44px color-mix(in srgb, ${accentColor} 16%, transparent), inset 0 1px 0 rgba(255,255,255,.1)` : undefined,
      } : undefined}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="knoux-service-card-top">
        <div
          className="knoux-service-card-icon"
          style={{ color: active ? accentColor || 'var(--knoux-violet)' : undefined }}
        >
          <Icon size={21} />
        </div>
        <div className="knoux-service-card-count">
          <strong>{toolCount}</strong>
          <span>{isRtl ? 'أداة' : 'tools'}</span>
        </div>
      </div>
      <h4>{name}</h4>
      <p>{purpose}</p>
      <div className="knoux-service-card-action">
        <span>{active ? (isRtl ? 'الخدمة النشطة' : 'Active service') : (isRtl ? 'فتح الخدمة' : 'Open service')}</span>
        <Arrow size={15} />
      </div>
    </button>
  );
}
