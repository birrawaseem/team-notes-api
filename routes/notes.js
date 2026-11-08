const express = require('express');
const pool = require('../db');
const requireUser = require('../middleware/auth');
const requireTeamMember = require('../middleware/teamAccess');

const router = express.Router();

// get all your notes within your team
router.get('/teams/:teamId/notes', requireUser, requireTeamMember, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, team_id, author_id, title, body, created_at, updated_at
         FROM notes
        WHERE team_id = $1
        ORDER BY updated_at DESC`,
      [req.teamId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// create a note in your designated team
router.post('/teams/:teamId/notes', requireUser, requireTeamMember, async (req, res, next) => {
  const { title, body = '' } = req.body ?? {};

  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'title must be 200 characters or fewer' });
  }
  if (typeof body !== 'string') {
    return res.status(400).json({ error: 'body must be a string' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO notes (team_id, author_id, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, team_id, author_id, title, body, created_at, updated_at`,
      [req.teamId, req.user.id, title.trim(), body]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;