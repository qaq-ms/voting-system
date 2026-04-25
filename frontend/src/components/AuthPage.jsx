import { useState } from 'react';

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('用户名不能为空');
      return;
    }
    if (!password) {
      setError('密码不能为空');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (isLogin ? '登录失败' : '注册失败'));
        return;
      }

      if (isLogin) {
        onLogin({ userId: data.userId, username: data.username, status: data.status });
      } else {
        setError('');
        setIsLogin(true);
        setPassword('');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? '欢迎回来' : '创建账号'}</h2>
        <p className="auth-subtitle">
          {isLogin ? '登录以继续参与投票' : '注册后即可参与投票'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              className="auth-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <span>
              还没有账号？<button className="auth-link" onClick={() => { setIsLogin(false); setError(''); }}>立即注册</button>
            </span>
          ) : (
            <span>
              已有账号？<button className="auth-link" onClick={() => { setIsLogin(true); setError(''); }}>立即登录</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
