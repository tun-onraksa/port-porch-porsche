// Next 36h: gate demand vs capacity, events overlaid, jam windows and what to do about them.

import type { Evaluation } from './types.ts'
import type { Ctx } from './context.ts'
import { backgroundPerHour, capacityPerHour, scheduledLanes } from './context.ts'
import { HOUR, MIN, fmtTime, fmtWeekday, la } from './time.ts'

export interface ForecastHour {
  t: number
  capacity: number
  capacityIfWind: number
  background: number
  imports: number // our import pickups arriving, before the plan
  importsPlanned: number // after the plan moves appointments around
  nextVessel: number // pickups from the next discharge (sample)
  backlog: number // trucks still waiting at the end of the hour
  backlogPlanned: number
  backlogIfWind: number
  jam: boolean
  jamPlanned: boolean
  jamIfWind: boolean
}

export interface ForecastEvent { start: number; end: number; label: string; kind: 'outage' | 'weather' | 'vessel' | 'maintenance' }

export interface Forecast {
  hours: ForecastHour[]
  events: ForecastEvent[]
  jams: { start: number; end: number; peakGap: number }[]
  jamsPlanned: { start: number; end: number; peakGap: number }[]
  windJams: { start: number; end: number; peakGap: number }[]
  recs: { title: string; detail: string; count: number }[]
}

export const FORECAST_START = la('2026-10-29', '07:00')
const NEXT_VESSEL = { name: 'NORTHERN LARK', at: la('2026-10-30', '06:00') }

const JAM_TRUCKS = 10 // a queue this long means a 30+ minute wait

export function forecast(evals: Evaluation[], ctx: Ctx): Forecast {
  const Q = 15 * MIN
  const quarters = 36 * 4
  const arrivals = new Array(quarters).fill(0)
  const arrivalsPlanned = new Array(quarters).fill(0)
  let queued = 0
  let queuedPlanned = 0
  const qOf = (t: number) => Math.floor((t - FORECAST_START) / Q)

  for (const e of evals) {
    const k = e.rec.key
    const leavesPlan = k === 'reroute' || k === 'inspect' || k === 'hold' || k === 'slow' || (!e.rec.releasable && k !== 'watch')
    if (e.truckArrive !== null) {
      if (e.truckArrive <= ctx.now) queued++
      else if (qOf(e.truckArrive) < quarters) arrivals[qOf(e.truckArrive)]++
      if (!leavesPlan && !e.rec.offeredSlot) {
        if (e.truckArrive <= ctx.now) queuedPlanned++
        else if (qOf(e.truckArrive) < quarters) arrivalsPlanned[qOf(e.truckArrive)]++
      }
    }
    if (e.rec.offeredSlot && e.rec.releasable) {
      const j = qOf(e.rec.offeredSlot)
      if (j >= 0 && j < quarters) arrivalsPlanned[j]++
    }
  }

  const hours: ForecastHour[] = []
  let b = 0
  let bp = 0
  let bw = 0
  for (let i = 0; i < 36; i++) {
    const t = FORECAST_START + i * HOUR
    const open = scheduledLanes(t).length > 0
    const bg = open ? backgroundPerHour(t) : 0
    const vessel = t >= NEXT_VESSEL.at + 4 * HOUR && t < la('2026-10-30', '17:00') ? 14 : 0
    let caps = 0
    let capsWind = 0
    let peak = 0
    let peakP = 0
    let peakW = 0
    let imp = 0
    let impP = 0
    for (let q = 0; q < 4; q++) {
      const tq = t + q * Q
      const idx = i * 4 + q
      const cap = capacityPerHour(ctx, tq) / 4
      const capW = capacityPerHour(ctx, tq, true) / 4
      caps += cap
      capsWind += capW
      const fixed = bg / 4 + vessel / 4
      const startQueue = tq === ctx.now ? queued : 0
      const startQueueP = tq === ctx.now ? queuedPlanned : 0
      imp += arrivals[idx] + startQueue
      impP += arrivalsPlanned[idx] + startQueueP
      b = Math.max(0, b + fixed + arrivals[idx] + startQueue - cap)
      bp = Math.max(0, bp + fixed + arrivalsPlanned[idx] + startQueueP - cap)
      bw = Math.max(0, bw + fixed + arrivals[idx] + startQueue - capW)
      peak = Math.max(peak, b)
      peakP = Math.max(peakP, bp)
      peakW = Math.max(peakW, bw)
    }
    hours.push({
      t, capacity: Math.round(caps), capacityIfWind: Math.round(capsWind), background: bg, imports: imp, importsPlanned: impP, nextVessel: vessel,
      backlog: Math.round(b), backlogPlanned: Math.round(bp), backlogIfWind: Math.round(bw),
      jam: peak >= JAM_TRUCKS, jamPlanned: peakP >= JAM_TRUCKS, jamIfWind: !!ctx.weather && peakW >= JAM_TRUCKS,
    })
  }

  const windows = (flag: (h: ForecastHour) => boolean, size: (h: ForecastHour) => number) => {
    const out: { start: number; end: number; peakGap: number }[] = []
    for (let i = 0; i < hours.length; i++) {
      if (!flag(hours[i])) continue
      const start = hours[i].t
      let peak = 0
      while (i < hours.length && flag(hours[i])) peak = Math.max(peak, size(hours[i++]))
      out.push({ start, end: hours[i - 1].t + HOUR, peakGap: peak })
    }
    return out
  }
  const jams = windows((h) => h.jam, (h) => h.backlog)
  const jamsPlanned = windows((h) => h.jamPlanned, (h) => h.backlogPlanned)
  const windJams = windows((h) => h.jamIfWind && !h.jam, (h) => h.backlogIfWind)

  const events: ForecastEvent[] = [
    ...ctx.outages.map((o) => ({ start: o.start, end: o.end, label: `Lanes ${o.lanes[0]}–${o.lanes[o.lanes.length - 1]} down: ${o.reason.toLowerCase()}`, kind: 'outage' as const })),
    { start: NEXT_VESSEL.at, end: NEXT_VESSEL.at + 8 * HOUR, label: `${NEXT_VESSEL.name} discharges (sim)`, kind: 'vessel' },
    { start: la('2026-10-29', '17:00'), end: la('2026-10-29', '18:00'), label: 'Shift change: gate closed', kind: 'maintenance' },
    { start: la('2026-10-30', '03:00'), end: la('2026-10-30', '07:00'), label: 'Gate closed overnight', kind: 'maintenance' },
  ]
  if (ctx.weather) events.push({ start: ctx.weather.start, end: Math.min(ctx.weather.end, FORECAST_START + 36 * HOUR), label: ctx.weather.label, kind: 'weather' })

  // Recommendations derived from the forecast and today's recommendations.
  const inJam = (t: number | null) => t !== null && [...jams, ...windJams].some((j) => t >= j.start && t < j.end)
  const prestage = evals.filter((e) => e.rec.releasable && e.urgency.score >= 40 && e.box.sensors.dig_moves > 0 && (inJam(e.truckArrive) || inJam(e.rec.offeredSlot)))
  const shifted = evals.filter((e) => e.rec.key === 'slow' && e.truckArrive !== null)
  const offered = evals.filter((e) => e.rec.key === 'slow' && e.truckArrive === null)
  const inspections = evals.filter((e) => e.rec.key === 'inspect')
  const pulled = evals.filter((e) => e.rec.offerReason === 'weather')
  const today = evals.filter((e) => e.rec.offerReason === 'deadline')
  const rail = evals.filter((e) => e.rec.key === 'reroute')
  const byHold = (n: string) => inspections.filter((e) => e.box.holds_at_pod_terminal.some((h) => h.name === n)).length
  const conflictOnly = inspections.filter((e) => !e.box.holds_at_pod_terminal.some((h) => h.status === 'hold')).length

  const recs: Forecast['recs'] = []
  if (prestage.length) recs.push({ count: prestage.length, title: `Pre-stage ${prestage.length} boxes near the gate`, detail: `Urgent boxes whose trucks land in a jam window: ${prestage.reduce((s, e) => s + e.box.sensors.dig_moves, 0)} dig moves done before the truck arrives instead of while it waits.` })
  if (shifted.length || offered.length) recs.push({ count: shifted.length + offered.length, title: `Shift ${shifted.length} appointments, offer ${offered.length} later slots`, detail: 'Low-urgency boxes with more than 48h of free time move out of the jam window.' })
  if (inspections.length) recs.push({ count: inspections.length, title: `Reserve ${inspections.length} inspection slots`, detail: `CBP exam ${byHold('customs')}, USDA ${byHold('USDA')}, VACIS ${byHold('VACIS')}${conflictOnly ? `, conflict-driven ${conflictOnly}` : ''}. Book them now, before trucks are assigned.` })
  if (pulled.length) recs.push({ count: pulled.length, title: `Pull forward ${pulled.length} pickup${pulled.length === 1 ? '' : 's'} ahead of the wind window`, detail: pulled.map((e) => `${e.box.cargo} → ${fmtWeekday(e.rec.offeredSlot!)} ${fmtTime(e.rec.offeredSlot!)}`).join(' · ') })
  if (today.length) recs.push({ count: today.length, title: `Offer same-day slots to ${today.length} boxes at or past their deadline`, detail: 'No truck booked today, charges start (or keep running) tonight. Slots go after the lanes return unless the box is urgent.' })
  if (rail.length) recs.push({ count: rail.length, title: `Send ${rail.length} rail-bound boxes to on-dock rail`, detail: 'Bypasses the truck gate entirely during the outage.' })
  return { hours, events, jams, jamsPlanned, windJams, recs }
}
