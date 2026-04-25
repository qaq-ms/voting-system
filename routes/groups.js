const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/permission');
const groupService = require('../services/groupService');

router.get('/list', (req, res) => {
  try {
    const groups = groupService.getAllGroups();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: '获取分组列表失败' });
  }
});

router.post('/create', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '分组名称不能为空' });
  
  try {
    const groupId = groupService.createGroup(name, description, req.admin.id, req.ip);
    res.status(201).json({ id: groupId, message: '分组创建成功' });
  } catch (err) {
    if (err.message.includes('同名')) return res.status(400).json({ error: err.message });
    if (err.message.includes('长度')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: '创建分组失败' });
  }
});

router.put('/:id', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const groupId = parseInt(req.params.id);
  const { name, description, status } = req.body;
  
  try {
    groupService.updateGroup(groupId, { name, description, status }, req.admin.id, req.ip);
    res.json({ message: '分组已更新' });
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    if (err.message.includes('同名') || err.message.includes('名称')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:id', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const groupId = parseInt(req.params.id);
  
  try {
    groupService.deleteGroup(groupId, req.admin.id, req.ip);
    res.json({ message: '分组已删除' });
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
