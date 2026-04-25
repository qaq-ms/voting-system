import { useState } from 'react';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    setLoading(true);
    try {
      let deviceId = localStorage.getItem('voting_device_id');

      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), deviceId })
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || '登录失败');
        return;
      }

      const data = await res.json();
      localStorage.setItem('voting_device_id', data.deviceId);
      onLogin({ userId: data.userId, username: data.username, deviceId: data.deviceId });
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#2196f3' }}>
          投票系统
        </h2>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>

          <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>
            提示：登录后将绑定当前设备，无法切换账号
          </p>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
