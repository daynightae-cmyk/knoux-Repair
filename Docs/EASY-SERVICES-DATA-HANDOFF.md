# KNOUX Repair — Easy Services Data / Provider / AI Handoff

Status: implementation handoff after the customer-facing visual preparation wave.

This document does **not** replace the canonical 6 Families / 18 Services / 158 ToolIds. ToolIds remain internal runtime contracts. The customer-facing product is service-first and human-readable.

## Permanent rules

- Local bridge / native Windows evidence is the primary source of machine truth and execution.
- KNOUX AI is the existing reasoning layer. Do not build another assistant.
- KNOUX AI may explain, prioritize and recommend from bounded verified evidence. It must not invent machine state or claim execution without a verified runtime result.
- Google / GitHub / Microsoft Entra are identity/integration providers, not generic substitutes for local Windows data.
- Provider health is evidence-driven. Missing credentials => `UNCONFIGURED`; unreachable provider => `UNAVAILABLE` or `ERROR`; never hard-code `CONNECTED`.
- No AI/provider request on render, hover, navigation, service selection or tab change. Use explicit user action or genuinely new evidence; dedupe/cache repeated evidence.
- Secrets never enter React state, public JSON, screenshots, evidence, logs or source-controlled config.
- Customer flows use `SELECT -> REVIEW -> CONFIRM -> EXECUTE -> VERIFY` for changes.
- No fabricated progress. Use measured progress when available, otherwise an indeterminate phase.

## Shared service data envelope

The next implementation wave should normalize each service into the smallest useful subset of this envelope rather than inventing a new contract per screen:

```ts
type ServiceDataState =
  | 'NOT_CONNECTED'
  | 'LOADING'
  | 'READY'
  | 'EMPTY'
  | 'OFFLINE'
  | 'ERROR'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'INCONCLUSIVE';

interface ServiceDataEnvelope<TItem = unknown, TSummary = unknown> {
  serviceId: string;
  capturedAt?: string;
  state: ServiceDataState;
  summary?: TSummary;
  metrics?: Record<string, number | string | boolean | null>;
  items?: TItem[];
  findings?: unknown[];
  evidence?: unknown[];
  selection?: unknown;
  recommendations?: unknown[];
  progress?: { phase?: string; measuredPercent?: number | null; currentItem?: string | null };
  result?: unknown;
  history?: unknown[];
  error?: { code: string; message: string } | null;
}
```

Reuse existing typed contracts where they already provide stronger domain types. Do not create a parallel backend model merely to match this example.

## Easy customer wave: eight services / 58 internal tools

| Service | Internal tools | Existing UI destination | Existing primary data entry | Spark closure target | KNOUX AI context |
|---|---:|---|---|---|---|
| 17 Post-Install Setup | 6 | `PostInstallStation` | `api.postInstallPreview()` + PI runtime tools | scalable verified app catalog, install/update capability model, selected-app queue, real phases, verification | selected apps, installed/missing state, driver offers, queue/result evidence |
| 04 Programs & Applications | 10 | `ProgramsStation` | `api.softwarePreview()` + PA runtime tools | normalized installed inventory, startup state, repair/uninstall capability, app identity/icon metadata | selected app, observed health/startup evidence, proposed safe action |
| 16 Software Environment | 8 | `SoftwareStation` | `api.softwarePreview()` + SE runtime tools | runtimes, package managers, extensions, caches, versions/locations, upgrade availability where proven | environment findings and selected runtime/tool evidence |
| 02 System Cleanup | 11 | `CleanupStation` | `api.cleanupPreview()` + SC runtime tools | measured cleanup candidates, selection plan, quarantine/delete policy, before/after verification | selected cleanup plan, measured bytes, exclusions, verification result |
| 06 Disk Space | 10 | `DiskSpaceStation` | `api.system()` + DS runtime tools | volumes, large-file inventory, categories, protected-path flags, health evidence, measured reclaim | selected files/actions, capacity/health evidence, risk explanation |
| 11 Backup & Recovery | 5 | `RecoveryStation` | `api.backupRecoveryPreview()` + BR runtime tools | restore points, VSS, local backups, source coverage, create/verify/restore results | recovery state, selected restore/backup target, verification evidence |
| 14 Driver Management | 4 | `DriversStation` | `api.driversPreview()` + DR runtime tools | normalized device/driver inventory, problem/signed state, supported update/export/restore capabilities | selected device, current/available driver evidence, risk/rollback context |
| 13 Privacy | 4 | `PrivacyStation` | `api.privacyPreview()` + PR runtime tools | measured settings grouped by permissions/activity/personalization, writable vs read-only capabilities, apply+verify | selected settings, current state, proposed changes, verification evidence |

## Post-Install catalog authority

The current small essential-app catalog is only a seed. Spark should move catalog metadata out of PowerShell source and into one validated structured catalog/provider layer.

Required record shape should support, where verified:

```ts
interface AppCatalogRecord {
  id: string;
  name: string;
  category: string;
  publisher?: string;
  packageProvider: 'winget' | 'windows-store' | 'external' | 'unknown';
  packageId?: string;
  iconRef?: string;
  capabilities: {
    install: boolean;
    update: boolean;
    uninstall: boolean;
    repair: boolean;
    open: boolean;
  };
}
```

Rules:

- Target 100+ useful applications only when package identities are verified.
- Never invent Winget IDs.
- Prefer verified package-manager identities over arbitrary download URLs.
- App icons may come from verified local/cache metadata with a graceful fallback.
- One failed app should not relabel the full queue as success or failure; retain per-item result truth.
- External interactive installers must be represented as an explicit handoff, not simulated control.

## Provider status contract

Use explicit provider states:

`UNKNOWN | UNCONFIGURED | CONFIGURED | CHECKING | AVAILABLE | UNAVAILABLE | ERROR`

`AVAILABLE` requires a real health/proof path, not merely the presence of an environment variable.

### Local provider

Primary for Windows state and execution. Owns raw discovery, execution, confirmation, cancellation and verification.

### KNOUX AI

Existing central reasoning service. Receives bounded structured context only when useful:

```ts
{
  family,
  service,
  humanAction,
  selection,
  evidence,
  latestResult
}
```

It may return an explanation/recommendation/proposal. It cannot override local safety policy or user approval.

### Identity / external providers

Google, GitHub and Entra remain scoped to their real identity/integration use cases. Gemini/OpenRouter/OpenCode may appear in the AI provider center only after real provider health is proven. NVD is advisory security evidence and must never be treated as proof that the local machine is vulnerable without local corroboration.

## Execution ownership

Maintain these concepts independently:

- selected service
- selected human action/tool
- running tool
- runtime state
- latest attributable result

Selecting a different item while one operation is running must not relabel the running operation or its result.

## Closure sequence after this handoff

### Gate A — UI shell (Work)

Eight easy services have a unified premium presentation layer, responsive/RTL behavior, customer-facing action language and data-ready screen destinations. This gate is complete only when CI + build + rendered evidence pass on the final main SHA.

### Gate B — Data/provider closure (Spark)

For each of the eight services, in the order 17 -> 04 -> 16 -> 02 -> 06 -> 11 -> 14 -> 13:

1. identify authoritative source,
2. normalize typed data,
3. connect existing screen,
4. expose capabilities instead of fake buttons,
5. preserve offline/error/empty/inconclusive states,
6. execute through existing bridge,
7. verify result,
8. persist/history only through the approved local operational layer,
9. add focused tests,
10. close the service before moving on.

No global visual redesign in Spark's lane.

### Gate C — Provider / identity / KNOUX AI foundation (separate model lane)

Close global provider registry/health/error contracts, ADC/Vertex Agent Runtime proof, Google/GitHub/Entra identity truth, KNOUX AI bounded evidence adapter, dedupe/cache/cost controls and secret handling. Do not duplicate service data engines and do not redesign UI.

### Gate D — Heavy services

After the easy wave is data-closed, continue service-by-service. Duplicate Files becomes the first heavy data reference implementation: local indexed discovery/fingerprints/decision model with KNOUX AI reasoning over bounded evidence, never a PowerShell-first data layer. Then close Network, Performance, Security, Diagnostics, Services/Processes, Maintenance, Monitoring, Developer Tools and Project Sonar using the same provider -> data -> evidence -> AI -> action -> verification pattern.

## Definition of done for a service

A service is CLOSED only when all applicable items are proved:

- real provider/source identified,
- structured data reaches its screen,
- truthful loading/empty/offline/error states,
- customer actions are capability-driven,
- user selection is distinct from execution,
- confirmation/elevation honored,
- execution result is attributable and verified,
- KNOUX AI receives bounded evidence where useful,
- no automatic paid AI calls from passive UI events,
- no secret leakage,
- focused tests pass,
- full test/build gate remains green.

Anything less is `PARTIAL` or `BLOCKED`, never silently `PASS`.
