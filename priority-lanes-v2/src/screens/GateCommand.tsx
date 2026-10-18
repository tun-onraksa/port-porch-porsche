import { Check,CircleCheck,Gauge,OctagonAlert,PowerOff,RotateCcw,Search,Truck,Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo,useState } from 'react'
import { HERO_ID } from '../data/scenario.ts'
import { actionLabel } from '../engine/actions.ts'
import { LANES,backgroundPerHour,laneDown,openLanes } from '../engine/context.ts'
import { RATES,usd,usdFull } from '../engine/rates.ts'
import type { SimResult } from '../engine/simulate.ts'
import { HOUR,fmtTime } from '../engine/time.ts'
import type { Evaluation } from '../engine/types.ts'
import type { Approval } from '../state.tsx'
import { useApp } from '../state.tsx'
import { ScreenHeader } from '../ui/layout.tsx'
import { ActionChip,Btn,CargoIcon,Countdown,Disclosure,HoldChips,Kpi,Panel,RealTag,SeverityBadge,UrgencyPill,cx } from '../ui/primitives.tsx'

type Filter = 'all' | 'attention' | 'blocked' | 'reefer' | 'real'

export function GateCommand() {
  const app = useApp()
  const { evals, ctx } = app
  const now = ctx.now
  const queued = evals.filter((e) => e.box.gate.truck_arrived_at)
  const open = openLanes(ctx, now)
  const perLane=ctx.resourcePlan?.gateProductivity??RATES.laneThroughput
  const configured=ctx.resourcePlan?.gates??8
  const capNow = open.length * perLane
  const nextHour = evals.filter((e) => e.truckArrive !== null && e.truckArrive > now && e.truckArrive <= now + HOUR).length
  const demand = queued.length + nextHour + backgroundPerHour(now,ctx)


  const critical = evals.filter((e) => e.severity === 'critical')





  return (
    <div>
      <ScreenHeader
        title="Gate command"


      />
      <div className="quiet-metrics mb-4">
        <Kpi icon={Truck} label="Queued" value={queued.length}/>
        <Kpi icon={Gauge} label="Capacity / demand" value={`${capNow} / ${demand}`} sub="trucks per hour"/>
        <Kpi icon={OctagonAlert} label="Critical conflicts" value={critical.length} onClick={()=>app.go('box',critical[0]?.box.id??HERO_ID)}/>
      </div>
      <BluntVsGentle />
      <Disclosure title={`Gate lanes · ${open.length} of ${configured} open`}>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" role="list" aria-label="Gate lanes">
        {LANES.slice(0,configured).map((l) => {
          const down = laneDown(ctx, l.id, now)
          const served = Object.values(app.full.outcomes).filter((o) => o.lane === l.id && o.result === 'served').length
          return (
            <div role="listitem" key={l.id} className={cx('rounded-xl border px-3 py-2.5', down ? 'border-crit/50 bg-crit/[0.07]' : 'border-line bg-panel')}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-semibold">Lane {l.id}</span>
                {down ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink"><PowerOff size={13} className="text-crit" aria-hidden /> Down</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink"><CircleCheck size={13} className="text-good" aria-hidden /> {open.includes(l.id)?'Open':'Unstaffed / closed'}</span>
                )}
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted">{down ? `${down.reason} · ETA ${fmtTime(down.end)}` : l.role}</div>
              <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-2">
                <span>{open.includes(l.id)?perLane:0}/hr</span>
                <span>{served ? `${served} planned` : ''}</span>
              </div>
            </div>
          )
        })}
      </div>

      </Disclosure>
      <Queue />
    </div>
  )
}

function Row({ label, blunt, plan, better, hint }: { label: string; blunt: ReactNode; plan: ReactNode; better?: boolean; hint?: string }) {
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className="py-2 pr-3 text-left text-[12.5px] font-medium text-ink-2" title={hint}>{label}</th>
      <td className="py-2 pr-3 text-[13px] text-ink">{blunt}</td>
      <td className={cx('py-2 text-[13px] text-ink', better && 'font-semibold')}>
        {plan}
      </td>
    </tr>
  )
}

function outcomeList(items: { cargo: string }[], empty = 'None') {
  if (!items.length) return <span className="inline-flex items-center gap-1 text-ink"><CircleCheck size={13} className="text-good" aria-hidden />{empty}</span>
  const names = [...new Set(items.map((i) => i.cargo))]
  return <span title={names.join(', ')}>{items.length} · {names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}</span>
}

function BluntVsGentle() {
  const app = useApp()
  const { blunt, plan, full, evals, mode, pending } = app
  const approved = evals.length - pending
  const fully = pending === 0
  const insulin = (s: SimResult) => {
    const missed = s.missedDeadlines.some((m) => m.boxId === 'sim-0002')
    return missed ? <span className="inline-flex items-center gap-1"><OctagonAlert size={13} className="text-crit" aria-hidden /> Misses 17:00</span> : <span className="inline-flex items-center gap-1"><CircleCheck size={13} className="text-good" aria-hidden /> Out {fmtTime(s.outcomes['sim-0002']?.at ?? 0)}</span>
  }
  const risk = (s: SimResult) => {
    if (!s.cargoAtRisk.length) return <span className="inline-flex items-center gap-1"><CircleCheck size={13} className="text-good" aria-hidden /> None</span>
    const v = s.cargoAtRisk.reduce((x, c) => x + (c.value ?? 0), 0)
    const unknown = s.cargoAtRisk.filter((c) => c.value === null).length
    return <span title={s.cargoAtRisk.map((c) => c.cargo).join(', ')}>{usd(v)}{unknown ? ` + ${unknown} undeclared` : ''}<span className="block text-[11.5px] font-normal text-muted">{s.cargoAtRisk.map((c) => c.cargo).slice(0, 3).join(', ')}</span></span>
  }
  const saved = blunt.total ? Math.round((1 - plan.total / blunt.total) * 100) : 0
  const savedFull = blunt.total ? Math.round((1 - full.total / blunt.total) * 100) : 0

  return (
    <Panel
      className="mb-4" title="Gate plan"


      bodyClass="px-4 pb-4 pt-1"
    >
      <div className="plan-outcome"><div><span>Projected delay & handling</span><strong>{usdFull(plan.total)}</strong><small>Excludes terminal operating cost</small></div><div><span>Trucks waiting over 3h</span><strong>{plan.stranded3h}</strong></div></div>
      <Disclosure title="Compare costs & outcomes">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
            <th className="py-2 font-semibold" />
            <th className="py-2 font-semibold"><span className="inline-flex items-center gap-1"><PowerOff size={12} className="text-crit" aria-hidden />{blunt.label}</span></th>
            <th className="py-2 font-semibold"><span className="inline-flex items-center gap-1"><CircleCheck size={12} className="text-good" aria-hidden />Plan · {fully ? 'approved' : `${approved}/${evals.length} approved`}</span></th>
          </tr>
        </thead>
        <tbody>
          <Row label="Trucks stranded > 3h" blunt={<span className="font-mono text-[18px]">{blunt.stranded3h}</span>} plan={<span className="font-mono text-[18px]">{plan.stranded3h}</span>} better={plan.stranded3h < blunt.stranded3h} />
          <Row label="Projected charges + truck waiting" hint="Truck waiting beyond a 1h turn at $90/h, wasted trips, demurrage + storage for boxes that miss deadlines, action costs. Exam fees excluded (same in both)."
            blunt={<span className="font-mono text-[18px]">{usdFull(blunt.total)}</span>}
            plan={<span className="font-mono text-[18px]">{usdFull(plan.total)} {saved > 0 && <span className="ml-1 rounded bg-good/15 px-1.5 py-px font-sans text-[12px] font-semibold text-good">−{saved}%</span>}</span>} better />
          <Row label="Cargo at risk (spoilage)" blunt={risk(blunt)} plan={risk(plan)} />
          <Row label="Boxes held / inspected"
            blunt={blunt.heldAll ? `All ${blunt.heldBoxes} held until 14:00 · 0 inspected` : `${blunt.missedDeadlines.length} miss deadlines · holds found at the lane`}
            plan={`${plan.inspectedForConflict} inspected for a conflict · ${plan.examsExpedited} exams expedited · ${plan.rescheduled} moved later`} />
          <Row label="Insulin, deadline 17:00" blunt={insulin(blunt)} plan={insulin(plan)} />
          <Row label="Rail cutoffs missed" blunt={outcomeList(blunt.railMissed)} plan={outcomeList(plan.railMissed)} />
          <Row label="Medical / reefer / relief / rail out by 11:00" blunt={`${blunt.priority.clearedBy11} of ${blunt.priority.total}`} plan={`${plan.priority.clearedBy11} of ${plan.priority.total}`} />
        </tbody>
      </table></Disclosure>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        {mode === 'drill' ? (
          <p className="text-[12.5px] text-warn">Drill · approvals disabled.</p>
        ) : fully ? (
          <>
            <span className="flash-in inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-good"><CircleCheck size={16} aria-hidden /> Plan approved</span>
            <Btn size="sm" variant="quiet" onClick={app.resetApprovals}><RotateCcw size={13} aria-hidden /> Reset demo</Btn>
          </>
        ) : (
          <>
            <Btn size="lg" variant="good" onClick={app.approveAll}><Check size={17} aria-hidden /> Approve plan ({pending} actions)</Btn>
            <span className="text-[12.5px] leading-snug text-muted">Full approval: <span className="font-mono text-ink">{usdFull(full.total)}</span> (−{savedFull}%), {full.stranded3h} stranded. </span>
          </>
        )}
      </div>
    </Panel>
  )
}

function DecisionCell({ e, a }: { e: Evaluation; a: Approval | undefined }) {
  const app = useApp()
  if (app.mode === 'drill') return <span className="text-[11.5px] text-warn">Drill</span>
  if (!a) {
    return (
      <Btn size="sm" onClick={() => app.approve(e)} title={`Approve: ${actionLabel(e.rec.key)}`}>
        <Check size={13} aria-hidden /> Approve
      </Btn>
    )
  }
  const meta = { approved: ['Approved', 'text-good'], modified: ['Modified', 'text-warn'], rejected: ['Rejected', 'text-crit'] }[a.state]
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap" title={a.reason}>
      {a.state === 'approved' ? <CircleCheck size={13} className="text-good" aria-hidden /> : <Undo2 size={13} className={meta[1]} aria-hidden />}
      <span className="text-ink">{meta[0]}</span>
      {a.state === 'modified' && <span className="text-muted">→ {actionLabel(a.key)}</span>}
    </span>
  )
}

function Queue() {
  const app = useApp()
  const { evals, approvals, plan, full, view } = app
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)

  const rows = useMemo(() => {
    let r = evals
    if (filter === 'attention') r = r.filter((e) => e.rec.key !== 'release' || e.conflicts.some((c) => c.severity !== 'minor'))
    if (filter === 'blocked') r = r.filter((e) => !e.rec.releasable)
    if (filter === 'reefer') r = r.filter((e) => e.box.equipment_type === 'reefer')
    if (filter === 'real') r = r.filter((e) => e.box.real)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      r = r.filter((e) => e.box.number.toLowerCase().includes(s) || e.box.cargo.toLowerCase().includes(s))
    }
    return r
  }, [evals, filter, q])
  const visible = showAll || q || filter !== 'all' ? rows : rows.slice(0, 12)
  const count = (f: Filter) => (f === 'all' ? evals.length : f === 'attention' ? evals.filter((e) => e.rec.key !== 'release' || e.conflicts.some((c) => c.severity !== 'minor')).length : f === 'blocked' ? evals.filter((e) => !e.rec.releasable).length : f === 'reefer' ? evals.filter((e) => e.box.equipment_type === 'reefer').length : 4)

  return (
    <Panel
      title="Cargo queue"

      bodyClass="p-0"
      right={
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Container or cargo" aria-label="Search boxes"
            className="h-8 w-48 rounded-lg border border-line-2 bg-bg pr-2 pl-8 text-[12.5px] text-ink placeholder:text-dim" />
        </label>
      }
    >
      <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-3 py-2" role="tablist" aria-label="Filter boxes">
        {([['all', 'All'], ['attention', 'Needs a decision'], ['blocked', 'Blocked'], ['reefer', 'Reefers'], ['real', 'Real boxes']] as [Filter, string][]).map(([f, l]) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={cx('shrink-0 rounded-md px-2.5 py-1 text-[12.5px] font-medium', filter === f ? 'bg-panel-3 text-ink' : 'text-muted hover:text-ink')}>
            {l} <span className="font-mono text-[11px] text-dim">{count(f)}</span>
          </button>
        ))}
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="text-[10.5px] tracking-wider text-muted uppercase">
            <tr className="border-b border-line">
              {['#', 'Container', 'Cargo', 'Priority', 'Hold / conflict', 'Deadline', 'Lane / slot', 'Recommended · decision'].map((h) => (
                <th key={h} scope="col" className="px-2.5 py-2 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const rank = evals.indexOf(e) + 1
              const a = approvals[e.box.id]
              const asg = (a ? plan : full).assignments[e.box.id]
              const top = [...e.conflicts].sort((x, y) => rank3(y.severity) - rank3(x.severity))[0]
              const securityCase = e.security.length > 0
              const isHero = e.box.id === HERO_ID
              return (
                <tr key={e.box.id} onClick={() => app.go('box', e.box.id)}
                  className={cx('cursor-pointer border-b border-line/70 text-[12.5px] transition-colors hover:bg-panel-2', isHero && 'bg-crit/[0.05]')}>
                  <td className="px-2.5 py-2 font-mono text-[11.5px] text-dim">{rank}</td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <button onClick={()=>app.go('box',e.box.id)} className="font-mono text-[13px] font-semibold text-info">{e.box.number}</button>
                      {e.box.real && <RealTag />}
                    </div>
                    <div className="text-[11px] whitespace-nowrap text-dim" title={e.box.pod_vessel_name}>{e.box.equipment_length_ft}' {e.box.equipment_type}</div>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="inline-flex max-w-[132px] items-center gap-1.5 text-ink-2" title={e.box.cargo}><CargoIcon kind={e.box.kind} /> <span className="truncate">{e.box.cargo}</span></span>
                  </td>
                  <td className="px-2.5 py-2">
                    <UrgencyPill u={e.urgency} size="sm" />

                  </td>
                  <td className="px-2.5 py-2" title={top?.summary}>
                    <div className="flex flex-col items-start gap-1">
                      {top ? <SeverityBadge s={top.severity} size="sm" label={securityCase && view === 'ops' && top.severity === 'critical' ? 'Inspection requested' : undefined} /> : !e.box.holds_at_pod_terminal.length && <span className="text-[11.5px] text-dim">—</span>}
                      {e.box.holds_at_pod_terminal.length > 0 && <HoldChips holds={e.box.holds_at_pod_terminal} />}
                    </div>
                  </td>
                  <td className="px-2.5 py-2"><Countdown hours={e.hoursToDeadline} note={e.deadline?.effectiveNote} /></td>

                  <td className={cx('px-2.5 py-2 font-mono text-[12px] whitespace-nowrap', a ? 'text-ink' : 'text-muted')} title={a ? 'Approved slot' : 'Proposed slot (not yet approved)'}>
                    {asg?.text ?? '—'}
                  </td>
                  <td className="px-2.5 py-2" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <ActionChip k={a?.state === 'modified' ? a.key : e.rec.key} also={a?.state === 'modified' ? [] : e.rec.also} size="sm" />
                      <DecisionCell e={e} a={a} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!showAll && !q && filter === 'all' && rows.length > 12 && (
        <div className="border-t border-line px-4 py-2.5 text-center">
          <Btn size="sm" variant="quiet" onClick={() => setShowAll(true)}>Show all {rows.length} boxes</Btn>
        </div>
      )}
    </Panel>
  )
}

const rank3 = (s: string) => (s === 'critical' ? 3 : s === 'major' ? 2 : 1)
