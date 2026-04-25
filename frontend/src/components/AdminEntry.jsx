import { useState } from 'react';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';

function AdminEntry() {
  const [showLogin, setShowLogin] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const savedAdmin = localStorage.getItem('voting_admin');

  if (showPanel) return <AdminPanel onClose={() => setShowPanel(false)} />;
  if (showLogin) return <AdminLogin onSuccess={() => { setShowLogin(false); setShowPanel(true); }} onCancel={() => setShowLogin(false)} />;

  return (
    <button
      onClick={() => savedAdmin ? setShowPanel(true) : setShowLogin(true)}
      style={{
        position: 'fixed', bottom: '20px', right: '20px', padding: '10px 16px',
        background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px', zIndex: 999,
        transition: 'background 0.2s'
      }}
      onMouseEnter={e => e.target.style.background = 'rgba(0,0,0,0.8)'}
      onMouseLeave={e => e.target.style.background = 'rgba(0,0,0,0.6)'}
    >
      {savedAdmin ? '管理面板' : '管理员系统'}
    </button>
  );
}

export default AdminEntry;
