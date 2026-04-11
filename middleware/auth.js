const pool = require('../db/index');
const { sendUsageWarningEmail, sendLimitReachedEmail } = require('../utils/email');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  next();
}

async function checkUsage(req, res, next) {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      error: 'Please create a free account to analyze parlays.',
      requiresAuth: true,
    });
  }

  try {
    // Owner bypass
    const ownerCheck = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (ownerCheck.rows[0]?.email === 'simscaslee@gmail.com') {
      return next();
    }

    const userResult = await pool.query(
      'SELECT plan, subscription_status FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // Pro users skip usage check
    if (user && (user.plan === 'pro' || user.subscription_status === 'active')) {
      return next();
    }

    // Count all-time analyses for free users (lifetime limit)
    const usageResult = await pool.query(
      `SELECT COUNT(*) as count FROM usage
       WHERE user_id = $1
       AND action = 'analyze'`,
      [userId]
    );

    const totalCount = parseInt(usageResult.rows[0].count);
    const FREE_LIMIT = 3;

    if (totalCount >= FREE_LIMIT) {
      return res.status(429).json({
        error: 'Free limit reached',
        message: `You've used all ${FREE_LIMIT} free analyses. Upgrade to Pro for unlimited.`,
        usageCount: totalCount,
        limit: FREE_LIMIT,
        requiresUpgrade: true,
      });
    }

    // Track this usage
    await pool.query(
      'INSERT INTO usage (user_id, action) VALUES ($1, $2)',
      [userId, 'analyze']
    );

    const newCount = totalCount + 1;
    req.usageCount = newCount;
    req.usageLimit = FREE_LIMIT;

    // Fire usage emails (fire-and-forget)
    if (newCount === 2 || newCount === 3) {
      pool.query('SELECT email, name FROM users WHERE id = $1', [userId])
        .then(r => {
          if (!r.rows.length) return;
          const { email, name } = r.rows[0];
          if (newCount === 2) sendUsageWarningEmail(email, name);
          else sendLimitReachedEmail(email, name);
        })
        .catch(err => console.error('Usage email lookup error:', err));
    }

    next();
  } catch (err) {
    console.error('Usage check error:', err);
    next(); // fail open so the app still works if DB has issues
  }
}

module.exports = { requireAuth, checkUsage };
