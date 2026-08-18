#Requires -Version 5.1
# ============================================================
#  knoux Repair v2.0.2 | Menu.ps1
#  Interactive menu for all 100 tools with full navigation contract.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'knoux Repair v2.0.2'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigDir = Join-Path $ProjectRoot 'Config'
$menuPath = Join-Path $ConfigDir 'menus.json'

if (-not (Test-Path -LiteralPath $menuPath)) {
    Write-Host '[FATAL] Config\menus.json not found.' -ForegroundColor Red
    exit 1
}
$menu = Get-Content -LiteralPath $menuPath -Raw -Encoding UTF8 | ConvertFrom-Json

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$analyzeOnly = $false

# Single-operation lock
$script:OperationLock = $false

function Show-Header {
    Write-Host ''
    Write-Host '  ==================================================' -ForegroundColor Cyan
    Write-Host '   knoux Repair v2.0.2  |  Windows Maintenance Suite' -ForegroundColor Cyan
    Write-Host '  ==================================================' -ForegroundColor Cyan
    Write-Host ('   Console: {0}  |  Tools: {1}' -f $(if ($isAdmin) { 'ADMIN' } else { 'standard' }), ($menu | ForEach-Object { $_.Tools.Count } | Measure-Object -Sum).Sum)
    Write-Host '   Tip: right-click -> Run as administrator for full functionality' -ForegroundColor DarkGray
}

function Show-Category {
    param([int]$Index)
    $cat = $menu[$Index]
    Clear-Host
    Show-Header
    Write-Host ('  {0}' -f $cat.Category) -ForegroundColor Yellow
    Write-Host '  ------------------------------------------------' -ForegroundColor DarkGray
    $i = 0
    foreach ($t in $cat.Tools) {
        $i++
        $mark = if ($t.RequiresAdmin) { ' [ADMIN]' } else { '' }
        $risk = switch ($t.Risk) {
            'READ_ONLY' { 'RO' }
            'SAFE_CLEANUP' { 'SC' }
            'SYSTEM_REPAIR' { 'SR' }
            'DESTRUCTIVE' { 'DX' }
            'REBOOT_REQUIRED' { 'RB' }
            'WINRE_ONLY' { 'WR' }
            default { '??' }
        }
        Write-Host ('   {0,2}. [{1}] {2} - {3}{4}' -f $i, $risk, $t.Id, $t.Name, $mark) -ForegroundColor Gray
    }
    Write-Host '  ------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '   B. Back to main menu' -ForegroundColor Gray
    Write-Host '   H. Home (main menu)' -ForegroundColor Gray
    Write-Host '   Q. Quit' -ForegroundColor Gray
}

function Run-Tool {
    param($Tool, $CategoryFolder)
    $scriptPath = Join-Path (Join-Path $ProjectRoot $CategoryFolder) $Tool.File
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Write-Host ('[ERROR] Missing: {0}' -f $scriptPath) -ForegroundColor Red
        return
    }
    if ($Tool.RequiresAdmin -and -not $isAdmin) {
        Write-Host '[INFO] This tool requires administrator rights.' -ForegroundColor Yellow
        $r = Read-Host 'Relaunch elevated now? [Y/N]: '
        if ($r -match '^(y|yes)$') {
            $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$scriptPath`"")
            Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Verb RunAs
            return
        } else {
            Write-Host 'Skipping (running as standard user).' -ForegroundColor Gray
            return
        }
    }
    if ($script:OperationLock) {
        Write-Host '[ERROR] Another tool is already running. Please wait.' -ForegroundColor Red
        Read-Host 'Press Enter to continue...' | Out-Null
        return
    }
    $script:OperationLock = $true
    Clear-Host
    try {
        if ($analyzeOnly) {
            & $scriptPath -AnalyzeOnly
        } else {
            & $scriptPath
        }
    } finally {
        $script:OperationLock = $false
    }
}

function Show-Reports {
    Clear-Host
    Show-Header
    $reportsDir = Join-Path $ProjectRoot 'Reports'
    $latest = @(Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 20)
    if ($latest.Count -eq 0) {
        Write-Host '  No reports yet.' -ForegroundColor Gray
    } else {
        Write-Host '  Recent reports:' -ForegroundColor Cyan
        $i = 0
        foreach ($r in $latest) {
            $i++
            Write-Host ('   {0,2}. {1}' -f $i, $r.Name) -ForegroundColor Gray
        }
        Write-Host ''
        Write-Host '  R. Open Reports folder in Explorer' -ForegroundColor Gray
        Write-Host '   B. Back to main menu' -ForegroundColor Gray
        Write-Host '   H. Home (main menu)' -ForegroundColor Gray
        Write-Host '   Q. Quit' -ForegroundColor Gray
        Write-Host ''
        $sel = Read-Host 'Selection'
        if ($sel -eq 'R' -or $sel -eq 'r') {
            if (Test-Path -LiteralPath $reportsDir) {
                Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$reportsDir`""
                Write-Host '[OK] Reports folder opened in Explorer.' -ForegroundColor Green
            } else {
                Write-Host '[ERROR] Reports folder not found.' -ForegroundColor Red
            }
            Read-Host 'Press Enter to continue...' | Out-Null
        }
    }
}

function Show-Paged {
    param(
        [object[]]$Items,
        [string]$Title,
        [int]$PageSize = 20
    )
    $total = $Items.Count
    $pages = [Math]::Ceiling($total / $PageSize)
    $page = 1
    while ($true) {
        Clear-Host
        Show-Header
        Write-Host ('  {0} (page {1}/{2})' -f $Title, $page, $pages) -ForegroundColor Yellow
        Write-Host '  ------------------------------------------------' -ForegroundColor DarkGray
        $start = ($page - 1) * $PageSize
        $end = [Math]::Min($start + $PageSize - 1, $total - 1)
        for ($i = $start; $i -le $end; $i++) {
            $item = $Items[$i]
            Write-Host ('   {0,2}. {1}' -f ($i + 1), $item) -ForegroundColor Gray
        }
        Write-Host '  ------------------------------------------------' -ForegroundColor DarkGray
        Write-Host '  N. Next page  |  P. Previous page  |  B. Back  |  H. Home  |  Q. Quit' -ForegroundColor DarkGray
        Write-Host ''
        $sel = Read-Host 'Selection'
        if ($sel -eq 'N' -or $sel -eq 'n') { if ($page -lt $pages) { $page++ } }
        elseif ($sel -eq 'P' -or $sel -eq 'p') { if ($page -gt 1) { $page-- } }
        elseif ($sel -eq 'B' -or $sel -eq 'b') { break }
        elseif ($sel -eq 'H' -or $sel -eq 'h') { return 'HOME' }
        elseif ($sel -eq 'Q' -or $sel -eq 'q') { exit }
    }
}

# ============================================================
#  Main loop
# ============================================================
while ($true) {
    Clear-Host
    Show-Header
    Write-Host '  ------------------------------------------------' -ForegroundColor DarkGray
    $i = 0
    foreach ($cat in $menu) {
        $i++
        Write-Host ('   {0,2}. {1}' -f $i, $cat.Category) -ForegroundColor White
    }
    Write-Host '  ------------------------------------------------' -ForegroundColor DarkGray
    Write-Host ('   R. View recent reports') -ForegroundColor Gray
    Write-Host ('   A. Analyze-only mode: {0}' -f $(if ($analyzeOnly) { 'ON  (no changes made)' } else { 'off' })) -ForegroundColor $(if ($analyzeOnly) { 'Yellow' } else { 'Gray' })
    Write-Host '   Q. Quit' -ForegroundColor Gray
    Write-Host ''
    $choice = Read-Host 'Selection'

    if ($choice -eq 'Q' -or $choice -eq 'q') { Clear-Host; break }
    if ($choice -eq 'R' -or $choice -eq 'r') { Show-Reports; continue }
    if ($choice -eq 'A' -or $choice -eq 'a') { $analyzeOnly = -not $analyzeOnly; continue }

    $catIndex = 0
    if ([int]::TryParse($choice, [ref]$catIndex) -and $catIndex -ge 1 -and $catIndex -le $menu.Count) {
        $cat = $menu[$catIndex - 1]
        while ($true) {
            Show-Category -Index ($catIndex - 1)
            Write-Host ''
            $sel = Read-Host 'Tool number (or 0/B for back, H for home, Q to quit)'
            if ($sel -eq '0' -or $sel -eq 'B' -or $sel -eq 'b') { break }
            if ($sel -eq 'H' -or $sel -eq 'h') { break 2 }
            if ($sel -eq 'Q' -or $sel -eq 'q') { Clear-Host; exit }
            $toolIndex = 0
            if ([int]::TryParse($sel, [ref]$toolIndex) -and $toolIndex -ge 1 -and $toolIndex -le $cat.Tools.Count) {
                Run-Tool -Tool $cat.Tools[$toolIndex - 1] -CategoryFolder $cat.Folder
            }
        }
    }
}
Write-Host 'Goodbye.' -ForegroundColor Green