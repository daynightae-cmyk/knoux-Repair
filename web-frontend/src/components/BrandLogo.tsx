interface BrandLogoProps {
  className?: string;
}

export default function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <span className={`knoux-brand-lockup ${className}`.trim()} aria-label="KNOUX Repair">
      <img
        className="knoux-brand-lockup__wide"
        src="/brand/knoux-repair-wordmark-wide.png"
        alt="KNOUX Repair"
        draggable={false}
      />
      <span className="knoux-brand-lockup__compact" aria-hidden="true">
        <img src="/brand/knoux-mark-crystal.png" alt="" draggable={false} />
      </span>
    </span>
  );
}
