const express = require('express');
const router = express.Router();
const userService = require('../services/userService');

router.post('/login', (req, res) => {
  const { username, deviceId } = req.body;
  
  try {
    const result = userService.login(username, deviceId);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('用户名不能为空')) return res.status(400).json({ error: err.message });
    if (err.message.includes('UNIQUE')) {
      const user = userService.login(username, deviceId);
      return res.json(user);
    }
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/:userId/status', (req, res) => {
  const userId = parseInt(req.params.userId);
  
  try {
    const user = userService.getUserStatus(userId);
    res.json(user);
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: '无效的用户ID' });
  }
});

router.get('/:userId/voting-status', (req, res) => {
  const userId = parseInt(req.params.userId);
  const groupId = req.query.groupId;
  
  try {
    const result = userService.getUserVotingStatus(userId, groupId);
    res.json(result);
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: '无效的用户ID' });
  }
});

module.exports = router;
