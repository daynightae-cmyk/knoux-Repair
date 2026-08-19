# Attempts a real interactive-screen capture of the Release WPF application.
# It never changes display settings or fabricates screenshots.
[CmdletBinding()]
param(
    [string]$ExecutablePath = '',
    [string]$OutputDirectory = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ExecutablePath)) { $ExecutablePath = Join-Path $root 'Glass-GUI-Builder\src\KnouxRepair\bin\Release\net8.0-windows\KnouxRepair.exe' }
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $OutputDirectory = Join-Path $root 'Reports\Visual-QA' }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $ExecutablePath)) { throw "Release executable is missing: $ExecutablePath" }
if (-not (Test-Path -LiteralPath $OutputDirectory)) { New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null }

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$width = $screen.Width
$height = $screen.Height
$process = Start-Process -FilePath $ExecutablePath -PassThru
try {
    Start-Sleep -Seconds 5
    if ($process.HasExited) { throw 'KnouxRepair exited before visual capture.' }
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $path = Join-Path $OutputDirectory ("{0}x{1}-current-session.png" -f $width, $height)
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host ('VISUAL_CAPTURE=PASS')
        Write-Host ('RESOLUTION=' + $width + 'x' + $height)
        Write-Host ('SCREENSHOT=' + $path)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}
finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}
