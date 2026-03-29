const express = require('express');
const router = express.Router();

function americanToProb(oddsStr) {
  const odds = parseFloat(oddsStr);
  if (odds >= 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

router.post('/', (req, res) => {
  const { legs, wager } = req.body;

  if (!legs || !Array.isArray(legs) || legs.length === 0) {
    return res.status(400).json({ error: 'legs must be a non-empty array' });
  }
  if (typeof wager !== 'number' || wager <= 0) {
    return res.status(400).json({ error: 'wager must be a positive number' });
  }

  const HOLD = 0.045;

  const processedLegs = legs.map((leg) => {
    const prob = americanToProb(leg.odds);
    const trueProb = prob * (1 - HOLD);
    return { desc: leg.desc, odds: leg.odds, trueProb };
  });

  // Parlay probabilities
  const impliedParlay = processedLegs.reduce((acc, leg) => {
    const rawProb = americanToProb(leg.odds);
    return acc * rawProb;
  }, 1);

  const trueParlay = processedLegs.reduce((acc, leg) => acc * leg.trueProb, 1);

  const bookPayout = wager / impliedParlay;
  const fairPayout = wager / trueParlay;
  const ev = trueParlay * bookPayout - (1 - trueParlay) * wager;
  const evPct = ev / wager;

  // Warnings
  const warnings = [];
  if (legs.length >= 6) {
    warnings.push('6+ legs: parlay probability becomes extremely small — house edge compounds severely.');
  } else if (legs.length >= 4) {
    warnings.push('4+ legs: each additional leg multiplies the house edge against you.');
  }

  const favorites = processedLegs.filter((leg) => leg.trueProb > 0.60);
  if (favorites.length >= 2) {
    warnings.push(`${favorites.length} heavy favorites (>60% true prob): parlaying favorites is one of the worst bets in sports betting.`);
  }

  if (evPct < -0.3) {
    warnings.push(`Expected value is ${(evPct * 100).toFixed(1)}% — you are expected to lose more than 30% of your wager on this bet.`);
  }

  // Suggestion: top 2 legs by true prob
  const sortedLegs = [...processedLegs].sort((a, b) => b.trueProb - a.trueProb);
  const top2 = sortedLegs.slice(0, 2);
  const top2Prob = top2.reduce((acc, leg) => acc * leg.trueProb, 1);
  const suggestion = {
    legs: top2.map((l) => l.desc),
    combinedProb: top2Prob,
    note: `A 2-leg parlay of "${top2.map((l) => l.desc).join('" + "')}" has a true win probability of ${(top2Prob * 100).toFixed(2)}%.`,
  };

  res.json({
    legs: processedLegs,
    trueParlay,
    impliedParlay,
    bookPayout,
    fairPayout,
    ev,
    evPct,
    warnings,
    suggestion,
    wager,
  });
});

module.exports = router;
