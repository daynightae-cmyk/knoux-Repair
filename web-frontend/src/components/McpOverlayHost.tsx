import { useEffect, useState } from 'react';
import McpConnectionCenter from './McpConnectionCenter';
import type { Lang } from '../lib/i18n';

export const MCP_OPEN_EVENT = 'knoux:mcp-open';

export default function McpOverlayHost() {
  const params = new URLSearchParams(window.location.search);
  const [open, setOpen] = useState(params.get('mcp') === '1');
  const [lang, setLang] = useState<Lang>(() => localStorage.getItem('knoux-lang') === 'ar' ? 'ar' : 'en');
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const openCenter = () => setOpen(true);
    const storage = () => setLang(localStorage.getItem('knoux-lang') === 'ar' ? 'ar' : 'en');
    const observer = new MutationObserver(() => setLang(document.documentElement.lang === 'ar' ? 'ar' : 'en'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    window.addEventListener(MCP_OPEN_EVENT, openCenter);
    window.addEventListener('storage', storage);
    return () => {
      observer.disconnect();
      window.removeEventListener(MCP_OPEN_EVENT, openCenter);
      window.removeEventListener('storage', storage);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch('/api/health', { headers: { Accept: 'application/json' } })
      .then(response => { if (active) setBridgeOnline(response.ok); })
      .catch(() => { if (active) setBridgeOnline(false); });
    return () => { active = false; };
  }, [open]);

  return <McpConnectionCenter open={open} onClose={() => setOpen(false)} lang={lang} bridgeOnline={bridgeOnline} />;
}
