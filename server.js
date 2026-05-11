require('dotenv').config();
const sentryEnabled = process.env.SENTRY_DSN?.startsWith('https://');
let Sentry;
if (sentryEnabled) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const session    = require('express-session');
const PgSession  = require('connect-pg-simple')(session);
const pool       = require('./db/index');

if (!process.env.SPORTRADAR_API_KEY) {
  console.warn('[Sportradar] API key not set — live scores will use fallback');
}

// Auto-create tables if they don't exist
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)`);
    console.log('[DB] Tables initialized');
  } catch (err) {
    console.error('[DB] Table init error:', err.message);
  }
}
initDb();

const analyzeRouter     = require('./routes/analyze');
const oddsRouter        = require('./routes/odds');
const scoresRouter      = require('./routes/scores');
// const propsRouter    = require('./routes/props'); // disabled — re-enable to restore player props
const liveUnderRouter   = require('./routes/liveunder');
const valueFinderRouter  = require('./routes/valuefinder');
const authRouter         = require('./routes/auth');
const billingRouter      = require('./routes/billing');
const playerStatsRouter  = require('./routes/playerstats');
const newsRouter         = require('./routes/news');
const passport          = require('./config/passport');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// ── Session ────────────────────────────────────────────────
app.use(session({
  store: new PgSession({ pool, tableName: 'sessions' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Rate limiters ──────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests — slow down.' },
});

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many analyses — slow down.' },
});

const oddsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests — slow down.' },
});

const scoresLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests — slow down.' },
});

// const propsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many requests — slow down.' } }); // disabled

const liveUnderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests — slow down.' },
});

const playerStatsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests — slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many auth attempts — slow down.' },
});

// ── Middleware ─────────────────────────────────────────────
if (sentryEnabled) app.use(Sentry.Handlers.requestHandler());
app.use(generalLimiter);
app.use(cors({ origin: true, credentials: true }));

// Webhook needs raw body BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Serve landing page to logged-out visitors, the app to logged-in users
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
  }
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// { index: false } prevents express.static from auto-serving index.html for /
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} | ${req.ip} | ${req.method} ${req.path} | ${res.statusCode} | ${Date.now() - start}ms`);
  });
  next();
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',         authRouter);
app.use('/api/analyze',      analyzeLimiter,    analyzeRouter);
app.use('/api/odds',         oddsLimiter,       oddsRouter);
app.use('/api/scores',       scoresLimiter,     scoresRouter);
// app.use('/api/props',     propsLimiter,      propsRouter); // disabled — re-enable to restore player props
app.use('/api/liveunder',    liveUnderLimiter,  liveUnderRouter);
app.use('/api/valuefinder',  oddsLimiter,          valueFinderRouter);
app.use('/api/playerstats', playerStatsLimiter,   playerStatsRouter);
app.use('/api/billing',                           billingRouter);
app.use('/api/news',                              newsRouter);

if (sentryEnabled) app.use(Sentry.Handlers.errorHandler());
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong. We've been notified." });
});

// ── Reset password page ────────────────────────────────────
app.get('/reset-password', (req, res) => {
  const token = req.query.token || '';
  // Validate token looks like a hex string before embedding in HTML
  const safeToken = /^[a-f0-9]{64}$/.test(token) ? token : '';
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset Password — Parlay Killer</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#080808;color:#fff;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#111;border:1px solid #222;border-radius:12px;padding:40px 32px;width:100%;max-width:420px}
    .logo{font-size:20px;font-weight:900;letter-spacing:0.06em;margin-bottom:28px}
    .logo span{color:#00ff87}
    h1{font-size:22px;font-weight:900;margin-bottom:8px}
    p{font-size:14px;color:#888;margin-bottom:24px;line-height:1.6}
    label{display:block;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;margin-bottom:6px}
    input{width:100%;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;font-size:15px;padding:12px 14px;margin-bottom:16px;outline:none}
    input:focus{border-color:#00ff87}
    button{width:100%;background:#00ff87;color:#000;font-size:15px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;border:none;border-radius:6px;padding:14px;cursor:pointer;margin-top:4px}
    button:disabled{opacity:0.5;cursor:default}
    .msg{font-size:14px;margin-top:16px;text-align:center;min-height:20px}
    .msg.error{color:#ff4444}
    .msg.ok{color:#00ff87}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span>PARLAY</span> KILLER</div>
    <h1>Set new password</h1>
    <p>Enter a new password for your account. Minimum 8 characters.</p>
    <form id="form" onsubmit="submit(event)">
      <label>New Password</label>
      <input type="password" id="pw" placeholder="New password" minlength="8" required autocomplete="new-password" />
      <label>Confirm Password</label>
      <input type="password" id="pw2" placeholder="Confirm password" minlength="8" required autocomplete="new-password" />
      <button type="submit" id="btn">Reset Password</button>
    </form>
    <div class="msg" id="msg"></div>
  </div>
  <script>
    const TOKEN = ${JSON.stringify(safeToken)};
    async function submit(e) {
      e.preventDefault();
      const pw = document.getElementById('pw').value;
      const pw2 = document.getElementById('pw2').value;
      const msg = document.getElementById('msg');
      const btn = document.getElementById('btn');
      msg.className = 'msg';
      if (pw !== pw2) { msg.textContent = 'Passwords do not match'; msg.className = 'msg error'; return; }
      if (!TOKEN) { msg.textContent = 'Invalid reset link'; msg.className = 'msg error'; return; }
      btn.disabled = true;
      btn.textContent = 'Resetting...';
      try {
        const r = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, newPassword: pw }),
        });
        const data = await r.json();
        if (r.ok) {
          msg.textContent = 'Password reset! Redirecting to login...';
          msg.className = 'msg ok';
          document.getElementById('form').reset();
          setTimeout(() => { window.location.href = '/'; }, 2000);
        } else {
          msg.textContent = data.error || 'Reset failed';
          msg.className = 'msg error';
          btn.disabled = false;
          btn.textContent = 'Reset Password';
        }
      } catch (err) {
        msg.textContent = 'Something went wrong';
        msg.className = 'msg error';
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      }
    }
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Parlay Killer running on port ${PORT}`);
});
