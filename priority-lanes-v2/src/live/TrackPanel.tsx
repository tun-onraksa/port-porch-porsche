// PortAble kit: "Track another box" — a real Terminal49 API call from the deployed site.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Radio } from 'lucide-react'
import { Btn, LiveTag, Panel } from '../ui/primitives.tsx'
import { trackBox } from './trackBox.ts'
import type { TrackResult, TrackType } from './trackBox.ts'

const field = 'h-9 rounded-lg border border-line-2 bg-panel-2 px-2.5 font-mono text-[13px] text-ink placeholder:text-dim focus:outline-2 focus:outline-info'

export function TrackPanel() {
  const [number, setNumber] = useState('')
  const [type, setType] = useState<TrackType>('bill_of_lading')
  const [scac, setScac] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TrackResult | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    const r = await trackBox(number, type, scac)
    setResult(r)
    // Tell the top-bar Terminal49 light (src/t49-status.js) that a real request just went through.
    if (r.ok) { try { localStorage.setItem('t49:last', JSON.stringify({ at: new Date().toISOString(), id: r.id, status: r.status })) } catch { /* private mode */ } }
    setBusy(false)
  }

  return (
    <Panel
      className="mb-4 border-live/35"
      title={<span className="flex flex-wrap items-center gap-2"><Radio size={16} className="text-live" aria-hidden /> Track another box <LiveTag>Live Terminal49 API</LiveTag></span>}
      sub="Sends a real tracking request to Terminal49. The shipment then appears in Terminal49 and fills in as the carrier and terminal report."
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Track a box with Terminal49">
        <label className="grid gap-1 text-[12px] font-medium text-muted">
          Number
          <input id="t49-number" className={`${field} w-48`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. 9509953390" autoComplete="off" required />
        </label>
        <label className="grid gap-1 text-[12px] font-medium text-muted">
          Type
          <select id="t49-type" className={`${field} w-44 font-sans`} value={type} onChange={(e) => setType(e.target.value as TrackType)}>
            <option value="bill_of_lading">Bill of lading</option>
            <option value="booking_number">Booking</option>
            <option value="container">Container (beta)</option>
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-medium text-muted">
          Carrier
          <input id="t49-scac" className={`${field} w-24 uppercase`} value={scac} onChange={(e) => setScac(e.target.value)} maxLength={4} placeholder="COSU" autoComplete="off" />
        </label>
        <Btn type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : 'Start tracking'}</Btn>
      </form>
      {result && (
        <p role="status" className={`mt-3 rounded-lg border px-3 py-2 font-mono text-[12.5px] ${result.ok ? 'border-live/40 bg-live/10 text-live' : 'border-crit/40 bg-crit/10 text-crit'}`}>
          {result.ok
            ? <>Tracking request created · status <b>{result.status || 'pending'}</b> · id {result.id}</>
            : result.error}
        </p>
      )}
      <p className="mt-3 text-[12px] text-dim">Free Terminal49 plan: creating tracking requests only, up to 10 active containers. The key stays on the server.</p>
    </Panel>
  )
}
