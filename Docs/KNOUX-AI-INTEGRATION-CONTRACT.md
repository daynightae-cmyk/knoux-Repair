# KNOUX AI — Application Integration Contract

## Runtime identity

Product name: `KNOUX AI`

Agent Runtime resource:

`projects/30719047550/locations/us-west1/reasoningEngines/374423291676327936`

A2A endpoint:

`https://us-west1-aiplatform.googleapis.com/v1beta1/projects/30719047550/locations/us-west1/reasoningEngines/374423291676327936/a2a`

Agent Registry resource:

`projects/knoux-repair/locations/us-west1/agents/agentregistry-00000000-0000-0000-8a03-23259e537f02`

Private MCP gateway:

`https://knoux-mcp-gateway-30719047550.us-central1.run.app/mcp`

Verified MCP smoke-test tool: `gateway_status`.

## Product architecture

```text
React UI
  ↓
local web gateway (web-frontend/server.ts)
  ↓
authenticated KNOUX AI Agent Runtime
  ↓
reasoning / explanation / proposed intent
  ↓
local KNOUX policy + bridge
  ↓
registered tool execution
  ↓
verification evidence
  ↓
KNOUX AI explanation
```

The React bundle must never contain Google credentials, service-account keys, OAuth secrets, or static bearer tokens.

## Context envelope

The app should send only bounded current context:

```json
{
  "sessionId": "optional-session-id",
  "message": "user message",
  "context": {
    "familyId": "vitality",
    "serviceId": "08-Performance",
    "tool": {
      "id": "PF01",
      "name": "verified tool name",
      "riskLevel": "verified risk",
      "requiresAdmin": false,
      "requiresConfirmation": false
    },
    "runtime": {
      "bridgeOnline": true,
      "bridgeElevated": false,
      "toolStatus": "idle"
    },
    "evidence": [
      {
        "source": "local-tool-or-bridge",
        "type": "summary",
        "summary": "bounded verified evidence"
      }
    ]
  }
}
```

Unknown values must be `null` or omitted. Never synthesize live values.

## UI entry points

KNOUX AI should be reachable from:

1. Global TopBar assistant entry.
2. AI Scan prompt and post-scan explanation.
3. Family/service context.
4. Tool-result actions: Explain Result, Find Root Cause, Recommend Safe Fix, What Evidence Is Missing?, Create Repair Plan.

## AI Scan contract

`Start AI Scan` means local evidence collection.

`Ask KNOUX AI` means cloud reasoning over currently available verified evidence.

Do not let KNOUX AI pretend that a local scan occurred.

## Tool-result contract

When a real result exists, KNOUX AI may receive:

- family/service identity
- tool identity
- verified run status
- bounded result/evidence summary
- risk/admin/confirmation metadata

It must not receive unrelated logs or secrets.

## Execution contract

KNOUX AI may propose an action, but execution remains local:

```text
KNOUX AI proposal
→ local registry validation
→ local policy validation
→ confirmation if required
→ local bridge execution
→ verification
→ result returned to KNOUX AI
```

No cloud response may bypass local confirmation or risk policy.

## Truth states

Use explicit states:

- Checking
- Available
- Thinking
- Response Ready
- Unavailable
- Authentication Required
- Upstream Error

Do not display `Connected` or `AI Ready` without a successful live status result.

## MCP truth

The Cloud Run MCP gateway has been verified with:

- private IAM-protected endpoint
- successful MCP initialize
- successful session creation
- successful `tools/list`
- successful `gateway_status` call

`gateway_status` currently reports cloud gateway state only. `local_machine_connected: false` is valid when no Windows bridge is attached.

End-to-end Agent Runtime → MCP must be proven independently from a deployed agent call before being marked complete.
