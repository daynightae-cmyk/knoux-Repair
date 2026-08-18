# Package Inspection — knoux Repair v2.0.2

**Package:** `Knoux-Repair-Full-v2.0.2-English-Console.zip`  
**SHA-256:** See the external SHA-256 sidecar generated after the immutable ZIP was finalized.  
**Verified:** 2026-08-04 on Windows 10 Pro 19045 (Windows PowerShell 5.1)

## Verification Procedure

```powershell
# 1. Download the ZIP and the .sha256 file to the same folder
# 2. Compute hash of the ZIP
$computed = (Get-FileHash -LiteralPath 'Knoux-Repair-Full-v2.0.2-English-Console.zip' -Algorithm SHA256).Hash
# 3. Read expected hash from sidecar
$expected = (Get-Content -LiteralPath 'Knoux-Repair-Full-v2.0.2-English-Console.zip.sha256' -Raw).Trim()
# 4. Compare
$computed -eq $expected   # must be True
```

## Package Contents (from `Docs\FILE-INVENTORY.json`, regenerated 2026-08-04)

| Category | Files | Notes |
|----------|-------|-------|
| 01-System-Maintenance | 10 | SM01–SM10 |
| 02-System-Cleanup | 10 | SC01–SC10 |
| 03-Network-Internet | 10 | NI01–NI10 |
| 04-Programs-Applications | 10 | PA01–PA10 |
| 05-Duplicate-Files | 10 | DF01–DF10 |
| 06-Disk-Space | 10 | DS01–DS10 |
| 07-Services-Processes | 10 | SP01–SP10 |
| **08-Performance** | **10** | **PF01–PF10** |
| 09-Security | 10 | SE01–SE10 |
| 10-Diagnostics-Reports | 10 | DR01–DR10 |
| Core | 4 | Core, Safety, NativeCommands, Reporting (UTF-8 BOM) |
| Config | 5 | menus.json, settings.json, protected-paths.json, protected-processes.json, service-allowlist.json |
| Docs | 14 | AUDIT-AFTER/BEFORE, KNOWN-LIMITATIONS, RESTORE-GUIDE-AR/EN, SAFETY-MODEL, TEST-RESULTS, TOOLS-MANIFEST.csv/json, PACKAGE-INSPECTION, TOOLS-CATALOG-AR, ACCEPTANCE-REPORT, BUILD-VALIDATION-AR/EN (FILE-INVENTORY.json is the list itself) |
| Root | 6 | CHANGELOG.md, Menu.ps1, README-AR.md, README-EN.md, START-KNOUX-REPAIR.cmd, VERSION |
| Tests | 2 | Run-Tests.ps1, TEST-RESULTS.txt |

**Total:** 131 entries are listed in `FILE-INVENTORY.json` (which is the list itself and is
also shipped); the ZIP contains **132 files** — 100 tools + support files, no runtime dirs.

## Safety Checks — All Clear

| Check | Result |
|-------|--------|
| No `Reports/`, `Logs/`, `Quarantine/`, `Backups/`, `Scripts/` runtime data | ✅ Excluded |
| No legacy `KnouxRepair-Launcher.ps1` or `KnouxRepair.Manifest.json` | ✅ Excluded |
| No old `08-Power-Energy/PE*` tools | ✅ Replaced by `08-Performance/PF*` |
| No `SE06-DisableFirewall.ps1` | ✅ Removed; `SE06-RepairFirewall` is enable-only |
| No `SE03-RestartWindowsDefender.ps1` | ✅ Renamed to `SE03-RepairWindowsDefender` (enable + verify) |
| All 100 tools UTF-8 **with BOM** (PS 5.1 compatible) | ✅ Verified (test 04) |
| All 100 tools parse under Windows PowerShell 5.1 | ✅ Verified (test 05) |
| `menus.json` matches on-disk tools 1:1 | ✅ Verified (test 11) |
| RiskLevel header == Start-KnouxSession `-RiskLevel` param | ✅ Verified (test 36) |
| All tools return unified `$result = Stop-KnouxSession` | ✅ Verified (test 35) |
| All 100 tools behaviorally executed → `TestResult = PASS` | ✅ Verified (v2.0.2 harness + suite) |

## Functional Hardening Evidence (from Test Suite)

| Test | Criterion | Status |
|------|-----------|--------|
| 27 | No firewall-disable capability | PASS |
| 28 | No Defender stop/disable | PASS |
| 29 | No UAC-disable | PASS |
| 30 | Destructive data tools quarantine by default (no Remove-Item) | PASS |
| 31 | Quarantine move preserves item + metadata (SHA-256) | PASS |
| 32 | Quarantine restore verifies SHA-256 (round-trip) | PASS |
| 33 | Quarantine restore rejects tampered item | PASS |
| 34 | SM09 restores WU service start mode + running state | PASS |
| 37 | Invoke-KnouxCleanup defaults to quarantine | PASS |
| 38 | No Success-without-evidence (post-op verification gate) | PASS |
| 39–51 | Manifest schema validation (100 rows × 15 fields, enum/boolean/equivalence checks) | PASS |
| 54–60 | Exit-code contract (0–5) enforced by Stop-KnouxSession | PASS |
| 61–70 | Quarantine restore round-trips + interactive R/B/A/C paths | PASS |
| 71–81 | SC06/SM09/SM05/SM01/SM02/Menu/result/Arabic/Partial/SC06-target/inventory structural gates | PASS |
| 82–83 | NI01/NI10 degrade gracefully without CIM data (regression) | PASS |

**All 83 tests pass** (exit code 0) on Windows PowerShell 5.1 and pwsh. See
`Tests\TEST-RESULTS.txt` and `Docs\TEST-RESULTS.md`.

## Environment Limitations (not release blockers)

The following were **not executed** on the build machine and must be validated on the target
environment when applicable:

- Windows 11 / PowerShell 7 beyond 7.6.3
- Standard (non-admin) user session
- Fully offline machine (no network)
- Real system rollback after a repair run
- Manual menu-driven quarantine restore (automated SHA-256 round-trip covers the helper)
- Live SM09 Windows Update service reset/restore (requires admin)

Every tool has nevertheless been executed in this environment (non-elevated, network tools in
full mode) and validated. The NetAdapter CIM-class unavailability that made NI01/NI10
un-runnable was fixed — both now degrade gracefully (`Warning`) and are regression-tested
(tests 82/83).

## Verdict

**READY** for the acceptance checklist. The STOP-review criteria are implemented and tested
(83/83 green on both Windows PowerShell 5.1 and pwsh), all 100 tools are behaviorally validated
(manifest `TestResult = PASS`), and the package is immutable with an external SHA-256 sidecar.

---
*Generated by knoux Repair v2.0.2 packaging process (round-2).*
