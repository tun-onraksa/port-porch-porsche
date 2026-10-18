import { Anchor,ArrowLeft,Check,CircleCheck,FileText,Lock,Pencil,ShieldAlert,ThumbsDown,Truck,X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo,useState } from 'react'
import { BOXES,HERO_ID } from '../data/scenario.ts'
import { actionLabel,ACTIONS } from '../engine/actions.ts'
import { usdFull } from '../engine/rates.ts'
import { fmtDay,fmtDayTime,fmtTime,fmtWeekday,ms } from '../engine/time.ts'
import { eventLabel,pct } from '../engine/trust.ts'
import type { ActionKey,Cell,ColKey,Evaluation } from '../engine/types.ts'
import { CATEGORY_LABEL } from '../engine/urgency.ts'
import { useApp } from '../state.tsx'
import { Modal,ScreenHeader } from '../ui/layout.tsx'
import { ACTION_COLOR,ACTION_ICON,ActionChip,BAND_COLOR,Btn,CargoIcon,ConfidenceBar,cx,Disclosure,Panel,SeverityBadge,T49Urgency,UrgencyPill } from '../ui/primitives.tsx'

const COLS: { key: ColKey; label: string; sub: string }[] = [
  { key: 'carrier', label: 'Carrier declaration', sub: 'booking / manifest' },
  { key: 'vgm', label: 'VGM', sub: 'verified gross mass' },
  { key: 't49', label: 'Terminal49', sub: 'API fields · data_source' },
  { key: 'terminal', label: 'Terminal systems', sub: 'TOS · crane · gate' },
  { key: 'reefer', label: 'Reefer sensor', sub: 'live telemetry' },
  { key: 'customs', label: 'Customs', sub: 'CBP / USDA' },
]

const SPOTLIGHT = [HERO_ID, 'sim-0002', 'sim-0003', 'sim-0004', 'sim-0006', 'sim-0007', 'sim-0008', 'sim-0009', 'sim-0010', 'sim-0013']

export function BoxDetail({embedded=false,onInspect}:{embedded?:boolean;onInspect?:()=>void}) {
  const app = useApp()
  const e = app.evalById(app.boxId) ?? app.evalById(HERO_ID)!
  const b = e.box
  const [modal, setModal] = useState<'modify' | 'reject' | null>(null)
  const a = app.approvals[b.id]
  const security = app.view === 'security'

  const realBoxes = BOXES.filter((x) => x.real)
  return (
    <div>
      {!embedded&&<Btn size="sm" variant="quiet" className="mb-3" onClick={()=>app.go('gate')}><ArrowLeft size={16} aria-hidden/>Gate command</Btn>}
      <ScreenHeader title="Cargo evidence" right={<div className="cargo-header-actions">
        <label className="cargo-selector ml-auto flex items-center gap-2 text-[12.5px] text-muted">
          Box
          <select value={b.id} onChange={(ev) => app.go('box', ev.target.value)} className="h-8 max-w-[300px] rounded-lg border border-line-2 bg-panel px-2 font-mono text-[12.5px] text-ink">
            <optgroup label="Scenario boxes">
              {SPOTLIGHT.map((id) => { const x = BOXES.find((y) => y.id === id)!; return <option key={id} value={id}>{x.number} · {x.cargo}</option> })}
            </optgroup>
            <optgroup label="Real Terminal49 containers">
              {realBoxes.map((x) => <option key={x.id} value={x.id}>{x.number} · {x.cargo}</option>)}
            </optgroup>
            {!SPOTLIGHT.includes(b.id) && !b.real && <option value={b.id}>{b.number} · {b.cargo}</option>}
          </select>
        </label>
        {onInspect&&<Btn onClick={onInspect}>Inspect in 3D →</Btn>}
      </div>}/>

      {/* header strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <CargoIcon kind={b.kind} size={18} />
            <span className="font-mono text-[22px] font-semibold tracking-tight">{b.number}</span>
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted">{b.equipment_length_ft}' {b.equipment_height === 'high_cube' ? 'HC ' : ''}{b.equipment_type} · {b.cargo}</div>
        </div>
        <Fact k="B/L · carrier" v={`${b.bill_of_lading} · ${b.shipping_line_name}`} />
        <Fact k="Vessel" v={`${b.pod_vessel_name} ${b.voyage_number}`} />
        <Fact k="Yard (TOS)" v={b.sensors.yard_position ? `${b.sensors.yard_position} · ${b.sensors.dig_moves} dig` : '—'} />
        <Fact k="Importer category" v={b.importer.category ? `${CATEGORY_LABEL[b.importer.category]}${b.importer.verified ? ' ✓' : ''}` : 'Not declared'} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SeverityBadge s={e.severity} size="lg" label={e.severity === 'critical' && e.security.length && !security ? 'Critical · Inspection requested' : undefined} />
          <ActionChip k={a?.state === 'modified' ? a.key : e.rec.key} also={e.rec.also} size="lg" />
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <RecommendationCard e={e} onModify={() => setModal('modify')} onReject={() => setModal('reject')} />
        <UrgencyCard e={e} />
      </div>

      <SourceTable e={e} />

      {security && e.security.length > 0 && <SecurityPanel e={e} />}
      {!security && e.security.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-[13px] text-ink-2">
          <Lock size={16} className="shrink-0 text-muted" aria-hidden />
          <span><strong className="text-ink">Inspection requested.</strong> Review the security evidence.</span>
          <Btn size="sm" className="ml-auto" onClick={() => app.setView('security')}><ShieldAlert size={13} aria-hidden /> Security evidence</Btn>
        </div>
      )}

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Ladder e={e} />
        <div className="space-y-4">
          <Tasks e={e} />
          <WhenWeKnew e={e} />
        </div>
      </div>

      <DecisionModal open={modal} e={e} onClose={() => setModal(null)} />
    </div>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">{k}</div>
      <div className="font-mono text-[12.5px] text-ink">{v}</div>
    </div>
  )
}

function UrgencyCard({ e }: { e: Evaluation }) {
  const u = e.urgency
  const c = BAND_COLOR[u.band]
  return (
    <Panel title="Priority" >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <UrgencyPill u={u} size="lg" />
        <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
          <div className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">Terminal49 urgency</div>
          <div className="mt-0.5 text-[15px]"><T49Urgency value={e.box.urgency} simulated={e.box.urgency_simulated} /></div>

        </div>
      </div>
      <Disclosure title="Score calculation"><div className="mt-4">
        <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px] bg-line" role="img" aria-label={`Score breakdown: ${u.factors.map((f) => `${f.label} ${f.points}`).join(', ')}`}>
          {u.factors.filter((f) => f.points > 0).map((f, i) => (
            <span key={f.key} title={`${f.label}: ${f.points}`} style={{ width: `${f.points}%`, background: c, opacity: 1 - i * 0.11 }} />
          ))}
        </div>
        <div className="relative mt-1 h-4 font-mono text-[10.5px] text-dim" aria-hidden>
          <span className="absolute left-0">0</span>
          {[[40, 'normal'], [60, 'high'], [80, 'critical']].map(([v, l]) => (
            <span key={v} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${v}%` }}>{v}<span className="hidden sm:inline"> {l}</span></span>
          ))}
          <span className="absolute right-0">100</span>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line/70">
        {u.factors.map((f) => (
          <li key={f.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-1.5 text-[12.5px] sm:grid-cols-[150px_70px_minmax(0,1fr)]">
            <span className="font-medium text-ink-2">{f.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="relative h-1.5 w-8 rounded-full bg-line-2"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(f.points / f.max) * 100}%`, background: c }} /></span>
              <span className="font-mono text-ink">{f.points}<span className="text-dim">/{f.max}</span></span>
            </span>
            <span className="col-span-2 text-ink-2 sm:col-span-1">{f.why}</span>
          </li>
        ))}
      </ul></Disclosure>
    </Panel>
  )
}

function RecommendationCard({ e, onModify, onReject }: { e: Evaluation; onModify: () => void; onReject: () => void }) {
  const app = useApp()
  const r = e.rec
  const a = app.approvals[e.box.id]
  const asg = (a ? app.plan : app.full).assignments[e.box.id]
  const Icon = ACTION_ICON[r.key]
  return (
    <Panel title="Recommendation"
      right={<span className="text-[12px] text-muted">Step {r.step} of 8</span>}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${ACTION_COLOR[r.key]} 20%, transparent)` }}>
          <Icon size={22} style={{ color: ACTION_COLOR[r.key] }} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[18px] leading-tight font-semibold">{r.headline}</div>
          {asg && <div className="mt-0.5 font-mono text-[12.5px] text-ink-2">{asg.text}{!a && asg.kind !== 'none' && <span className="ml-1 font-sans text-dim">(proposed)</span>}</div>}
        </div>
      </div>

      <ul className="space-y-1">
        {r.why.map((w) => <li key={w} className="flex gap-2 text-[13.5px] leading-snug text-ink"><span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted" />{w}</li>)}
      </ul>
      <Disclosure title="Action cost & alternatives"><div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
          <div className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">Cost of this action</div>
          <div className="font-mono text-[17px] text-ink">{usdFull(r.cost)}</div>
          <div className="text-[11.5px] leading-snug text-ink-2">{r.costNote}</div>
        </div>
        {r.nextBlunter && (
          <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
            <div className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">Next blunter: {actionLabel(r.nextBlunter.key)}</div>
            <div className="font-mono text-[17px] text-ink">{r.nextBlunter.cost === null ? 'n/a' : usdFull(r.nextBlunter.cost)}</div>
            <div className="text-[11.5px] leading-snug text-ink-2">{r.nextBlunter.note}</div>
          </div>
        )}
      </div>
      </Disclosure>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {app.mode === 'drill' ? (
          <span className="text-[12.5px] text-warn">Drill: no live actions.</span>
        ) : a ? (
          <span className="inline-flex flex-wrap items-center gap-2 text-[13px]">
            <CircleCheck size={16} className={a.state === 'rejected' ? 'text-crit' : a.state === 'modified' ? 'text-warn' : 'text-good'} aria-hidden />
            <strong>{a.state === 'approved' ? 'Approved' : a.state === 'modified' ? `Modified to ${actionLabel(a.key)}` : 'Rejected'}</strong>
            <span className="text-muted">at {fmtTime(a.at)}{a.reason ? ` · “${a.reason}”` : ''}</span>
          </span>
        ) : (
          <>
            <Btn variant="good" onClick={() => app.approve(e)}><Check size={15} aria-hidden /> Approve</Btn>
            <Btn onClick={onModify}><Pencil size={14} aria-hidden /> Modify</Btn>
            <Btn variant="danger" onClick={onReject}><ThumbsDown size={14} aria-hidden /> Reject</Btn>
          </>
        )}
      </div>
    </Panel>
  )
}

function CellView({ c }: { c: Cell }) {
  const tone = {
    trusted: 'border-good/50 bg-good/[0.08]',
    conflict: 'border-warn/50 bg-warn/[0.07]',
    rejected: 'border-crit/50 bg-crit/[0.07]',
    agree: 'border-line-2 bg-panel-2',
    muted: 'border-transparent bg-transparent',
  }[c.tone ?? 'agree']
  return (
    <div className={cx('rounded-md border px-2 py-1.5', tone)}>
      <div className={cx('text-[12.5px] leading-snug font-medium', c.tone === 'muted' ? 'text-dim' : 'text-ink', c.strike && 'line-through decoration-crit decoration-2')}>
        {c.tone === 'rejected' && <X size={12} className="mr-1 inline -translate-y-px text-crit" aria-label="rejected" />}
        {c.tone === 'trusted' && <Check size={12} className="mr-1 inline -translate-y-px text-good" aria-label="trusted source" />}
        {c.value}
      </div>
      {c.sub && <div className={cx('text-[11px] leading-snug', c.strike ? 'text-crit' : 'text-muted')}>{c.sub}</div>}
      <div className="flex flex-wrap gap-x-2">
        {c.tag && <span className="font-mono text-[10.5px] text-ink-2">data_source: {c.tag}</span>}
        {c.at && <span className="font-mono text-[10.5px] text-dim">{fmtDayTime(c.at)}</span>}
      </div>
    </div>
  )
}

function SourceTable({ e }: { e: Evaluation }) {
  const [all,setAll]=useState(false);const attrs=all?e.attrs:e.attrs.filter(a=>a.conflict);
  return (
    <Panel className="mb-4" title="Source comparison"

      right={<Btn size="sm" onClick={()=>setAll(v=>!v)}>{all?'Conflicts only':'All fields'}</Btn>}
      bodyClass="p-0">
      {!attrs.length&&<p className="p-4 text-muted">No conflicting fields. Select All fields to inspect sources.</p>}
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed text-left [overflow-wrap:anywhere]">
          <colgroup>
            <col className="w-[112px]" />
            {COLS.map((c) => <col key={c.key} />)}
            <col className="w-[270px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <th className="px-3 py-2" />
              {COLS.map((c) => (
                <th key={c.key} scope="col" className="px-2 py-2 align-bottom">
                  <div className="text-[12px] font-semibold text-ink">{c.label}</div>
                  <div className="text-[10.5px] font-normal text-muted">{c.sub}</div>
                </th>
              ))}
              <th scope="col" className="border-l border-line bg-panel-2 px-3 py-2 align-bottom">
                <div className="text-[12px] font-semibold text-ink">Trusted value</div>
                <div className="text-[10.5px] font-normal text-muted">confidence · why</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {attrs.map((attr) => (
              <tr key={attr.key} className={cx('border-b border-line/70 align-top', attr.conflict?.severity === 'critical' && 'bg-crit/[0.04]')}>
                <th scope="row" className="px-3 py-2.5">
                  <div className="text-[13px] font-semibold text-ink">{attr.label}</div>
                  {attr.conflict && <div className="mt-1"><SeverityBadge s={attr.conflict.severity} size="sm" /></div>}
                </th>
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-2.5">
                    <div className="space-y-1">
                      {(attr.cells[c.key] ?? []).map((cell, i) => <CellView key={i} c={cell} />)}
                      {!attr.cells[c.key] && <span className="block px-2 py-1.5 text-[12px] text-dim">—</span>}
                    </div>
                  </td>
                ))}
                <td className="border-l border-line bg-panel-2/70 px-3 py-2.5">
                  {attr.trusted ? (
                    <>
                      <div className="text-[13.5px] font-semibold text-ink">{attr.trusted.value}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                        {attr.trusted.source}
                        <ConfidenceBar c={attr.trusted.confidence} compact />
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-ink-2">{attr.trusted.reason}</p>
                      {attr.conflict && <p className="mt-1 text-[12px] leading-snug text-ink"><span className="font-semibold">Conflict:</span> {attr.conflict.summary}</p>}
                      {attr.trusted.confidence && (
                        <p className="mt-1 font-mono text-[10.5px] text-dim">
                          {attr.trusted.confidence.authority.toFixed(2)} × {attr.trusted.confidence.freshness.toFixed(2)} × {attr.trusted.confidence.track.toFixed(2)} = {pct(attr.trusted.confidence)}%
                        </p>
                      )}
                    </>
                  ) : <span className="text-[12px] text-dim">{attr.conflict ? attr.conflict.summary : 'Nothing to reconcile'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function SecurityPanel({ e }: { e: Evaluation }) {
  return (
    <Panel className="mb-4 border-crit/40" title={<span className="inline-flex items-center gap-2"><ShieldAlert size={16} className="text-crit" aria-hidden /> Security reasoning</span>}
      >
      <ul className="grid gap-2 md:grid-cols-2">
        {e.security.map((s) => (
          <li key={s.title} className="rounded-lg border border-line bg-panel-2 px-3 py-2.5">
            <div className="flex items-center gap-2"><SeverityBadge s={s.severity} size="sm" /><span className="text-[13px] font-semibold text-ink">{s.title}</span></div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{s.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Ladder({ e }: { e: Evaluation }) {
  return (
    <Panel collapsible title="Other actions" >
      <ol className="space-y-1.5">
        {e.rec.ladder.map((row) => {
          const chosen = row.status === 'chosen'
          const Icon = ACTION_ICON[row.key]
          const color = ACTION_COLOR[row.key]
          return (
            <li key={row.step}
              className={cx('grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border px-3 py-2', chosen ? 'border-transparent' : 'border-line bg-panel-2/40', row.status === 'not_needed' && 'opacity-75')}
              style={chosen ? { background: `color-mix(in oklab, ${color} 16%, transparent)`, boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${color} 70%, transparent)` } : undefined}>
              <span className="grid size-7 place-items-center rounded-md bg-panel-3 font-mono text-[12px] text-ink-2" style={chosen ? { background: color, color: '#0b0f17' } : undefined}>{row.step}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon size={14} style={{ color }} aria-hidden />
                  <span className="text-[13.5px] font-semibold text-ink">{ACTIONS[row.step - 1].label}</span>
                  <span className={cx('rounded px-1.5 py-px text-[10.5px] font-semibold tracking-wide uppercase', chosen ? 'bg-ink text-bg' : row.status === 'insufficient' ? 'bg-panel-3 text-ink-2' : 'bg-panel-3 text-muted')}>
                    {chosen ? 'Chosen' : row.status === 'insufficient' ? 'Insufficient' : 'Not needed'}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{chosen ? e.rec.headline : row.status === 'insufficient' ? `Insufficient because: ${row.reason}` : `Not needed because: ${row.reason}`}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] text-ink">{row.cost === null ? 'n/a' : usdFull(row.cost)}</div>
                <div className="max-w-[170px] text-[10.5px] leading-snug text-muted">{row.costNote}</div>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function Tasks({ e }: { e: Evaluation }) {
  const app = useApp()
  const done = e.rec.tasks.filter((t) => app.tasksDone[t.id]).length
  const approved = !!app.approvals[e.box.id]
  return (
    <Panel title="Task checklist"
      right={<span className="font-mono text-[12px] text-ink-2">{done}/{e.rec.tasks.length}</span>}>
      <ul className="space-y-1">
        {e.rec.tasks.map((t) => (
          <li key={t.id}>
            <label className={cx('flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-panel-2', !approved && 'cursor-default opacity-80')}>
              <input type="checkbox" disabled={!approved} checked={!!app.tasksDone[t.id]} onChange={() => app.toggleTask(t.id)} className="mt-0.5 size-4 accent-[var(--color-good)]" />
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[13px] leading-snug', app.tasksDone[t.id] ? 'text-muted line-through' : 'text-ink')}>{t.text}</span>
                <span className="text-[11px] text-dim">{t.who}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

interface TL { at: number; stage: 'paper' | 'discharge' | 'gate'; source: string; text: ReactNode; strike?: boolean }

function WhenWeKnew({ e }: { e: Evaluation }) {
  const app = useApp()
  const b = e.box
  const items = useMemo<TL[]>(() => {
    const arrived = b.pod_arrived_at ? ms(b.pod_arrived_at) : Infinity
    const discharged = b.pod_discharged_at ? ms(b.pod_discharged_at) : Infinity
    const stage = (t: number): TL['stage'] => (t < arrived ? 'paper' : t < app.ctx.now - 6 * 3600_000 || t <= discharged + 3 * 3600_000 ? 'discharge' : 'gate')
    const out: TL[] = []
    for (const ev of b.events) {
      if (ev.event.includes('estimated')) continue
      out.push({ at: ms(ev.timestamp), stage: stage(ms(ev.timestamp)), source: `Terminal49 · ${ev.data_source}`, text: eventLabel(ev.event), strike: !!ev.invalidated_at })
    }
    for (const h of b.history) out.push({ at: ms(h.at), stage: stage(ms(h.at)), source: h.source, text: h.text })
    if (!b.history.length) {
      for (const h of b.holds_at_pod_terminal) if (h.placed_at) out.push({ at: ms(h.placed_at), stage: stage(ms(h.placed_at)), source: 'Terminal49 holds_at_pod_terminal', text: `${h.name} ${h.status}: ${h.description}` })
      const m = b.sensors.crane_weight_kg
      if (m && b.sensors.crane_weight_at) out.push({ at: ms(b.sensors.crane_weight_at) + 60_000, stage: 'discharge', source: 'Crane scale (terminal)', text: `Crane weight ${m.toLocaleString('en-US')} kg` })
    }
    out.push({ at: app.ctx.now, stage: 'gate', source: 'Priority Lanes', text: <>Recommended: <strong>{actionLabel(e.rec.key)}</strong>, before any truck reached the lane</> })
    if (b.pickup_appointment_at) {
      const t = ms(b.pickup_appointment_at)
      const blocked = !e.rec.releasable || e.rec.key === 'slow' || e.rec.key === 'reroute'
      out.push({ at: t, stage: 'gate', source: 'Truck appointment', text: blocked ? `${fmtTime(t)} appointment: cancelled / moved in advance, trucker notified` : `${fmtTime(t)} truck appointment` })
    }
    return out.sort((x, y) => x.at - y.at)
  }, [b, e, app.ctx.now])

  const firstFlag = b.history.find((h) => h.kind === 'paperwork')
  const daysBefore = firstFlag && b.pod_arrived_at ? Math.round((ms(b.pod_arrived_at) - ms(firstFlag.at)) / 86_400_000) : null
  const stageIcon = { paper: FileText, discharge: Anchor, gate: Truck }
  const stageColor = { paper: 'var(--color-sim)', discharge: 'var(--color-info)', gate: 'var(--color-good)' }

  return (
    <Panel collapsible title="Event history" >
      {firstFlag && daysBefore !== null && (
        <p className="mb-3 rounded-lg border border-good/40 bg-good/[0.07] px-3 py-2 text-[13px] leading-snug text-ink">
          First flagged <strong>{fmtDay(firstFlag.at)}, {daysBefore} days before arrival</strong>, from paperwork; confirmed at discharge {b.pod_discharged_at ? fmtDay(b.pod_discharged_at) : ''}; resolved before the truck arrived.
        </p>
      )}
      <ol className="relative ml-3 border-l border-line-2">
        {items.map((it, i) => {
          const Icon = stageIcon[it.stage]
          return (
            <li key={i} className="relative pb-3 pl-5 last:pb-0">
              <span className="absolute top-0.5 -left-[11px] grid size-[21px] place-items-center rounded-full border-2 border-panel" style={{ background: stageColor[it.stage] }}>
                <Icon size={11} className="text-bg" aria-hidden />
              </span>
              <div className="font-mono text-[11.5px] text-muted">{fmtWeekday(it.at)} · {fmtTime(it.at)}</div>
              <div className={cx('text-[13px] leading-snug text-ink', it.strike && 'line-through decoration-crit')}>{it.text}</div>
              <div className="text-[11px] text-dim">{it.source}{it.strike && ' · invalidated'}</div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function DecisionModal({ open, e, onClose }: { open: 'modify' | 'reject' | null; e: Evaluation; onClose: () => void }) {
  const app = useApp()
  const [key, setKey] = useState<ActionKey>(e.rec.key)
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 4 && (open === 'reject' || key !== e.rec.key)
  const submit = () => {
    if (!valid) return
    if (open === 'modify') app.modify(e, key, reason.trim())
    else app.reject(e, reason.trim())
    setReason('')
    onClose()
  }
  return (
    <Modal open={!!open} onClose={onClose} title={open === 'modify' ? `Modify action for ${e.box.number}` : `Reject recommendation for ${e.box.number}`}>
      <div className="space-y-3">
        {open === 'modify' && (
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-semibold text-muted">Choose a different step</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {e.rec.ladder.map((r) => (
                <label key={r.key} className={cx('flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px]', key === r.key ? 'border-info bg-info/10' : 'border-line-2')}>
                  <input type="radio" name="step" checked={key === r.key} onChange={() => setKey(r.key)} className="accent-[var(--color-info)]" />
                  <span className="text-ink">{r.step}. {actionLabel(r.key)}</span>
                  {r.status === 'chosen' && <span className="ml-auto text-[10px] text-muted">proposed</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-muted">Reason (required, logged)</span>
          <textarea value={reason} onChange={(ev) => setReason(ev.target.value)} rows={3} placeholder="e.g. CBP confirmed by phone they’ll release by 10:00"
            className="w-full rounded-lg border border-line-2 bg-bg p-2.5 text-[13px] text-ink placeholder:text-dim" />
        </label>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant={open === 'reject' ? 'danger' : 'primary'} disabled={!valid} onClick={submit}>{open === 'modify' ? 'Save modification' : 'Reject'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

