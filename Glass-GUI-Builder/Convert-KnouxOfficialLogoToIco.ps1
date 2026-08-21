[CmdletBinding()]
param(
    [string]$SourcePath = '',
    [string]$OutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($SourcePath)) { $SourcePath = Join-Path $PSScriptRoot 'src\KnouxRepair\Assets\KnouxOfficialLogo.png' }
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $PSScriptRoot 'src\KnouxRepair\Assets\KnouxOfficialLogo.ico' }

if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
    throw "Official logo source was not found: $SourcePath"
}

Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class KnouxNativeIcon {
    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);
}
'@

$source = [System.Drawing.Image]::FromFile($SourcePath)
$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($source, 0, 0, 256, 256)
    $hIcon = $bitmap.GetHicon()
    try {
        $icon = [System.Drawing.Icon]::FromHandle($hIcon)
        $stream = [System.IO.File]::Create($OutputPath)
        try { $icon.Save($stream) } finally { $stream.Dispose(); $icon.Dispose() }
    }
    finally {
        [KnouxNativeIcon]::DeleteObject($hIcon) | Out-Null
    }
}
finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
}

$item = Get-Item -LiteralPath $OutputPath
Write-Host ('ICO=' + $item.FullName)
Write-Host ('BYTES=' + $item.Length)
