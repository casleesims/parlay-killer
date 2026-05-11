const express    = require('express');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const pool       = require('../db/index');
const passport   = require('../config/passport');
const { requireAuth } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');
const router     = express.Router();

// ── Helpers ────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeUser(row) {
  const { password_hash, ...user } = row;
  return user;
}

const disposableDomains = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'spam4.me', 'trashmail.com', 'yopmail.com',
];

// ── Rate limiter: strict on registration (3/hour per IP) ──
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many signup attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many auth attempts — slow down.' }
});

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return res.status(400).json({ error: 'Please use a real email address.' });
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
      `INSERT INTO users (email, password_hash, name, email_verified)
       VALUES ($1, $2, $3, FALSE)
       RETURNING *`,
      [email.toLowerCase(), password_hash, name || null]
    );

    const user = safeUser(result.rows[0]);
    req.session.userId = user.id;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session error' });
      // Fire-and-forget welcome email
      sendWelcomeEmail(user.email, user.name);
      res.status(201).json({ user });
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post(`/login`, loginLimiter, async (req, res) => {
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

// ── GET /api/auth/usage ────────────────────────────────────
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const userResult = await pool.query(
      'SELECT plan, subscription_status, email FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    const bypassEmails = (process.env.BYPASS_EMAILS || '').split(',').map(e => e.trim());
    const isPro = user && (
      user.plan === 'pro' ||
      user.subscription_status === 'active' ||
      bypassEmails.includes(user.email)
    );
    if (isPro) {
      return res.json({ isPro: true, used: 0, limit: 10, remaining: 999 });
    }
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM usage WHERE user_id = $1',
      [userId]
    );
    const used = parseInt(result.rows[0].count);
    const limit = 10;
    res.json({ isPro: false, used, limit, remaining: Math.max(0, limit - used) });
  } catch(e) {
    res.status(500).json({ error: e.message });
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

// ── DELETE /api/auth/delete-account ───────────────────────
router.delete('/delete-account', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const userResult = await pool.query(
      'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    if (user?.stripe_subscription_id) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
      } catch(stripeErr) {
        console.error('Stripe cancel error on account delete:', stripeErr.message);
      }
    }

    await pool.query('DELETE FROM usage WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    req.session.destroy(err => {
      if (err) console.error('Session destroy error on account delete:', err);
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  } catch(err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account. Please contact support.' });
  }
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

    const user = result.rows[0];
    const safe = safeUser(user);

    // Owner gets unlimited everything
    if (user.email === 'simscaslee@gmail.com') {
      return res.json({
        user: { ...safe, plan: 'pro', todayUsage: 0, usageLimit: null, remaining: null, isOwner: true },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usageResult = await pool.query(
      `SELECT COUNT(*) as count FROM usage
       WHERE user_id = $1 AND action = 'analyze' AND created_at >= $2`,
      [user.id, today]
    );
    const todayUsage = parseInt(usageResult.rows[0].count);
    const isPro = user.plan === 'pro' || user.subscription_status === 'active';

    res.json({
      user: {
        ...safe,
        todayUsage,
        usageLimit: isPro ? null : 10,
        remaining: isPro ? null : Math.max(0, 10 - todayUsage),
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── POST /api/auth/change-password ────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'This account uses Google sign-in — no password to change' });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.session.userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ── DELETE /api/auth/account ───────────────────────────────
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Cancel Stripe subscription if active
    if (user.stripe_subscription_id) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
      } catch (stripeErr) {
        console.error('Stripe cancel error during account deletion:', stripeErr.message);
        // Continue with deletion even if Stripe fails
      }
    }

    // Delete all sessions for this user
    await pool.query(
      `DELETE FROM sessions WHERE sess::jsonb->>'userId' = $1`,
      [String(req.session.userId)]
    );

    // Delete usage records (CASCADE handles this, but explicit for clarity)
    await pool.query('DELETE FROM usage WHERE user_id = $1', [req.session.userId]);

    // Delete the user
    await pool.query('DELETE FROM users WHERE id = $1', [req.session.userId]);

    // Destroy current session
    req.session.destroy(() => {});
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ── POST /api/auth/reset-password-admin ───────────────────
// Only callable from the owner's session
router.post('/reset-password-admin', requireAuth, async (req, res) => {
  try {
    // Verify caller is the owner
    const callerResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    if (callerResult.rows[0]?.email !== 'simscaslee@gmail.com') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Email and new password (min 8 chars) required' });
    }

    const target = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!target.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [hash, email.toLowerCase()]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Admin reset error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  // Always return ok — never reveal whether the email exists
  res.json({ ok: true });

  if (!email || !isValidEmail(email)) return;

  try {
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return;

    const { name } = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_resets (email, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO NOTHING`,
      [email.toLowerCase(), token, expires]
    );

    sendPasswordResetEmail(email.toLowerCase(), name, token);
  } catch (err) {
    console.error('Forgot password error:', err);
  }
});

// ── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Token and new password (min 8 chars) required' });
  }

  try {
    const result = await pool.query(
      'SELECT email FROM password_resets WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const { email } = result.rows[0];
    const hash = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [hash, email]);
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ── GET /api/auth/google ───────────────────────────────────
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => {
    req.session.userId = req.user.id;
    req.session.save(err => {
      if (err) console.error('Session save error after Google auth:', err);
      res.redirect('/');
    });
  }
);

module.exports = router;
