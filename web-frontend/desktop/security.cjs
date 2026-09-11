/**
 * KNOUX Repair — Electron security helpers (pure Node, no Electron dep).
 *
 * Kept dependency-free so the rules can be unit-tested outside Electron.
 * main.cjs is the only consumer in production.
 */
'use strict';

const path = require('node:path');

const EXTERNAL_PROTOCOL_ALLOWLIST = new Set(['https:', 'mailto:']);

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
 * External URL gate for shell.openExternal: only explicitly allow-listed
 * protocols may leave the app. Rejects file:, javascript:, data: and any
 * custom/untrusted scheme. Returns the URL when allowed, otherwise null.
 */
function filterExternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (!EXTERNAL_PROTOCOL_ALLOWLIST.has(parsed.protocol)) return null;
    return targetUrl;
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
  isAllowedNavigation,
  filterExternalUrl,
  resolveAssetPath,
};
