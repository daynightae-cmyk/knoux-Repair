@echo off
setlocal
title KNOUX Repair Glass GUI Builder
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD-KNOUX-REPAIR-EXE.ps1"

echo.
if errorlevel 1 (
    echo [FAILED] The EXE build did not complete.
) else (
    echo [OK] KnouxRepair.exe was created in the project root.
)
echo.
pause
