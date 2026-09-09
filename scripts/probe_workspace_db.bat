@echo off
rem ============================================================
rem  Cherry Studio Workspace Fixer - probe_workspace_db
rem  Read-only probe: scan DB for rows containing old paths.
rem  Nothing will be modified.
rem ============================================================
setlocal
cd /d "%~dp0"

set "DB=%~1"
if "%DB%"=="" set "DB=%APPDATA%\CherryStudio\Data\cherrystudio.sqlite"

echo Using database: %DB%
echo Read-only probe, nothing will be modified...
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
"%NODE%" "%~dp0probe_workspace_db.js" "%DB%"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" goto :PROBE_OK

echo [WARN] Exit code %RC%. If you see OPEN_ERROR, the DB may be locked by Cherry Studio.
echo Please fully exit Cherry Studio and try again.
echo.
pause
exit /b %RC%

:PROBE_OK
echo [DONE] Probe finished. Read-only, nothing was modified.
echo.
pause
exit /b 0
