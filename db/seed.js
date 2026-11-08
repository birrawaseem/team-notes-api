const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function seed() {
  const sql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  await pool.query(sql);
  console.log('Seed data loaded');
  await pool.end();
}

seed().catch((err) => {
  console.error('Failed to seed:', err.message);
  process.exit(1);
});