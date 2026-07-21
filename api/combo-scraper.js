// api/combo-scraper.js — Fetches real, publicly posted combos from Pastebin archive
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { maxResults = 50 } = req.body || {};
  const fetchOptions = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
    signal: AbortSignal.timeout(20000),
  };

  try {
    // Fetch Pastebin archive page (lists recent public pastes)
    const archiveUrl = 'https://pastebin.com/archive';
    const archiveRes = await fetch(archiveUrl, fetchOptions);
    if (!archiveRes.ok) throw new Error(`Archive fetch failed: ${archiveRes.status}`);
    const archiveHtml = await archiveRes.text();

    // Extract paste IDs from the archive page
    const urlRegex = /<a href="\/([a-zA-Z0-9]{8})"/g;
    const pasteIds = [];
    let match;
    while ((match = urlRegex.exec(archiveHtml)) !== null && pasteIds.length < 20) {
      pasteIds.push(match[1]);
    }

    // Fetch raw content of each paste and extract combos
    const combosSet = new Set();
    for (const id of pasteIds) {
      if (combosSet.size >= maxResults) break;
      try {
        const rawUrl = `https://pastebin.com/raw/${id}`;
        const pasteRes = await fetch(rawUrl, fetchOptions);
        if (!pasteRes.ok) continue;
        const text = await pasteRes.text();
        // Extract lines that contain an email-like pattern followed by ':'
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.includes('@') && trimmed.includes(':') && trimmed.length < 200) {
            combosSet.add(trimmed);
            if (combosSet.size >= maxResults) break;
          }
        }
      } catch (e) { /* skip broken pastes */ }
    }

    res.status(200).json({ combos: Array.from(combosSet).slice(0, maxResults) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}