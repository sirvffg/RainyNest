// scripts/init-fts.js — 主库 FTS5 全文搜索虚拟表 + 同步触发器
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', 'db', 'blog.db');
if (!fs.existsSync(dbPath)) {
  console.error('[init-fts] ✗ db/blog.db 不存在，请先运行 npm run db:deploy');
  process.exit(1);
}

const db = new Database(dbPath);

// FTS5 虚拟表（content 表同步，全文索引 title/summary/content）
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS post_fts USING fts5(
    title, summary, content,
    content='Post', content_rowid='rowid',
    tokenize='porter unicode61'
  );
`);

// 触发器：文章创建/更新/删除时同步 FTS 表
db.exec(`
  CREATE TRIGGER IF NOT EXISTS post_ai AFTER INSERT ON Post BEGIN
    INSERT INTO post_fts(rowid, title, summary, content) VALUES (new.rowid, new.title, new.summary, new.content);
  END;

  CREATE TRIGGER IF NOT EXISTS post_ad AFTER DELETE ON Post BEGIN
    INSERT INTO post_fts(post_fts, rowid, title, summary, content) VALUES('delete', old.rowid, old.title, old.summary, old.content);
  END;

  CREATE TRIGGER IF NOT EXISTS post_au AFTER UPDATE ON Post BEGIN
    INSERT INTO post_fts(post_fts, rowid, title, summary, content) VALUES('delete', old.rowid, old.title, old.summary, old.content);
    INSERT INTO post_fts(rowid, title, summary, content) VALUES (new.rowid, new.title, new.summary, new.content);
  END;
`);

// 已有数据回填
db.exec(`INSERT INTO post_fts(post_fts) VALUES('rebuild');`);

db.close();

console.log('[init-fts] ✓ FTS5 虚拟表 + 触发器已创建');
