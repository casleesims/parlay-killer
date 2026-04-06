const express  = require('express');
const bcrypt   = require('bcryptjs');
const pool     = require('../db/index');
const router   = express.Router();

// ── Helpers ────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeUser(row) {
  const { password_hash, ...user } = row;
  return user;
}

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email.toLowerCase(), password_hash, name || null]
    );

    const user = safeUser(result.rows[0]);
    req.session.userId = user.id;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.status(201).json({ user });
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user   = result.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({ user: safeUser(user) });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (!result.rows.length) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }
    res.json({ user: safeUser(result.rows[0]) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── GET /api/auth/google ───────────────────────────────────
// Placeholder — requires GOOGLE_CLIENT_ID/SECRET in .env to activate
router.get('/google', (req, res) => {
  res.status(501).json({ error: 'Google OAuth not configured yet' });
});

router.get('/google/callback', (req, res) => {
  res.status(501).json({ error: 'Google OAuth not configured yet' });
});

module.exports = router;
