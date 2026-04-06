const express = require('express');
const router = express.Router();

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function americanToProb(odds) {
  if (odds >= 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function americanNetPayout(odds) {
  // Net profit per $100 wagered
  if (odds >= 0) return odds;
  return 10000 / Math.abs(odds);
}

function computeEV(odds, noVigProb) {
  const netPayout = americanNetPayout(odds);
  return noVigProb * netPayout - (1 - noVigProb) * 100;
}

function fmt(n) { return n >= 0 ? `+${n}` : String(n); }

router.get('/', async (req, res) => {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return res.json(cache.data);
  }

  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: 'ODDS_API_KEY not configured' });
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/upcoming/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `Odds API ${response.status}`, detail: text });
    }

    const data = await response.json();
    const results = [];

    for (const game of data) {
      const bk = game.bookmakers && game.bookmakers[0];
      if (!bk) continue;

      const gameLabel = `${game.away_team} @ ${game.home_team}`;

      for (const market of bk.markets) {
        if (market.key === 'h2h') {
          const home = market.outcomes.find(o => o.name === game.home_team);
          const away = market.outcomes.find(o => o.name === game.away_team);
          if (!home || !away) continue;

          const pHome = americanToProb(home.price);
          const pAway = americanToProb(away.price);
          const total = pHome + pAway;

          results.push({
            game: gameLabel, sport: game.sport_title, market: 'Moneyline',
            pick: `${game.home_team} ML`, odds: home.price,
            ev: computeEV(home.price, pHome / total),
            noVigProb: pHome / total, bookImplied: pHome,
          });
          results.push({
            game: gameLabel, sport: game.sport_title, market: 'Moneyline',
            pick: `${game.away_team} ML`, odds: away.price,
            ev: computeEV(away.price, pAway / total),
            noVigProb: pAway / total, bookImplied: pAway,
          });
        }

        if (market.key === 'spreads') {
          const home = market.outcomes.find(o => o.name === game.home_team);
          const away = market.outcomes.find(o => o.name === game.away_team);
          if (!home || !away) continue;

          const pHome = americanToProb(home.price);
          const pAway = americanToProb(away.price);
          const total = pHome + pAway;

          results.push({
            game: gameLabel, sport: game.sport_title, market: 'Spread',
            pick: `${game.home_team} ${fmt(home.point)}`, odds: home.price,
            ev: computeEV(home.price, pHome / total),
            noVigProb: pHome / total, bookImplied: pHome,
          });
          results.push({
            game: gameLabel, sport: game.sport_title, market: 'Spread',
            pick: `${game.away_team} ${fmt(away.point)}`, odds: away.price,
            ev: computeEV(away.price, pAway / total),
            noVigProb: pAway / total, bookImplied: pAway,
          });
        }

        if (market.key === 'totals') {
          const over  = market.outcomes.find(o => o.name === 'Over');
          const under = market.outcomes.find(o => o.name === 'Under');
          if (!over || !under) continue;

          const pOver  = americanToProb(over.price);
          const pUnder = americanToProb(under.price);
          const total  = pOver + pUnder;

          results.push({
            game: gameLabel, sport: game.sport_title, market: 'Total',
            pick: `Over ${over.point}`, odds: over.price,
            ev: computeEV(over.price, pOver / total),
            noVigProb: pOver / total, bookImplied: pOver,
          });
          results.push({
            game: gameLabel, sport: game.sport_title, market: 'Total',
            pick: `Under ${under.point}`, odds: under.price,
            ev: computeEV(under.price, pUnder / total),
            noVigProb: pUnder / total, bookImplied: pUnder,
          });
        }
      }
    }

    results.sort((a, b) => b.ev - a.ev);

    const responseData = {
      results: results.slice(0, 60),
      total: results.length,
      disclaimer: 'EV calculated using no-vig probability from DraftKings two-way markets only. Lines with least negative EV shown first.',
    };

    cache = { data: responseData, timestamp: now };
    res.json(responseData);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch value finder data', detail: err.message });
  }
});

module.exports = router;
