# KNOUX Specialised App Execution Map

## Duplicate File Organizer

The duplicate-file service already has a safe two-stage backend workflow. The user selects a folder and file categories, the bridge requests a read-only hash-based preview, and the result contains duplicate groups, an automatically proposed keep-file path, recoverable bytes, file metadata, a short-lived preview ID, and an expiry time. No deletion should be presented before a preview exists. A confirmed quarantine action must send only group IDs and the validated chosen keep paths belonging to that preview. The result should be presented as a recovery-friendly transaction with a visible quarantine history rather than as a raw script outcome.

| Product surface | Bridge evidence | User-visible purpose |
| --- | --- | --- |
| Folder picker | `/api/folders/roots` and `/api/folders` | Choose a local folder without manually typing a command. |
| Scan setup | `/api/duplicates/preview` | Select file classes and a keeper policy, then start a read-only scan. |
| Duplicate review | `Groups`, `Files`, `RecoverableBytes`, `KeepPath` | Compare copies, choose which copy remains, and see the exact recoverable space. |
| Quarantine history | `/api/duplicates/quarantine` | Review recoverable transactions and expose only registered restore actions. |
| Safe removal | Registered tool run with `duplicatePreviewId` and `duplicateKeepPaths` | Create an approved quarantine plan after confirmation. |

## Project Sonar

Project Sonar already supports a real local workspace preview, severity-ranked findings, a safe service plan, optional AI status, and bridge-generated Markdown/PDF export. The user experience should behave as a repository intelligence application: select a workspace, scan its structure, assess priorities, inspect finding evidence, then export an auditable report. It must never render source file contents or secrets in the UI unless a separate explicit product requirement permits that.

| Product surface | Bridge evidence | User-visible purpose |
| --- | --- | --- |
| Workspace picker | `/api/folders/roots` and `/api/folders` | Choose a local repository safely. |
| Workspace snapshot | `/api/sonar/preview` | View language, Git, package, file count, and directory evidence. |
| Risk board | `Findings` and `SeverityCounts` | Triage Critical, High, Medium, and Low findings with evidence and next action. |
| Guided plan | `ServicePlan` | Offer only the registered follow-up actions after user review. |
| Export centre | `/api/sonar/export` and expiring download URL | Download bridge-generated Markdown or PDF reports. |
| Optional analysis | `/api/sonar/ai-status` and `/api/sonar/analysis` | Clearly disclose whether optional analysis is configured and what is not sent. |

## Global implementation rules

The application UI is the sole user-facing surface. It may call the local bridge, but it must transform `running`, `success`, `error`, and `cancelled` states into human-facing progress and result views. PowerShell, raw command strings, stack traces, script paths, and tool identifiers remain hidden from standard users. Exported product reports must be generated from structured bridge evidence, not from the visual state of the page.

## Visual verification

The Duplicate Organizer now renders as a dedicated service application in the running KNOUX frontend. With the local bridge offline, it shows the safe setup workflow, folder chooser, type filters, keeper policy, and disabled scan path without presenting false file counts or recoverable-space values. When the bridge is available, the same UI activates the read-only preview, group review, protected quarantine plan, and registered restore flow.

Project Sonar was also verified in the live frontend. Its startup state is a dedicated repository-intelligence screen with an explicit project picker and scan action, not a generic tool grid. The live result board, guided-plan actions, optional-analysis disclosure, and bridge-generated Markdown/PDF export become available only after a reachable local bridge supplies a structured workspace preview.
