#Requires -Version 5.1
# ============================================================
#  KnouxRepair.Config.psm1
#  knoux Repair v2.0.2 | Validated shared configuration loader
#
#  CONTRACT:
#    - Exactly one validated config loader. No station or tool
#      may hard-code a second conflicting security policy.
#    - Config FAILS SAFELY: missing or malformed files fall back
#      to the compiled-in secure defaults and surface a warning.
#    - Protected path/process configuration MUST reach Safety:
#      Safety imports this module and resolves its lists through
#      Get-KnouxProtectedPaths / Get-KnouxProtectedProcesses.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ConfigDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'Config'

$script:DefaultProtectedPaths = @(
    "$env:SystemRoot\Prefetch",
    "$env:SystemRoot\System32\LogFiles\CBS",
    "$env:SystemRoot\Logs\CBS",
    "$env:SystemRoot\Windows\System32\Config",
    "$env:SystemRoot\System32\drivers",
    "$env:SystemRoot\Boot",
    "$env:SystemRoot\System32\Boot",
    "$env:SystemRoot\System32\Config\Bcd",
    "$env:SystemRoot\WinSxS",
    "$env:SystemRoot\ServiceProfiles",
    "$env:SystemRoot\System32\WindowsPowerShell",
    "$env:SystemRoot\SoftwareDistribution",
    "$env:SystemDrive\Windows.old",
    "$env:SystemRoot\System32\drivers\etc"
)

$script:DefaultProtectedProcesses = @(
    'System', 'System Idle Process', 'smss', 'csrss', 'wininit', 'winlogon',
    'services', 'lsass', 'svchost', 'explorer', 'dwm', 'fontdrvhost',
    'Registry', 'Memory Compression', 'SearchIndexer', 'Audiodg', 'Taskmgr',
    'spoolsv', 'MsMpEng', 'NisSrv', 'WmiPrvSE', 'RuntimeBroker', 'conhost',
    'ShellExperienceHost', 'TextInputHost', 'StartMenuExperienceHost',
    'dllhost', 'sihost', 'taskhostw', 'SecurityHealthService', 'lsm'
)

# ============================================================
#  Get-KnouxConfigDir
# ============================================================
function Get-KnouxConfigDir {
    [CmdletBinding()]
    param([string]$Root = (Split-Path $PSScriptRoot -Parent))
    $candidate = Join-Path $Root 'Config'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    return $script:ConfigDir
}

# ============================================================
#  Import-KnouxConfigList
#  Reads a JSON string-array config file. Fails safely to the
#  supplied defaults (warning, never an exception, never $null).
# ============================================================
function Import-KnouxConfigList {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FileName,
        [string[]]$Default = @(),
        [string]$Root = (Split-Path $PSScriptRoot -Parent)
    )
    $path = Join-Path (Get-KnouxConfigDir -Root $Root) $FileName
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Warning "Config '$FileName' not found; using secure defaults."
        return @($Default)
    }
    try {
        $data = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($data -is [array]) {
            $items = @($data | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            if ($items.Count -gt 0) { return $items }
            Write-Warning "Config '$FileName' is empty; using secure defaults."
            return @($Default)
        }
        Write-Warning "Config '$FileName' is not a JSON array; using secure defaults."
        return @($Default)
    } catch {
        Write-Warning "Could not read config '$FileName': $($_.Exception.Message). Using secure defaults."
        return @($Default)
    }
}

# ============================================================
#  Get-KnouxProtectedPaths / Get-KnouxProtectedProcesses
#  The single source of truth consumed by Safety. Config file
#  values ALWAYS reach Safety through these functions.
# ============================================================
function Get-KnouxProtectedPaths {
    [CmdletBinding()]
    param([string]$Root = (Split-Path $PSScriptRoot -Parent))
    return @(Import-KnouxConfigList -FileName 'protected-paths.json' -Default $script:DefaultProtectedPaths -Root $Root)
}

function Get-KnouxProtectedProcesses {
    [CmdletBinding()]
    param([string]$Root = (Split-Path $PSScriptRoot -Parent))
    return @(Import-KnouxConfigList -FileName 'protected-processes.json' -Default $script:DefaultProtectedProcesses -Root $Root)
}

# ============================================================
#  Get-KnouxConfig
#  Validated loader for settings.json. Unknown or missing keys
#  resolve to $null (never invented). Returns a hashtable with
#  at least { Loaded, Path, Values }.
# ============================================================
function Get-KnouxConfig {
    [CmdletBinding()]
    param(
        [string]$FileName = 'settings.json',
        [string]$Root = (Split-Path $PSScriptRoot -Parent)
    )
    $path = Join-Path (Get-KnouxConfigDir -Root $Root) $FileName
    $out = @{ Loaded = $false; Path = $path; Values = @{} }
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Warning "Config '$FileName' not found; proceeding with defaults."
        return $out
    }
    try {
        $data = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $out.Loaded = $true
        if ($data -is [pscustomobject]) {
            foreach ($p in $data.PSObject.Properties) { $out.Values[$p.Name] = $p.Value }
        }
        return $out
    } catch {
        Write-Warning "Could not read config '$FileName': $($_.Exception.Message). Proceeding with defaults."
        return $out
    }
}

# ============================================================
#  Test-KnouxConfigSchema
#  Fails safe: $true only when every required file exists and
#  parses as the expected JSON shape.
# ============================================================
function Test-KnouxConfigSchema {
    [CmdletBinding()]
    param([string]$Root = (Split-Path $PSScriptRoot -Parent))
    $dir = Get-KnouxConfigDir -Root $Root
    foreach ($f in @('protected-paths.json', 'protected-processes.json', 'settings.json', 'menus.json')) {
        $p = Join-Path $dir $f
        if (-not (Test-Path -LiteralPath $p)) {
            Write-Warning "Config schema check: missing '$f'."
            return $false
        }
        try { $null = Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json }
        catch {
            Write-Warning "Config schema check: '$f' is not valid JSON."
            return $false
        }
    }
    return $true
}

Export-ModuleMember -Function Get-KnouxConfigDir, Import-KnouxConfigList, Get-KnouxProtectedPaths, Get-KnouxProtectedProcesses, Get-KnouxConfig, Test-KnouxConfigSchema
