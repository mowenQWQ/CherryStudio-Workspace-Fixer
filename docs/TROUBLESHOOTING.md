# 排查经验与证据链（Troubleshooting Notes）

⚠️ 本文由 AI 辅助整理，仅供学习与参考使用。发布或引用前请人工核实信息。

---

## 0. 问题一句话

Cherry Studio 数据整体搬迁（C 盘 → 其他盘）后，打开旧 Agent 对话报错：
`System workspace path is outside the managed workspace root: <旧路径>\system\2026-XX-XX\<uuid>`

**报错路径会随你点开的对话变化。** 这是最重要的线索：说明每个对话有自己独立的工作区路径记录，且都指向旧位置。

## 1. 关键判断：大纲正确，细节纠正

网上常见的诊断说："是设置里 workspace 路径残留，去 settings.json / config.json 改路径"。

**这个方向是对的，但位置找错了。** 实际情况是：

- `config.json` 里**没有** workspace 字段（只有 gitBashPath、theme 等），改它没用；
- 真正的残留分散在 **三处**：

| 层 | 残留位置 | 内容 | 是否报错源头 |
|---|---|---|---|
| Claude 层 | `Data\Agents\.claude\.claude.json` | `projects` 键仍然是旧路径 | 参与 |
| Claude 层 | `Data\Agents\.claude\projects\` | 88 个目录名是旧路径编码 | 参与 |
| **Cherry 数据层** | **`Data\cherrystudio.sqlite` → `agent_workspace.path`** | **每个对话的工作区路径，全部是旧路径** | **真正报错源** |

## 2. 证据链（当时如何一步步确认的）

1. `grep` 全盘找报错路径 → 在 `.claude.json` 的 `projects` 里找到同一条（唯一一条）；
2. 发现 `.claude\projects\` 下 88 个目录全部是 `C--Users-...` 编码名，仅 1 个 E 盘（当前会话）；
3. 修改了 `.claude.json` 和目录名后（第一版脚本），**报错依旧** → 证明源头不在 Claude 层；
4. 用户提示"报错路径随我选的对话变化" → 断定：每个对话有独立路径记录 → 去查数据库；
5. 用只读探测（node:sqlite + `DatabaseSync`）扫 `cherrystudio.sqlite`：
   - `agent_workspace` 表 `path` 列：**34 行全部是旧路径** ← 真凶；
   - 另有 `job.error` 表里 2 行是报错文本本身；`preference.value` 1 行是 Notes 路径；
   - 其余命中（`message.data`、`agent_session_message`、`knowledge_item`、`translate_history`）都是**历史聊天正文里提到过路径**，是内容不是配置，**绝不要动**。

## 3. 关键论断

> **"先区分'这是配置残留'还是'历史内容'再决定改不改。"**
> 扫描会命中很多行，但只有 `agent_workspace.path` 这种"对话↔工作区映射"是必须修的配置；
> 碰历史正文 = 污染聊天记录，毫无收益且有风险。

## 4. 修复脚本设计要点

| 要点 | 做法 |
|---|---|
| 数据库修复前 | 先完整备份 `cherrystudio.sqlite` → `.bak-时间戳` |
| 只改必要列 | `UPDATE agent_workspace SET path = replace(path, 旧根, 新根) WHERE instr(path, 旧根)>0` |
| 预览/确认 | 先只读预览将改的行，确认后 `--apply` 才写 |
| 复查 | 改完再查 `instr(path, 旧根)>0` 应为 0 |
| 字符串替换 | `replace()` 精确替换前缀，不碰无关内容 |
| 目录重命名 | 目录名是旧路径的**编码形式**（`C--Users-...`），按编码前缀批量替换 |

## 5. 运行时环境注意

- **必须完全退出 Cherry Studio** 再改数据库；进程占用时 SQLite 打开会失败（`OPEN_ERROR`）。
- 数据库有 WAL 模式（`.sqlite-wal` 文件），修复时如果程序正在跑，非 checkpoint 数据可能被写回，导致你改的被覆盖。
- 脚本调用 `node` 时应带多重候选路径（PATH、mise shims、真实安装目录），不要只赌 PATH。

## 6. Windows 脚本踩坑（win-dev-pitfalls 验证过）

| 坑 | 现象 | 对策 |
|---|---|---|
| bat 用 UTF-8 + chcp 65001 | 中文批量乱码/错位 | 中文 Windows 一律 **GBK + 无 BOM + CRLF**，不写 chcp |
| bat `if (...) else (...)` 括号块内 echo 裸 `()` | 运行时语法错 | 用 goto 结构 + 文本用方括号 |
| ps1 存 UTF-8 无 BOM | PS 5.1 按 ANSI 解读中文乱码 | ps1 必须 **UTF-8 带 BOM + CRLF** |
| 找不到 PowerShell/Node 就往下跑 | 空变量展开报错 | 多重候选 + 找不到就明确报错退出 |
| 脚本假设输入是某种编码 | 第二次跑损坏文件 | 转换脚本要幂等；读前探测字节头 |

## 7. 数据核查（如何确认没修丢数据）

修复工具自动生成的 `.bak-时间戳` 是修复前的完整库。用一个只读脚本逐表对比：

```
备份库 vs 当前库 → 各表行数差异 + agent.instructions(系统提示词)长度对比
```

若某表行数有差异，再判断是"修复脚本误删"还是"你自己清理旧文件删的"。**只要没碰历史正文表，行数就不会因为修复脚本变化。**

## 8. 给用户的最终清理建议

数据修复完成后，C 盘旧目录还会残留大量日志（程序日志默认写那），空间占用可能很大（本例 28GB）。

- 不建议直接删整个目录（日志仍被占用，删一半会卡住）；
- 更稳：先**改名** `CherryStudio` → `CherryStudio.old`（瞬间释放名义空间、可随时改回），
  确认运行 1–2 天正常后再真正删除；
- 重启后程序可能在 C 盘重建小 `logs` 目录，属正常现象，不是"没删干净"。

## 9. 结论

**报错路径随对话变化 == 每个对话有独立工作区路径记录 == 查数据库 `agent_workspace.path`。**
这是本案例最值得记住的一条经验。

---

## 10. 日志炸弹（Cherry Studio 2.x 错误日志 GB 级膨胀）与 log_guard

> 这是**另一个问题**（与路径修复无关），但与本工具同为 Cherry Studio 的配套运维事项，v2.0.0 起并入工具箱。

### 现象

- `%APPDATA%\CherryStudio\logs` 目录快速膨胀，单文件动辄 10–20 MB，总量可达 GB 级（实测 83 文件 / 1.1 GB）。
- 日志文件命名规律：`app.YYYY-MM-DD.log.N` 与 `app-error.YYYY-MM-DD.log.N`（N 为滚动序号，两份内容几乎相同）。

### 触发链（2026-09-12 实测证据）

```
中转站未响应 / model route not found → AI Router 收 503/404
  → Cherry Studio 错误处理器 AI_APICallError 全量序列化 requestBody
      （完整 system prompt + 数百个 tool 定义 + 所有 tool_calls）
  → 单条日志可达 3.7 MB（实测单行 3711997 字节）
  → 每次错误写两份（app + app-error）→ 速率约 3.75 GB/h，24h 可达 80+ GB
```

### 官方状态

- GitHub **#20363**（已 assign 官方维护者认领）、**#18373**（p1，已 assign）——2.0.14 仍未修复。
- 官方修复前，客户端兜底用 `scripts\log_guard.bat`（v2.0.0 新增）：

```bat
rem 只读报告
scripts\log_guard.bat

rem 清理: 保留最近 2h, 删除更早的超大文件(先备份 + 确认 + 复查)
scripts\log_guard.bat --clean --retain-hours 2
```

### log_guard 安全设计

| 点 | 做法 |
|---|---|
| 只动日志 | 仅处理 logs 目录内 `*.log*`，绝不碰其它路径 |
| 保留正在写的 | mtime 在 retain-hours 内的文件（含正在写入的）不列入候选 |
| 先备份后删 | 删除前复制到 `logs\.guard-backup-<时间戳>\`（`--no-backup` 可关） |
| 二次确认 | 删除前列出全部候选并请求 y/n 确认（`--yes` 跳过） |
| 清理后复查 | 输出剩余 .log 大小，与清理前对比 |
| 运行不冲突 | Cherry Studio 运行中也能安全跑（不删保留期文件） |

### 经验沉淀（通用）

1. **生产环境错误日志只留元数据**（模块/时间/状态码/request id），requestBody 最多截断 1–4 KB，必须有保留策略。
2. **定时清理是兜底不是解决**，源头（官方修好）解决后应撤销；本工具设计为手动跑，不装定时任务。
3. 识别炸弹的快速办法：`ls -lS` 看日志目录里有没有远超其它文件的巨型文件。