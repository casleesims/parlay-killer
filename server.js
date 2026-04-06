require('dotenv').config();
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
const propsRouter       = require('./routes/props');
const liveUnderRouter   = require('./routes/liveunder');
const valueFinderRouter = require('./routes/valuefinder');
const authRouter        = require('./routes/auth');
const billingRouter     = require('./routes/billing');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

// ── Session ────────────────────────────────────────────────
app.use(session({
  store: new PgSession({ pool, tableName: 'sessions' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

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

const propsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests — slow down.' },
});

const liveUnderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests — slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts — slow down.' },
});

// ── Middleware ─────────────────────────────────────────────
app.use(generalLimiter);
app.use(cors({ origin: true, credentials: true }));

// Webhook needs raw body BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
app.use('/api/props',        propsLimiter,      propsRouter);
app.use('/api/liveunder',    liveUnderLimiter,  liveUnderRouter);
app.use('/api/valuefinder',  oddsLimiter,       valueFinderRouter);
app.use('/api/billing',                         billingRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Parlay Killer running on port ${PORT}`);
});
