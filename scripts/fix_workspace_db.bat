@echo off
rem ============================================================
rem  Cherry Studio Workspace Fixer - fix_workspace_db
rem  Fixes agent_workspace.path rows in cherrystudio.sqlite
rem  Flow: preview -> confirm -> auto backup -> fix -> recheck
rem  Usage: edit OLD_ROOT/NEW_ROOT below, then double-click.
rem ============================================================
setlocal
cd /d "%~dp0"

rem ---------- EDIT THESE (old = pre-move location, new = current location) ----------
set "OLD_ROOT=C:\Users\<YOUR_USERNAME>\AppData\Roaming\CherryStudio"
set "NEW_ROOT=E:\CherryStudio-New-Location"
set "DB_FILE=%NEW_ROOT%\Data\cherrystudio.sqlite"
rem ------------------------------------------------------------------------------------

echo Old root: %OLD_ROOT%
echo New root: %NEW_ROOT%
echo Database: %DB_FILE%
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
echo Step 1: Preview which rows would change (read-only)...
echo.
"%NODE%" "%~dp0fix_workspace_db.js" --db "%DB_FILE%" --old "%OLD_ROOT%" --new "%NEW_ROOT%"
set "RC=%ERRORLEVEL%"

echo.
echo ------------------------------------------------------------
set /p CONFIRM=Apply the fix now? Type y then Enter to proceed, anything else to cancel: 
if /i "%CONFIRM%"=="y" goto :APPLY

echo Cancelled, nothing was modified.
echo.
pause
exit /b 0

:APPLY
echo.
echo Applying: backup database - fix workspace paths - recheck...
echo Make sure Cherry Studio is fully exited!
echo.
"%NODE%" "%~dp0fix_workspace_db.js" --db "%DB_FILE%" --old "%OLD_ROOT%" --new "%NEW_ROOT%" --apply
set "RC=%ERRORLEVEL%"

echo.
echo ---- recheck ----
"%NODE%" "%~dp0fix_workspace_db.js" --db "%DB_FILE%" --old "%OLD_ROOT%" --new "%NEW_ROOT%" --recheck
set "RC2=%ERRORLEVEL%"

if not "%RC%"=="0" goto :APPLY_FAIL
if not "%RC2%"=="0" goto :APPLY_FAIL

echo.
echo [DONE] Workspace paths fixed. Restart Cherry Studio and open old conversations.
echo.
pause
exit /b 0

:APPLY_FAIL
echo.
echo [WARN] Fix or recheck did not fully pass, check messages above.
echo.
pause
exit /b 1
