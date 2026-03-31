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

module.exports = router;
