require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const analyzeRouter = require('./routes/analyze');
const oddsRouter    = require('./routes/odds');
const scoresRouter  = require('./routes/scores');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

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

app.use(generalLimiter);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} | ${req.ip} | ${req.method} ${req.path} | ${res.statusCode} | ${Date.now() - start}ms`);
  });
  next();
});

app.use('/api/analyze', analyzeLimiter, analyzeRouter);
app.use('/api/odds',    oddsLimiter,    oddsRouter);
app.use('/api/scores',  scoresLimiter,  scoresRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Parlay Killer running on port ${PORT}`);
});
