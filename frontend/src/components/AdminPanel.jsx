import { useState, useEffect } from 'react';

function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('polls');
  const [data, setData] = useState({ polls: [], users: [], admins: [], logs: [], groups: [] });
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  useEffect(() => {
    document.body.classList.add('modal-open');
    loadAdmin();
    return () => document.body.classList.remove('modal-open');
  }, []);

  const loadAdmin = async () => {
    const a = JSON.parse(localStorage.getItem('voting_admin') || 'null');
    if (a) {
      setAdmin(a);
      fetchData(a.adminId);
    }
  };

  const fetchData = async (adminId) => {
    try {
      const [p, u, a, l, g] = await Promise.all([
        fetch(`/api/admin/polls/list?adminId=${adminId}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/admin/users/list?adminId=${adminId}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/admin/list?adminId=${adminId}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/admin/logs?adminId=${adminId}`).then(r => r.ok ? r.json() : []),
        fetch('/api/groups/list').then(r => r.ok ? r.json() : [])
      ]);
      setData({ polls: p, users: u, admins: a, logs: l, groups: g });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(null), 2000); };

  const handleAction = async (url, method = 'DELETE', body) => {
    try {
      const urlWithAdminId = `${url}${url.includes('?') ? '&' : '?'}adminId=${admin.adminId}`;
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body && method !== 'DELETE') opts.body = JSON.stringify({ ...body, adminId: admin.adminId });
      else if (body && method === 'DELETE') opts.body = JSON.stringify({ adminId: admin.adminId });
      const res = await fetch(urlWithAdminId, opts);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(d.message || '操作成功');
      fetchData(admin.adminId);
      return d;
    } catch (e) { 
      console.error('操作失败:', e);
      showMsg(e.message || '操作失败'); 
    }
  };

  if (loading) return <div className="modal-overlay"><div style={{ padding: '40px', color: '#fff' }}>加载中...</div></div>;
  if (!admin) return <div className="modal-overlay"><div className="modal-content"><p style={{ padding: '40px', textAlign: 'center' }}>请先登录管理员</p></div></div>;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h2 style={{ margin: 0 }}>管理员系统</h2><p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>{admin.username} ({admin.role})</p></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>

        {msg && <div className="success" style={{ margin: '12px 24px 0', padding: '8px 16px' }}>{msg}</div>}

        <div style={{ padding: '12px 24px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>大议题 ({data.groups.length})</button>
          <button className={`tab ${tab === 'polls' ? 'active' : ''}`} onClick={() => setTab('polls')}>小议题 ({data.polls.length})</button>
          <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>用户 ({data.users.length})</button>
          {admin.permissions?.manage_admins && <button className={`tab ${tab === 'admins' ? 'active' : ''}`} onClick={() => setTab('admins')}>管理员 ({data.admins.length})</button>}
          {admin.permissions?.view_logs && <button className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>日志 ({data.logs.length})</button>}
        </div>

        <div className="modal-scroll">
          {tab === 'groups' && <GroupTab data={data} admin={admin} onAction={handleAction} onCreate={() => { setEditingGroup(null); setShowGroupModal(true); }} onEdit={(g) => { setEditingGroup(g); setShowGroupModal(true); }} />}
          {tab === 'polls' && <PollTab data={data} admin={admin} onAction={handleAction} onCreate={() => setShowCreatePoll(true)} />}
          {tab === 'users' && <UserTab data={data} admin={admin} onAction={handleAction} />}
          {tab === 'admins' && <AdminTab data={data} admin={admin} onAction={handleAction} onCreate={() => setShowCreateAdmin(true)} />}
          {tab === 'logs' && <LogTab data={data} />}
        </div>

        {showCreatePoll && <CreatePollModal admin={admin} groups={data.groups} onClose={() => { setShowCreatePoll(false); fetchData(admin.adminId); }} onMsg={showMsg} />}
        {showCreateAdmin && <CreateAdminModal admin={admin} onClose={() => { setShowCreateAdmin(false); fetchData(admin.adminId); }} onMsg={showMsg} />}
        {showGroupModal && <GroupModal admin={admin} group={editingGroup} onClose={() => { setShowGroupModal(false); setEditingGroup(null); fetchData(admin.adminId); }} onMsg={showMsg} />}
      </div>
    </div>
  );
}

function GroupTab({ data, admin, onAction, onCreate, onEdit }) {
  const handleDelete = async (group) => {
    const pollCount = group.pollCount || 0;
    let msg = `确定要删除大议题「${group.name}」吗？`;
    if (pollCount > 0) {
      msg += `\n\n⚠️ 该分组下有 ${pollCount} 个小议题`;
      msg += `\n删除后，这些小议题将变为无分组状态（独立议题）`;
      msg += `\n\n此操作不可恢复，请确认是否继续？`;
    } else {
      msg += `\n\n此操作不可恢复，请确认是否继续？`;
    }
    if (window.confirm(msg)) {
      await onAction(`/api/groups/${group.id}`);
    }
  };

  return (
    <>
      <div style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
          💡 大议题用于对小议题进行分类管理，创建小议题时可选择所属大议题
        </p>
        <button className="btn btn-primary" onClick={onCreate}>+ 创建大议题</button>
      </div>
      {data.groups.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>暂无大议题</p> :
        data.groups.map(g => (
          <div key={g.id} className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>
                  <span style={{ fontSize: '16px', marginRight: '8px' }}>📁</span>
                  {g.name}
                  <span style={{ fontSize: '12px', marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', background: '#e8f5e9', color: '#388e3c' }}>
                    {g.pollCount || 0} 个小议题
                  </span>
                </h4>
                <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>{g.description || '暂无描述'}</p>
                <p style={{ fontSize: '11px', color: '#999', margin: '2px 0 0' }}>创建: {new Date(g.created_at).toLocaleString('zh-CN')}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn" style={{ background: '#2196f3', color: '#fff', fontSize: '12px' }} onClick={() => onEdit(g)}>编辑</button>
                <button className="btn btn-danger" style={{ fontSize: '12px' }} onClick={() => handleDelete(g)}>删除</button>
              </div>
            </div>
          </div>
        ))
      }
    </>
  );
}

function GroupModal({ admin, group, onClose, onMsg }) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr('名称不能为空');
    if (name.trim().length > 50) return setErr('名称不能超过50个字符');
    setLoading(true);
    try {
      let res;
      if (isEdit) {
        res = await fetch(`/api/groups/${group.id}?adminId=${admin.adminId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description.trim(), adminId: admin.adminId })
        });
      } else {
        res = await fetch('/api/groups/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), description: description.trim(), adminId: admin.adminId })
        });
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onMsg(isEdit ? '大议题已更新' : '大议题创建成功');
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90%' }}>
        <h3>{isEdit ? '编辑大议题' : '创建大议题'}</h3>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="大议题名称" maxLength={50} />
          </div>
          <div className="form-group">
            <label>描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述" rows={3} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1, background: '#e0e0e0' }}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>{loading ? '提交中...' : isEdit ? '更新' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PollTab({ data, admin, onAction, onCreate }) {
  return (
    <>
      <div style={{ marginBottom: '15px' }}><button className="btn btn-primary" onClick={onCreate}>+ 创建议题</button></div>
      {data.polls.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>暂无议题</p> :
        data.polls.map(p => (
          <div key={p.id} className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ margin: 0 }}>
                  {p.group_name && <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: '#e8f5e9', color: '#388e3c', marginRight: '8px' }}>📁 {p.group_name}</span>}
                  {p.title} 
                  <span style={{ fontSize: '12px', color: p.status === 'active' ? '#4caf50' : '#f44336' }}>({p.status === 'active' ? '进行中' : '已关闭'})</span>
                </h4>
                <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>{new Date(p.created_at).toLocaleString('zh-CN')} · {p.totalVotes}票 · {p.voterCount}人</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {p.status === 'active' && <button className="btn" style={{ background: '#ff9800', color: '#fff', fontSize: '12px' }} onClick={() => onAction(`/api/admin/polls/${p.id}/status`, 'PUT', { status: 'closed' })}>关闭</button>}
                <button className="btn" style={{ background: '#e0e0e0', fontSize: '12px' }} onClick={() => onAction(`/api/admin/polls/${p.id}/status`, 'PUT', { status: p.status === 'active' ? 'closed' : 'active' })}>{p.status === 'active' ? '关闭' : '开启'}</button>
                <button className="btn btn-danger" style={{ fontSize: '12px' }} onClick={() => onAction(`/api/admin/polls/${p.id}`)}>删除</button>
              </div>
            </div>
            <button className="btn" style={{ background: '#e0e0e0', fontSize: '12px', marginTop: '8px' }} onClick={() => { const el = document.getElementById(`poll-${p.id}`); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }}>投票详情</button>
            <div id={`poll-${p.id}`} style={{ display: 'none', marginTop: '10px' }}>
              {p.voters.length > 0 ? <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ borderBottom: '1px solid #eee' }}><th style={{ textAlign: 'left', padding: '6px 4px' }}>用户</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>选项</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>时间</th></tr></thead>
                <tbody>{p.voters.map((v, i) => <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}><td style={{ padding: '6px 4px' }}>{v.username}</td><td style={{ padding: '6px 4px' }}>{v.voted_option}</td><td style={{ padding: '6px 4px', color: '#999' }}>{new Date(v.voted_at).toLocaleString('zh-CN')}</td></tr>)}</tbody>
              </table> : <p style={{ color: '#999', fontSize: '13px' }}>暂无记录</p>}
            </div>
          </div>
        ))
      }
    </>
  );
}

function UserTab({ data, onAction }) {
  return data.users.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>暂无用户</p> :
    data.users.map(u => (
      <div key={u.id} className="card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ margin: 0 }}>
              <span style={{ fontSize: '12px', color: '#667eea', marginRight: '8px' }}>ID: {u.id}</span>
              {u.username}
              <span style={{ fontSize: '12px', color: u.status === 'active' ? '#4caf50' : '#f44336', marginLeft: '8px' }}>
                ({u.status === 'active' ? '正常' : '已禁用'})
              </span>
            </h4>
            <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>设备: {u.device_id} · 注册: {new Date(u.created_at).toLocaleString('zh-CN')} · 投票: {u.voteCount}次</p>
            {u.votes && u.votes.length > 0 && (
              <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#666', margin: '0 0 6px', fontWeight: 'bold' }}>📊 已投票项:</p>
                {u.votes.map((v, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < u.votes.length - 1 ? '1px dashed #e0e0e0' : 'none' }}>
                    <div>
                      <strong style={{ fontSize: '11px', color: '#333' }}>{v.poll_title}</strong>
                      <span style={{ fontSize: '11px', color: '#999', margin: '0 6px' }}>→</span>
                      <span style={{ color: '#2196f3', fontWeight: 'bold', fontSize: '11px' }}>{v.voted_option}</span>
                      <span style={{ color: '#999', marginLeft: '8px', fontSize: '10px' }}>{new Date(v.voted_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <button className="btn" style={{ fontSize: '10px', padding: '2px 8px', background: '#ff5722', color: '#fff' }} onClick={() => onAction(`/api/admin/users/${u.id}/votes/${v.poll_id}`)}>撤销</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn" style={{ background: u.status === 'active' ? '#ff9800' : '#4caf50', color: '#fff', fontSize: '12px' }} onClick={() => onAction(`/api/admin/users/${u.id}/status`, 'PUT', { status: u.status === 'active' ? 'banned' : 'active' })}>{u.status === 'active' ? '禁用' : '启用'}</button>
            <button className="btn btn-danger" style={{ fontSize: '12px' }} onClick={() => onAction(`/api/admin/users/${u.id}`)}>删除</button>
          </div>
        </div>
      </div>
    ));
}

function AdminTab({ data, admin, onAction, onCreate }) {
  return (
    <>
      <div style={{ marginBottom: '15px' }}><button className="btn btn-primary" onClick={onCreate}>+ 创建管理员</button></div>
      {data.admins.map(a => {
        const isSelf = admin.adminId === a.id;
        return (
          <div key={a.id} className={`card ${isSelf ? 'current-admin-card' : ''}`} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ margin: 0 }}>
                  {a.username}{' '}
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: a.role === 'super_admin' ? '#e3f2fd' : '#f5f5f5', color: a.role === 'super_admin' ? '#1976d2' : '#666' }}>
                    {a.role}
                  </span>
                  {isSelf && <span style={{ fontSize: '11px', color: '#667eea', marginLeft: '8px' }}>(当前账户)</span>}
                </h4>
                <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>状态: {a.status === 'active' ? '正常' : '已禁用'} · 创建: {new Date(a.created_at).toLocaleString('zh-CN')}</p>
              </div>
              {!isSelf && <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn" style={{ background: a.status === 'active' ? '#ff9800' : '#4caf50', color: '#fff', fontSize: '12px' }} onClick={() => onAction(`/api/admin/${a.id}`, 'PUT', { status: a.status === 'active' ? 'disabled' : 'active' })}>{a.status === 'active' ? '禁用' : '启用'}</button>
                <button className="btn btn-danger" style={{ fontSize: '12px' }} onClick={() => onAction(`/api/admin/${a.id}`)}>删除</button>
              </div>}
              {isSelf && <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#999', padding: '6px 12px' }} title="无法对自己的账户执行此操作">🔒 保护中</span>
              </div>}
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>权限: {Object.entries(a.permissions).map(([k, v]) => `${k}: ${v ? '✓' : '✗'}`).join(' · ')}</p>
          </div>
        );
      })}
    </>
  );
}

function LogTab({ data }) {
  return data.logs.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>暂无日志</p> :
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead><tr style={{ borderBottom: '2px solid #eee' }}><th style={{ textAlign: 'left', padding: '8px 4px' }}>操作人</th><th style={{ textAlign: 'left', padding: '8px 4px' }}>操作</th><th style={{ textAlign: 'left', padding: '8px 4px' }}>详情</th><th style={{ textAlign: 'left', padding: '8px 4px' }}>时间</th></tr></thead>
      <tbody>{data.logs.map(l => <tr key={l.id} style={{ borderBottom: '1px solid #f5f5f5' }}><td style={{ padding: '8px 4px' }}>{l.admin_name}</td><td style={{ padding: '8px 4px' }}>{l.action}</td><td style={{ padding: '8px 4px' }}>{l.details}</td><td style={{ padding: '8px 4px', color: '#999', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('zh-CN')}</td></tr>)}</tbody>
    </table>;
}

function CreatePollModal({ admin, groups, onClose, onMsg }) {
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr('请输入标题');
    const valid = opts.filter(o => o.trim());
    if (valid.length < 2) return setErr('至少两个选项');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/polls/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: title.trim(), 
          options: valid, 
          adminId: admin.adminId,
          groupId: groupId || null
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const syncMsg = d.userCount 
        ? `${d.message} - 已同步至 ${d.userCount} 位活跃用户`
        : d.message;
      onMsg(syncMsg);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90%' }}>
      <h3>创建议题</h3>
      {err && <div className="error">{err}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label>所属大议题</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
            <option value="">无（独立议题）</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label>标题</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="议题标题" /></div>
        {opts.map((o, i) => <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input value={o} onChange={e => setOpts(opts.map((x, j) => j === i ? e.target.value : x))} placeholder={`选项${i + 1}`} style={{ flex: 1 }} />
          {opts.length > 2 && <button type="button" className="btn btn-danger" onClick={() => setOpts(opts.filter((_, j) => j !== i))}>✕</button>}
        </div>)}
        <button type="button" className="btn" style={{ background: '#e0e0e0', fontSize: '12px' }} onClick={() => setOpts([...opts, ''])}>+ 添加选项</button>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button type="button" className="btn" onClick={onClose} style={{ flex: 1, background: '#e0e0e0' }}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>{loading ? '创建中...' : '创建'}</button>
        </div>
      </form>
    </div>
  </div>;
}

function CreateAdminModal({ admin, onClose, onMsg }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [perms, setPerms] = useState({ create_poll: true, manage_users: true, manage_admins: false, view_logs: true });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!username.trim() || !password) return setErr('用户名和密码必填');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, role, permissions: perms, adminId: admin.adminId })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onMsg(d.message);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90%' }}>
      <h3>创建管理员</h3>
      {err && <div className="error">{err}</div>}
      <form onSubmit={submit}>
        <div className="form-group"><label>用户名</label><input value={username} onChange={e => setUsername(e.target.value)} /></div>
        <div className="form-group"><label>密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="form-group"><label>角色</label><select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <option value="admin">普通管理员</option><option value="super_admin">超级管理员</option>
        </select></div>
        <div className="form-group"><label>权限</label>
          {Object.entries(perms).map(([k, v]) => <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <input type="checkbox" checked={v} onChange={() => setPerms({ ...perms, [k]: !v })} />{k}
          </label>)}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button type="button" className="btn" onClick={onClose} style={{ flex: 1, background: '#e0e0e0' }}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>{loading ? '创建中...' : '创建'}</button>
        </div>
      </form>
    </div>
  </div>;
}

export default AdminPanel;
