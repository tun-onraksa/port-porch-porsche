// PortAble kit: the box's journey as one status line, like a parcel tracker, but for the terminal planner.
// Terminal49's own tracker ends where the shipper's interest ends; this one carries on through the steps only
// the terminal sees (checks, exception bay, gate lane) and, when a box is stuck, says why, what Priority Lanes
// suggests and who has to approve it. Real Terminal49 steps are drawn solid, simulated steps dashed.
import { Anchor, Check, Hand, PackageCheck, Ship, ShieldCheck, Truck, TrainFront } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '../state.tsx'
import type { Evaluation } from '../engine/types.ts'
import { actionLabel, holdLabel } from '../engine/actions.ts'
import { fmtDayTime, ms } from '../engine/time.ts'
import { cx } from '../ui/primitives.tsx'

type State = 'done' | 'current' | 'stuck' | 'upcoming'
interface Step { key: string; label: string; detail: string; state: State; live: boolean; icon: LucideIcon }

const evAt = (e: Evaluation, name: string) => {
  const x = e.box.events.find((v) => v.event === name && !v.invalidated_at)
  return x ? ms(x.timestamp) : null
}

export function useJourney(e: Evaluation) {
  const app = useApp()
  const b = e.box
  const now = app.ctx.now
  const loaded = evAt(e, 'container.transport.vessel_loaded')
  const sailed = evAt(e, 'container.transport.vessel_departed')
  const arrived = b.pod_arrived_at ? ms(b.pod_arrived_at) : evAt(e, 'container.transport.vessel_arrived')
  const discharged = b.pod_discharged_at ? ms(b.pod_discharged_at) : evAt(e, 'container.transport.vessel_discharged')
  const port = b.events.find((v) => v.event === 'container.transport.vessel_loaded')?.location_name ?? 'origin'
  const asg = app.plan.assignments[b.id]
  const out = app.plan.outcomes[b.id]
  const approval = app.approvals[b.id]
  const holds = b.holds_at_pod_terminal.filter((h) => h.status === 'hold')
  const releaseConflict = e.conflicts.find((c) => c.affectsRelease)
  const blocked = !e.rec.releasable
  const reason = e.blocker ?? e.rec.blocker ?? releaseConflict?.summary ?? (holds.length ? holds.map(holdLabel).join(', ') : null)

  const past = (t: number | null) => t !== null && t <= now
  const steps: Step[] = [
    { key: 'loaded', label: `Loaded at ${port}`, detail: loaded ? fmtDayTime(loaded) : 'Not reported', state: past(loaded) ? 'done' : 'upcoming', live: b.real, icon: PackageCheck },
    { key: 'sailed', label: 'On the ship', detail: `${b.pod_vessel_name} · ${b.voyage_number}`, state: past(sailed) ? 'done' : 'upcoming', live: b.real, icon: Ship },
    { key: 'arrived', label: 'Arrived Los Angeles', detail: arrived ? fmtDayTime(arrived) : 'ETA pending', state: past(arrived) ? 'done' : 'upcoming', live: false, icon: Anchor },
    { key: 'discharged', label: 'Off the ship', detail: discharged ? fmtDayTime(discharged) : 'Not yet', state: past(discharged) ? 'done' : 'upcoming', live: false, icon: Anchor },
    { key: 'checks', label: blocked ? 'Held at the terminal' : 'Cleared to leave', detail: blocked ? (reason ?? 'Waiting on a check') : 'No hold, sources agree', state: !past(discharged) ? 'upcoming' : blocked ? 'stuck' : 'done', live: false, icon: blocked ? Hand : ShieldCheck },
    { key: 'gate', label: asg?.kind === 'rail' ? 'On-dock rail' : 'Gate', detail: asg?.text ?? 'No pickup booked', state: blocked ? 'upcoming' : out?.result === 'served' && out.at !== null && out.at <= now ? 'done' : 'upcoming', live: false, icon: asg?.kind === 'rail' ? TrainFront : Truck },
    { key: 'out', label: 'Out of the terminal', detail: out?.result === 'served' && out.at ? `${out.at <= now ? '' : 'Projected '}${fmtDayTime(out.at)}` : blocked ? 'After release' : 'Not scheduled', state: out?.result === 'served' && out.at !== null && out.at <= now ? 'done' : 'upcoming', live: false, icon: Check },
  ]
  // the first unfinished step is where the box is now (unless it's stuck)
  if (!steps.some((s) => s.state === 'stuck')) {
    const i = steps.findIndex((s) => s.state !== 'done')
    if (i >= 0) steps[i].state = 'current'
  }
  return { steps, blocked, reason, approval, rec: e.rec }
}

const DOT: Record<State, string> = {
  done: 'border-good bg-good text-[#04130a]',
  current: 'border-info bg-info/15 text-info',
  stuck: 'border-crit bg-crit text-white',
  upcoming: 'border-line-2 bg-panel text-dim',
}

export function BoxTracker({ e }: { e: Evaluation }) {
  const { steps, blocked, reason, approval, rec } = useJourney(e)
  const stuck = steps.find((s) => s.state === 'stuck')
  return (
    <section aria-label="Where this box is" className="mb-4 rounded-xl border border-line bg-panel px-4 pt-3.5 pb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-ink">Where this box is</h2>
        <span className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-live" aria-hidden /> Terminal49 data</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-sim" aria-hidden /> Simulated</span>
        </span>
      </div>

      <ol className="grid gap-0 md:grid-cols-7">
        {steps.map((s, i) => {
          const next = steps[i + 1]
          const Icon = s.state === 'done' ? Check : s.icon
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 md:block md:pb-0" aria-current={s.state === 'current' || s.state === 'stuck' ? 'step' : undefined}>
              {/* connector to the next step: vertical on phones, horizontal from md up */}
              {next && <span aria-hidden className={cx('absolute top-8 left-[15px] h-[calc(100%-24px)] w-0 border-l-2 md:top-[15px] md:left-[calc(50%+18px)] md:h-0 md:w-[calc(100%-36px)] md:border-l-0 md:border-t-2',
                next.live ? 'border-solid' : 'border-dashed', s.state === 'done' && (next.state === 'done' || next.state === 'current' || next.state === 'stuck') ? (next.live ? 'border-live' : 'border-good/70') : 'border-line-2')} />}
              <span className={cx('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 md:mx-auto', DOT[s.state], s.state === 'current' && 'pulse-dot')}>
                <Icon size={15} aria-hidden />
              </span>
              <span className="min-w-0 md:mt-2 md:block md:px-1 md:text-center">
                <span className={cx('block text-[12.5px] leading-tight font-semibold', s.state === 'stuck' ? 'text-crit' : s.state === 'upcoming' ? 'text-muted' : 'text-ink')}>{s.label}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{s.detail}</span>
                <span className={cx('mt-1 inline-block text-[9.5px] font-semibold tracking-wider uppercase', s.live ? 'text-live' : 'text-sim')}>{s.live ? 'Terminal49' : 'Simulated'}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {stuck && (
        <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-2 rounded-lg border border-crit/40 bg-crit/[0.07] px-3 py-2.5 text-[13px]">
          <span className="min-w-0 flex-1"><b className="text-crit">Stuck: {stuck.label.toLowerCase()}.</b> <span className="text-ink-2">{reason ?? 'Waiting on a check.'}</span></span>
          <span className="text-ink-2">Suggested: <b className="text-ink">{actionLabel(rec.key)}</b></span>
          <span className={cx('font-medium', approval ? 'text-good' : 'text-warn')}>{approval ? `${approval.state[0].toUpperCase()}${approval.state.slice(1)} by the planner` : 'Waiting for the planner’s approval'}</span>
        </div>
      )}
      {!blocked && !stuck && approval && <p className="mt-3 text-[12.5px] text-good">{approval.state[0].toUpperCase()}{approval.state.slice(1)} by the planner: {actionLabel(approval.key).toLowerCase()}.</p>}
    </section>
  )
}
