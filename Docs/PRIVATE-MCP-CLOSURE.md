# KNOUX Repair — Private MCP Closure

Mission 02 keeps the MCP gateway private and proves access with Google Cloud ID-token authentication. A failed proof is reported as unavailable; KNOUX never retries anonymously and never substitutes a public endpoint.

## Canonical contract

- Cloud Run service: `knoux-mcp-gateway`
- Region: `us-central1`
- Cloud Run service URL (verified from `status.url`): `https://knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app`
- MCP endpoint: `https://knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app/mcp`
- ID-token audience: `https://knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app`
- Mission-documented alias (also private, not used as the token audience): `https://knoux-mcp-gateway-30719047550.us-central1.run.app`
- Dedicated local proof invoker: `knoux-mcp-invoker@knoux-repair.iam.gserviceaccount.com`
- Read-only proof tool: `gateway_status`
- Modern MCP protocol: `2026-07-28`
- Legacy compatibility fallback: `2025-11-25`

The endpoint is exact. A trailing slash, another host, `/mcp` in the audience, or any public fallback is rejected by the runtime contract.

## Security model

The renderer never receives a Google Cloud ID token. `POST /api/mcp/verify` is handled by the local bridge and protected by the same local mutation guard/capability boundary used for other privileged local actions.

The bridge first makes an **unauthenticated** request to the exact MCP endpoint. It must receive HTTP `401` or `403` before KNOUX will attempt an authenticated tool call. An unauthenticated `2xx` is treated as a security failure, not success.

Only after the private boundary is proven does the bridge acquire a short-lived ID token server-side. Token sources are:

1. Google metadata identity endpoint for Cloud Run / Agent Engine / other Google runtimes with an attached invoker-capable service account.
2. `gcloud auth print-identity-token --audiences=<audience> --include-email --impersonate-service-account=knoux-mcp-invoker@knoux-repair.iam.gserviceaccount.com` for a local/ADK operator session.

There is deliberately no plaintext token environment variable and no token value is returned in API responses, logs, React state, or visual evidence. Sanitization also removes secret-like keys and JWT-looking values from `gateway_status` output before it reaches the renderer.

## Verified live-cloud proof — 2026-09-12

A real operator run against project `knoux-repair` (project number `30719047550`) proved the complete private path:

- unauthenticated request to the actual service URL: HTTP `403`
- unauthenticated request to the mission alias: HTTP `403`
- Google-signed ID token minted by impersonating `knoux-mcp-invoker@knoux-repair.iam.gserviceaccount.com`
- token audience: `https://knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app`
- modern direct `2026-07-28` call: HTTP `400` and therefore not claimed as supported
- legacy `2025-11-25` initialize: HTTP `200`, session established
- authenticated `tools/call` / `gateway_status`: HTTP `200`
- returned `structuredContent`: `ok=true`, `service=knoux-mcp-gateway`, `product=KNOUX Repair`, `mode=READ_ONLY_SMOKE_TEST`, `local_machine_connected=false`, `changes_made=false`, `isError=false`

The runtime therefore keeps modern-first behavior but treats the legacy session flow as the currently proven production path. No JWT value is stored in this repository or returned to the renderer.

## Local / ADK smoke proof

Use a terminal that is already authenticated to Google Cloud with an identity allowed to invoke the private Cloud Run service. Do not paste an ID token into source code or chat.

From `web-frontend`:

```text
node scripts/mcp-private-smoke.mjs
```

A completed gate has all of the following in the JSON output:

- `ok: true`
- `privacy.state: "confirmed-private"`
- `identity.state: "available"`
- `protocol.state: "success"`
- `gatewayStatus.state: "success"`
- a real sanitized `gatewayStatus.payload`

Anything else is not a Mission 02 live-cloud PASS.

## Cloud Run Invoker binding

The known CES service agent for the handoff is:

```text
service-30719047550@gcp-sa-ces.iam.gserviceaccount.com
```

An operator with project IAM authority can bind only the invoker role to the private service. Use the actual Google Cloud project ID; do not substitute or invent it:

```text
gcloud run services add-iam-policy-binding knoux-mcp-gateway --region us-central1 --project <PROJECT_ID> --member serviceAccount:service-30719047550@gcp-sa-ces.iam.gserviceaccount.com --role roles/run.invoker
```

This command is documentation, not evidence that the binding has been applied. The authenticated `gateway_status` proof remains the acceptance gate.

## UI truth boundary

The Private MCP Connection Center displays five stages: endpoint contract, private boundary, invoker identity, MCP transport, and `gateway_status`. It does not infer cloud health from configuration. Before a live probe, runtime stages remain **Not verified yet**. Missing identity, DNS, IAM, or protocol evidence is shown as unavailable with the real error.
