import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppWindow, ArrowRight, Check, CircleAlert, Download, FileText, LockKeyhole, RefreshCw, ShieldCheck, Wrench, X } from 'lucide-react';
import type { BridgeRun, BridgeTool, ExecutionMode, ToolRunOptions } from '../../../lib/api';
import { api, BridgeError } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { pickName } from '../../../lib/i18n';
import ExecutionConfirmDialog from '../../../components/ExecutionConfirmDialog';
import { StationErrorBoundary } from '../_shared';
import { appendHistory, buildRecommendations, diagnosePlan, emptyEvidence, stationTools, STATION04_TOOL_IDS } from './programsModel';

const SERVICE_GROUPS = [
  { key: 'inventory', labelEn: 'Application Inventory', labelAr: '???? ??????? ???????' },
  { key: 'startup', labelEn: 'Startup Programs', labelAr: '????? ??????' },
  { key: 'windowsApps', labelEn: 'Unnecessary Windows Apps', labelAr: '?????? Windows ??? ??????' },
  { key: 'cache', labelEn: 'Application Cache Cleanup', labelAr: '????? ????? ???????' },
  { key: 'orphan', labelEn: 'Orphaned App Data', labelAr: '?????? ????? ??????' },
  { key: 'repair', labelEn: 'Application Repair', labelAr: '????? ???????' },
  { key: 'associations', labelEn: 'File Associations', labelAr: '?????? ??????' },
  { key: 'features', labelEn: 'Windows Features', labelAr: '????? Windows' },
  { key: 'updates', labelEn: 'Installed Updates', labelAr: '????????? ?????' },
  { key: 'compatibility', labelEn: 'Compatibility & Troubleshooting', labelAr: '?????? ?????? ???????' },
];

export default function ProgramsStation({ lang, tools, toolStatuses, bridgeElevated, bridgeOnline }: {
  lang: Lang; tools: BridgeTool[]; toolStatuses: Record<string, string>; bridgeElevated: boolean; bridgeOnline: boolean | null; onRetryBridge: () => void;
}) {
  const text = {
    en: { eyebrow: 'PROGRAMS & APPS', title: 'Programs & Applications Center', subtitle: 'Installed applications, startup, updates, repair, and health.' },
    ar: { eyebrow: '??????? ??????????', title: '???? ????? ??????', subtitle: '???????? ????????? ????????? ??????? ?????????.' },
  }[lang] || { eyebrow: 'PROGRAMS', title: 'Programs & Applications', subtitle: '' };

  const station = useMemo(() => stationTools(tools), [tools]);
  const byId = useMemo(() => new Map(station.map((t) => [t.ToolId, t])), [station]);

  return (
    <StationErrorBoundary>
      <section className="service-app-shell">
        <header className="service-app-topbar">
          <div className="service-app-brand"><AppWindow size={20} /><h1>{text.title}</h1></div>
        </header>
        <div className="programs-station">
          <h2>{text.subtitle}</h2>
          <div className="programs-services-grid">
            {SERVICE_GROUPS.map((group) => (
              <article key={group.key} className="programs-service-card">
                <h3>{lang === 'ar' ? group.labelAr : group.labelEn}</h3>
                <p>Station 04 service: {group.key}</p>
              </article>
            ))}
          </div>
          <h3>Registered Tools ({STATION04_TOOL_IDS.length})</h3>
          <div className="network-ops">
            {station.map((tool) => (
              <article key={tool.ToolId} className="network-op">
                <header><span className="network-op-id">{tool.ToolId}</span><strong dir="auto">{pickName(tool, lang)}</strong></header>
                <p dir="auto">{tool.Purpose}</p>
                <dl><div><dt>Risk</dt><dd>{tool.RiskLevel}</dd></div></dl>
              </article>
            ))}
          </div>
        </div>
      </section>
    </StationErrorBoundary>
  );
}
