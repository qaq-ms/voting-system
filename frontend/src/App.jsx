import { useState, useEffect } from 'react'
import Login from './components/Login'
import PollDashboard from './components/PollDashboard'
import AdminEntry from './components/AdminEntry'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer, { useToast } from './components/Toast'

const STORAGE_KEY = 'voting_user';

function AppContent({ user, toastApi }) {
  const handleNewPoll = (pollData) => {
    toastApi.success(
      '新议题已发布',
      `「${pollData?.title || '新议题'}」已同步，快去参与投票吧！`
    );
  };

  return (
    <ErrorBoundary>
      <div className="container">
        <div className="header">
          <h1>投票系统</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
            当前用户: <strong>{user.username}</strong>
          </p>
        </div>
        <PollDashboard user={user} onNewPoll={handleNewPoll} />
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
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem(STORAGE_KEY); }
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
