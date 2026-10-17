// The situation the engine evaluates against: clock, lanes, outages, weather, drills.

import { HOUR, la, laHour } from './time.ts'
import { RATES } from './rates.ts'

export type Mode = 'ordinary' | 'disruption' | 'drill'
export type DrillId = 'lanes_down_6h' | 'wind_cranes_12h' | 'customs_outage_4h' | 'reefer_power_r2'

export interface LaneDef { id: number; role: string; hazmat?: boolean; priority?: boolean }
export interface Outage { lanes: number[]; start: number; end: number; reason: string }
export interface Weather { start: number; end: number; label: string; confirmed: boolean }

export interface Ctx {
  mode: Mode
  drill: DrillId | null
  now: number
  dayEnd: number // day-shift gate close
  outages: Outage[]
  weather: Weather | null
  customsOutage: { start: number; end: number } | null
  reeferFailure: { block: string; start: number; end: number; extraTrend: number } | null
}

export const NOW = la('2026-10-29', '07:30')
export const DAY_END = la('2026-10-29', '17:00')

export const LANES: LaneDef[] = [
  { id: 1, role: 'Priority & reefer', priority: true },
  { id: 2, role: 'General' },
  { id: 3, role: 'General' },
  { id: 4, role: 'Hazmat & heavy', hazmat: true },
  { id: 5, role: 'General' },
  { id: 6, role: 'General' },
  { id: 7, role: 'General' },
  { id: 8, role: 'General' },
]

const POWER_FAULT: Outage = {
  lanes: [5, 6, 7, 8],
  start: NOW,
  end: la('2026-10-29', '14:00'),
  reason: 'Power fault',
}
const WIND: Weather = {
  start: la('2026-10-30', '12:00'),
  end: la('2026-10-30', '20:00'),
  label: 'Wind advisory: cranes may stop Fri afternoon',
  confirmed: false,
}

export const DRILLS: { id: DrillId; title: string; blurb: string }[] = [
  { id: 'lanes_down_6h', title: '4 lanes down 6h', blurb: 'Lanes 5–8 lose power 07:30–13:30 on an otherwise normal day.' },
  { id: 'wind_cranes_12h', title: 'Wind: cranes stop 12h', blurb: 'High wind stops yard cranes Fri 12:00 – Sat 00:00. Nothing can be dug out for trucks.' },
  { id: 'customs_outage_4h', title: 'Customs system outage 4h', blurb: 'CBP release messages stop 07:30–11:30. No new releases or exam slots.' },
  { id: 'reefer_power_r2', title: 'Reefer power failure in Block R2', blurb: 'Block R2 reefer plugs lose power 07:30–10:30. Boxes warm about 1.5°C/hr.' },
]

export function buildCtx(mode: Mode, drill: DrillId | null): Ctx {
  const base: Ctx = { mode, drill: null, now: NOW, dayEnd: DAY_END, outages: [], weather: null, customsOutage: null, reeferFailure: null }
  if (mode === 'disruption') return { ...base, outages: [POWER_FAULT], weather: WIND }
  if (mode === 'ordinary') return base
  // Drills rehearse on today's boxes against an ordinary-day baseline.
  switch (drill) {
    case 'lanes_down_6h':
      return { ...base, drill, outages: [{ ...POWER_FAULT, end: la('2026-10-29', '13:30'), reason: 'Drill: power fault' }] }
    case 'wind_cranes_12h':
      return { ...base, drill, weather: { start: la('2026-10-30', '12:00'), end: la('2026-10-31', '00:00'), label: 'Drill: wind stops cranes 12h', confirmed: true } }
    case 'customs_outage_4h':
      return { ...base, drill, customsOutage: { start: NOW, end: la('2026-10-29', '11:30') } }
    case 'reefer_power_r2':
      return { ...base, drill, reeferFailure: { block: 'R2', start: NOW, end: la('2026-10-29', '10:30'), extraTrend: 1.5 } }
    default:
      return { ...base, drill: null }
  }
}

// ---------------------------------------------------------------- gate capacity

/** Gate hours: day shift 07:00–17:00 (8 lanes), night shift 18:00–03:00 (6 lanes). */
export function scheduledLanes(t: number): number[] {
  const h = laHour(t)
  if (h >= 7 && h < 17) return [1, 2, 3, 4, 5, 6, 7, 8]
  if (h >= 18 || h < 3) return [1, 2, 3, 4, 5, 6]
  return []
}

export function openLanes(ctx: Ctx, t: number): number[] {
  const down = new Set(ctx.outages.filter((o) => t >= o.start && t < o.end).flatMap((o) => o.lanes))
  return scheduledLanes(t).filter((l) => !down.has(l))
}

export function laneDown(ctx: Ctx, lane: number, t: number): Outage | null {
  return ctx.outages.find((o) => o.lanes.includes(lane) && t >= o.start && t < o.end) ?? null
}

/** Exports, empty returns and other terminals' moves share the same lanes (sample figures). */
export function backgroundPerHour(t: number): number {
  const h = laHour(t)
  const day: Record<number, number> = { 7: 36, 8: 38, 9: 37, 10: 35, 11: 34, 12: 33, 13: 33, 14: 35, 15: 36, 16: 34 }
  const night: Record<number, number> = { 18: 24, 19: 26, 20: 25, 21: 22, 22: 20, 23: 16, 0: 12, 1: 10, 2: 8 }
  return day[h] ?? night[h] ?? 0
}

/** Truck transactions per hour the open lanes can handle, after a wind stop if confirmed. */
export function capacityPerHour(ctx: Ctx, t: number, assumeWind = false): number {
  let cap = openLanes(ctx, t).length * RATES.laneThroughput
  const w = ctx.weather
  if (w && (w.confirmed || assumeWind) && t >= w.start && t < w.end) cap = Math.round(cap * 0.25)
  return cap
}

/** Import pickups our lanes can take per hour once background traffic is served. */
export const importCapacityPerHour = (ctx: Ctx, t: number) => Math.max(0, capacityPerHour(ctx, t) - backgroundPerHour(t))

/** End of the current outage window, if any (when Slow can offer a slot). */
export function saturationEnd(ctx: Ctx, t: number): number | null {
  const o = ctx.outages.find((x) => t >= x.start - HOUR && t < x.end)
  return o ? o.end : null
}
