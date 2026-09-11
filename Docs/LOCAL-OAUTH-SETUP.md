# KNOUX Repair — Local OAuth setup

## Mission 00 contract

KNOUX Repair supports four authentication states:

- **Local Mode**: `KNOUX_AUTH_REQUIRED=false`; provider sign-in is optional.
- **Google**: Authorization Code + PKCE through the system browser.
- **GitHub**: Authorization Code + PKCE through the system browser.
- **Microsoft Entra ID**: Authorization Code + PKCE through the system browser.

The React renderer never receives provider access tokens, refresh tokens, client secrets, or API keys. Provider access tokens exist only long enough inside the local bridge to resolve the authenticated account profile, then they are discarded. The application session contains account metadata only.

## Exact callbacks

| Flow | Exact URI / origin |
|---|---|
| Frontend origin | `http://127.0.0.1:3000` |
| Google callback | `http://127.0.0.1:8787/api/auth/callback/google` |
| GitHub callback | `http://127.0.0.1:8787/api/auth/callback/github` |
| Microsoft Entra callback | `http://localhost:8787/api/auth/callback/entra` |
| Local bridge | `http://127.0.0.1:8787` |

Electron overrides `KNOUX_AUTH_FRONTEND_ORIGIN` with its actual loopback frontend origin at runtime. The OAuth callback authority remains fixed as shown above.

## Local configuration

Copy `web-frontend/.env.example` to the ignored `web-frontend/.env.local` and set only variables issued by the providers you intend to enable.

```powershell
Set-Location 'D:\Knoux-repair\web-frontend'
Copy-Item .env.example .env.local
# Edit .env.local privately, then restart KNOUX Repair / the bridge.
```

Do not paste secret values into source code, reports, screenshots, logs, GitHub issues, or CI output.

### Google

Register the exact callback:

`http://127.0.0.1:8787/api/auth/callback/google`

Variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` only when the selected Google client type requires a confidential-client secret

The bridge requests only Google profile/email identity access. It validates the one-time OAuth `state`, uses a per-attempt PKCE verifier/challenge (`S256`), exchanges the authorization code locally, reads the user profile, then discards the provider token.

### GitHub

Register the exact callback:

`http://127.0.0.1:8787/api/auth/callback/github`

Variables:

- `KNOUX_GITHUB_CLIENT_ID`
- `KNOUX_GITHUB_CLIENT_SECRET`

The flow uses a one-time `state`, PKCE `S256`, and server-side token exchange. The token is used only to resolve the GitHub profile and is not stored in the renderer or persisted session.

### Microsoft Entra ID

Register the exact callback:

`http://localhost:8787/api/auth/callback/entra`

Variables:

- `KNOUX_ENTRA_CLIENT_ID`
- `KNOUX_ENTRA_TENANT_ID` (defaults to `organizations`)
- `KNOUX_ENTRA_CLIENT_SECRET` only when required by the registration type

The bridge requests Microsoft Graph `User.Read`, validates the one-time `state`, uses PKCE `S256`, resolves `/me`, then discards the provider token.

## System-browser handoff

The renderer generates a cryptographically random one-time handoff identifier and opens only this strict loopback shape externally:

`http://127.0.0.1:8787/api/auth/start/<provider>?handoff=<random-id>`

Electron rejects arbitrary HTTP URLs. The local start route immediately redirects the **system browser** to the provider. The provider callback completes inside the loopback bridge and records only a short-lived one-time handoff result. The Electron renderer claims that result with the per-launch `X-Knoux-Bridge-Token`; only then does the bridge issue the Electron `HttpOnly` session cookie.

This avoids incorrectly assuming that a cookie written in Chrome/Edge/Safari belongs to Electron's separate cookie jar.

## Session restore and logout

The local session cookie contains only an opaque random session id. The corresponding session record contains provider/account metadata and expiry; it does **not** contain provider access or refresh tokens.

On Windows, the session record is persisted using Windows DPAPI with `CurrentUser` scope. There is no plaintext persistence fallback on non-Windows systems. Expired records are rejected and removed. Logout deletes the local session and expires the cookie.

Default session lifetime: eight hours.

## Cancel / failure handling

- Provider cancellation (`access_denied` / equivalent) completes the handoff as `AUTH_CANCELLED` and creates no session.
- The app exposes explicit cancellation while waiting for the system browser.
- Renderer polling has a bounded timeout and cancels stale handoffs.
- State mismatch, replay, expired transaction, missing code, provider exchange failure, and missing provider configuration fail closed.
- Callback pages contain no provider token, bridge token, client secret, or account credential.

## Security boundaries

| Boundary | Behavior |
|---|---|
| Provider token | Bridge memory only during identity lookup, then discarded. |
| Persisted session | Account metadata + opaque session id, protected by Windows DPAPI CurrentUser. |
| Browser session | `HttpOnly`, `SameSite=Strict`, loopback-scoped cookie. |
| OAuth transaction | One-time state + per-attempt PKCE verifier, bounded lifetime. |
| System browser | Exact loopback auth-start exception only; arbitrary HTTP remains blocked. |
| Renderer | No OAuth client secret/access token/refresh token. |
| Repository | `.env.local` ignored; examples contain variable names only. |

## Verification boundary

Automated tests can prove callback constants, PKCE construction, state replay rejection, handoff capability enforcement, cancellation, Local Mode, logout, protected-run gating, and Windows DPAPI round-trip behavior. A final provider PASS still requires real interactive sign-in against the configured Google, GitHub, and Entra registrations on Windows; CI must not fabricate that evidence.
