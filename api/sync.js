const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/roadmap_data?id=eq.main`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return method === 'GET' ? res.json() : res;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const rows = await supabase('GET');
      if (!rows || rows.length === 0) return res.status(200).json(null);
      return res.status(200).json(rows[0].data);
    }

    if (req.method === 'POST') {
      const data = req.body;
      await supabase('POST', [{
        id: 'main',
        data,
        updated_at: new Date().toISOString(),
      }]);
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};
