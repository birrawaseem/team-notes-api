const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema applied');
  await pool.end();
}

init().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});