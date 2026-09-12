# KNOUX Repair — UI / Data Readiness Matrix

Authority: current `origin/main`. This is a handoff map, not a replacement for the canonical registry.

Invariant: **6 Families / 18 Services / 158 internal ToolIds**.

Customer-facing UI is service-first. ToolIds remain internal runtime contracts and may appear only in technical/evidence views where useful.

| # | Service | Tools | Canonical station | Current primary data entry | UI status | Next data/provider owner |
|---:|---|---:|---|---|---|---|
| 01 | System Maintenance | 10 | `MaintenanceStation` | `api.system()` + service tools | UI_PRESENT | heavy-wave data closure |
| 02 | System Cleanup | 11 | `CleanupStation` | `api.cleanupPreview()` + SC tools | EASY_UI_READY_FOR_DATA | Spark |
| 03 | Network & Internet | 11 | `NetworkStation` | `api.networkPreview()` + NI tools | UI_PRESENT | heavy-wave data closure |
| 04 | Programs & Applications | 10 | `ProgramsStation` | `api.softwarePreview()` + PA tools | EASY_UI_READY_FOR_DATA | Spark |
| 05 | Duplicate Files | 11 | `DuplicateStation` | duplicate preview/bridge + DF tools | UI_PRESENT_HEAVY_DATA | dedicated heavy reference closure |
| 06 | Disk Space | 10 | `DiskSpaceStation` | `api.system()` + DS tools | EASY_UI_READY_FOR_DATA | Spark |
| 07 | Services & Processes | 11 | `ServicesStation` | `api.operationsPreview()` + SP tools | UI_PRESENT | heavy-wave data closure |
| 08 | Performance | 12 | `PerformanceStation` | `api.optimizationPreview()` + PF tools | UI_PRESENT | heavy-wave data closure |
| 09 | Security | 10 | `SecurityStation` | system/security evidence + SE tools | UI_PRESENT | heavy-wave data closure |
| 10 | Diagnostics & Reports | 11 | `DiagnosticsStation` | `api.diagnosticsPreview()` + DR tools | UI_PRESENT | heavy-wave data closure |
| 11 | Backup & Recovery | 5 | `RecoveryStation` | `api.backupRecoveryPreview()` + BR tools | EASY_UI_READY_FOR_DATA | Spark |
| 12 | Developer Tools | 13 | `DeveloperStation` | software/dev evidence + DT tools | UI_PRESENT | heavy-wave data closure |
| 13 | Privacy | 4 | `PrivacyStation` | `api.privacyPreview()` + PR tools | EASY_UI_READY_FOR_DATA | Spark |
| 14 | Driver Management | 4 | `DriversStation` | `api.driversPreview()` + driver tools | EASY_UI_READY_FOR_DATA | Spark |
| 15 | System Monitoring | 4 | `MonitoringStation` | `api.operationsPreview()` + monitoring tools | UI_PRESENT | heavy-wave data closure |
| 16 | Software Environment | 8 | `SoftwareStation` | `api.softwarePreview()` + SE tools | EASY_UI_READY_FOR_DATA | Spark |
| 17 | Post-Install Setup | 6 | `PostInstallStation` | `api.postInstallPreview()` + PI tools | EASY_UI_READY_FOR_DATA | Spark first |
| 18 | Project Sonar | 7 | `ProjectSonarStation` | project selection/sonar tools | UI_PRESENT | heavy-wave data closure |

Tool count sum: `10 + 11 + 11 + 10 + 11 + 10 + 11 + 12 + 10 + 11 + 5 + 13 + 4 + 4 + 4 + 8 + 6 + 7 = 158`.

## Customer-first easy wave

These eight stations share the final easy-service visual layer and are the next data/provider closure wave:

- 17 Post-Install Setup
- 04 Programs & Applications
- 16 Software Environment
- 02 System Cleanup
- 06 Disk Space
- 11 Backup & Recovery
- 14 Driver Management
- 13 Privacy

The visual layer is deliberately presentation-only. It must not fabricate machine truth, provider availability, execution or progress.

## Required data destinations per service

Every service implementation should map real information into the applicable destinations below rather than introducing an unrelated page architecture:

- `summary`
- `metrics`
- `items`
- `filters/search`
- `selection`
- `preview/visualization`
- `findings`
- `evidence`
- `recommendations`
- `actions`
- `runtime/progress`
- `result`
- `history`
- `technical log`
- `offline/error/empty/inconclusive`

Not every service needs every destination. Empty decorative regions are not a requirement.

## Action truth

Normal product language must be human-readable. Internal tool IDs are not the primary customer action names.

Examples:

- `PI04` -> **Install selected apps**
- `DS02` -> **Find large files**
- cleanup tool -> **Clean temporary files**
- backup tool -> **Create restore point / Back up my files**

Actions must be capability-driven. A button is shown/enabled only when the current provider/runtime supports that capability.

## State truth

UI/data states:

`NOT_CONNECTED | LOADING | READY | EMPTY | OFFLINE | ERROR | RUNNING | COMPLETED | FAILED | CANCELLED | INCONCLUSIVE`

Provider states:

`UNKNOWN | UNCONFIGURED | CONFIGURED | CHECKING | AVAILABLE | UNAVAILABLE | ERROR`

A configured key is not proof of availability.

## KNOUX AI handoff

The existing KNOUX AI remains the single central reasoning layer. An applicable service may send bounded context:

- family
- service
- human action
- selected items
- verified evidence
- latest result

KNOUX AI may explain/recommend/propose. It does not become the source of local Windows facts and does not silently execute privileged work.

## Closure rule

`UI_PRESENT` means the canonical station/destination exists. It does **not** mean production data closure is proven.

`EASY_UI_READY_FOR_DATA` means the service is part of the customer-first visual preparation wave and is ready for the Spark data/provider pass after the final CI/render gate.

A service becomes `CLOSED` only after real provider/data, action capability, execution, verification, tests and full quality gates are proved.
