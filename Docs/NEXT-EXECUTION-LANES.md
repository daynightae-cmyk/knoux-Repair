# KNOUX Repair — Next Execution Lanes

Authority: current `origin/main`. Do not reset backward to a recorded SHA. Re-fetch before work.

This handoff starts only after the UI/easy-service quality gate is green on the current main SHA.

## Lane 1 — Spark: Easy Services Data Closure

### Scope

Close real data/provider behavior for exactly these services first:

1. `17-PostInstall-Setup`
2. `04-Programs-Applications`
3. `16-Software-Environment`
4. `02-System-Cleanup`
5. `06-Disk-Space`
6. `11-Backup-Recovery`
7. `14-Driver-Management`
8. `13-Privacy`

Do not redesign their visual shells. Consume the screens that already exist.

### Mission

For every service:

`AUTHORITATIVE SOURCE -> PROVIDER/BRIDGE -> NORMALIZER -> TYPED DATA -> UI -> EVIDENCE -> USER ACTION -> EXECUTION -> VERIFY -> HISTORY`

Required rules:

- Local-first machine truth.
- Keep 158 ToolIds unchanged as internal contracts.
- No raw-PowerShell-first customer experience.
- No fake metrics, progress, provider state, success or history.
- Every writable action is capability-driven and follows `SELECT -> REVIEW -> CONFIRM -> EXECUTE -> VERIFY`.
- Preserve admin/elevation, confirmation, cancellation and protected-path rules.
- Do not add a new global backend architecture.
- Do not build another AI assistant.

### Post-Install special closure

Replace the tiny PowerShell-embedded seed catalog with one structured validated catalog source.

Target a useful 100+ app catalog only when package identities are verifiable. Prefer Winget/package-manager identities; never invent IDs. Add capability metadata so the card can truthfully expose only supported actions: install/update/uninstall/repair/open.

Implement a real queue model with per-item state:

`QUEUED | PREPARING | DOWNLOADING | INSTALLING | CONFIGURING | VERIFYING | COMPLETED | FAILED | SKIPPED | CANCELLED`

Measured percent is optional. If unavailable, preserve phase-only indeterminate UI. A single app failure must not silently convert the entire queue to success/failure.

### Data persistence

Use the approved local operational data layer. If the intended SQLite operational layer is not yet present, close that foundation before inventing another persistence store. Existing cloud/SQL experiments do not become machine-truth authority merely because code exists.

### Spark final report

Return exact:

- final SHA(s)
- services CLOSED / PARTIAL / BLOCKED
- provider/source per service
- data contracts added/changed
- bridge endpoints added/changed
- Post-Install verified catalog count
- capability matrix results
- AI evidence adapters added
- tests/typecheck/build
- blockers and next exact service

Never use `PASS` without proof.

---

## Lane 2 — Provider / Identity / KNOUX AI Closure

Use a separate model lane from Spark to avoid editing the same station/data files.

### Scope

Own only global provider/identity/AI foundation:

- provider registry + health states
- Google identity
- GitHub identity/integration
- Microsoft Entra identity
- Gemini/OpenRouter/OpenCode provider availability where configured
- ADC / Vertex Agent Runtime
- existing KNOUX AI A2A adapter
- Private MCP production path
- bounded context/evidence adapter
- dedupe/cache/cost controls
- secret redaction and error mapping

Do not own the eight service data engines and do not redesign UI.

### Provider truth states

Use:

`UNKNOWN | UNCONFIGURED | CONFIGURED | CHECKING | AVAILABLE | UNAVAILABLE | ERROR`

Presence of a key means `CONFIGURED`, not automatically `AVAILABLE`.

### KNOUX AI contract

KNOUX AI already exists. Do not rebuild it.

It receives bounded structured context from the product and may:

- explain verified evidence
- summarize findings
- prioritize issues
- recommend next actions
- prepare an action proposal

It may not:

- invent local state
- silently execute privileged work
- bypass UAC/confirmation
- replace local bridge truth
- claim success before post-execution verification

No automatic paid calls from render/hover/navigation/tab/service selection. Dedupe/cache repeated requests by provider + model + prompt version + evidence hash where practical.

### Production proof priority

Close the deployed Agent Runtime -> Private MCP path with independent evidence before marking it complete. Preserve Mission 02 privacy/auth boundaries.

### Provider lane final report

Return exact:

- final SHA(s)
- each provider state + proof basis
- Agent Runtime proof status
- Private MCP proof status
- identity/ADC status
- bounded context/caching changes
- secret audit
- tests/typecheck/build
- blockers

---

## Lane 3 — Read-only Reviewer

A third model may inspect both lanes but must not write product code while they are active.

Review for:

- overlapping edits
- fake state/telemetry
- leaked secrets
- unsupported customer buttons
- broken ToolId/service mappings
- destructive action regressions
- missing verification
- provider calls triggered by passive UI events
- claims that exceed evidence

Return patch recommendations only.

---

## After the easy wave

Close heavy services service-by-service rather than reopening finished easy services without a regression.

First heavy reference: Duplicate Files.

Its production data layer should be a local indexed duplicate engine with deterministic hashes/fingerprints, persistent decisions and safe quarantine/verification. KNOUX AI may reason over bounded metadata/evidence but is not the scanner and never decides deletion for the user.

Then continue the remaining services using the same pattern:

`provider -> typed data -> evidence -> human UI -> KNOUX AI where useful -> approval -> execution -> verification`.

A service marked CLOSED stays closed unless a real regression is demonstrated.
