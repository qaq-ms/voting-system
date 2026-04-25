const { getRow, getAll, run, exec, transaction, logAdminAction, hashPassword } = require('../database');

function login(username, password) {
  const admin = getRow('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin) throw new Error('用户名或密码错误');
  if (admin.password_hash !== hashPassword(password)) throw new Error('用户名或密码错误');
  if (admin.status !== 'active') throw new Error('账户已禁用');

  run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
  logAdminAction(admin.id, 'login', 'admin', admin.id, '管理员登录');

  return {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    permissions: JSON.parse(admin.permissions)
  };
}

function getProfile(adminId) {
  const admin = getRow(
    'SELECT id, username, role, status, permissions, created_at, last_login FROM admins WHERE id = ?',
    [adminId]
  );
  if (!admin) throw new Error('管理员不存在');
  admin.permissions = JSON.parse(admin.permissions);
  return admin;
}

function createAdmin(username, password, role, permissions, creatorId, ip) {
  const perms = permissions || JSON.stringify({
    create_poll: true,
    manage_users: true,
    manage_admins: false,
    view_logs: true
  });

  const { lastInsertRowid } = run(
    'INSERT INTO admins (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)',
    [username, hashPassword(password), role || 'admin', perms]
  );

  logAdminAction(creatorId, 'create_admin', 'admin', lastInsertRowid, `创建管理员: ${username}`, ip);
  return lastInsertRowid;
}

function updateAdmin(adminId, updates, modifierId, ip) {
  const target = getRow('SELECT * FROM admins WHERE id = ?', [adminId]);
  if (!target) throw new Error('管理员不存在');

  transaction(() => {
    if (updates.password) exec('UPDATE admins SET password_hash = ? WHERE id = ?', [hashPassword(updates.password), adminId]);
    if (updates.role) exec('UPDATE admins SET role = ? WHERE id = ?', [updates.role, adminId]);
    if (updates.status) exec('UPDATE admins SET status = ? WHERE id = ?', [updates.status, adminId]);
    if (updates.permissions) exec('UPDATE admins SET permissions = ? WHERE id = ?', [JSON.stringify(updates.permissions), adminId]);
  });

  logAdminAction(modifierId, 'update_admin', 'admin', adminId, `更新管理员: ${target.username}`, ip);
}

function deleteAdmin(adminId, deleterId, ip) {
  const target = getRow('SELECT * FROM admins WHERE id = ?', [adminId]);
  if (!target) throw new Error('管理员不存在');
  if (deleterId === adminId) throw new Error('不能删除自己的管理员账户');

  run('DELETE FROM admins WHERE id = ?', [adminId]);
  logAdminAction(deleterId, 'delete_admin', 'admin', adminId, `删除管理员: ${target.username}`, ip);
}

function getAllAdmins() {
  const admins = getAll('SELECT id, username, role, status, permissions, created_at, last_login FROM admins ORDER BY created_at DESC');
  admins.forEach(a => { a.permissions = JSON.parse(a.permissions); });
  return admins;
}

function getLogs() {
  return getAll(`
    SELECT al.*, a.username as admin_name
    FROM admin_logs al
    JOIN admins a ON al.admin_id = a.id
    ORDER BY al.created_at DESC
    LIMIT 100
  `);
}

function getAllRegisteredUsers() {
  return getAll('SELECT id, username, status, created_at, last_login FROM registered_users ORDER BY created_at DESC');
}

function disableUser(userId, modifierId, ip) {
  const user = getRow('SELECT * FROM registered_users WHERE id = ?', [userId]);
  if (!user) throw new Error('用户不存在');
  run('UPDATE registered_users SET status = ? WHERE id = ?', ['disabled', userId]);
  logAdminAction(modifierId, 'disable_user', 'user', userId, `禁用用户: ${user.username}`, ip);
}

function enableUser(userId, modifierId, ip) {
  const user = getRow('SELECT * FROM registered_users WHERE id = ?', [userId]);
  if (!user) throw new Error('用户不存在');
  run('UPDATE registered_users SET status = ? WHERE id = ?', ['active', userId]);
  logAdminAction(modifierId, 'enable_user', 'user', userId, `启用用户: ${user.username}`, ip);
}

module.exports = {
  login,
  getProfile,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAllAdmins,
  getLogs,
  getAllRegisteredUsers,
  disableUser,
  enableUser
};
