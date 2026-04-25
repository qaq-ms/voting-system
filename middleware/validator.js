function validateRequired(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        return res.status(400).json({ error: `缺少必填字段: ${field}` });
      }
    }
    next();
  };
}

function validatePositiveInteger(paramName, source = 'params') {
  return (req, res, next) => {
    const value = source === 'params' ? req.params[paramName] : req.body[paramName];
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ error: `无效的${paramName}` });
    }
    req[`_${paramName}`] = num;
    next();
  };
}

module.exports = { validateRequired, validatePositiveInteger };
