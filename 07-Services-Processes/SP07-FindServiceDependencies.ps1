#Requires -Version 5.1
#  knoux Repair v2.0.2 | 07-Services-Processes | SP07 - Find Service Dependencies
#  Risk: READ_ONLY
#  Shows the dependency tree for a requested service or lists services
#  that have dependencies. Read-only.
[CmdletBinding()]
param(
    [switch]$AnalyzeOnly,
    [switch]$WhatIf,
    [string]$ServiceName   # Required for non-interactive execution
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP07' -ToolName 'Find Service Dependencies' -Category '07-Services-Processes' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $svcs = @(Get-Service -ErrorAction SilentlyContinue | Sort-Object Name)
    
    # Non-interactive execution: use ServiceName parameter
    if ([string]::IsNullOrWhiteSpace($ServiceName)) {
        Write-Error "ServiceName parameter is required for non-interactive execution."
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Missing ServiceName parameter'
        exit 1
    }
    
    $target = $ServiceName
    
    if ($WhatIf) {
        Write-Host "WhatIf: Would inspect service dependencies for: $ServiceName" -ForegroundColor Cyan
        Write-KnouxLog -Session $Session "WhatIf: Would inspect service dependencies for: $ServiceName"
        exit 0
    }
    
    if ($AnalyzeOnly) {
        Write-Host '[ANALYZE] Displaying service dependencies only (no changes).' -ForegroundColor Green
        Write-KnouxLog -Session $Session "Analyze: Displaying service dependencies"
    }

    $s = $svcs | Where-Object { $_.Name -eq $target } | Select-Object -First 1
    if (-not $s) {
        Write-Host ('[WARN] Service "{0}" not found.' -f $target) -ForegroundColor Yellow
        $Session.Status = 'Failed'
        $Session.ErrorMessage = "Service not found: $target"
    } else {
        Write-Host ('{0}  [{1}]' -f $s.DisplayName, $s.Status) -ForegroundColor Cyan
        Write-Host '  Depends on:'
        $req = @($s.RequiredServices)
        if ($req.Count -eq 0) { Write-Host '    (none)' }
        foreach ($r in $req) { Write-Host ('    - ' + $r.Name + '  [' + $r.Status + ']') }
        Write-Host '  Depended on by:'
        $deps = @($s.DependentServices)
        if ($deps.Count -eq 0) { Write-Host '    (none)' }
        foreach ($d in $deps) { Write-Host ('    - ' + $d.Name + '  [' + $d.Status + ']') }
    }

    $cim = @(Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue)
    $rows = @($cim | ForEach-Object { [pscustomobject]@{ Name = $_.Name; State = $_.State; StartMode = $_.StartMode } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'service-deps.csv') -NoTypeInformation -Encoding UTF8
    $Session.ItemsFound = $svcs.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Service dependency listing complete ($($svcs.Count) services)"
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
