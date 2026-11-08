const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://notes:notes@localhost:5432/team_notes',
});

module.exports = pool;