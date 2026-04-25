const { getRow, getAll, run, logAdminAction } = require('../database');

function login(username, deviceId) {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) throw new Error('用户名不能为空');

  const existingUser = deviceId 
    ? getRow('SELECT * FROM users WHERE device_id = ?', [deviceId]) 
    : null;

  if (existingUser) {
    run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [existingUser.id]);
    return {
      userId: existingUser.id,
      username: existingUser.username,
      deviceId: existingUser.device_id,
      status: existingUser.status
    };
  }

  const newDeviceId = deviceId || generateDeviceId();
  const { lastInsertRowid } = run(
    'INSERT INTO users (device_id, username, last_login) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [newDeviceId, trimmedUsername]
  );

  return { 
    userId: lastInsertRowid, 
    username: trimmedUsername, 
    deviceId: newDeviceId, 
    status: 'active' 
  };
}

function getUserStatus(userId) {
  const user = getRow(
    'SELECT id, username, status, created_at, last_login FROM users WHERE id = ?',
    [userId]
  );
  if (!user) throw new Error('用户不存在');
  return user;
}

function getUserVotingStatus(userId, groupId) {
  const user = getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) throw new Error('用户不存在');

  let pollQuery = 'SELECT * FROM polls WHERE status = ?';
  let pollParams = ['active'];
  
  if (groupId && groupId !== 'all') {
    pollQuery += ' AND group_id = ?';
    pollParams.push(parseInt(groupId));
  }
  pollQuery += ' ORDER BY created_at DESC';

  const polls = getAll(pollQuery, pollParams);
  return polls.map(poll => {
    const voteRecord = getRow(
      `SELECT vr.*, o.text as option_text 
       FROM vote_records vr 
       JOIN options o ON vr.option_id = o.id 
       WHERE vr.user_id = ? AND vr.poll_id = ?`,
      [userId, poll.id]
    );
    const options = getAll('SELECT * FROM options WHERE poll_id = ?', [poll.id]);
    return {
      poll: { ...poll, options },
      hasVoted: !!voteRecord,
      votedOption: voteRecord 
        ? { id: voteRecord.option_id, text: voteRecord.option_text } 
        : null
    };
  });
}

function generateDeviceId() {
  return 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

function getActiveUserCount() {
  return getRow("SELECT COUNT(*) as c FROM users WHERE status = 'active'")?.c || 0;
}

module.exports = {
  login,
  getUserStatus,
  getUserVotingStatus,
  getActiveUserCount
};
