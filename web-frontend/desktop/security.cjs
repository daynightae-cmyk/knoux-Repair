/**
 * KNOUX Repair — Electron security helpers (pure Node, no Electron dep).
 *
 * Kept dependency-free so the rules can be unit-tested outside Electron.
 * main.cjs is the only consumer in production.
 */
'use strict';

const path = require('node:path');

const EXTERNAL_PROTOCOL_ALLOWLIST = new Set(['https:', 'mailto:']);
const AUTH_START_PROVIDERS = new Set(['google', 'github', 'entra']);

/**
 * Strict navigation check: the target must share protocol, hostname AND port
 * with the local frontend origin. Prefix string comparison is NOT used.
 */
function isAllowedNavigation(targetUrl, frontendOrigin) {
  try {
    const target = new URL(targetUrl);
    const base = new URL(frontendOrigin);
    return (
      target.protocol === base.protocol &&
      target.hostname === base.hostname &&
      target.port === base.port
    );
  } catch {
    return false;
  }
}

/**
 * System-browser OAuth begins at one exact loopback bridge route. HTTP remains
 * forbidden everywhere else. The renderer sends only a random handoff id; no
 * OAuth secret or bridge capability token is placed in the URL.
 */
function isAllowedOAuthStartUrl(parsed) {
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.port !== '8787') return false;
  if (parsed.username || parsed.password || parsed.hash) return false;
  const match = parsed.pathname.match(/^\/api\/auth\/start\/([^/]+)$/);
  if (!match || !AUTH_START_PROVIDERS.has(match[1])) return false;
  const handoff = parsed.searchParams.get('handoff') || '';
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(handoff)) return false;
  for (const key of parsed.searchParams.keys()) if (key !== 'handoff') return false;
  return true;
}

/**
 * External URL gate for shell.openExternal. General external navigation allows
 * only https/mailto. The sole HTTP exception is the exact loopback OAuth start
 * route above, which immediately redirects in the system browser to a provider.
 */
function filterExternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (EXTERNAL_PROTOCOL_ALLOWLIST.has(parsed.protocol)) return targetUrl;
    if (isAllowedOAuthStartUrl(parsed)) return targetUrl;
    return null;
  } catch {
    return null;
  }
}

/**
 * Exception-safe asset path resolution for the local frontend server.
 * Malformed URI encoding (decodeURIComponent throws) yields
 * { ok: false, reason: 'BAD_ENCODING' } instead of crashing the process.
 * Traversal outside the root yields { ok: false, reason: 'OUTSIDE_ROOT' }.
 */
function resolveAssetPath(root, requestPath) {
  let relative;
  try {
    relative = decodeURIComponent(String(requestPath || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
  } catch {
    return { ok: false, reason: 'BAD_ENCODING' };
  }
  if (relative.includes('\0')) return { ok: false, reason: 'BAD_ENCODING' };
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relative);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    return { ok: false, reason: 'OUTSIDE_ROOT' };
  }
  return { ok: true, path: candidate };
}

module.exports = {
  EXTERNAL_PROTOCOL_ALLOWLIST,
  AUTH_START_PROVIDERS,
  isAllowedNavigation,
  isAllowedOAuthStartUrl,
  filterExternalUrl,
  resolveAssetPath,
};
