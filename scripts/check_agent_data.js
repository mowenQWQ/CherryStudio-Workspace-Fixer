// Cherry Studio Workspace Fixer - check_agent_data.js
// 只读对比: 备份库 vs 当前库, 检查各表行数差异 + agent 表系统提示词长度
// 用法:
//   node check_agent_data.js <当前库>            # 单参数: 自动找最新 .bak-时间戳 对比
//   node check_agent_data.js <备份库> <当前库>    # 双参数: 显式指定
// 注意: 必须先有修复时自动生成的 <库>.bak-<时间戳> 备份文件

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function findLatestBackup(f) {
    const dir = path.dirname(f);
    const base = path.basename(f);
    if (!fs.existsSync(dir)) return null;
    // 排除 -wal / -shm (SQLite 副作用文件), 它们不是真正的备份本体
    const matches = fs.readdirSync(dir)
        .filter(n => n.startsWith(base + '.bak-') && !/-wal$/.test(n) && !/-shm$/.test(n));
    if (!matches.length) return null;
    matches.sort();
    return path.join(dir, matches[matches.length - 1]);
}

// ---------- DB 自动探测 ----------
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

// 用法: node check_agent_data.js [当前库]          单参数自动找最新 .bak-时间戳
//       node check_agent_data.js [备份库] [当前库]  双参数显式指定
const A1 = process.argv[2];
const A2 = process.argv[3];
const CUR = A2 ? detectDb(A2) : detectDb(A1);
const BAK = A2 ? detectDb(A1) : findLatestBackup(CUR);

function open(p) {
    if (!fs.existsSync(p)) { console.log('MISSING: ' + p); return null; }
    try { return new DatabaseSync(p, { readOnly: true }); }
    catch (e) { console.log('OPEN_ERROR ' + p + ': ' + e.message); return null; }
}

function tables(db) {
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t => t.name);
}

function count(db, t) {
    try { return db.prepare('SELECT COUNT(*) AS n FROM ' + JSON.stringify(t)).get().n; }
    catch (e) { return -1; }
}

console.log('BAK: ' + BAK);
console.log('CUR: ' + CUR);
console.log('');

if (!BAK) {
    console.log('[提示] 未找到备份文件。数据库修复工具执行时会生成 <库>.bak-<时间戳>, 需先跑一次修复才可对比。');
    process.exit(10);
}

const b = open(BAK);
const c = open(CUR);
if (!b || !c) process.exit(9);

const tb = new Set(tables(b));
const tc = new Set(tables(c));
const all = new Set([...tb, ...tc]);

console.log('=== 各表行数对比 (差异不为 0 时有差异) ===');
console.log('表名'.padEnd(34) + '备份'.padEnd(8) + '当前'.padEnd(8) + '差异');
let anyDiff = false;
for (const t of [...all].sort()) {
    const nb = tb.has(t) ? count(b, t) : 'NA';
    const nc = tc.has(t) ? count(c, t) : 'NA';
    const diff = (typeof nb === 'number' && typeof nc === 'number') ? (nc - nb) : '--';
    if (typeof nb === 'number' && typeof nc === 'number' && nb !== nc) anyDiff = true;
    console.log(String(t).padEnd(34) + String(nb).padEnd(8) + String(nc).padEnd(8) + String(diff));
}

console.log('');
console.log('=== agent 表系统提示词(instructions)长度对比 ===');
try {
    const si = b.prepare('SELECT id, length(COALESCE(instructions,"")) AS l FROM agent').all();
    const sci = c.prepare('SELECT id, length(COALESCE(instructions,"")) AS l FROM agent').all();
    console.log('  备份: ' + JSON.stringify(si));
    console.log('  当前: ' + JSON.stringify(sci));
    const same = JSON.stringify(si) === JSON.stringify(sci);
    console.log('  系统提示词一致: ' + same);
    if (!same) anyDiff = true;
} catch (e) {
    console.log('  instructions 列对比错误: ' + e.message);
}

b.close();
c.close();
console.log('');
console.log(anyDiff ? '结论: 存在差异, 请人工核对对应表。' : '结论: 无差异, 修复过程未改动其他数据。');
console.log('DONE (只读检查完成)');