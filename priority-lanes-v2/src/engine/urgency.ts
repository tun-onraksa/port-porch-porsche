// "Which box can't wait?" — 0 to 100, every point explained.
// Shown next to Terminal49's own `urgency` field, never instead of it.

import type { Box, Category, Urgency, UrgencyBand, UrgencyFactor } from './types.ts'
import { HOUR, fmtDuration, fmtTime, ms } from './time.ts'
import { RATES } from './rates.ts'

const CATEGORY_POINTS: Record<Category, number> = {
  medical: 30,
  relief_supplies: 28,
  perishable_food: 22,
  critical_industrial: 15,
  general: 5,
}
export const CATEGORY_LABEL: Record<Category, string> = {
  medical: 'Medical',
  relief_supplies: 'Relief supplies',
  perishable_food: 'Perishable food',
  critical_industrial: 'Critical industrial',
  general: 'General',
}

export function band(score: number): UrgencyBand {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'normal'
  return 'can_slow'
}
export const BAND_LABEL: Record<UrgencyBand, string> = { critical: 'Critical', high: 'High', normal: 'Normal', can_slow: 'Can slow' }

/** Daily charges accruing right now (sample rates). Zero until the deadline passes. */
export function dailyChargesNow(deadlineAt: number | null, now: number): number {
  if (deadlineAt === null || now <= deadlineAt) return 0
  const daysPast = Math.ceil((now - deadlineAt) / (24 * HOUR))
  return (daysPast > 4 ? RATES.demurrageLate : RATES.demurrageEarly) + RATES.storage
}

export interface UrgencyInput {
  box: Box
  now: number
  effectiveDeadline: number | null
  deadlineNote: string | null
  reeferDev: number | null
  reeferTrend: number
  dailyCharges: number
  truckArrive: number | null
}

export function scoreUrgency(u: UrgencyInput): Urgency {
  const { box: b, now } = u
  const f: UrgencyFactor[] = []

  // Cargo criticality (importer-declared; only verified importers get full points)
  const cat = b.importer.category
  let crit = 5
  let critWhy = 'Not declared by the importer: scored as general'
  if (cat) {
    const full = CATEGORY_POINTS[cat]
    crit = b.importer.verified || cat === 'general' ? full : Math.round(full / 2)
    critWhy = `${CATEGORY_LABEL[cat]}${b.importer.verified ? ', verified importer' : cat === 'general' ? '' : ', unverified importer: half points'}`
  }
  f.push({ key: 'criticality', label: 'Cargo criticality', points: crit, max: 30, why: critWhy })

  // Time pressure
  let time = 2
  let timeWhy = 'No deadline posted yet'
  if (u.effectiveDeadline !== null) {
    const h = (u.effectiveDeadline - now) / HOUR
    time = h < 0 ? 25 : h < 12 ? 22 : h < 24 ? 18 : h < 48 ? 12 : h < 72 ? 6 : 2
    timeWhy = h < 0 ? `Deadline passed ${fmtDuration(-h)} ago` : `${fmtDuration(h)} until the earliest deadline`
    if (u.deadlineNote) timeWhy += ` (${u.deadlineNote})`
  }
  f.push({ key: 'time', label: 'Time pressure', points: time, max: 25, why: timeWhy })

  // Condition risk
  let cond = 0
  let condWhy = b.equipment_type === 'reefer' ? 'On setpoint' : 'Dry cargo: no condition risk'
  if (u.reeferDev !== null) {
    const d = u.reeferDev
    cond = d > 8 ? 20 : d >= 4 ? 14 : d >= 2 ? 8 : 0
    if (u.reeferTrend > 1) cond = Math.min(20, cond + 4)
    if (cond) condWhy = `Reefer ${d.toFixed(1)}°C over setpoint${u.reeferTrend > 1 ? `, rising ${u.reeferTrend.toFixed(1)}°C/hr (+4)` : ''}`
    else if (u.reeferTrend > 0.4) condWhy = `Within 2°C, drifting +${u.reeferTrend.toFixed(1)}°C/hr`
  }
  f.push({ key: 'condition', label: 'Condition risk', points: cond, max: 20, why: condWhy })

  // Cost accruing
  const dc = u.dailyCharges
  const cost = dc > 300 ? 10 : dc >= 150 ? 7 : dc > 0 ? 4 : 0
  f.push({ key: 'cost', label: 'Cost accruing', points: cost, max: 10, why: dc ? `$${dc}/day accruing now (sample rates)` : 'Still inside free time' })

  // Downstream commitment (strongest applies)
  let down = 0
  let downWhy = 'Nothing booked downstream'
  const g = b.gate
  const railH = g.rail_bound && g.rail_cutoff_at ? (ms(g.rail_cutoff_at) - now) / HOUR : null
  const apptH = b.pickup_appointment_at ? (ms(b.pickup_appointment_at) - now) / HOUR : null
  if (railH !== null && railH >= 0 && railH <= 4) {
    down = 10
    downWhy = `On-dock rail cutoff ${fmtTime(g.rail_cutoff_at!)} (in ${fmtDuration(railH)})`
  } else if (apptH !== null && apptH >= -0.5 && apptH <= 2) {
    down = 7
    downWhy = `Confirmed appointment ${fmtTime(b.pickup_appointment_at!)}`
  } else if (g.truck_arrived_at) {
    down = 5
    downWhy = `Truck already in the queue since ${fmtTime(g.truck_arrived_at)}`
  }
  f.push({ key: 'downstream', label: 'Downstream commitment', points: down, max: 10, why: downWhy })

  // Fairness: +1 per 12h waiting since discharge
  let fair = 0
  let fairWhy = 'Not discharged yet'
  if (b.pod_discharged_at) {
    const h = (now - ms(b.pod_discharged_at)) / HOUR
    fair = Math.min(5, Math.max(0, Math.floor(h / 12)))
    fairWhy = `${fmtDuration(h)} since discharge`
  }
  f.push({ key: 'fairness', label: 'Fairness (time waiting)', points: fair, max: 5, why: fairWhy })

  const score = f.reduce((s, x) => s + x.points, 0)
  return { score, band: band(score), factors: f }
}
