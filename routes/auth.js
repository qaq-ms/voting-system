const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const result = authService.register(username, password);
    res.status(201).json({ ...result, message: '注册成功' });
  } catch (err) {
    if (err.message.includes('已注册')) return res.status(409).json({ error: err.message });
    if (err.message.includes('为空')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const result = authService.login(username, password);
    res.json(result);
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(401).json({ error: '请先注册账号' });
    if (err.message.includes('密码错误')) return res.status(401).json({ error: err.message });
    if (err.message.includes('禁用')) return res.status(403).json({ error: err.message });
    res.status(500).json({ error: '登录失败' });
  }
});

module.exports = router;
