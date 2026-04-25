const express = require('express');
const router = express.Router();
const { getRow, getAll, run, transaction, logAdminAction } = require('../database');

function generateDeviceId() {
  return 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

router.post('/login', (req, res) => {
  const { username, deviceId } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: '用户名不能为空' });

  try {
    const existingUser = deviceId ? getRow('SELECT * FROM users WHERE device_id = ?', [deviceId]) : null;
    if (existingUser) {
      run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [existingUser.id]);
      return res.json({
        userId: existingUser.id,
        username: existingUser.username,
        deviceId: existingUser.device_id,
        status: existingUser.status
      });
    }

    const newDeviceId = deviceId || generateDeviceId();
    const { lastInsertRowid } = run(
      'INSERT INTO users (device_id, username, last_login) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [newDeviceId, username.trim()]
    );

    res.status(201).json({ userId: lastInsertRowid, username: username.trim(), deviceId: newDeviceId, status: 'active' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      const user = getRow('SELECT * FROM users WHERE device_id = ?', [deviceId || '']);
      if (user) return res.json({ userId: user.id, username: user.username, deviceId: user.device_id, status: user.status });
    }
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/:userId/status', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: '无效的用户ID' });
  const user = getRow('SELECT id, username, status, created_at, last_login FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

router.get('/:userId/voting-status', (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: '无效的用户ID' });
  const user = getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const polls = getAll('SELECT * FROM polls WHERE status = ? ORDER BY created_at DESC', ['active']);
  const result = polls.map(poll => {
    const voteRecord = getRow(
      'SELECT vr.*, o.text as option_text FROM vote_records vr JOIN options o ON vr.option_id = o.id WHERE vr.user_id = ? AND vr.poll_id = ?',
      [userId, poll.id]
    );
    const options = getAll('SELECT * FROM options WHERE poll_id = ?', [poll.id]);
    return {
      poll: { ...poll, options },
      hasVoted: !!voteRecord,
      votedOption: voteRecord ? { id: voteRecord.option_id, text: voteRecord.option_text } : null
    };
  });

  res.json(result);
});

module.exports = router;
