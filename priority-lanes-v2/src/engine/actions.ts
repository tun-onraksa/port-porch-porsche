// "What can you slow, reroute, inspect or release?"
// The action ladder: always recommend the gentlest step that resolves the issue, and show why
// every gentler step falls short and every blunter step isn't needed, with costs.

import type { ActionKey, Box, Conflict, Hold, LadderRow, Recommendation, Severity, Task, Urgency } from './types.ts'
import type { Ctx } from './context.ts'
import { saturationEnd } from './context.ts'
import { HOUR, MIN, fmtDuration, fmtTime, fmtWeekday, la, ms } from './time.ts'
import { EXAM_FEES, RATES, lbsToKg, usdFull } from './rates.ts'
import { measuredWeight } from './trust.ts'

export const ACTIONS: { step: number; key: ActionKey; label: string }[] = [
  { step: 1, key: 'release', label: 'Release' },
  { step: 2, key: 'watch', label: 'Watch' },
  { step: 3, key: 'flag', label: 'Flag / confirm' },
  { step: 4, key: 'slow', label: 'Slow' },
  { step: 5, key: 'reroute', label: 'Reroute' },
  { step: 6, key: 'inspect', label: 'Inspect' },
  { step: 7, key: 'hold', label: 'Hold this box' },
  { step: 8, key: 'close', label: 'Close lane / terminal' },
]
export const stepOf = (k: ActionKey) => ACTIONS.find((a) => a.key === k)!.step
export const actionLabel = (k: ActionKey) => ACTIONS.find((a) => a.key === k)!.label

const EXAM_HOLDS = ['customs', 'USDA', 'VACIS']
export const holdLabel = (h: Hold) =>
  h.name === 'customs' ? 'CBP hold' : h.name === 'USDA' ? 'USDA hold' : h.name === 'VACIS' ? 'VACIS scan' : h.name === 'freight' ? 'Freight hold' : h.name === 'line' ? 'Line hold' : h.name === 'TMF' ? 'Terminal fee (TMF) hold' : 'Hold'

export interface RecInput {
  box: Box
  ctx: Ctx
  conflicts: Conflict[]
  severity: Severity | null
  available: boolean
  urgency: Urgency
  hoursToDeadline: number | null
  reefer: { dev: number; trend: number } | null
  truckArrive: number | null
  dailyCharges: number
  queued: number
}

const round15 = (t: number) => Math.ceil(t / (15 * MIN)) * 15 * MIN

export function recommend(i: RecInput): Recommendation {
  const { box: b, ctx, conflicts } = i
  const now = ctx.now
  const holds = b.holds_at_pod_terminal
  const active = holds.filter((h) => h.status === 'hold')
  const pending = holds.filter((h) => h.status === 'pending')
  const examHold = active.find((h) => EXAM_HOLDS.includes(h.name))
  const commercialHold = active.find((h) => !EXAM_HOLDS.includes(h.name))
  const critical = conflicts.filter((c) => c.severity === 'critical')
  const major = conflicts.filter((c) => c.severity === 'major')
  const retracted = conflicts.find((c) => c.attr === 'location')
  const reeferMajor = major.find((c) => c.attr === 'temperature')
  const drifting = !!i.reefer && i.reefer.dev <= 2 && i.reefer.trend > 0.4
  const customsDown = !!ctx.customsOutage && now >= ctx.customsOutage.start && now < ctx.customsOutage.end
  const cat = b.importer.category
  const appt = b.pickup_appointment_at ? ms(b.pickup_appointment_at) : null
  const inQueue = !!b.gate.truck_arrived_at
  const satEndAtArrival = i.truckArrive !== null ? saturationEnd(ctx, i.truckArrive) : null
  const satToday = ctx.outages.find((o) => o.end > now) ?? null
  const blockerHold = examHold ?? commercialHold ?? null

  let key: ActionKey = 'release'
  const also: ActionKey[] = []
  const why: string[] = []
  let slotHint: string | null = null
  let offeredSlot: number | null = null
  let offerReason: Recommendation['offerReason'] = null

  // Weather window: pull time-critical boxes forward before cranes may stop.
  const w = ctx.weather
  const apptInWeather = !!w && appt !== null && appt >= w.start && appt < w.end
  const pullForward = apptInWeather && (w!.confirmed || cat === 'relief_supplies' || cat === 'medical' || cat === 'perishable_food')

  if (critical.length) {
    key = 'inspect'
    why.push(...critical.map((c) => c.summary))
    if (examHold) why.push(`${holdLabel(examHold)} already placed: request an expedited exam rather than hold`)
  } else if (examHold) {
    if (customsDown) {
      key = 'hold'
      why.push(`${holdLabel(examHold)}: ${examHold.description}`, `CBP system down until ${fmtTime(ctx.customsOutage!.end)}: no exam slot can be booked, so hold this box only`)
    } else {
      key = 'inspect'
      why.push(`${holdLabel(examHold)}: ${examHold.description}`)
      if (i.urgency.score >= 40 || cat === 'medical') why.push('Urgent but blocked: expedite the exam, don’t release')
    }
  } else if (commercialHold) {
    key = 'flag'
    why.push(`${holdLabel(commercialHold)}: ${commercialHold.description}`, commercialHold.name === 'line' ? 'Ask the carrier for line release' : 'The importer can clear this by paying; no inspection needed')
  } else if (pending.length) {
    key = 'watch'
    why.push(`${pending.map(holdLabel).join(' + ')} pending: re-check in 30 min before the truck comes`)
  } else if (!b.available_for_pickup) {
    key = 'watch'
    why.push('Not available, but no hold is listed: probably a data lag. Re-check in 30 min')
  } else if (major.length && !(reeferMajor && major.length === 1)) {
    key = 'flag'
    why.push(...major.map((c) => c.summary))
    why.push('Outside tolerance, no immediate safety risk: confirm, keep it moving')
  } else if (reeferMajor) {
    key = 'release'
    also.push('watch')
    why.push(reeferMajor.summary, 'The fastest fix for a warming reefer is getting it out: release first, watch the trend')
  } else if (b.gate.rail_bound && b.gate.rail_cutoff_at && satEndAtArrival !== null) {
    key = 'reroute'
    why.push(`Truck gate saturated until ${fmtTime(satEndAtArrival)}`, `On-dock rail to ${b.gate.rail_destination} bypasses the gate and makes the ${fmtTime(b.gate.rail_cutoff_at)} cutoff`)
    slotHint = `On-dock rail by ${fmtTime(b.gate.rail_cutoff_at)}`
  } else if (retracted) {
    key = 'watch'
    why.push(retracted.summary, 'Trusting the terminal event; carrier milestone reliability lowered. Re-check before the truck')
  } else if (
    i.urgency.score < 40 &&
    (i.hoursToDeadline ?? 999) > 48 &&
    cat !== 'medical' && cat !== 'relief_supplies' &&
    ((satEndAtArrival !== null && (b.gate.walk_up || !inQueue)) || (i.truckArrive === null && satToday !== null))
  ) {
    key = 'slow'
    why.push(`Urgency ${i.urgency.score} and ${fmtDuration(i.hoursToDeadline ?? 0)} until the deadline: this box can wait`)
    if (i.truckArrive !== null && satEndAtArrival !== null) {
      offeredSlot = satEndAtArrival
      slotHint = `Offer a slot after ${fmtTime(satEndAtArrival)}`
      why.push(`Its ${b.gate.walk_up ? 'walk-up truck' : `${fmtTime(appt!)} appointment`} lands in the jam (4 of 8 lanes down until ${fmtTime(satEndAtArrival)})`)
    } else {
      offeredSlot = la('2026-10-30', '08:00')
      slotHint = 'Offer Fri 08:00 slot'
      why.push('No appointment yet: offering tomorrow keeps a walk-up out of today’s jam')
    }
  } else {
    key = 'release'
    if (drifting) {
      also.push('watch')
      why.push(`Reefer drifting +${i.reefer!.trend.toFixed(1)}°C/hr: release and re-check every 30 min`)
    }
    const minor = conflicts.filter((c) => c.severity === 'minor')
    if (minor.length) why.push(...minor.map((c) => `Note: ${c.summary}`))
    if (!why.length) why.push('Available, no holds, sources agree')
  }

  if (key === 'slow') offerReason = 'slow'
  if (pullForward && (key === 'release' || key === 'watch' || key === 'flag')) {
    const outageEnd = satToday ? satToday.end : 0
    const timeCritical = cat === 'relief_supplies' || cat === 'medical' || cat === 'perishable_food'
    offeredSlot = round15(timeCritical ? now + 1.5 * HOUR : Math.max(now + 1.5 * HOUR, outageEnd + 30 * MIN))
    offerReason = 'weather'
    slotHint = `Pull forward to ${fmtWeekday(offeredSlot)} ${fmtTime(offeredSlot)}`
    why.push(`Its ${fmtWeekday(appt!)} ${fmtTime(appt!)} pickup falls in the ${w!.confirmed ? 'crane stop' : 'wind advisory'} window: pull it forward`)
  }

  const releasable = i.available && !critical.length && !active.length && !pending.length

  // Deadline today or already passed, and no truck booked today: offer a slot today.
  const noTruckToday = i.truckArrive === null || i.truckArrive >= ctx.dayEnd
  if (!offeredSlot && releasable && (key === 'release' || key === 'flag') && noTruckToday && i.hoursToDeadline !== null && i.hoursToDeadline < 10) {
    offeredSlot = round15(satToday && i.urgency.score < 60 ? satToday.end + 15 * MIN : now + 1.5 * HOUR)
    slotHint = `Offer a slot today, ${fmtTime(offeredSlot)}`
    offerReason = 'deadline'
    why.push(i.dailyCharges ? `Past its deadline: ${usdFull(i.dailyCharges)}/day accruing until it leaves` : 'Deadline today 17:00 and no truck booked: offer a slot today')
  }
  const blocker = critical.length ? critical[0].summary : blockerHold ? `${holdLabel(blockerHold)} (${blockerHold.description})` : pending.length ? `${pending.map(holdLabel).join(' + ')} pending` : !b.available_for_pickup ? 'not available yet' : null

  const ctxInfo: LadderCtx = { b, i, key, examHold, commercialHold, critical, major, retracted: !!retracted, blocker, customsDown, satEndAtArrival, satToday: satToday?.end ?? null, releasable }
  const ladder = buildLadder(ctxInfo)
  const chosen = ladder.find((r) => r.status === 'chosen')!
  const next = ladder.find((r) => r.step === chosen.step + 1) ?? null

  return {
    step: stepOf(key),
    key,
    headline: headline(key, ctxInfo, slotHint),
    also,
    why,
    releasable,
    blocker,
    tasks: buildTasks(ctxInfo, also, offeredSlot),
    ladder,
    cost: chosen.cost ?? 0,
    costNote: chosen.costNote,
    nextBlunter: next ? { key: next.key, cost: next.cost, note: next.costNote } : null,
    slotHint,
    offeredSlot,
    offerReason,
  }
}

interface LadderCtx {
  b: Box
  i: RecInput
  key: ActionKey
  examHold: Hold | undefined
  commercialHold: Hold | undefined
  critical: Conflict[]
  major: Conflict[]
  retracted: boolean
  blocker: string | null
  customsDown: boolean
  satEndAtArrival: number | null
  satToday: number | null
  releasable: boolean
}

function headline(key: ActionKey, c: LadderCtx, slotHint: string | null): string {
  switch (key) {
    case 'release': return c.i.urgency.score >= 60 ? 'Release first: priority lane' : 'Release: assign lane & slot'
    case 'watch': return c.retracted ? 'Watch: trust the terminal, re-check' : 'Watch: re-check in 30 min'
    case 'flag': return c.commercialHold ? (c.commercialHold.name === 'line' ? 'Flag: ask carrier for line release' : 'Flag: notify importer to pay') : 'Flag: request confirmation, keep moving'
    case 'slow': return slotHint ?? 'Slow: offer a later slot'
    case 'reroute': return slotHint ? `Reroute: ${slotHint.toLowerCase()}` : 'Reroute'
    case 'inspect': return c.critical.length ? 'Inspect: this one box, not the gate' : `Inspect: ${c.examHold?.name === 'USDA' ? 'book USDA slot' : c.examHold?.name === 'VACIS' ? 'schedule VACIS scan' : 'expedite CBP exam'}`
    case 'hold': return 'Hold this box only'
    case 'close': return 'Close lane / terminal'
  }
}

function heavyRatio(b: Box): number | null {
  const m = measuredWeight(b)
  if (!m) return null
  const declared = b.equipment_weight_lbs != null ? lbsToKg(b.equipment_weight_lbs) : null
  return declared ? m.kg / declared : null
}

function stepCost(step: number, c: LadderCtx): { cost: number | null; note: string } {
  const { b, i } = c
  const truckComing = i.truckArrive !== null
  const value = b.importer.cargo_value_usd
  const warming = !!i.reefer && i.reefer.dev > 2 && i.reefer.trend > 0
  switch (step) {
    case 1: return c.releasable ? { cost: 0, note: 'no extra cost' } : { cost: null, note: 'not allowed while blocked' }
    case 2: return { cost: 0, note: 'staff time · re-check in 30 min' }
    case 3: return { cost: 0, note: 'auto-drafted message' }
    case 4: return truckComing ? { cost: RATES.reschedule, note: 'rebooking one appointment' } : { cost: 0, note: 'no truck booked yet' }
    case 5: return b.gate.rail_bound ? { cost: 0, note: 'on-dock rail: no truck needed' } : { cost: 150, note: 'off-dock yard drayage' }
    case 6: {
      let cost = RATES.inspectionMove
      const parts = ['yard move to bay']
      if (warming || c.critical.some((x) => x.attr === 'temperature')) { cost += RATES.reeferTech; parts.push('reefer tech') }
      const r = heavyRatio(b)
      if (r && r > 1.5) { cost += RATES.heavyEquipment; parts.push('heavy-rated gear') }
      const fee = c.examHold ? EXAM_FEES[c.examHold.name] : null
      return { cost, note: parts.join(' + ') + (fee ? ` · exam fee ${usdFull(fee)} billed to importer` : '') }
    }
    case 7: {
      let cost = RATES.storage + (i.dailyCharges ? i.dailyCharges - RATES.storage : 0)
      const parts = [`${usdFull(cost)}/day storage${i.dailyCharges ? ' + demurrage' : ''}`]
      if (truckComing) { cost += RATES.wastedTrip; parts.push('wasted truck trip') }
      if (warming) parts.push(value ? `${usdFull(value)} cargo keeps warming` : 'cargo keeps warming')
      return { cost, note: parts.join(' + ') }
    }
    default: {
      const hours = c.satToday ? Math.max(1, (c.satToday - c.i.ctx.now) / HOUR) : 4
      const cost = Math.round(i.queued * RATES.truckHour * hours)
      return { cost, note: `${i.queued} trucks stranded × ${fmtDuration(hours)}` }
    }
  }
}

function insufficient(step: number, c: LadderCtx): string {
  const { key, i, b } = c
  const hasRequest = b.history.some((h) => h.kind === 'request')
  const crit = c.critical[0]?.summary
  const exam = c.examHold ? holdLabel(c.examHold) : null
  switch (step) {
    case 1:
      if (key === 'slow') return `Gate saturated${c.satEndAtArrival ? ` until ${fmtTime(c.satEndAtArrival)}` : ' today'}; this box can wait (urgency ${i.urgency.score})`
      if (key === 'reroute') return `Truck gate is jammed; a gate pickup risks the ${fmtTime(b.gate.rail_cutoff_at!)} rail cutoff`
      if (key === 'watch' && c.retracted) return 'Release is likely fine, but a retracted milestone deserves a re-check before the truck'
      if (key === 'flag' && !c.commercialHold) return `${c.major[0]?.summary}: confirm before it’s on a chassis`
      if (crit) return `Unresolved critical conflict: ${crit}`
      return `${c.blocker ?? 'Blocked'}`
    case 2:
      if (key === 'slow' || key === 'reroute') return 'Nothing to monitor: the problem is gate capacity'
      if (key === 'flag') return c.commercialHold ? 'Watching won’t get the hold cleared' : 'Outside tolerance: needs confirmation, not just monitoring'
      if (crit) return `Outside tolerance with a safety/security implication${i.reefer && i.reefer.trend > 0 ? '; the reefer keeps warming while we watch' : ''}`
      return exam ? `Monitoring doesn’t clear a ${exam}` : 'Monitoring doesn’t resolve it'
    case 3:
      if (key === 'slow' || key === 'reroute') return 'No data conflict to confirm'
      if (crit) return hasRequest ? 'Carrier asked to confirm on Oct 26: no reply. A message can’t make this box safe' : 'A confirmation request can’t make a critical conflict safe'
      return exam ? `${exam}: CBP/USDA decides, a confirmation can’t clear it` : 'A request alone doesn’t resolve it'
    case 4:
      if (key === 'reroute') return `Slowing it misses the ${fmtTime(b.gate.rail_cutoff_at!)} rail cutoff`
      return `Delay doesn’t resolve ${crit ? 'the conflict' : (exam ?? 'the blocker')}${i.reefer && i.reefer.dev > 2 ? ', and the reefer keeps warming' : ''}`
    case 5:
      return `Moving it doesn’t clear ${crit ? 'the conflict' : (exam ?? 'the blocker')}`
    case 6:
      return c.customsDown ? `No exam slot today: CBP system down until ${fmtTime(c.i.ctx.customsOutage!.end)}` : 'Inspection can’t proceed'
    default:
      return ''
  }
}

function notNeeded(step: number, c: LadderCtx): string {
  const { key, i, b } = c
  const chosen = actionLabel(key).toLowerCase()
  switch (step) {
    case 2: return c.key === 'release' ? 'Sources agree; nothing to monitor' : 'Covered by the chosen step'
    case 3: return c.major.length ? 'Covered by the chosen step' : 'Sources agree within tolerance'
    case 4:
      if (i.urgency.score >= 40) return `Urgency ${i.urgency.score}: this box shouldn’t wait`
      if ((i.hoursToDeadline ?? 999) <= 48) return `Deadline in ${fmtDuration(i.hoursToDeadline ?? 0)}: slowing risks charges`
      if (b.importer.category === 'medical' || b.importer.category === 'relief_supplies') return 'Medical / relief cargo is never slowed'
      return c.satEndAtArrival === null ? 'The gate has capacity when its truck comes' : 'Not needed'
    case 5: return b.gate.rail_bound && c.satEndAtArrival === null ? 'Gate has capacity: normal rail dray works' : 'A working lane has capacity'
    case 6: return 'No critical conflict and no exam hold'
    case 7:
      if (key === 'inspect') return `An inspection path exists today${i.reefer && i.reefer.dev > 2 ? '; holding lets the reefer keep warming' : ''}`
      return `Nothing endangers people; ${chosen} resolves it`
    case 8: return `Hazard is limited to ${key === 'release' ? 'nothing at all' : 'one box'}; closing would strand ${i.queued} trucks`
    default: return 'Not needed'
  }
}

function buildLadder(c: LadderCtx): LadderRow[] {
  const chosenStep = stepOf(c.key)
  return ACTIONS.map((a) => {
    const { cost, note } = stepCost(a.step, c)
    if (a.step === chosenStep) return { step: a.step, key: a.key, status: 'chosen', reason: 'Gentlest step that resolves it', cost, costNote: note }
    if (a.step < chosenStep) return { step: a.step, key: a.key, status: 'insufficient', reason: insufficient(a.step, c), cost, costNote: note }
    return { step: a.step, key: a.key, status: 'not_needed', reason: notNeeded(a.step, c), cost, costNote: note }
  })
}

function buildTasks(c: LadderCtx, also: ActionKey[], offeredSlot: number | null): Task[] {
  const { b, i, key } = c
  const t: Task[] = []
  const add = (text: string, who: string) => t.push({ id: `${b.id}-${t.length}`, text, who })
  const appt = b.pickup_appointment_at ? ms(b.pickup_appointment_at) : null
  const now = i.ctx.now
  const trucker = b.gate.trucker ?? 'the trucker'
  const blocked = key === 'inspect' || key === 'hold' || (key === 'flag' && !!c.commercialHold) || (key === 'watch' && !c.releasable && !c.retracted)

  if (blocked && b.gate.truck_arrived_at) add(`Tell the driver in the queue now (${trucker}): box can’t go today`, 'Gate clerk')
  else if (blocked && appt && appt > now && appt < i.ctx.dayEnd + 12 * HOUR && key !== 'watch') add(`Cancel the ${fmtTime(appt)} appointment and notify ${trucker}`, 'Planner')

  if (key === 'inspect') {
    const dig = b.sensors.dig_moves
    add(`Move to the inspection bay (${dig} dig move${dig === 1 ? '' : 's'})`, 'Yard')
    if (c.examHold?.name === 'USDA') add('Book a USDA inspection slot; keep the reefer plugged in', 'Planner → USDA')
    else if (c.examHold?.name === 'VACIS') add('Schedule the VACIS scan', 'Planner → CBP')
    else add('Request an expedited CBP exam', 'Planner → CBP')
  }
  if (c.critical.some((x) => x.attr === 'temperature')) add('Dispatch a reefer technician now', 'Reefer team')
  else if (i.reefer && i.reefer.dev > 2) add('Reefer tech check within 1h', 'Reefer team')
  const r = heavyRatio(b)
  if (r && r > 1.5) add(`Assign heavy-rated handling equipment (actual ≈ ${Math.round(r)}× declared)`, 'Yard')
  if (c.critical.some((x) => x.security) || c.major.some((x) => x.security)) add('Share with Security view (CBP targeting)', 'Security')

  if (key === 'flag') {
    if (c.commercialHold?.name === 'freight') add('Notify importer: freight charges unpaid', 'Planner → importer')
    else if (c.commercialHold?.name === 'TMF') add('Notify importer: terminal fee (TMF) unpaid', 'Planner → importer')
    else if (c.commercialHold) add('Ask carrier for line release', 'Planner → carrier')
    for (const m of c.major) {
      if (m.attr === 'weight') add(b.declarations.hazmat_class ? 'Route to Lane 4 (hazmat) and re-weigh at the gate scale' : 'Ask carrier to confirm gross mass; re-weigh at the gate scale', 'Planner → carrier')
      if (m.attr === 'deadline') add('Ask carrier and terminal to confirm the last free day', 'Planner')
      if (m.attr === 'seal') add('Request re-seal record from carrier; escalate to inspection if none by 12:00', 'Planner → carrier')
      if (m.attr === 'contents') add('Ask importer to confirm the commodity', 'Planner → importer')
      if (m.attr === 'temperature') add('Ask carrier to confirm the booking setpoint', 'Planner → carrier')
    }
  }
  if (key === 'slow' && offeredSlot) add(`Offer the ${fmtWeekday(offeredSlot)} ${fmtTime(offeredSlot)} slot to ${b.gate.trucker ?? b.importer.name ?? 'the importer'}`, 'Planner')
  if (key === 'reroute') {
    add(`Book on-dock rail to ${b.gate.rail_destination} before ${fmtTime(b.gate.rail_cutoff_at!)}`, 'Rail desk')
    if (appt) add(`Cancel the ${fmtTime(appt)} dray appointment`, 'Planner')
  }
  if (key === 'watch') add(c.retracted ? 'Confirm the discharge milestone with the terminal' : `Re-check availability at ${fmtTime(now + 30 * MIN)}`, 'Planner')
  if (key === 'release') {
    add('Assign lane & slot', 'Planner')
    if (b.sensors.dig_moves > 0 && i.urgency.score >= 40) add(`Pre-stage near the gate (saves ${b.sensors.dig_moves} dig move${b.sensors.dig_moves === 1 ? '' : 's'})`, 'Yard')
  }
  if (also.includes('watch') && i.reefer) add('Reefer check every 30 min until it leaves', 'Reefer team')
  return t
}
