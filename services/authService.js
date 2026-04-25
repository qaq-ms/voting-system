const { getRow, run, hashPassword } = require('../database');

function register(username, password) {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) throw new Error('用户名不能为空');
  if (!password) throw new Error('密码不能为空');

  const existing = getRow('SELECT id FROM registered_users WHERE username = ?', [trimmedUsername]);
  if (existing) throw new Error('该用户名已被注册');

  const { lastInsertRowid } = run(
    'INSERT INTO registered_users (username, password_hash) VALUES (?, ?)',
    [trimmedUsername, hashPassword(password)]
  );

  return { userId: lastInsertRowid, username: trimmedUsername };
}

function login(username, password) {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) throw new Error('用户名不能为空');
  if (!password) throw new Error('密码不能为空');

  const user = getRow('SELECT * FROM registered_users WHERE username = ?', [trimmedUsername]);
  if (!user) throw new Error('用户名不存在，请先注册');
  if (user.password_hash !== hashPassword(password)) throw new Error('密码错误');
  if (user.status !== 'active') throw new Error('账户已被禁用');

  run('UPDATE registered_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  return {
    userId: user.id,
    username: user.username,
    status: user.status
  };
}

function getUserInfo(userId) {
  return getRow(
    'SELECT id, username, status, created_at, last_login FROM registered_users WHERE id = ?',
    [userId]
  );
}

module.exports = { register, login, getUserInfo };
