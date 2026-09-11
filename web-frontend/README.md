# KNOUX Repair — Web Frontend

React 18 + TypeScript + Vite frontend for the KNOUX Repair local Windows maintenance workstation.

This application is **local-first**. The supported runtime does not use a fabricated demo backend: API requests are served by the real loopback execution bridge in `server/bridge.mjs`.

## Architecture

```text
Browser / Electron renderer
        |
        | same-origin /api (web gateway) or loopback bridge
        v
127.0.0.1 local gateway / bridge
        |
        | registered-tool allowlist
        v
PowerShell repair scripts + structured Reports evidence
```

Key runtime files:

- `src/` — React application.
- `src/lib/api.ts` — typed bridge API client.
- `server.ts` — localhost web gateway used by `npm run dev` and `npm start`; starts/reuses and proxies the real bridge.
- `server/bridge.mjs` — real Windows execution/evidence bridge; binds to `127.0.0.1` and launches only registered tools.
- `desktop/main.cjs` — Electron desktop runtime.
- `tests/` — frontend/domain tests.

## Install

```powershell
npm ci
```

## Development

```powershell
npm run dev
```

Open `http://127.0.0.1:3000`.

The gateway starts the real bridge if one is not already healthy. Admin-required tools still require a normally elevated Windows process; the application does not bypass UAC.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

The repository GitHub Actions workflow runs these checks on Windows and also verifies the .NET desktop build, bridge timeout behavior, and PowerShell functional suite.

## Production local server

After `npm run build`:

```powershell
npm start
```

The bundled local gateway serves `dist/` on `127.0.0.1:3000`, applies response security headers, and proxies `/api` to the real bridge on loopback.

## Electron

Development:

```powershell
npm run desktop:dev
```

Packaging:

```powershell
npm run desktop:package
```

Electron is configured with context isolation, disabled Node integration, renderer sandboxing, web security, external-navigation restrictions, loopback-only serving, and a Content Security Policy/security headers for the local frontend.

## Authentication

Optional authentication is configured on the bridge, not implemented as a fake frontend session.

See:

- `../.env.example`
- `.env.example`
- `../Docs/LOCAL-OAUTH-SETUP.md`
- `../Docs/SAFETY-MODEL.md`

When enabled, supported providers use OAuth state + PKCE; provider tokens remain in the local bridge and the browser receives an HttpOnly loopback session cookie.

## Product truth

Do not add hardcoded machine specifications, fake authenticated users, simulated successful repairs, fabricated duplicate groups, or fabricated Project Sonar results to runtime API paths. Preview/demo data belongs only in explicitly isolated test/fixture code and must never masquerade as evidence from the user's Windows machine.
