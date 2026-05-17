const express = require('express');
const router = express.Router();

const newsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function parseRSSItems(xml, sport) {
  const items = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const block = itemMatch[1];
    const getField = (tag) => {
      const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
      if (cdata) return cdata[1].trim();
      const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (plain) return plain[1].replace(/<[^>]+>/g, '').trim();
      return '';
    };
    const getLinkField = () => {
      const cdata = block.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i);
      if (cdata) return cdata[1].trim();
      const direct = block.match(/<link>\s*(https?:\/\/[^\s<]+)/i);
      return direct ? direct[1].trim() : '';
    };
    const title = getField('title');
    const link = getLinkField();
    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"'),
        description: getField('description').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0,300),
        link, pubDate: getField('pubDate'), sport,
      });
    }
  }
  return items;
}

async function fetchRSS(url, sport) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ParlayKillerApp/1.0' } });
  const xml = await res.text();
  return parseRSSItems(xml, sport);
}

router.get('/feed', async (req, res) => {
  try {
    const now = Date.now();
    const cached = newsCache.get('feed');
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }
    const [nba, mlb] = await Promise.all([
      fetchRSS('https://www.espn.com/espn/rss/nba/news', 'NBA').catch(() => []),
      fetchRSS('https://www.espn.com/espn/rss/mlb/news', 'MLB').catch(() => []),
    ]);
    const all = [...nba, ...mlb]
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 30);
    const result = { items: all, timestamp: new Date().toISOString() };
    newsCache.set('feed', { data: result, timestamp: now });
    res.json(result);
  } catch(e) {
    console.error('[News] feed error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
