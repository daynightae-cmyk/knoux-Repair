@echo off
title knoux Repair v2.0.2
setlocal
set "ROOT=%~dp0"
echo ==================================================
echo   knoux Repair v2.0.2  |  Windows Maintenance Suite
echo ==================================================
echo.
echo   Checking for administrator privileges...

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo   Administrator privileges required for full functionality.
    echo   Requesting UAC elevation...
    echo.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
        "Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0Menu.ps1\"' -Verb RunAs -WorkingDirectory '%~dp0'"
    exit /b
) else (
    echo   Running with administrator privileges.
    echo.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Menu.ps1"
)
endlocal