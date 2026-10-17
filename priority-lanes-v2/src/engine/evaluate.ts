// Reconcile → judge sources → score → recommend, for every box.

import type { Box, Conflict, Evaluation, SecurityFinding, Severity, TrustedAttr } from './types.ts'
import type { Ctx } from './context.ts'
import { HOUR, MIN, deadlineAt, fmtDay, fmtTime, fmtWeekday, ms } from './time.ts'
import type { Reliability } from './trust.ts'
import { deadlineCandidates, trustContents, trustDeadline, trustLocation, trustRelease, trustSeal, trustTemperature, trustWeight } from './trust.ts'
import { dailyChargesNow, scoreUrgency } from './urgency.ts'
import { recommend } from './actions.ts'

const SEV_RANK: Record<Severity, number> = { minor: 1, major: 2, critical: 3 }
export const maxSeverity = (cs: Conflict[]): Severity | null =>
  cs.reduce<Severity | null>((m, c) => (!m || SEV_RANK[c.severity] > SEV_RANK[m] ? c.severity : m), null)

/** When the truck reaches the gate today: already queued, or 10 min before its appointment. */
export function truckArrival(b: Box): number | null {
  if (b.gate.truck_arrived_at) return ms(b.gate.truck_arrived_at)
  if (b.pickup_appointment_at) return ms(b.pickup_appointment_at) - 10 * MIN
  return null
}

export function reeferExtraTrend(b: Box, ctx: Ctx): number {
  const f = ctx.reeferFailure
  return f && b.equipment_type === 'reefer' && b.sensors.yard_position?.startsWith(f.block) ? f.extraTrend : 0
}

export function evaluate(b: Box, ctx: Ctx, rel: Reliability, queued: number): Evaluation {
  const now = ctx.now
  const customsDown = !!ctx.customsOutage && now >= ctx.customsOutage.start && now < ctx.customsOutage.end
  const extraTrend = reeferExtraTrend(b, ctx)

  const attrs: TrustedAttr[] = [
    trustWeight(b, rel, now),
    trustContents(b, rel, now),
    trustRelease(b, rel, now, customsDown),
    trustTemperature(b, rel, now, extraTrend),
    trustDeadline(b, rel, now),
    trustLocation(b, rel, now),
  ]
  const seal = trustSeal(b)
  if (seal) attrs.push(seal)

  // The weight and contents rows can both flag "declared empty but heavy" — keep both rows,
  // count the box once per attribute.
  const conflicts = attrs.map((a) => a.conflict).filter((c): c is Conflict => !!c)
  const severity = maxSeverity(conflicts)

  // Deadline: earliest of line / facility / rail, then any weather pull-forward.
  const cand = deadlineCandidates(b).sort((a, c) => a.ymd.localeCompare(c.ymd))
  let deadline: Evaluation['deadline'] = null
  if (cand.length) {
    const at = deadlineAt(cand[0].ymd)
    let effectiveAt = at
    let effectiveNote: string | null = null
    const w = ctx.weather
    if (w && w.start < at) {
      const cat = b.importer.category
      if (cat === 'relief_supplies' || cat === 'medical' || at <= w.end + 24 * HOUR) {
        effectiveAt = w.start
        effectiveNote = `${w.confirmed ? 'cranes stop' : 'cranes may stop'} ${fmtWeekday(w.start)} ${fmtTime(w.start)}`
      }
    }
    deadline = { ymd: cand[0].ymd, source: cand[0].source, at, effectiveAt, effectiveNote }
  }
  const hoursToDeadline = deadline ? (deadline.effectiveAt - now) / HOUR : null

  const s = b.sensors
  const sp = b.declarations.reefer_setpoint_c
  const reefer = b.equipment_type === 'reefer' && s.reefer_current_c != null && sp != null
    ? { setpoint: sp, current: s.reefer_current_c, dev: s.reefer_current_c - sp, trend: (s.reefer_trend_c_per_hr ?? 0) + extraTrend, alarm: s.reefer_alarm ?? (extraTrend ? 'POWER_OFF' : null), readingAt: s.reefer_reading_at }
    : null

  const dailyCharges = dailyChargesNow(deadline?.at ?? null, now)
  const truckArrive = truckArrival(b)
  const urgency = scoreUrgency({
    box: b, now,
    effectiveDeadline: deadline?.effectiveAt ?? null,
    deadlineNote: deadline?.effectiveNote ?? null,
    reeferDev: reefer?.dev ?? null,
    reeferTrend: reefer?.trend ?? 0,
    dailyCharges,
    truckArrive,
  })

  const active = b.holds_at_pod_terminal.filter((h) => h.status === 'hold')
  const pending = b.holds_at_pod_terminal.filter((h) => h.status === 'pending')
  const available = b.available_for_pickup && !active.length && !pending.length

  const rec = recommend({ box: b, ctx, conflicts, severity, available, urgency, hoursToDeadline, reefer, truckArrive, dailyCharges, queued })

  // Security view: same engine, same data, full reasoning.
  const security: SecurityFinding[] = []
  for (const c of conflicts) if (c.security) security.push({ title: c.summary, detail: c.security, severity: c.severity })
  if (security.length) {
    const early = b.holds_at_pod_terminal.find((h) => h.placed_at && b.pod_arrived_at && ms(h.placed_at) < ms(b.pod_arrived_at))
    if (early) security.push({ title: 'CBP hold placed before arrival', detail: `${early.description} appeared ${fmtDay(early.placed_at!)}, before the vessel arrived: CBP’s own pre-arrival screening also flagged it.`, severity: 'major' })
    const req = b.history.find((h) => h.kind === 'request')
    if (req) security.push({ title: 'Carrier hasn’t confirmed', detail: `${req.text} No reply since ${fmtDay(req.at)}.`, severity: 'major' })
    if (!b.declarations.commodity_text) security.push({ title: 'No commodity on file', detail: 'Neither the carrier nor Terminal49 carries a cargo description for this box.', severity: 'minor' })
  }

  return {
    box: b, attrs, conflicts, severity, security, available,
    blocker: rec.blocker,
    deadline, hoursToDeadline, reefer, dailyCharges, truckArrive, urgency, rec,
  }
}

export function evaluateAll(boxes: Box[], ctx: Ctx, rel: Reliability): Evaluation[] {
  const queued = boxes.filter((b) => b.gate.truck_arrived_at && ms(b.gate.truck_arrived_at) <= ctx.now).length
  return boxes
    .map((b) => evaluate(b, ctx, rel, queued))
    .sort((a, b) => b.urgency.score - a.urgency.score || (a.hoursToDeadline ?? 999) - (b.hoursToDeadline ?? 999))
}
