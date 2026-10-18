// Vercel serverless function: GET /api/lookup?q=<container number or bill of lading>
// Pulls a box's data from Terminal49 with the server-side key (never shipped to the browser).
// Terminal49's free plan refuses reads; the browser then falls back to the Terminal49 data already pulled
// for this demo (the 17 Oct snapshot) and says so. With a paid key or trial this returns live data.
const API = 'https://api.terminal49.com/v2';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET.' });
  const key = process.env.T49_API_KEY;
  if (!key) return res.status(200).json({ ok: false, source: 'nokey', error: 'The server has no Terminal49 key.' });

  const q = String((req.query && req.query.q) || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(q)) return res.status(400).json({ ok: false, error: 'Enter a container number or bill of lading (letters and digits only).' });

  try {
    const r = await fetch(`${API}/shipments?include=containers&page[size]=100`, {
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/vnd.api+json' },
    });
    if (r.status === 401 || r.status === 403) return res.status(200).json({ ok: false, source: 'denied', status: r.status, error: 'Terminal49 refused the read: the free plan can only create tracking requests.' });
    if (!r.ok) return res.status(200).json({ ok: false, source: 'error', status: r.status, error: `Terminal49 answered ${r.status}.` });
    const j = await r.json();
    const containers = (j.included || []).filter((x) => x.type === 'container');
    const container = containers.find((c) => String(c.attributes.number || '').toUpperCase() === q) || null;
    const shipment = (j.data || []).find((s) =>
      String(s.attributes.bill_of_lading_number || '').toUpperCase() === q ||
      (container && (s.relationships?.containers?.data || []).some((d) => d.id === container.id))) || null;
    if (!shipment) return res.status(200).json({ ok: false, source: 'live', notFound: true, error: 'Not tracked in this Terminal49 account.' });
    const ids = new Set((shipment.relationships?.containers?.data || []).map((d) => d.id));
    return res.status(200).json({
      ok: true, source: 'live', fetched_at: new Date().toISOString(),
      shipment: shipment.attributes,
      containers: containers.filter((c) => ids.has(c.id)).map((c) => c.attributes),
      match: container ? container.attributes.number : null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, source: 'error', error: 'Could not reach Terminal49.' });
  }
};
