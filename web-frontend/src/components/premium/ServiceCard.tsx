import type { ServiceDefinition } from '../../data/family-map';
import * as LucideIcons from 'lucide-react';

interface ServiceCardProps {
  service: ServiceDefinition;
  toolCount: number;
  active: boolean;
  onClick: () => void;
  lang: 'en' | 'ar';
  accentColor?: string;
}

export default function ServiceCard({ service, toolCount, active, onClick, lang, accentColor }: ServiceCardProps) {
  const name = lang === 'ar' ? service.name.ar : service.name.en;
  const purpose = lang === 'ar' ? service.purpose.ar : service.purpose.en;

  // Dynamically resolve icon
  const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[service.icon] ?? LucideIcons.Wrench;

  return (
    <button
      type="button"
      className="knoux-service-card text-left flex-shrink-0 w-56"
      data-active={active}
      onClick={onClick}
      style={active ? {
        borderColor: accentColor ? `color-mix(in srgb, ${accentColor} 40%, transparent)` : undefined,
        boxShadow: accentColor ? `0 0 20px color-mix(in srgb, ${accentColor} 15%, transparent)` : undefined,
      } : undefined}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="p-2 rounded-lg"
          style={{
            background: active
              ? `color-mix(in srgb, ${accentColor || 'var(--knoux-violet)'} 12%, transparent)`
              : 'rgba(255,255,255,0.04)',
          }}
        >
          <Icon size={18} style={{ color: active ? accentColor || 'var(--knoux-violet)' : 'var(--knoux-text-muted)' }} />
        </div>
        <div>
          <h4 className="text-sm font-medium" style={{ color: active ? 'var(--knoux-text)' : 'var(--knoux-text-secondary)' }}>
            {name}
          </h4>
          <span className="text-[10px]" style={{ color: 'var(--knoux-text-faint)' }}>
            {toolCount} {lang === 'ar' ? 'أداة' : 'tools'}
          </span>
        </div>
      </div>
      <p className="text-xs line-clamp-2" style={{ color: 'var(--knoux-text-faint)' }}>
        {purpose}
      </p>
    </button>
  );
}
