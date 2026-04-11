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

const analyzeRouter     = require('./routes/analyze');
const oddsRouter        = require('./routes/odds');
const scoresRouter      = require('./routes/scores');
// const propsRouter    = require('./routes/props'); // disabled — re-enable to restore player props
const liveUnderRouter   = require('./routes/liveunder');
const valueFinderRouter  = require('./routes/valuefinder');
const authRouter         = require('./routes/auth');
const billingRouter      = require('./routes/billing');
const playerStatsRouter  = require('./routes/playerstats');
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
  max: 100,
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
  max: 20,
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
app.use('/api/auth',         authLimiter,       authRouter);
app.use('/api/analyze',      analyzeLimiter,    analyzeRouter);
app.use('/api/odds',         oddsLimiter,       oddsRouter);
app.use('/api/scores',       scoresLimiter,     scoresRouter);
// app.use('/api/props',     propsLimiter,      propsRouter); // disabled — re-enable to restore player props
app.use('/api/liveunder',    liveUnderLimiter,  liveUnderRouter);
app.use('/api/valuefinder',  oddsLimiter,          valueFinderRouter);
app.use('/api/playerstats', playerStatsLimiter,   playerStatsRouter);
app.use('/api/billing',                           billingRouter);

if (sentryEnabled) app.use(Sentry.Handlers.errorHandler());
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong. We've been notified." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Parlay Killer running on port ${PORT}`);
});
