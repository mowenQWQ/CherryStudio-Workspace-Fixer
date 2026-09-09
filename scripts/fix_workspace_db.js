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
const cp = require('child_process');

// ---------- 参数解析 ----------
function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
}
const Args = process.argv.slice(2);
// Default DB: standard Cherry Studio data location (%APPDATA%\CherryStudio\Data)
const defDb = (process.env.APPDATA || process.env.HOME || '').replace(/\\/g, '/') + '/CherryStudio/Data/cherrystudio.sqlite';
const DB = arg('--db') || defDb;
const OLD = arg('--old');
const NEW = arg('--new');
const MODE = Args.includes('--apply') ? 'apply'
            : Args.includes('--recheck') ? 'recheck'
            : 'preview';

if (!OLD || !NEW) {
    console.log('Usage: node fix_workspace_db.js --db <path> --old <oldRoot> --new <newRoot> [--apply|--recheck]');
    console.log('  --db    path to cherrystudio.sqlite (default: %APPDATA%/CherryStudio/Data/cherrystudio.sqlite)');
    console.log('  --old   old (pre-move) data root, e.g. C:\\Users\\<you>\\AppData\\Roaming\\CherryStudio');
    console.log('  --new   current (post-move) data root, e.g. E:\\CherryStudio');
    process.exit(2);
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
console.log('OLD: ' + OLD);
console.log('NEW: ' + NEW);
console.log('MODE: ' + MODE);
console.log('');

if (!fs.existsSync(DB)) {
    console.log('ERROR: DB not found: ' + DB);
    process.exit(2);
}

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
console.log('agent_workspace rows total        : ' + total);
console.log('agent_workspace rows with OLD path: ' + cnt);
console.log('');

if (MODE === 'recheck') {
    db.close();
    console.log(cnt === 0 ? 'RECHECK PASS: no old paths remain.' : 'RECHECK FAIL: ' + cnt + ' rows still contain OLD path.');
    process.exit(cnt === 0 ? 0 : 4);
}

if (MODE === 'preview') {
    const rows = db.prepare("SELECT id, path FROM agent_workspace WHERE instr(path, ?) > 0 ORDER BY id LIMIT 5").all(OLD);
    rows.forEach(r => { console.log('  #' + r.id + ' ' + r.path); });
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