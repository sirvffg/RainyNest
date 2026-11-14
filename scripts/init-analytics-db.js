// scripts/init-analytics-db.js — analytics.db PRAGMA 优化（WAL 等，只在访问库上生效）
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

const dbDir = path.join(__dirname, '..', 'db');
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'analytics.db'));

db.pragma('journal_mode = WAL');     // WAL 模式：读写并发（最重要！）
db.pragma('synchronous = NORMAL');   // 换速度，掉电最多丢最后几条 PV
db.pragma('busy_timeout = 3000');    // 锁等待 3 秒兜底
db.pragma('cache_size = -64000');    // 64MB 缓存
db.pragma('temp_store = MEMORY');    // 临时表存内存
db.pragma('mmap_size = 268435456');  // 256MB mmap

db.close();

console.log('[init-analytics-db] ✓ PRAGMA 优化已应用');
