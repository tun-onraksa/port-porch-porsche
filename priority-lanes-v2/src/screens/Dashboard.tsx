// Dashboard: the home screen. A calmer front page for Gate Command.
// Reads top to bottom the way a planner decides: what's happening → the few numbers that matter →
// the next calls to make → what the plan achieves → everything else, folded away.
// Reuses Gate Command's own panels (plan comparison, full queue); nothing here changes the engine.
import { ArrowRight, Check, ChevronDown, CircleCheck, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../state.tsx'
import type { Evaluation } from '../engine/types.ts'
import { LANES, backgroundPerHour, laneDown, openLanes } from '../engine/context.ts'
import { HOUR, fmtTime } from '../engine/time.ts'
import { RATES, usdFull } from '../engine/rates.ts'
import { actionLabel, holdLabel } from '../engine/actions.ts'
import { ScreenHeader } from '../ui/layout.tsx'
import { Btn, Disclosure, Panel, cx } from '../ui/primitives.tsx'
import { BluntVsGentle, Queue } from './GateCommand.tsx'
import { LookupPanel } from '../live/LookupPanel.tsx'
import { INBOUND, SNAPSHOT } from '../data/scenario.ts'
import { paperworkChecks } from '../engine/paperwork.ts'
import { fmtWeekday } from '../engine/time.ts'
import { RealTag, SeverityBadge } from '../ui/primitives.tsx'
import type { Severity } from '../engine/types.ts'

// Terminal49 on the Dashboard: the real shipment from the API snapshot, what still needs fixing before
// it arrives (the old Pre-Arrival Radar, condensed), and the live tracking request beside it.
const CHECK_AS_OF = Date.parse('2026-10-27T20:00:00Z')
const SEV: Record<Severity, number> = { critical: 0, major: 1, minor: 2 }

function Terminal49Panel() {
  const sh = SNAPSHOT.shipment
  const eta = Date.parse(sh.pod_eta_at)
  const open = INBOUND.map((r) => ({ r, w: paperworkChecks(r, CHECK_AS_OF) }))
    .filter((x) => x.w.length && !x.r.resolution)
    .map((x) => ({ ...x, sev: x.w.reduce<Severity>((m, w) => (SEV[w.severity] < SEV[m] ? w.severity : m), 'minor') }))
    .sort((a, b) => SEV[a.sev] - SEV[b.sev])
  return (
    <Panel title="Arriving · Terminal49" right={<RealTag />}>
      <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)]">
        <span className="text-muted">Vessel</span><span className="text-ink"><b className="font-semibold">{sh.pod_vessel_name}</b> · voyage {sh.voyage_number} · {sh.shipping_line_name}</span>
        <span className="text-muted">Route</span><span className="text-ink">{sh.port_of_lading_name} → {sh.port_of_discharge_name} · {sh.pod_terminal_name} ({sh.pod_terminal_firms_code})</span>
        <span className="text-muted">ETA</span><span className="text-ink">{fmtWeekday(eta)} {fmtTime(eta)} PDT · not yet arrived</span>
        <span className="text-muted">Containers</span>
        <span className="flex flex-wrap gap-1.5">{SNAPSHOT.containers.map((c: { number: string }) => <span key={c.number} className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">{c.number}</span>)}</span>
      </div>
      <p className="mt-2 text-[12px] text-muted">Bill of lading {sh.bill_of_lading} · Terminal49 snapshot {SNAPSHOT.snapshot_taken_at.slice(0, 10)}</p>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13.5px] font-semibold text-ink">Fix before arrival</span>
          <span className="text-[12px] text-muted">{open.length} open paperwork check{open.length === 1 ? '' : 's'} · simulated</span>
        </div>
        {open.length === 0 ? <p className="text-[13px] text-ink-2">Nothing open.</p> : (
          <ul className="grid gap-2">
            {open.slice(0, 3).map(({ r, w, sev }) => (
              <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
                <SeverityBadge s={sev} size="sm" />
                <span className="min-w-0 text-[13px] leading-snug text-ink"><span className="font-mono text-[12px] text-muted">{r.number}</span> · {w[0].text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

const needsDecision = (e: Evaluation) => e.rec.key !== 'release' || e.conflicts.some((c) => c.severity !== 'minor')

function reason(e: Evaluation): string {
  const top = [...e.conflicts].filter((c) => c.severity !== 'minor').sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1))[0]
  if (top) return top.summary
  const holds = e.box.holds_at_pod_terminal.filter((h) => h.status === 'hold')
  if (holds.length) return holds.map(holdLabel).join(', ')
  return e.rec.why[0] ?? e.rec.headline
}

function Metric({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: 'crit' | 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-panel px-4 py-3.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[26px] leading-tight font-semibold tracking-tight text-ink">{value}</span>
      {note && <span className={cx('text-[12px]', tone === 'crit' ? 'font-medium text-crit' : tone === 'warn' ? 'font-medium text-warn' : 'text-muted')}>{note}</span>}
    </div>
  )
}

// Where each suggested action is worked on: checks and holds in Security review, everything else on the box
// itself in the 3D yard (the cargo inspection drawer).
const SECURITY_ACTIONS = new Set(['inspect', 'hold', 'close'])

function DecideRow({ e, i }: { e: Evaluation; i: number }) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const drill = app.mode === 'drill'
  const slot = app.full.assignments[e.box.id]?.text
  const sev = e.severity
  const security = SECURITY_ACTIONS.has(e.rec.key)
  return (
    <li className="border-t border-line">
      <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 px-5 py-3.5 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-center">
        <span className={cx('grid size-7 place-items-center rounded-full text-[12px] font-semibold', sev === 'critical' ? 'bg-crit/12 text-crit' : sev === 'major' ? 'bg-warn/12 text-warn' : 'bg-panel-2 text-muted')}>{i + 1}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[14.5px] font-semibold text-ink">{e.box.cargo}</span>
            <span className="font-mono text-[12px] text-muted">{e.box.number}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{reason(e)}</p>
        </div>
        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-ink hover:bg-panel-2">
            {actionLabel(e.rec.key)}{slot ? <span className="font-normal text-muted"> · {slot}</span> : null}
            <ChevronDown size={14} className={cx('text-muted transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
          {drill ? <span className="text-[12px] text-warn">Drill</span> : <Btn size="sm" onClick={() => app.approve(e)} title={`Approve: ${actionLabel(e.rec.key)}`}><Check size={13} aria-hidden /> Approve</Btn>}
        </div>
      </div>
      {open && (
        <div className="mx-5 mb-3.5 rounded-lg bg-panel-2 px-4 py-3 text-[13px] sm:ml-[60px]">
          <p className="font-medium text-ink">{e.rec.headline}</p>
          {e.rec.why.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink-2">{e.rec.why.slice(0, 3).map((w) => <li key={w}>{w}</li>)}</ul>}
          {e.rec.tasks.length > 0 && <p className="mt-2 text-[12.5px] text-muted">Next: {e.rec.tasks.slice(0, 2).map((t) => `${t.text} (${t.who})`).join(' · ')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {security
              ? <Btn size="sm" onClick={() => app.go('security')}>Open Security review <ArrowRight size={13} aria-hidden /></Btn>
              : <Btn size="sm" onClick={() => app.go('box', e.box.id)}>See the box in the yard <ArrowRight size={13} aria-hidden /></Btn>}
            {security && <Btn size="sm" variant="quiet" onClick={() => app.go('box', e.box.id)}>See the box in the yard</Btn>}
          </div>
        </div>
      )}
    </li>
  )
}

function DecideNext({ items, total }: { items: Evaluation[]; total: number }) {
  return (
    <Panel title="Decide next" right={<span className="text-[12.5px] text-muted">{total ? `${total} waiting · most urgent first` : 'Nothing waiting'}</span>} bodyClass="p-0">
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pb-5 text-[13.5px] text-ink-2"><CircleCheck size={16} className="text-good" aria-hidden /> Every box that needed a call has one. The rest run on the plan.</p>
      ) : (
        <ol>{items.map((e, i) => <DecideRow key={e.box.id} e={e} i={i} />)}</ol>
      )}
    </Panel>
  )
}

function LaneStrip() {
  const { ctx, full } = useApp()
  const now = ctx.now
  const configured = ctx.resourcePlan?.gates ?? 8
  const lanes = LANES.slice(0, configured)
  const open = openLanes(ctx, now)
  const down = lanes.map((l) => laneDown(ctx, l.id, now)).filter(Boolean)
  const first = down[0]
  return (
    <Panel title="Gate lanes" right={<span className="text-[12.5px] text-muted">{open.length} of {configured} open</span>}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(lanes.length, 8)}, minmax(0, 1fr))` }} role="list" aria-label="Gate lanes">
        {lanes.map((l) => {
          const d = laneDown(ctx, l.id, now)
          const isOpen = open.includes(l.id)
          const served = Object.values(full.outcomes).filter((o) => o.lane === l.id && o.result === 'served').length
          const label = `Lane ${l.id}: ${d ? `down, ${d.reason}, back ${fmtTime(d.end)}` : isOpen ? `open, ${l.role}, ${served} planned` : 'closed'}`
          return (
            <div role="listitem" key={l.id} title={label} aria-label={label} className="flex flex-col items-center gap-1">
              <span className={cx('h-7 w-full rounded-md border', d ? 'border-crit/40 bg-crit/10' : isOpen ? 'border-good/40 bg-good/10' : 'border-line bg-panel-2')} />
              <span className="font-mono text-[11px] text-muted">{l.id}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-ink-2">
        {first ? `${first.reason}: ${down.length} lane${down.length > 1 ? 's' : ''} down until ${fmtTime(first.end)}. ` : 'All configured lanes are open. '}
        {lanes[0] && `Lane ${lanes[0].id}: ${lanes[0].role.toLowerCase()}.`}
      </p>
    </Panel>
  )
}

export function Dashboard() {
  const app = useApp()
  const { evals, ctx, approvals, plan, full, blunt } = app
  const now = ctx.now
  const queued = evals.filter((e) => e.box.gate.truck_arrived_at).length
  const open = openLanes(ctx, now)
  const perLane = ctx.resourcePlan?.gateProductivity ?? RATES.laneThroughput
  const capNow = open.length * perLane
  const nextHour = evals.filter((e) => e.truckArrive !== null && e.truckArrive > now && e.truckArrive <= now + HOUR).length
  const demand = queued + nextHour + backgroundPerHour(now, ctx)
  const waiting = evals.filter((e) => needsDecision(e) && !approvals[e.box.id])
  const critical = waiting.filter((e) => e.severity === 'critical').length
  const configured = ctx.resourcePlan?.gates ?? 8
  const outage = ctx.outages.find((o) => o.lanes.some((l) => l <= configured) && o.end > now)
  const outLanes = outage ? outage.lanes.filter((l) => l <= configured) : []
  const over = demand - capNow
  const savedFull = blunt.total ? Math.round((1 - full.total / blunt.total) * 100) : 0
  const decided = Object.keys(approvals).length

  const sentence = [
    outage ? `${outage.reason}: ${outLanes.length > 1 ? `lanes ${outLanes[0]}–${outLanes[outLanes.length - 1]} are` : `lane ${outLanes[0]} is`} down until ${fmtTime(outage.end)}.` : null,
    `${queued} trucks are waiting${over > 0 ? `, ${over} more an hour than the gate can take` : ''}.`,
    waiting.length ? `${waiting.length} box${waiting.length > 1 ? 'es need' : ' needs'} your call${critical ? `, ${critical} critical` : ''}.` : 'No calls waiting.',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <ScreenHeader title="Dashboard" sub={sentence} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Need your call" value={waiting.length} note={critical ? `${critical} critical` : decided ? `${decided} decided so far` : 'Most urgent listed below'} tone={critical ? 'crit' : undefined} />
        <Metric label="Trucks waiting" value={queued} note={`${open.length} lane${open.length === 1 ? '' : 's'} open`} />
        <Metric label="Gate this hour" value={`${demand} / ${capNow}`} note={over > 0 ? `Over capacity by ${over}` : 'Within capacity'} tone={over > 0 ? 'warn' : undefined} />
        <Metric label="Delay & handling cost" value={usdFull(plan.total)} note={`Full plan: ${usdFull(full.total)} (−${savedFull}% vs holding all)`} />
      </div>

      <div className="mb-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <DecideNext items={waiting.slice(0, 5)} total={waiting.length} />
        <div className="grid gap-4">
          <BluntVsGentle />
          <LaneStrip />
        </div>
      </div>

      <div className="mb-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <Terminal49Panel />
        <LookupPanel />
      </div>

      <Disclosure title={<span className="inline-flex items-center gap-2">All {evals.length} boxes<span className="font-normal text-muted">· full queue, filters and search</span></span>}>
        <Queue />
      </Disclosure>

      {decided > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted"><Undo2 size={13} aria-hidden /> Approvals stay for this session. Use Reset in the plan panel to start over.</p>
      )}
    </div>
  )
}
