const express = require('express');
const router = express.Router();

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

router.get('/cache-status', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  const status = {};
  cache.forEach((v, k) => {
    status[k] = { age: Math.round((Date.now()-v.timestamp)/1000)+'s', ttl: Math.round((CACHE_TTL-(Date.now()-v.timestamp))/1000)+'s' };
  });
  res.json(status);
});

let scoresCache = { nba: null, mlb: null, lastFetch: 0 };
const SCORES_CACHE_MS = 45 * 1000;

let liveOddsCache = { nba: null, mlb: null, lastFetch: 0 };
const LIVE_ODDS_CACHE_MS = 90 * 1000;

const pregameTotalCache = {};

async function ensurePregameTotal(gameId, sport, commenceTime) {
  if (pregameTotalCache[gameId]) return pregameTotalCache[gameId];

  const pool = require('../db/index');

  try {
    const existing = await pool.query(
      'SELECT total FROM pregame_totals WHERE game_id = $1',
      [gameId]
    );
    if (existing.rows.length) {
      const total = parseFloat(existing.rows[0].total);
      pregameTotalCache[gameId] = total;
      return total;
    }
  } catch(err) {}

  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = sport === 'MLB' ? 'baseball_mlb' : 'basketball_nba';
  const commence = new Date(commenceTime);

  const offsets = [5, 30, 60, 120];

  for (const mins of offsets) {
    try {
      const snapDate = new Date(commence.getTime() - mins * 60 * 1000);
      const url = `https://api.the-odds-api.com/v4/historical/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us&markets=totals&oddsFormat=american&date=${snapDate.toISOString()}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const games = data.data || [];
      const game = games.find(g => g.id === gameId);
      if (!game) continue;

      let pregameTotal = null;
      const bookPriority = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bovada'];

      for (const bookKey of bookPriority) {
        const bk = game.bookmakers?.find(b => b.key === bookKey);
        const totalsMarket = bk?.markets?.find(m => m.key === 'totals');
        const over = totalsMarket?.outcomes?.find(o => o.name === 'Over');
        if (over?.point) { pregameTotal = over.point; break; }
      }

      if (!pregameTotal) {
        for (const bk of (game.bookmakers || [])) {
          const totalsMarket = bk.markets?.find(m => m.key === 'totals');
          const over = totalsMarket?.outcomes?.find(o => o.name === 'Over');
          if (over?.point) { pregameTotal = over.point; break; }
        }
      }

      if (pregameTotal) {
        pregameTotalCache[gameId] = pregameTotal;
        try {
          await pool.query(
            `INSERT INTO pregame_totals (game_id, total, sport, fetched_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (game_id) DO UPDATE SET total = $2`,
            [gameId, pregameTotal, sport]
          );
          console.log(`[Pregame] Fetched ${gameId} · ${pregameTotal} (offset -${mins}min)`);
        } catch(err) {}
        return pregameTotal;
      }
    } catch(err) {
      continue;
    }
  }

  console.log(`[Pregame] Could not fetch total for ${gameId}`);
  return null;
}

async function fetchPregameTotal(gameId, sport, commenceTime) {
  if (pregameTotalCache[gameId]) return pregameTotalCache[gameId];

  const pool = require('../db/index');

  try {
    const existing = await pool.query(
      'SELECT total FROM pregame_totals WHERE game_id = $1',
      [gameId]
    );
    if (existing.rows.length) {
      const total = parseFloat(existing.rows[0].total);
      pregameTotalCache[gameId] = total;
      return total;
    }
  } catch(err) {
    console.error('[Pregame] DB read error:', err.message);
  }

  try {
    const apiKey = process.env.ODDS_API_KEY;
    const commence = new Date(commenceTime);
    const fiveMinBefore = new Date(commence.getTime() - 5 * 60 * 1000);
    const dateStr = fiveMinBefore.toISOString();
    const sportKey = sport === 'MLB' ? 'baseball_mlb' : 'basketball_nba';

    const url = `https://api.the-odds-api.com/v4/historical/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us&markets=totals&oddsFormat=american&date=${dateStr}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[Pregame] HTTP ${res.status} for game ${gameId}`);
      return null;
    }

    const data = await res.json();
    const games = data.data || [];
    const game = games.find(g => g.id === gameId);

    if (!game) {
      console.log(`[Pregame] Game ${gameId} not found in snapshot`);
      return null;
    }

    let pregameTotal = null;
    const bookPriority = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bovada'];

    for (const bookKey of bookPriority) {
      const bk = game.bookmakers?.find(b => b.key === bookKey);
      if (bk) {
        const totalsMarket = bk.markets?.find(m => m.key === 'totals');
        const over = totalsMarket?.outcomes?.find(o => o.name === 'Over');
        if (over?.point) {
          pregameTotal = over.point;
          console.log(`[Pregame] ${gameId} · Pre-game total: ${pregameTotal} (${bk.title})`);
          break;
        }
      }
    }

    if (!pregameTotal) {
      for (const bk of (game.bookmakers || [])) {
        const totalsMarket = bk.markets?.find(m => m.key === 'totals');
        const over = totalsMarket?.outcomes?.find(o => o.name === 'Over');
        if (over?.point) {
          pregameTotal = over.point;
          break;
        }
      }
    }

    if (pregameTotal) {
      pregameTotalCache[gameId] = pregameTotal;
      try {
        await pool.query(
          `INSERT INTO pregame_totals (game_id, total, sport, fetched_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (game_id) DO NOTHING`,
          [gameId, pregameTotal, sport]
        );
        console.log(`[Pregame] Saved ${gameId} · ${pregameTotal} to DB`);
      } catch(dbErr) {
        console.error('[Pregame] DB write error:', dbErr.message);
      }
    }

    return pregameTotal;
  } catch(err) {
    console.error(`[Pregame] Fetch error for ${gameId}:`, err.message);
    return null;
  }
}

async function fetchLiveScores() {
  const now = Date.now();
  if (now - scoresCache.lastFetch < SCORES_CACHE_MS) return scoresCache;
  try {
    const apiKey = process.env.ODDS_API_KEY;
    const [nbaRes, mlbRes] = await Promise.all([
      fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/scores?apiKey=${apiKey}&daysFrom=1`),
      fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/scores?apiKey=${apiKey}&daysFrom=1`),
    ]);
    const nbaData = nbaRes.ok ? await nbaRes.json() : [];
    const mlbData = mlbRes.ok ? await mlbRes.json() : [];
    scoresCache = { nba: nbaData, mlb: mlbData, lastFetch: now };
    console.log(`[Scores] NBA: ${nbaData.length}, MLB: ${mlbData.length}`);
  } catch(err) {
    console.error('[Scores] Error:', err.message);
  }
  return scoresCache;
}

async function prefetchUpcomingPregameTotals(oddsData, sport) {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const games = oddsData || [];

  for (const game of games) {
    const commence = new Date(game.commence_time);
    if (commence > now && commence <= twoHoursFromNow) {
      if (!pregameTotalCache[game.id]) {
        let total = null;
        game.bookmakers?.forEach(bk => {
          const totalsMarket = bk.markets?.find(m => m.key === 'totals');
          const over = totalsMarket?.outcomes?.find(o => o.name === 'Over');
          if (over?.point && !total) total = over.point;
        });
        if (total) {
          pregameTotalCache[game.id] = total;
          const pool = require('../db/index');
          try {
            await pool.query(
              `INSERT INTO pregame_totals (game_id, total, sport, fetched_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (game_id) DO NOTHING`,
              [game.id, total, sport]
            );
            console.log(`[Pregame] Pre-saved upcoming ${game.id} · ${total}`);
          } catch(err) {}
        }
      }
    }
  }
}

async function fetchLiveOdds() {
  const now = Date.now();
  if (now - liveOddsCache.lastFetch < LIVE_ODDS_CACHE_MS) return liveOddsCache;
  try {
    const apiKey = process.env.ODDS_API_KEY;
    const [nbaRes, mlbRes] = await Promise.all([
      fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${apiKey}&regions=us&markets=totals&oddsFormat=american`),
      fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${apiKey}&regions=us&markets=totals&oddsFormat=american`),
    ]);
    const nbaData = nbaRes.ok ? await nbaRes.json() : [];
    const mlbData = mlbRes.ok ? await mlbRes.json() : [];
    liveOddsCache = { nba: nbaData, mlb: mlbData, lastFetch: now };

    prefetchUpcomingPregameTotals(nbaData, 'NBA').catch(() => {});
    prefetchUpcomingPregameTotals(mlbData, 'MLB').catch(() => {});

    console.log(`[Odds] NBA: ${nbaData.length}, MLB: ${mlbData.length}`);
  } catch(err) {
    console.error('[Odds] Error:', err.message);
  }
  return liveOddsCache;
}

function mergeGameData(scoresData, oddsData, sport) {
  const now = new Date();
  const games = [];
  const isMLB = sport === 'mlb';

  const oddsMap = {};
  (oddsData || []).forEach(g => { oddsMap[g.id] = g; });

  (scoresData || []).forEach(game => {
    const commence = new Date(game.commence_time);
    const isLive = !game.completed && commence <= now;
    const isUpcoming = commence > now;
    if (game.completed) return;
    const isFinalGrace = false;

    if (isLive && !pregameTotalCache[game.id]) {
      fetchPregameTotal(game.id, sport.toUpperCase(), game.commence_time)
        .catch(err => console.error('[Pregame background fetch]', err.message));
    }

    const oddsGame = oddsMap[game.id];
    let marketTotal = null;
    let books = [];

    if (oddsGame) {
      oddsGame.bookmakers.forEach(bk => {
        const totalsMarket = bk.markets?.find(m => m.key === 'totals');
        if (totalsMarket) {
          const over = totalsMarket.outcomes?.find(o => o.name === 'Over');
          if (over) {
            books.push({ book: bk.title, total: over.point });
            if (!marketTotal) marketTotal = over.point;
          }
        }
      });
    }

    const homeScore = game.scores
      ? parseInt(game.scores.find(s => s.name === game.home_team)?.score || '0')
      : 0;
    const awayScore = game.scores
      ? parseInt(game.scores.find(s => s.name === game.away_team)?.score || '0')
      : 0;
    const totalSoFar = homeScore + awayScore;

    const NBA_ABBR = {
      'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
      'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
      'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
      'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
      'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL',
      'LA Lakers': 'LAL', 'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA',
      'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP',
      'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL',
      'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR',
      'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
      'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
    };
    const MLB_ABBR = {
      'Arizona Diamondbacks': 'ARI', 'Atlanta Braves': 'ATL', 'Baltimore Orioles': 'BAL',
      'Boston Red Sox': 'BOS', 'Chicago Cubs': 'CHC', 'Chicago White Sox': 'CWS',
      'Cincinnati Reds': 'CIN', 'Cleveland Guardians': 'CLE', 'Colorado Rockies': 'COL',
      'Detroit Tigers': 'DET', 'Houston Astros': 'HOU', 'Kansas City Royals': 'KC',
      'Los Angeles Angels': 'LAA', 'Los Angeles Dodgers': 'LAD', 'Miami Marlins': 'MIA',
      'Milwaukee Brewers': 'MIL', 'Minnesota Twins': 'MIN', 'New York Mets': 'NYM',
      'New York Yankees': 'NYY', 'Oakland Athletics': 'OAK', 'Philadelphia Phillies': 'PHI',
      'Pittsburgh Pirates': 'PIT', 'San Diego Padres': 'SD', 'San Francisco Giants': 'SF',
      'Seattle Mariners': 'SEA', 'St. Louis Cardinals': 'STL', 'Tampa Bay Rays': 'TB',
      'Texas Rangers': 'TEX', 'Toronto Blue Jays': 'TOR', 'Washington Nationals': 'WSH',
      'Athletics': 'OAK', 'Sacramento Athletics': 'OAK',
    };
    const ABBR_MAP = isMLB ? MLB_ABBR : NBA_ABBR;
    const awayAbbr = ABBR_MAP[game.away_team] || game.away_team.split(' ').pop().substring(0, 3).toUpperCase();
    const homeAbbr = ABBR_MAP[game.home_team] || game.home_team.split(' ').pop().substring(0, 3).toUpperCase();

    let clock = '';
    let period = isLive ? 'LIVE' : 'Upcoming';
    const maxSecs = isMLB ? 9 : 2880;
    let secsRemaining = maxSecs;
    let inningsRemaining = 9;

    if (isLive && totalSoFar > 0) {
      if (isMLB) {
        const avgRunsPerInning = 0.95;
        const estimatedInningsPlayed = Math.min(8.5, totalSoFar / avgRunsPerInning);
        inningsRemaining = Math.max(0.5, Math.round((9 - estimatedInningsPlayed) * 2) / 2);
      } else {
        const avgNBAPace = 200;
        const estimatedPctDone = Math.min(0.92, totalSoFar / avgNBAPace);
        secsRemaining = Math.max(60, Math.round((1 - estimatedPctDone) * 2880));
      }
    }

    if (isUpcoming) {
      const diffMins = (commence - now) / 60000;
      const dayLabel = commence.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
      const timeLabel = commence.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
      clock = diffMins < 60
        ? Math.round(diffMins) + ' min'
        : `${dayLabel} ${timeLabel}`;
    }

    let baseEdge = 0;
    if (isLive && marketTotal && totalSoFar > 0) {
      if (isMLB) {
        const inningsPlayed = Math.max(0.5, 9 - inningsRemaining);
        const runsPerInning = totalSoFar / inningsPlayed;
        const projectedFinal = totalSoFar + (runsPerInning * inningsRemaining);
        const rawEdge = projectedFinal - marketTotal;
        baseEdge = Math.round(Math.max(-5, Math.min(5, rawEdge)) * 10) / 10;
      } else {
        const minsPlayed = Math.max(1, (2880 - secsRemaining) / 60);
        const pace = totalSoFar / minsPlayed;
        const projectedFinal = totalSoFar + (pace * (secsRemaining / 60));
        const rawEdge = projectedFinal - marketTotal;
        baseEdge = Math.round(Math.max(-15, Math.min(15, rawEdge)) * 10) / 10;
      }
    }

    const defaultTotal = isMLB ? 8.5 : 220;

    games.push({
      id: game.id,
      title: game.away_team + ' @ ' + game.home_team,
      sport: sport.toUpperCase(),
      away: awayAbbr,
      home: homeAbbr,
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      awayScore: isLive ? awayScore : '–',
      homeScore: isLive ? homeScore : '–',
      awayRec: '',
      homeRec: '',
      period: isFinalGrace ? 'FINAL' : period,
      clock: isFinalGrace ? '' : clock,
      totalSoFar,
      marketTotal: pregameTotalCache[game.id] || marketTotal || (isMLB ? 8.5 : null),
      pregameTotal: pregameTotalCache[game.id] || null,
      baseEdge: isFinalGrace ? 0 : baseEdge,
      side: baseEdge >= 0 ? 'OVER' : 'UNDER',
      edgeColor: baseEdge >= 3 ? '#4da6ff' : baseEdge <= -3 ? '#ff5a52' : '#f5a623',
      badge: isFinalGrace ? 'FINAL' : (isLive ? 'LIVE' : 'PREGAME'),
      network: sport.toUpperCase(),
      status: isFinalGrace ? 'final' : (isLive ? 'live' : 'upcoming'),
      books,
      commenceTime: game.commence_time,
      isMLB,
      maxSecs: isMLB ? 9 : 2880,
      secsRemaining: isMLB ? inningsRemaining : secsRemaining,
      inningsRemaining: isMLB ? inningsRemaining : undefined,
      qtrs: [],
      awayPlayers: [],
      homePlayers: [],
    });

    if (isFinalGrace && !pregameTotalCache[game.id]) {
      ensurePregameTotal(game.id, sport.toUpperCase(), game.commence_time)
        .catch(err => console.error('[Pregame] ensure error:', err.message));
    }
  });

  return games;
}

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
  const entry = cache.get('odds');
  const isCached = !!entry;
  const age = isCached ? Math.floor((Date.now() - entry.timestamp) / 1000) : null;
  const nextRefresh = isCached ? Math.max(0, Math.floor((CACHE_TTL - (Date.now() - entry.timestamp)) / 1000)) : 0;
  res.json({ cached: isCached, age, gamesCount: isCached ? entry.data.length : 0, nextRefresh });
});

// ── Tomorrow ─────────────────────────────────────────────────────────────────
router.get('/tomorrow', async (req, res) => {
  const now = Date.now();
  const cachedTomorrow = cacheGet('tomorrow');
  if (cachedTomorrow) return res.json(cachedTomorrow);

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
    cacheSet('tomorrow', games);
    res.json(games);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch tomorrow odds', detail: err.message });
  }
});

// ── Today (default) ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const now = Date.now();
  const cachedOdds = cacheGet('odds');
  if (cachedOdds) return res.json(cachedOdds);

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
    cacheSet('odds', games);
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

// GET /api/odds/live-games — NBA + MLB with real scores + live odds merged
router.get('/live-games', async (req, res) => {
  try {
    const [scores, odds] = await Promise.all([
      fetchLiveScores(),
      fetchLiveOdds(),
    ]);

    const nbaGames = mergeGameData(scores.nba || [], odds.nba || [], 'nba');
    const mlbGames = mergeGameData(scores.mlb || [], odds.mlb || [], 'mlb');
    const allGames = [...nbaGames, ...mlbGames];

    allGames.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      return Math.abs(b.baseEdge) - Math.abs(a.baseEdge);
    });

    res.json({
      games: allGames,
      source: 'live',
      nbaCount: nbaGames.length,
      mlbCount: mlbGames.length,
      liveCount: allGames.filter(g => g.status === 'live').length,
      scoresLastFetch: scores.lastFetch,
      oddsLastFetch: odds.lastFetch,
    });
  } catch(err) {
    console.error('[live-games] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch live games', games: [] });
  }
});

// GET /api/odds/scores-only — lightweight live score polling
router.get('/scores-only', async (req, res) => {
  try {
    const scores = await fetchLiveScores();
    const liveNBA = (scores.nba || []).filter(g => !g.completed);
    const liveMLB = (scores.mlb || []).filter(g => !g.completed);
    res.json({ nba: liveNBA, mlb: liveMLB, lastFetch: scores.lastFetch });
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch scores' });
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

async function loadPregameTotalsFromDB() {
  try {
    const pool = require('../db/index');
    const result = await pool.query(
      'SELECT game_id, total FROM pregame_totals WHERE fetched_at > NOW() - INTERVAL \'7 days\''
    );
    result.rows.forEach(row => {
      pregameTotalCache[row.game_id] = parseFloat(row.total);
    });
    console.log(`[Pregame] Loaded ${result.rows.length} cached totals from DB`);
  } catch(err) {
    console.error('[Pregame] Failed to load from DB:', err.message);
  }
}

setTimeout(loadPregameTotalsFromDB, 2000);

router.get('/fetch-pregame/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { sport, commenceTime } = req.query;
  if (!sport || !commenceTime) {
    return res.status(400).json({ error: 'sport and commenceTime required' });
  }
  try {
    const total = await ensurePregameTotal(gameId, sport, commenceTime);
    res.json({ gameId, pregameTotal: total, cached: !!pregameTotalCache[gameId] });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
