@echo off
rem ============================================================
rem  Cherry Studio Workspace Fixer - fix_claude_paths
rem  Fixes old paths in .claude.json and projects dir names
rem  Usage: edit OLD_ROOT/NEW_ROOT below, then double-click.
rem ============================================================
setlocal
cd /d "%~dp0"

rem ---------- EDIT THESE TWO ----------
set "OLD_ROOT=C:\Users\<YOUR_USERNAME>\AppData\Roaming\CherryStudio"
set "NEW_ROOT=E:\CherryStudio-New-Location"
rem ------------------------------------

echo Old root: %OLD_ROOT%
echo New root: %NEW_ROOT%
echo.

rem ---------- locate PowerShell ----------
set "PS_EXE="
for %%P in (
    "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
    "%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
    "C:\Program Files\PowerShell\7\pwsh.exe"
) do (
    if exist "%%~P" set "PS_EXE=%%~P"
)
if not defined PS_EXE goto :NO_PS

echo Running, this may take a while...
echo.
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix_claude_paths.ps1"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" goto :OK

echo [FAILED] Exit code %RC%, check messages above.
echo.
pause
exit /b %RC%

:OK
echo [DONE] Claude-layer paths fixed.
echo.
pause
exit /b 0

:NO_PS
echo [ERROR] PowerShell not found, please install it first.
pause
exit /b 4
