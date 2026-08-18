#Requires -Version 5.1
# ============================================================
#  KnouxRepair.Reporting.psm1
#  knoux Repair v2.0.2 | Report export (EN + AR, UTF-8 BOM)
#  Every session folder contains EXACTLY seven entries:
#    operation.log, errors.log, results.json, results.csv,
#    summary-en.txt, summary-ar.txt, raw-output\
#  Tools writing auxiliary data must write inside raw-output\.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Status -> Arabic label used in the Arabic summary files.
$script:ArabicStatus = @{
    'Success'      = 'نجاح'
    'Warning'      = 'تحذير'
    'Failed'       = 'فشل'
    'Cancelled'    = 'أُلغي'
    'Skipped'      = 'تخطي'
    'Inconclusive' = 'غير حاسم'
}

# Ordered names of the seven allowed session entries.
$script:SessionSchema = @('operation.log', 'errors.log', 'results.json', 'results.csv', 'summary-en.txt', 'summary-ar.txt', 'raw-output')

# ============================================================
#  Test-KnouxReportSchema
#  Returns $true when the session directory contains exactly the
#  seven allowed entries and nothing else.
# ============================================================
function Test-KnouxReportSchema {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$SessionDir)
    if (-not (Test-Path -LiteralPath $SessionDir)) { return $false }
    $actual = @(Get-ChildItem -LiteralPath $SessionDir -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    if ($actual.Count -ne $script:SessionSchema.Count) { return $false }
    foreach ($e in $script:SessionSchema) {
        if ($actual -notcontains $e) { return $false }
    }
    return $true
}

# ============================================================
#  Export-KnouxReport
#  Writes the seven session entries. Returns the result object.
# ============================================================
function Export-KnouxReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Session
    )
    if (-not $Session) { throw 'Export-KnouxReport: session is null.' }
    if (-not $Session.FinishedAt) { $Session.FinishedAt = Get-Date }
    New-Item -ItemType Directory -Path $Session.SessionDir -Force | Out-Null
    New-Item -ItemType Directory -Path $Session.RawDir -Force | Out-Null
    if (-not (Test-Path -LiteralPath $Session.OpLog)) { Set-Content -LiteralPath $Session.OpLog -Value '' -Encoding UTF8 }
    if (-not (Test-Path -LiteralPath $Session.ErrLog)) { Set-Content -LiteralPath $Session.ErrLog -Value '' -Encoding UTF8 }

    $result = [pscustomobject]@{
        ToolId = $Session.ToolId
        ToolName = $Session.ToolName
        Category = $Session.Category
        RiskLevel = $Session.RiskLevel
        StartedAt = $Session.StartedAt.ToString('s')
        FinishedAt = $Session.FinishedAt.ToString('s')
        Duration = ($Session.FinishedAt - $Session.StartedAt).ToString('g')
        Status = $Session.Status
        ExitCode = $Session.ExitCode
        ChangedSystem = $Session.ChangedSystem
        RestartNeeded = $Session.RestartNeeded
        ItemsFound = $Session.ItemsFound
        ItemsProcessed = $Session.ItemsProcessed
        SkippedCount = $Session.SkippedCount
        QuarantinedCount = $Session.QuarantinedCount
        BytesPotentiallyRecoverable = $Session.BytesPotentiallyRecoverable
        BytesQuarantined = $Session.BytesQuarantined
        BytesPermanentlyDeleted = $Session.BytesPermanentlyDeleted
        BytesActuallyRecovered = $Session.BytesActuallyRecovered
        BytesMoved = $Session.BytesMoved
        BytesRecovered = $Session.BytesRecovered
        BackupPath = $Session.BackupPath
        QuarantinePath = $Session.QuarantinePath
        VerificationPerformed = $Session.VerificationPerformed
        VerificationResult = $Session.VerificationResult
        ReportPath = $Session.SessionDir
        ErrorMessage = $Session.ErrorMessage
    }
    $result | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $Session.SessionDir 'results.json') -Encoding UTF8
    $result | Export-Csv -LiteralPath (Join-Path $Session.SessionDir 'results.csv') -NoTypeInformation -Encoding UTF8

    $arStatus = 'غير معروف'
    if ($script:ArabicStatus.ContainsKey([string]$Session.Status)) { $arStatus = $script:ArabicStatus[[string]$Session.Status] }

    $verification = 'Not performed'
    if ($Session.VerificationPerformed) { $verification = $Session.VerificationResult }

    $summaryEn = @(
        'Knoux Repair v2.0.2 - Result',
        "Tool: $($Session.ToolId) - $($Session.ToolName)",
        "Category: $($Session.Category)  Risk: $($Session.RiskLevel)",
        "Status: $($Session.Status)",
        "Items found: $($Session.ItemsFound)  Items processed: $($Session.ItemsProcessed)",
        "Potentially recoverable: $(Format-KnouxSize $Session.BytesPotentiallyRecoverable)",
        "Quarantined: $(Format-KnouxSize $Session.BytesQuarantined) ($($Session.QuarantinedCount) items)",
        "Permanently deleted: $(Format-KnouxSize $Session.BytesPermanentlyDeleted)",
        "Actually recovered: $(Format-KnouxSize $Session.BytesActuallyRecovered)",
        "Moved: $(Format-KnouxSize $Session.BytesMoved)",
        "Verification: $verification",
        "Restart needed: $(if ($Session.RestartNeeded) {'Yes'} else {'No'})",
        "Backup path: $($Session.BackupPath)",
        "Report folder: $($Session.SessionDir)",
        "Error: $($Session.ErrorMessage)"
    ) -join [Environment]::NewLine
    $summaryEn | Out-File -LiteralPath (Join-Path $Session.SessionDir 'summary-en.txt') -Encoding UTF8

    $summaryAr = @(
        'Knoux Repair v2.0.2 - النتيجة',
        "الأداة: $($Session.ToolId) - $($Session.ToolName)",
        "الفئة: $($Session.Category)",
        "الحالة: $arStatus",
        "العناصر المكتشفة: $($Session.ItemsFound)  المعالجة: $($Session.ItemsProcessed)",
        "المساحة المسترجعة: $(Format-KnouxSize $Session.BytesRecovered)",
        "التحقق: $verification",
        "إعادة التشغيل مطلوبة: $(if ($Session.RestartNeeded) {'نعم'} else {'لا'})",
        "مسار التقرير: $($Session.SessionDir)"
    ) -join [Environment]::NewLine
    $summaryAr | Out-File -LiteralPath (Join-Path $Session.SessionDir 'summary-ar.txt') -Encoding UTF8

    return $result
}

Export-ModuleMember -Function Export-KnouxReport, Test-KnouxReportSchema
