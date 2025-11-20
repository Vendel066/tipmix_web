const jwt = require('jsonwebtoken');
const config = require('../config');

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) {
      if (required) {
        return res.status(401).json({ message: 'Hiányzó auth header' });
      }
      req.user = null;
      return next();
    }

    const [, token] = header.split(' ');
    if (!token) {
      return res.status(401).json({ message: 'Hibás auth header' });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Érvénytelen vagy lejárt token' });
    }
  };
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ message: 'Admin jogosultság szükséges' });
  }
  return next();
}

module.exports = {
  auth,
  requireAdmin,
};

