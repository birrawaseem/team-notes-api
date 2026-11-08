const express = require('express');
const pool = require('../db');
const requireUser = require('../middleware/auth');
const requireTeamMember = require('../middleware/teamAccess');

const router = express.Router();

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

module.exports = router;