import { useState, useEffect, useCallback, memo } from 'react';

const GROUP_ICONS = ['📋', '💻', '🎮', '📚', '🎨', '🌍', '💡', '🔧'];

const GroupSelector = memo(function GroupSelector({ user, onSelect }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/groups/list');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setGroups(data);
      } else {
        setError('获取分组失败');
      }
    } catch (e) {
      console.error('Failed to fetch groups:', e);
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  if (loading) return <GroupSkeleton />;

  return (
    <div className="group-selector">
      <div className="group-header">
        <h2>选择讨论分组</h2>
        <p className="group-desc">请选择你感兴趣的分组进入投票</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="group-grid">
        {groups.map((group, idx) => (
          <div
            key={group.id}
            className="group-card"
            onClick={() => onSelect(group)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(group)}
          >
            <div className="group-icon" style={{ background: `hsl(${idx * 45}, 70%, 60%)` }}>
              {GROUP_ICONS[idx % GROUP_ICONS.length]}
            </div>
            <h3 className="group-name">{group.name}</h3>
            <p className="group-description">{group.description || '暂无描述'}</p>
            <div className="group-footer">
              <span className="group-poll-count">{group.pollCount || 0} 个议题</span>
              <span className="group-enter-btn">进入 →</span>
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <p className="empty-title">暂无分组</p>
          <p className="empty-desc">等待管理员创建分组</p>
        </div>
      )}
    </div>
  );
});

function GroupSkeleton() {
  return (
    <div className="group-selector">
      <div className="group-header">
        <div className="skeleton" style={{ width: '200px', height: '28px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '150px', height: '16px' }} />
      </div>
      <div className="group-grid">
        {[1, 2, 3].map(i => (
          <div key={i} className="group-card">
            <div className="skeleton" style={{ width: '60px', height: '60px', borderRadius: '50%', marginBottom: '16px' }} />
            <div className="skeleton" style={{ width: '80%', height: '20px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '16px' }} />
            <div className="skeleton" style={{ width: '60px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GroupSelector;
