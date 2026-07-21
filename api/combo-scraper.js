// api/combo-scraper.js
// Fetches recent combo lists from Pastebin via Google dork.
// Returns an array of "email:pass" strings.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keyword = 'combo email:pass', maxResults = 10 } = req.body || {};

  // Google dork: site:pastebin.com "email:pass"
  const dork = `site:pastebin.com "${keyword}"`;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(dork)}&num=${maxResults}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`Google search failed with status ${response.status}`);
    const html = await response.text();

    // Extract Pastebin URLs from Google results
    const urlRegex = /https?:\/\/pastebin\.com\/[a-zA-Z0-9]+/g;
    const urls = [...new Set(html.match(urlRegex) || [])];

    // Fetch the raw content of each Pastebin
    const combos = [];
    for (const url of urls.slice(0, 5)) {
      try {
        const rawUrl = url.replace('pastebin.com/', 'pastebin.com/raw/');
        const pasteRes = await fetch(rawUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!pasteRes.ok) continue;
        const text = await pasteRes.text();
        // Split by newline and filter lines that look like email:pass
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.includes('@') && trimmed.includes(':')) {
            combos.push(trimmed);
          }
        }
      } catch (e) { /* skip broken pastes */ }
    }

    res.status(200).json({ combos: [...new Set(combos)].slice(0, maxResults * 10) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
