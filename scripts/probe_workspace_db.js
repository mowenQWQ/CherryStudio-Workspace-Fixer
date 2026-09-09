// Cherry Studio Workspace Fixer - probe_workspace_db.js
// 只读探测: 扫描数据库中所有含旧路径(/旧根关键字)的表/列/行
// 用法: node probe_workspace_db.js [数据库路径] [关键字]

const { DatabaseSync } = require('node:sqlite');

const defDb = (process.env.APPDATA || process.env.HOME || '').replace(/\\/g, '/') + '/CherryStudio/Data/cherrystudio.sqlite';
const DEFAULT_DB = process.argv[2] || defDb;
const NEEDLE = process.argv[3] || 'CherryStudio';

let db;
try {
    db = new DatabaseSync(DEFAULT_DB, { readOnly: true });
} catch (e) {
    console.log('OPEN_ERROR: ' + e.message);
    process.exit(2);
}

console.log('DB: ' + DEFAULT_DB);
console.log('KEYWORD: ' + NEEDLE);
console.log('MODE: read-only probe (nothing will be modified)');
console.log('');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('TABLES: ' + tables.length);
console.log('');

function qstr(s) { return JSON.stringify(String(s)); }

let totalHits = 0;
for (const t of tables) {
    let cols;
    try { cols = db.prepare('PRAGMA table_info(' + qstr(t.name) + ')').all(); } catch (e) { continue; }
    for (const c of cols) {
        const ty = String(c.type || '').toUpperCase();
        if (!(ty.includes('CHAR') || ty.includes('TEXT') || ty.includes('CLOB') || ty.includes('JSON'))) continue;
        const cntQ = 'SELECT COUNT(*) AS n FROM ' + qstr(t.name) + ' WHERE instr(' + qstr(c.name) + ',?) > 0';
        let n;
        try { n = db.prepare(cntQ).get(NEEDLE).n; } catch (e) { continue; }
        if (!n || n <= 0) continue;
        totalHits += n;
        console.log('HIT table=' + t.name + '  col=' + c.name + '  rows=' + n);
        const sampQ = 'SELECT ' + qstr(c.name) + ' AS v FROM ' + qstr(t.name) + ' WHERE instr(' + qstr(c.name) + ',?) > 0 LIMIT 2';
        let rows;
        try { rows = db.prepare(sampQ).all(NEEDLE); } catch (e) { rows = []; }
        rows.forEach(r => {
            const v = String(r.v);
            console.log('    SAMPLE[' + v.length + ']: ' + v.slice(0, 200));
        });
    }
}
console.log('');
console.log('TOTAL rows containing "' + NEEDLE + '": ' + totalHits);
console.log('DONE');
db.close();