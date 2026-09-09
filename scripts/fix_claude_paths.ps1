# ============================================================
#  Cherry Studio Workspace Fixer - fix_claude_paths.ps1
#  修复 Claude 层的路径残留 (.claude.json + projects 目录名)
#  用法(可由 fix_claude_paths.bat 调用, 或手动):
#    powershell -File fix_claude_paths.ps1 -OldRoot "C:\旧根" -NewRoot "E:\新根"
# ============================================================

param(
    [string]$OldRoot = ($env:OLD_ROOT),
    [string]$NewRoot = ($env:NEW_ROOT)
)

$ErrorActionPreference = 'Stop'

if (-not $OldRoot -or -not $NewRoot) {
    Write-Host '[错误] 必须提供 -OldRoot 和 -NewRoot。' -ForegroundColor Red
    Write-Host '用法: powershell -File fix_claude_paths.ps1 -OldRoot "C:\旧根" -NewRoot "E:\新根"'
    exit 1
}

$ClaudeDir = Join-Path $NewRoot 'Data\Agents\.claude'

# 编码名: Claude Code 逐字符把路径中的 : / \ 和空格替换成 -
$OldEnc = $OldRoot -replace '[:\/\\ ]', '-'
$NewEnc = $NewRoot -replace '[:\/\\ ]', '-'

Write-Host ''
Write-Host '====== Cherry Studio Workspace Fixer [Claude 层] ======'
Write-Host ('旧根: ' + $OldRoot)
Write-Host ('新根: ' + $NewRoot)
Write-Host ''

$JsonPath = Join-Path $ClaudeDir '.claude.json'
if (-not (Test-Path -LiteralPath $JsonPath)) {
    Write-Host ('[跳过] 未找到 .claude.json: ' + $JsonPath) -ForegroundColor Yellow
} else {
    # 备份
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bak = $JsonPath + '.bak-' + $stamp
    Copy-Item -LiteralPath $JsonPath -Destination $bak -Force
    Write-Host ('[备份] ' + $bak) -ForegroundColor Cyan

    # 替换
    $text = [System.IO.File]::ReadAllText($JsonPath)
    $oldFwd = $OldRoot -replace '\\', '/'
    $newFwd = $NewRoot -replace '\\', '/'
    $cntSlash = 0
    $cntBack = 0
    if ($text.Contains($oldFwd)) {
        $cntSlash = ([regex]::Matches($text, [regex]::Escape($oldFwd))).Count
        $text = $text.Replace($oldFwd, $newFwd)
    }
    if ($text.Contains($OldRoot)) {
        $cntBack = ([regex]::Matches($text, [regex]::Escape($OldRoot))).Count
        $text = $text.Replace($OldRoot, $NewRoot)
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($JsonPath, $text, $utf8NoBom)
    Write-Host ('[修复] .claude.json: 正斜杠 ' + $cntSlash + ' 处, 反斜杠 ' + $cntBack + ' 处') -ForegroundColor Green
}

# projects 目录重命名
$ProjectsDir = Join-Path $ClaudeDir 'projects'
if (Test-Path -LiteralPath $ProjectsDir) {
    $renamed = 0
    $skipped = 0
    Get-ChildItem -LiteralPath $ProjectsDir -Directory |
        Where-Object { $_.Name.StartsWith($OldEnc) } |
        ForEach-Object {
            $newName = $NewEnc + $_.Name.Substring($OldEnc.Length)
            $dest = Join-Path $ProjectsDir $newName
            if (Test-Path -LiteralPath $dest) {
                $skipped++
                Write-Host ('[跳过] 目标已存在: ' + $newName) -ForegroundColor Yellow
            } else {
                Rename-Item -LiteralPath $_.FullName -NewName $newName
                $renamed++
                Write-Host ('[重命名] ' + $_.Name + '  ->  ' + $newName) -ForegroundColor Green
            }
        }
    Write-Host ('[完成] 目录重命名 ' + $renamed + ' 个, 跳过 ' + $skipped + ' 个') -ForegroundColor Green
} else {
    Write-Host ('[跳过] 未找到 projects 目录: ' + $ProjectsDir) -ForegroundColor Yellow
}

Write-Host ''
Write-Host '[完成] Claude 层修复结束。' -ForegroundColor Green
exit 0
