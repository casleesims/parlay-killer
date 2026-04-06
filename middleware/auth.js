const pool = require('../db/index');

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
    const userResult = await pool.query(
      'SELECT plan, subscription_status FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // Pro users skip usage check
    if (user && (user.plan === 'pro' || user.subscription_status === 'active')) {
      return next();
    }

    // Count today's analyses for free users
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usageResult = await pool.query(
      `SELECT COUNT(*) as count FROM usage
       WHERE user_id = $1
       AND action = 'analyze'
       AND created_at >= $2`,
      [userId, today]
    );

    const todayCount = parseInt(usageResult.rows[0].count);
    const FREE_LIMIT = 3;

    if (todayCount >= FREE_LIMIT) {
      return res.status(429).json({
        error: 'Daily limit reached',
        message: `You've used all ${FREE_LIMIT} free analyses today. Upgrade to Pro for unlimited.`,
        usageCount: todayCount,
        limit: FREE_LIMIT,
        requiresUpgrade: true,
      });
    }

    // Track this usage
    await pool.query(
      'INSERT INTO usage (user_id, action) VALUES ($1, $2)',
      [userId, 'analyze']
    );

    req.usageCount = todayCount + 1;
    req.usageLimit = FREE_LIMIT;

    next();
  } catch (err) {
    console.error('Usage check error:', err);
    next(); // fail open so the app still works if DB has issues
  }
}

module.exports = { requireAuth, checkUsage };
