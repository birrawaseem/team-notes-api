const pool = require('../db');

async function requireUser(req, res, next) {
  const userId = Number(req.header('X-User-Id'));

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: 'Missing or invalid X-User-Id header' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Unknown user' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireUser;