@echo off
rem ============================================================
rem  Cherry Studio Workspace Fixer - log_guard
rem  Log-bomb guard: report / clean oversized Cherry Studio logs.
rem  Usage: double-click for a read-only report, or:
rem    log_guard.bat --clean --retain-hours 2
rem  Fully manual (no scheduled task). Safe: keeps fresh files,
rem  backs up before deleting, asks for confirmation.
rem ============================================================
setlocal
cd /d "%~dp0"

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
rem ---- build argument list (default: read-only report) ----
set "ARGS=%*"
if defined ARGS goto :RUN

echo No arguments given, running read-only report first.
echo To actually clean, re-run with: log_guard.bat --clean --retain-hours 2
echo.
set "ARGS=--report"

:RUN
"%NODE%" "%~dp0log_guard.js" %ARGS%
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" goto :OK

echo [WARN] Exit code %RC%. See messages above.
echo.
pause
exit /b %RC%

:OK
echo [DONE] log_guard finished. Check the report above.
echo.
pause
exit /b 0
