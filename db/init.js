require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

async function initDB() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database initialized successfully');
    process.exit(0);
  } catch (err) {
    console.error('Database init failed:', err);
    process.exit(1);
  }
}

initDB();
