const express = require('express');
const router = express.Router();
const { getRow, getAll, run, exec, runInTx, transaction, logAdminAction } = require('../database');

function requireAuth(req, res, next) {
  const { userId } = req.body || {};
  if (!userId) return res.status(401).json({ error: '请先登录' });
  const user = getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.status !== 'active') return res.status(403).json({ error: '账户已被禁用' });
  req.user = user;
  next();
}

router.post('/:id/vote', requireAuth, (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) return res.status(400).json({ error: '无效的议题ID' });

  const { optionId } = req.body;
  if (!optionId) return res.status(400).json({ error: '请指定投票选项' });

  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) return res.status(404).json({ error: '投票不存在' });
  if (poll.status !== 'active') return res.status(400).json({ error: '该投票已关闭' });

  const option = getRow('SELECT * FROM options WHERE id = ?', [optionId]);
  if (!option || option.poll_id !== pollId) return res.status(400).json({ error: '无效的选项' });

  const existing = getRow('SELECT * FROM vote_records WHERE user_id = ? AND poll_id = ?', [req.user.id, pollId]);
  if (existing) return res.status(409).json({ error: '您已经对该议题投过票了' });

  try {
    transaction(() => {
      runInTx('INSERT INTO vote_records (user_id, poll_id, option_id) VALUES (?, ?, ?)', [req.user.id, pollId, optionId]);
      runInTx('UPDATE options SET votes = votes + 1 WHERE id = ?', [optionId]);
    });
    res.json(getRow('SELECT * FROM options WHERE id = ?', [optionId]));
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: '您已经对该议题投过票了' });
    res.status(500).json({ error: '投票失败' });
  }
});

router.get('/', (req, res) => {
  const polls = getAll('SELECT id, title, status, created_at FROM polls ORDER BY created_at DESC');
  res.json(polls.map(p => ({ ...p, optionCount: getAll('SELECT COUNT(*) as c FROM options WHERE poll_id = ?', [p.id])[0]?.c || 0 })));
});

router.get('/:id', (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) return res.status(400).json({ error: '无效的议题ID' });
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) return res.status(404).json({ error: '投票不存在' });
  const options = getAll('SELECT * FROM options WHERE poll_id = ?', [pollId]);
  res.json({ ...poll, options });
});

router.get('/:id/results', (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) return res.status(400).json({ error: '无效的议题ID' });
  const options = getAll('SELECT * FROM options WHERE poll_id = ?', [pollId]);
  const total = options.reduce((sum, o) => sum + (o.votes || 0), 0);
  res.json({ results: options.map(o => ({ ...o, percentage: total > 0 ? Math.round((o.votes / total) * 100) : 0 })) });
});

module.exports = router;
