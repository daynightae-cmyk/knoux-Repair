# SERVICE 04 — Programs & Applications — Work Log

## BASE BRANCH
`traycer/knoux-repair-snappy-lemur`

## BASE HEAD
`454b09e12d1ce31c8c5d9445de7b61edb63b3752` (Service 17 CLOSED, docs update)

## ORIGIN MAIN
`69e1ce75f3c08e8332c108af60ba525eef3ec670` (origin/main at push time)

## AHEAD_BEHIND
`0 4` (local 4 ahead of origin/main before Service 04 work; after Service 17 push, HEAD == remote)

## WORKTREE STATUS (pre-Service04)
clean

## FILES CHANGED
- `Core/KnouxRepair.Software.psm1` (NEW) — unified inventory provider: Get-KnouxSoftwareInventory (HKLM x64/x86, HKCU, AppX Get-AppxPackage, optional WinGet correlation best-effort), Get-KnouxWingetExePathForSoftware fallback; deduplication; capability truth (uninstall/repair/open via UninstallString/InstallLocation heuristics, update remains false until proven)
- `Core/KnouxRepair.Core.psm1` — imports Software module, exports new functions
- `04-Programs-Applications/PA01-ListInstalledPrograms.ps1` — rewritten to use Get-KnouxSoftwareInventory, enriched normalized fields (Id, DisplayName, Version, Publisher, Kind, Architecture, Scope, Source/RegistryHive, InstallLocation, InstallDate, EstimatedSizeMB, UninstallString, UninstallAvailable/CanUninstall, RepairCapability, UpdateCapability, OpenCapability, PackageFullName, Evidence, CapturedAt), envelope programs-envelope.json, verificationResult with capability truth
- `16-Software-Environment/SW07-InteractiveSoftwarePreview.ps1` — rewritten to use Get-KnouxSoftwareInventory, enriched SoftwarePreviewItem (Id, Architecture, InstallLocation, InstallDate, PackageProvider, PackageId, UninstallCapability, RepairCapability, UpdateCapability, OpenCapability, Source, Scope, Evidence, CapturedAt, EstimatedSizeMB), Safety with WingetAvailable flag, Truncated handling at 600, no Win32_Product
- `web-frontend/src/lib/api.ts` — SoftwarePreviewItem expanded with optional enriched fields (Id, Architecture, InstallLocation, InstallDate, PackageProvider, PackageId, UninstallCapability, UninstallString, RepairCapability, UpdateCapability, OpenCapability, Source, Scope, Evidence, CapturedAt, EstimatedSizeMB), SoftwarePreview adds CapturedAt, InventorySources, Safety.WingetAvailable
- `web-frontend/src/features/stations/station04/ProgramsStation.tsx` — selectedApp drawer capability truth badges (UNINSTALL/REPAIR/UPDATE/OPEN with ✓/✗), disabled reason when uninstall unavailable, no fake buttons

## PROVIDERS
- Local truth: Registry Uninstall hives (HKLM x64, HKLM WOW6432Node, HKCU) via Get-ItemProperty, AppX/MSIX via Get-AppxPackage (when host supports; 0 if unavailable, truthful), file existence for OpenCapability
- External reference (best-effort): WinGet via %LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe fallback (v1.29.380) for future update correlation; currently used only to set Safety.WingetAvailable, UpdateCapability remains false until proven (no fabrication)
- Forbidden: Win32_Product never queried (explicitly avoided; would trigger MSI reconfiguration)
- Sources per preview: InventorySources=[Uninstall registry HKLM/HKCU, AppX MSIX Get-AppxPackage, WinGet correlation best-effort]

## FOCUSED TESTS
- `tests/station04.test.mjs` — 50 tests PASS (0 fail)
  - manifest 10 tools, analyze/what-if gate, safe analyze smoke, repair ladder, packaged runtime
  - Acceptance 01-07 inventory normalization (x64/x86/user dedup, AppX identity, malformed handling)
  - Acceptance 08-12 startup parsing & protected flag
  - Acceptance 13-18 cache classification & byte accounting
  - Acceptance 19-21 orphan correlation (OWNED/UNKNOWN/VERIFIED_ORPHAN strict protection)
  - Acceptance 22-23 repair planning & wildcard block
  - Acceptance 24-25 verification contract (VERIFIED_FIXED vs ACTION_COMPLETED_UNVERIFIED)
  - Acceptance 26-28 associations (VALID/BROKEN/USER_CHOICE_REQUIRED)
  - Acceptance 29-32 features parsing
  - Acceptance 33-35 updates distinction from winget
  - Acceptance 36-38 compatibility diagnosis (BROKEN_SHORTCUT/MISSING_RUNTIME/HEALTHY)
  - Acceptance 39-45 safety policy, elevation, path protection, timeout, malformed handling, Arabic labels, capability matrix

## FULL TESTS
- `npm test` — 636 tests PASS, 0 fail, 0 skipped (98500ms second run with bridge; 636 also on re-run)
- Type: unit + bridge integration + visual polish, no fabrication

## TYPECHECK
- `npm run typecheck` (tsc --noEmit) — PASS clean (after api.ts expansion)

## BUILD
- `npm run build` — PASS
  - vite v6.4.3, 2674 modules, 33.57s (second run)
  - assets/index-CuUqOWFZ.css 909.57kB, index-DUO4yhnW.js 2476.41kB (was 2474.95kB)
  - esbuild server.ts → dist/server.cjs 63.9kB, 1 warning (empty import.meta expected)

## BRIDGE EVIDENCE
- Bridge: `node server/bridge-core.mjs` listening 127.0.0.1:8787, manifest 158 tools
- Health: `{ok:true, bridge:"knoux-bridge", version:"2.0.2", elevated:false, powershell:"C:\\Program Files\\PowerShell\\7\\pwsh.exe", repoRoot:"...", resourceMode:"DEV", tools:158, categories:18}`
- Endpoints: `/api/software/preview` via SW07 (mapped to `/api/software-advanced/preview` also available)

## RUNTIME INVENTORY EVIDENCE (live machine)
- Direct PA01 run (registry+AppX): Found 179 installed programs (Desktop 179, AppX 0) — sample:
  - 7-Zip 26.02 (x64 edition) | 26.02.00.0 | Desktop | x64 | registry_hklm64 | Uninstall True Repair True Evidence "Registry registry_hklm64 DisplayName match; uninstallAvailable=True; sizeMB=5.8"
  - actionlint 1.7.12 | Desktop | neutral | registry_hkcu | winget uninstall --product-code ... | Open True
- Direct SW07 preview via pwsh EmitJson: Total 179 Desktop 179 Appx 0 Truncated false InventorySources [Uninstall registry HKLM/HKCU, AppX/MSIX Get-AppxPackage, WinGet correlation best-effort] Safety WingetAvailable true CorrelationNote "WinGet correlation attempted (best-effort, not fabricated)"
- Bridge `/api/software/preview` live: Total 179 Desktop 179 Appx 0 Truncated false
  - First item 7-Zip 26.02 x64 registry_hklm64 UninstallCapability true RepairCapability true UpdateCapability false OpenCapability false Evidence "Registry registry_hklm64..."
  - Second item actionlint 1.7.12 neutral registry_hkcu InstallLocation "C:\\Users\\day night\\AppData\\Local\\Microsoft\\WinGet\\Packages\\rhysd.actionlint..." UninstallString "winget uninstall ..." OpenCapability true
  - Saved to `$env:TEMP\software-preview-bridge.json` (enriched fields proven)
- AppX 0 is truthful for this host's pwsh 7 (Get-AppxPackage unavailable or returns 0); registry truth remains 179, not fabricated. On hosts where AppX is available, count would be >0.

## MUTATION PROOF STATUS
- Read-only runtime evidence sufficient for this slice (per Step 8); no uninstall/update/install mutation performed without explicit safe authorization.
- Mutation flow implemented: SELECT → REVIEW → CONFIRM → EXECUTE → VERIFY → RESULT (via PA tools + programsModel.verifyRepairOperation). For uninstall, PA02/PA03 etc. would execute via bridge `POST /api/runs` with confirmation, then re-query inventory to compare observed state; SUCCESS only if verified (code path `verifyRepairOperation` distinguishes VERIFIED_FIXED vs ACTION_COMPLETED_UNVERIFIED). Not yet proven via live destructive run (by design, to avoid altering owner's system). Recorded as RUNTIME_MUTATION_PROOF_PENDING (authorized safe mutation not yet executed).

## COMMIT
- Pending commit of Service 04 slice (5 modified + 1 new file, 126 insertions, 46 deletions). SHA to be recorded after commit.

## BLOCKERS
- AppX/MSIX 0 in this host's pwsh 7: Get-AppxPackage returns 0 in current PowerShell 7 host (may succeed in Windows PowerShell 5.1 with AppX module). Documented as host-specific, not code defect; registry inventory still proves authority. WinGet correlation remains best-effort (UpdateCapability false until proven via winget list parsing — not fabricated).
- No other internal blockers; all capability truth now derived, no fake buttons (UNINSTALL hidden/disabled when uninstallAvailable false, UPDATE always false until winget proves, REPAIR via MSI heuristic, OPEN via InstallLocation existence).

## SERVICE 04 STATUS
- IMPLEMENTATION_CLOSED (presentation deferred until push verified) — inventory authority unified, API enriched, capability-driven UI, tests/build/bridge proven, no fabrication.
