const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/permission');
const adminService = require('../services/adminService');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  try {
    const result = adminService.login(username, password);
    res.json(result);
  } catch (err) {
    if (err.message.includes('用户名或密码') || err.message.includes('已禁用'))
      return res.status(401).json({ error: err.message });
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/profile/:adminId', requireAdminAuth, (req, res) => {
  const adminId = parseInt(req.params.adminId);
  
  try {
    const admin = adminService.getProfile(adminId);
    res.json(admin);
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: '无效的管理员ID' });
  }
});

router.post('/create', requireAdminAuth, requirePermission('manage_admins'), (req, res) => {
  const { username, password, role, permissions } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });

  try {
    const adminId = adminService.createAdmin(username, password, role, permissions, req.admin.id, req.ip);
    res.status(201).json({ adminId, message: '管理员创建成功' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: '用户名已存在' });
    res.status(500).json({ error: '创建失败' });
  }
});

router.put('/update/:adminId', requireAdminAuth, requirePermission('manage_admins'), (req, res) => {
  const adminId = parseInt(req.params.adminId);
  const { password, role, status, permissions } = req.body;

  try {
    adminService.updateAdmin(adminId, { password, role, status, permissions }, req.admin.id, req.ip);
    res.json({ message: '管理员信息已更新' });
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:adminId', requireAdminAuth, requirePermission('manage_admins'), (req, res) => {
  const adminId = parseInt(req.params.adminId);

  try {
    adminService.deleteAdmin(adminId, req.admin.id, req.ip);
    res.json({ message: '管理员已删除' });
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    if (err.message.includes('不能删除')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: '删除失败' });
  }
});

router.get('/list', requireAdminAuth, requirePermission('manage_admins'), (req, res) => {
  const admins = adminService.getAllAdmins();
  res.json(admins);
});

router.get('/logs', requireAdminAuth, requirePermission('view_logs'), (req, res) => {
  const logs = adminService.getLogs();
  res.json(logs);
});

module.exports = router;
