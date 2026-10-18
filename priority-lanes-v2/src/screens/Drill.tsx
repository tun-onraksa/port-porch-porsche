import type { LucideIcon } from 'lucide-react'
import { ArrowRight,CloudLightning,PlugZap,ServerOff,Siren,Zap } from 'lucide-react'
import { useMemo } from 'react'
import { BOXES } from '../data/scenario.ts'
import type { DrillId } from '../engine/context.ts'
import { buildCtx,DRILLS } from '../engine/context.ts'
import { evaluateAll } from '../engine/evaluate.ts'
import { usd,usdFull } from '../engine/rates.ts'
import type { SimResult } from '../engine/simulate.ts'
import { fullPlan,simulate } from '../engine/simulate.ts'
import { fmtTime,fmtWeekday } from '../engine/time.ts'
import type { Evaluation } from '../engine/types.ts'
import { useApp } from '../state.tsx'
import { ScreenHeader } from '../ui/layout.tsx'
import { ActionChip,Btn,CargoIcon,cx,Panel,SampleTag } from '../ui/primitives.tsx'

const ICONS: Record<DrillId, LucideIcon> = { lanes_down_6h: Zap, wind_cranes_12h: CloudLightning, customs_outage_4h: ServerOff, reefer_power_r2: PlugZap }

interface Change { before: Evaluation; after: Evaluation; text: string; weight: number }

function slotText(e: Evaluation, s: SimResult) {
  const o = s.outcomes[e.box.id]
  if (o?.result === 'served') return `${fmtWeekday(o.at!).slice(0, 3)} ${fmtTime(o.at!)}`
  if (o?.result === 'rail') return 'on-dock rail'
  if (e.rec.offeredSlot) return `${fmtWeekday(e.rec.offeredSlot).slice(0, 3)} ${fmtTime(e.rec.offeredSlot)}`
  if (e.box.pickup_appointment_at) return `${fmtWeekday(e.box.pickup_appointment_at).slice(0, 3)} ${fmtTime(e.box.pickup_appointment_at)}`
  return 'no slot'
}

export function Drill() {
  const app = useApp()
  const inDrill = app.mode === 'drill'
  const baseCtx = useMemo(() => buildCtx('ordinary', null), [])
  const base = useMemo(() => evaluateAll(BOXES, baseCtx, app.rel), [baseCtx, app.rel])
  const baseSim = useMemo(() => simulate(base, baseCtx, 'plan', fullPlan(base)), [base, baseCtx])

  const changes = useMemo<Change[]>(() => {
    if (!inDrill) return []
    const byId = new Map(base.map((e) => [e.box.id, e]))
    const out: Change[] = []
    for (const after of app.evals) {
      const before = byId.get(after.box.id)!
      const keyChanged = before.rec.key !== after.rec.key
      const sb = slotText(before, baseSim)
      const sa = slotText(after, app.full)
      const slotChanged = sb !== sa && (after.rec.offeredSlot !== before.rec.offeredSlot || keyChanged)
      const du = after.urgency.score - before.urgency.score
      if (!keyChanged && !slotChanged && Math.abs(du) < 4) continue
      const parts: string[] = []
      if (slotChanged) parts.push(after.rec.offerReason === 'weather' ? `pulled forward ${sb} → ${sa}` : `${sb} → ${sa}`)
      if (Math.abs(du) >= 4) parts.push(`urgency ${before.urgency.score} → ${after.urgency.score}`)
      out.push({ before, after, text: parts.join(' · '), weight: (keyChanged ? 50 : 0) + (slotChanged ? 30 : 0) + Math.abs(du) + after.urgency.score / 10 })
    }
    return out.sort((a, b) => b.weight - a.weight)
  }, [inDrill, base, baseSim, app.evals, app.full])

  const meta = DRILLS.find((d) => d.id === app.drill)!
  const start = (id: DrillId) => { app.setDrill(id); app.setMode('drill') }

  return (
    <div>
      <ScreenHeader
        title="Disruption drills" sub="Rehearsal only. Simulation decisions stay unchanged."


        right={inDrill ? <Btn onClick={() => { app.setMode('disruption'); app.go('gate') }}>Exit drill</Btn> : null}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DRILLS.map((d) => {
          const Icon = ICONS[d.id]
          const on = inDrill && app.drill === d.id
          return (
            <button key={d.id} onClick={() => start(d.id)} aria-pressed={on}
              className={cx('rounded-xl border px-4 py-3 text-left transition-colors', on ? 'bg-info/10 border-info/70' : 'border-line bg-panel hover:border-line-2 hover:bg-panel-2')}>
              <div className="flex items-center gap-2">
                <span className={cx('grid size-8 place-items-center rounded-lg', on ? 'bg-warn text-bg' : 'bg-panel-3 text-warn')}><Icon size={16} aria-hidden /></span>
                <span className="text-[14px] font-semibold text-ink">{d.title}</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-ink-2">{({lanes_down_6h:'4 lanes unavailable · 6h',wind_cranes_12h:'Crane shutdown · 12h',customs_outage_4h:'Customs feed unavailable · 4h',reefer_power_r2:'Reefer block R2 loses power'})[d.id]}</p>
              <div className="mt-2 text-[12px] font-medium text-warn">{on ? '● Running' : 'Run drill →'}</div>
            </button>
          )
        })}
      </div>

      {!inDrill ? (
        <Panel title="Choose a disruption">
          <p className="text-[13.5px] text-ink-2">Select a scenario above to compare its effect on 112 containers.</p>
        </Panel>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-warn/50 px-4 py-2.5 text-[13px] font-semibold text-ink" role="status">
            <Siren size={14} className="mr-1.5 inline -translate-y-px text-warn" aria-hidden />
            DRILL — no live actions · {meta.title}
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Panel title="Projected impact"  right={<SampleTag />}>
              <div className="grid grid-cols-2 gap-3">
                <Outcome label={app.blunt.label} s={app.blunt} tone="crit" />
                <Outcome label="Proposed response" s={app.full} tone="good" />
              </div>
              <p className="mt-3 text-[12.5px] leading-snug text-muted">Ordinary-day baseline for comparison: {usdFull(baseSim.total)} projected, {baseSim.stranded3h} stranded.</p>
            </Panel>
            <Panel title={`What changes: ${changes.length} recommendation${changes.length === 1 ? '' : 's'}`}  bodyClass="p-0">
              <ul className="scroll-thin max-h-[420px] overflow-auto">
                {changes.slice(0, 40).map((c) => (
                  <li key={c.after.box.id}>
                    <button onClick={() => app.go('box', c.after.box.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line/70 px-4 py-2 text-left hover:bg-panel-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <CargoIcon kind={c.after.box.kind} />
                          <span className="font-mono text-[12.5px] font-semibold text-ink">{c.after.box.number}</span>
                          <span className="truncate text-[12.5px] text-ink-2">{c.after.box.cargo}</span>
                        </span>
                        <span className="block text-[12px] text-muted">{c.text || c.after.rec.why[0]}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        {c.before.rec.key !== c.after.rec.key && <><ActionChip k={c.before.rec.key} size="sm" /><ArrowRight size={12} className="text-muted" aria-hidden /></>}
                        <ActionChip k={c.after.rec.key} also={c.after.rec.also} size="sm" />
                      </span>
                    </button>
                  </li>
                ))}
                {!changes.length && <li className="px-4 py-6 text-center text-[13px] text-muted">No recommendation changes.</li>}
              </ul>
            </Panel>
          </div>
          <Panel collapsible title="Response details" >
            <ol className="grid gap-2 md:grid-cols-2">
              {changes.slice(0, 6).map((c, i) => (
                <li key={c.after.box.id} className="flex gap-3 rounded-lg border border-line bg-panel-2/60 px-3 py-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-warn/20 font-mono text-[12px] text-warn">{i + 1}</span>
                  <span className="text-[13px] leading-snug text-ink"><strong>{c.after.box.cargo}</strong> ({c.after.box.number}): {c.after.rec.headline}. <span className="text-ink-2">{c.after.rec.why[c.after.rec.why.length - 1]}</span></span>
                </li>
              ))}
            </ol>
          </Panel>
        </>
      )}
    </div>
  )
}

function Outcome({ label, s, tone }: { label: string; s: SimResult; tone: 'crit' | 'good' }) {
  return (
    <div className={cx('rounded-lg border px-3 py-2.5', tone === 'crit' ? 'border-crit/40 bg-crit/[0.05]' : 'border-good/40 bg-good/[0.05]')}>
      <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</div>
      <div className="mt-1 font-mono text-[22px] text-ink">{usd(s.total)}</div>
      <dl className="mt-1 space-y-0.5 text-[12px] text-ink-2">
        <div className="flex justify-between"><dt>Stranded &gt; 3h</dt><dd className="font-mono text-ink">{s.stranded3h}</dd></div>
        <div className="flex justify-between"><dt>Missed deadlines</dt><dd className="font-mono text-ink">{s.missedDeadlines.length}</dd></div>
        <div className="flex justify-between"><dt>Cargo at risk</dt><dd className="font-mono text-ink">{s.cargoAtRisk.length}</dd></div>
        <div className="flex justify-between"><dt>Rail cutoffs missed</dt><dd className="font-mono text-ink">{s.railMissed.length}</dd></div>
        <div className="flex justify-between" title={s.windStuck.map((x) => x.cargo).join(', ')}><dt>Stuck behind wind window</dt><dd className="font-mono text-ink">{s.windStuck.length}</dd></div>
      </dl>
    </div>
  )
}
