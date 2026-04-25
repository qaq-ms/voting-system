const express = require('express');
const router = express.Router();
const { getRow, getAll, run, exec, transaction, logAdminAction } = require('../database');

function checkPermission(adminId, permission) {
  const admin = getRow('SELECT * FROM admins WHERE id = ?', [parseInt(adminId)]);
  if (!admin) return { ok: false, msg: '管理员不存在' };
  if (admin.status !== 'active') return { ok: false, msg: '管理员账户已禁用' };
  try {
    const perms = JSON.parse(admin.permissions);
    if (!perms[permission]) return { ok: false, msg: '权限不足' };
    return { ok: true, admin };
  } catch {
    return { ok: false, msg: '权限配置错误' };
  }
}

function authMiddleware(permission) {
  return (req, res, next) => {
    const { adminId } = req.body || {};
    if (!adminId) return res.status(401).json({ error: '未授权' });
    const result = checkPermission(adminId, permission);
    if (!result.ok) return res.status(403).json({ error: result.msg });
    req.admin = result.admin;
    next();
  };
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const admin = getRow('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin) return res.status(401).json({ error: '用户名或密码错误' });
  if (admin.password_hash !== password) return res.status(401).json({ error: '用户名或密码错误' });
  if (admin.status !== 'active') return res.status(403).json({ error: '账户已禁用' });

  run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
  logAdminAction(admin.id, 'login', 'admin', admin.id, '管理员登录', req.ip);
  res.json({ adminId: admin.id, username: admin.username, role: admin.role, permissions: JSON.parse(admin.permissions) });
});

router.get('/profile/:adminId', (req, res) => {
  const adminId = parseInt(req.params.adminId);
  if (isNaN(adminId)) return res.status(400).json({ error: '无效的管理员ID' });
  const admin = getRow('SELECT id, username, role, status, permissions, created_at, last_login FROM admins WHERE id = ?', [adminId]);
  if (!admin) return res.status(404).json({ error: '管理员不存在' });
  admin.permissions = JSON.parse(admin.permissions);
  res.json(admin);
});

router.post('/create', authMiddleware('manage_admins'), (req, res) => {
  const { username, password, role, permissions } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });

  try {
    const perms = permissions || JSON.stringify({ create_poll: true, manage_users: true, manage_admins: false, view_logs: true });
    const { lastInsertRowid } = run(
      'INSERT INTO admins (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)',
      [username, password, role || 'admin', perms]
    );
    logAdminAction(req.admin.id, 'create_admin', 'admin', lastInsertRowid, `创建管理员: ${username}`, req.ip);
    res.status(201).json({ adminId: lastInsertRowid, message: '管理员创建成功' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: '用户名已存在' });
    res.status(500).json({ error: '创建失败' });
  }
});

router.put('/update/:adminId', authMiddleware('manage_admins'), (req, res) => {
  const adminId = parseInt(req.params.adminId);
  if (isNaN(adminId)) return res.status(400).json({ error: '无效的管理员ID' });
  
  const { password, role, status, permissions } = req.body;
  const target = getRow('SELECT * FROM admins WHERE id = ?', [adminId]);
  if (!target) return res.status(404).json({ error: '管理员不存在' });

  try {
    transaction(() => {
      if (password) exec('UPDATE admins SET password_hash = ? WHERE id = ?', [password, adminId]);
      if (role) exec('UPDATE admins SET role = ? WHERE id = ?', [role, adminId]);
      if (status) exec('UPDATE admins SET status = ? WHERE id = ?', [status, adminId]);
      if (permissions) exec('UPDATE admins SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), adminId]);
    });

    logAdminAction(req.admin.id, 'update_admin', 'admin', adminId, `更新管理员: ${target.username}`, req.ip);
    res.json({ message: '管理员信息已更新' });
  } catch {
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:adminId', authMiddleware('manage_admins'), (req, res) => {
  const adminId = parseInt(req.params.adminId);
  if (isNaN(adminId)) return res.status(400).json({ error: '无效的管理员ID' });
  
  const target = getRow('SELECT * FROM admins WHERE id = ?', [adminId]);
  if (!target) return res.status(404).json({ error: '管理员不存在' });
  if (req.admin.id === adminId) return res.status(400).json({ error: '不能删除自己' });

  try {
    run('DELETE FROM admins WHERE id = ?', [adminId]);
    logAdminAction(req.admin.id, 'delete_admin', 'admin', adminId, `删除管理员: ${target.username}`, req.ip);
    res.json({ message: '管理员已删除' });
  } catch {
    res.status(500).json({ error: '删除失败' });
  }
});

router.get('/list', authMiddleware('manage_admins'), (req, res) => {
  const admins = getAll('SELECT id, username, role, status, permissions, created_at, last_login FROM admins ORDER BY created_at DESC');
  admins.forEach(a => { a.permissions = JSON.parse(a.permissions); });
  res.json(admins);
});

router.get('/logs', authMiddleware('view_logs'), (req, res) => {
  const logs = getAll(`
    SELECT al.*, a.username as admin_name
    FROM admin_logs al
    JOIN admins a ON al.admin_id = a.id
    ORDER BY al.created_at DESC
    LIMIT 100
  `);
  res.json(logs);
});

module.exports = router;
