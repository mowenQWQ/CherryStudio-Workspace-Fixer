# CherryStudio-Workspace-Fixer

**v2.0.0 — Cherry Studio 工具箱：① 修复数据搬迁后的工作区路径残留（.claude.json + projects 目录名 + 数据库 agent_workspace.path 三处全覆盖，先预览、再备份、后修复、自动复查）；② 日志炸弹防护（`log_guard` 报告/清理超大错误日志，官方 #20363/#18373 修复前的客户端兜底）；③ 统一主菜单 `toolbox.bat` 一键直达。全脱敏。**

**v2.0.0 — A Cherry Studio toolbox: ① fix leftover workspace paths after data relocation (all three locations: .claude.json + projects dir names + DB agent_workspace.path, with preview → backup → fix → recheck); ② log-bomb guard (`log_guard` reports/cleans oversized error logs, a client-side mitigation until official #20363/#18373 is fixed); ③ unified launcher `toolbox.bat`. Fully desensitized.**

[中文](#中文) | [English](#english) | [更新日志](#更新日志-changelog)

---

## 中文

### 这是什么

把 Cherry Studio 的数据目录整体搬迁（如 C 盘 → 其他盘）后，旧 Agent 对话全部打不开，报错路径还**随你点开的对话变化**。这个工具把散落在三处的旧路径残留一次修干净，沉淀自真实搬迁案例，**全部脱敏**。

- **根因明确**：报错真源是 `cherrystudio.sqlite` 的 `agent_workspace.path` 表——每个对话存了独立的工作区路径；只改 `.claude.json` 和目录名是不够的。
- **三处全覆盖**：`.claude.json` 的 projects 键、`.claude\projects\` 下 88 个以旧路径编码命名的目录、数据库 `agent_workspace.path`。
- **安全流程**：数据库修复前自动完整备份（`.bak-时间戳`）；先只读预览将改的行，确认后才写；改完自动复查归零；附带只读对比工具核对有无数据丢失。
- **附带排查文档**：`docs/TROUBLESHOOTING.md` 记录完整证据链——为什么改 config.json 没用、为什么历史聊天正文里的路径**绝不能动**。

### 安装

```bash
git clone https://github.com/mowenQWQ/CherryStudio-Workspace-Fixer.git
cd CherryStudio-Workspace-Fixer
```

前置条件：Windows（Win11 验证）、Node.js ≥ 22（内置 `node:sqlite`）、可选 PowerShell 5.1+。

### 统一入口（v2.0.0 新增）

```bat
scripts\toolbox.bat
```

菜单：`[1] 日志炸弹排查与清理`、`[2] 修复工作区路径`、`[3] 只读探测残留路径`、`[4] 数据一致性对比`、`[0] 退出`。各子项也可单独调用下方脚本。

### 日志炸弹防护（v2.0.0 新增）

Cherry Studio 2.x 的 `AI_APICallError` 错误处理器会把完整 requestBody（含 system prompt 与全部工具定义）序列化进日志，provider 503 / `model route not found` 触发时可**单条数 MB、GB/h 级膨胀**（GitHub #20363 open / #18373 p1，2.0.14 仍存在）。官方修复前用本工具兜底：

```bat
rem 只读报告（默认）: 列出超大日志, 估算总大小
scripts\log_guard.bat

rem 清理: 保留最近 2 小时, 删除更早的超大文件(先备份到 .guard-backup, 二次确认后删)
scripts\log_guard.bat --clean --retain-hours 2
```

安全设计：只动日志目录内的 `*.log*`；保留期内（正在写的）文件绝不删；删除前自动备份 + 确认；清理后复查剩余大小。可传 `--dir`、`--threshold-mb`、`--yes`（跳过确认）、`--no-backup`。

### 快速上手（修复工作区路径）

```bat
rem 1) 完全退出 Cherry Studio（托盘也要退出）

rem 2) 修复 Claude 层（.claude.json + projects 目录名）
scripts\fix_claude_paths.bat

rem 3) 修复数据库层（预览 → 确认 → 自动备份 → 修复 → 复查，一键）
rem    v2.0.0 起: 数据库路径自动探测; 不传旧根时自动推断并提示 --old auto
scripts\fix_workspace_db.bat

rem 4) 重启 Cherry Studio，打开旧对话验证
```

> **v2.0.0 自动探测说明**：`fix_workspace_db.js` / `probe_workspace_db.js` / `check_agent_data.js` 在不传 `--db` 时，会自动从常用搬迁位置（`E:\...\CherryStudio`、`D:\...`、`%APPDATA%`）探测第一个存在的 `cherrystudio.sqlite`。旧根（`--old`）未给时，`fix_workspace_db` 会从 `agent_workspace.path` 推断共同前缀并提示；确认无误用 `--old auto` 无交互采用。

可选核查（只读）：

```bat
rem 探测库里还有哪些旧路径残留
scripts\probe_workspace_db.bat

rem 修复前备份 vs 当前库，逐表对比行数，确认没丢数据
scripts\check_agent_data.bat
```

---

## English

### What is this

After relocating Cherry Studio's data directory (e.g. C: → another drive), all pre-move Agent conversations fail to open, and the path in the error message **changes depending on which conversation you click**. This tool cleans up the old-path leftovers scattered across three locations in one go. Born from a real migration case. **Fully desensitized.**

- **Root cause identified**: the real error source is the `agent_workspace.path` table in `cherrystudio.sqlite` — every conversation stores its own workspace path; editing `.claude.json` and directory names alone is not enough.
- **Three locations covered**: the `projects` keys in `.claude.json`, the 88 directories under `.claude\projects\` named after the old path encoding, and `agent_workspace.path` in the database.
- **Safe workflow**: automatic full DB backup (`.bak-<timestamp>`) before fixing; read-only preview first, then confirm to write; automatic recheck to zero afterwards; plus a read-only comparison tool to verify no data loss.
- **Troubleshooting notes included**: `docs/TROUBLESHOOTING.md` documents the full evidence chain — why editing config.json doesn't work, and why paths inside historical chat contents must **never be touched**.

### Install

```bash
git clone https://github.com/mowenQWQ/CherryStudio-Workspace-Fixer.git
cd CherryStudio-Workspace-Fixer
```

Requirements: Windows (verified on Win11), Node.js ≥ 22 (built-in `node:sqlite`), optional PowerShell 5.1+.

### Unified launcher (new in v2.0.0)

```bat
scripts\toolbox.bat
```

Menu: `[1] Log-bomb report & cleanup`, `[2] Fix workspace paths`, `[3] Probe leftover paths (read-only)`, `[4] Data consistency check`, `[0] Exit`. Each item can also be run directly via the scripts below.

### Log-bomb guard (new in v2.0.0)

Cherry Studio 2.x's `AI_APICallError` handler serializes the full requestBody (system prompt + all tool definitions) into logs; a provider 503 / `model route not found` can grow a single line to several MB and the dir by GB/h (GitHub #20363 open / #18373 p1, still present in 2.0.14). Mitigate until official fix:

```bat
rem Read-only report (default): list oversized logs, estimate total size
scripts\log_guard.bat

rem Clean: keep the last 2h, delete older oversized files (backup to .guard-backup first, confirm before delete)
scripts\log_guard.bat --clean --retain-hours 2
```

Safety: only touches `*.log*` inside the logs dir; never deletes files within the retain window (being written); backs up before deleting + asks for confirmation; rechecks remaining size after cleanup. Optional args: `--dir`, `--threshold-mb`, `--yes` (skip confirm), `--no-backup`.

### Quick start (fix workspace paths)

```bat
rem 1) Fully exit Cherry Studio (including tray)

rem 2) Fix the Claude layer (.claude.json + projects dir names)
scripts\fix_claude_paths.bat

rem 3) Fix the database layer (preview -> confirm -> auto backup -> fix -> recheck)
rem    v2.0.0: DB path auto-detected; old root inferred when omitted, adopt with --old auto
scripts\fix_workspace_db.bat

rem 4) Restart Cherry Studio and open an old conversation
```

> **v2.0.0 auto-detection**: `fix_workspace_db.js` / `probe_workspace_db.js` / `check_agent_data.js` auto-probe common relocated locations (`E:\...\CherryStudio`, `D:\...`, `%APPDATA%`) for the first existing `cherrystudio.sqlite` when `--db` is omitted. When `--old` is omitted, `fix_workspace_db` infers the common prefix from `agent_workspace.path` and hints it; confirm and adopt non-interactively with `--old auto`.

Optional read-only checks:

```bat
scripts\probe_workspace_db.bat
scripts\check_agent_data.bat
```

---

## 更新日志 / Changelog

### v2.0.0 (2026-09-13)

**新增**
- `scripts/log_guard.bat` + `scripts/log_guard.js`：日志炸弹防护——只读报告超大日志 / 保留期安全清理（备份+确认+复查），官方 #20363/#18373 修复前的客户端兜底
- `scripts/toolbox.bat`：统一主菜单，一键直达日志防护 / 路径修复 / 探测 / 对比

**增强**
- `fix_workspace_db.js` / `probe_workspace_db.js` / `check_agent_data.js`：数据库路径自动探测（常用搬迁位置 + `%APPDATA%` 候选，取第一个存在）
- `fix_workspace_db.js`：旧根自动推断（未给 `--old` 时从 `agent_workspace.path` 提取共同前缀，`--old auto` 无交互采用）；预览显示待改行占比与抽样

**修复/适配**
- 适配 Cherry Studio 2.0.14（`agent_workspace` 表结构未变，修复逻辑保持兼容）

### v1.0.0 (2026-09-09)

初始版本：三处残留路径（.claude.json + projects 目录名 + 数据库 agent_workspace.path）修复，预览→备份→修复→复查安全流程。

---

## License

MIT — see [LICENSE](LICENSE).

---

## 🤖 AI 使用声明 / AI Usage Disclosure

本项目在开发与维护过程中使用了 AI 编程助手（Chatbox AI / GLM）辅助代码编写、脱敏整理与问题排查；问题定位、核心决策、内容审核与最终发布由维护者完成。

This project was developed and maintained with the assistance of an AI coding assistant (Chatbox AI / GLM) for coding, desensitization, and troubleshooting. Problem identification, core decisions, content review, and final release are made by the maintainer.
