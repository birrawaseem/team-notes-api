const express = require('express');
const pool = require('./db');
const requireUser = require('./middleware/auth');
const notesRouter = require('./routes/notes');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

app.get('/me', requireUser, (req, res) => {
  res.json(req.user);
});

app.use(notesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;