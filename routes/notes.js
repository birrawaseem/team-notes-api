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
/** 
 *  Get a single note by its ID.
 *  Lets you see all the notes WITHIN your own team. **/
router.get('/notes/:noteId', requireUser, async (req, res, next) => {
  const noteId = Number(req.params.noteId);

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.team_id, n.author_id, n.title, n.body,
              n.created_at, n.updated_at
         FROM notes n
         JOIN team_members tm
           ON tm.team_id = n.team_id AND tm.user_id = $2
        WHERE n.id = $1`,
      [noteId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update your own note
router.patch('/notes/:noteId', requireUser, async (req, res, next) => {
  const noteId = Number(req.params.noteId);

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  const { title, body } = req.body ?? {};

  if (title === undefined && body === undefined) {
    return res.status(400).json({ error: 'Provide title and/or body to update' });
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (title !== undefined && title.length > 200) {
    return res.status(400).json({ error: 'title must be 200 characters or fewer' });
  }
  if (body !== undefined && typeof body !== 'string') {
    return res.status(400).json({ error: 'body must be a string' });
  }

  try {
    const found = await pool.query(
      `SELECT n.author_id
         FROM notes n
         JOIN team_members tm
           ON tm.team_id = n.team_id AND tm.user_id = $2
        WHERE n.id = $1`,
      [noteId, req.user.id]
    );

    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (found.rows[0].author_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the author can edit this note' });
    }

    const { rows } = await pool.query(
      `UPDATE notes
          SET title      = COALESCE($2, title),
              body       = COALESCE($3, body),
              updated_at = now()
        WHERE id = $1
        RETURNING id, team_id, author_id, title, body, created_at, updated_at`,
      [noteId, title?.trim() ?? null, body ?? null]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete your note within your own team
router.delete('/notes/:noteId', requireUser, async (req, res, next) => {
  const noteId = Number(req.params.noteId);

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  try {
    const found = await pool.query(
      `SELECT n.author_id
         FROM notes n
         JOIN team_members tm
           ON tm.team_id = n.team_id AND tm.user_id = $2
        WHERE n.id = $1`,
      [noteId, req.user.id]
    );

    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (found.rows[0].author_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the author can delete this note' });
    }

    await pool.query('DELETE FROM notes WHERE id = $1', [noteId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;