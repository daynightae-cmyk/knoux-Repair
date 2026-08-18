@echo off
setlocal EnableExtensions

title KNOUX Repair v2.0.2 - Diagnostic Launcher

set "KNOUX_ROOT=%~dp0"
set "KNOUX_SELF=%~f0"
set "KNOUX_MENU=%~dp0Menu.ps1"
set "KNOUX_LOG=%~dp0Launcher-Diagnostic.log"

echo.
echo ============================================================
echo  KNOUX REPAIR v2.0.2 - DIAGNOSTIC LAUNCHER
echo ============================================================
echo.

if not exist "%KNOUX_MENU%" (
    echo [FAILED] Menu.ps1 was not found.
    echo Expected:
    echo %KNOUX_MENU%
    echo.
    pause
    exit /b 10
)

fltmc >nul 2>&1
if errorlevel 1 (
    echo [INFO] Requesting Administrator rights...

    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
      "try { Start-Process -FilePath $env:ComSpec -Verb RunAs -ArgumentList '/d','/c',('\"' + $env:KNOUX_SELF + '\"'); exit 0 } catch { Write-Host ('Elevation failed: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"

    if errorlevel 1 (
        echo.
        echo [FAILED] UAC elevation was cancelled or failed.
        pause
        exit /b 11
    )

    exit /b 0
)

echo [OK] Administrator session confirmed.
echo [INFO] Project root:
echo %KNOUX_ROOT%
echo.
echo [INFO] Diagnostic log:
echo %KNOUX_LOG%
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Continue';" ^
  "$root=$env:KNOUX_ROOT;" ^
  "$menu=$env:KNOUX_MENU;" ^
  "$log=$env:KNOUX_LOG;" ^
  "Set-Location -LiteralPath $root;" ^
  "$header=@('============================================================',('Launch time: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),('Project root: ' + $root),('Menu path: ' + $menu),'============================================================');" ^
  "$header | Out-File -LiteralPath $log -Encoding utf8 -Append;" ^
  "Write-Host 'Starting Menu.ps1...' -ForegroundColor Cyan;" ^
  "try {" ^
  "  $output = & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $menu 2>&1;" ^
  "  $code = $LASTEXITCODE;" ^
  "  $output | ForEach-Object { Write-Host $_; $_ | Out-File -LiteralPath $log -Encoding utf8 -Append };" ^
  "} catch {" ^
  "  $code = 99;" ^
  "  $details = ($_ | Format-List * -Force | Out-String);" ^
  "  Write-Host ('Launcher exception: ' + $_.Exception.Message) -ForegroundColor Red;" ^
  "  $details | Out-File -LiteralPath $log -Encoding utf8 -Append;" ^
  "};" ^
  "Write-Host '';" ^
  "if ($code -eq 0) { Write-Host ('Menu ended with exit code: ' + $code) -ForegroundColor Yellow } else { Write-Host ('Menu failed with exit code: ' + $code) -ForegroundColor Red };" ^
  "Write-Host ('Diagnostic log: ' + $log) -ForegroundColor Cyan;" ^
  "Write-Host '';" ^
  "Read-Host 'Press Enter to close this window' | Out-Null;" ^
  "exit $code"

set "KNOUX_EXIT=%ERRORLEVEL%"

echo.
echo Diagnostic launcher exit code: %KNOUX_EXIT%
echo Log file: %KNOUX_LOG%
echo.
pause

exit /b %KNOUX_EXIT%
