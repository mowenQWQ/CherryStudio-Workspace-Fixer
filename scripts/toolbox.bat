@echo off
rem ============================================================
rem  Cherry Studio Workspace Toolbox v2.0.0
rem  Unified menu: log guard + workspace path fixer + probes.
rem  工具箱统一入口: 日志防护 / 路径修复 / 探测 / 对比
rem  Encoding: GBK, CRLF, no BOM, no chcp (Chinese Windows safe)
rem ============================================================
setlocal
cd /d "%~dp0"

:MENU
cls
echo.
echo  ============================================
echo    Cherry Studio Workspace Toolbox v2.0.0
echo  ============================================
echo.
echo    [1] 日志炸弹排查与清理 log_guard
echo    [2] 修复工作区路径 fix_workspace_db + fix_claude_paths
echo    [3] 只读探测残留路径 probe_workspace_db
echo    [4] 数据一致性对比 check_agent_data
echo    [0] 退出
echo.
choice /C 12340 /N /M "  请选择 [0-4]: "
if errorlevel 5 goto :EXIT
if errorlevel 4 goto :T4
if errorlevel 3 goto :T3
if errorlevel 2 goto :T2
if errorlevel 1 goto :T1

:T1
echo.
echo  --- [1] 日志炸弹排查与清理 ---
echo  默认只读报告; 要清理请用: log_guard.bat --clean --retain-hours 2
echo.
if not exist "%~dp0log_guard.bat" goto :MISSING
call "%~dp0log_guard.bat"
goto :MENU

:T2
echo.
echo  --- [2] 修复工作区路径 ---
echo  先编辑 fix_workspace_db.bat / fix_claude_paths.bat 顶部的旧/新根路径!
echo  请确认 Cherry Studio 已完全退出。
echo.
if not exist "%~dp0fix_workspace_db.bat" goto :MISSING
if not exist "%~dp0fix_claude_paths.bat" goto :MISSING
call "%~dp0fix_workspace_db.bat"
call "%~dp0fix_claude_paths.bat"
goto :MENU

:T3
echo.
echo  --- [3] 只读探测残留路径 ---
echo.
if not exist "%~dp0probe_workspace_db.bat" goto :MISSING
call "%~dp0probe_workspace_db.bat"
goto :MENU

:T4
echo.
echo  --- [4] 数据一致性对比 ---
echo  需先跑过 fix_workspace_db 生成 .bak 备份才能对比。
echo.
if not exist "%~dp0check_agent_data.bat" goto :MISSING
call "%~dp0check_agent_data.bat"
goto :MENU

:MISSING
echo  [ERROR] 缺少子脚本, 请确认 scripts 目录完整。
pause
goto :MENU

:EXIT
echo.
echo  已退出。下次运行直接双击本文件即可。
echo.
exit /b 0
