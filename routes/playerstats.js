const express = require('express');
const router  = express.Router();

const statsCache = new Map();
const CACHE_TTL  = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = statsCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  statsCache.set(key, { data, timestamp: Date.now() });
}

// ── NBA display stats (BDL free tier only exposes player identity,
//    not season_averages — so rates come from this curated DB) ─────
const nbaDB = {
  'nikola jokic':            { ppg: 26.4, rpg: 12.8, apg: 9.0,  ptsPerMin: 0.78, rebPerMin: 0.41, astPerMin: 0.29, usageRate: 0.312 },
  'shai gilgeous-alexander': { ppg: 31.4, rpg:  5.2, apg: 6.4,  ptsPerMin: 0.89, rebPerMin: 0.13, astPerMin: 0.18, usageRate: 0.328 },
  'giannis antetokounmpo':   { ppg: 32.7, rpg: 11.5, apg: 6.5,  ptsPerMin: 0.82, rebPerMin: 0.38, astPerMin: 0.18, usageRate: 0.318 },
  'luka doncic':             { ppg: 28.6, rpg:  8.6, apg: 8.0,  ptsPerMin: 0.85, rebPerMin: 0.22, astPerMin: 0.24, usageRate: 0.334 },
  'lebron james':            { ppg: 24.5, rpg:  7.3, apg: 8.3,  ptsPerMin: 0.72, rebPerMin: 0.21, astPerMin: 0.22, usageRate: 0.298 },
  'jayson tatum':            { ppg: 26.9, rpg:  8.1, apg: 4.9,  ptsPerMin: 0.76, rebPerMin: 0.22, astPerMin: 0.13, usageRate: 0.306 },
  'anthony edwards':         { ppg: 27.5, rpg:  5.4, apg: 5.1,  ptsPerMin: 0.81, rebPerMin: 0.15, astPerMin: 0.15, usageRate: 0.315 },
  'kevin durant':            { ppg: 27.1, rpg:  6.3, apg: 4.5,  ptsPerMin: 0.77, rebPerMin: 0.18, astPerMin: 0.13, usageRate: 0.298 },
  'stephen curry':           { ppg: 26.4, rpg:  4.5, apg: 5.1,  ptsPerMin: 0.82, rebPerMin: 0.14, astPerMin: 0.18, usageRate: 0.295 },
  'devin booker':            { ppg: 25.6, rpg:  4.3, apg: 6.9,  ptsPerMin: 0.76, rebPerMin: 0.13, astPerMin: 0.16, usageRate: 0.302 },
  'tyrese haliburton':       { ppg: 20.1, rpg:  3.9, apg: 10.9, ptsPerMin: 0.52, rebPerMin: 0.12, astPerMin: 0.35, usageRate: 0.248 },
  'cade cunningham':         { ppg: 26.0, rpg:  4.4, apg: 9.2,  ptsPerMin: 0.67, rebPerMin: 0.18, astPerMin: 0.24, usageRate: 0.298 },
  'draymond green':          { ppg:  9.1, rpg:  7.2, apg: 6.8,  ptsPerMin: 0.23, rebPerMin: 0.29, astPerMin: 0.28, usageRate: 0.158 },
  'alperen sengun':          { ppg: 21.1, rpg:  9.4, apg: 5.8,  ptsPerMin: 0.62, rebPerMin: 0.38, astPerMin: 0.18, usageRate: 0.242 },
  'bam adebayo':             { ppg: 19.3, rpg: 10.4, apg: 4.6,  ptsPerMin: 0.48, rebPerMin: 0.30, astPerMin: 0.14, usageRate: 0.225 },
  'rudy gobert':             { ppg: 14.0, rpg: 12.9, apg: 1.8,  ptsPerMin: 0.38, rebPerMin: 0.42, astPerMin: 0.06, usageRate: 0.148 },
  'lu dort':                 { ppg: 13.2, rpg:  4.1, apg: 1.9,  ptsPerMin: 0.38, rebPerMin: 0.14, astPerMin: 0.07, usageRate: 0.162 },
  'jaylen brown':            { ppg: 23.0, rpg:  5.5, apg: 3.6,  ptsPerMin: 0.68, rebPerMin: 0.17, astPerMin: 0.10, usageRate: 0.285 },
  'kawhi leonard':           { ppg: 23.7, rpg:  6.1, apg: 3.9,  ptsPerMin: 0.71, rebPerMin: 0.19, astPerMin: 0.13, usageRate: 0.278 },
  'franz wagner':            { ppg: 25.6, rpg:  5.5, apg: 4.4,  ptsPerMin: 0.63, rebPerMin: 0.16, astPerMin: 0.13, usageRate: 0.268 },
  'james harden':            { ppg: 20.6, rpg:  5.0, apg: 8.5,  ptsPerMin: 0.58, rebPerMin: 0.14, astPerMin: 0.28, usageRate: 0.285 },
  'joel embiid':             { ppg: 34.7, rpg: 11.0, apg: 5.6,  ptsPerMin: 0.85, rebPerMin: 0.32, astPerMin: 0.14, usageRate: 0.335 },
  'julius randle':           { ppg: 24.0, rpg:  9.2, apg: 5.0,  ptsPerMin: 0.66, rebPerMin: 0.27, astPerMin: 0.14, usageRate: 0.298 },
  'victor wembanyama':       { ppg: 24.5, rpg: 10.6, apg: 3.9,  ptsPerMin: 0.72, rebPerMin: 0.32, astPerMin: 0.12, usageRate: 0.298 },
  'paolo banchero':          { ppg: 25.6, rpg:  7.8, apg: 5.9,  ptsPerMin: 0.72, rebPerMin: 0.22, astPerMin: 0.18, usageRate: 0.295 },
  'ja morant':               { ppg: 25.1, rpg:  4.5, apg: 8.1,  ptsPerMin: 0.74, rebPerMin: 0.12, astPerMin: 0.25, usageRate: 0.312 },
  'damian lillard':          { ppg: 24.3, rpg:  4.4, apg: 7.1,  ptsPerMin: 0.76, rebPerMin: 0.11, astPerMin: 0.19, usageRate: 0.318 },
  'donovan mitchell':        { ppg: 26.6, rpg:  5.1, apg: 6.1,  ptsPerMin: 0.72, rebPerMin: 0.12, astPerMin: 0.14, usageRate: 0.305 },
  'trae young':              { ppg: 23.0, rpg:  2.8, apg: 10.8, ptsPerMin: 0.68, rebPerMin: 0.09, astPerMin: 0.30, usageRate: 0.322 },
  'zion williamson':         { ppg: 22.9, rpg:  5.8, apg: 5.0,  ptsPerMin: 0.84, rebPerMin: 0.21, astPerMin: 0.13, usageRate: 0.318 },
  'lamelo ball':             { ppg: 23.4, rpg:  5.8, apg: 8.0,  ptsPerMin: 0.65, rebPerMin: 0.15, astPerMin: 0.27, usageRate: 0.295 },
  'karl-anthony towns':      { ppg: 24.0, rpg: 13.9, apg: 3.1,  ptsPerMin: 0.68, rebPerMin: 0.34, astPerMin: 0.11, usageRate: 0.268 },
  'jalen brunson':           { ppg: 29.0, rpg:  3.5, apg: 6.8,  ptsPerMin: 0.72, rebPerMin: 0.09, astPerMin: 0.18, usageRate: 0.318 },
  'demar derozan':           { ppg: 24.5, rpg:  4.8, apg: 4.6,  ptsPerMin: 0.65, rebPerMin: 0.13, astPerMin: 0.13, usageRate: 0.285 },
  'pascal siakam':           { ppg: 21.3, rpg:  7.8, apg: 4.9,  ptsPerMin: 0.62, rebPerMin: 0.22, astPerMin: 0.14, usageRate: 0.272 },
  'og anunoby':              { ppg: 15.7, rpg:  5.7, apg: 2.3,  ptsPerMin: 0.45, rebPerMin: 0.17, astPerMin: 0.07, usageRate: 0.195 },
  'mikal bridges':           { ppg: 19.6, rpg:  4.5, apg: 3.9,  ptsPerMin: 0.55, rebPerMin: 0.12, astPerMin: 0.11, usageRate: 0.248 },
  'brandon ingram':          { ppg: 22.0, rpg:  5.1, apg: 4.5,  ptsPerMin: 0.65, rebPerMin: 0.16, astPerMin: 0.14, usageRate: 0.278 },
  'desmond bane':            { ppg: 21.5, rpg:  4.3, apg: 4.4,  ptsPerMin: 0.58, rebPerMin: 0.13, astPerMin: 0.13, usageRate: 0.245 },
  'darius garland':          { ppg: 19.5, rpg:  2.6, apg: 7.7,  ptsPerMin: 0.58, rebPerMin: 0.08, astPerMin: 0.24, usageRate: 0.268 },
  'evan mobley':             { ppg: 18.6, rpg: 10.2, apg: 3.0,  ptsPerMin: 0.45, rebPerMin: 0.34, astPerMin: 0.09, usageRate: 0.215 },
  'jarrett allen':           { ppg: 13.8, rpg: 10.5, apg: 1.8,  ptsPerMin: 0.42, rebPerMin: 0.38, astPerMin: 0.05, usageRate: 0.178 },
  'tyrese maxey':            { ppg: 25.9, rpg:  3.7, apg: 6.5,  ptsPerMin: 0.68, rebPerMin: 0.09, astPerMin: 0.16, usageRate: 0.292 },
};

// ── Name aliases ──────────────────────────────────────────
const nameAliases = {
  'wemby':  'victor wembanyama',
  'bron':   'lebron james',
  'steph':  'stephen curry',
  'dame':   'damian lillard',
  'ant':    'anthony edwards',
  'sga':    'shai gilgeous-alexander',
  'kt':     'karl-anthony towns',
  'zion':   'zion williamson',
  'ja':     'ja morant',
  'melo':   'lamelo ball',
  'trae':   'trae young',
  'obi':    'og anunoby',
};

function resolvePlayerName(name) {
  const lower = (name || '').toLowerCase().trim();
  return nameAliases[lower] || lower;
}

// ── GET /api/playerstats/nba?name=lebron+james ────────────
// BDL free tier: player identity (name/team) only — no stats endpoint.
// Rates come from nbaDB; BDL confirms identity and gives live team info.
router.get('/nba', async (req, res) => {
  const name = resolvePlayerName(req.query.name);
  if (!name) return res.status(400).json({ error: 'Name required' });

  const cacheKey = `nba:${name}`;
  const cached   = getCached(cacheKey);
  if (cached) return res.json(cached);

  const dbEntry = nbaDB[name];

  if (!process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_API_KEY === 'your_key_here') {
    // No API key — DB-only mode
    if (!dbEntry) return res.json({ found: false, message: 'Player not in database' });
    const result = { found: true, sport: 'NBA', source: 'database', name, team: '', teamAbbr: '', ...dbEntry };
    setCache(cacheKey, result);
    return res.json(result);
  }

  try {
    // BDL search matches first_name or last_name — use first word of input
    const firstName = name.split(' ')[0];
    const searchRes = await fetch(
      `https://api.balldontlie.io/v1/players?search=${encodeURIComponent(firstName)}&per_page=15`,
      { headers: { Authorization: process.env.BALLDONTLIE_API_KEY } }
    );

    if (!searchRes.ok) {
      // API error — fall back to DB
      if (!dbEntry) return res.json({ found: false, message: 'Player not in database' });
      const result = { found: true, sport: 'NBA', source: 'database', name, team: '', teamAbbr: '', ...dbEntry };
      setCache(cacheKey, result);
      return res.json(result);
    }

    const searchData = await searchRes.json();

    // Find best full-name match
    const player = (searchData.data || []).find(p => {
      const full = `${p.first_name} ${p.last_name}`.toLowerCase();
      return full === name || full.startsWith(name) || name.startsWith(full);
    });

    if (!player) {
      // BDL didn't find them — still serve from DB if available
      if (!dbEntry) return res.json({ found: false, message: 'Player not found' });
      const result = { found: true, sport: 'NBA', source: 'database', name, team: '', teamAbbr: '', ...dbEntry };
      setCache(cacheKey, result);
      return res.json(result);
    }

    if (!dbEntry) {
      // Found in BDL but no stats in our DB — can't provide per-minute rates
      return res.json({ found: false, message: 'Player not in stats database — using league average estimates' });
    }

    const result = {
      found: true,
      sport: 'NBA',
      source: 'database',            // rates from DB (BDL free tier has no stats endpoint)
      name: `${player.first_name} ${player.last_name}`,
      team: player.team?.full_name || '',
      teamAbbr: player.team?.abbreviation || '',
      position: player.position || '',
      ptsPerGame: dbEntry.ppg,
      rebPerGame: dbEntry.rpg,
      astPerGame: dbEntry.apg,
      ptsPerMin:  dbEntry.ptsPerMin,
      rebPerMin:  dbEntry.rebPerMin,
      astPerMin:  dbEntry.astPerMin,
      usageRate:  dbEntry.usageRate,
    };

    setCache(cacheKey, result);
    res.json(result);

  } catch (err) {
    console.error('NBA stats error:', err.message);
    if (!dbEntry) return res.json({ found: false, message: 'Stats unavailable — using estimates' });
    const result = { found: true, sport: 'NBA', source: 'database', name, team: '', teamAbbr: '', ...dbEntry };
    setCache(cacheKey, result);
    res.json(result);
  }
});

// ── GET /api/playerstats/mlb?name=mookie+betts ───────────
// MLB Stats API is free (no key). Returns real current-season stats.
router.get('/mlb', async (req, res) => {
  const name = resolvePlayerName(req.query.name);
  if (!name) return res.status(400).json({ error: 'Name required' });

  const cacheKey = `mlb:${name}`;
  const cached   = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Step 1: Search for player
    const searchRes = await fetch(
      `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportId=1`
    );
    if (!searchRes.ok) return res.json({ found: false, message: 'Stats unavailable — using estimates' });

    const searchData = await searchRes.json();
    if (!searchData.people?.length) return res.json({ found: false, message: 'Player not found' });

    const player   = searchData.people[0];
    const playerId = player.id;

    // Step 2: Get position and name
    const peopleRes = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}`);
    const peopleData = await peopleRes.json();
    const fullPlayer = peopleData.people?.[0] || player;

    // Step 3: Current season hitting stats
    const currentYear = new Date().getFullYear();
    const statsRes    = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=${currentYear}&group=hitting`
    );
    if (!statsRes.ok) return res.json({ found: false, message: 'Stats unavailable — using estimates' });

    const statsData = await statsRes.json();
    const split     = statsData.stats?.[0]?.splits?.[0];
    const stats     = split?.stat;

    if (!stats) return res.json({ found: false, message: 'No stats found for this season' });

    // Step 4: Get team abbreviation
    const teamId   = split?.team?.id;
    let teamAbbr   = '';
    let teamName   = split?.team?.name || '';
    if (teamId) {
      try {
        const teamRes  = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}`);
        const teamData = await teamRes.json();
        teamAbbr = teamData.teams?.[0]?.abbreviation || '';
        teamName = teamData.teams?.[0]?.name || teamName;
      } catch (_) { /* non-critical */ }
    }

    const pa    = parseInt(stats.plateAppearances) || 1;
    const hits  = parseInt(stats.hits) || 0;
    const games = parseInt(stats.gamesPlayed) || 1;

    const result = {
      found: true,
      sport: 'MLB',
      source: 'live',
      name: fullPlayer.fullName,
      team: teamName,
      teamAbbr,
      position: fullPlayer.primaryPosition?.abbreviation || '',
      batSide: fullPlayer.batSide?.code || '',
      avg: parseFloat(stats.avg) || 0.250,
      ops: parseFloat(stats.ops) || 0.750,
      slg: parseFloat(stats.slg) || 0.400,
      obp: parseFloat(stats.obp) || 0.320,
      paPerGame: parseFloat((pa / games).toFixed(2)),
      hitsPerGame: parseFloat((hits / games).toFixed(2)),
      strikeoutRate: parseFloat((parseInt(stats.strikeOuts) / pa).toFixed(3)),
      hardHitRate: 0.380, // not in free API — league average placeholder
      games,
    };

    setCache(cacheKey, result);
    res.json(result);

  } catch (err) {
    console.error('MLB stats error:', err.message);
    res.json({ found: false, message: 'Stats unavailable — using estimates' });
  }
});

module.exports = router;
