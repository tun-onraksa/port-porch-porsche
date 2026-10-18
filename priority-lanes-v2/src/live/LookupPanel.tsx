// "Look up a box": pull a box's data from Terminal49.
// 1. Ask our server (/api/lookup) for a live read with the Terminal49 key.
// 2. The free plan refuses reads, so fall back to the Terminal49 data already pulled for this demo
//    (17 Oct snapshot via the Terminal49 connector) and label it as such.
// 3. If Terminal49 has never seen the number, offer to ask it to start tracking (the only call the free
//    plan allows); its data would then come back through step 1 on a paid key.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Search } from 'lucide-react'
import { SNAPSHOT } from '../data/scenario.ts'
import { Btn, Panel, cx } from '../ui/primitives.tsx'
import { trackBox } from './trackBox.ts'
import type { TrackResult } from './trackBox.ts'

type Ev = { event: string; timestamp: string | null; location_name?: string | null }
type Box = { number: string; status: string | null; available: boolean | null; availabilityKnown: boolean; fees: number | null; urgency: string | null; urgencyReason: string | null; discharged: string | null; events: Ev[] }
type View = {
  source: 'live' | 'snapshot'; asOf: string
  bl: string; vessel: string; voyage: string; line: string; from: string; to: string; terminal: string; eta: string | null; ata: string | null
  boxes: Box[]; match: string | null
}

const field = 'h-9 rounded-lg border border-line-2 bg-panel-2 px-2.5 font-mono text-[13px] text-ink placeholder:text-dim focus:outline-2 focus:outline-info'
const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : null
const STATUS: Record<string, string> = { on_ship: 'On the ship', in_transit: 'In transit', available: 'Available for pickup', not_available: 'At the terminal, not available', picked_up: 'Picked up', delivered: 'Delivered' }

function fromSnapshot(q: string): View | null {
  const sh = SNAPSHOT.shipment
  const shared = SNAPSHOT.shared_container_values as unknown as Record<string, unknown> & { events: Ev[] }
  const numbers = SNAPSHOT.containers.map((c: { number: string }) => c.number)
  const match = numbers.find((n: string) => n === q) ?? null
  if (q !== sh.bill_of_lading && !match) return null
  return {
    source: 'snapshot', asOf: SNAPSHOT.snapshot_taken_at,
    bl: sh.bill_of_lading, vessel: sh.pod_vessel_name, voyage: sh.voyage_number, line: sh.shipping_line_name,
    from: sh.port_of_lading_name, to: sh.port_of_discharge_name, terminal: `${sh.pod_terminal_name} (${sh.pod_terminal_firms_code})`,
    eta: sh.pod_eta_at, ata: sh.pod_ata_at,
    boxes: numbers.map((n: string) => ({
      number: n, status: (shared.current_status as string) ?? null, available: (shared.available_for_pickup as boolean) ?? null,
      availabilityKnown: !!shared.availability_known, fees: (shared.fees_total_amount as number) ?? null,
      urgency: (shared.urgency as string) ?? null, urgencyReason: (shared.urgency_reason as string) ?? null, discharged: null, events: shared.events,
    })),
    match,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromLive(j: any): View {
  const s = j.shipment ?? {}
  return {
    source: 'live', asOf: j.fetched_at,
    bl: s.bill_of_lading_number ?? '', vessel: s.pod_vessel_name ?? '', voyage: s.pod_voyage_number ?? s.voyage_number ?? '', line: s.shipping_line_name ?? s.shipping_line_scac ?? '',
    from: s.port_of_lading_name ?? '', to: s.port_of_discharge_name ?? '', terminal: s.pod_terminal_name ?? '', eta: s.pod_eta_at ?? null, ata: s.pod_ata_at ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    boxes: (j.containers ?? []).map((c: any) => ({
      number: c.number, status: c.current_status ?? null, available: c.available_for_pickup ?? null, availabilityKnown: c.available_for_pickup != null,
      fees: Array.isArray(c.fees_at_pod_terminal) ? c.fees_at_pod_terminal.reduce((t: number, f: { amount?: number }) => t + (f.amount ?? 0), 0) : null,
      urgency: null, urgencyReason: null, discharged: c.pod_discharged_at ?? null, events: [],
    })),
    match: j.match ?? null,
  }
}

function Steps({ v, b }: { v: View; b: Box }) {
  const at = (name: string) => b.events.find((e) => e.event === name)?.timestamp ?? null
  const loaded = at('container.transport.vessel_loaded')
  const departed = at('container.transport.vessel_departed')
  const steps = [
    { label: `Loaded at ${v.from}`, detail: fmt(loaded), done: !!loaded },
    { label: 'Departed', detail: fmt(departed), done: !!departed || b.status === 'on_ship' },
    { label: `Arrived ${v.to}`, detail: v.ata ? fmt(v.ata) : v.eta ? `ETA ${fmt(v.eta)}` : 'No ETA', done: !!v.ata },
    { label: 'Off the ship', detail: fmt(b.discharged) ?? 'Not yet', done: !!b.discharged },
    { label: 'Ready for pickup', detail: b.available ? 'Available' : b.availabilityKnown ? 'Not available' : 'Never checked', done: !!b.available },
    { label: 'Out of the terminal', detail: 'Not yet', done: b.status === 'picked_up' || b.status === 'delivered' },
  ]
  const current = steps.findIndex((s) => !s.done)
  return (
    <ol className="mt-3 grid gap-y-3 sm:grid-cols-6">
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-2.5 sm:flex-col sm:items-start sm:gap-1.5" aria-current={i === current ? 'step' : undefined}>
          <span className="flex items-center sm:w-full">
            <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-semibold', s.done ? 'border-good bg-good text-white' : i === current ? 'border-info bg-info/10 text-info' : 'border-line-2 bg-panel text-dim')}>
              {s.done ? <Check size={13} aria-hidden /> : i + 1}
            </span>
            {i < steps.length - 1 && <span aria-hidden className={cx('mx-1.5 hidden h-0 flex-1 border-t-2 sm:block', s.done ? 'border-good/60' : 'border-dashed border-line-2')} />}
          </span>
          <span className="min-w-0">
            <span className={cx('block text-[12.5px] leading-tight font-semibold', s.done || i === current ? 'text-ink' : 'text-muted')}>{s.label}</span>
            <span className="block text-[12px] text-muted">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function LookupPanel() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<View | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [track, setTrack] = useState<TrackResult | null>(null)
  const picks = [SNAPSHOT.shipment.bill_of_lading, ...SNAPSHOT.containers.map((c: { number: string }) => c.number)]

  async function lookup(raw: string) {
    const n = raw.trim().toUpperCase()
    setQ(n); setView(null); setNote(null); setMissing(null); setTrack(null)
    if (!/^[A-Z0-9]{4,20}$/.test(n)) { setNote('Enter a container number or bill of lading (letters and digits only).'); return }
    setBusy(true)
    let live: { ok?: boolean; source?: string; notFound?: boolean; error?: string } | null = null
    if (location.protocol !== 'file:') {
      try { live = await (await fetch(`/api/lookup?q=${encodeURIComponent(n)}`, { cache: 'no-store' })).json() } catch { live = null }
    }
    setBusy(false)
    if (live?.ok) {
      setView(fromLive(live))
      try { localStorage.setItem('t49:last', JSON.stringify({ at: new Date().toISOString(), id: `read ${n}`, status: 'live read' })) } catch { /* private mode */ }
      return
    }
    const snap = fromSnapshot(n)
    if (snap) {
      setView(snap)
      setNote(live?.source === 'denied' ? 'Live read refused on the free plan, so this is the Terminal49 data already pulled for this demo.'
        : live?.source === 'nokey' ? 'This copy has no Terminal49 key, so this is the Terminal49 data already pulled for this demo.'
        : 'Showing the Terminal49 data already pulled for this demo.')
      return
    }
    setMissing(n)
    setNote(live?.notFound ? 'Terminal49 isn’t tracking this number for our account yet.' : 'This number isn’t in the Terminal49 data we can read yet.')
  }

  async function startTracking() {
    if (!missing) return
    setBusy(true)
    const type = /^[A-Z]{4}\d{7}$/.test(missing) ? 'container' : 'bill_of_lading'
    const r = await trackBox(missing, type, '')
    setBusy(false); setTrack(r)
    if (r.ok) { try { localStorage.setItem('t49:last', JSON.stringify({ at: new Date().toISOString(), id: r.id, status: r.status })) } catch { /* private mode */ } }
  }

  function submit(e: FormEvent) { e.preventDefault(); void lookup(q) }
  const shown = view ? (view.match ? view.boxes.filter((b) => b.number === view.match) : view.boxes.slice(0, 1)) : []

  return (
    <Panel title="Look up a box · Terminal49" sub="Pulls the box’s status, route and milestones from Terminal49.">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2" aria-label="Look up a box in Terminal49">
        <label className="grid flex-1 gap-1 text-[12px] font-medium text-muted" style={{ minWidth: 200 }}>
          Container or bill of lading
          <input id="t49-lookup" className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="OOCU8185051" autoComplete="off" />
        </label>
        <Btn type="submit" variant="primary" disabled={busy}><Search size={14} aria-hidden /> {busy ? 'Looking up…' : 'Look up'}</Btn>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        <span>Try:</span>
        {picks.map((p) => <button key={p} type="button" onClick={() => void lookup(p)} className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink hover:border-line-2">{p}</button>)}
      </div>

      {view && shown.map((b) => (
        <div key={b.number} className="mt-4 border-t border-line pt-3" role="status">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[15px] font-semibold text-ink">{b.number}</span>
            <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-semibold', view.source === 'live' ? 'bg-live/12 text-live' : 'bg-panel-3 text-ink-2')}>
              {view.source === 'live' ? `Live from Terminal49 · ${fmt(view.asOf)}` : `Terminal49 data · pulled ${view.asOf.slice(0, 10)}`}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">{view.vessel} · {view.voyage} · {view.line} · {view.from} → {view.to} · {view.terminal}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-4">
            <div><dt className="text-muted">Status</dt><dd className="text-ink">{(b.status && STATUS[b.status]) ?? b.status ?? 'Unknown'}</dd></div>
            <div><dt className="text-muted">Pickup</dt><dd className="text-ink">{b.available ? 'Available' : b.availabilityKnown ? 'Not available' : 'Never checked'}</dd></div>
            <div><dt className="text-muted">Terminal fees</dt><dd className="text-ink">{b.fees == null ? 'Unknown' : b.fees === 0 ? 'None reported' : `$${b.fees}`}</dd></div>
            <div><dt className="text-muted">Bill of lading</dt><dd className="font-mono text-ink">{view.bl}</dd></div>
          </dl>
          <Steps v={view} b={b} />
          {b.urgencyReason && <p className="mt-2 text-[12px] text-muted">Terminal49 urgency: {b.urgency ?? 'unknown'} · {b.urgencyReason}</p>}
        </div>
      ))}

      {note && <p className="mt-3 text-[12.5px] text-muted">{note}</p>}

      {missing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Btn size="sm" onClick={() => void startTracking()} disabled={busy}>Ask Terminal49 to start tracking {missing}</Btn>
          {track && <span className={cx('text-[12.5px]', track.ok ? 'text-live' : 'text-crit')}>{track.ok ? `Requested · ${track.status || 'pending'} · its data comes back through this lookup once Terminal49 has it` : track.error}</span>}
        </div>
      )}
    </Panel>
  )
}
