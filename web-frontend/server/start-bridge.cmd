@echo off
REM KNOUX REPAIR — Local Execution Bridge (normal privileges)
cd /d "%~dp0.."
node server\bridge.mjs
pause
