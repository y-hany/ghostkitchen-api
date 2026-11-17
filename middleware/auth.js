// middleware/auth.js
// verifyToken(req, res, next) — protects routes that need a signed-in user.
// requireRole(...roles)       — further restricts a route to specific roles.
//
// Usage in a route file:
//   const { verifyToken, requireRole } = require('../middleware/auth');
//   router.get('/admin/stats', verifyToken, requireRole('admin'), handler);
'use strict';
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not set in .env');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    // Decoded payload: { id: uuid, role: string, iat, exp }
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Your session has expired. Please log in again.'
      : 'Invalid token. Please log in again.';
    return res.status(401).json({ error: msg });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
