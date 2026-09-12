// Cherry Studio Workspace Fixer - log_guard.js
// 日志炸弹防护: 扫描 Cherry Studio logs 目录, 报告超大日志文件, 可选清理。
// 背景: Cherry Studio 2.x 的 AI_APICallError 错误处理器会把完整 requestBody
//       序列化进日志(单行可达 MB 级), provider 503/model route not found 触发时
//       日志以 GB/h 级膨胀(GitHub issues #20363/#18373, p1)。本模块在官方修复前
//       提供客户端兜底: 只读报告 + 安全的保留期清理。
//
// 用法:
//   node log_guard.js [--dir <logs目录>] [--threshold-mb 10] [--report]      # 只读报告
//   node log_guard.js [--dir <logs目录>] [--threshold-mb 10] --clean [--retain-hours 2] [--yes] [--no-backup]
//
// 安全设计:
//   - report 模式只读, 不改任何文件
//   - clean 只动 logs 目录内 *.log* 文件, 不碰其它任何东西
//   - 候选清理 = mtime 早于 retain-hours 且 size > threshold; 正在写的文件(近期 mtime)绝不碰
//   - 删除前默认先备份到 logs\.guard-backup-<时间戳>\, --no-backup 才跳过
//   - 删除前二次确认(y/n), --yes 跳过
//   - 清理后自动复查, 输出剩余大小

const fs = require('fs');
const path = require('path');

// ---------- 参数解析 ----------
function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
}

function has(name) {
    return process.argv.includes(name);
}

const DEFAULT_LOGS = (process.env.APPDATA || '').replace(/\\/g, '/') + '/CherryStudio/logs';
const LOGS_DIR = (arg('--dir') || DEFAULT_LOGS).replace(/\\/g, '/');
const THRESHOLD_MB = parseFloat(arg('--threshold-mb', '10')) || 10;
const RETAIN_HOURS = parseFloat(arg('--retain-hours', '2')) || 2;
const MODE = has('--clean') ? 'clean' : 'report';
const YES = has('--yes');
const NO_BACKUP = has('--no-backup');

const THRESHOLD_BYTES = THRESHOLD_MB * 1024 * 1024;

// ---------- 工具 ----------
function fmtSize(b) {
    if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
}

function fmtTime(t) {
    const d = new Date(t);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
        p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
        p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// ---------- 主逻辑 ----------
console.log('=== Cherry Studio log guard ===');
console.log('dir         : ' + LOGS_DIR);
console.log('threshold   : ' + THRESHOLD_MB + ' MB');
console.log('mode        : ' + MODE + (MODE === 'clean' ? ' (retain last ' + RETAIN_HOURS + 'h)' : ' (read-only)'));
console.log('');

if (!fs.existsSync(LOGS_DIR)) {
    console.log('ERROR: logs dir not found: ' + LOGS_DIR);
    process.exit(2);
}

const now = Date.now();
const retainMs = RETAIN_HOURS * 3600 * 1000;

const files = fs.readdirSync(LOGS_DIR).map(n => {
    const full = path.join(LOGS_DIR, n);
    let st;
    try { st = fs.statSync(full); } catch (e) { return null; }
    if (!st.isFile()) return null;
    return { name: n, size: st.size, mtime: st.mtimeMs };
}).filter(Boolean).sort((a, b) => b.size - a.size);

const total = files.reduce((s, f) => s + f.size, 0);
const bombs = files.filter(f => f.size > THRESHOLD_BYTES);
const fresh = files.filter(f => now - f.mtime < retainMs);
const freshBytes = fresh.reduce((s, f) => s + f.size, 0);

console.log('files scanned : ' + files.length);
console.log('total size    : ' + fmtSize(total));
console.log('fresh (<' + RETAIN_HOURS + 'h, kept) : ' + fresh.length + ' files / ' + fmtSize(freshBytes));
console.log('bombs (>' + THRESHOLD_MB + 'MB) : ' + bombs.length);
console.log('');

// ---------- 报告 ----------
console.log('--- biggest files ---');
files.slice(0, 15).forEach(f => {
    const tag = f.size > THRESHOLD_BYTES ? ' [BOMB]' : '';
    console.log('  ' + String(f.size).padStart(12) + ' ' + fmtTime(f.mtime) + '  ' + f.name + tag);
});
console.log('');

if (bombs.length > 0) {
    console.log('WARNING: found ' + bombs.length + ' oversized log file(s) — this is the known Cherry Studio');
    console.log('         logging bug (full requestBody written into logs on AI API errors).');
    console.log('         GitHub: #20363 (open), #18373 (p1 assigned). Still present in 2.0.14.');
    console.log('         Mitigation: run with --clean to keep only the last ' + RETAIN_HOURS + 'h of logs.');
    console.log('');
}

if (MODE === 'report') {
    console.log('DONE (read-only, nothing modified). Run with --clean to actually clean up.');
    process.exit(0);
}

// ---------- clean ----------
const candidates = files.filter(f => f.size > THRESHOLD_BYTES && now - f.mtime >= retainMs)
    .sort((a, b) => a.mtime - b.mtime);
const candBytes = candidates.reduce((s, f) => s + f.size, 0);

console.log('--- clean candidates (old + oversized, kept away from fresh files) ---');
console.log('candidates: ' + candidates.length + ' files / ' + fmtSize(candBytes));
console.log('');
if (candidates.length === 0) {
    console.log('Nothing to clean. (All oversized files are within the last ' + RETAIN_HOURS + 'h, or none exceed ' + THRESHOLD_MB + 'MB.)');
    process.exit(0);
}
candidates.forEach(f => {
    console.log('  ' + fmtTime(f.mtime) + '  ' + String(f.size).padStart(12) + '  ' + f.name);
});

// 二次确认
if (!YES) {
    console.log('');
    process.stdout.write('Delete these ' + candidates.length + ' files? Type y then Enter to proceed, anything else to cancel: ');
    let ans = '';
    try {
        const buf = fs.readSync(0, Buffer.alloc(64), 0, 64, null);
        ans = buf.toString('utf8').trim();
    } catch (e) { ans = ''; }
    if (!/^y/i.test(ans)) {
        console.log('Cancelled, nothing was modified.');
        process.exit(0);
    }
}

// 备份
if (!NO_BACKUP) {
    const bakDir = path.join(LOGS_DIR, '.guard-backup-' + stamp());
    try {
        fs.mkdirSync(bakDir, { recursive: true });
        for (const f of candidates) {
            fs.copyFileSync(path.join(LOGS_DIR, f.name), path.join(bakDir, f.name));
        }
        console.log('');
        console.log('Backup created: ' + bakDir + ' (' + fmtSize(candBytes) + ')');
    } catch (e) {
        console.log('BACKUP_FAILED: ' + e.message + ' — aborting without deleting anything.');
        process.exit(5);
    }
}

// 删除
let deleted = 0, failed = 0, freed = 0;
for (const f of candidates) {
    try {
        fs.unlinkSync(path.join(LOGS_DIR, f.name));
        deleted++;
        freed += f.size;
    } catch (e) {
        failed++;
        console.log('  [FAIL] ' + f.name + ': ' + e.message);
    }
}

// 复查
let after = 0;
try { after = fs.readdirSync(LOGS_DIR).filter(n => /\.log($|\.)/.test(n)).reduce((s, n) => {
    try { return s + fs.statSync(path.join(LOGS_DIR, n)).size; } catch (e) { return s; }
}, 0); } catch (e) { /* keep 0 */ }

console.log('');
console.log('Deleted ' + deleted + ' file(s), freed ' + fmtSize(freed) + (failed ? ', failed ' + failed : '') + '.');
console.log('Remaining .log size in dir: ' + fmtSize(after));
console.log(deleted === candidates.length ? 'DONE: cleanup complete.' : 'WARNING: some files failed, check messages above.');
process.exit(deleted === candidates.length ? 0 : 6);
