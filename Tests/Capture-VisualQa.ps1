# Captures only the actual KNOUX Repair window. A capture is saved only after the target
# window is confirmed foreground; desktop or unrelated-window screenshots are never accepted.
[CmdletBinding()]
param(
    [string]$ExecutablePath = '',
    [string]$OutputDirectory = '',
    [int]$ExistingProcessId = 0,
    [ValidateRange(1, 60)][int]$WaitSeconds = 5,
    [switch]$ElevatedWorker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ExecutablePath)) { $ExecutablePath = Join-Path $root 'Glass-GUI-Builder\src\KnouxRepair\bin\Release\net8.0-windows\KnouxRepair.exe' }
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $OutputDirectory = Join-Path $root 'Reports\Visual-QA' }
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class KnouxVisualQaNative {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect { public int Left; public int Top; public int Right; public int Bottom; }
    [DllImport("user32.dll", SetLastError = true)] public static extern bool GetWindowRect(IntPtr hWnd, out Rect lpRect);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr GetForegroundWindow();
}
'@

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Path -LiteralPath $ExecutablePath)) { throw "Release executable is missing: $ExecutablePath" }
if (-not (Test-Path -LiteralPath $OutputDirectory)) { New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null }
$statusPath = Join-Path $OutputDirectory 'latest-capture-status.txt'
trap {
    $failure = "VISUAL_CAPTURE=FAIL`r`nREASON=$($_.Exception.Message)"
    try { Set-Content -LiteralPath $statusPath -Value $failure -Encoding UTF8 } catch { }
    Write-Error $failure
    exit 1
}

if (-not $ElevatedWorker -and -not (Test-IsAdministrator)) {
    $workerArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $PSCommandPath), '-ExecutablePath', ('"{0}"' -f $ExecutablePath), '-OutputDirectory', ('"{0}"' -f $OutputDirectory), '-WaitSeconds', $WaitSeconds, '-ElevatedWorker')
    if ($ExistingProcessId -gt 0) { $workerArguments += @('-ExistingProcessId', $ExistingProcessId) }
    $worker = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $workerArguments -PassThru -Wait
    exit $worker.ExitCode
}

$startedByHarness = $ExistingProcessId -eq 0
$process = if ($startedByHarness) { Start-Process -FilePath $ExecutablePath -PassThru } else { Get-Process -Id $ExistingProcessId -ErrorAction Stop }
try {
    if ($startedByHarness) { Start-Sleep -Seconds $WaitSeconds }
    $process.Refresh()
    if ($process.HasExited) { throw 'KnouxRepair exited before visual capture.' }
    if ($process.MainWindowHandle -eq [IntPtr]::Zero) { throw 'KnouxRepair did not expose a visual window handle.' }
    [void][KnouxVisualQaNative]::ShowWindow($process.MainWindowHandle, 9)
    [void][KnouxVisualQaNative]::BringWindowToTop($process.MainWindowHandle)
    [void][KnouxVisualQaNative]::SetForegroundWindow($process.MainWindowHandle)
    Start-Sleep -Milliseconds 500
    if ([KnouxVisualQaNative]::GetForegroundWindow() -ne $process.MainWindowHandle) { throw 'KNOUX Repair is not the foreground window; no screenshot was saved.' }

    $rect = New-Object KnouxVisualQaNative+Rect
    if (-not [KnouxVisualQaNative]::GetWindowRect($process.MainWindowHandle, [ref]$rect)) { throw 'KnouxRepair window bounds could not be read.' }
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -le 0 -or $height -le 0) { throw "KnouxRepair returned invalid window bounds: ${width}x${height}." }

    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
        $path = Join-Path $OutputDirectory ("{0}x{1}-knoux-window.png" -f $width, $height)
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        Set-Content -LiteralPath $statusPath -Value ("VISUAL_CAPTURE=PASS`r`nSCREENSHOT=$path") -Encoding UTF8
        Write-Host 'VISUAL_CAPTURE=PASS'
        Write-Host ('PROCESS_ID=' + $process.Id)
        Write-Host ('WINDOW_TITLE=' + $process.MainWindowTitle)
        Write-Host ('RESOLUTION=' + $width + 'x' + $height)
        Write-Host ('SCREENSHOT=' + $path)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}
finally {
    if ($startedByHarness -and -not $process.HasExited) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction Stop } catch { Write-Warning ('Could not stop elevated KNOUX process ' + $process.Id + ': ' + $_.Exception.Message) }
    }
}
