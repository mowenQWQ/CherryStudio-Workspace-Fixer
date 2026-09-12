// Cherry Studio Workspace Fixer - fix_workspace_db.js
// 修复数据库 cherrystudio.sqlite 中 agent_workspace.path 的旧路径残留(报错真源)
// 只改该表该列; 先备份再修改; Cherry Studio 运行时拒绝执行。
//
// 用法:
//   node fix_workspace_db.js --db <库> --old <旧根> --new <数据新根>          # 预览
//   node fix_workspace_db.js --db <库> --old <旧根> --new <数据新根> --apply  # 备份+修改
//   node fix_workspace_db.js --db <库> --old <旧根> --new <数据新根> --recheck # 复查

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// ---------- 参数解析 ----------
function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
}
const Args = process.argv.slice(2);
const MODE = Args.includes('--apply') ? 'apply'
            : Args.includes('--recheck') ? 'recheck'
            : 'preview';

// ---------- DB 自动探测 ----------
// 候选列表: 常用搬迁位置 + APPDATA 默认。取第一个存在的。
function detectDb(explicit) {
    if (explicit && fs.existsSync(explicit)) return explicit;
    const candidates = [
        explicit,
        'E:/ai/Chreey Studio/Data/cherrystudio.sqlite',
        'E:/CherryStudio/Data/cherrystudio.sqlite',
        'D:/CherryStudio/Data/cherrystudio.sqlite',
        (process.env.APPDATA || '').replace(/\\/g, '/') + '/CherryStudio/Data/cherrystudio.sqlite',
    ].filter(Boolean);
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return candidates[candidates.length - 1];
}

const DB = detectDb(arg('--db'));
const NEW = arg('--new');
const OLD_EXPLICIT = arg('--old');

if (!NEW) {
    console.log('Usage: node fix_workspace_db.js --db <path> --old <oldRoot> --new <newRoot> [--apply|--recheck]');
    console.log('  --db    path to cherrystudio.sqlite (auto-detected if omitted)');
    console.log('  --old   old (pre-move) data root, e.g. C:\\Users\\<you>\\AppData\\Roaming\\CherryStudio');
    console.log('          (if omitted, inferred from DB rows — requires user confirmation)');
    console.log('  --new   current (post-move) data root, e.g. E:\\CherryStudio  [required]');
    process.exit(2);
}

// ---------- 旧根推断 ----------
// 未显式给 --old 时: 打开 DB(只读), 取 agent_workspace.path 中含 CLI 参数的公共前缀。
// 规则: 对每条 path, 若其所在目录(去掉仓库/会话尾段的根目录)不同于 NEW, 则是候选旧行。
// 简化可靠做法: 找出 path 中"不是以 NEW 开头"的行的最长公共目录前缀(按分隔符切分)。
let OLD = OLD_EXPLICIT;
function inferOldRoot(dbPath, newRoot) {
    let db;
    try { db = new DatabaseSync(dbPath, { readOnly: true }); }
    catch (e) { return null; }
    try {
        const rows = db.prepare('SELECT path FROM agent_workspace WHERE path IS NOT NULL').all();
        const newFwd = newRoot.replace(/\\/g, '/');
        // 正常化: 前后斜杠统一为正斜杠, 去尾斜杠
        const norm = p => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
        const oldPaths = rows.map(r => norm(r.path)).filter(p => p && !p.startsWith(norm(newFwd)));
        if (!oldPaths.length) return null;
        // 最长公共前缀, 按 / 分段取整目录
        const first = oldPaths[0];
        let prefix = '';
        const segs = first.split('/');
        outer: for (let i = 0; i < segs.length; i++) {
            const cand = prefix ? prefix + '/' + segs[i] : segs[i];
            for (const p of oldPaths) {
                if (!p.startsWith(cand + '/')) break outer;
            }
            prefix = cand;
        }
        return prefix || null;
    } finally { try { db.close(); } catch (e) {} }
}

function cherryRunning() {
    try {
        const out = cp.execSync('tasklist /FI "IMAGENAME eq Cherry Studio.exe" /FO CSV /NH', { encoding: 'utf8' });
        return /Cherry Studio\.exe/i.test(out);
    } catch (e) { return false; }
}

function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

console.log('=== Cherry Studio workspace path DB fix ===');
console.log('DB : ' + DB);
console.log('MODE: ' + MODE);
console.log('NEW: ' + NEW);
console.log('');

if (!fs.existsSync(DB)) {
    console.log('ERROR: DB not found: ' + DB);
    console.log('Auto-detected candidates failed too. Pass --db <path> explicitly.');
    process.exit(2);
}

// 旧根推断: 未显式给 --old 时, 从 agent_workspace.path 推断共同前缀。
// 支持 --old auto(非交互, 直接采用推断) 或 --auto 开关。
// 交互确认由 bat 层完成(fix_workspace_db.bat 的预览→确认→apply 流程), 这里是纯推断。
const OLD_AUTO = OLD_EXPLICIT === 'auto' || (!OLD_EXPLICIT && Args.includes('--auto'));
if (OLD_EXPLICIT === 'auto') { OLD = undefined; }

if (!OLD) {
    const inferred = inferOldRoot(DB, NEW);
    if (!inferred) {
        console.log('ERROR: --old is required, and no old root could be inferred from DB rows.');
        console.log('(All agent_workspace.path rows already start with the new root, or the DB has no rows.)');
        process.exit(2);
    }
    if (!OLD_AUTO) {
        // 非 auto 模式: 打印推断, 提示用 --old auto 无交互采用, 或 --old <path> 手动指定
        console.log('Inferred old root: ' + inferred);
        console.log('-> Re-run with --old auto to adopt this inference non-interactively,');
        console.log('   or --old "<path>" to specify manually. (bat launcher confirms before apply.)');
        process.exit(0);
    }
    OLD = inferred;
}

if (!OLD) {
    console.log('ERROR: --old is required in this mode. Pass --old <oldRoot> or use --old auto.');
    process.exit(2);
}

console.log('OLD: ' + OLD);
console.log('');

let db;
try {
    db = new DatabaseSync(DB, { readOnly: MODE === 'preview' || MODE === 'recheck' });
} catch (e) {
    console.log('OPEN_ERROR: ' + e.message);
    console.log('Hint: make sure Cherry Studio is fully closed, then retry.');
    process.exit(3);
}

const cntQ = "SELECT COUNT(*) AS n FROM agent_workspace WHERE instr(path, ?) > 0";
const cnt = db.prepare(cntQ).get(OLD).n;
const totalQ = "SELECT COUNT(*) AS n FROM agent_workspace";
const total = db.prepare(totalQ).get().n;
const pct = total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';
console.log('agent_workspace rows total        : ' + total);
console.log('agent_workspace rows with OLD path: ' + cnt + '  (' + pct + '%)');
console.log('');

if (MODE === 'recheck') {
    db.close();
    console.log(cnt === 0 ? 'RECHECK PASS: no old paths remain.' : 'RECHECK FAIL: ' + cnt + ' rows still contain OLD path.');
    process.exit(cnt === 0 ? 0 : 4);
}

if (MODE === 'preview') {
    const rows = db.prepare("SELECT id, path FROM agent_workspace WHERE instr(path, ?) > 0 ORDER BY id LIMIT 5").all(OLD);
    rows.forEach(r => {
        const short = String(r.path).length > 120 ? String(r.path).slice(0, 117) + '...' : r.path;
        console.log('  #' + r.id + ' ' + short);
    });
    if (cnt > 5) console.log('  ... and ' + (cnt - 5) + ' more row(s)');
    console.log('');
    console.log('Preview only. Run with --apply to actually fix (after backup).');
    db.close();
    process.exit(0);
}

// apply: 先检查 Cherry 是否在运行
db.close();
if (cherryRunning()) {
    console.log('ABORT: Cherry Studio is running. Please fully exit it first.');
    process.exit(4);
}

const bak = DB + '.bak-' + stamp();
try {
    fs.copyFileSync(DB, bak);
    console.log('Backup created: ' + bak);
} catch (e) {
    console.log('BACKUP_FAILED: ' + e.message);
    process.exit(5);
}

try {
    db = new DatabaseSync(DB, { readOnly: false });
} catch (e) {
    console.log('OPEN_ERROR: ' + e.message);
    process.exit(3);
}

const upd = db.prepare("UPDATE agent_workspace SET path = replace(path, ?, ?) WHERE instr(path, ?) > 0");
const info = upd.run(OLD, NEW, OLD);
console.log('Rows updated: ' + info.changes);

const after = db.prepare(cntQ).get(OLD).n;
console.log('Remaining rows with OLD path: ' + after);
db.close();

console.log('');
console.log(after === 0 ? 'DONE: workspace paths fixed.' : 'WARNING: ' + after + ' rows still contain OLD path.');
process.exit(after === 0 ? 0 : 6);