# CherryStudio-Workspace-Fixer

**一站式修复 Cherry Studio 数据搬迁后，历史 Agent 对话报错 `System workspace path is outside the managed workspace root` 的工具——三处残留路径（.claude.json + projects 目录名 + 数据库 agent_workspace.path）全覆盖，先预览、再备份、后修复、自动复查。全脱敏。**

**A one-stop fixer for the `System workspace path is outside the managed workspace root` error on old Agent conversations after relocating Cherry Studio's data directory — covers all three leftover locations (.claude.json + projects dir names + DB agent_workspace.path), with preview → backup → fix → recheck. Fully desensitized.**

[中文](#中文) | [English](#english)

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

### 快速上手

```bat
rem 1) 编辑 scripts\*.bat 顶部两行，改成你的旧/新数据目录
rem    OLD_ROOT = 搬迁前的位置（如 C:\Users\你\AppData\Roaming\CherryStudio）
rem    NEW_ROOT = 现在的位置（如 E:\CherryStudio-Data）

rem 0) 完全退出 Cherry Studio（托盘也要退出）

rem 2) 修复 Claude 层（.claude.json + projects 目录名）
scripts\fix_claude_paths.bat

rem 3) 修复数据库层（预览 → 确认 → 自动备份 → 修复 → 复查，一键）
scripts\fix_workspace_db.bat

rem 4) 重启 Cherry Studio，打开旧对话验证
```

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

### Quick start

```bat
rem 1) Edit the two lines at the top of scripts\*.bat with your old/new data roots
rem    OLD_ROOT = pre-move location (e.g. C:\Users\you\AppData\Roaming\CherryStudio)
rem    NEW_ROOT = current location (e.g. E:\CherryStudio-Data)

rem 0) Fully exit Cherry Studio (including tray)

rem 2) Fix the Claude layer (.claude.json + projects dir names)
scripts\fix_claude_paths.bat

rem 3) Fix the database layer (preview -> confirm -> auto backup -> fix -> recheck)
scripts\fix_workspace_db.bat

rem 4) Restart Cherry Studio and open an old conversation
```

Optional read-only checks:

```bat
scripts\probe_workspace_db.bat
scripts\check_agent_data.bat
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## 🤖 AI 使用声明 / AI Usage Disclosure

本项目在开发与维护过程中使用了 AI 编程助手（Chatbox AI / GLM）辅助代码编写、脱敏整理与问题排查；问题定位、核心决策、内容审核与最终发布由维护者完成。

This project was developed and maintained with the assistance of an AI coding assistant (Chatbox AI / GLM) for coding, desensitization, and troubleshooting. Problem identification, core decisions, content review, and final release are made by the maintainer.
