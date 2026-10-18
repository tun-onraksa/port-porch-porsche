// Review priority for Security review, scored by Yunna's "At the Gate weighted v1" model (logic/priorityLogic.js).
// Her model is used unchanged; this file only translates our box evaluations into the shape it expects.
import { useMemo } from 'react'
import { useApp } from '../state.tsx'
import type { Evaluation } from '../engine/types.ts'
import { calculatePriority } from '../logic/priorityLogic.js'
import type { Priority, PriorityInput } from '../logic/priorityLogic.js'
import { cx } from '../ui/primitives.tsx'

export function toPriorityInput(e: Evaluation, inspecting: boolean): PriorityInput {
  const b = e.box
  const scale = b.sensors.gate_scale_weight_kg ?? b.sensors.crane_weight_kg ?? 0
  return {
    scenario: {
      carrierRecord: b.declarations.carrier_declared_status === 'empty' ? 'EMPTY' : 'FULL',
      terminalScaleKg: scale,
      inspectionRequired: e.rec.key === 'inspect' || e.security.length > 0,
      customsHold: b.holds_at_pod_terminal.some((h) => h.status === 'hold' && (h.name === 'customs' || h.name === 'VACIS' || h.name === 'USDA')),
      lastFreeDay: e.hoursToDeadline !== null && e.hoursToDeadline >= 0 && e.hoursToDeadline <= 24 ? 'Tomorrow' : undefined,
      hourlyCostExposure: Math.round(e.dailyCharges / 24),
    },
    simulation: {
      inspected: false,
      location: inspecting ? 'INSPECTION' : undefined,
      risk: e.severity === 'critical' ? 'HIGH' : e.severity === 'major' ? 'MEDIUM' : 'LOW',
    },
  }
}

/** Yunna's score for every box, keyed by container number. */
export function useReviewPriority(): Map<string, Priority> {
  const { evals, approvals } = useApp()
  return useMemo(() => new Map(evals.map((e) => {
    const a = approvals[e.box.id]
    const inspecting = !!a && a.state !== 'rejected' && (a.state === 'modified' ? a.key : e.rec.key) === 'inspect'
    return [e.box.number, calculatePriority(toPriorityInput(e, inspecting))]
  })), [evals, approvals])
}

const LEVEL: Record<Priority['level'], string> = { CRITICAL: 'bg-crit/12 text-crit', HIGH: 'bg-warn/12 text-warn', MEDIUM: 'bg-info/10 text-info', LOW: 'bg-panel-2 text-muted' }

export function ReviewScore({ p }: { p: Priority | undefined }) {
  if (!p) return null
  return <span className={cx('rounded-md px-1.5 py-0.5 text-[12px] font-semibold whitespace-nowrap', LEVEL[p.level])} title="Review priority · At the Gate weighted v1">{p.score} · {p.level[0]}{p.level.slice(1).toLowerCase()}</span>
}

export function ReviewReasons({ p }: { p: Priority | undefined }) {
  if (!p || !p.reasons.length) return null
  const raw = p.reasons.reduce((t, r) => t + r.points, 0)
  return (
    <details className="quiet-disclosure"><summary>Why {p.score} · review priority</summary>
      <div className="disclosure-body">
        <ul className="grid gap-1 text-[13px]">{p.reasons.map((r) => <li key={r.factor} className="flex justify-between gap-3"><span>{r.explanation}</span><span className="font-mono text-ink">+{r.points}</span></li>)}</ul>
        {raw > p.score && <p className="simulation-note">Raw total {raw}, capped at 100. A review score is not a probability or a release decision.</p>}
      </div>
    </details>
  )
}
