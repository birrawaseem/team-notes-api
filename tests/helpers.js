const fs = require('fs');
const path = require('path');
const pool = require('../db');

const seedSql = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'seed.sql'),
  'utf8'
);

async function resetDb() {
  await pool.query(seedSql);
}

module.exports = { resetDb };