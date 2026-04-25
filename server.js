const express = require('express');
const cors = require('cors');
const { initDatabase, getRow, getAll } = require('./database');
const eventHub = require('./eventHub');
const pollRoutes = require('./routes/polls');
const userRoutes = require('./routes/users');
const adminAuthRoutes = require('./routes/admin');
const adminPollRoutes = require('./routes/adminPolls');
const adminUserRoutes = require('./routes/adminUsers');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  const handler = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  eventHub.subscribe(handler);

  req.on('close', () => {
    eventHub.subscribers = eventHub.subscribers.filter(fn => fn !== handler);
    res.end();
  });
});

// Poll sync check endpoint
app.post('/api/polls/sync-check', (req, res) => {
  const { userId, lastSyncTimestamp } = req.body;
  if (!userId) return res.status(400).json({ error: '缺少用户ID' });
  
  const polls = getAll('SELECT * FROM polls ORDER BY created_at DESC');
  const newPolls = lastSyncTimestamp 
    ? polls.filter(p => new Date(p.created_at).getTime() > lastSyncTimestamp)
    : [];
  
  res.json({ 
    syncSuccess: true, 
    newPollCount: newPolls.length,
    newPolls,
    timestamp: Date.now()
  });
});

// 普通用户路由
app.use('/api/polls', pollRoutes);
app.use('/api/users', userRoutes);

// 管理员系统路由（独立权限控制）
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin/polls', adminPollRoutes);
app.use('/api/admin/users', adminUserRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: '接口不存在' }));
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => console.log(`投票系统已启动: http://localhost:${PORT}`));
  } catch (err) {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  }
}

start();
module.exports = app;
