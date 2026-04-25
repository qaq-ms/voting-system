import { useState } from 'react';

function AdminLogin({ onSuccess, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) return setError('用户名和密码不能为空');

    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('voting_admin', JSON.stringify(data));
        onSuccess();
      } else setError(data.error || '登录失败');
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="card" style={{ width: '360px', maxWidth: '90%' }}>
        <h3 style={{ marginBottom: '20px' }}>管理员登录</h3>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>用户名</label><input value={username} onChange={e => setUsername(e.target.value)} autoFocus /></div>
          <div className="form-group"><label>密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn" onClick={onCancel} style={{ flex: 1, background: '#e0e0e0' }}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>{loading ? '验证中...' : '登录'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
