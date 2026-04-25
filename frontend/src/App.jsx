import { useState, useEffect } from 'react'
import Login from './components/Login'
import PollDashboard from './components/PollDashboard'
import GroupSelector from './components/GroupSelector'
import AdminEntry from './components/AdminEntry'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer, { useToast } from './components/Toast'

const STORAGE_KEY = 'voting_user';

function UserMenu({ user, onLogout, onSwitch }) {
  const [open, setOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);

  const handleAction = (type) => {
    setAction(type);
    setShowPasswordModal(true);
    setPassword('');
    setError(null);
    setOpen(false);
  };

  const confirmAction = async () => {
    if (!password.trim()) {
      setError('密码不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password })
      });
      if (!res.ok) {
        setError('密码错误');
        return;
      }
      setShowPasswordModal(false);
      if (action === 'logout') onLogout();
      else if (action === 'switch') onSwitch();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="user-menu">
        <button className="user-menu-btn" onClick={() => setOpen(!open)}>
          <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
          <span className="user-name">{user.username}</span>
          <span className={`user-menu-arrow ${open ? 'open' : ''}`}>▼</span>
        </button>

        {open && (
          <div className="user-dropdown">
            <div className="dropdown-header">
              <div className="dropdown-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div className="dropdown-info">
                <div className="dropdown-name">{user.username}</div>
                <div className="dropdown-id">ID: {user.userId}</div>
              </div>
            </div>
            <div className="dropdown-divider" />
            <button className="dropdown-item" onClick={() => handleAction('switch')}>
              <span className="dropdown-icon">🔄</span>
              切换账号
            </button>
            <button className="dropdown-item danger" onClick={() => handleAction('logout')}>
              <span className="dropdown-icon">🚪</span>
              退出账号
            </button>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="password-modal" onClick={e => e.stopPropagation()}>
            <h3>{action === 'logout' ? '退出账号' : '切换账号'}</h3>
            <p className="modal-desc">请输入管理员密码以确认操作</p>
            {error && <div className="error">{error}</div>}
            <input
              type="password"
              className="password-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmAction()}
              placeholder="管理员密码"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowPasswordModal(false)}>取消</button>
              <button className="btn-confirm" onClick={confirmAction} disabled={loading}>
                {loading ? '验证中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppContent({ user, toastApi }) {
  const [selectedGroup, setSelectedGroup] = useState(null);

  const handleNewPoll = (pollData) => {
    if (!selectedGroup || pollData?.group_id === selectedGroup?.id) {
      toastApi.success(
        '新议题已发布',
        `「${pollData?.title || '新议题'}」已同步，快去参与投票吧！`
      );
    }
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
  };

  const handleBack = () => {
    setSelectedGroup(null);
  };

  return (
    <ErrorBoundary>
      <div className="container">
        <div className="header">
          <h1>投票系统</h1>
          <UserMenu
            user={user}
            onLogout={() => {
              localStorage.removeItem(STORAGE_KEY);
              window.location.reload();
              toastApi.info('已退出', '请重新登录');
            }}
            onSwitch={() => {
              localStorage.removeItem(STORAGE_KEY);
              window.location.reload();
            }}
          />
        </div>

        {!selectedGroup ? (
          <GroupSelector user={user} onSelect={handleGroupSelect} />
        ) : (
          <PollDashboard
            user={user}
            groupId={selectedGroup.id}
            onNewPoll={handleNewPoll}
            onBack={handleBack}
          />
        )}

        <AdminEntry />
      </div>
      <ToastContainer toasts={toastApi.toasts} onRemove={toastApi.removeToast} />
    </ErrorBoundary>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const toastApi = useToast();

  useEffect(() => {
    document.body.classList.remove('modal-open');
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        if (!userData.userId || userData.userId === 0) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setUser(userData);
        }
      } catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    toastApi.success('登录成功', `欢迎回来，${userData.username}！`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>;
  if (!user) return <Login onLogin={handleLogin} />;

  return <AppContent user={user} toastApi={toastApi} />;
}

export default App;
