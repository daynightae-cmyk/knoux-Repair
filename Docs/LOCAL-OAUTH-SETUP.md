# Knoux Repair — Local OAuth setup

## Purpose

Knoux Repair authenticates through the **local execution bridge**. The React interface never receives a provider token, client secret, refresh token, or API key. After a successful callback, the bridge stores the provider token only in memory and gives the browser a short-lived `HttpOnly` loopback session cookie.

> OAuth is **optional by default**. Services remain protected by their mandatory execution-confirmation workflow. Set `KNOUX_AUTH_REQUIRED=true` only after verifying one or both providers below.

| Provider | Callback URL to register | Required local variables | Minimal requested identity access |
|---|---|---|---|
| GitHub OAuth App | `http://127.0.0.1:8787/api/auth/callback/github` | `KNOUX_GITHUB_CLIENT_ID`, `KNOUX_GITHUB_CLIENT_SECRET` | `read:user` |
| Microsoft Entra ID | `http://127.0.0.1:8787/api/auth/callback/entra` | `KNOUX_ENTRA_CLIENT_ID`, optional `KNOUX_ENTRA_CLIENT_SECRET`, `KNOUX_ENTRA_TENANT_ID` | `openid profile email User.Read` |

## Local configuration

Copy `web-frontend/.env.example` to `web-frontend/.env.local` and set only the values issued by the identity provider. Leave this file untracked. The bridge reads `.env.local` at startup, so restart it after changing configuration.

```powershell
cd D:\Knoux-Repair-v2.0.2\web-frontend
Copy-Item .env.example .env.local
# Edit .env.local privately, then restart the bridge.
node server\bridge.mjs
```

Use `http://127.0.0.1:5173` as `KNOUX_AUTH_FRONTEND_ORIGIN` for the authenticated local Vite session. This ensures the callback and session cookie remain on the loopback host. The bridge refuses non-loopback callback destinations.

## GitHub OAuth App

Create an **OAuth App** in GitHub developer settings. Set the authorization callback exactly to `http://127.0.0.1:8787/api/auth/callback/github`, then copy the generated client ID and client secret into `.env.local`. The bridge creates an unguessable `state` value and PKCE verifier per sign-in, validates the returned `state`, and exchanges the code server-side. GitHub’s documented web flow recommends both `state` and PKCE; the returned token is revalidated through `/user` before the session is created.[1]

## Microsoft Entra ID

Create an app registration that accepts the intended account type. For developer work and school identities, `organizations` is the default tenant selector. Register the redirect URI exactly as `http://127.0.0.1:8787/api/auth/callback/entra`; because this uses an HTTP loopback address, it may need to be added through the app registration manifest as described by Microsoft. Use Authorization Code Flow with PKCE. The bridge requests only basic OIDC identity scopes plus Microsoft Graph `User.Read` to identify the signed-in account.[2] [3]

## Enforcing sign-in

After at least one provider succeeds in local testing, set:

```ini
KNOUX_AUTH_REQUIRED=true
```

With this flag enabled, the bridge rejects new repair runs until an authenticated session exists. Existing mandatory confirmation dialogs and safety delays remain unchanged. Restarting the bridge intentionally invalidates all local in-memory OAuth sessions.

## Security boundaries

| Boundary | Behavior |
|---|---|
| Token storage | In-memory inside the loopback bridge only; never returned by `/api/auth/status`. |
| Browser session | `HttpOnly`, `SameSite=Lax`, loopback-scoped cookie with an eight-hour maximum lifetime. |
| OAuth transaction | One-time `state` plus PKCE verifier; expires after ten minutes. |
| Callback target | Fixed local bridge callback and fixed loopback frontend origin; no dynamic redirect URL. |
| Repository safety | `.env.local` must remain ignored; `.env.example` has empty values only. |

## References

[1] [GitHub Docs — Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)

[2] [Microsoft Learn — OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)

[3] [Microsoft Learn — Redirect URI restrictions and localhost guidance](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
