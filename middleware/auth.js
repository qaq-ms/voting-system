const { getRow } = require('../database');

function requireUserAuth(req, res, next) {
  const { userId } = req.body || {};
  if (!userId) return res.status(401).json({ error: '请先登录' });
  
  const user = getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.status !== 'active') return res.status(403).json({ error: '账户已被禁用' });
  
  req.user = user;
  next();
}

module.exports = { requireUserAuth };
