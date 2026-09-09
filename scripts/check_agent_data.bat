@echo off
rem ============================================================
rem  Cherry Studio Workspace Fixer - check_agent_data
rem  Read-only compare: backup db vs current db (row counts).
rem  Note: requires a .bak-<timestamp> created by the fix tool.
rem ============================================================
setlocal
cd /d "%~dp0"

set "DB=%~1"
if "%DB%"=="" set "DB=%APPDATA%\CherryStudio\Data\cherrystudio.sqlite"

echo Using database: %DB%
echo Read-only compare, nothing will be modified...
echo.

rem ---------- locate node ----------
set "NODE="
where node >nul 2>nul
if not errorlevel 1 set "NODE=node"
if defined NODE goto :NODE_OK

if defined NODE_PATH if exist "%NODE_PATH%\node.exe" set "NODE=%NODE_PATH%\node.exe"
if defined NODE goto :NODE_OK

echo [ERROR] Node.js not found. Please install Node.js 22+ first.
pause
exit /b 4

:NODE_OK
"%NODE%" "%~dp0check_agent_data.js" "%DB%"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" goto :OK

echo [WARN] Compare finished with anomalies, check messages above.
echo.
pause
exit /b %RC%

:OK
echo [DONE] Compare finished. Read-only, nothing was modified.
echo.
pause
exit /b 0
