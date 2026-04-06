const express = require('express');
const router = express.Router();

let cache         = { data: null, timestamp: 0 };
let tomorrowCache = { data: null, timestamp: 0 };
const CACHE_TTL   = 10 * 60 * 1000; // 10 minutes

const SPORT_NAMES = {
  americanfootball_nfl:        'NFL',
  americanfootball_ncaaf:      'NCAAF',
  basketball_nba:              'NBA',
  basketball_wnba:             'WNBA',
  basketball_ncaab:            'NCAAB',
  baseball_mlb:                'MLB',
  icehockey_nhl:               'NHL',
  soccer_epl:                  'EPL',
  soccer_uefa_champs_league:   'UCL',
  soccer_usa_mls:              'MLS',
  mma_mixed_martial_arts:      'MMA',
  tennis_atp_us_open:          'ATP',
};

function formatTime(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month:    'short',
    day:      'numeric',
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   true,
  }).format(new Date(iso)) + ' ET';
}

function transformGame(game) {
  const bk = game.bookmakers && game.bookmakers[0];
  if (!bk) return null;

  const mktMap = {};
  for (const m of bk.markets) mktMap[m.key] = m;

  const odds = {};

  // moneyline (h2h only — no player props)
  if (mktMap.h2h) {
    const home = mktMap.h2h.outcomes.find(o => o.name === game.home_team);
    const away = mktMap.h2h.outcomes.find(o => o.name === game.away_team);
    if (home && away) odds.moneyline = { home: home.price, away: away.price };
  }

  // spread
  if (mktMap.spreads) {
    const home = mktMap.spreads.outcomes.find(o => o.name === game.home_team);
    const away = mktMap.spreads.outcomes.find(o => o.name === game.away_team);
    if (home && away) {
      odds.spread = {
        home: home.point, homeOdds: home.price,
        away: away.point, awayOdds: away.price,
      };
    }
  }

  // totals (over/under only)
  if (mktMap.totals) {
    const over  = mktMap.totals.outcomes.find(o => o.name === 'Over');
    const under = mktMap.totals.outcomes.find(o => o.name === 'Under');
    if (over && under) {
      odds.total = { line: over.point, overOdds: over.price, underOdds: under.price };
    }
  }

  if (Object.keys(odds).length === 0) return null;

  return {
    id:    game.id,
    sport: SPORT_NAMES[game.sport_key] || game.sport_title || game.sport_key.toUpperCase(),
    home:  game.home_team,
    away:  game.away_team,
    time:  formatTime(game.commence_time),
    odds,
  };
}

function oddsUrl(extra = '') {
  return `https://api.the-odds-api.com/v4/sports/upcoming/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings${extra}`;
}

// ── Status ──────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const now     = Date.now();
  const isCached = cache.data !== null;
  const age      = isCached ? Math.floor((now - cache.timestamp) / 1000) : null;
  const nextRefresh = isCached
    ? Math.max(0, Math.floor((CACHE_TTL - (now - cache.timestamp)) / 1000))
    : 0;
  res.json({ cached: isCached, age, gamesCount: isCached ? cache.data.length : 0, nextRefresh });
});

// ── Tomorrow ─────────────────────────────────────────────────────────────────
router.get('/tomorrow', async (req, res) => {
  const now = Date.now();
  if (tomorrowCache.data && (now - tomorrowCache.timestamp) < CACHE_TTL) {
    return res.json(tomorrowCache.data);
  }

  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: 'ODDS_API_KEY not configured' });
  }

  try {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    const from = new Date(d); from.setUTCHours(0, 0, 0, 0);
    const to   = new Date(d); to.setUTCHours(23, 59, 59, 999);

    const response = await fetch(
      oddsUrl(`&commenceTimeFrom=${from.toISOString()}&commenceTimeTo=${to.toISOString()}`)
    );
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `Odds API ${response.status}`, detail: text });
    }
    const data  = await response.json();
    const games = data.map(transformGame).filter(Boolean);
    tomorrowCache = { data: games, timestamp: now };
    res.json(games);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch tomorrow odds', detail: err.message });
  }
});

// ── Today (default) ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return res.json(cache.data);
  }

  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: 'ODDS_API_KEY not configured' });
  }

  try {
    const response = await fetch(oddsUrl());
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `Odds API ${response.status}`, detail: text });
    }
    const data  = await response.json();
    const games = data.map(transformGame).filter(Boolean);
    cache = { data: games, timestamp: now };
    res.json(games);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch odds', detail: err.message });
  }
});

module.exports = router;
