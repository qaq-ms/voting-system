const express = require('express');
const router = express.Router();
const { requireUserAuth } = require('../middleware/auth');
const pollService = require('../services/pollService');

router.post('/:id/vote', requireUserAuth, (req, res) => {
  const pollId = parseInt(req.params.id);
  const { optionId } = req.body;
  if (!optionId) return res.status(400).json({ error: '请指定投票选项' });

  try {
    const option = pollService.vote(pollId, optionId, req.user.id);
    res.json(option);
  } catch (err) {
    if (err.message.includes('不存在')) return res.status(404).json({ error: err.message });
    if (err.message.includes('已关闭') || err.message.includes('无效') || err.message.includes('投过票')) 
      return res.status(409).json({ error: err.message });
    res.status(500).json({ error: '投票失败' });
  }
});

router.get('/', (req, res) => {
  const polls = pollService.getAllPolls();
  res.json(polls.map(p => ({ ...p, optionCount: pollService.getOptionCount(p.id) })));
});

router.get('/:id', (req, res) => {
  const pollId = parseInt(req.params.id);
  const poll = pollService.getPollWithDetails(pollId);
  if (!poll) return res.status(404).json({ error: '投票不存在' });
  res.json(poll);
});

router.get('/:id/results', (req, res) => {
  const pollId = parseInt(req.params.id);
  const results = pollService.getPollResults(pollId);
  res.json(results);
});

module.exports = router;
