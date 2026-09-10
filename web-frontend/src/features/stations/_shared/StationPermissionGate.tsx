import type { ReactNode } from 'react';
import type { Lang } from '../../../lib/i18n';

interface StationPermissionGateProps {
  lang: Lang;
  requiresAdmin: boolean;
  bridgeElevated: boolean;
  children: ReactNode;
}

/** StationPermissionGate — missing permission renders a requirement, never fake data. */
export default function StationPermissionGate({ lang, requiresAdmin, bridgeElevated, children }: StationPermissionGateProps) {
  if (requiresAdmin && !bridgeElevated) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center" role="status">
        <p className="font-mono text-[11px] text-amber-300 tracking-wider">
          {lang === 'ar' ? 'تتطلب صلاحية المدير' : 'Administrator permission required'}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
