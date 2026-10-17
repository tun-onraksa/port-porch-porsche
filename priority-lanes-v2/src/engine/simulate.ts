// Gate simulation for today's day shift: who gets served, who waits, what it costs.
// Compares the blunt move with the Priority Lanes plan (only approved actions count).

import type { ActionKey, Evaluation } from './types.ts'
import type { Ctx } from './context.ts'
import { LANES, importCapacityPerHour, openLanes } from './context.ts'
import { HOUR, MIN, fmtTime, fmtWeekday, la, ms } from './time.ts'
import { RATES } from './rates.ts'

export type Policy = 'blunt' | 'plan'
/** Per box: the approved action, or null = no decision yet (runs first-come-first-served). */
export type Decisions = Record<string, ActionKey | null>

export type TruckResult =
  | 'served' | 'turned_away_gate' | 'turned_away_notice' | 'cancelled' | 'rescheduled' | 'rail' | 'abandoned' | 'unserved'

export interface TruckOutcome {
  boxId: string
  arrive: number
  result: TruckResult
  at: number | null
  waitH: number
  lane: number | null
}

export interface Assignment { text: string; lane: number | null; at: number | null; kind: 'lane' | 'later' | 'rail' | 'blocked' | 'none' }

export interface SimResult {
  policy: Policy
  label: string
  outcomes: Record<string, TruckOutcome>
  assignments: Record<string, Assignment>
  trucks: number
  stranded3h: number
  truckWaitCost: number
  wastedTripCost: number
  chargesCost: number
  actionCost: number
  total: number
  cargoAtRisk: { boxId: string; cargo: string; value: number | null }[]
  missedDeadlines: { boxId: string; cargo: string }[]
  railMissed: { boxId: string; cargo: string }[]
  inspectedForConflict: number
  examsExpedited: number
  heldAll: boolean
  heldBoxes: number
  rescheduled: number
  priority: { total: number; clearedBy11: number }
  windStuck: { boxId: string; cargo: string }[] // pickups booked inside the wind window that didn't move
  servedBy: (t: number) => number
}

const TICK = 5 * MIN
const EXAM_HOLDS = ['customs', 'USDA', 'VACIS']

const blocked = (e: Evaluation) =>
  e.box.holds_at_pod_terminal.some((h) => h.status === 'hold' || h.status === 'pending') || e.severity === 'critical'

/** Medical, reefer, relief and rail-cutoff boxes that are due out by 11:00 (truck, offered slot or rail). */
const BY_11 = la('2026-10-29', '11:00')
const isPriorityDueBy11 = (e: Evaluation) => {
  const b = e.box
  const rail = b.gate.rail_bound && !!b.gate.rail_cutoff_at && ms(b.gate.rail_cutoff_at) <= BY_11
  const kind = b.importer.category === 'medical' || b.importer.category === 'relief_supplies' || b.equipment_type === 'reefer'
  const due = (e.truckArrive !== null && e.truckArrive <= BY_11) || (e.rec.offeredSlot !== null && e.rec.offeredSlot <= BY_11 && e.rec.key !== 'slow')
  return rail || (kind && due)
}

interface SimTruck {
  e: Evaluation
  arrive: number
  approved: boolean
  rescheduled?: boolean
  done?: TruckOutcome
}

export function simulate(evals: Evaluation[], ctx: Ctx, policy: Policy, decisions: Decisions = {}): SimResult {
  const now = ctx.now
  const end = ctx.dayEnd
  const holdEnd = policy === 'blunt' && ctx.outages.length ? Math.max(...ctx.outages.map((o) => o.end)) : null
  const outcomes: Record<string, TruckOutcome> = {}
  const assignments: Record<string, Assignment> = {}
  const trucks: SimTruck[] = []
  let actionCost = 0
  let rescheduled = 0
  const later: Evaluation[] = []

  const decide = (e: Evaluation): ActionKey | null => (policy === 'plan' ? decisions[e.box.id] ?? null : null)

  for (const e of evals) {
    const d = decide(e)
    const b = e.box
    const arrive = e.truckArrive
    const today = arrive !== null && arrive < end
    const inQueue = !!b.gate.truck_arrived_at

    if (d === null) {
      if (today) trucks.push({ e, arrive: arrive!, approved: false })
      continue
    }
    if (d === 'reroute' && b.gate.rail_bound) {
      outcomes[b.id] = { boxId: b.id, arrive: arrive ?? now, result: 'rail', at: now + HOUR, waitH: 0, lane: null }
      continue
    }
    if (d === 'slow') {
      if (arrive !== null || e.rec.offeredSlot) actionCost += RATES.reschedule
      rescheduled++
      if (inQueue) outcomes[b.id] = { boxId: b.id, arrive: arrive!, result: 'rescheduled', at: now + TICK, waitH: (now + TICK - arrive!) / HOUR, lane: null }
      const slot = e.rec.offeredSlot
      if (slot && slot < end) later.push(e)
      continue
    }
    const physicallyBlocked = blocked(e) || d === 'inspect' || d === 'hold' || d === 'close'
    if (physicallyBlocked) {
      if (d === 'inspect' && e.severity === 'critical') actionCost += e.rec.ladder.find((r) => r.key === 'inspect')?.cost ?? 0
      if (inQueue) outcomes[b.id] = { boxId: b.id, arrive: arrive!, result: 'turned_away_notice', at: now + TICK, waitH: (now + TICK - arrive!) / HOUR, lane: null }
      else if (today) outcomes[b.id] = { boxId: b.id, arrive: arrive!, result: 'cancelled', at: null, waitH: 0, lane: null }
      continue
    }
    // Releasable and approved: pulled-forward boxes come at their offered slot.
    const pulled = e.rec.offeredSlot && e.rec.key !== 'slow' && e.rec.offeredSlot < end ? e.rec.offeredSlot : null
    if (pulled) trucks.push({ e, arrive: pulled, approved: true })
    else if (today) trucks.push({ e, arrive: arrive!, approved: true })
  }

  // Slowed boxes come back after the jam, staggered every 4 minutes.
  later
    .sort((a, b) => b.urgency.score - a.urgency.score)
    .forEach((e, idx) => trucks.push({ e, arrive: e.rec.offeredSlot! + idx * 4 * MIN, approved: true, rescheduled: true }))

  // ------------------------------------------------------------ queue
  const order = (t: SimTruck) => (t.approved ? [0, -t.e.urgency.score, t.arrive] : [1, t.arrive, 0])
  const cmp = (a: SimTruck, b: SimTruck) => {
    const x = order(a)
    const y = order(b)
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  }
  let credit = 0
  let rr = 0
  const pickLane = (t: number, e: Evaluation): number | null => {
    const open = openLanes(ctx, t)
    if (!open.length) return null
    if (e.box.declarations.hazmat_class && open.includes(4)) return 4
    if ((e.urgency.score >= 60 || e.box.equipment_type === 'reefer' || e.box.importer.category === 'medical') && open.includes(1)) return 1
    const general = open.filter((l) => !LANES.find((x) => x.id === l)?.priority && !LANES.find((x) => x.id === l)?.hazmat)
    const pool = general.length ? general : open
    return pool[rr++ % pool.length]
  }

  for (let t = now; t < end; t += TICK) {
    const waiting = trucks.filter((x) => !x.done && x.arrive <= t)
    for (const x of waiting) {
      if (t - x.arrive >= RATES.abandonAfterHours * HOUR) {
        x.done = { boxId: x.e.box.id, arrive: x.arrive, result: 'abandoned', at: x.arrive + RATES.abandonAfterHours * HOUR, waitH: RATES.abandonAfterHours, lane: null }
      }
    }
    if (holdEnd !== null && t < holdEnd) continue // the blunt move: hold all import releases
    credit += importCapacityPerHour(ctx, t) / (HOUR / TICK)
    const queue = waiting.filter((x) => !x.done).sort(cmp)
    for (const x of queue) {
      const isBlocked = blocked(x.e)
      const need = isBlocked ? 2 : 1 // a problem box found at the lane ties it up longer
      if (credit < need) break
      credit -= need
      const lane = pickLane(t, x.e)
      x.done = isBlocked
        ? { boxId: x.e.box.id, arrive: x.arrive, result: 'turned_away_gate', at: t, waitH: (t - x.arrive) / HOUR, lane }
        : { boxId: x.e.box.id, arrive: x.arrive, result: 'served', at: t, waitH: (t - x.arrive) / HOUR, lane }
    }
    if (!queue.some((x) => !x.done)) credit = Math.min(credit, 1)
  }
  for (const x of trucks) {
    if (!x.done) x.done = { boxId: x.e.box.id, arrive: x.arrive, result: 'unserved', at: end, waitH: Math.max(0, (end - x.arrive) / HOUR), lane: null }
    // a rescheduled truck that comes back keeps the "served" result of its second visit
    outcomes[x.e.box.id] = x.done
  }

  // ------------------------------------------------------------ costs & outcomes
  let truckWaitCost = 0
  let wastedTripCost = 0
  let stranded3h = 0
  for (const o of Object.values(outcomes)) {
    if (o.result === 'cancelled' || o.result === 'rail') continue
    truckWaitCost += Math.max(0, o.waitH - RATES.normalTurnHours) * RATES.truckHour
    if (o.waitH > 3) stranded3h++
    if (o.result === 'turned_away_gate' || o.result === 'turned_away_notice' || o.result === 'abandoned' || o.result === 'unserved') wastedTripCost += RATES.wastedTrip
  }

  let chargesCost = 0
  const missedDeadlines: SimResult['missedDeadlines'] = []
  const railMissed: SimResult['railMissed'] = []
  const cargoAtRisk: SimResult['cargoAtRisk'] = []
  let examsExpedited = 0
  let inspectedForConflict = 0
  let heldBoxes = 0
  const priority = { total: 0, clearedBy11: 0 }

  for (const e of evals) {
    const b = e.box
    const o = outcomes[b.id]
    const d = decide(e)
    const outAt = o && (o.result === 'served' || o.result === 'rail') ? o.at : null
    if (d === 'inspect' && e.severity === 'critical') inspectedForConflict++
    if (d === 'hold') heldBoxes++

    // Charges: a box still here after its deadline starts (or keeps) accruing.
    if (e.deadline) {
      const dl = e.deadline.at
      const stillHere = outAt === null || outAt > dl
      if (dl < now && outAt === null) chargesCost += e.dailyCharges
      else if (dl >= now && dl <= end && stillHere) {
        chargesCost += RATES.demurrageEarly + RATES.storage
        missedDeadlines.push({ boxId: b.id, cargo: b.cargo })
      }
      if (dl < now && outAt === null) missedDeadlines.push({ boxId: b.id, cargo: b.cargo })
      // Exam and payment holds: expedited / notified today, or found late.
      const exam = b.holds_at_pod_terminal.find((h) => EXAM_HOLDS.includes(h.name) && h.status === 'hold')
      const commercial = b.holds_at_pod_terminal.find((h) => !EXAM_HOLDS.includes(h.name) && h.status === 'hold')
      const soon = dl - now < 48 * HOUR
      if (exam) {
        const expedited = d === 'inspect'
        if (expedited) examsExpedited++
        if (!expedited && soon && dl >= now) chargesCost += RATES.demurrageEarly + RATES.storage
      } else if (commercial && soon && dl >= now && d !== 'flag') chargesCost += RATES.demurrageEarly + RATES.storage
    }

    if (b.gate.rail_bound && b.gate.rail_cutoff_at) {
      const cutoff = ms(b.gate.rail_cutoff_at)
      const made = o?.result === 'rail' || (o?.result === 'served' && o.at! <= cutoff)
      if (!made && cutoff < end) {
        railMissed.push({ boxId: b.id, cargo: b.cargo })
        chargesCost += RATES.storage
      }
    }

    // Spoilage exposure: project the reefer forward until the box leaves (or tomorrow 08:00).
    if (e.reefer) {
      const leaves = outAt ?? la('2026-10-30', '08:00')
      const hours = Math.max(0, (leaves - now) / HOUR)
      const techSent = d !== null && (d === 'inspect' || d === 'hold' || e.rec.also.includes('watch')) && e.reefer.dev > 2
      const proj = e.reefer.dev + Math.max(0, e.reefer.trend) * (techSent ? Math.min(hours, 1) : hours)
      if (!techSent && proj >= RATES.spoilageDevC) cargoAtRisk.push({ boxId: b.id, cargo: b.cargo, value: b.importer.cargo_value_usd })
    }

    if (isPriorityDueBy11(e) && !blocked(e)) {
      priority.total++
      if (outAt !== null && outAt <= BY_11) priority.clearedBy11++
    }

    assignments[b.id] = describe(e, o, d, policy)
  }

  // Pickups still booked inside the wind window get stuck when cranes stop.
  const windStuck: SimResult['windStuck'] = []
  const w = ctx.weather
  if (w) {
    for (const e of evals) {
      const appt = e.box.pickup_appointment_at ? ms(e.box.pickup_appointment_at) : null
      const o = outcomes[e.box.id]
      const out = o && (o.result === 'served' || o.result === 'rail')
      if (!out && appt !== null && appt >= w.start && appt < w.end) {
        windStuck.push({ boxId: e.box.id, cargo: e.box.cargo })
        if (w.confirmed && e.deadline && e.deadline.at < w.end + 17 * HOUR) chargesCost += RATES.demurrageEarly + RATES.storage
      }
    }
  }

  const servedTimes = Object.values(outcomes).filter((o) => o.result === 'served').map((o) => o.at!)
  return {
    policy,
    label: policy === 'blunt' ? (holdEnd ? 'Hold everything' : 'First-come-first-served') : 'Priority Lanes plan',
    outcomes,
    assignments,
    trucks: trucks.length,
    stranded3h,
    truckWaitCost,
    wastedTripCost,
    chargesCost,
    actionCost,
    total: truckWaitCost + wastedTripCost + chargesCost + actionCost,
    cargoAtRisk,
    missedDeadlines,
    railMissed,
    inspectedForConflict,
    examsExpedited,
    heldAll: holdEnd !== null,
    heldBoxes: holdEnd !== null ? evals.length : heldBoxes,
    rescheduled,
    priority,
    windStuck,
    servedBy: (t: number) => servedTimes.filter((x) => x <= t).length,
  }
}

function describe(e: Evaluation, o: TruckOutcome | undefined, d: ActionKey | null, policy: Policy): Assignment {
  const k = policy === 'plan' ? d ?? e.rec.key : null
  if (o?.result === 'rail') return { text: `On-dock rail · ${e.box.gate.rail_cutoff_at ? `by ${fmtTime(e.box.gate.rail_cutoff_at)}` : ''}`, lane: null, at: o.at, kind: 'rail' }
  if (o?.result === 'served') return { text: `L${o.lane} · ${fmtTime(o.at!)}`, lane: o.lane, at: o.at, kind: 'lane' }
  if (k === 'slow' && e.rec.offeredSlot) return { text: `→ ${fmtWeekday(e.rec.offeredSlot).slice(0, 3)} ${fmtTime(e.rec.offeredSlot)}`, lane: null, at: e.rec.offeredSlot, kind: 'later' }
  if (k === 'inspect') return { text: 'Inspection bay', lane: null, at: null, kind: 'blocked' }
  if (o?.result === 'turned_away_notice' || o?.result === 'cancelled') return { text: 'Truck notified', lane: null, at: null, kind: 'blocked' }
  if (o?.result === 'turned_away_gate') return { text: `Turned away ${fmtTime(o.at!)}`, lane: o.lane, at: o.at, kind: 'blocked' }
  if (o?.result === 'abandoned') return { text: `Driver left ${fmtTime(o.at!)}`, lane: null, at: o.at, kind: 'blocked' }
  if (o?.result === 'unserved') return { text: 'Not served today', lane: null, at: null, kind: 'blocked' }
  if (e.truckArrive) return { text: `${fmtWeekday(e.truckArrive).slice(0, 3)} ${fmtTime(e.truckArrive + 10 * MIN)}`, lane: null, at: e.truckArrive, kind: 'none' }
  return { text: 'No truck booked', lane: null, at: null, kind: 'none' }
}

/** Every recommendation approved as proposed. */
export const fullPlan = (evals: Evaluation[]): Decisions => Object.fromEntries(evals.map((e) => [e.box.id, e.rec.key]))
