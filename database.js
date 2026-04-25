const crypto = require('crypto');

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'voting.db');
let db;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'super_admin',
      status TEXT DEFAULT 'active',
      permissions TEXT DEFAULT '{"create_poll":true,"manage_users":true,"manage_admins":true,"view_logs":true}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      group_id INTEGER,
      created_by INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      votes INTEGER DEFAULT 0,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vote_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      poll_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, poll_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS registered_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
  `);

  saveDatabase();

  // 数据迁移：确保 polls 表包含 group_id 字段
  try {
    const columns = getAll('PRAGMA table_info(polls)');
    const hasGroupId = columns.some(col => col.name === 'group_id');
    if (!hasGroupId) {
      db.run('ALTER TABLE polls ADD COLUMN group_id INTEGER');
      console.log('[数据库迁移] 已为 polls 表添加 group_id 字段');
      saveDatabase();
    }
  } catch (err) {
    console.log('[数据库迁移] polls 表已包含 group_id 字段');
  }

  const adminCount = getRow('SELECT COUNT(*) as count FROM admins');
  if (!adminCount || adminCount.count === 0) {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    db.run(
      "INSERT INTO admins (username, password_hash, role) VALUES (?, ?, 'super_admin')",
      ['admin', hashPassword(defaultPassword)]
    );
    console.log('[安全] 初始管理员已创建，请尽快修改默认密码');
    saveDatabase();
  }

  const groupCount = getRow('SELECT COUNT(*) as count FROM groups');
  if (!groupCount || groupCount.count === 0) {
    db.run("INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)",
      ['综合讨论区', '各类话题自由讨论', 1]);
    db.run("INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)",
      ['技术开发', '编程、框架、工具相关话题', 1]);
    db.run("INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)",
      ['生活娱乐', '游戏、影视、音乐等娱乐话题', 1]);
    saveDatabase();
  }

  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

function getLastInsertId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result.length > 0 ? result[0].values[0][0] : null;
}

function getRow(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastInsertRowid = getLastInsertId();
  saveDatabase();
  return { lastInsertRowid };
}

function exec(sql, params = []) {
  db.run(sql, params);
}

function transaction(fn) {
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    saveDatabase();
    throw err;
  }
}

function runInTx(sql, params = []) {
  db.run(sql, params);
  return { lastInsertRowid: getLastInsertId() };
}

function logAdminAction(adminId, action, targetType, targetId, details, ip) {
  exec(
    'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId, action, targetType, targetId, details || null, ip || null]
  );
  saveDatabase();
}

module.exports = {
  initDatabase, getRow, getAll, run, exec, runInTx, transaction, saveDatabase, logAdminAction, hashPassword
};
