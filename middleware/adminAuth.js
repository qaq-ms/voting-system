const { getRow } = require('../database');

function requireAdminAuth(req, res, next) {
  const adminId = req.body?.adminId || req.query?.adminId;
  if (!adminId) return res.status(401).json({ error: '未授权' });
  
  const admin = getRow('SELECT * FROM admins WHERE id = ?', [parseInt(adminId)]);
  if (!admin) return res.status(404).json({ error: '管理员不存在' });
  if (admin.status !== 'active') return res.status(403).json({ error: '管理员账户已禁用' });
  
  req.admin = admin;
  next();
}

module.exports = { requireAdminAuth };
