require('dotenv').config();
const pool = require('./index');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    `);
    await pool.query(`
      UPDATE users SET email_verified = TRUE WHERE google_id IS NOT NULL AND email_verified = FALSE;
    `);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
