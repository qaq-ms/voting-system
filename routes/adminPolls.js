const express = require('express');
const router = express.Router();
const { getRow, getAll, run, exec, transaction, logAdminAction } = require('../database');
const eventHub = require('../eventHub');

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

router.post('/create', auth('create_poll'), (req, res) => {
  const { title, options } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '标题不能为空' });
  if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: '至少需要两个选项' });

  try {
    const { lastInsertRowid: pollId } = run(
      'INSERT INTO polls (title, created_by) VALUES (?, ?)',
      [title.trim(), req.admin.id]
    );
    const optionsData = [];
    for (const opt of options) {
      if (opt.trim()) {
        exec('INSERT INTO options (poll_id, text) VALUES (?, ?)', [pollId, opt.trim()]);
        optionsData.push({ text: opt.trim() });
      }
    }
    logAdminAction(req.admin.id, 'create_poll', 'poll', pollId, `创建议题: ${title}`, req.ip);

    const newPoll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
    const fullOptions = getAll('SELECT * FROM options WHERE poll_id = ?', [pollId]);
    eventHub.notifyNewPoll({ ...newPoll, options: fullOptions });

    res.status(201).json({ 
      id: pollId, 
      message: '议题创建成功',
      userCount: getAll('SELECT COUNT(*) as c FROM users WHERE status = ?', ['active'])[0]?.c || 0
    });
  } catch (err) {
    console.error('创建议题错误:', err);
    res.status(500).json({ error: '创建议题失败' });
  }
});

router.put('/:id/status', auth('create_poll'), (req, res) => {
  const { status } = req.body;
  if (!['active', 'closed'].includes(status)) return res.status(400).json({ error: '无效状态' });
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) return res.status(400).json({ error: '无效的议题ID' });
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) return res.status(404).json({ error: '议题不存在' });
  run('UPDATE polls SET status = ? WHERE id = ?', [status, pollId]);
  logAdminAction(req.admin.id, 'update_poll_status', 'poll', pollId, `议题状态改为: ${status}`, req.ip);
  eventHub.notifyPollStatusChanged(pollId, status);
  res.json({ message: '状态已更新' });
});

router.delete('/:id', auth('create_poll'), (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) return res.status(400).json({ error: '无效的议题ID' });
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) return res.status(404).json({ error: '议题不存在' });
  try {
    transaction(() => {
      exec('DELETE FROM vote_records WHERE poll_id = ?', [pollId]);
      exec('DELETE FROM options WHERE poll_id = ?', [pollId]);
      exec('DELETE FROM polls WHERE id = ?', [pollId]);
    });
    logAdminAction(req.admin.id, 'delete_poll', 'poll', pollId, `删除议题: ${poll.title}`, req.ip);
    res.json({ message: '议题已删除' });
  } catch { res.status(500).json({ error: '删除失败' }); }
});

router.get('/list', auth('create_poll'), (req, res) => {
  const polls = getAll('SELECT * FROM polls ORDER BY created_at DESC');
  res.json(polls.map(p => {
    const options = getAll('SELECT * FROM options WHERE poll_id = ?', [p.id]);
    const total = options.reduce((s, o) => s + o.votes, 0);
    const voters = getAll(`SELECT u.username, o.text as voted_option, vr.voted_at FROM vote_records vr JOIN users u ON vr.user_id = u.id JOIN options o ON vr.option_id = o.id WHERE vr.poll_id = ?`, [p.id]);
    return { ...p, options, totalVotes: total, voters, voterCount: voters.length };
  }));
});

module.exports = router;
