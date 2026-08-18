#Requires -Version 5.1
#  knoux Repair v2.0.2 | 10-Diagnostics-Reports | DR04 - Reliability Report
#  Risk: READ_ONLY
#  Summarizes Windows reliability records from Win32_ReliabilityRecords
#  (crashes, warnings, failures) over the last N days.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR04' -ToolName 'Reliability Report' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $records = @(Get-CimInstance -ClassName Win32_ReliabilityRecords -ErrorAction SilentlyContinue | Where-Object { $_.TimeGenerated -gt (Get-Date).AddDays(-14) } | Sort-Object TimeGenerated -Descending)
    if ($records.Count -eq 0) {
        Write-Host '[OK] No reliability issues recorded in the last 14 days.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'Reliability: no issues in last 14 days'
    } else {
        $byType = $records | Group-Object EventIdentifier | Sort-Object Count -Descending | Select-Object -First 10
        Write-Host ('{0} reliability event(s) in the last 14 days:' -f $records.Count) -ForegroundColor Cyan
        foreach ($g in $byType) {
            $desc = ($records | Where-Object { $_.EventIdentifier -eq $g.Name } | Select-Object -First 1).Message
            if ($desc.Length -gt 90) { $desc = $desc.Substring(0, 87) + '...' }
            Write-Host ('  x{0,-4}  {1}' -f $g.Count, $desc) -ForegroundColor Yellow
        }
        $rows = @($records | Select-Object -First 50 | ForEach-Object { [pscustomobject]@{ Time = $_.TimeGenerated; Id = $_.EventIdentifier; Type = $_.ProductName; Message = $_.Message } })
        $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'reliability.csv') -NoTypeInformation -Encoding UTF8
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'reliability.json') -Encoding UTF8
        $Session.ItemsFound = $records.Count
        $Session.ItemsProcessed = 1
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session "Reliability: $($records.Count) events in last 14 days"
    }
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
