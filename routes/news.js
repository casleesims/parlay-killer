const express = require('express');
const router = express.Router();

let newsCache = { data: null, timestamp: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchRSS(url, sport) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ParlayKillerApp/1.0' } });
  const xml = await res.text();
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title');
    const link = get('link') || block.match(/<link>\s*(https?:[^<]+)/)?.[1]?.trim() || '';
    const pubDate = get('pubDate');
    const description = get('description').replace(/<[^>]+>/g, '').trim();
    if (title) items.push({ title, description, link, pubDate, sport });
  }
  return items;
}

router.get('/feed', async (req, res) => {
  try {
    const now = Date.now();
    if (newsCache.data && now - newsCache.timestamp < CACHE_TTL) {
      return res.json(newsCache.data);
    }
    const [nba, mlb] = await Promise.all([
      fetchRSS('https://www.espn.com/espn/rss/nba/news', 'NBA').catch(() => []),
      fetchRSS('https://www.espn.com/espn/rss/mlb/news', 'MLB').catch(() => []),
    ]);
    const all = [...nba, ...mlb]
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 30);
    const result = { items: all, timestamp: new Date().toISOString() };
    newsCache = { data: result, timestamp: now };
    res.json(result);
  } catch(e) {
    console.error('[News] feed error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
