const express = require('express');
const router  = express.Router();
const { checkUsage } = require('../middleware/auth');

function parseTimeRemaining(str) {
  if (!str && str !== 0) return 0;
  str = String(str).trim();
  if (str.includes(':')) {
    const [m, s] = str.split(':');
    return (parseFloat(m) || 0) + (parseFloat(s) || 0) / 60;
  }
  return parseFloat(str) || 0;
}

function factorial(n) {
  n = Math.min(Math.max(Math.round(n), 0), 20);
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ── Player stats database (fallback when live API unavailable) ──
const playerStats = {
  // NBA Players
  'nikola jokic': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.312, minPerGame: 34.2,
    ptsPerMin: 0.78, rebPerMin: 0.41, astPerMin: 0.29,
    ptsPerGame: 26.4, rebPerGame: 12.8, astPerGame: 9.0,
  },
  'shai gilgeous-alexander': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.328, minPerGame: 34.5,
    ptsPerMin: 0.89, rebPerMin: 0.13, astPerMin: 0.18,
    ptsPerGame: 31.4, rebPerGame: 5.2, astPerGame: 6.4,
  },
  'giannis antetokounmpo': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.318, minPerGame: 35.2,
    ptsPerMin: 0.82, rebPerMin: 0.38, astPerMin: 0.18,
    ptsPerGame: 32.7, rebPerGame: 11.5, astPerGame: 6.5,
  },
  'luka doncic': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.334, minPerGame: 36.8,
    ptsPerMin: 0.85, rebPerMin: 0.22, astPerMin: 0.24,
    ptsPerGame: 28.6, rebPerGame: 8.6, astPerGame: 8.0,
  },
  'lebron james': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.298, minPerGame: 35.1,
    ptsPerMin: 0.72, rebPerMin: 0.21, astPerMin: 0.22,
    ptsPerGame: 24.5, rebPerGame: 7.3, astPerGame: 8.3,
  },
  'jayson tatum': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.306, minPerGame: 36.5,
    ptsPerMin: 0.76, rebPerMin: 0.22, astPerMin: 0.13,
    ptsPerGame: 26.9, rebPerGame: 8.1, astPerGame: 4.9,
  },
  'anthony edwards': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.315, minPerGame: 35.4,
    ptsPerMin: 0.81, rebPerMin: 0.15, astPerMin: 0.15,
    ptsPerGame: 27.5, rebPerGame: 5.4, astPerGame: 5.1,
  },
  'kevin durant': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.298, minPerGame: 37.2,
    ptsPerMin: 0.77, rebPerMin: 0.18, astPerMin: 0.13,
    ptsPerGame: 27.1, rebPerGame: 6.3, astPerGame: 4.5,
  },
  'stephen curry': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.295, minPerGame: 32.7,
    ptsPerMin: 0.82, rebPerMin: 0.14, astPerMin: 0.18,
    ptsPerGame: 26.4, rebPerGame: 4.5, astPerGame: 5.1,
  },
  'devin booker': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.302, minPerGame: 35.8,
    ptsPerMin: 0.76, rebPerMin: 0.13, astPerMin: 0.16,
    ptsPerGame: 25.6, rebPerGame: 4.3, astPerGame: 6.9,
  },
  'tyrese haliburton': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 33.5,
    ptsPerMin: 0.52, rebPerMin: 0.12, astPerMin: 0.35,
    ptsPerGame: 20.1, rebPerGame: 3.9, astPerGame: 10.9,
  },
  'cade cunningham': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.298, minPerGame: 35.2,
    ptsPerMin: 0.67, rebPerMin: 0.18, astPerMin: 0.24,
    ptsPerGame: 26.0, rebPerGame: 4.4, astPerGame: 9.2,
  },
  'draymond green': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.158, minPerGame: 26.4,
    ptsPerMin: 0.23, rebPerMin: 0.29, astPerMin: 0.28,
    ptsPerGame: 9.1, rebPerGame: 7.2, astPerGame: 6.8,
  },
  'alperen sengun': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.242, minPerGame: 28.6,
    ptsPerMin: 0.62, rebPerMin: 0.38, astPerMin: 0.18,
    ptsPerGame: 21.1, rebPerGame: 9.4, astPerGame: 5.8,
  },
  'bam adebayo': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.225, minPerGame: 34.8,
    ptsPerMin: 0.48, rebPerMin: 0.30, astPerMin: 0.14,
    ptsPerGame: 19.3, rebPerGame: 10.4, astPerGame: 4.6,
  },
  'rudy gobert': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.148, minPerGame: 31.2,
    ptsPerMin: 0.38, rebPerMin: 0.42, astPerMin: 0.06,
    ptsPerGame: 14.0, rebPerGame: 12.9, astPerGame: 1.8,
  },
  'lu dort': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.162, minPerGame: 28.4,
    ptsPerMin: 0.38, rebPerMin: 0.14, astPerMin: 0.07,
    ptsPerGame: 13.2, rebPerGame: 4.1, astPerGame: 1.9,
  },
  'jaylen brown': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.285, minPerGame: 34.6,
    ptsPerMin: 0.68, rebPerMin: 0.17, astPerMin: 0.10,
    ptsPerGame: 23.0, rebPerGame: 5.5, astPerGame: 3.6,
  },
  'kawhi leonard': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.278, minPerGame: 31.5,
    ptsPerMin: 0.71, rebPerMin: 0.19, astPerMin: 0.13,
    ptsPerGame: 23.7, rebPerGame: 6.1, astPerGame: 3.9,
  },
  'franz wagner': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.268, minPerGame: 34.2,
    ptsPerMin: 0.63, rebPerMin: 0.16, astPerMin: 0.13,
    ptsPerGame: 25.6, rebPerGame: 5.5, astPerGame: 4.4,
  },
  'james harden': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.285, minPerGame: 34.8,
    ptsPerMin: 0.58, rebPerMin: 0.14, astPerMin: 0.28,
    ptsPerGame: 20.6, rebPerGame: 5.0, astPerGame: 8.5,
  },
  'joel embiid': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.335, minPerGame: 34.6,
    ptsPerMin: 0.85, rebPerMin: 0.32, astPerMin: 0.14,
    ptsPerGame: 34.7, rebPerGame: 11.0, astPerGame: 5.6,
  },
  'julius randle': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.298, minPerGame: 35.4,
    ptsPerMin: 0.66, rebPerMin: 0.27, astPerMin: 0.14,
    ptsPerGame: 24.0, rebPerGame: 9.2, astPerGame: 5.0,
  },

  // MLB Players
  'mookie betts': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.289, ops: 0.882, slg: 0.496, obp: 0.386,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.412, kRate: 0.148,
  },
  'freddie freeman': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.302, ops: 0.912, slg: 0.512, obp: 0.400,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.398, kRate: 0.162,
  },
  'shohei ohtani': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.310, ops: 0.965, slg: 0.585, obp: 0.380,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.445, kRate: 0.238,
  },
  'juan soto': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.288, ops: 0.948, slg: 0.491, obp: 0.457,
    battingOrder: 3, paPerGame: 4.4,
    hardHitRate: 0.408, kRate: 0.182,
  },
  'rafael devers': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.278, ops: 0.845, slg: 0.491, obp: 0.354,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.402, kRate: 0.212,
  },
  'pete alonso': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.252, ops: 0.812, slg: 0.492, obp: 0.320,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.438, kRate: 0.248,
  },
  'yordan alvarez': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.298, ops: 0.978, slg: 0.581, obp: 0.397,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.452, kRate: 0.198,
  },
  'corey seager': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.281, ops: 0.862, slg: 0.488, obp: 0.374,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.418, kRate: 0.178,
  },
  'vladimir guerrero jr': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.285, ops: 0.852, slg: 0.482, obp: 0.370,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.392, kRate: 0.168,
  },
  'ronald acuna jr': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.295, ops: 0.918, slg: 0.512, obp: 0.406,
    battingOrder: 1, paPerGame: 4.7,
    hardHitRate: 0.422, kRate: 0.198,
  },
  'jose altuve': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.298, ops: 0.845, slg: 0.462, obp: 0.383,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.352, kRate: 0.142,
  },
  'trea turner': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.285, ops: 0.802, slg: 0.438, obp: 0.364,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.378, kRate: 0.188,
  },
  'paul goldschmidt': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.268, ops: 0.842, slg: 0.468, obp: 0.374,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.388, kRate: 0.202,
  },
  'nolan arenado': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.832, slg: 0.488, obp: 0.344,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.395, kRate: 0.192,
  },
  'austin riley': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.268, ops: 0.845, slg: 0.498, obp: 0.347,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.418, kRate: 0.228,
  },
  'kyle tucker': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.278, ops: 0.868, slg: 0.488, obp: 0.380,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.402, kRate: 0.208,
  },
  'bo bichette': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.275, ops: 0.792, slg: 0.432, obp: 0.360,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.368, kRate: 0.178,
  },
  'marcus semien': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.262, ops: 0.782, slg: 0.422, obp: 0.360,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.358, kRate: 0.198,
  },
  'xander bogaerts': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.798, slg: 0.428, obp: 0.370,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.362, kRate: 0.188,
  },
  'julio rodriguez': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.275, ops: 0.812, slg: 0.462, obp: 0.350,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.388, kRate: 0.228,
  },
  'paul skenes': {
    sport: 'MLB', type: 'Weak Hitter',
    avg: 0.120, ops: 0.380, slg: 0.140, obp: 0.240,
    battingOrder: 9, paPerGame: 2.8,
    hardHitRate: 0.180, kRate: 0.420,
  },

  // NBA additions
  'victor wembanyama': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.298, minPerGame: 32.1,
    ptsPerMin: 0.72, rebPerMin: 0.32, astPerMin: 0.12,
    ptsPerGame: 24.5, rebPerGame: 10.6, astPerGame: 3.9,
  },
  'paolo banchero': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.295, minPerGame: 34.8,
    ptsPerMin: 0.72, rebPerMin: 0.22, astPerMin: 0.18,
    ptsPerGame: 25.6, rebPerGame: 7.8, astPerGame: 5.9,
  },
  'ja morant': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.312, minPerGame: 33.4,
    ptsPerMin: 0.74, rebPerMin: 0.12, astPerMin: 0.25,
    ptsPerGame: 25.1, rebPerGame: 4.5, astPerGame: 8.1,
  },
  'damian lillard': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.318, minPerGame: 35.2,
    ptsPerMin: 0.76, rebPerMin: 0.11, astPerMin: 0.19,
    ptsPerGame: 24.3, rebPerGame: 4.4, astPerGame: 7.1,
  },
  'donovan mitchell': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.305, minPerGame: 35.6,
    ptsPerMin: 0.72, rebPerMin: 0.12, astPerMin: 0.14,
    ptsPerGame: 26.6, rebPerGame: 5.1, astPerGame: 6.1,
  },
  'trae young': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.322, minPerGame: 34.8,
    ptsPerMin: 0.68, rebPerMin: 0.09, astPerMin: 0.30,
    ptsPerGame: 23.0, rebPerGame: 2.8, astPerGame: 10.8,
  },
  'zion williamson': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.318, minPerGame: 29.5,
    ptsPerMin: 0.84, rebPerMin: 0.21, astPerMin: 0.13,
    ptsPerGame: 22.9, rebPerGame: 5.8, astPerGame: 5.0,
  },
  'lamelo ball': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.295, minPerGame: 33.8,
    ptsPerMin: 0.65, rebPerMin: 0.15, astPerMin: 0.27,
    ptsPerGame: 23.4, rebPerGame: 5.8, astPerGame: 8.0,
  },
  'karl-anthony towns': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.268, minPerGame: 33.5,
    ptsPerMin: 0.68, rebPerMin: 0.34, astPerMin: 0.11,
    ptsPerGame: 24.0, rebPerGame: 13.9, astPerGame: 3.1,
  },
  'jalen brunson': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.318, minPerGame: 35.8,
    ptsPerMin: 0.72, rebPerMin: 0.09, astPerMin: 0.18,
    ptsPerGame: 29.0, rebPerGame: 3.5, astPerGame: 6.8,
  },
  'demar derozan': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.285, minPerGame: 34.2,
    ptsPerMin: 0.65, rebPerMin: 0.13, astPerMin: 0.13,
    ptsPerGame: 24.5, rebPerGame: 4.8, astPerGame: 4.6,
  },
  'pascal siakam': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.272, minPerGame: 34.5,
    ptsPerMin: 0.62, rebPerMin: 0.22, astPerMin: 0.14,
    ptsPerGame: 21.3, rebPerGame: 7.8, astPerGame: 4.9,
  },
  'og anunoby': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.195, minPerGame: 34.2,
    ptsPerMin: 0.45, rebPerMin: 0.17, astPerMin: 0.07,
    ptsPerGame: 15.7, rebPerGame: 5.7, astPerGame: 2.3,
  },
  'mikal bridges': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 35.8,
    ptsPerMin: 0.55, rebPerMin: 0.12, astPerMin: 0.11,
    ptsPerGame: 19.6, rebPerGame: 4.5, astPerGame: 3.9,
  },
  'brandon ingram': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.278, minPerGame: 33.8,
    ptsPerMin: 0.65, rebPerMin: 0.16, astPerMin: 0.14,
    ptsPerGame: 22.0, rebPerGame: 5.1, astPerGame: 4.5,
  },
  'desmond bane': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.245, minPerGame: 32.4,
    ptsPerMin: 0.58, rebPerMin: 0.13, astPerMin: 0.13,
    ptsPerGame: 21.5, rebPerGame: 4.3, astPerGame: 4.4,
  },
  'darius garland': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.268, minPerGame: 32.8,
    ptsPerMin: 0.58, rebPerMin: 0.08, astPerMin: 0.24,
    ptsPerGame: 19.5, rebPerGame: 2.6, astPerGame: 7.7,
  },
  'evan mobley': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.215, minPerGame: 33.5,
    ptsPerMin: 0.45, rebPerMin: 0.34, astPerMin: 0.09,
    ptsPerGame: 18.6, rebPerGame: 10.2, astPerGame: 3.0,
  },
  'jarrett allen': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 29.2,
    ptsPerMin: 0.42, rebPerMin: 0.38, astPerMin: 0.05,
    ptsPerGame: 13.8, rebPerGame: 10.5, astPerGame: 1.8,
  },
  'tyrese maxey': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.292, minPerGame: 35.2,
    ptsPerMin: 0.68, rebPerMin: 0.09, astPerMin: 0.16,
    ptsPerGame: 25.9, rebPerGame: 3.7, astPerGame: 6.5,
  },

  // ── NBA expansion ─────────────────────────────────────────
  // Toronto Raptors
  'scottie barnes': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.262, minPerGame: 35.2,
    ptsPerMin: 0.565, rebPerMin: 0.239, astPerMin: 0.173,
    ptsPerGame: 19.9, rebPerGame: 8.4, astPerGame: 6.1,
  },
  'rj barrett': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 34.8,
    ptsPerMin: 0.626, rebPerMin: 0.178, astPerMin: 0.103,
    ptsPerGame: 21.8, rebPerGame: 6.2, astPerGame: 3.6,
  },
  'immanuel quickley': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.192, minPerGame: 30.8,
    ptsPerMin: 0.461, rebPerMin: 0.156, astPerMin: 0.221,
    ptsPerGame: 14.2, rebPerGame: 4.8, astPerGame: 6.8,
  },
  'gradey dick': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 20.4,
    ptsPerMin: 0.382, rebPerMin: 0.118, astPerMin: 0.059,
    ptsPerGame: 7.8, rebPerGame: 2.4, astPerGame: 1.2,
  },
  'bruce brown': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.148, minPerGame: 20.8,
    ptsPerMin: 0.404, rebPerMin: 0.163, astPerMin: 0.106,
    ptsPerGame: 8.4, rebPerGame: 3.4, astPerGame: 2.2,
  },
  'precious achiuwa': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.158, minPerGame: 22.4,
    ptsPerMin: 0.366, rebPerMin: 0.304, astPerMin: 0.054,
    ptsPerGame: 8.2, rebPerGame: 6.8, astPerGame: 1.2,
  },
  // LA Clippers
  'paul george': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.278, minPerGame: 34.2,
    ptsPerMin: 0.625, rebPerMin: 0.152, astPerMin: 0.099,
    ptsPerGame: 21.4, rebPerGame: 5.2, astPerGame: 3.4,
  },
  'norman powell': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.252, minPerGame: 30.2,
    ptsPerMin: 0.781, rebPerMin: 0.113, astPerMin: 0.079,
    ptsPerGame: 23.6, rebPerGame: 3.4, astPerGame: 2.4,
  },
  'ivica zubac': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.195, minPerGame: 27.4,
    ptsPerMin: 0.467, rebPerMin: 0.372, astPerMin: 0.073,
    ptsPerGame: 12.8, rebPerGame: 10.2, astPerGame: 2.0,
  },
  'tre mann': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 24.8,
    ptsPerMin: 0.516, rebPerMin: 0.105, astPerMin: 0.089,
    ptsPerGame: 12.8, rebPerGame: 2.6, astPerGame: 2.2,
  },
  // NY Knicks
  'josh hart': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 34.8,
    ptsPerMin: 0.322, rebPerMin: 0.282, astPerMin: 0.118,
    ptsPerGame: 11.2, rebPerGame: 9.8, astPerGame: 4.1,
  },
  'donte divincenzo': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.212, minPerGame: 31.2,
    ptsPerMin: 0.506, rebPerMin: 0.135, astPerMin: 0.090,
    ptsPerGame: 15.8, rebPerGame: 4.2, astPerGame: 2.8,
  },
  'miles mcbride': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 24.8,
    ptsPerMin: 0.508, rebPerMin: 0.113, astPerMin: 0.137,
    ptsPerGame: 12.6, rebPerGame: 2.8, astPerGame: 3.4,
  },
  'mitchell robinson': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.118, minPerGame: 24.2,
    ptsPerMin: 0.281, rebPerMin: 0.339, astPerMin: 0.033,
    ptsPerGame: 6.8, rebPerGame: 8.2, astPerGame: 0.8,
  },
  // Golden State Warriors
  'andrew wiggins': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.218, minPerGame: 31.8,
    ptsPerMin: 0.528, rebPerMin: 0.145, astPerMin: 0.069,
    ptsPerGame: 16.8, rebPerGame: 4.6, astPerGame: 2.2,
  },
  'kevon looney': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.102, minPerGame: 24.2,
    ptsPerMin: 0.256, rebPerMin: 0.298, astPerMin: 0.116,
    ptsPerGame: 6.2, rebPerGame: 7.2, astPerGame: 2.8,
  },
  'jonathan kuminga': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 28.4,
    ptsPerMin: 0.683, rebPerMin: 0.169, astPerMin: 0.099,
    ptsPerGame: 19.4, rebPerGame: 4.8, astPerGame: 2.8,
  },
  'moses moody': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.158, minPerGame: 22.8,
    ptsPerMin: 0.447, rebPerMin: 0.140, astPerMin: 0.061,
    ptsPerGame: 10.2, rebPerGame: 3.2, astPerGame: 1.4,
  },
  'brandin podziemski': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 28.4,
    ptsPerMin: 0.415, rebPerMin: 0.204, astPerMin: 0.134,
    ptsPerGame: 11.8, rebPerGame: 5.8, astPerGame: 3.8,
  },
  'gary payton ii': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.098, minPerGame: 18.4,
    ptsPerMin: 0.304, rebPerMin: 0.152, astPerMin: 0.065,
    ptsPerGame: 5.6, rebPerGame: 2.8, astPerGame: 1.2,
  },
  // OKC Thunder
  'chet holmgren': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 31.4,
    ptsPerMin: 0.611, rebPerMin: 0.248, astPerMin: 0.070,
    ptsPerGame: 19.2, rebPerGame: 7.8, astPerGame: 2.2,
  },
  'jalen williams': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.268, minPerGame: 32.8,
    ptsPerMin: 0.713, rebPerMin: 0.134, astPerMin: 0.146,
    ptsPerGame: 23.4, rebPerGame: 4.4, astPerGame: 4.8,
  },
  'isaiah hartenstein': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.142, minPerGame: 25.8,
    ptsPerMin: 0.380, rebPerMin: 0.318, astPerMin: 0.100,
    ptsPerGame: 9.8, rebPerGame: 8.2, astPerGame: 2.6,
  },
  'isaiah joe': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 20.4,
    ptsPerMin: 0.431, rebPerMin: 0.108, astPerMin: 0.059,
    ptsPerGame: 8.8, rebPerGame: 2.2, astPerGame: 1.2,
  },
  'aaron wiggins': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.138, minPerGame: 22.4,
    ptsPerMin: 0.348, rebPerMin: 0.143, astPerMin: 0.063,
    ptsPerGame: 7.8, rebPerGame: 3.2, astPerGame: 1.4,
  },
  'kenrich williams': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.098, minPerGame: 18.4,
    ptsPerMin: 0.293, rebPerMin: 0.207, astPerMin: 0.098,
    ptsPerGame: 5.4, rebPerGame: 3.8, astPerGame: 1.8,
  },
  // Chicago Bulls
  'nikola vucevic': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.238, minPerGame: 30.8,
    ptsPerMin: 0.643, rebPerMin: 0.338, astPerMin: 0.110,
    ptsPerGame: 19.8, rebPerGame: 10.4, astPerGame: 3.4,
  },
  'zach lavine': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.295, minPerGame: 32.4,
    ptsPerMin: 0.716, rebPerMin: 0.148, astPerMin: 0.140,
    ptsPerGame: 23.2, rebPerGame: 4.8, astPerGame: 4.5,
  },
  'coby white': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.252, minPerGame: 33.4,
    ptsPerMin: 0.593, rebPerMin: 0.126, astPerMin: 0.144,
    ptsPerGame: 19.8, rebPerGame: 4.2, astPerGame: 4.8,
  },
  'josh giddey': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.208, minPerGame: 32.8,
    ptsPerMin: 0.433, rebPerMin: 0.220, astPerMin: 0.195,
    ptsPerGame: 14.2, rebPerGame: 7.2, astPerGame: 6.4,
  },
  'patrick williams': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 28.4,
    ptsPerMin: 0.451, rebPerMin: 0.190, astPerMin: 0.070,
    ptsPerGame: 12.8, rebPerGame: 5.4, astPerGame: 2.0,
  },
  'ayo dosunmu': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 28.2,
    ptsPerMin: 0.418, rebPerMin: 0.135, astPerMin: 0.113,
    ptsPerGame: 11.8, rebPerGame: 3.8, astPerGame: 3.2,
  },
  'andre drummond': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.142, minPerGame: 22.4,
    ptsPerMin: 0.375, rebPerMin: 0.438, astPerMin: 0.045,
    ptsPerGame: 8.4, rebPerGame: 9.8, astPerGame: 1.0,
  },
  // Orlando Magic
  'wendell carter jr': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.175, minPerGame: 26.4,
    ptsPerMin: 0.371, rebPerMin: 0.280, astPerMin: 0.076,
    ptsPerGame: 9.8, rebPerGame: 7.4, astPerGame: 2.0,
  },
  // Indiana Pacers
  'myles turner': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.222, minPerGame: 30.8,
    ptsPerMin: 0.545, rebPerMin: 0.234, astPerMin: 0.071,
    ptsPerGame: 16.8, rebPerGame: 7.2, astPerGame: 2.2,
  },
  'bennedict mathurin': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.238, minPerGame: 28.4,
    ptsPerMin: 0.500, rebPerMin: 0.148, astPerMin: 0.063,
    ptsPerGame: 14.2, rebPerGame: 4.2, astPerGame: 1.8,
  },
  'andrew nembhard': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 28.4,
    ptsPerMin: 0.415, rebPerMin: 0.113, astPerMin: 0.169,
    ptsPerGame: 11.8, rebPerGame: 3.2, astPerGame: 4.8,
  },
  'tj mcconnell': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.138, minPerGame: 20.8,
    ptsPerMin: 0.471, rebPerMin: 0.106, astPerMin: 0.231,
    ptsPerGame: 9.8, rebPerGame: 2.2, astPerGame: 4.8,
  },
  'obi toppin': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 26.4,
    ptsPerMin: 0.424, rebPerMin: 0.182, astPerMin: 0.076,
    ptsPerGame: 11.2, rebPerGame: 4.8, astPerGame: 2.0,
  },
  // Milwaukee Bucks
  'khris middleton': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.222, minPerGame: 28.8,
    ptsPerMin: 0.458, rebPerMin: 0.153, astPerMin: 0.097,
    ptsPerGame: 13.2, rebPerGame: 4.4, astPerGame: 2.8,
  },
  'brook lopez': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 28.4,
    ptsPerMin: 0.521, rebPerMin: 0.169, astPerMin: 0.042,
    ptsPerGame: 14.8, rebPerGame: 4.8, astPerGame: 1.2,
  },
  'bobby portis': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 24.8,
    ptsPerMin: 0.516, rebPerMin: 0.315, astPerMin: 0.073,
    ptsPerGame: 12.8, rebPerGame: 7.8, astPerGame: 1.8,
  },
  'marjon beauchamp': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 22.4,
    ptsPerMin: 0.348, rebPerMin: 0.143, astPerMin: 0.067,
    ptsPerGame: 7.8, rebPerGame: 3.2, astPerGame: 1.5,
  },
  'pat connaughton': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.128, minPerGame: 20.8,
    ptsPerMin: 0.356, rebPerMin: 0.202, astPerMin: 0.058,
    ptsPerGame: 7.4, rebPerGame: 4.2, astPerGame: 1.2,
  },
  'aj green': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 22.8,
    ptsPerMin: 0.386, rebPerMin: 0.132, astPerMin: 0.044,
    ptsPerGame: 8.8, rebPerGame: 3.0, astPerGame: 1.0,
  },
  'malik beasley': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 24.8,
    ptsPerMin: 0.500, rebPerMin: 0.121, astPerMin: 0.048,
    ptsPerGame: 12.4, rebPerGame: 3.0, astPerGame: 1.2,
  },
  // Minnesota Timberwolves
  'naz reid': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 24.8,
    ptsPerMin: 0.573, rebPerMin: 0.218, astPerMin: 0.073,
    ptsPerGame: 14.2, rebPerGame: 5.4, astPerGame: 1.8,
  },
  'kyle anderson': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.128, minPerGame: 18.4,
    ptsPerMin: 0.402, rebPerMin: 0.261, astPerMin: 0.109,
    ptsPerGame: 7.4, rebPerGame: 4.8, astPerGame: 2.0,
  },
  'nickeil alexander-walker': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.192, minPerGame: 22.8,
    ptsPerMin: 0.561, rebPerMin: 0.114, astPerMin: 0.070,
    ptsPerGame: 12.8, rebPerGame: 2.6, astPerGame: 1.6,
  },
  'troy brown jr': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.118, minPerGame: 18.4,
    ptsPerMin: 0.326, rebPerMin: 0.217, astPerMin: 0.087,
    ptsPerGame: 6.0, rebPerGame: 4.0, astPerGame: 1.6,
  },
  // LA Lakers
  'austin reaves': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.228, minPerGame: 32.8,
    ptsPerMin: 0.543, rebPerMin: 0.134, astPerMin: 0.146,
    ptsPerGame: 17.8, rebPerGame: 4.4, astPerGame: 4.8,
  },
  'dangelo russell': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 28.8,
    ptsPerMin: 0.583, rebPerMin: 0.111, astPerMin: 0.201,
    ptsPerGame: 16.8, rebPerGame: 3.2, astPerGame: 5.8,
  },
  'rui hachimura': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 28.4,
    ptsPerMin: 0.500, rebPerMin: 0.169, astPerMin: 0.063,
    ptsPerGame: 14.2, rebPerGame: 4.8, astPerGame: 1.8,
  },
  'max christie': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 20.8,
    ptsPerMin: 0.404, rebPerMin: 0.135, astPerMin: 0.058,
    ptsPerGame: 8.4, rebPerGame: 2.8, astPerGame: 1.2,
  },
  'tobias harris': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 28.4,
    ptsPerMin: 0.401, rebPerMin: 0.183, astPerMin: 0.070,
    ptsPerGame: 11.4, rebPerGame: 5.2, astPerGame: 2.0,
  },
  'kelly oubre jr': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.228, minPerGame: 28.8,
    ptsPerMin: 0.479, rebPerMin: 0.163, astPerMin: 0.063,
    ptsPerGame: 13.8, rebPerGame: 4.7, astPerGame: 1.8,
  },
  // Washington Wizards
  'jordan poole': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.268, minPerGame: 32.8,
    ptsPerMin: 0.598, rebPerMin: 0.085, astPerMin: 0.146,
    ptsPerGame: 19.6, rebPerGame: 2.8, astPerGame: 4.8,
  },
  'bilal coulibaly': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.162, minPerGame: 28.4,
    ptsPerMin: 0.401, rebPerMin: 0.148, astPerMin: 0.063,
    ptsPerGame: 11.4, rebPerGame: 4.2, astPerGame: 1.8,
  },
  'deni avdija': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.192, minPerGame: 32.8,
    ptsPerMin: 0.451, rebPerMin: 0.177, astPerMin: 0.104,
    ptsPerGame: 14.8, rebPerGame: 5.8, astPerGame: 3.4,
  },
  'tyus jones': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.152, minPerGame: 26.4,
    ptsPerMin: 0.371, rebPerMin: 0.083, astPerMin: 0.258,
    ptsPerGame: 9.8, rebPerGame: 2.2, astPerGame: 6.8,
  },
  'monte morris': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 22.4,
    ptsPerMin: 0.339, rebPerMin: 0.094, astPerMin: 0.143,
    ptsPerGame: 7.6, rebPerGame: 2.1, astPerGame: 3.2,
  },
  // Memphis Grizzlies
  'marcus smart': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.175, minPerGame: 26.8,
    ptsPerMin: 0.493, rebPerMin: 0.142, astPerMin: 0.231,
    ptsPerGame: 13.2, rebPerGame: 3.8, astPerGame: 6.2,
  },
  'jaren jackson jr': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.272, minPerGame: 31.8,
    ptsPerMin: 0.711, rebPerMin: 0.182, astPerMin: 0.057,
    ptsPerGame: 22.6, rebPerGame: 5.8, astPerGame: 1.8,
  },
  'gg jackson': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.212, minPerGame: 22.8,
    ptsPerMin: 0.588, rebPerMin: 0.184, astPerMin: 0.088,
    ptsPerGame: 13.4, rebPerGame: 4.2, astPerGame: 2.0,
  },
  'ziaire williams': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.175, minPerGame: 22.8,
    ptsPerMin: 0.491, rebPerMin: 0.140, astPerMin: 0.079,
    ptsPerGame: 11.2, rebPerGame: 3.2, astPerGame: 1.8,
  },
  'brandon clarke': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.155, minPerGame: 18.8,
    ptsPerMin: 0.500, rebPerMin: 0.277, astPerMin: 0.064,
    ptsPerGame: 9.4, rebPerGame: 5.2, astPerGame: 1.2,
  },
  'scottie pippen jr': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.178, minPerGame: 22.4,
    ptsPerMin: 0.464, rebPerMin: 0.098, astPerMin: 0.196,
    ptsPerGame: 10.4, rebPerGame: 2.2, astPerGame: 4.4,
  },
  'luke kennard': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 19.8,
    ptsPerMin: 0.404, rebPerMin: 0.101, astPerMin: 0.076,
    ptsPerGame: 8.0, rebPerGame: 2.0, astPerGame: 1.5,
  },
  // Miami Heat
  'tyler herro': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.278, minPerGame: 32.4,
    ptsPerMin: 0.728, rebPerMin: 0.148, astPerMin: 0.160,
    ptsPerGame: 23.6, rebPerGame: 4.8, astPerGame: 5.2,
  },
  'jaime jaquez jr': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 26.8,
    ptsPerMin: 0.463, rebPerMin: 0.164, astPerMin: 0.075,
    ptsPerGame: 12.4, rebPerGame: 4.4, astPerGame: 2.0,
  },
  'duncan robinson': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 28.8,
    ptsPerMin: 0.479, rebPerMin: 0.111, astPerMin: 0.063,
    ptsPerGame: 13.8, rebPerGame: 3.2, astPerGame: 1.8,
  },
  'haywood highsmith': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.128, minPerGame: 22.8,
    ptsPerMin: 0.404, rebPerMin: 0.237, astPerMin: 0.044,
    ptsPerGame: 9.2, rebPerGame: 5.4, astPerGame: 1.0,
  },
  'caleb martin': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.138, minPerGame: 24.8,
    ptsPerMin: 0.395, rebPerMin: 0.210, astPerMin: 0.073,
    ptsPerGame: 9.8, rebPerGame: 5.2, astPerGame: 1.8,
  },
  'jimmy butler': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.278, minPerGame: 34.2,
    ptsPerMin: 0.544, rebPerMin: 0.152, astPerMin: 0.129,
    ptsPerGame: 18.6, rebPerGame: 5.2, astPerGame: 4.4,
  },
  // Sacramento Kings
  'deaaron fox': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.282, minPerGame: 34.2,
    ptsPerMin: 0.772, rebPerMin: 0.135, astPerMin: 0.170,
    ptsPerGame: 26.4, rebPerGame: 4.6, astPerGame: 5.8,
  },
  'domantas sabonis': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.258, minPerGame: 34.2,
    ptsPerMin: 0.655, rebPerMin: 0.374, astPerMin: 0.228,
    ptsPerGame: 22.4, rebPerGame: 12.8, astPerGame: 7.8,
  },
  'keegan murray': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.218, minPerGame: 30.8,
    ptsPerMin: 0.513, rebPerMin: 0.156, astPerMin: 0.065,
    ptsPerGame: 15.8, rebPerGame: 4.8, astPerGame: 2.0,
  },
  'malik monk': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 26.8,
    ptsPerMin: 0.552, rebPerMin: 0.127, astPerMin: 0.216,
    ptsPerGame: 14.8, rebPerGame: 3.4, astPerGame: 5.8,
  },
  'harrison barnes': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 28.8,
    ptsPerMin: 0.514, rebPerMin: 0.181, astPerMin: 0.063,
    ptsPerGame: 14.8, rebPerGame: 5.2, astPerGame: 1.8,
  },
  'kevin huerter': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 24.8,
    ptsPerMin: 0.516, rebPerMin: 0.169, astPerMin: 0.085,
    ptsPerGame: 12.8, rebPerGame: 4.2, astPerGame: 2.1,
  },
  // Dallas Mavericks
  'klay thompson': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.218, minPerGame: 30.2,
    ptsPerMin: 0.470, rebPerMin: 0.106, astPerMin: 0.066,
    ptsPerGame: 14.2, rebPerGame: 3.2, astPerGame: 2.0,
  },
  'gary trent jr': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.218, minPerGame: 28.4,
    ptsPerMin: 0.507, rebPerMin: 0.099, astPerMin: 0.056,
    ptsPerGame: 14.4, rebPerGame: 2.8, astPerGame: 1.6,
  },
  // Detroit Pistons
  'jaden ivey': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.242, minPerGame: 30.2,
    ptsPerMin: 0.556, rebPerMin: 0.126, astPerMin: 0.192,
    ptsPerGame: 16.8, rebPerGame: 3.8, astPerGame: 5.8,
  },
  'isaiah stewart': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 28.4,
    ptsPerMin: 0.401, rebPerMin: 0.261, astPerMin: 0.074,
    ptsPerGame: 11.4, rebPerGame: 7.4, astPerGame: 2.1,
  },
  'bojan bogdanovic': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 26.8,
    ptsPerMin: 0.478, rebPerMin: 0.134, astPerMin: 0.060,
    ptsPerGame: 12.8, rebPerGame: 3.6, astPerGame: 1.6,
  },
  'quentin grimes': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 24.8,
    ptsPerMin: 0.468, rebPerMin: 0.121, astPerMin: 0.065,
    ptsPerGame: 11.6, rebPerGame: 3.0, astPerGame: 1.6,
  },
  // Cleveland Cavaliers
  'dean wade': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.128, minPerGame: 18.4,
    ptsPerMin: 0.402, rebPerMin: 0.228, astPerMin: 0.065,
    ptsPerGame: 7.4, rebPerGame: 4.2, astPerGame: 1.2,
  },
  'isaac okoro': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.138, minPerGame: 24.8,
    ptsPerMin: 0.435, rebPerMin: 0.153, astPerMin: 0.073,
    ptsPerGame: 10.8, rebPerGame: 3.8, astPerGame: 1.8,
  },
  'caris levert': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.192, minPerGame: 22.8,
    ptsPerMin: 0.500, rebPerMin: 0.140, astPerMin: 0.123,
    ptsPerGame: 11.4, rebPerGame: 3.2, astPerGame: 2.8,
  },
  'georges niang': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 22.4,
    ptsPerMin: 0.393, rebPerMin: 0.188, astPerMin: 0.067,
    ptsPerGame: 8.8, rebPerGame: 4.2, astPerGame: 1.5,
  },
  // Denver Nuggets
  'michael porter jr': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.232, minPerGame: 30.8,
    ptsPerMin: 0.532, rebPerMin: 0.253, astPerMin: 0.065,
    ptsPerGame: 16.4, rebPerGame: 7.8, astPerGame: 2.0,
  },
  'aaron gordon': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.178, minPerGame: 29.4,
    ptsPerMin: 0.503, rebPerMin: 0.231, astPerMin: 0.109,
    ptsPerGame: 14.8, rebPerGame: 6.8, astPerGame: 3.2,
  },
  'kentavious caldwell-pope': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 28.4,
    ptsPerMin: 0.451, rebPerMin: 0.134, astPerMin: 0.063,
    ptsPerGame: 12.8, rebPerGame: 3.8, astPerGame: 1.8,
  },
  'reggie jackson': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.162, minPerGame: 18.4,
    ptsPerMin: 0.457, rebPerMin: 0.098, astPerMin: 0.174,
    ptsPerGame: 8.4, rebPerGame: 1.8, astPerGame: 3.2,
  },
  'christian braun': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.158, minPerGame: 22.8,
    ptsPerMin: 0.491, rebPerMin: 0.193, astPerMin: 0.070,
    ptsPerGame: 11.2, rebPerGame: 4.4, astPerGame: 1.6,
  },
  'peyton watson': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.118, minPerGame: 17.8,
    ptsPerMin: 0.303, rebPerMin: 0.163, astPerMin: 0.056,
    ptsPerGame: 5.4, rebPerGame: 2.9, astPerGame: 1.0,
  },
  // Portland Trail Blazers
  'anfernee simons': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.268, minPerGame: 33.8,
    ptsPerMin: 0.675, rebPerMin: 0.095, astPerMin: 0.142,
    ptsPerGame: 22.8, rebPerGame: 3.2, astPerGame: 4.8,
  },
  'jerami grant': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.238, minPerGame: 30.8,
    ptsPerMin: 0.578, rebPerMin: 0.136, astPerMin: 0.084,
    ptsPerGame: 17.8, rebPerGame: 4.2, astPerGame: 2.6,
  },
  'shaedon sharpe': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.228, minPerGame: 30.4,
    ptsPerMin: 0.539, rebPerMin: 0.125, astPerMin: 0.079,
    ptsPerGame: 16.4, rebPerGame: 3.8, astPerGame: 2.4,
  },
  'toumani camara': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.158, minPerGame: 24.8,
    ptsPerMin: 0.435, rebPerMin: 0.210, astPerMin: 0.085,
    ptsPerGame: 10.8, rebPerGame: 5.2, astPerGame: 2.1,
  },
  'jabari walker': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 20.8,
    ptsPerMin: 0.404, rebPerMin: 0.279, astPerMin: 0.058,
    ptsPerGame: 8.4, rebPerGame: 5.8, astPerGame: 1.2,
  },
  'malcolm brogdon': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 24.8,
    ptsPerMin: 0.540, rebPerMin: 0.169, astPerMin: 0.194,
    ptsPerGame: 13.4, rebPerGame: 4.2, astPerGame: 4.8,
  },
  'matisse thybulle': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.098, minPerGame: 18.4,
    ptsPerMin: 0.457, rebPerMin: 0.152, astPerMin: 0.054,
    ptsPerGame: 8.4, rebPerGame: 2.8, astPerGame: 1.0,
  },
  'deandre ayton': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.192, minPerGame: 27.4,
    ptsPerMin: 0.504, rebPerMin: 0.336, astPerMin: 0.073,
    ptsPerGame: 13.8, rebPerGame: 9.2, astPerGame: 2.0,
  },
  'robert williams iii': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.115, minPerGame: 18.2,
    ptsPerMin: 0.341, rebPerMin: 0.341, astPerMin: 0.055,
    ptsPerGame: 6.2, rebPerGame: 6.2, astPerGame: 1.0,
  },
  // Phoenix Suns
  'bradley beal': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.248, minPerGame: 30.4,
    ptsPerMin: 0.599, rebPerMin: 0.145, astPerMin: 0.171,
    ptsPerGame: 18.2, rebPerGame: 4.4, astPerGame: 5.2,
  },
  'eric gordon': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 24.8,
    ptsPerMin: 0.573, rebPerMin: 0.121, astPerMin: 0.073,
    ptsPerGame: 14.2, rebPerGame: 3.0, astPerGame: 1.8,
  },
  'jusuf nurkic': {
    sport: 'NBA', type: 'Ball Hog Team Player',
    usageRate: 0.185, minPerGame: 26.4,
    ptsPerMin: 0.447, rebPerMin: 0.352, astPerMin: 0.098,
    ptsPerGame: 11.8, rebPerGame: 9.3, astPerGame: 2.6,
  },
  // San Antonio Spurs
  'tre jones': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.168, minPerGame: 28.4,
    ptsPerMin: 0.394, rebPerMin: 0.085, astPerMin: 0.218,
    ptsPerGame: 11.2, rebPerGame: 2.4, astPerGame: 6.2,
  },
  'jeremy sochan': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.192, minPerGame: 30.8,
    ptsPerMin: 0.448, rebPerMin: 0.175, astPerMin: 0.169,
    ptsPerGame: 13.8, rebPerGame: 5.4, astPerGame: 5.2,
  },
  'keldon johnson': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.192, minPerGame: 28.4,
    ptsPerMin: 0.472, rebPerMin: 0.183, astPerMin: 0.077,
    ptsPerGame: 13.4, rebPerGame: 5.2, astPerGame: 2.2,
  },
  'devin vassell': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.222, minPerGame: 28.8,
    ptsPerMin: 0.618, rebPerMin: 0.118, astPerMin: 0.097,
    ptsPerGame: 17.8, rebPerGame: 3.4, astPerGame: 2.8,
  },
  'malaki branham': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.178, minPerGame: 22.8,
    ptsPerMin: 0.456, rebPerMin: 0.114, astPerMin: 0.061,
    ptsPerGame: 10.4, rebPerGame: 2.6, astPerGame: 1.4,
  },
  'devonte graham': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.168, minPerGame: 20.8,
    ptsPerMin: 0.394, rebPerMin: 0.101, astPerMin: 0.159,
    ptsPerGame: 8.2, rebPerGame: 2.1, astPerGame: 3.3,
  },
  // Atlanta Hawks
  'jalen johnson': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.242, minPerGame: 32.4,
    ptsPerMin: 0.574, rebPerMin: 0.272, astPerMin: 0.148,
    ptsPerGame: 18.6, rebPerGame: 8.8, astPerGame: 4.8,
  },
  'dejounte murray': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.242, minPerGame: 33.8,
    ptsPerMin: 0.544, rebPerMin: 0.166, astPerMin: 0.172,
    ptsPerGame: 18.4, rebPerGame: 5.6, astPerGame: 5.8,
  },
  'clint capela': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.148, minPerGame: 26.4,
    ptsPerMin: 0.470, rebPerMin: 0.424, astPerMin: 0.038,
    ptsPerGame: 12.4, rebPerGame: 11.2, astPerGame: 1.0,
  },
  'deandre hunter': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 30.4,
    ptsPerMin: 0.539, rebPerMin: 0.158, astPerMin: 0.066,
    ptsPerGame: 16.4, rebPerGame: 4.8, astPerGame: 2.0,
  },
  'bogdan bogdanovic': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 24.8,
    ptsPerMin: 0.540, rebPerMin: 0.129, astPerMin: 0.113,
    ptsPerGame: 13.4, rebPerGame: 3.2, astPerGame: 2.8,
  },
  'saddiq bey': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.172, minPerGame: 24.8,
    ptsPerMin: 0.452, rebPerMin: 0.194, astPerMin: 0.073,
    ptsPerGame: 11.2, rebPerGame: 4.8, astPerGame: 1.8,
  },
  'vit krejci': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.138, minPerGame: 18.4,
    ptsPerMin: 0.402, rebPerMin: 0.152, astPerMin: 0.130,
    ptsPerGame: 7.4, rebPerGame: 2.8, astPerGame: 2.4,
  },
  // Houston Rockets
  'fred vanvleet': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.228, minPerGame: 32.4,
    ptsPerMin: 0.488, rebPerMin: 0.099, astPerMin: 0.179,
    ptsPerGame: 15.8, rebPerGame: 3.2, astPerGame: 5.8,
  },
  'jabari smith jr': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.188, minPerGame: 28.4,
    ptsPerMin: 0.472, rebPerMin: 0.275, astPerMin: 0.070,
    ptsPerGame: 13.4, rebPerGame: 7.8, astPerGame: 2.0,
  },
  'tyty washington': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.192, minPerGame: 24.8,
    ptsPerMin: 0.532, rebPerMin: 0.113, astPerMin: 0.218,
    ptsPerGame: 13.2, rebPerGame: 2.8, astPerGame: 5.4,
  },
  'cam whitmore': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 22.8,
    ptsPerMin: 0.500, rebPerMin: 0.167, astPerMin: 0.061,
    ptsPerGame: 11.4, rebPerGame: 3.8, astPerGame: 1.4,
  },
  'dillon brooks': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.198, minPerGame: 28.4,
    ptsPerMin: 0.472, rebPerMin: 0.134, astPerMin: 0.077,
    ptsPerGame: 13.4, rebPerGame: 3.8, astPerGame: 2.2,
  },
  'jae sean tate': {
    sport: 'NBA', type: 'Backup/Reserve',
    usageRate: 0.148, minPerGame: 22.4,
    ptsPerMin: 0.348, rebPerMin: 0.183, astPerMin: 0.098,
    ptsPerGame: 7.8, rebPerGame: 4.1, astPerGame: 2.2,
  },
  // New Orleans Pelicans
  'cj mccollum': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.252, minPerGame: 30.8,
    ptsPerMin: 0.565, rebPerMin: 0.110, astPerMin: 0.117,
    ptsPerGame: 17.4, rebPerGame: 3.4, astPerGame: 3.6,
  },
  'trey murphy iii': {
    sport: 'NBA', type: 'Star/Volume Scorer',
    usageRate: 0.218, minPerGame: 30.2,
    ptsPerMin: 0.656, rebPerMin: 0.146, astPerMin: 0.073,
    ptsPerGame: 19.8, rebPerGame: 4.4, astPerGame: 2.2,
  },
  'herbert jones': {
    sport: 'NBA', type: 'Role Player/Low Usage',
    usageRate: 0.132, minPerGame: 26.4,
    ptsPerMin: 0.348, rebPerMin: 0.144, astPerMin: 0.079,
    ptsPerGame: 9.2, rebPerGame: 3.8, astPerGame: 2.1,
  },

  // MLB additions
  'fernando tatis jr': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.282, ops: 0.898, slg: 0.518, obp: 0.380,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.435, kRate: 0.248,
  },
  'mike trout': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.278, ops: 0.918, slg: 0.512, obp: 0.406,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.458, kRate: 0.328,
  },
  'bryce harper': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.285, ops: 0.942, slg: 0.522, obp: 0.420,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.422, kRate: 0.218,
  },
  'cody bellinger': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.818, slg: 0.452, obp: 0.366,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.392, kRate: 0.198,
  },
  'ha-seong kim': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.752, slg: 0.398, obp: 0.354,
    battingOrder: 6, paPerGame: 4.1,
    hardHitRate: 0.348, kRate: 0.188,
  },
  'gunnar henderson': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.281, ops: 0.892, slg: 0.512, obp: 0.380,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.418, kRate: 0.238,
  },
  'jackson holliday': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.255, ops: 0.758, slg: 0.398, obp: 0.360,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.358, kRate: 0.218,
  },
  'adley rutschman': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.832, slg: 0.432, obp: 0.400,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.378, kRate: 0.168,
  },
  'jazz chisholm jr': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.265, ops: 0.832, slg: 0.472, obp: 0.360,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.402, kRate: 0.278,
  },
  'jose ramirez': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.282, ops: 0.878, slg: 0.488, obp: 0.390,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.408, kRate: 0.128,
  },
  'matt olson': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.258, ops: 0.852, slg: 0.498, obp: 0.354,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.432, kRate: 0.268,
  },
  'william contreras': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.798, slg: 0.432, obp: 0.366,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.368, kRate: 0.198,
  },
  'michael harris ii': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.798, slg: 0.442, obp: 0.356,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.388, kRate: 0.218,
  },
  'kyle schwarber': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.245, ops: 0.862, slg: 0.502, obp: 0.360,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.445, kRate: 0.318,
  },
  'tanner bibee': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },

  // ── MLB expansion ─────────────────────────────────────────
  // Pitchers (as batters — NL or two-way context)
  'gerrit cole': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.082, ops: 0.280, slg: 0.098, obp: 0.182,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.120, kRate: 0.480,
  },
  'zack wheeler': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.098, ops: 0.310, slg: 0.118, obp: 0.192,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.130, kRate: 0.440,
  },
  'corbin burnes': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.088, ops: 0.295, slg: 0.105, obp: 0.190,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.125, kRate: 0.450,
  },
  'tarik skubal': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'logan webb': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.098, ops: 0.312, slg: 0.112, obp: 0.200,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.118, kRate: 0.428,
  },
  'spencer strider': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'shane mcclanahan': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'blake snell': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.068, ops: 0.245, slg: 0.082, obp: 0.178,
    battingOrder: 9, paPerGame: 2.2,
    hardHitRate: 0.108, kRate: 0.512,
  },
  'sandy alcantara': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.102, ops: 0.318, slg: 0.118, obp: 0.216,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.115, kRate: 0.418,
  },
  'dylan cease': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'kevin gausman': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.108, ops: 0.322, slg: 0.122, obp: 0.200,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.128, kRate: 0.432,
  },
  'max fried': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.118, ops: 0.340, slg: 0.138, obp: 0.222,
    battingOrder: 9, paPerGame: 2.4,
    hardHitRate: 0.132, kRate: 0.408,
  },
  'tyler glasnow': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'freddy peralta': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'luis castillo': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'pablo lopez': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'chris sale': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0.062, ops: 0.215, slg: 0.075, obp: 0.153,
    battingOrder: 9, paPerGame: 2.2,
    hardHitRate: 0.105, kRate: 0.495,
  },
  'sonny gray': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'hunter brown': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'joe ryan': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'george kirby': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'logan gilbert': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'framber valdez': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'brandon pfaadt': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'cole ragans': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'seth lugo': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'ryan helsley': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'emmanuel clase': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'felix bautista': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'josh hader': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'paul sewald': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'andrés muñoz': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },

  // Catchers
  'jt realmuto': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.762, slg: 0.408, obp: 0.354,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.382, kRate: 0.218,
  },
  'will smith': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.798, slg: 0.432, obp: 0.366,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.372, kRate: 0.228,
  },
  'cal raleigh': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.222, ops: 0.778, slg: 0.472, obp: 0.306,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.412, kRate: 0.298,
  },
  'sean murphy': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.254, ops: 0.768, slg: 0.432, obp: 0.336,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.378, kRate: 0.248,
  },
  'gabriel moreno': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.272, ops: 0.762, slg: 0.398, obp: 0.364,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.348, kRate: 0.178,
  },
  'patrick bailey': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.718, slg: 0.372, obp: 0.346,
    battingOrder: 8, paPerGame: 3.8,
    hardHitRate: 0.332, kRate: 0.188,
  },
  'ryan jeffers': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.252, ops: 0.758, slg: 0.418, obp: 0.340,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.362, kRate: 0.258,
  },
  'logan o\'hoppe': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.748, slg: 0.412, obp: 0.336,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.358, kRate: 0.248,
  },
  'elias diaz': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.768, slg: 0.418, obp: 0.350,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.352, kRate: 0.218,
  },
  'jonah heim': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.718, slg: 0.378, obp: 0.340,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.342, kRate: 0.228,
  },

  // First Basemen
  'spencer torkelson': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.252, ops: 0.798, slg: 0.458, obp: 0.340,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.418, kRate: 0.258,
  },
  'CJ abrams': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.812, slg: 0.448, obp: 0.364,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.368, kRate: 0.218,
  },
  'cj abrams': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.812, slg: 0.448, obp: 0.364,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.368, kRate: 0.218,
  },
  'christian walker': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.252, ops: 0.798, slg: 0.472, obp: 0.326,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.428, kRate: 0.268,
  },
  'triston casas': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.248, ops: 0.812, slg: 0.462, obp: 0.350,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.412, kRate: 0.278,
  },
  'nathaniel lowe': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.278, ops: 0.812, slg: 0.428, obp: 0.384,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.372, kRate: 0.178,
  },
  'ryan mountcastle': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.782, slg: 0.448, obp: 0.334,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.388, kRate: 0.238,
  },
  'ty france': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.752, slg: 0.388, obp: 0.364,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.348, kRate: 0.158,
  },
  'josh bell': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.758, slg: 0.412, obp: 0.346,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.368, kRate: 0.228,
  },
  'yainer diaz': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.772, slg: 0.432, obp: 0.340,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.362, kRate: 0.188,
  },

  // Second Basemen / Shortstops
  'elly de la cruz': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.262, ops: 0.822, slg: 0.478, obp: 0.344,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.418, kRate: 0.318,
  },
  'francisco lindor': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.268, ops: 0.818, slg: 0.452, obp: 0.366,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.388, kRate: 0.198,
  },
  'bobby witt jr': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.332, ops: 0.948, slg: 0.588, obp: 0.360,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.432, kRate: 0.218,
  },
  'manny machado': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.842, slg: 0.472, obp: 0.370,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.392, kRate: 0.168,
  },
  'alex bregman': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.268, ops: 0.832, slg: 0.442, obp: 0.390,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.378, kRate: 0.148,
  },
  'willy adames': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.808, slg: 0.462, obp: 0.346,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.388, kRate: 0.268,
  },
  'jp crawford': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.762, slg: 0.378, obp: 0.384,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.322, kRate: 0.178,
  },
  'dansby swanson': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.252, ops: 0.738, slg: 0.398, obp: 0.340,
    battingOrder: 6, paPerGame: 4.1,
    hardHitRate: 0.358, kRate: 0.238,
  },
  'carlos correa': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.265, ops: 0.802, slg: 0.432, obp: 0.370,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.372, kRate: 0.198,
  },
  'marcus semien': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.262, ops: 0.782, slg: 0.422, obp: 0.360,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.358, kRate: 0.198,
  },
  'gleyber torres': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.255, ops: 0.748, slg: 0.402, obp: 0.346,
    battingOrder: 6, paPerGame: 4.1,
    hardHitRate: 0.348, kRate: 0.218,
  },
  'ketel marte': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.288, ops: 0.858, slg: 0.468, obp: 0.390,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.398, kRate: 0.168,
  },
  'ozzie albies': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.275, ops: 0.828, slg: 0.468, obp: 0.360,
    battingOrder: 2, paPerGame: 4.5,
    hardHitRate: 0.388, kRate: 0.218,
  },
  'brendan donovan': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.275, ops: 0.782, slg: 0.398, obp: 0.384,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.342, kRate: 0.148,
  },
  'gavin lux': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.762, slg: 0.388, obp: 0.374,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.338, kRate: 0.178,
  },
  'luis arraez': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.314, ops: 0.808, slg: 0.388, obp: 0.420,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.292, kRate: 0.068,
  },
  'ha-seong kim': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.752, slg: 0.398, obp: 0.354,
    battingOrder: 6, paPerGame: 4.1,
    hardHitRate: 0.348, kRate: 0.188,
  },
  'matt mclain': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.265, ops: 0.792, slg: 0.432, obp: 0.360,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.368, kRate: 0.228,
  },
  'royce lewis': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.282, ops: 0.882, slg: 0.512, obp: 0.370,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.418, kRate: 0.248,
  },
  'nico hoerner': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.282, ops: 0.758, slg: 0.382, obp: 0.376,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.322, kRate: 0.118,
  },
  'ryan mcmahon': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.758, slg: 0.422, obp: 0.336,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.368, kRate: 0.268,
  },

  // Third Basemen / Outfielders / DH
  'aaron judge': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.322, ops: 1.059, slg: 0.702, obp: 0.457,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.512, kRate: 0.278,
  },
  'freddie freeman': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.302, ops: 0.912, slg: 0.512, obp: 0.400,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.398, kRate: 0.162,
  },
  'christian yelich': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.285, ops: 0.872, slg: 0.478, obp: 0.394,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.388, kRate: 0.228,
  },
  'marcell ozuna': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.268, ops: 0.878, slg: 0.518, obp: 0.360,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.432, kRate: 0.268,
  },
  'jose abreu': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.252, ops: 0.762, slg: 0.432, obp: 0.330,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.398, kRate: 0.208,
  },
  'nick castellanos': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.782, slg: 0.448, obp: 0.334,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.392, kRate: 0.238,
  },
  'tyler o\'neill': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.258, ops: 0.812, slg: 0.478, obp: 0.334,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.428, kRate: 0.288,
  },
  'steven kwan': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.289, ops: 0.818, slg: 0.418, obp: 0.400,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.338, kRate: 0.108,
  },
  'teoscar hernandez': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.272, ops: 0.842, slg: 0.488, obp: 0.354,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.418, kRate: 0.278,
  },
  'taylor ward': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.265, ops: 0.812, slg: 0.462, obp: 0.350,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.398, kRate: 0.218,
  },
  'ian happ': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.782, slg: 0.432, obp: 0.350,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.378, kRate: 0.248,
  },
  'chas mccormick': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.252, ops: 0.768, slg: 0.428, obp: 0.340,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.368, kRate: 0.248,
  },
  'mark canha': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.752, slg: 0.388, obp: 0.364,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.338, kRate: 0.198,
  },
  'grayson rodriguez': {
    sport: 'MLB', type: 'Pitcher',
    avg: 0, ops: 0, slg: 0, obp: 0,
    battingOrder: 9, paPerGame: 0,
    hardHitRate: 0, kRate: 0,
  },
  'joc pederson': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.248, ops: 0.818, slg: 0.482, obp: 0.336,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.422, kRate: 0.278,
  },
  'lars nootbaar': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.802, slg: 0.438, obp: 0.364,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.368, kRate: 0.228,
  },
  'eloy jimenez': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.268, ops: 0.828, slg: 0.488, obp: 0.340,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.432, kRate: 0.258,
  },
  'tommy edman': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.748, slg: 0.388, obp: 0.360,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.342, kRate: 0.178,
  },
  'nick senzel': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.252, ops: 0.728, slg: 0.368, obp: 0.360,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.332, kRate: 0.218,
  },
  'george springer': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.272, ops: 0.828, slg: 0.468, obp: 0.360,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.398, kRate: 0.228,
  },
  'whit merrifield': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.718, slg: 0.368, obp: 0.350,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.318, kRate: 0.148,
  },
  'lourdes gurriel jr': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.265, ops: 0.772, slg: 0.432, obp: 0.340,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.372, kRate: 0.198,
  },
  'jake cronenworth': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.255, ops: 0.748, slg: 0.398, obp: 0.350,
    battingOrder: 6, paPerGame: 4.1,
    hardHitRate: 0.348, kRate: 0.188,
  },
  'thairo estrada': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.738, slg: 0.398, obp: 0.340,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.342, kRate: 0.198,
  },
  'david peralta': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.252, ops: 0.728, slg: 0.388, obp: 0.340,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.338, kRate: 0.208,
  },
  'hunter renfroe': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.248, ops: 0.778, slg: 0.468, obp: 0.310,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.412, kRate: 0.298,
  },
  'eddie rosario': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.762, slg: 0.428, obp: 0.334,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.368, kRate: 0.218,
  },
  'jorge soler': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.248, ops: 0.828, slg: 0.498, obp: 0.330,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.438, kRate: 0.308,
  },
  'andrew mccutchen': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.778, slg: 0.418, obp: 0.360,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.368, kRate: 0.218,
  },
  'michael brantley': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.758, slg: 0.392, obp: 0.366,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.348, kRate: 0.138,
  },
  'bryan reynolds': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.282, ops: 0.852, slg: 0.468, obp: 0.384,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.398, kRate: 0.198,
  },
  'jackson merrill': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.275, ops: 0.812, slg: 0.448, obp: 0.364,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.382, kRate: 0.198,
  },
  'tyler stephenson': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.265, ops: 0.778, slg: 0.418, obp: 0.360,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.358, kRate: 0.198,
  },
  'riley greene': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.278, ops: 0.852, slg: 0.478, obp: 0.374,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.398, kRate: 0.228,
  },
  'jake mccarthy': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.255, ops: 0.722, slg: 0.368, obp: 0.354,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.328, kRate: 0.188,
  },
  'cavan biggio': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.238, ops: 0.742, slg: 0.378, obp: 0.364,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.318, kRate: 0.218,
  },
  'hunter dozier': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.748, slg: 0.418, obp: 0.330,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.372, kRate: 0.248,
  },
  'nick ahmed': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.238, ops: 0.672, slg: 0.358, obp: 0.314,
    battingOrder: 8, paPerGame: 3.8,
    hardHitRate: 0.308, kRate: 0.218,
  },
  'luis robert jr': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.265, ops: 0.812, slg: 0.478, obp: 0.334,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.432, kRate: 0.268,
  },
  'jarren duran': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.282, ops: 0.842, slg: 0.488, obp: 0.354,
    battingOrder: 1, paPerGame: 4.6,
    hardHitRate: 0.402, kRate: 0.228,
  },
  'wilyer abreu': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.265, ops: 0.778, slg: 0.428, obp: 0.350,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.358, kRate: 0.228,
  },
  'masyn winn': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.268, ops: 0.748, slg: 0.388, obp: 0.360,
    battingOrder: 9, paPerGame: 3.8,
    hardHitRate: 0.328, kRate: 0.188,
  },
  'nolan gorman': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.245, ops: 0.788, slg: 0.472, obp: 0.316,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.418, kRate: 0.308,
  },
  'paul goldschmidt': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.268, ops: 0.842, slg: 0.468, obp: 0.374,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.388, kRate: 0.202,
  },
  'alec burleson': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.778, slg: 0.442, obp: 0.336,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.378, kRate: 0.228,
  },
  'pete crow-armstrong': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.762, slg: 0.418, obp: 0.344,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.358, kRate: 0.228,
  },
  'seiya suzuki': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.285, ops: 0.858, slg: 0.472, obp: 0.386,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.392, kRate: 0.208,
  },
  'christopher morel': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.245, ops: 0.778, slg: 0.458, obp: 0.320,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.408, kRate: 0.288,
  },
  'michael conforto': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.802, slg: 0.448, obp: 0.354,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.378, kRate: 0.238,
  },
  'jd martinez': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.258, ops: 0.802, slg: 0.462, obp: 0.340,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.412, kRate: 0.238,
  },
  'luke raley': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.248, ops: 0.778, slg: 0.448, obp: 0.330,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.398, kRate: 0.268,
  },
  'randal grichuk': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.252, ops: 0.748, slg: 0.428, obp: 0.320,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.378, kRate: 0.258,
  },
  'dj lemahieu': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.262, ops: 0.748, slg: 0.382, obp: 0.366,
    battingOrder: 2, paPerGame: 4.4,
    hardHitRate: 0.318, kRate: 0.148,
  },
  'isiah kiner-falefa': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.712, slg: 0.358, obp: 0.354,
    battingOrder: 9, paPerGame: 3.8,
    hardHitRate: 0.302, kRate: 0.158,
  },
  'giancarlo stanton': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.248, ops: 0.862, slg: 0.532, obp: 0.330,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.472, kRate: 0.298,
  },
  'travis d arnaud': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.768, slg: 0.422, obp: 0.346,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.362, kRate: 0.208,
  },
  'colton cowser': {
    sport: 'MLB', type: 'Star Hitter',
    avg: 0.275, ops: 0.848, slg: 0.488, obp: 0.360,
    battingOrder: 5, paPerGame: 4.1,
    hardHitRate: 0.402, kRate: 0.248,
  },
  'cedric mullins': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.265, ops: 0.768, slg: 0.418, obp: 0.350,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.352, kRate: 0.208,
  },
  'tyler black': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.258, ops: 0.762, slg: 0.398, obp: 0.364,
    battingOrder: 1, paPerGame: 4.5,
    hardHitRate: 0.342, kRate: 0.198,
  },
  'jose siri': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.748, slg: 0.418, obp: 0.330,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.368, kRate: 0.298,
  },
  'isaac paredes': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.255, ops: 0.812, slg: 0.472, obp: 0.340,
    battingOrder: 4, paPerGame: 4.2,
    hardHitRate: 0.398, kRate: 0.218,
  },
  'yandy diaz': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.278, ops: 0.808, slg: 0.398, obp: 0.410,
    battingOrder: 3, paPerGame: 4.3,
    hardHitRate: 0.358, kRate: 0.128,
  },
  'christopher morel': {
    sport: 'MLB', type: 'Power Hitter',
    avg: 0.245, ops: 0.778, slg: 0.458, obp: 0.320,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.408, kRate: 0.288,
  },
  'evan longoria': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.238, ops: 0.718, slg: 0.398, obp: 0.320,
    battingOrder: 6, paPerGame: 4.0,
    hardHitRate: 0.358, kRate: 0.248,
  },
  'kolten wong': {
    sport: 'MLB', type: 'Average Hitter',
    avg: 0.248, ops: 0.722, slg: 0.362, obp: 0.360,
    battingOrder: 7, paPerGame: 4.0,
    hardHitRate: 0.318, kRate: 0.178,
  },
};

// ── Name aliases (nicknames → canonical names) ────────────
const nameAliases = {
  // NBA nicknames
  'wemby':      'victor wembanyama',
  'bron':       'lebron james',
  'king james': 'lebron james',
  'steph':      'stephen curry',
  'chef curry': 'stephen curry',
  'dame':       'damian lillard',
  'ant':        'anthony edwards',
  'ant man':    'anthony edwards',
  'sga':        'shai gilgeous-alexander',
  'kt':         'karl-anthony towns',
  'zion':       'zion williamson',
  'ja':         'ja morant',
  'melo':       'lamelo ball',
  'trae':       'trae young',
  'obi':        'og anunoby',
  'kd':         'kevin durant',
  'pg':         'paul george',
  'pg13':       'paul george',
  'jjj':        'jaren jackson jr',
  'chet':       'chet holmgren',
  'cp3':        'chris paul',
  'jokic':      'nikola jokic',
  'joker':      'nikola jokic',
  'giannis':    'giannis antetokounmpo',
  'greek freak':'giannis antetokounmpo',
  'luka':       'luka doncic',
  'jt':         'jayson tatum',
  'ant edwards':'anthony edwards',
  'wemby':      'victor wembanyama',
  'banchero':   'paolo banchero',
  'cade':       'cade cunningham',
  'brunson':    'jalen brunson',
  'herro':      'tyler herro',
  'fox':        'deaaron fox',
  'sabonis':    'domantas sabonis',
  'embiid':     'joel embiid',
  'harden':     'james harden',
  'maxey':      'tyrese maxey',
  'tatum':      'jayson tatum',
  'jbrown':     'jaylen brown',
  'dame time':  'damian lillard',
  'donovan':    'donovan mitchell',
  'mitchell':   'donovan mitchell',
  'lavine':     'zach lavine',
  'randle':     'julius randle',
  'siakam':     'pascal siakam',

  // MLB nicknames
  'judge':      'aaron judge',
  'ohtani':     'shohei ohtani',
  'soto':       'juan soto',
  'vlad':       'vladimir guerrero jr',
  'vlad jr':    'vladimir guerrero jr',
  'acuna':      'ronald acuna jr',
  'betts':      'mookie betts',
  'freeman':    'freddie freeman',
  'yordan':     'yordan alvarez',
  'seager':     'corey seager',
  'julio':      'julio rodriguez',
  'tatis':      'fernando tatis jr',
  'trout':      'mike trout',
  'harper':     'bryce harper',
  'devers':     'rafael devers',
  'altuve':     'jose altuve',
  'jose ram':   'jose ramirez',
  'ramirez':    'jose ramirez',
  'tucker':     'kyle tucker',
  'bobby witt': 'bobby witt jr',
  'witt':       'bobby witt jr',
  'lindor':     'francisco lindor',
  'machado':    'manny machado',
  'bregman':    'alex bregman',
  'goldy':      'paul goldschmidt',
  'nado':       'nolan arenado',
  'riley':      'austin riley',
  'adames':     'willy adames',
  'arraez':     'luis arraez',
  'schwarber':  'kyle schwarber',
  'alonso':     'pete alonso',
  'correa':     'carlos correa',
  'jrod':       'julio rodriguez',
  'skubal':     'tarik skubal',
  'strider':    'spencer strider',
  'cole':       'gerrit cole',
  'wheeler':    'zack wheeler',
  'burnes':     'corbin burnes',
  'snell':      'blake snell',
  'skenes':     'paul skenes',
  'bibee':      'tanner bibee',
  'helsley':    'ryan helsley',
  'clase':      'emmanuel clase',
  'hader':      'josh hader',
  'realmuto':   'jt realmuto',
  'raleigh':    'cal raleigh',
  'adley':      'adley rutschman',
  'gunnar':     'gunnar henderson',
  'elly':       'elly de la cruz',
  'jazz':       'jazz chisholm jr',
  'olson':      'matt olson',
  'harris':     'michael harris ii',
  'springer':   'george springer',
  'yelich':     'christian yelich',
  'stanton':    'giancarlo stanton',
  'judge 99':   'aaron judge',
  'vladdy':     'vladimir guerrero jr',
};

function resolvePlayerName(name) {
  const lower = name.toLowerCase().trim();
  return nameAliases[lower] || lower;
}

// ── MATH ENGINE ──────────────────────────────────────────

// Model 2: Poisson probability P(X >= needed)
function poissonProb(lambda, needed) {
  if (lambda <= 0) return needed <= 0 ? 1 : 0;
  if (needed <= 0) return 1;
  let cumulative = 0;
  const maxK = Math.min(Math.floor(needed) - 1, 50);
  for (let k = 0; k <= maxK; k++) {
    let term = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) term *= lambda / i;
    cumulative += term;
  }
  return Math.max(0, Math.min(1, 1 - cumulative));
}

// Model 3: Game state multipliers
function gameStateMultiplier(differential, period, isOT) {
  const absDiff = Math.abs(differential);
  const periodNum = isOT ? 5 : period;

  const blowout = absDiff >= 20 ? 0.50 :
                  absDiff >= 15 ? 0.68 :
                  absDiff >= 10 ? 0.82 :
                  absDiff >= 6  ? 0.92 : 1.0;

  const closeGame = absDiff <= 3 && periodNum >= 3 ? 1.12 :
                    absDiff <= 5 && periodNum >= 3 ? 1.06 : 1.0;

  const fourthQ = periodNum === 4 && absDiff <= 5 ? 1.08 : 1.0;

  return { blowout, closeGame, fourthQ, combined: blowout * closeGame * fourthQ };
}

// Model 4: Hot hand momentum
function hotHandMultiplier(currentStat, minutesPlayed, seasonRate, gameWeight) {
  if (minutesPlayed < 4) return 1.0;
  const observedRate = currentStat / minutesPlayed;
  const cv = 0.30;
  const zScore = (observedRate - seasonRate) / (seasonRate * cv + 0.001);
  const clamped = Math.max(-2, Math.min(2, zScore));
  const momentum = 1 + (clamped * 0.06 * gameWeight);
  return Math.max(0.88, Math.min(1.12, momentum));
}

// Model 5: Defensive rating adjustment
function defRatingAdjustment(oppDefRating) {
  if (!oppDefRating) return 1.0;
  const leagueAvg = 112.5;
  const raw = leagueAvg / oppDefRating;
  return Math.max(0.88, Math.min(1.12, 2 - raw));
}

// Model 6: Pace projection for game totals
function paceProjection(homeScore, awayScore, minutesPlayed, minutesRemaining, differential) {
  const totalPoints = homeScore + awayScore;
  if (minutesPlayed < 2) return null;
  const currentPace = totalPoints / minutesPlayed;
  const blowoutDampener = Math.abs(differential) >= 15 ? 0.80 :
                          Math.abs(differential) >= 10 ? 0.90 : 1.0;
  const projectedFinal = totalPoints + (currentPace * minutesRemaining * blowoutDampener);
  return {
    currentPace: parseFloat(currentPace.toFixed(2)),
    projectedFinal: parseFloat(projectedFinal.toFixed(1)),
    totalSoFar: totalPoints,
    minutesRemaining: parseFloat(minutesRemaining.toFixed(1))
  };
}

// Model 7: Alt line EV scanner
function altLineEV(trueProb, bookOdds) {
  const bookProb = bookOdds < 0
    ? Math.abs(bookOdds) / (Math.abs(bookOdds) + 100)
    : 100 / (bookOdds + 100);
  const netPayout = bookOdds > 0 ? bookOdds : 10000 / Math.abs(bookOdds);
  const ev = (trueProb * netPayout) - ((1 - trueProb) * 100);
  const edge = trueProb - bookProb;
  return { ev: parseFloat(ev.toFixed(2)), edge: parseFloat((edge * 100).toFixed(1)), isPositive: ev > 0 };
}

// Model 8: Quarter Kelly criterion
function kellyCriterion(trueProb, bookOdds, bankroll = 1000) {
  const netOdds = bookOdds > 0 ? bookOdds / 100 : 100 / Math.abs(bookOdds);
  const fullKelly = (trueProb * netOdds - (1 - trueProb)) / netOdds;
  const quarterKelly = Math.max(0, fullKelly * 0.25);
  return {
    edge: parseFloat((fullKelly * 100).toFixed(1)),
    unitSize: parseFloat((quarterKelly * 100).toFixed(1)),
    suggestedBet: parseFloat((bankroll * quarterKelly).toFixed(2))
  };
}

// Model 1: Bayesian blend — core of the engine
function bayesianBlend(seasonRate, currentStat, minutesPlayed, totalMinutes) {
  const gameWeight = Math.min(minutesPlayed / totalMinutes, 0.85);
  const seasonWeight = 1 - gameWeight;
  const observedRate = minutesPlayed > 0 ? currentStat / minutesPlayed : seasonRate;
  const blendedRate = (seasonWeight * seasonRate) + (gameWeight * observedRate);
  return { blendedRate, gameWeight, seasonWeight, observedRate };
}

// ── NBA analysis ──────────────────────────────────────────
function analyzeNBA({ playerName, statType, currentStat, propLine, period, timeRemaining, homeScore, awayScore, liveStats, oppDefRating }) {
  const qcMap = { Q1: 1, Q2: 2, Q3: 3, Q4: 4, OT: 5 };
  const timeRemainingMins = parseTimeRemaining(timeRemaining);
  const isOT = period === 'OT';
  const periodNum = qcMap[period] ?? 1;

  // Minutes played and remaining
  let minsPlayed, minsRemaining;
  if (isOT) {
    minsPlayed = 48 + Math.max(0, 5 - Math.min(timeRemainingMins, 5));
    minsRemaining = Math.max(0, timeRemainingMins);
  } else {
    minsPlayed = (periodNum - 1) * 12 + Math.max(0, 12 - Math.min(timeRemainingMins, 12));
    minsRemaining = Math.max(0, timeRemainingMins + (4 - periodNum) * 12);
  }

  if (minsPlayed < 0.5) {
    return { error: 'Not enough playing time. Enter time remaining.' };
  }

  const homeSc = parseFloat(homeScore) || 0;
  const awaySc = parseFloat(awayScore) || 0;
  const differential = homeSc - awaySc;
  const statLabel = statType || 'Points';
  const statTypeLower = statLabel.toLowerCase();

  // Get player data
  const dbPlayer = playerStats[resolvePlayerName(playerName)];
  let seasonRate, dataSource;

  if (dbPlayer) {
    seasonRate = statTypeLower === 'points'   ? dbPlayer.ptsPerMin :
                 statTypeLower === 'rebounds' ? dbPlayer.rebPerMin :
                 statTypeLower === 'assists'  ? dbPlayer.astPerMin :
                 dbPlayer.ptsPerMin + dbPlayer.rebPerMin + dbPlayer.astPerMin;
    dataSource = 'database';
  } else {
    seasonRate = statTypeLower === 'points'   ? 0.55 :
                 statTypeLower === 'rebounds' ? 0.18 :
                 statTypeLower === 'assists'  ? 0.14 : 0.87;
    dataSource = 'estimate';
  }

  // Model 1: Bayesian blend
  const { blendedRate, gameWeight } = bayesianBlend(seasonRate, currentStat, minsPlayed, dbPlayer?.minPerGame || 32);

  // Model 3: Game state
  const gameState = gameStateMultiplier(differential, periodNum, isOT);

  // Model 4: Hot hand
  const momentum = hotHandMultiplier(currentStat, minsPlayed, seasonRate, gameWeight);

  // Model 5: Defensive rating
  const defAdj = defRatingAdjustment(oppDefRating);

  // Final adjusted rate
  const adjustedRate = blendedRate * gameState.combined * momentum * defAdj;

  // Model 2: Poisson projection
  const needed = Math.max(0, propLine - currentStat);
  const lambda = adjustedRate * minsRemaining;
  const probability = poissonProb(lambda, needed);
  const projectedFinal = parseFloat((currentStat + adjustedRate * minsRemaining).toFixed(1));

  // Model 6: Game pace
  const pace = paceProjection(homeSc, awaySc, minsPlayed, minsRemaining, differential);

  // Model 7: Alt line EV (assume -110 as default book odds)
  const bookOdds = -110;
  const evData = altLineEV(probability, bookOdds);

  // Model 8: Kelly
  const kelly = kellyCriterion(probability, bookOdds);

  // Signals
  const signals = [];

  if (projectedFinal > propLine * 1.08) {
    signals.push({ type: 'over', text: `Projects to ${projectedFinal} — ${((projectedFinal / propLine - 1) * 100).toFixed(0)}% above the ${propLine} line` });
  } else if (projectedFinal < propLine * 0.92) {
    signals.push({ type: 'under', text: `Projects to ${projectedFinal} — ${((1 - projectedFinal / propLine) * 100).toFixed(0)}% below the ${propLine} line` });
  } else {
    signals.push({ type: 'neutral', text: `Projects to ${projectedFinal} — right on the ${propLine} line` });
  }

  if (gameState.blowout < 0.80) {
    signals.push({ type: 'under', text: `${Math.abs(differential)}-point blowout in ${period} — reduced minutes likely (${Math.round(gameState.blowout * 100)}% rate adjustment)` });
  }
  if (gameState.closeGame > 1.05) {
    signals.push({ type: 'over', text: `Close game in ${period} — star usage up (${Math.round((gameState.closeGame - 1) * 100)}% boost applied)` });
  }
  if (momentum > 1.06) {
    signals.push({ type: 'over', text: `Running hot — ${(currentStat / minsPlayed).toFixed(2)} per min vs ${seasonRate.toFixed(2)} season rate` });
  } else if (momentum < 0.94) {
    signals.push({ type: 'under', text: `Running cold — ${(currentStat / minsPlayed).toFixed(2)} per min vs ${seasonRate.toFixed(2)} season rate` });
  }
  if (minsRemaining < 8 && needed >= 6) {
    signals.push({ type: 'under', text: `Only ${minsRemaining.toFixed(1)} min left — needs ${needed.toFixed(1)} more ${statLabel.toLowerCase()}` });
  }
  if (evData.isPositive) {
    signals.push({ type: 'over', text: `+EV play — math edge of ${evData.edge}% over book's implied probability` });
  }

  // Recommendation
  let recommendation, confidence;
  if      (probability >= 0.72) { recommendation = 'STRONG OVER';  confidence = Math.round(probability * 100); }
  else if (probability >= 0.58) { recommendation = 'LEAN OVER';    confidence = Math.round(probability * 100); }
  else if (probability >= 0.42) { recommendation = 'TOSS UP';      confidence = Math.round(50 + Math.abs(probability * 100 - 50)); }
  else if (probability >= 0.28) { recommendation = 'LEAN UNDER';   confidence = Math.round((1 - probability) * 100); }
  else                          { recommendation = 'STRONG UNDER'; confidence = Math.round((1 - probability) * 100); }

  // Plain English explanation
  const explanation = [
    dataSource === 'database'
      ? `${playerName} projects to ${projectedFinal} ${statLabel.toLowerCase()} based on Bayesian blend of ${(seasonRate).toFixed(2)}/min season rate and ${(currentStat/Math.max(minsPlayed,1)).toFixed(2)}/min today (${Math.round(gameWeight*100)}% weight on today's performance).`
      : `Using league average estimates — ${playerName} projects to ${projectedFinal} ${statLabel.toLowerCase()}.`,
    `Needs ${needed.toFixed(1)} more in ${minsRemaining.toFixed(1)} min at ${(adjustedRate).toFixed(2)}/min (adjusted for game state, momentum, defense).`,
    gameState.blowout < 0.80 ? `Blowout alert: ${Math.abs(differential)}-point lead reduces projected rate by ${Math.round((1-gameState.blowout)*100)}%.` : '',
    gameState.closeGame > 1.05 ? `Close game in ${period}: star usage boosted ${Math.round((gameState.closeGame-1)*100)}%.` : '',
    momentum > 1.06 ? `Hot hand detected: running ${Math.round((momentum-1)*100)}% above season pace.` : '',
    evData.isPositive ? `Book edge: ${evData.edge}% mathematical advantage over implied probability.` : '',
  ].filter(Boolean).join(' ');

  const playerDbInfo = buildNBADbInfo(playerName, liveStats, dbPlayer, dataSource);

  return {
    sport: 'NBA',
    recommendation,
    confidence,
    probability: parseFloat((probability * 100).toFixed(1)),
    projectedFinal,
    needed: parseFloat(needed.toFixed(1)),
    minsRemaining: parseFloat(minsRemaining.toFixed(1)),
    adjustedRate: parseFloat(adjustedRate.toFixed(3)),
    signals,
    explanation,
    gameState,
    momentum: parseFloat(momentum.toFixed(3)),
    bayesian: { blendedRate: parseFloat(blendedRate.toFixed(3)), gameWeight: parseFloat(gameWeight.toFixed(2)) },
    ev: evData,
    kelly,
    pace,
    statType: statLabel,
    dataSource,
    playerDbInfo,
    models: ['bayesian', 'poisson', 'game-state', 'hot-hand', 'def-rating', 'pace', 'ev-scanner', 'kelly'],
    disclaimer: 'Projections use Bayesian + Poisson models with live game state adjustments. Bet responsibly.'
  };
}

function buildNBADbInfo(playerName, liveStats, dbPlayer, dataSource) {
  if (dataSource === 'database' && dbPlayer) {
    // liveStats may still carry BDL identity info (team) even though rates are from DB
    const teamAbbr = liveStats?.teamAbbr || '';
    const teamStr  = teamAbbr ? `${teamAbbr} | ` : '';
    return {
      found: true,
      display: `${teamStr}${dbPlayer.ptsPerGame} PPG / ${dbPlayer.rebPerGame} RPG / ${dbPlayer.astPerGame} APG | ${(dbPlayer.usageRate * 100).toFixed(1)}% usage`,
    };
  }
  return { found: false, display: 'Not in database — using league average estimates' };
}

// ── MLB analysis ──────────────────────────────────────────
function analyzeMLB({ playerName, statType, currentStat, propLine, period, halfInning, homeScore, awayScore, liveStats, oppDefRating }) {
  const inningMap = { '1st':1,'2nd':2,'3rd':3,'4th':4,'5th':5,'6th':6,'7th':7,'8th':8,'9th':9,'Extra':10 };
  const currentInning = inningMap[period] || 1;
  const isBottom = halfInning === 'Bottom';
  const statLabel = statType || 'Hits';
  const needed = Math.max(0, propLine - currentStat);

  const dbPlayer = playerStats[resolvePlayerName(playerName)];
  let baselineRate, paPerGame, battingOrder, dataSource;

  if (liveStats?.sport === 'MLB') {
    baselineRate = liveStats.avg || 0.255;
    paPerGame = liveStats.paPerGame || 4.2;
    battingOrder = dbPlayer?.battingOrder ?? null;
    if (liveStats.ops > 0.900) baselineRate *= 1.06;
    if (liveStats.strikeoutRate > 0.280) baselineRate *= 0.94;
    dataSource = 'live';
  } else if (dbPlayer) {
    baselineRate = dbPlayer.avg;
    paPerGame = dbPlayer.paPerGame || 4.2;
    battingOrder = dbPlayer.battingOrder;
    if (dbPlayer.ops > 0.900) baselineRate *= 1.08;
    else if (dbPlayer.ops < 0.700) baselineRate *= 0.88;
    if (dbPlayer.kRate > 0.280) baselineRate *= 0.94;
    else if (dbPlayer.kRate < 0.150) baselineRate *= 1.04;
    dataSource = 'database';
  } else {
    baselineRate = 0.255; paPerGame = 4.2; dataSource = 'estimate';
  }

  // Game progress
  const gameProgress = Math.min(currentInning / 9, 1);
  const blendWeight = Math.min(gameProgress * 1.5, 0.70);
  const paPerInning = paPerGame / 9;
  const estimatedPADone = Math.max(currentInning * paPerInning, 0.5);
  const observedRate = currentStat / estimatedPADone;

  // Model 1: Bayesian blend
  const blendedRate = baselineRate * (1 - blendWeight) + observedRate * blendWeight;

  // Model 4: Hot hand for MLB
  const zScore = (observedRate - baselineRate) / (baselineRate * 0.35 + 0.001);
  const hotHandMult = Math.max(0.90, Math.min(1.10, 1 + (Math.max(-2, Math.min(2, zScore)) * 0.05 * blendWeight)));
  const adjustedRate = blendedRate * hotHandMult;

  // Remaining PAs
  const halfBonus = isBottom ? paPerInning * 0.5 : 0;
  const orderBonus = battingOrder !== null ? (battingOrder <= 2 ? 0.3 : battingOrder >= 7 ? -0.2 : 0) : 0;
  const paRemaining = Math.max(paPerGame - (currentInning * paPerInning) - halfBonus + orderBonus, 0);
  const paRounded = Math.round(paRemaining * 10) / 10;

  // Model 2: Poisson for PA-based stats
  function mlbPoisson(pa, rate, n) {
    if (pa <= 0) return n <= 0 ? 1 : 0;
    const lambda = rate * pa;
    return poissonProb(lambda, n);
  }

  const probability = needed <= 0 ? 0.92 : mlbPoisson(paRemaining, adjustedRate, needed);
  const projectedFinal = parseFloat((currentStat + adjustedRate * paRemaining).toFixed(2));

  // Model 7: EV
  const evData = altLineEV(probability, -110);

  // Model 8: Kelly
  const kelly = kellyCriterion(probability, -110);

  // Model 6: Game pace
  const homeSc = parseFloat(homeScore) || 0;
  const awaySc = parseFloat(awayScore) || 0;
  const inningsPlayed = currentInning + (isBottom ? 0.5 : 0);
  const totalRuns = homeSc + awaySc;
  const pacePerInning = inningsPlayed > 0 ? totalRuns / inningsPlayed : 0;
  const projectedGameTotal = parseFloat((totalRuns + pacePerInning * (9 - inningsPlayed)).toFixed(1));

  // Signals
  const signals = [];
  if (needed <= 0) {
    signals.push({ type: 'over', text: `Already cleared the ${propLine} line — over is locked in` });
  } else {
    if (paRemaining < 0.5) {
      signals.push({ type: 'under', text: `Less than 1 PA remaining — may not bat again` });
    } else if (paRounded >= 1.5 && needed <= 1) {
      signals.push({ type: 'over', text: `${paRounded} PAs remaining with only ${needed} more needed` });
    }
    if (currentInning >= 5 && currentStat === 0 && needed >= 2) {
      signals.push({ type: 'under', text: `0 ${statLabel.toLowerCase()} through ${period} — cold bat with ${needed}+ still needed` });
    }
    if (observedRate > 0.40 && currentInning >= 3) {
      signals.push({ type: 'over', text: `Hot today — ${(observedRate * 100).toFixed(0)}% observed rate vs ${(baselineRate * 100).toFixed(0)}% season` });
    }
    if (hotHandMult > 1.05) {
      signals.push({ type: 'over', text: `Hot hand detected — blended model boosted ${Math.round((hotHandMult-1)*100)}% above baseline` });
    }
    if (evData.isPositive) {
      signals.push({ type: 'over', text: `+EV: ${evData.edge}% mathematical edge over book's implied probability` });
    }
  }

  let recommendation, confidence;
  if      (probability >= 0.72) { recommendation = 'STRONG OVER';  confidence = Math.round(probability * 100); }
  else if (probability >= 0.58) { recommendation = 'LEAN OVER';    confidence = Math.round(probability * 100); }
  else if (probability >= 0.42) { recommendation = 'TOSS UP';      confidence = Math.round(50 + Math.abs(probability * 100 - 50)); }
  else if (probability >= 0.28) { recommendation = 'LEAN UNDER';   confidence = Math.round((1 - probability) * 100); }
  else                          { recommendation = 'STRONG UNDER'; confidence = Math.round((1 - probability) * 100); }

  if (currentInning <= 5) {
    if (recommendation === 'STRONG OVER') recommendation = 'LEAN OVER';
    if (recommendation === 'STRONG UNDER') recommendation = 'LEAN UNDER';
    confidence = Math.min(confidence, 68);
  }

  const explanation = [
    dataSource === 'live' ? `Live ${new Date().getFullYear()} data: ${(baselineRate*1000/10).toFixed(1)}% avg, ${paPerGame} PA/game.` : dataSource === 'database' ? `Season data: .${(baselineRate*1000).toFixed(0)} avg, ${paPerGame} PA/game.` : 'League average estimates used.',
    `Bayesian blend rate: ${(adjustedRate*100).toFixed(1)}% (${Math.round(blendWeight*100)}% weight on today).`,
    `${paRounded} PAs estimated remaining. Needs ${needed} more to clear ${propLine}.`,
    `Projected final: ${projectedFinal}. Game total pace: ${projectedGameTotal} runs.`,
    evData.isPositive ? `Book edge: ${evData.edge}% mathematical advantage.` : '',
  ].filter(Boolean).join(' ');

  const playerDbInfo = buildMLBDbInfo(playerName, liveStats, dbPlayer, dataSource);

  return {
    sport: 'MLB',
    recommendation,
    confidence,
    probability: parseFloat((probability * 100).toFixed(1)),
    projectedFinal,
    needed: parseFloat(needed.toFixed(1)),
    estimatedPARemaining: paRounded,
    adjustedRate: parseFloat(adjustedRate.toFixed(3)),
    blendedRate: parseFloat(blendedRate.toFixed(3)),
    hotHandMultiplier: parseFloat(hotHandMult.toFixed(3)),
    signals,
    explanation,
    ev: evData,
    kelly,
    pace: { projectedGameTotal, pacePerInning: parseFloat(pacePerInning.toFixed(2)) },
    statType: statLabel,
    dataSource,
    playerDbInfo,
    models: ['bayesian', 'poisson', 'hot-hand', 'ev-scanner', 'kelly', 'pace'],
    disclaimer: 'MLB projections use Bayesian blend + Poisson models with PA estimates. Bet responsibly.'
  };
}

function buildMLBDbInfo(playerName, liveStats, dbPlayer, dataSource) {
  if (dataSource === 'live' && liveStats) {
    const team   = liveStats.teamAbbr || liveStats.team || '';
    const avg    = liveStats.avg?.toFixed(3).replace('0.', '.') || '---';
    const ops    = liveStats.ops?.toFixed(3).replace('0.', '.') || '---';
    const pag    = liveStats.paPerGame?.toFixed(1) || '---';
    return {
      found: true,
      display: `${team ? team + ' | ' : ''}${avg} AVG / ${ops} OPS | ${pag} PA/game`,
    };
  }
  if (dataSource === 'database' && dbPlayer) {
    const avg    = dbPlayer.avg.toFixed(3).replace('0.', '.');
    const ops    = dbPlayer.ops.toFixed(3).replace('0.', '.');
    const suffix = ['', 'st', 'nd', 'rd'][dbPlayer.battingOrder] || 'th';
    return {
      found: true,
      display: `${avg} AVG / ${ops} OPS | bats ${dbPlayer.battingOrder}${suffix}`,
    };
  }
  return { found: false, display: 'Not in database — using league average estimates' };
}

// ── Route ─────────────────────────────────────────────────
router.post('/', checkUsage, async (req, res) => {
  let { playerName, sport, statType, currentStat, propLine, period,
        timeRemaining, halfInning, homeScore, awayScore, oppDefRating } = req.body;

  if (!playerName || typeof playerName !== 'string' || playerName.length > 60) {
    return res.status(400).json({ error: 'Invalid player name' });
  }
  // Resolve aliases before any lookups (e.g. 'wemby' → 'victor wembanyama')
  playerName = resolvePlayerName(playerName);

  currentStat = parseFloat(currentStat);
  propLine    = parseFloat(propLine);
  if (isNaN(currentStat) || isNaN(propLine) || propLine <= 0) {
    return res.status(400).json({ error: 'Invalid stat or prop line' });
  }

  sport = (sport || 'NBA').toUpperCase();

  // ── Fetch live player stats ───────────────────────────────
  // NBA: BDL free tier has no stats endpoint — fetch identity/team only,
  //      rates come from hardcoded DB inside analyzeNBA.
  // MLB: MLB Stats API is free — fetch real live season stats.
  let liveStats = null;
  try {
    const endpoint = sport === 'NBA' ? 'nba' : 'mlb';
    const statsRes = await fetch(
      `http://localhost:${process.env.PORT || 3000}/api/playerstats/${endpoint}?name=${encodeURIComponent(playerName)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const statsData = await statsRes.json();
    // For NBA: only carry liveStats to pass team info through to playerDbInfo
    // For MLB: carry full live stats for real math
    if (statsData.found) liveStats = statsData;
  } catch (err) {
    console.error('Live stats fetch failed (using fallback):', err.message);
  }

  if (sport === 'NBA') {
    const result = analyzeNBA({ playerName, statType, currentStat, propLine, period, timeRemaining, homeScore, awayScore, liveStats, oppDefRating });
    return result.error ? res.status(400).json(result) : res.json(result);
  }
  if (sport === 'MLB') {
    const result = analyzeMLB({ playerName, statType, currentStat, propLine, period, halfInning, homeScore, awayScore, liveStats, oppDefRating });
    return result.error ? res.status(400).json(result) : res.json(result);
  }

  return res.status(400).json({ error: 'Unsupported sport. Use NBA or MLB.' });
});

router.post('/game-total', checkUsage, async (req, res) => {
  let { homeScore, awayScore, period, timeRemaining, bookTotal, sport, altLines } = req.body;

  homeScore = parseFloat(homeScore) || 0;
  awayScore = parseFloat(awayScore) || 0;
  bookTotal = parseFloat(bookTotal);

  const timeRemainingMins = parseTimeRemaining(timeRemaining);
  const isOT = period === 'OT';
  const periodNum = { Q1:1,Q2:2,Q3:3,Q4:4,OT:5 }[period] || 1;

  let minsPlayed, minsRemaining;
  if (sport === 'MLB') {
    const inningMap = {'1st':1,'2nd':2,'3rd':3,'4th':4,'5th':5,'6th':6,'7th':7,'8th':8,'9th':9};
    const inning = inningMap[period] || 1;
    minsPlayed = inning * 22;
    minsRemaining = (9 - inning) * 22;
  } else {
    minsPlayed = (periodNum - 1) * 12 + Math.max(0, 12 - Math.min(timeRemainingMins, 12));
    minsRemaining = Math.max(0, timeRemainingMins + (4 - periodNum) * 12);
  }

  const totalPoints = homeScore + awayScore;
  const differential = Math.abs(homeScore - awayScore);

  if (minsPlayed < 1) return res.status(400).json({ error: 'Need more game data' });

  const currentPace = totalPoints / minsPlayed;
  const blowoutDamp = differential >= 20 ? 0.72 : differential >= 15 ? 0.82 : differential >= 10 ? 0.91 : 1.0;
  const projectedFinal = parseFloat((totalPoints + currentPace * minsRemaining * blowoutDamp).toFixed(1));

  // Scan alt lines
  const defaultAltLines = sport === 'NBA'
    ? [-20, -15, -10, -5, 0, 5, 10, 15, 20].map(d => ({ line: bookTotal + d, odds: d < 0 ? -130 + d * 3 : -110 + d * 2 }))
    : altLines || [];

  const scannedLines = defaultAltLines.map(al => {
    const needed = al.line - totalPoints;
    const lambda = currentPace * minsRemaining * blowoutDamp;
    const prob = poissonProb(lambda, needed);
    const ev = altLineEV(prob, al.odds);
    return {
      line: al.line,
      odds: al.odds,
      probability: parseFloat((prob * 100).toFixed(1)),
      ...ev,
      label: al.line < projectedFinal ? 'UNDER' : 'OVER'
    };
  }).filter(l => l.isPositive).sort((a, b) => b.ev - a.ev);

  const signals = [];
  if (differential >= 15) signals.push({ type: 'under', text: `${differential}-point blowout — pace dampened ${Math.round((1-blowoutDamp)*100)}%` });
  if (projectedFinal < bookTotal - 5) signals.push({ type: 'under', text: `Pace projects ${projectedFinal} — ${(bookTotal - projectedFinal).toFixed(0)} below book total` });
  if (projectedFinal > bookTotal + 5) signals.push({ type: 'over', text: `Pace projects ${projectedFinal} — ${(projectedFinal - bookTotal).toFixed(0)} above book total` });

  res.json({
    sport,
    bookTotal,
    projectedFinal,
    currentPace: parseFloat(currentPace.toFixed(2)),
    blowoutDampener: blowoutDamp,
    totalSoFar: totalPoints,
    minsRemaining: parseFloat(minsRemaining.toFixed(1)),
    positiveEVLines: scannedLines.slice(0, 5),
    signals,
    recommendation: projectedFinal < bookTotal ? 'LEAN UNDER' : 'LEAN OVER',
    models: ['pace-projection', 'poisson', 'ev-scanner']
  });
});

module.exports = router;
