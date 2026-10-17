// Prints what the engine computes for the scenario, so the demo's headline numbers are checkable.
// Run: npm run report

import { BOXES, HERO_ID, INBOUND } from '../src/data/scenario.ts'
import { buildCtx, NOW } from '../src/engine/context.ts'
import { evaluateAll } from '../src/engine/evaluate.ts'
import { simulate, fullPlan } from '../src/engine/simulate.ts'
import { BASE_RELIABILITY, pct } from '../src/engine/trust.ts'
import { paperworkChecks } from '../src/engine/paperwork.ts'
import { forecast } from '../src/engine/forecast.ts'
import { fmtTime } from '../src/engine/time.ts'
import { usdFull } from '../src/engine/rates.ts'
import type { Mode } from '../src/engine/context.ts'

for (const mode of ['disruption', 'ordinary'] as Mode[]) {
  const ctx = buildCtx(mode, null)
  const evals = evaluateAll(BOXES, ctx, BASE_RELIABILITY)
  const blunt = simulate(evals, ctx, 'blunt')
  const plan = simulate(evals, ctx, 'plan', fullPlan(evals))
  const none = simulate(evals, ctx, 'plan', {})
  console.log(`\n===== ${mode.toUpperCase()} · ${evals.length} boxes · queued ${BOXES.filter((b) => b.gate.truck_arrived_at).length}`)
  const counts: Record<string, number> = {}
  for (const e of evals) counts[e.rec.key] = (counts[e.rec.key] ?? 0) + 1
  console.log('actions', counts, '· critical', evals.filter((e) => e.severity === 'critical').length, '· holds', evals.filter((e) => e.box.holds_at_pod_terminal.length).length)
  for (const s of [blunt, none, plan]) {
    console.log(`${s.label.padEnd(26)} ${s === none ? '(no approvals)' : ''} trucks ${s.trucks} · stranded>3h ${s.stranded3h} · wait ${usdFull(s.truckWaitCost)} · trips ${usdFull(s.wastedTripCost)} · charges ${usdFull(s.chargesCost)} · actions ${usdFull(s.actionCost)} · TOTAL ${usdFull(s.total)} · risk ${s.cargoAtRisk.map((c) => c.cargo).join(', ') || '—'} · missed ${s.missedDeadlines.map((c) => c.cargo).join(', ') || '—'} · rail missed ${s.railMissed.length} · priority by 11:00 ${s.priority.clearedBy11}/${s.priority.total} · rescheduled ${s.rescheduled}`)
  }
  console.log(`plan saves ${Math.round((1 - plan.total / blunt.total) * 100)}% vs blunt`)
  console.log('top 12:')
  for (const e of evals.slice(0, 12)) console.log(`  ${String(e.urgency.score).padStart(3)} ${e.urgency.band.padEnd(8)} ${e.box.number} ${e.box.cargo.padEnd(28)} ${e.rec.key.padEnd(8)} ${plan.assignments[e.box.id]?.text}`)
  for (const id of [HERO_ID, 'sim-0002', 'sim-0003', 'sim-0004', 'sim-0005', 'sim-0006', 'sim-0007', 'sim-0008', 'sim-0009', 'sim-0010', 'sim-0011', 'sim-0012', 'sim-0013', 'sim-0014']) {
    const e = evals.find((x) => x.box.id === id)!
    console.log(`  ${id.padEnd(14)} ${e.box.cargo.padEnd(28)} U${e.urgency.score} ${e.severity ?? '-'} → ${e.rec.key}${e.rec.also.length ? '+' + e.rec.also.join('+') : ''} · ${plan.assignments[id]?.text} · ${e.rec.headline}`)
  }
  for (const e of evals.filter((x) => x.box.real)) console.log(`  REAL ${e.box.number} U${e.urgency.score} ${e.severity ?? '-'} → ${e.rec.key} · ${plan.assignments[e.box.id]?.text}`)
  if (mode === 'disruption') {
    const hero = evals.find((x) => x.box.id === HERO_ID)!
    for (const a of hero.attrs) console.log(`  hero ${a.label.padEnd(22)} ${a.trusted?.value ?? '—'} (${pct(a.trusted?.confidence ?? null)}%) ${a.conflict ? `[${a.conflict.severity}] ${a.conflict.summary}` : ''}`)
    const f = forecast(evals, ctx)
    console.log('jams', f.jams.map((j) => `${fmtTime(j.start)}–${fmtTime(j.end)} queue ${j.peakGap}`).join(' · '), '| planned', f.jamsPlanned.map((j) => `${fmtTime(j.start)}–${fmtTime(j.end)} queue ${j.peakGap}`).join(' · '), '| if wind', f.windJams.map((j) => `${fmtTime(j.start)}–${fmtTime(j.end)} queue ${j.peakGap}`).join(' · '))
    for (const r of f.recs) console.log('  rec', r.title)
  }
}

const asOf = Date.parse('2026-10-27T18:00:00Z')
const flagged = INBOUND.map((r) => ({ r, w: paperworkChecks(r, asOf) }))
console.log(`\nPRE-ARRIVAL: ${flagged.filter((x) => x.w.length).length} conflicts, ${flagged.filter((x) => x.w.length && x.r.resolution).length} resolved before arrival`)
for (const { r, w } of flagged) console.log(`  ${r.number} ${r.resolution ? 'resolved' : 'OPEN    '} ${w.map((x) => `[${x.severity}] ${x.text}`).join(' | ') || 'NO WARNING'}`)
console.log('now', new Date(NOW).toISOString())
