const { getRow, getAll, run, exec, transaction, runInTx, logAdminAction } = require('../database');

function createPoll(title, description, groupId, options, adminId, ip) {
  const groupIdVal = groupId ? parseInt(groupId) : null;
  const { lastInsertRowid: pollId } = run(
    'INSERT INTO polls (title, description, group_id, created_by) VALUES (?, ?, ?, ?)',
    [title.trim(), description?.trim() || '', groupIdVal, adminId]
  );

  for (const opt of options) {
    if (opt.trim()) {
      exec('INSERT INTO options (poll_id, text) VALUES (?, ?)', [pollId, opt.trim()]);
    }
  }

  logAdminAction(adminId, 'create_poll', 'poll', pollId, `创建议题: ${title}`, ip);
  return pollId;
}

function getPollWithDetails(pollId) {
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) return null;
  const options = getAll('SELECT * FROM options WHERE poll_id = ?', [pollId]);
  return { ...poll, options };
}

function getAllPolls() {
  return getAll('SELECT id, title, status, created_at FROM polls ORDER BY created_at DESC');
}

function getAllPollsWithDetails() {
  const polls = getAll('SELECT p.*, g.name as group_name FROM polls p LEFT JOIN groups g ON p.group_id = g.id ORDER BY p.created_at DESC');
  return polls.map(p => {
    const options = getAll('SELECT * FROM options WHERE poll_id = ?', [p.id]);
    const total = options.reduce((s, o) => s + o.votes, 0);
    const voters = getAll(
      `SELECT u.username, o.text as voted_option, vr.voted_at 
       FROM vote_records vr 
       JOIN users u ON vr.user_id = u.id 
       JOIN options o ON vr.option_id = o.id 
       WHERE vr.poll_id = ?`,
      [p.id]
    );
    return { ...p, options, totalVotes: total, voters, voterCount: voters.length };
  });
}

function updatePollStatus(pollId, status, adminId, ip) {
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) throw new Error('议题不存在');
  run('UPDATE polls SET status = ? WHERE id = ?', [status, pollId]);
  logAdminAction(adminId, 'update_poll_status', 'poll', pollId, `议题状态改为: ${status}`, ip);
}

function deletePoll(pollId, adminId, ip) {
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) throw new Error('议题不存在');
  transaction(() => {
    exec('DELETE FROM vote_records WHERE poll_id = ?', [pollId]);
    exec('DELETE FROM options WHERE poll_id = ?', [pollId]);
    exec('DELETE FROM polls WHERE id = ?', [pollId]);
  });
  logAdminAction(adminId, 'delete_poll', 'poll', pollId, `删除议题: ${poll.title}`, ip);
}

function vote(pollId, optionId, userId) {
  const poll = getRow('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) throw new Error('投票不存在');
  if (poll.status !== 'active') throw new Error('该投票已关闭');

  const option = getRow('SELECT * FROM options WHERE id = ?', [optionId]);
  if (!option || option.poll_id !== pollId) throw new Error('无效的选项');

  const existing = getRow('SELECT * FROM vote_records WHERE user_id = ? AND poll_id = ?', [userId, pollId]);
  if (existing) throw new Error('您已经对该议题投过票了');

  transaction(() => {
    runInTx('INSERT INTO vote_records (user_id, poll_id, option_id) VALUES (?, ?, ?)', [userId, pollId, optionId]);
    runInTx('UPDATE options SET votes = votes + 1 WHERE id = ?', [optionId]);
  });

  return getRow('SELECT * FROM options WHERE id = ?', [optionId]);
}

function getPollResults(pollId) {
  const options = getAll('SELECT * FROM options WHERE poll_id = ?', [pollId]);
  const total = options.reduce((sum, o) => sum + (o.votes || 0), 0);
  return {
    results: options.map(o => ({
      ...o,
      percentage: total > 0 ? Math.round((o.votes / total) * 100) : 0
    }))
  };
}

function getOptionCount(pollId) {
  return getAll('SELECT COUNT(*) as c FROM options WHERE poll_id = ?', [pollId])[0]?.c || 0;
}

module.exports = {
  createPoll,
  getPollWithDetails,
  getAllPolls,
  getAllPollsWithDetails,
  updatePollStatus,
  deletePoll,
  vote,
  getPollResults,
  getOptionCount
};
