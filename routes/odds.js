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

// ── Live Games Cache (30 min) ──────────────────────────────
const liveGamesCache = {};
const LIVE_CACHE_TTL = 30 * 60 * 1000;

async function fetchWithCache(url, cacheKey) {
  const now = Date.now();
  if (liveGamesCache[cacheKey] && now - liveGamesCache[cacheKey].timestamp < LIVE_CACHE_TTL) {
    return liveGamesCache[cacheKey].data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
  const data = await res.json();
  liveGamesCache[cacheKey] = { data, timestamp: now };
  return data;
}

const TEAM_ABBR_MAP = {
  'Atlanta Hawks':'ATL','Boston Celtics':'BOS','Brooklyn Nets':'BKN',
  'Charlotte Hornets':'CHA','Chicago Bulls':'CHI','Cleveland Cavaliers':'CLE',
  'Dallas Mavericks':'DAL','Denver Nuggets':'DEN','Detroit Pistons':'DET',
  'Golden State Warriors':'GSW','Houston Rockets':'HOU','Indiana Pacers':'IND',
  'Los Angeles Clippers':'LAC','Los Angeles Lakers':'LAL','Memphis Grizzlies':'MEM',
  'Miami Heat':'MIA','Milwaukee Bucks':'MIL','Minnesota Timberwolves':'MIN',
  'New Orleans Pelicans':'NOP','New York Knicks':'NYK','Oklahoma City Thunder':'OKC',
  'Orlando Magic':'ORL','Philadelphia 76ers':'PHI','Phoenix Suns':'PHX',
  'Portland Trail Blazers':'POR','Sacramento Kings':'SAC','San Antonio Spurs':'SAS',
  'Toronto Raptors':'TOR','Utah Jazz':'UTA','Washington Wizards':'WAS',
  'New York Yankees':'NYY','Boston Red Sox':'BOS','Los Angeles Dodgers':'LAD',
  'Chicago Cubs':'CHC','Houston Astros':'HOU','Atlanta Braves':'ATL',
  'New York Mets':'NYM','Philadelphia Phillies':'PHI','San Francisco Giants':'SF',
  'St. Louis Cardinals':'STL','San Diego Padres':'SD','Milwaukee Brewers':'MIL',
  'Minnesota Twins':'MIN','Seattle Mariners':'SEA','Tampa Bay Rays':'TB',
  'Toronto Blue Jays':'TOR','Baltimore Orioles':'BAL','Cleveland Guardians':'CLE',
  'Detroit Tigers':'DET','Kansas City Royals':'KC','Chicago White Sox':'CWS',
  'Texas Rangers':'TEX','Los Angeles Angels':'LAA','Oakland Athletics':'OAK',
  'Miami Marlins':'MIA','Washington Nationals':'WSH','Colorado Rockies':'COL',
  'Arizona Diamondbacks':'ARI','Cincinnati Reds':'CIN','Pittsburgh Pirates':'PIT',
};

function getTeamAbbr(fullName) {
  return TEAM_ABBR_MAP[fullName] || fullName.split(' ').pop().slice(0, 3).toUpperCase();
}

function formatLiveGames(games, sport) {
  const now = new Date();
  return games.map(g => {
    const dk    = g.bookmakers.find(b => b.key === 'draftkings');
    const fd    = g.bookmakers.find(b => b.key === 'fanduel');
    const bmgm  = g.bookmakers.find(b => b.key === 'betmgm');
    const getTot  = (bm) => bm?.markets?.find(m => m.key === 'totals')?.outcomes?.find(o => o.name === 'Over')?.point || null;
    const getOver = (bm) => bm?.markets?.find(m => m.key === 'totals')?.outcomes?.find(o => o.name === 'Over')?.price || -110;
    const getUnder = (bm) => bm?.markets?.find(m => m.key === 'totals')?.outcomes?.find(o => o.name === 'Under')?.price || -110;
    const marketTotal = getTot(dk) || getTot(fd) || getTot(bmgm) || null;
    if (!marketTotal) return null;
    const commence = new Date(g.commence_time);
    const diffHrs = (commence - now) / (1000 * 60 * 60);
    const status = diffHrs < 0 ? 'live' : diffHrs < 3 ? 'upcoming' : 'scheduled';
    return {
      id: g.id,
      sport,
      homeTeam: g.home_team,
      awayTeam: g.away_team,
      homeAbbr: getTeamAbbr(g.home_team),
      awayAbbr: getTeamAbbr(g.away_team),
      commenceTime: g.commence_time,
      status,
      marketTotal,
      books: {
        draftkings: { total: getTot(dk),   over: getOver(dk),   under: getUnder(dk) },
        fanduel:    { total: getTot(fd),    over: getOver(fd),   under: getUnder(fd) },
        betmgm:     { total: getTot(bmgm),  over: getOver(bmgm), under: getUnder(bmgm) },
      },
    };
  }).filter(Boolean);
}

// GET /api/odds/live-games — NBA + MLB next 24h with totals
router.get('/live-games', async (req, res) => {
  if (!process.env.ODDS_API_KEY) {
    return res.json({ games: [], source: 'no-key' });
  }
  const base = `https://api.the-odds-api.com/v4`;
  try {
    const [nbaRaw, mlbRaw] = await Promise.all([
      fetchWithCache(
        `${base}/sports/basketball_nba/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=totals&oddsFormat=american`,
        'nba-live-odds'
      ).catch(() => []),
      fetchWithCache(
        `${base}/sports/baseball_mlb/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=totals&oddsFormat=american`,
        'mlb-live-odds'
      ).catch(() => []),
    ]);

    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const games = [
      ...formatLiveGames(nbaRaw, 'NBA'),
      ...formatLiveGames(mlbRaw, 'MLB'),
    ]
      .filter(g => new Date(g.commenceTime) <= cutoff)
      .sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

    res.json({ games, source: 'odds-api', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Odds] live-games error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/odds/game/:id — single game by id
router.get('/game/:id', async (req, res) => {
  if (!process.env.ODDS_API_KEY) return res.status(503).json({ error: 'No API key' });
  const sport = req.query.sport === 'MLB' ? 'baseball_mlb' : 'basketball_nba';
  const base  = `https://api.the-odds-api.com/v4`;
  try {
    const data = await fetchWithCache(
      `${base}/sports/${sport}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=totals&oddsFormat=american`,
      `${sport}-live-odds`
    );
    const game = data.find(g => g.id === req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
