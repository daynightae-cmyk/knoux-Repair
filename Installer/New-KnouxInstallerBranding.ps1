[CmdletBinding()]
param(
    [string]$ProjectRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = Split-Path $PSScriptRoot -Parent }

$logoPath = Join-Path $ProjectRoot 'Glass-GUI-Builder\src\KnouxRepair\Assets\KnouxOfficialLogo.png'
$outputDir = Join-Path $PSScriptRoot 'Branding'
if (-not (Test-Path -LiteralPath $logoPath -PathType Leaf)) {
    throw "Official local logo not found: $logoPath"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Add-Type -AssemblyName System.Drawing

function Save-BrandBitmap {
    param(
        [int]$Width,
        [int]$Height,
        [string]$Path,
        [bool]$IncludeTitle
    )

    $source = [System.Drawing.Image]::FromFile($logoPath)
    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::FromArgb(7, 26, 51))

        $aura = New-Object System.Drawing.Drawing2D.GraphicsPath
        $aura.AddEllipse([int]($Width * 0.08), [int]($Height * 0.18), [int]($Width * 0.84), [int]($Width * 0.84))
        $auraBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $aura
        $auraBrush.CenterColor = [System.Drawing.Color]::FromArgb(82, 24, 168, 232)
        $auraBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 87, 184))
        $graphics.FillPath($auraBrush, $aura)
        $auraBrush.Dispose()
        $aura.Dispose()

        $heightFraction = if ($IncludeTitle) { 0.42 } else { 0.76 }
        $size = [Math]::Min([int]($Width * 0.76), [int]($Height * $heightFraction))
        $x = [int](($Width - $size) / 2)
        $y = if ($IncludeTitle) { [int]($Height * 0.17) } else { [int](($Height - $size) / 2) }
        $graphics.DrawImage($source, $x, $y, $size, $size)

        if ($IncludeTitle) {
            $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(212, 175, 55))
            $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 249, 255))
            $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(176, 190, 197))
            $titleFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 16, ([System.Drawing.FontStyle]::Bold)
            $subFont = New-Object System.Drawing.Font 'Segoe UI', 8.5
            $format = New-Object System.Drawing.StringFormat
            $format.Alignment = [System.Drawing.StringAlignment]::Center
            $format.LineAlignment = [System.Drawing.StringAlignment]::Near
            $graphics.DrawString('KNOUX', $titleFont, $white, [System.Drawing.RectangleF]::new(0, [single]($Height * 0.65), $Width, 30), $format)
            $graphics.DrawString('REPAIR', $subFont, $gold, [System.Drawing.RectangleF]::new(0, [single]($Height * 0.75), $Width, 18), $format)
            $graphics.DrawString('Windows maintenance & diagnostics', $subFont, $muted, [System.Drawing.RectangleF]::new(0, [single]($Height * 0.84), $Width, 20), $format)
            $format.Dispose(); $titleFont.Dispose(); $subFont.Dispose(); $gold.Dispose(); $white.Dispose(); $muted.Dispose()
        }

        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        $source.Dispose()
    }
}

Save-BrandBitmap -Width 164 -Height 314 -Path (Join-Path $outputDir 'KnouxInstallerWelcome.bmp') -IncludeTitle $true
Save-BrandBitmap -Width 55 -Height 55 -Path (Join-Path $outputDir 'KnouxInstallerSmall.bmp') -IncludeTitle $false
Get-ChildItem -LiteralPath $outputDir -Filter '*.bmp' | ForEach-Object { Write-Host ($_.Name + '=' + $_.Length) }
