@echo off
REM KNOUX REPAIR — Local Execution Bridge (elevated, required for admin tools)
cd /d "%~dp0.."
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'server\bridge.mjs' -WorkingDirectory '%CD%' -Verb RunAs"
