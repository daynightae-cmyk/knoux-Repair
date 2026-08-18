#Requires -Version 5.1
#  knoux Repair v2.0.2 | 08-Performance | PF06 - Scheduled Tasks Review
#  Risk: READ_ONLY
#  Reviews scheduled tasks, flagging tasks that failed to run or
#  tasks that are enabled and might affect responsiveness.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF06' -ToolName 'Scheduled Tasks Review' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Disabled' })
    $missed = 0
    $rows = @()
    foreach ($t in $tasks) {
        $last = $null
        $next = $null
        try {
            $info = $t | Get-ScheduledTaskInfo -ErrorAction Stop
            if ($info) { $last = $info.LastRunTime; $next = $info.NextRunTime }
        } catch {
            Write-KnouxLog -Session $Session -Message ("Could not read task info for '{0}': {1}" -f $t.TaskName, $_.Exception.Message) 'WARN'
        }
        $failed = $false
        if ($last -and $last -lt (Get-Date).AddDays(-7) -and $next -eq $null) { $failed = $true; $missed++ }
        $rows += [pscustomobject]@{
            TaskName = $t.TaskName
            TaskPath = $t.TaskPath
            State = "$($t.State)"
            LastRunTime = if ($last) { $last.ToString('s') } else { $null }
            NextRunTime = if ($next) { $next.ToString('s') } else { $null }
            Suspect = $failed
        }
    }

    Write-Host ('Enabled scheduled tasks: {0}   (suspect/not scheduled: {1})' -f $rows.Count, $missed) -ForegroundColor Cyan
    $rows | Select-Object -First 25 | ForEach-Object {
        Write-Host ('  {0,-40} {1,-10} last {2}' -f $_.TaskName, $_.State, $(if ($_.LastRunTime) { $_.LastRunTime } else { 'never' })) -ForegroundColor $(if ($_.Suspect) { 'Yellow' } else { 'DarkGray' })
    }

    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'scheduled-tasks.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = $rows.Count
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Scheduled tasks reviewed: {0}, suspect {1}" -f $rows.Count, $missed)
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
