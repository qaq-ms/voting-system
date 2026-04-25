const express = require('express');
const router = express.Router();
const { getRow, getAll, run, exec, transaction, logAdminAction } = require('../database');

function checkPerm(adminId, perm) {
  const admin = getRow('SELECT * FROM admins WHERE id = ?', [adminId]);
  if (!admin || admin.status !== 'active') return null;
  try { const p = JSON.parse(admin.permissions); return p[perm] ? admin : null; } catch { return null; }
}

function auth(perm) {
  return (req, res, next) => {
    const aid = req.body.adminId || req.query.adminId;
    const admin = checkPerm(aid, perm);
    if (!admin) return res.status(403).json({ error: '权限不足' });
    req.admin = admin;
    next();
  };
}

router.get('/list', auth('manage_users'), (req, res) => {
  const users = getAll('SELECT * FROM users ORDER BY created_at DESC');
  const result = users.map(u => {
    const votes = getAll(`SELECT p.title as poll_title, p.id as poll_id, o.text as voted_option, vr.voted_at FROM vote_records vr JOIN polls p ON vr.poll_id = p.id JOIN options o ON vr.option_id = o.id WHERE vr.user_id = ?`, [u.id]);
    return { ...u, votes, voteCount: votes.length };
  });
  res.json(result);
});

router.put('/:id/status', auth('manage_users'), (req, res) => {
  const { status } = req.body;
  if (!['active', 'banned'].includes(status)) return res.status(400).json({ error: '无效状态' });
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) return res.status(400).json({ error: '无效的用户ID' });
  const user = getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  run('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  logAdminAction(req.admin.id, 'update_user_status', 'user', userId, `用户 ${user.username} 状态改为 ${status}`, req.ip);
  res.json({ message: '状态已更新' });
});

router.delete('/:id', auth('manage_users'), (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) return res.status(400).json({ error: '无效的用户ID' });
  const user = getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  try {
    transaction(() => {
      const votes = getAll('SELECT * FROM vote_records WHERE user_id = ?', [userId]);
      for (const v of votes) exec('UPDATE options SET votes = votes - 1 WHERE id = ?', [v.option_id]);
      exec('DELETE FROM vote_records WHERE user_id = ?', [userId]);
      exec('DELETE FROM users WHERE id = ?', [userId]);
    });
    logAdminAction(req.admin.id, 'delete_user', 'user', userId, `删除用户: ${user.username}`, req.ip);
    res.json({ message: '用户已删除' });
  } catch { res.status(500).json({ error: '删除失败' }); }
});

router.delete('/:userId/votes/:pollId', auth('manage_users'), (req, res) => {
  const userId = parseInt(req.params.userId);
  const pollId = parseInt(req.params.pollId);
  if (isNaN(userId) || isNaN(pollId)) return res.status(400).json({ error: '无效的用户ID或议题ID' });
  const vr = getRow('SELECT * FROM vote_records WHERE user_id = ? AND poll_id = ?', [userId, pollId]);
  if (!vr) return res.status(404).json({ error: '投票记录不存在' });
  try {
    run('UPDATE options SET votes = votes - 1 WHERE id = ?', [vr.option_id]);
    run('DELETE FROM vote_records WHERE user_id = ? AND poll_id = ?', [userId, pollId]);
    logAdminAction(req.admin.id, 'revoke_vote', 'vote', vr.id, `撤销用户投票: poll ${pollId}`, req.ip);
    res.json({ message: '投票记录已撤销' });
  } catch { res.status(500).json({ error: '撤销失败' }); }
});

module.exports = router;
