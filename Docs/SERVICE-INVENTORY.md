# KNOUX Repair Service Inventory

Generated from `Config/menus.json`, script files, and the current web bridge/UI architecture during the product-experience audit.

| Service | Tools | Existing UI | Engine / Structured Preview | Real Execution | Tests | Status |
|---|---:|---|---|---|---|---|
| 01-System-Maintenance | 10 (SM01, SM02, SM03, SM04…) | Specialized service app | SM10/System snapshot | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | First service transformed in this change; deeper step streaming remains next |
| 02-System-Cleanup | 11 (SC01, SC02, SC03, SC04…) | Specialized service app | SC11 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Existing mini-app preview; needs review/export expansion |
| 03-Network-Internet | 11 (NI01, NI02, NI03, NI04…) | Specialized service app | NI11 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Existing mini-app preview; needs repair plan workspace |
| 04-Programs-Applications | 10 (PA01, PA02, PA03, PA04…) | Specialized service app | SW07 + PA scripts | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Existing inventory; needs uninstall verification workspace |
| 05-Duplicate-Files | 11 (DF01, DF02, DF03, DF04…) | Specialized service app | DF11 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Dedicated duplicate organizer app exists |
| 06-Disk-Space | 10 (DS01, DS02, DS03, DS04…) | Specialized service app | DS07/DR08 + system drives | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Capacity app exists; SMART diagnostic workspace still needed |
| 07-Services-Processes | 11 (SP01, SP02, SP03, SP04…) | Specialized service app | SP11 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Operations preview exists; startup-specific workspace needed |
| 08-Performance | 12 (PF01, PF02, PF03, PF04…) | Specialized service app | PF11/PF12 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Performance cockpit exists |
| 09-Security | 10 (SE01, SE02, SE03, SE04…) | Specialized service app | SE01/SE09 + system snapshot | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Security center exists; scan result workspace needed |
| 10-Diagnostics-Reports | 11 (DR01, DR02, DR03, DR04…) | Specialized service app | DR11 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Diagnostics preview exists |
| 11-Backup-Recovery | 5 (BR01, BR02, BR03, BR04…) | Specialized service app | BR04 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Recovery vault preview exists; data recovery UX not present |
| 12-Developer-Tools | 13 (DT01, DT02, DT03, DT04…) | Shared software/workspace panel | DT scripts/SW08 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Developer workspace exists |
| 13-Privacy | 4 (PR01, PR02, PR03, PR04) | Specialized service app | PR04 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Privacy center exists |
| 14-Driver-Management | 4 (DV01, DV02, DV03, DV04) | Specialized service app | DV04 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Driver inventory center exists; update/rollback flow still needed |
| 15-System-Monitoring | 4 (MO01, MO02, MO03, MO04) | Specialized service app | MO/SP previews | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Operations monitor exists |
| 16-Software-Environment | 8 (SW01, SW02, SW03, SW04…) | Specialized service app | SW07/SW08 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Software library exists |
| 17-PostInstall-Setup | 6 (PI01, PI02, PI03, PI04…) | Specialized service app | PI06 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Setup checklist exists |
| 18-Project-Sonar | 7 (SN01, SN02, SN03, SN04…) | Specialized service app | SN07 | Yes: approved PowerShell scripts launched through bridge with `windowsHide` and run/cancel endpoints | Typecheck/build coverage; PowerShell functional tests exist in Tests/ | Dedicated project app exists |

## Architectural findings

- The bridge exposes real read-only structured previews for core services and parses marker-delimited JSON rather than rendering console text directly.
- Script execution is centralized behind `/api/runs`, supports cancellation, hides Windows console windows, and reports status back to the UI.
- The frontend still has service gaps: Storage needs a SMART-first app, Programs needs richer uninstall verification, and Backup/Recovery needs a true file-recovery workspace beyond restore-point protection.

## First implementation slice

- System Maintenance has been elevated from a generic health view into a System Repair mini-application with diagnosis, repair-plan, verification, safety, technical-details, and localized Arabic/English copy.
- The dashboard workspace metadata no longer uses fabricated relative activity times; it now describes availability/readiness states derived from the bridge/tool inventory.

## Forensic verification update

The PR #6 follow-up audit distinguishes product-ready behavior from visible UI presence. A specialized card alone is not considered complete.

| Service | Route / App Surface | Real Input | Structured Output | Progress / Cancel | Error Recovery | Verified Status |
|---|---|---|---|---|---|---|
| System Maintenance | `ServiceApps` → `SystemRepairApp` | `/api/system`, `SM01`, `SM02` | Bridge `BridgeRun.result` parsed from session `results.json` | SM01 polling + bridge cancel; SM02 through confirmation dialog | Bridge errors and session failures mapped to failed state | Functional first slice; DISM chain still remains a future expansion |
| System Cleanup | `CleanerApp` | `SC11` preview + cleanup scripts | JSON preview + run reports | Shared bridge run/cancel | Shared confirmation and bridge errors | Existing mini-app, still needs richer post-clean report UX |
| Network | `NetworkApp` | `NI11` preview + NI repair tools | JSON preview + run reports | Shared bridge run/cancel | Shared confirmation and bridge errors | Existing diagnostic preview, repair plan UX still incomplete |
| Programs / Software | `LibraryApp` | `SW07`, `SW08`, app scripts | JSON inventory + run reports | Shared bridge run/cancel | Shared confirmation and bridge errors | Inventory is real; uninstall verification flow remains incomplete |
| Duplicates | `DuplicateOrganizerApp` | Folder picker + `DF11` preview | Duplicate groups and quarantine plan | Preview plus shared bridge run/cancel | Expired preview and validation errors handled | Dedicated workflow exists |
| Storage | `StorageApp` | `/api/system` drive evidence | Drive capacity snapshot | Refresh only | Bridge unavailable state | Capacity-only; SMART diagnostic app remains incomplete |
| Security | `SecurityApp` | `/api/system`, SE scripts | Defender/firewall snapshot + reports | Shared bridge run/cancel | Shared confirmation and bridge errors | Protection center exists; scan result workspace remains incomplete |
| Backup & Recovery | `RecoveryApp` | `BR04` preview + BR scripts | Restore-point/backup evidence | Shared bridge run/cancel | Shared confirmation and bridge errors | Recovery vault exists; file recovery UX remains incomplete |
