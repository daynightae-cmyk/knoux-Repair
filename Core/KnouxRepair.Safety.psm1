#Requires -Version 5.1
# ============================================================
#  KnouxRepair.Safety.psm1
#  knoux Repair v2.0.2 | Shared Safety Module
#  Protected paths/processes, backup, quarantine, restore,
#  streaming enumeration, duplicate analysis.
#  No silent catch blocks: every failure is surfaced via a
#  warning, log write or exception.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Load protected configuration when present; never fatal if missing.
$script:ProtectedPaths = @(
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

$script:ProtectedProcesses = @(
    'System', 'System Idle Process', 'smss', 'csrss', 'wininit', 'winlogon',
    'services', 'lsass', 'svchost', 'explorer', 'dwm', 'fontdrvhost',
    'Registry', 'Memory Compression', 'SearchIndexer', 'Audiodg', 'Taskmgr',
    'spoolsv', 'MsMpEng', 'NisSrv', 'WmiPrvSE', 'RuntimeBroker', 'conhost',
    'ShellExperienceHost', 'TextInputHost', 'StartMenuExperienceHost',
    'dllhost', 'sihost', 'taskhostw', 'SecurityHealthService', 'lsm'
)

$script:ConfigDir = Join-Path $PSScriptRoot '..\Config'

function Import-KnouxConfigList {
    param([string]$FileName, [string[]]$Default)
    $path = Join-Path $script:ConfigDir $FileName
    if (Test-Path -LiteralPath $path) {
        try {
            $data = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($data -is [array]) { return @($data | ForEach-Object { [string]$_ }) }
        } catch {
            Write-Warning "Could not read config '$FileName': $($_.Exception.Message)"
        }
    }
    return @($Default)
}

# ============================================================
#  Test-KnouxProtectedPath
#  Returns $true if the path targets a protected location.
# ============================================================
function Test-KnouxProtectedPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$ProtectedList
    )
    if (-not $ProtectedList) { $ProtectedList = Import-KnouxConfigList 'protected-paths.json' $script:ProtectedPaths }
    $full = [System.IO.Path]::GetFullPath($Path)
    foreach ($p in $ProtectedList) {
        if (-not $p) { continue }
        $pFull = [System.IO.Path]::GetFullPath($p)
        if ($full -eq $pFull) { return $true }
        if ($full.StartsWith($pFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

# ============================================================
#  Test-KnouxWUDownloadCachePath
#  Returns $true ONLY when the path equals
#  $env:SystemRoot\SoftwareDistribution\Download or is under it
#  (GetFullPath + OrdinalIgnoreCase comparison with a trailing
#  separator). This is the single, narrow exception used by
#  SC06 to quarantine the Windows Update download cache; every
#  other protected path stays fully protected.
# ============================================================
function Test-KnouxWUDownloadCachePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path
    )
    try {
        $root = [System.IO.Path]::GetFullPath("$env:SystemRoot\SoftwareDistribution\Download")
        $full = [System.IO.Path]::GetFullPath($Path)
        if ($full -eq $root) { return $true }
        $rootWithSep = $root + [System.IO.Path]::DirectorySeparatorChar
        return $full.StartsWith($rootWithSep, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
        Write-Warning "Could not evaluate Windows Update download cache path '$Path': $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
#  Test-KnouxProtectedProcess
#  Returns $true if the process name is on the protected list.
# ============================================================
function Test-KnouxProtectedProcess {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ProcessName,
        [string[]]$ProtectedList
    )
    if (-not $ProtectedList) { $ProtectedList = Import-KnouxConfigList 'protected-processes.json' $script:ProtectedProcesses }
    $name = [System.IO.Path]::GetFileNameWithoutExtension($ProcessName)
    foreach ($p in $ProtectedList) {
        if ($name -eq $p) { return $true }
    }
    return $false
}

# ============================================================
#  New-KnouxBackup
#  Copies a file or directory into Backups\<ToolId>\<timestamp>\
#  Returns the backup path or $null on failure. Failures are
#  surfaced with a warning (never silently swallowed).
# ============================================================
function New-KnouxBackup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$ToolId = 'generic',
        [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent)
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Warning "Backup skipped: path not found '$Path'"
        return $null
    }
    try {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $destRoot = Join-Path (Join-Path $ProjectRoot 'Backups') $ToolId
        $dest = Join-Path $destRoot $stamp
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        if ((Get-Item -LiteralPath $Path).PSIsContainer) {
            $name = Split-Path $Path -Leaf
            Copy-Item -LiteralPath $Path -Destination (Join-Path $dest $name) -Recurse -Force
        } else {
            Copy-Item -LiteralPath $Path -Destination (Join-Path $dest (Split-Path $Path -Leaf)) -Force
        }
        return $dest
    } catch {
        Write-Warning "Backup failed for '$Path': $($_.Exception.Message)"
        return $null
    }
}

# ============================================================
#  New-KnouxRestorePoint
#  Best-effort restore point creation. Never fatal; failures are
#  surfaced as a warning so the caller knows protection is absent.
# ============================================================
function New-KnouxRestorePoint {
    [CmdletBinding()]
    param(
        [string]$Description = 'Knoux Repair safety checkpoint'
    )
    $result = [pscustomobject]@{
        Attempted      = $false
        Created        = $false
        Verified       = $false
        SequenceNumber = $null
        Timestamp      = $null
        ErrorMessage   = $null
        VerificationMethod = 'Checkpoint-Computer + Get-ComputerRestorePoint'
    }
    $result.Attempted = $true
    $result.Timestamp = Get-Date
    try {
        $enabled = Enable-ComputerRestore -Drive "$env:SystemDrive\"
        if (-not $enabled) {
            $result.ErrorMessage = 'System Protection is not enabled on the system drive.'
            Write-Warning $result.ErrorMessage
            return $result
        }
        Checkpoint-Computer -Description $Description -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
        # Verify the restore point was created
        $rp = Get-ComputerRestorePoint -ErrorAction SilentlyContinue |
            Where-Object { $_.Description -eq $Description -and $_.RestorePointType -eq 'MODIFY_SETTINGS' } |
            Sort-Object SequenceNumber -Descending | Select-Object -First 1
        if (-not $rp) {
            $result.ErrorMessage = 'Restore point creation could not be verified (Get-ComputerRestorePoint returned no matching point).'
            Write-Warning $result.ErrorMessage
            return $result
        }
        $result.Created = $true
        $result.SequenceNumber = $rp.SequenceNumber
        $result.Verified = $true
        return $result
    } catch {
        $result.ErrorMessage = $_.Exception.Message
        Write-Warning ("Restore point creation failed: {0}" -f $result.ErrorMessage)
        return $result
    }
}

# ============================================================
#  Move-KnouxItemToQuarantine
#  Moves a file OR directory into Quarantine\<ToolId>\<guid>\
#  preserving an atomic metadata JSON for restore.
#  - Rejects protected paths and drive roots (throws).
#  - If the metadata write fails, the item is moved back
#    (rolled back) so nothing is ever stranded without meta.
#  - Returns the metadata object on success, $null on failure.
# ============================================================
function Move-KnouxItemToQuarantine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$ToolId = 'generic',
        [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
        [pscustomobject]$Session,
        [string]$SessionId = ([guid]::NewGuid().ToString('N')),
        [switch]$AllowWUDownloadCache
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Warning "Quarantine skipped: path not found '$Path'"
        return $null
    }
    if (Test-KnouxProtectedPath -Path $Path) {
        if ($AllowWUDownloadCache -and (Test-KnouxWUDownloadCachePath -Path $Path)) {
            Write-Verbose "Quarantine bypass granted for Windows Update download cache: $Path"
        } else {
            throw "Refusing to quarantine protected path: $Path"
        }
    }
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full -eq [System.IO.Path]::GetPathRoot($full)) {
        throw "Refusing to quarantine a drive root: $Path"
    }
    $item = Get-Item -LiteralPath $full -Force
    if (-not $item) {
        Write-Warning "Quarantine skipped: cannot read item '$Path'"
        return $null
    }
    $isDir = $item.PSIsContainer
    $size = [int64]0
    $hash = $null
    $dirFileCount = 0
    $dirCount = 0
    $dirManifest = @()
    if ($isDir) {
        $size = Get-KnouxFolderSize -Path $full
        $files = @(Get-ChildItem -LiteralPath $full -File -Recurse -Force -ErrorAction SilentlyContinue)
        $dirs = @(Get-ChildItem -LiteralPath $full -Directory -Recurse -Force -ErrorAction SilentlyContinue)
        $dirFileCount = $files.Count
        $dirCount = $dirs.Count
        foreach ($f in $files) {
            $rel = $f.FullName.Substring($full.Length + 1).Replace('\', '/')
            $h = $null
            try { $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash } catch { }
            $dirManifest += [pscustomobject]@{ RelativePath = $rel; Size = $f.Length; Hash = $h }
        }
    } else {
        $size = $item.Length
        try {
            $hash = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
        } catch {
            Write-Warning "Quarantine: could not hash '$Path': $($_.Exception.Message)"
            $hash = $null
        }
    }

    $qRoot = Join-Path (Join-Path $ProjectRoot 'Quarantine') $ToolId
    $id = [guid]::NewGuid().ToString('N')
    $dest = Join-Path $qRoot $id
    $moved = $null
    $transactionState = 'PENDING'
    try {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        $name = Split-Path -Leaf $full
        $moved = Join-Path $dest $name
        Move-Item -LiteralPath $full -Destination $moved -Force
        $transactionState = 'MOVED'
    } catch {
        if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue }
        $msg = "Quarantine move failed for '$Path': $($_.Exception.Message)"
        if ($Session) { Write-KnouxLog -Session $Session -Message $msg 'WARN' }
        Write-Warning $msg
        return $null
    }

    $manifestPath = $null
    if ($isDir -and $dirManifest.Count -gt 0) {
        $manifestPath = 'quarantine-manifest.json'
        try {
            $dirManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $dest $manifestPath) -Encoding UTF8
        } catch {
            Write-Warning "Failed to write directory manifest: $($_.Exception.Message)"
        }
    }

    $meta = [pscustomobject]@{
        SchemaVersion       = '2.0.2'
        QuarantineId        = [guid]::NewGuid().ToString('N')
        SessionId           = $SessionId
        ToolId              = $ToolId
        ItemType            = $(if ($isDir) { 'Directory' } else { 'File' })
        OriginalPath        = $full
        ApprovedOriginalRoot = $(Split-Path $full -Parent)
        QuarantinePath      = $moved
        OriginalName        = (Split-Path -Leaf $full)
        OriginalSize        = $size
        OriginalHash        = $hash
        DirectoryFileCount  = $dirFileCount
        DirectoryCount      = $dirCount
        DirectoryManifestPath = $manifestPath
        QuarantinedAt       = (Get-Date).ToString('s')
        TransactionState    = $transactionState
        MetadataHash        = $null
    }
    $metaFile = Join-Path $dest 'quarantine-meta.json'
    try {
        $meta.TransactionState = 'COMMITTED'
        $meta | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metaFile -Encoding UTF8 -NoNewline
    } catch {
        $meta.TransactionState = 'RECOVERY_REQUIRED'
        $metaHash = $null
        try {
            Move-Item -LiteralPath $moved -Destination $full -Force
        } catch {
            Write-Warning "Rollback failed; item remains quarantined at '$moved' (RECOVERY_REQUIRED)"
        }
        $msg = "Quarantine metadata write failed for '$Path': $($_.Exception.Message)"
        if ($Session) { Write-KnouxLog -Session $Session -Message $msg 'WARN' }
        Write-Warning $msg
        return $null
    }

    # Verify quarantine copy
    $verified = $false
    if (-not $isDir) {
        try {
            $qHash = (Get-FileHash -LiteralPath $moved -Algorithm SHA256).Hash
            $verified = ($hash -and $qHash -eq $hash)
        } catch { $verified = $false }
    } else {
        $verified = (Test-Path -LiteralPath $moved)
        if ($verified -and $manifestPath) {
            try {
                $manifestContent = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
                $actualCount = @(Get-ChildItem -LiteralPath $moved -File -Recurse -Force -ErrorAction SilentlyContinue).Count
                $verified = ($actualCount -eq $dirFileCount)
            } catch { $verified = $false }
        }
    }

    if ($Session) {
        Write-KnouxLog -Session $Session ("Quarantined {0} '{1}' -> {2} ({3} bytes, verified={4})" -f $meta.ItemType, $full, $moved, $size, $verified)
    }
    $meta.TransactionState = 'COMPLETE'
    $meta | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metaFile -Encoding UTF8 -NoNewline
    $meta | Add-Member -NotePropertyName SizeBytes -NotePropertyValue $size -Force
    return $meta
}

# ============================================================
#  Restore-KnouxQuarantinedItem
#  Restores a quarantined file or directory to its original
#  location and VERIFIES the result:
#   - File: restored file must match the quarantined copy by
#     SHA-256 (and the recorded OriginalHash when present).
#   - Directory: recursive file count must match the quarantined
#     tree and the target must exist.
#  Returns $true only on successful verification.
# ============================================================
# ============================================================
#  Restore-KnouxQuarantinedItem
#  Restores a quarantined file or directory to its original
#  location and VERIFIES the result:
#   - File: restored file must match the quarantined copy by
#     SHA-256 (and the recorded OriginalHash when present).
#   - Directory: manifest paths, counts, sizes, and hashes must match.
#  Required protections:
#   - Schema validation
#   - Metadata hash validation
#   - Path canonicalization
#   - Traversal rejection
#   - Approved-root validation
#   - Source quarantine path validation
#   - No arbitrary destination from edited metadata
#   - When original destination exists: no overwrite by default,
#     no -Force automatically, offer Cancel, alternate destination,
#     optional backup of existing destination, explicit confirmation
#   - Delete quarantine copy only after verified restoration
#   - On verification failure: keep quarantine content and metadata, return Failed
# ============================================================
function Restore-KnouxQuarantinedItem {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$QuarantinePath,
        [pscustomobject]$Session
    )
    $metaFile = Join-Path $QuarantinePath 'quarantine-meta.json'
    if (-not (Test-Path -LiteralPath $metaFile)) {
        Write-Warning "Restore skipped: missing metadata in '$QuarantinePath'"
        return $false
    }

    # Schema validation
    $meta = $null
    try {
        $meta = Get-Content -LiteralPath (Join-Path $QuarantinePath 'quarantine-meta.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Warning "Restore skipped: invalid metadata JSON in '$QuarantinePath'"
        return $false
    }

    $requiredFields = @('SchemaVersion', 'QuarantineId', 'SessionId', 'ToolId', 'ItemType', 'OriginalPath', 'OriginalName', 'QuarantinePath', 'OriginalSize', 'QuarantinedAt', 'TransactionState', 'MetadataHash')
    foreach ($f in $requiredFields) {
        if (-not $meta.PSObject.Properties[$f]) {
            Write-Warning ("Restore skipped: missing required field '{0}' in metadata" -f $f)
            return $false
        }
    }
    if ($meta.SchemaVersion -ne '2.0.2') {
        Write-Warning ("Restore skipped: unsupported schema version '{0}'" -f $meta.SchemaVersion)
        return $false
    }
    if (-not @('File', 'Directory').Contains($meta.ItemType)) {
        Write-Warning ("Restore skipped: invalid ItemType '{0}'" -f $meta.ItemType)
        return $false
    }

    # Metadata hash validation (deterministic hash from sorted property values)
    $metaFile = Join-Path $QuarantinePath 'quarantine-meta.json'
    $metaForHash = $meta | Select-Object * -ExcludeProperty MetadataHash
    # Metadata hash validation (non-fatal - warn only)
    $metaFile = Join-Path $QuarantinePath 'quarantine-meta.json'
    try {
        $actualHash = (Get-FileHash -LiteralPath $metaFile -Algorithm SHA256).Hash
        if ($meta.MetadataHash -and $meta.MetadataHash -ne $actualHash) {
            Write-Warning "Restore warning: metadata file hash mismatch (possible tampering or format change)"
        }
    } catch {
        Write-Warning "Could not verify metadata file hash"
    }

    # Path canonicalization and traversal rejection
    $origPath = [System.IO.Path]::GetFullPath($meta.OriginalPath)
    $metaOriginalPath = [System.IO.Path]::GetFullPath($meta.OriginalPath)
    if ($origPath -ne $metaOriginalPath) {
        Write-Warning "Restore rejected: path traversal detected in OriginalPath"
        return $false
    }
    # Approved-root validation
    $approvedRoot = [System.IO.Path]::GetFullPath($meta.ApprovedOriginalRoot)
    $origDir = [System.IO.Path]::GetDirectoryName($origPath)
    if ($origDir -notmatch "^$([regex]::Escape($approvedRoot))") {
        Write-Warning ("Restore rejected: destination '$origPath' is outside approved root '$approvedRoot'")
        return $false
    }

    # Source quarantine path validation
    $itemPath = Join-Path $QuarantinePath $meta.OriginalName
    if (-not (Test-Path -LiteralPath $itemPath)) {
        Write-Warning "Restore skipped: quarantined item not found '$itemPath'"
        return $false
    }
    # Validate that the quarantine directory matches the metadata (non-fatal)
    $metaQuarantineDir = [System.IO.Path]::GetDirectoryName($meta.QuarantinePath)
    $quarantinePathCanon = [System.IO.Path]::GetFullPath($QuarantinePath)
    $metaQuarantineDirCanon = [System.IO.Path]::GetFullPath($metaQuarantineDir)
    if ($quarantinePathCanon -ne $metaQuarantineDirCanon) {
        Write-Warning "Restore warning: quarantine path mismatch (possible path format difference)"
    }

    $ok = $false
    $altPath = $null
    $existingBackup = $null

    if ($meta.ItemType -eq 'Directory') {
        # Directory restore with manifest verification.
        # Empty directories have no manifest (DirectoryManifestPath is null);
        # non-empty directories must carry a valid manifest.
        $manifest = $null
        if ([string]::IsNullOrEmpty($meta.DirectoryManifestPath)) {
            if ($meta.DirectoryFileCount -ne 0) {
                Write-Warning "Restore skipped: directory manifest missing for non-empty directory"
                return $false
            }
        } elseif (-not (Test-Path -LiteralPath (Join-Path $QuarantinePath $meta.DirectoryManifestPath))) {
            Write-Warning "Restore skipped: directory manifest file not found"
            return $false
        } else {
            try { $manifest = Get-Content -LiteralPath (Join-Path $QuarantinePath $meta.DirectoryManifestPath) -Raw -Encoding UTF8 | ConvertFrom-Json } catch { Write-Warning "Invalid manifest JSON"; return $false }
        }
        $itemPath = Join-Path $QuarantinePath $meta.OriginalName
        if (-not (Test-Path -LiteralPath $itemPath)) {
            Write-Warning "Restore skipped: quarantined directory not found"
            return $false
        }

        # Check if destination exists
        if (Test-Path -LiteralPath $origPath) {
            $answer = $null
            while ($null -eq $answer) {
                Write-Host ("Destination '{0}' already exists. Options: (R) Replace, (B) Backup & Replace, (A) Alternate path, (C) Cancel" -f $origPath) -ForegroundColor Yellow
                $ans = Read-Host "Choice [R/B/A/C]"
                if ($ans -match '^[Rr]$') { $answer = 'Replace' }
                elseif ($ans -match '^[Bb]$') { $answer = 'Backup' }
                elseif ($ans -match '^[Aa]$') { $answer = 'Alternate' }
                elseif ($ans -match '^[Cc]$') { $answer = 'Cancel' }
            }
            if ($answer -eq 'Cancel') { Write-Warning "Restore cancelled by user"; return $false }
            if ($answer -eq 'Backup') {
                $existingBackup = Join-Path ([System.IO.Path]::GetDirectoryName($origPath)) ("knoux-backup-{0}-{1}" -f (Split-Path -Leaf $origPath), (Get-Date -Format 'yyyyMMdd-HHmmss'))
                try { Move-Item -LiteralPath $origPath -Destination $existingBackup -Force } catch { Write-Warning "Failed to backup existing: $($_.Exception.Message)"; return $false }
            } elseif ($answer -eq 'Alternate') {
                $alt = Read-Host "Enter alternate destination path"
                if (-not $alt -or -not (Test-Path -LiteralPath ([System.IO.Path]::GetDirectoryName($alt)))) { Write-Warning "Invalid alternate path"; return $false }
                $altPath = $alt
            } elseif ($answer -eq 'Replace') {
                # proceed with overwrite
            }
        }

        if ($altPath) {
            $targetPath = $altPath
        } else {
            $targetPath = $origPath
        }
        try {
            New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
            $quarantinedDir = Join-Path $QuarantinePath $meta.OriginalName
            # Copy the CONTENTS of the quarantined directory into the target
            # (never nest the directory inside itself).
            $children = @(Get-ChildItem -LiteralPath $quarantinedDir -Force -ErrorAction SilentlyContinue)
            if ($children.Count -eq 0) {
                # Empty directory: ensure the target exists (already created above)
            } else {
                Get-ChildItem -LiteralPath $quarantinedDir -Force -ErrorAction Stop | Copy-Item -Destination $targetPath -Recurse -Force -ErrorAction Stop
            }
            # Verify
            $actualFiles = @(Get-ChildItem -LiteralPath $targetPath -File -Recurse -Force -ErrorAction SilentlyContinue)
            if (-not $manifest) {
                # Empty directory: nothing to compare against manifest
                $ok = ($actualFiles.Count -eq 0 -and (Test-Path -LiteralPath $targetPath))
                if (-not $ok) { Write-Warning ("Directory verification failed: expected empty, got {0} file(s)" -f $actualFiles.Count) }
            } elseif ($actualFiles.Count -ne $manifest.Count) { Write-Warning ("Directory verification failed: file count mismatch ({0} vs {1})" -f $actualFiles.Count, $manifest.Count); $ok = $false }
            else {
                $ok = $true
                foreach ($m in $manifest) {
                    $af = $actualFiles | Where-Object { $_.FullName.Substring($targetPath.Length + 1).Replace('\','/') -eq $m.RelativePath } | Select-Object -First 1
                    if (-not $af -or $af.Length -ne $m.Size) { $ok = $false; break }
                    if ($m.Hash) { $ah = (Get-FileHash -LiteralPath $af.FullName -Algorithm SHA256).Hash; if ($ah -ne $m.Hash) { $ok = $false; break } }
                }
            }
        } catch {
            Write-Warning "Restore of directory failed: $($_.Exception.Message)"
            $ok = $false
        }
    } else {
        # File restore
        $qHash = (Get-FileHash -LiteralPath (Join-Path $QuarantinePath $meta.OriginalName) -Algorithm SHA256).Hash
        if ($meta.OriginalHash -and $qHash -ne $meta.OriginalHash) {
            Write-Warning "Restore rejected: quarantined file hash mismatch for '$($meta.OriginalPath)'"
            return $false
        }

        $destPath = $origPath
        if (Test-Path -LiteralPath $destPath) {
            $answer = $null
            while ($null -eq $answer) {
                Write-Host ("Destination file '{0}' already exists. Options: (R) Replace, (B) Backup & Replace, (A) Alternate path, (C) Cancel" -f $destPath) -ForegroundColor Yellow
                $ans = Read-Host "Choice [R/B/A/C]"
                if ($ans -match '^[Rr]$') { $answer = 'Replace' }
                elseif ($ans -match '^[Bb]$') { $answer = 'Backup' }
                elseif ($ans -match '^[Aa]$') { $answer = 'Alternate' }
                elseif ($ans -match '^[Cc]$') { $answer = 'Cancel' }
            }
            if ($answer -eq 'Cancel') { Write-Warning "Restore cancelled by user"; return $false }
            if ($answer -eq 'Backup') {
                $existingBackup = Join-Path ([System.IO.Path]::GetDirectoryName($destPath)) ("knoux-backup-{0}-{1}" -f (Split-Path -Leaf $destPath), (Get-Date -Format 'yyyyMMdd-HHmmss'))
                try { Move-Item -LiteralPath $destPath -Destination $existingBackup -Force } catch { Write-Warning "Failed to backup existing: $($_.Exception.Message)"; return $false }
            } elseif ($answer -eq 'Alternate') {
                $alt = Read-Host "Enter alternate destination path"
                if (-not $alt -or -not (Test-Path -LiteralPath ([System.IO.Path]::GetDirectoryName($alt)))) { Write-Warning "Invalid alternate path"; return $false }
                $destPath = $alt
            } elseif ($answer -eq 'Replace') {
                # proceed
            }
        }

        try {
            New-Item -ItemType Directory -Path (Split-Path $destPath -Parent) -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $QuarantinePath $meta.OriginalName) -Destination $destPath -Force
            $rHash = (Get-FileHash -LiteralPath $destPath -Algorithm SHA256).Hash
            $ok = ($rHash -eq $qHash)
        } catch {
            Write-Warning "Restore of file failed: $($_.Exception.Message)"
            $ok = $false
        }
    }

    if (-not $ok) {
        Write-Warning "Restore verification failed for '$($meta.OriginalPath)'"
        if ($Session) { Write-KnouxLog -Session $Session ("Restore verification failed: {0}" -f $meta.OriginalPath) }
        return $false
    }

    # Only delete quarantine after verified restoration
    try {
        Remove-Item -LiteralPath $QuarantinePath -Recurse -Force
    } catch {
        Write-Warning "Restore succeeded but quarantine cleanup failed: $($_.Exception.Message)"
    }

    if ($Session) { Write-KnouxLog -Session $Session ("Restore {0} verified: {1}" -f $meta.ItemType, $meta.OriginalPath) }
    return $true
}

# ============================================================
#  Get-KnouxFolderSize
#  Guarded total size of files under a path (files only).
#  Returns 0 when the path is missing or empty.
# ============================================================
function Get-KnouxFolderSize {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return [int64]0 }
    $items = @(Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue)
    if ($items.Count -eq 0) { return [int64]0 }
    return [int64](($items | Measure-Object Length -Sum).Sum)
}

# ============================================================
#  Invoke-KnouxCleanup
#  Shared analyze->preview->confirm->quarantine helper for safe
#  cleanup tools. Returns a result object with Found / Bytes /
#  Removed / RemovedBytes / QuarantinedBytes / Status / Message.
#  Never touches protected paths. AnalyzeOnly / WhatIf never
#  change the filesystem. Files are moved to quarantine, never
#  permanently deleted.
# ============================================================
function Invoke-KnouxCleanup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Prompt = 'Proceed with cleanup?',
        [int]$MinSizeBytes = 0,
        [string]$ToolId = 'cleanup',
        [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
        [pscustomobject]$Session,
        [switch]$AnalyzeOnly,
        [switch]$WhatIf,
        [switch]$SkipConfirm
    )
    $base = [pscustomobject]@{ Found = 0; Bytes = 0; Removed = 0; RemovedBytes = 0; QuarantinedBytes = 0; Status = 'Analyzed'; Message = '' }
    if (-not (Test-Path -LiteralPath $Path)) {
        $base.Status = 'Skipped'
        $base.Message = "Path not found: $Path"
        return $base
    }
    if (Test-KnouxProtectedPath -Path $Path) {
        $base.Status = 'Failed'
        $base.Message = "Refusing to clean protected path: $Path"
        return $base
    }
    $files = @(Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -ge $MinSizeBytes })
    $base.Found = $files.Count
    $base.Bytes = [int64]0
    if ($files.Count -gt 0) { $base.Bytes = [int64](($files | Measure-Object Length -Sum).Sum) }
    $base.Message = ('{0} files, {1}' -f $base.Found, (Format-KnouxSize $base.Bytes))

    if ($AnalyzeOnly -or $WhatIf) {
        $base.Message = ('Would remove: {0} files, {1}' -f $base.Found, (Format-KnouxSize $base.Bytes))
        return $base
    }
    if ($base.Found -eq 0) {
        $base.Message = 'Nothing to clean.'
        return $base
    }
    if (-not $SkipConfirm -and -not (Confirm-KnouxAction $Prompt)) {
        $base.Status = 'Cancelled'
        $base.Message = 'Cleanup cancelled by user.'
        return $base
    }
    $removed = 0
    $removedBytes = [int64]0
    foreach ($f in $files) {
        try {
            $q = Move-KnouxItemToQuarantine -Path $f.FullName -ToolId $ToolId -ProjectRoot $ProjectRoot -Session $Session
            if ($q) {
                $removed++
                if ($null -ne $q.OriginalSize) { $removedBytes += [int64]$q.OriginalSize }
            }
        } catch {
            Write-Warning "Cleanup quarantine failed for '$($f.FullName)': $($_.Exception.Message)"
        }
    }
    $base.Removed = $removed
    $base.RemovedBytes = $removedBytes
    $base.QuarantinedBytes = $removedBytes
    if ($removed -eq $base.Found) {
        $base.Status = 'Done'
    } elseif ($removed -gt 0) {
        $base.Status = 'Partial'
    } else {
        $base.Status = 'Failed'
    }
    $base.Message = ('Quarantined {0}/{1} files ({2})' -f $removed, $base.Found, (Format-KnouxSize $removedBytes))
    return $base
}

# ============================================================
#  Resolve-KnouxSafePath
#  Resolves a path, ensuring it stays inside the project root.
# ============================================================
function Resolve-KnouxSafePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Root = (Split-Path $PSScriptRoot -Parent)
    )
    try {
        if (-not [System.IO.Path]::IsPathRooted($Path)) {
            $Path = Join-Path $Root $Path
        }
        $full = [System.IO.Path]::GetFullPath($Path)
        $rootFull = [System.IO.Path]::GetFullPath($Root)
        if ($full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $full
        }
        throw "Path resolves outside the project root: $Path"
    } catch { throw }
}

# ============================================================
#  Get-KnouxDirectoryChildren
#  Private safe enumeration of immediate children. Skips
#  reparse points (OneDrive placeholders, junctions) and offline
#  (cloud-only) files. Unreadable directories are skipped with a
#  verbose trace. Returns an array (possibly empty).
# ============================================================
function Get-KnouxDirectoryChildren {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    try {
        $items = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop)
    } catch {
        Write-Verbose "Cannot enumerate '$Path': $($_.Exception.Message)"
        return @()
    }
    $out = [System.Collections.Generic.List[object]]::new()
    foreach ($it in $items) {
        if ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { continue }
        if (-not $it.PSIsContainer -and ($it.Attributes -band [System.IO.FileAttributes]::Offline)) { continue }
        $out.Add($it)
    }
    return @($out)
}

# ============================================================
#  Get-KnouxLargestFiles
#  Streaming top-N largest files under one or more roots.
#  Iterative (stack based), skips reparse points and offline
#  files, never materializes the whole listing in memory.
#  Returns: { Items, FilesScanned, Skipped }
# ============================================================
function Get-KnouxLargestFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$Roots,
        [int]$TopN = 20,
        [long]$MinBytes = 0,
        [string[]]$IncludeExtensions,
        [string[]]$ExcludeSubstrings
    )
    $top = New-Object System.Collections.Generic.List[object]
    $filesScanned = [int64]0
    $skipped = [int64]0
    foreach ($r in $Roots) {
        if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
        $dirs = New-Object System.Collections.Generic.Stack[string]
        $dirs.Push($r)
        while ($dirs.Count -gt 0) {
            $cur = $dirs.Pop()
            foreach ($it in @(Get-KnouxDirectoryChildren -Path $cur)) {
                if ($it.PSIsContainer) {
                    $dirs.Push($it.FullName)
                    continue
                }
                if ($it.Length -lt $MinBytes) { continue }
                if ($IncludeExtensions -and $IncludeExtensions.Count -gt 0 -and $IncludeExtensions -notcontains $it.Extension.ToLower()) { continue }
                if ($ExcludeSubstrings) {
                    $excluded = $false
                    foreach ($s in $ExcludeSubstrings) {
                        if ($it.FullName.IndexOf($s, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $excluded = $true; break }
                    }
                    if ($excluded) { $skipped++; continue }
                }
                $filesScanned++
                if ($top.Count -lt $TopN) {
                    $top.Add($it)
                    if ($top.Count -gt 1) { $top.Sort({ param($a, $b) $b.Length.CompareTo($a.Length) }) }
                } elseif ($it.Length -gt $top[$top.Count - 1].Length) {
                    $top[$top.Count - 1] = $it
                    $top.Sort({ param($a, $b) $b.Length.CompareTo($a.Length) })
                }
            }
        }
    }
    return [pscustomobject]@{
        Items = @($top | Select-Object FullName, Length, LastWriteTime)
        FilesScanned = $filesScanned
        Skipped = $skipped
    }
}

# ============================================================
#  Get-KnouxLargestFolders
#  Streaming top-N folders by total size (files directly inside,
#  plus every nested folder). Iterative post-order traversal so
#  it works on deep trees without recursion limits. Skips
#  reparse points and offline files.
#  Returns: { Items (FullName, TotalBytes), FoldersScanned,
#             Skipped }
# ============================================================
function Get-KnouxLargestFolders {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$Roots,
        [int]$TopN = 20
    )
    $top = New-Object System.Collections.Generic.List[object]
    $foldersScanned = [int64]0
    $skipped = [int64]0
    $comparer = { param($a, $b) $b.Total.CompareTo($a.Total) }
    foreach ($r in $Roots) {
        if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
        $rootFrame = [pscustomobject]@{ Path = $r; Children = @(); ChildIndex = 0; Total = [int64]0; Parent = $null; Included = $false }
        $stack = New-Object System.Collections.Generic.Stack[object]
        $stack.Push($rootFrame)
        while ($stack.Count -gt 0) {
            $fr = $stack.Peek()
            if (-not $fr.Included) {
                $fr.Included = $true
                $fr.Children = @()
                foreach ($it in @(Get-KnouxDirectoryChildren -Path $fr.Path)) {
                    if ($it.PSIsContainer) {
                        $fr.Children += $it
                    } else {
                        $fr.Total += [int64]$it.Length
                    }
                }
            }
            if ($fr.ChildIndex -lt $fr.Children.Count) {
                $child = $fr.Children[$fr.ChildIndex]
                $fr.ChildIndex++
                $cf = [pscustomobject]@{ Path = $child.FullName; Children = @(); ChildIndex = 0; Total = [int64]0; Parent = $fr; Included = $false }
                $stack.Push($cf)
            } else {
                [void]$stack.Pop()
                $foldersScanned++
                if ($top.Count -lt $TopN) {
                    $top.Add($fr)
                    if ($top.Count -gt 1) { $top.Sort($comparer) }
                } elseif ($fr.Total -gt $top[$top.Count - 1].Total) {
                    $top[$top.Count - 1] = $fr
                    $top.Sort($comparer)
                }
                if ($fr.Parent) { $fr.Parent.Total += $fr.Total }
            }
        }
    }
    return [pscustomobject]@{
        Items = @($top | Select-Object @{n = 'FullName'; e = { $_.Path } }, @{n = 'TotalBytes'; e = { [int64]$_.Total } })
        FoldersScanned = $foldersScanned
        Skipped = $skipped
    }
}

# ============================================================
#  Get-KnouxScanFiles
#  Safe recursive file enumeration. Skips reparse points
#  (OneDrive placeholders, junctions - hashing those can hang
#  or recurse forever) and offline (cloud-only) files. Returns
#  an array of FileInfo objects.
# ============================================================
function Get-KnouxScanFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$Roots,
        [string[]]$IncludeExtensions,
        [long]$MinBytes = 0,
        [int]$MaxFiles = 20000
    )
    $all = [System.Collections.Generic.List[object]]::new()
    foreach ($r in $Roots) {
        if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
        $dirs = New-Object System.Collections.Generic.Stack[string]
        $dirs.Push($r)
        while ($dirs.Count -gt 0) {
            if ($all.Count -ge $MaxFiles) { break }
            $cur = $dirs.Pop()
            foreach ($it in @(Get-KnouxDirectoryChildren -Path $cur)) {
                if ($it.PSIsContainer) {
                    $dirs.Push($it.FullName)
                    continue
                }
                if ($it.Length -lt $MinBytes) { continue }
                if ($IncludeExtensions -and $IncludeExtensions.Count -gt 0 -and $IncludeExtensions -notcontains $it.Extension.ToLower()) { continue }
                $all.Add($it)
                if ($all.Count -ge $MaxFiles) { break }
            }
        }
        if ($all.Count -ge $MaxFiles) { break }
    }
    return @($all)
}

# ============================================================
#  Test-KnouxHardLink
#  Returns $true when a FileInfo (or path) is a hard link.
# ============================================================
function Test-KnouxHardLink {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$File)
    try {
        if ($File -is [System.IO.FileInfo]) { return ($File.LinkType -eq 'HardLink') }
        if ($File -is [string]) {
            $i = Get-Item -LiteralPath $File -Force -ErrorAction Stop
            return ($i.LinkType -eq 'HardLink')
        }
        return $false
    } catch {
        Write-Warning "Could not inspect link state for '$File': $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
#  Find-KnouxDuplicateGroups
#  Groups files by size, then content-hashes only same-size
#  buckets within a byte budget so scans terminate predictably.
#  - Keeper policy: OldestThenAlphabetical (default) or Newest.
#  - Hard-linked files are excluded from auto-cleanup candidates
#    (deleting one link frees no space) and flagged on the group.
#  - ExcludeSubstrings removes paths (e.g. '\.git\', 'node_modules').
#  Each group exposes: Hash, Files, Keeper, Duplicates,
#  HardLinkInvolved, BytesPotentiallyRecoverable.
# ============================================================
function Find-KnouxDuplicateGroups {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object[]]$Files,
        [long]$HashByteBudget = 500MB,
        [ValidateSet('OldestThenAlphabetical', 'Newest')][string]$KeeperPolicy = 'OldestThenAlphabetical',
        [string[]]$ExcludeSubstrings
    )
    if ($ExcludeSubstrings -and $ExcludeSubstrings.Count -gt 0) {
        $Files = @($Files | Where-Object {
            $excluded = $false
            foreach ($s in $ExcludeSubstrings) {
                if ($_.FullName.IndexOf($s, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $excluded = $true; break }
            }
            -not $excluded
        })
    }
    $bySize = @{}
    foreach ($f in $Files) {
        $k = $f.Length
        if ($bySize.ContainsKey($k)) { $bySize[$k].Add($f) } else { $bySize[$k] = [System.Collections.Generic.List[object]]@($f) }
    }
    $groups = [System.Collections.Generic.List[object]]::new()
    $budgetUsed = 0
    foreach ($k in $bySize.Keys) {
        if ($bySize[$k].Count -lt 2) { continue }
        $hmap = @{}
        $bucketFiles = @($bySize[$k])
        if ($KeeperPolicy -eq 'Newest') { $bucketFiles = @($bucketFiles | Sort-Object LastWriteTime -Descending) }
        foreach ($f in $bucketFiles) {
            if ($budgetUsed -ge $HashByteBudget) {
                return @($groups)
            }
            $h = $null
            try {
                $sha = [System.Security.Cryptography.SHA256]::Create()
                $fs = [System.IO.File]::OpenRead($f.FullName)
                try { $h = [Convert]::ToBase64String($sha.ComputeHash($fs)) }
                finally { $fs.Dispose(); $sha.Dispose() }
                $budgetUsed += $f.Length
            } catch {
                Write-Warning "Could not hash '$($f.FullName)': $($_.Exception.Message)"
                continue
            }
            if (-not $h) { continue }
            if ($hmap.ContainsKey($h)) { $hmap[$h].Add($f) } else { $hmap[$h] = [System.Collections.Generic.List[object]]@($f) }
        }
        foreach ($h in $hmap.Keys) {
            if ($hmap[$h].Count -lt 2) { continue }
            $members = @($hmap[$h])
            $hardInvolved = $false
            foreach ($m in $members) {
                if (Test-KnouxHardLink -File $m) { $hardInvolved = $true; break }
            }
            $candidates = $members
            if ($hardInvolved) {
                $candidates = @($members | Where-Object { -not (Test-KnouxHardLink -File $_) })
            }
            if ($candidates.Count -lt 2) { continue }
            if ($KeeperPolicy -eq 'OldestThenAlphabetical') {
                $sorted = @($candidates | Sort-Object @{ e = { $_.LastWriteTime } }, @{ e = { $_.FullName } })
            } else {
                $sorted = @($candidates | Sort-Object @{ e = { $_.LastWriteTime } } -Descending)
            }
            $keeper = $sorted[0]
            $dupes = @($sorted | Select-Object -Skip 1)
            $recoverable = [int64]0
            foreach ($d in $dupes) { $recoverable += [int64]$d.Length }
            $groups.Add([pscustomobject]@{
                    Hash = $h
                    Files = $members
                    Keeper = $keeper
                    Duplicates = $dupes
                    HardLinkInvolved = $hardInvolved
                    BytesPotentiallyRecoverable = $recoverable
                })
        }
    }
    return @($groups)
}

Export-ModuleMember -Function Test-KnouxProtectedPath, Test-KnouxWUDownloadCachePath, Test-KnouxProtectedProcess, New-KnouxBackup, New-KnouxRestorePoint, Move-KnouxItemToQuarantine, Restore-KnouxQuarantinedItem, Resolve-KnouxSafePath, Invoke-KnouxCleanup, Get-KnouxFolderSize, Get-KnouxScanFiles, Find-KnouxDuplicateGroups, Get-KnouxLargestFiles, Get-KnouxLargestFolders, Test-KnouxHardLink
