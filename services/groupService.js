const { getRow, getAll, run, logAdminAction } = require('../database');

function getAllGroups() {
  const groups = getAll('SELECT * FROM groups WHERE status = ? ORDER BY created_at DESC', ['active']);
  return groups.map(g => ({
    ...g,
    pollCount: getRow('SELECT COUNT(*) as c FROM polls WHERE group_id = ? AND status = ?', [g.id, 'active'])?.c || 0
  }));
}

function createGroup(name, description, adminId, ip) {
  const trimmedName = name.trim();
  if (trimmedName.length > 50) throw new Error('分组名称不能超过50个字符');
  
  const existing = getRow('SELECT id FROM groups WHERE name = ? AND status = ?', [trimmedName, 'active']);
  if (existing) throw new Error('已存在同名大议题，请使用其他名称');
  
  const { lastInsertRowid: groupId } = run(
    'INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)',
    [trimmedName, description?.trim() || '', adminId]
  );

  logAdminAction(adminId, 'create_group', 'group', groupId, `创建分组: ${trimmedName}`, ip);
  return groupId;
}

function updateGroup(groupId, updates, adminId, ip) {
  const group = getRow('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) throw new Error('分组不存在');
  
  const newName = updates.name || group.name;
  if (newName.trim().length === 0) throw new Error('分组名称不能为空');
  if (newName.trim().length > 50) throw new Error('分组名称不能超过50个字符');
  
  if (updates.name && updates.name.trim() !== group.name) {
    const existing = getRow('SELECT id FROM groups WHERE name = ? AND status = ? AND id != ?', 
      [updates.name.trim(), 'active', groupId]);
    if (existing) throw new Error('已存在同名大议题，请使用其他名称');
  }
  
  run('UPDATE groups SET name = ?, description = ?, status = ? WHERE id = ?',
    [newName.trim(), updates.description ?? group.description, updates.status || group.status, groupId]);
    
  logAdminAction(adminId, 'update_group', 'group', groupId, `更新分组: ${newName.trim()}`, ip);
}

function deleteGroup(groupId, adminId, ip) {
  const group = getRow('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) throw new Error('分组不存在');
  
  run('UPDATE groups SET status = ?, name = ? WHERE id = ?', 
    ['deleted', `[已删除]${group.name}`, groupId]);
    
  logAdminAction(adminId, 'delete_group', 'group', groupId, `删除分组: ${group.name}`, ip);
}

module.exports = {
  getAllGroups,
  createGroup,
  updateGroup,
  deleteGroup
};
