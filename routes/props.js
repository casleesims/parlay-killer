const express = require('express');
const router = express.Router();

const propsCache = new Map(); // `${sport}:${eventId}` → { data, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PROP_MARKETS = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_passing_yards',
  'player_rushing_yards',
  'player_receiving_yards',
  'player_touchdowns',
].join(',');

router.get('/:sport/:eventId', async (req, res) => {
  const { sport, eventId } = req.params;

  if (!/^[a-z_]+$/.test(sport) || !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const cacheKey = `${sport}:${eventId}`;
  const cached = propsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return res.json(cached.data);
  }

  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: 'ODDS_API_KEY not configured' });
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=${PROP_MARKETS}&bookmakers=draftkings&oddsFormat=american`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `Odds API ${response.status}`, detail: text });
    }

    const data = await response.json();
    const bk = data.bookmakers && data.bookmakers[0];

    if (!bk || !bk.markets) {
      return res.json({ players: [], eventId, sport });
    }

    // Group by player — API format: outcome.name = 'Over'/'Under', outcome.description = player name
    const playerMap = {};

    for (const market of bk.markets) {
      for (const outcome of market.outcomes) {
        const playerName = outcome.description;
        const side = outcome.name; // 'Over' or 'Under'
        if (!playerName || (side !== 'Over' && side !== 'Under')) continue;

        if (!playerMap[playerName]) {
          playerMap[playerName] = { name: playerName, props: {} };
        }

        const propKey = market.key;
        if (!playerMap[playerName].props[propKey]) {
          playerMap[playerName].props[propKey] = { market: propKey, over: null, under: null, line: outcome.point };
        }

        if (side === 'Over') {
          playerMap[playerName].props[propKey].over = outcome.price;
          playerMap[playerName].props[propKey].line = outcome.point;
        } else {
          playerMap[playerName].props[propKey].under = outcome.price;
        }
      }
    }

    const players = Object.values(playerMap)
      .map(p => ({
        name: p.name,
        props: Object.values(p.props).filter(pr => pr.over !== null || pr.under !== null),
      }))
      .filter(p => p.props.length > 0);

    const result = { players, eventId, sport };
    propsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch props', detail: err.message });
  }
});

module.exports = router;
