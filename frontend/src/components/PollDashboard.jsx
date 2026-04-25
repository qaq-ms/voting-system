import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useEventSource } from '../hooks/useEventSource';

const CACHE_DURATION = 30000;
const SYNC_POLL_INTERVAL = 5000;
const cache = { data: {}, timestamp: 0, lastSync: Date.now() };

const COLORS = [
  { bg: 'linear-gradient(90deg, #2196f3, #64b5f6)', label: '#2196f3' },
  { bg: 'linear-gradient(90deg, #4caf50, #81c784)', label: '#4caf50' },
  { bg: 'linear-gradient(90deg, #ff9800, #ffb74d)', label: '#ff9800' },
  { bg: 'linear-gradient(90deg, #9c27b0, #ce93d8)', label: '#9c27b0' },
  { bg: 'linear-gradient(90deg, #f44336, #ef9a9a)', label: '#f44336' },
  { bg: 'linear-gradient(90deg, #00bcd4, #80deea)', label: '#00bcd4' },
];

function PollDashboard({ user, groupId, onNewPoll, onBack }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedPollId, setHighlightedPollId] = useState(null);
  const syncTimerRef = useRef(null);

  const cacheKey = groupId || 'all';

  const fetchPolls = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const url = `/api/users/${user.userId}/voting-status?groupId=${cacheKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          console.warn('[PollDashboard] 用户不存在，清除缓存');
          localStorage.removeItem('voting_user');
          window.location.reload();
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPolls(data);
        cache.data[cacheKey] = data;
        cache.timestamp = Date.now();
        cache.lastSync = Date.now();
      } else {
        console.error('[PollDashboard] Invalid response format');
      }
    } catch (e) {
      if (e.message.includes('fetch') || e.message.includes('Failed')) {
        console.warn('[PollDashboard] 服务器连接失败，等待服务器启动');
      } else {
        console.error('[PollDashboard] Failed to fetch polls:', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.userId, cacheKey]);

  const handleSSEEvent = useCallback((eventType, data) => {
    if (eventType === 'poll:created') {
      cache.timestamp = 0;
      const pollGroupId = data?.data?.group_id;
      if (!cacheKey || cacheKey === 'all' || pollGroupId?.toString() === cacheKey.toString()) {
        fetchPolls(false);
      }
      onNewPoll?.(data?.data);
      if (data?.data?.id) {
        setHighlightedPollId(data.data.id);
        setTimeout(() => setHighlightedPollId(null), 3000);
      }
    } else if (eventType === 'poll:status_changed') {
      cache.timestamp = 0;
      fetchPolls(false);
    } else if (eventType === 'user:deleted') {
      const deletedUserId = data?.data?.userId;
      if (deletedUserId && deletedUserId === user.userId) {
        console.log('[PollDashboard] 当前用户已被管理员删除，强制登出');
        localStorage.removeItem('voting_user');
        window.location.reload();
      }
    } else if (eventType === 'sse:max_retries') {
      console.warn('[PollDashboard] SSE failed, falling back to polling');
    }
  }, [fetchPolls, onNewPoll, cacheKey, user.userId]);

  useEventSource('/api/events', handleSSEEvent, { autoConnect: true });

  const checkSync = useCallback(async () => {
    try {
      const res = await fetch('/api/polls/sync-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          lastSyncTimestamp: cache.lastSync,
          groupId: cacheKey
        })
      });
      const data = await res.json();
      if (data.syncSuccess && data.newPollCount > 0) {
        cache.timestamp = 0;
        fetchPolls(false);
      }
    } catch (e) {
      console.error('[PollDashboard] Sync check failed:', e);
    }
  }, [user.userId, cacheKey, fetchPolls]);

  useEffect(() => {
    if (cache.data[cacheKey] && Date.now() - cache.timestamp < CACHE_DURATION) {
      setPolls(cache.data[cacheKey]);
      setLoading(false);
    } else {
      fetchPolls();
    }

    syncTimerRef.current = setInterval(checkSync, SYNC_POLL_INTERVAL);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [fetchPolls, checkSync]);

  const filtered = useMemo(() => {
    if (!Array.isArray(polls)) return [];
    if (filter === 'all') return polls;
    return polls.filter(item => filter === 'voted' ? item.hasVoted : !item.hasVoted);
  }, [polls, filter]);

  const counts = useMemo(() => ({
    total: polls.length,
    voted: polls.filter(p => p.hasVoted).length,
    unvoted: polls.length - polls.filter(p => p.hasVoted).length,
  }), [polls]);

  if (loading) return <SkeletonDashboard />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn" onClick={onBack} style={{ padding: '6px 12px', fontSize: '13px' }}>← 返回</button>
          <div className="sync-status">
            <span className="sync-dot" />
            <span>实时同步已启用</span>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <span className="filter-label">筛选:</span>
        {[
          { key: 'all', label: '全部', count: counts.total },
          { key: 'unvoted', label: '未投票', count: counts.unvoted },
          { key: 'voted', label: '已投票', count: counts.voted },
        ].map(f => (
          <button
            key={f.key}
            className={`tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.count})
          </button>
        ))}
        <button
          className={`btn ${refreshing ? 'btn-refresh-spin' : ''}`}
          onClick={() => { cache.timestamp = 0; fetchPolls(true); }}
          disabled={refreshing}
          title="刷新"
        >
          {refreshing ? '↻' : '↻'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="poll-list">
          {filtered.map(item => (
            <PollCard
              key={item.poll.id}
              pollData={item}
              user={user}
              onVoted={fetchPolls}
              isHighlighted={highlightedPollId === item.poll.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const PollCard = memo(function PollCard({ pollData, user, onVoted, isHighlighted }) {
  const { poll, hasVoted: initVoted, votedOption: initVotedOpt } = pollData;
  const [hasVoted, setHasVoted] = useState(initVoted);
  const [myVote, setMyVote] = useState(initVotedOpt);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [animProgress, setAnimProgress] = useState({});

  useEffect(() => {
    setHasVoted(initVoted);
    setMyVote(initVotedOpt);
    setSelected(null);
    setError(null);
    setAnimProgress({});
    if (initVoted) fetchResults();
    else setResults([]);
  }, [poll.id, initVoted, initVotedOpt]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/polls/${poll.id}/results`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        data.results.forEach(r => {
          setTimeout(() => setAnimProgress(p => ({ ...p, [r.id]: r.percentage || 0 })), 50);
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleVote = async () => {
    setError(null);
    if (!selected) return setError('请选择一个选项');

    setHasVoted(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: selected, userId: user.userId })
      });

      if (res.status === 409) { await fetchResults(); onVoted(); return; }
      if (!res.ok) {
        const d = await res.json();
        setHasVoted(false);
        throw new Error(d.error || '投票失败');
      }

      const votedOpt = poll.options?.find(o => o.id === selected) || { text: '未知选项' };
      setMyVote(votedOpt);
      await fetchResults();
      onVoted();
    } catch (e) {
      setError(e.message);
      setHasVoted(false);
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = results.reduce((s, r) => s + (r.votes || 0), 0);

  return (
    <div className={`card poll-card ${isHighlighted ? 'new-poll-highlight' : ''}`}>
      <div className="poll-header">
        <h3 className="poll-title">
          {isHighlighted && <span className="new-badge">NEW</span>}
          {poll.title}
        </h3>
        <StatusBadge hasVoted={hasVoted} />
      </div>

      {poll.description && <p className="poll-desc">{poll.description}</p>}

      {error && <div className="error">{error}</div>}

      {!poll.options || poll.options.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>数据加载中...</div>
      ) : hasVoted ? (
        <ResultView
          results={results}
          myVote={myVote}
          totalVotes={totalVotes}
          animProgress={animProgress}
        />
      ) : (
        <VoteView
          options={poll.options}
          pollId={poll.id}
          selected={selected}
          onSelect={setSelected}
          onVote={handleVote}
          loading={loading}
        />
      )}
    </div>
  );
});

function StatusBadge({ hasVoted }) {
  return (
    <span className={`status-badge ${hasVoted ? 'voted' : 'pending'}`}>
      {hasVoted ? '✓ 已投票' : '○ 投票中'}
    </span>
  );
}

function ResultView({ results, myVote, totalVotes, animProgress }) {
  const sorted = useMemo(() => [...results].sort((a, b) => b.votes - a.votes), [results]);

  return (
    <div className="result-view">
      {myVote && (
        <p className="my-vote">
          <span className="my-vote-icon">✓</span>
          您的选择: <strong>{myVote.text}</strong>
        </p>
      )}

      <div className="results-list">
        {sorted.map((r, idx) => (
          <div key={r.id} className="result-item">
            <div className="result-info">
              <span className="result-rank" style={{ color: COLORS[idx % COLORS.length].label }}>#{idx + 1}</span>
              <span className="result-name">{r.text}</span>
              <span className="result-stats">
                {r.votes}票 · {r.percentage || 0}%
              </span>
            </div>
            <div className="result-bar-container">
              <div className="result-bar-fill" style={{
                background: COLORS[idx % COLORS.length].bg,
                width: `${animProgress[r.id] || 0}%`
              }} />
            </div>
          </div>
        ))}
      </div>

      <div className="result-footer">
        <span>总票数</span>
        <strong>{totalVotes}</strong>
      </div>
    </div>
  );
}

function VoteView({ options, pollId, selected, onSelect, onVote, loading }) {
  return (
    <div className="vote-view">
      <div className="options-list">
        {options?.map((opt, idx) => (
          <label
            key={opt.id}
            className={`option-item ${selected === opt.id ? 'selected' : ''}`}
            onClick={() => onSelect(opt.id)}
          >
            <span className="option-radio">
              <span className={`radio-inner ${selected === opt.id ? 'active' : ''}`} />
            </span>
            <span className="option-index">{idx + 1}</span>
            <span className="option-text">{opt.text}</span>
          </label>
        ))}
      </div>

      <button
        className="btn-vote"
        onClick={onVote}
        disabled={!selected || loading}
      >
        {loading ? <span className="vote-loading">投票中...</span> : '提交投票'}
      </button>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div>
      <div className="filter-bar" style={{ opacity: 0.5 }}>
        <div className="skeleton skeleton-sm" />
        <div className="skeleton skeleton-sm" />
        <div className="skeleton skeleton-sm" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ marginBottom: '15px' }}>
          <div className="skeleton" style={{ width: '60%', height: '20px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '100%', height: '40px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '80%', height: '40px' }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filter }) {
  const messages = {
    all: { title: '暂无议题', desc: '等待管理员创建议题' },
    unvoted: { title: '没有未投票的议题', desc: '您已参与所有议题投票' },
    voted: { title: '没有已投票的议题', desc: '还没有参与投票' },
  };
  const msg = messages[filter];

  return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <p className="empty-title">{msg.title}</p>
      <p className="empty-desc">{msg.desc}</p>
    </div>
  );
}

export default PollDashboard;
