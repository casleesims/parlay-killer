const express = require('express');
const router = express.Router();

function parseTimeRemaining(str) {
  if (!str && str !== 0) return 0;
  str = String(str).trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const mins  = parseFloat(parts[0]) || 0;
    const secs  = parseFloat(parts[1]) || 0;
    return mins + secs / 60;
  }
  return parseFloat(str) || 0;
}

router.post('/', (req, res) => {
  let { playerName, currentStat, propLine, quarter, timeRemaining, homeScore, awayScore, statType } = req.body;

  if (!playerName || typeof playerName !== 'string' || playerName.length > 60) {
    return res.status(400).json({ error: 'Invalid player name' });
  }
  currentStat = parseFloat(currentStat);
  propLine    = parseFloat(propLine);
  if (isNaN(currentStat) || isNaN(propLine) || propLine <= 0) {
    return res.status(400).json({ error: 'Invalid stat or prop line' });
  }

  const isOT    = quarter === 'OT';
  const qNum    = isOT ? 5 : (parseInt(String(quarter).replace('Q', '')) || 1);
  const timeRemainingMins = parseTimeRemaining(timeRemaining);

  let minsPlayed, minsRemaining;
  if (isOT) {
    const otElapsed = Math.max(0, 5 - Math.min(timeRemainingMins, 5));
    minsPlayed    = 48 + otElapsed;
    minsRemaining = Math.max(0, timeRemainingMins);
  } else {
    const quartersCompleted = qNum - 1;
    const qMinsElapsed      = Math.max(0, 12 - Math.min(timeRemainingMins, 12));
    minsPlayed    = quartersCompleted * 12 + qMinsElapsed;
    minsRemaining = timeRemainingMins + Math.max(0, (4 - qNum) * 12);
  }

  if (minsPlayed < 0.5) {
    return res.status(400).json({ error: 'Not enough playing time to calculate pace. Enter time remaining.' });
  }

  const pace          = currentStat / minsPlayed;
  const projectedFinal = parseFloat((currentStat + pace * minsRemaining).toFixed(1));
  const needed        = Math.max(0, propLine - currentStat);
  const neededPerMin  = minsRemaining > 0 ? needed / minsRemaining : Infinity;
  const paceRatio     = pace > 0 ? neededPerMin / pace : 999;

  const homeSc    = parseFloat(homeScore) || 0;
  const awaySc    = parseFloat(awayScore) || 0;
  const scoreDiff = Math.abs(homeSc - awaySc);
  const isBlowout = scoreDiff >= 10;

  const statLabel = statType || 'Points';

  // ── Build signals ─────────────────────────────────────────
  const signals = [];
  let score = 50; // start neutral

  // Projection vs line
  if (projectedFinal > propLine * 1.05) {
    score += 25;
    signals.push({ type: 'over', text: `Projects to ${projectedFinal} — above the ${propLine} ${statLabel.toLowerCase()} line at current pace` });
  } else if (projectedFinal < propLine * 0.95) {
    score -= 25;
    signals.push({ type: 'under', text: `Projects to ${projectedFinal} — below the ${propLine} ${statLabel.toLowerCase()} line at current pace` });
  } else {
    signals.push({ type: 'neutral', text: `Projects to ${projectedFinal} — right on the ${propLine} line` });
  }

  // Pace ratio
  if (paceRatio < 0.85) {
    score += 20;
    const pctSlower = Math.round((1 - paceRatio) * 100);
    signals.push({ type: 'over', text: `Well ahead of pace — must slow down ${pctSlower}% to stay under the line` });
  } else if (paceRatio > 1.2) {
    score -= 20;
    const pctFaster = Math.round((paceRatio - 1) * 100);
    signals.push({ type: 'under', text: `Needs to score ${pctFaster}% faster than current pace to hit the over` });
  } else {
    const pct = Math.round(paceRatio * 100);
    signals.push({ type: 'neutral', text: `Currently at ${pct}% of the required scoring rate` });
  }

  // Time and needed
  if (minsRemaining < 8 && needed >= 6) {
    score -= 20;
    signals.push({ type: 'under', text: `Only ${minsRemaining.toFixed(1)} minutes left — needs ${needed.toFixed(1)} more ${statLabel.toLowerCase()}` });
  } else if (minsRemaining > 20 && needed <= propLine * 0.3) {
    score += 15;
    signals.push({ type: 'over', text: `Plenty of time remaining with a small gap left to close` });
  }

  // Blowout
  if (isBlowout && qNum >= 3) {
    score -= 15;
    signals.push({ type: 'under', text: `Blowout game in ${quarter} — starters may see reduced minutes` });
  } else if (isBlowout) {
    signals.push({ type: 'neutral', text: `Blowout — still early, game context may shift` });
  }

  score = Math.max(0, Math.min(100, score));

  // ── Map score to recommendation ───────────────────────────
  let recommendation, confidence;
  if (score >= 75) {
    recommendation = 'STRONG OVER';
    confidence = score;
  } else if (score >= 58) {
    recommendation = 'LEAN OVER';
    confidence = score;
  } else if (score >= 43) {
    recommendation = 'TOSS UP';
    confidence = Math.round(50 + Math.abs(score - 50));
  } else if (score >= 26) {
    recommendation = 'LEAN UNDER';
    confidence = 100 - score;
  } else {
    recommendation = 'STRONG UNDER';
    confidence = 100 - score;
  }

  // ── Plain English explanation ─────────────────────────────
  const paceStr    = pace.toFixed(2);
  const ratioDir   = paceRatio > 1 ? `${Math.round((paceRatio - 1) * 100)}% faster` : `${Math.round((1 - paceRatio) * 100)}% slower`;
  const projVsLine = projectedFinal >= propLine ? 'above' : 'below';

  let explanation = `At their current pace of ${paceStr} ${statLabel.toLowerCase()} per minute, ${playerName} projects to finish with ${projectedFinal} — ${projVsLine} the ${propLine} line. `;
  explanation += `They need ${needed.toFixed(1)} more in ${minsRemaining.toFixed(1)} minutes, which requires scoring ${ratioDir} than their current rate. `;
  if (isBlowout && qNum >= 3) {
    explanation += `The game is a blowout in ${quarter}, which typically means fewer minutes for starters and less motivation to maintain pace.`;
  } else if (minsRemaining < 8) {
    explanation += `With limited time left, a significant pace change is unlikely.`;
  } else {
    explanation += `There is still meaningful time remaining for their pace to shift in either direction.`;
  }

  res.json({
    recommendation,
    confidence,
    projectedFinal,
    needed: parseFloat(needed.toFixed(1)),
    minsRemaining: parseFloat(minsRemaining.toFixed(1)),
    pace: parseFloat(pace.toFixed(2)),
    paceRatio: parseFloat(paceRatio.toFixed(2)),
    isBlowout,
    explanation,
    signals,
    statType: statLabel,
    disclaimer: 'Projections based on current pace only. Actual performance may vary. Bet responsibly.',
  });
});

module.exports = router;
