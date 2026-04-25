const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/permission');
const pollService = require('../services/pollService');
const eventHub = require('../eventHub');

router.post('/create', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const { title, description, groupId, options } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '标题不能为空' });
  if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: '至少需要两个选项' });

  try {
    const pollId = pollService.createPoll(title, description, groupId, options, req.admin.id, req.ip);
    const newPoll = pollService.getPollWithDetails(pollId);
    eventHub.notifyNewPoll(newPoll);

    res.status(201).json({ 
      id: pollId, 
      message: '议题创建成功',
      userCount: require('../services/userService').getActiveUserCount()
    });
  } catch (err) {
    console.error('创建议题错误:', err);
    res.status(500).json({ error: '创建议题失败' });
  }
});

router.put('/:id/status', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const { status } = req.body;
  if (!['active', 'closed'].includes(status)) return res.status(400).json({ error: '无效状态' });
  const pollId = parseInt(req.params.id);

  try {
    pollService.updatePollStatus(pollId, status, req.admin.id, req.ip);
    eventHub.notifyPollStatusChanged(pollId, status);
    res.json({ message: '状态已更新' });
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:id', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const pollId = parseInt(req.params.id);

  try {
    pollService.deletePoll(pollId, req.admin.id, req.ip);
    res.json({ message: '议题已删除' });
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: '删除失败' });
  }
});

router.get('/list', requireAdminAuth, requirePermission('create_poll'), (req, res) => {
  const polls = pollService.getAllPollsWithDetails();
  res.json(polls);
});

module.exports = router;
