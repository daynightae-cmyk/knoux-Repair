import type { FamilyDefinition } from '../../data/family-map';

interface HeroSectionProps {
  family: FamilyDefinition;
  totalTools: number;
  lang: 'en' | 'ar';
}

const FAMILY_VISUALS: Record<string, { gradient: string; svgMotif: string }> = {
  vitality: {
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 20% 60%, rgba(34,211,238,0.1) 0%, transparent 50%)',
    svgMotif: `<circle cx="85%" cy="40%" r="60" fill="none" stroke="rgba(124,58,237,0.2)" stroke-width="2"><animate attributeName="r" values="55;65;55" dur="4s" repeatCount="indefinite"/></circle><circle cx="85%" cy="40%" r="35" fill="none" stroke="rgba(34,211,238,0.15)" stroke-width="1.5"><animate attributeName="r" values="30;40;30" dur="3s" repeatCount="indefinite"/></circle>`,
  },
  recovery: {
    gradient: 'radial-gradient(ellipse 60% 60% at 75% 45%, rgba(6,182,212,0.12) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 25% 55%, rgba(6,182,255,0.08) 0%, transparent 50%)',
    svgMotif: `<rect x="78%" y="25%" width="40" height="12" rx="3" fill="rgba(6,182,212,0.15)"/><rect x="80%" y="40%" width="36" height="12" rx="3" fill="rgba(6,182,212,0.12)"/><rect x="76%" y="55%" width="44" height="12" rx="3" fill="rgba(6,182,212,0.1)"/>`,
  },
  assurance: {
    gradient: 'radial-gradient(ellipse 60% 60% at 80% 40%, rgba(16,185,129,0.1) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 30% 60%, rgba(34,211,238,0.06) 0%, transparent 50%)',
    svgMotif: `<path d="M85%,25% L92%,35% L85%,70% L78%,35% Z" fill="none" stroke="rgba(16,185,129,0.2)" stroke-width="2"/><circle cx="85%" cy="40%" r="45" fill="none" stroke="rgba(16,185,129,0.08)" stroke-width="1" stroke-dasharray="4 4"><animateTransform attributeName="transform" type="rotate" from="0 85% 40%" to="360 85% 40%" dur="20s" repeatCount="indefinite"/></circle>`,
  },
  software: {
    gradient: 'radial-gradient(ellipse 60% 60% at 80% 45%, rgba(168,85,247,0.1) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 20% 50%, rgba(124,58,237,0.06) 0%, transparent 50%)',
    svgMotif: `<rect x="78%" y="30%" width="20" height="20" rx="4" fill="rgba(168,85,247,0.12)" transform="rotate(15,88%,40%)"/><rect x="84%" y="38%" width="16" height="16" rx="3" fill="rgba(168,85,247,0.08)" transform="rotate(-10,92%,46%)"/>`,
  },
  workbench: {
    gradient: 'radial-gradient(ellipse 60% 60% at 78% 40%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 30% 60%, rgba(34,211,238,0.06) 0%, transparent 50%)',
    svgMotif: `<text x="80%" y="40%" font-family="JetBrains Mono, monospace" font-size="28" fill="rgba(124,58,237,0.15)">&lt;/&gt;</text>`,
  },
  investigation: {
    gradient: 'radial-gradient(ellipse 60% 60% at 80% 40%, rgba(59,130,246,0.12) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 25% 55%, rgba(34,211,238,0.08) 0%, transparent 50%)',
    svgMotif: `<circle cx="85%" cy="40%" r="30" fill="none" stroke="rgba(59,130,246,0.2)" stroke-width="2"/><line x1="90%" y1="55%" x2="95%" y2="65%" stroke="rgba(59,130,246,0.2)" stroke-width="3" stroke-linecap="round"/>`,
  },
};

export default function HeroSection({ family, totalTools, lang }: HeroSectionProps) {
  const visual = FAMILY_VISUALS[family.id] ?? FAMILY_VISUALS.vitality;

  return (
    <div className="knoux-hero relative" style={{ backgroundImage: visual.gradient }}>
      <div className="knoux-hero-content">
        <h1 className="knoux-hero-title">
          {lang === 'ar' ? family.name.ar : family.name.en}
        </h1>
        <p className="knoux-hero-subtitle">
          {lang === 'ar' ? family.tagline.ar : family.tagline.en}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="knoux-badge knoux-badge-safe">
            {totalTools} {lang === 'ar' ? 'أداة' : 'tools'}
          </span>
          <span className="text-xs" style={{ color: 'var(--knoux-text-faint)' }}>
            {family.services.length} {lang === 'ar' ? 'خدمات' : 'services'}
          </span>
        </div>
      </div>

      {/* Background SVG motif — decorative only */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: visual.svgMotif }}
      />
    </div>
  );
}
