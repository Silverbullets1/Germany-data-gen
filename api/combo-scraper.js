// api/combo-scraper.js — Multi‑source (Pastebin + GitHub Gist)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { maxResults = 100 } = req.body || {};
  const fetchOptions = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
    signal: AbortSignal.timeout(20000),
  };

  const combosSet = new Set();

  // ========== SOURCE 1: PASTEBIN ARCHIVE ==========
  try {
    const archiveUrl = 'https://pastebin.com/archive';
    const archiveRes = await fetch(archiveUrl, fetchOptions);
    if (archiveRes.ok) {
      const archiveHtml = await archiveRes.text();
      const urlRegex = /<a href="\/([a-zA-Z0-9]{8})"/g;
      const pasteIds = [];
      let match;
      while ((match = urlRegex.exec(archiveHtml)) !== null && pasteIds.length < 20) {
        pasteIds.push(match[1]);
      }
      for (const id of pasteIds) {
        if (combosSet.size >= maxResults) break;
        try {
          const rawUrl = `https://pastebin.com/raw/${id}`;
          const pasteRes = await fetch(rawUrl, fetchOptions);
          if (!pasteRes.ok) continue;
          const text = await pasteRes.text();
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.includes('@') && trimmed.includes(':') && trimmed.length < 200) {
              combosSet.add(trimmed);
              if (combosSet.size >= maxResults) break;
            }
          }
        } catch (e) { /* skip broken pastes */ }
      }
    }
  } catch (e) { /* Pastebin failed, continue to next source */ }

  // ========== SOURCE 2: GITHUB GIST ==========
  try {
    const gistSearchUrl = `https://api.github.com/search/gists?q="email:pass"+language:txt&per_page=30`;
    const gistRes = await fetch(gistSearchUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(15000),
    });
    if (gistRes.ok) {
      const data = await gistRes.json();
      const gists = data.items || [];
      for (const gist of gists) {
        if (combosSet.size >= maxResults) break;
        for (const file of Object.values(gist.files)) {
          if (!file.raw_url) continue;
          try {
            const rawRes = await fetch(file.raw_url, fetchOptions);
            if (!rawRes.ok) continue;
            const text = await rawRes.text();
            for (const line of text.split('\n')) {
              const trimmed = line.trim();
              if (trimmed.includes('@') && trimmed.includes(':') && trimmed.length < 200) {
                combosSet.add(trimmed);
                if (combosSet.size >= maxResults) break;
              }
            }
          } catch (e) { /* skip broken file */ }
        }
      }
    }
  } catch (e) { /* GitHub failed, continue */ }

  res.status(200).json({ combos: Array.from(combosSet).slice(0, maxResults) });
}