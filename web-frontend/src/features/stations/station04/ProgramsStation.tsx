import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppWindow, Network, RefreshCw, ShieldCheck } from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunOptions } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import { StationErrorBoundary } from '../_shared';

export default function ProgramsStation({ lang, tools, toolStatuses, bridgeElevated, bridgeOnline, onRetryBridge }: {
  lang: Lang; tools: BridgeTool[]; toolStatuses: Record<string, string>; bridgeElevated: boolean; bridgeOnline: boolean | null; onRetryBridge: () => void;
}) {
  const text = {
    en: { eyebrow: 'PROGRAMS & APPS', title: 'Programs & Applications Center', subtitle: 'Installed applications, startup, updates, and repair.' },
    ar: { eyebrow: '??????? ??????????', title: '???? ????? ??????', subtitle: '???????? ??????? ????????? ????????? ??????? ?????????.' },
  }[lang] || { eyebrow: 'PROGRAMS & APPS', title: 'Programs & Applications', subtitle: '' };

  return (
    <StationErrorBoundary>
      <section className="service-app-shell">
        <header className="service-app-topbar">
          <div className="service-app-brand"><AppWindow size={20} /><h1>{text.title}</h1></div>
        </header>
        <div className="programs-app-view">
          <h2>{text.subtitle || text.subtitle}</h2>
          <p>Station 04 covers: Inventory, Startup, Uninstall Residual, Shortcut Repair, Runtime Check, Windows Apps, Uninstaller Repair, Updates, Report.</p>
          <div className="network-ops">
            {tools.slice(0, 10).map((tool) => (
              <article key={tool.ToolId} className="network-op">
                <header><span className="network-op-id">{tool.ToolId}</span><strong dir="auto">{pickName(tool, lang)}</strong></header>
                <p dir="auto">{tool.Purpose}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </StationErrorBoundary>
  );
}
