const express = require('express');
const router = express.Router();

const SCORE_SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
];

const CACHE_TTL = 60 * 1000; // 60 seconds — scores change frequently
let cache = { data: null, timestamp: 0 };

router.get('/', async (req, res) => {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return res.json(cache.data);
  }

  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: 'ODDS_API_KEY not configured' });
  }

  try {
    const results = await Promise.all(
      SCORE_SPORTS.map(sport =>
        fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${process.env.ODDS_API_KEY}&daysFrom=1`
        )
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      )
    );

    const allScores = results.flat().map(game => {
      let status = 'scheduled';
      if (game.completed) {
        status = 'final';
      } else if (game.scores && game.scores.length > 0) {
        status = 'live';
      }

      const scoreMap = {};
      if (game.scores) {
        game.scores.forEach(s => { scoreMap[s.name] = s.score; });
      }

      return {
        id:         game.id,
        home:       game.home_team,
        away:       game.away_team,
        status,
        homeScore:  scoreMap[game.home_team] ?? null,
        awayScore:  scoreMap[game.away_team] ?? null,
      };
    });

    cache = { data: allScores, timestamp: now };
    res.json(allScores);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch scores', detail: err.message });
  }
});

// ── GET /api/scores/live — Sportradar live scores ─────────
const SR_MLB_BASE = 'https://api.sportradar.com/mlb/trial/v7/en';
const SR_NBA_BASE = 'https://api.sportradar.com/nba/trial/v8/en';
const LIVE_CACHE_TTL = 30 * 1000; // 30 seconds
let liveCache = { data: null, timestamp: 0 };

function srDate() {
  const d = new Date();
  // Use ET (UTC-4 during daylight saving)
  const et = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return {
    year:  et.getUTCFullYear(),
    month: String(et.getUTCMonth() + 1).padStart(2, '0'),
    day:   String(et.getUTCDate()).padStart(2, '0'),
  };
}

function fmtScheduledTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    }) + ' ET';
  } catch { return ''; }
}

router.get('/live', async (req, res) => {
  if (!process.env.SPORTRADAR_API_KEY) {
    return res.json([]);
  }

  const now = Date.now();
  if (liveCache.data && now - liveCache.timestamp < LIVE_CACHE_TTL) {
    return res.json(liveCache.data);
  }

  const key = process.env.SPORTRADAR_API_KEY;
  const { year, month, day } = srDate();

  try {
    // Fetch MLB and NBA schedules in parallel
    const [mlbRes, nbaRes] = await Promise.all([
      fetch(`${SR_MLB_BASE}/games/${year}/${month}/${day}/schedule.json?api_key=${key}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${SR_NBA_BASE}/games/${year}/${month}/${day}/schedule.json?api_key=${key}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const games = [];

    // ── MLB ──
    const mlbGames = mlbRes?.games || [];
    // For in-progress games fetch box scores to get current inning/score
    const liveMLB = mlbGames.filter(g => g.status === 'inprogress');
    const boxScores = await Promise.all(
      liveMLB.map(g =>
        fetch(`${SR_MLB_BASE}/games/${g.id}/boxscore.json?api_key=${key}`)
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );
    const boxMap = {};
    liveMLB.forEach((g, i) => { if (boxScores[i]) boxMap[g.id] = boxScores[i]; });

    for (const g of mlbGames) {
      const box = boxMap[g.id];
      const home = box?.game?.home || g.home || {};
      const away = box?.game?.away || g.away || {};
      games.push({
        sport:         'MLB',
        id:            g.id,
        status:        g.status,
        homeTeam:      home.name   || home.market || '',
        homeAbbr:      home.abbr   || '',
        awayTeam:      away.name   || away.market || '',
        awayAbbr:      away.abbr   || '',
        homeScore:     home.runs   ?? null,
        awayScore:     away.runs   ?? null,
        inning:        box?.game?.inning     || g.inning     || null,
        inningHalf:    box?.game?.inning_half || g.inning_half || null,
        scheduledTime: fmtScheduledTime(g.scheduled),
        broadcast:     g.broadcast?.network || '',
      });
    }

    // ── NBA ──
    const nbaGames = nbaRes?.games || [];
    for (const g of nbaGames) {
      const home = g.home || {};
      const away = g.away || {};
      games.push({
        sport:         'NBA',
        id:            g.id,
        status:        g.status,
        homeTeam:      home.name   || home.market || '',
        homeAbbr:      home.alias  || home.abbr   || '',
        awayTeam:      away.name   || away.market || '',
        awayAbbr:      away.alias  || away.abbr   || '',
        homeScore:     home.points ?? null,
        awayScore:     away.points ?? null,
        period:        g.quarter   ? `Q${g.quarter}` : null,
        timeRemaining: g.clock     || null,
        scheduledTime: fmtScheduledTime(g.scheduled),
        broadcast:     g.broadcast?.network || '',
      });
    }

    liveCache = { data: games, timestamp: now };
    res.json(games);

  } catch (err) {
    console.error('[scores/live] error:', err.message);
    res.json(liveCache.data || []);
  }
});

module.exports = router;
