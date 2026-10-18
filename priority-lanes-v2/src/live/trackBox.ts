// PortAble kit: browser side of the live Terminal49 call.
// Calls our own server route (/api/track at the site root), never Terminal49 directly, so the API key
// stays on the server. Always resolves; never throws.

export type TrackResult =
  | { ok: true; id: string; status: string; request_number: string; scac: string | null; created_at?: string }
  | { ok: false; error: string; status?: number }

export type TrackType = 'bill_of_lading' | 'booking_number' | 'container'

// The dashboard is served from /priority-lanes-v2/ inside the workspace, so resolve the route from the site root.
const ENDPOINT = new URL('/api/track', location.origin).toString()

export async function trackBox(number: string, type: TrackType = 'bill_of_lading', scac = ''): Promise<TrackResult> {
  const request_number = number.trim()
  const code = scac.trim().toUpperCase()
  if (!/^[A-Za-z0-9]{4,20}$/.test(request_number)) return { ok: false, error: 'Enter a bill of lading, booking or container number (letters and digits only).' }
  if (code && !/^[A-Z]{4}$/.test(code)) return { ok: false, error: 'Carrier code is four letters, like COSU for COSCO. Leave it blank to let Terminal49 detect it.' }
  if (location.protocol === 'file:') return { ok: false, error: 'This copy is opened as a file, so it can’t reach the server. Live tracking works on the deployed site.' }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_type: type, request_number, scac: code || undefined }),
    })
    const j = await res.json().catch(() => null)
    if (!j) return { ok: false, error: 'The server answered without data. Is /api/track deployed?' }
    return j.ok ? j : { ok: false, status: j.status, error: 'Terminal49: ' + (j.error || 'request refused') }
  } catch {
    return { ok: false, error: 'Can’t reach the server, so no request was sent. Live tracking works on the deployed site.' }
  }
}
