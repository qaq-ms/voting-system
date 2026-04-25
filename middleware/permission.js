function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: '未授权' });
    
    try {
      const perms = typeof req.admin.permissions === 'string' 
        ? JSON.parse(req.admin.permissions) 
        : req.admin.permissions;
      
      if (!perms[permission]) return res.status(403).json({ error: '权限不足' });
      next();
    } catch {
      return res.status(403).json({ error: '权限配置错误' });
    }
  };
}

module.exports = { requirePermission };
