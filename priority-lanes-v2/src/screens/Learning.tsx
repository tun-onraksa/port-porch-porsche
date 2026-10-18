import { CircleCheck,ClipboardList,Gauge,OctagonX,PiggyBank,Scale } from 'lucide-react'
import { useState } from 'react'
import { BOXES,HERO_ID,HISTORY,WEEKLY } from '../data/scenario.ts'
import { usd,usdFull } from '../engine/rates.ts'
import { fmtTime,fmtYmd } from '../engine/time.ts'
import type { Reliability,SourceKey } from '../engine/trust.ts'
import { SOURCE_LABEL } from '../engine/trust.ts'
import { useApp } from '../state.tsx'
import { ScreenHeader } from '../ui/layout.tsx'
import { Btn,cx,Kpi,Panel,SimTag } from '../ui/primitives.tsx'

type Bump = { key: SourceKey | `carrier:${string}`; right: boolean }
interface OpenCase { id: string; boxId: string; title: string; question: string; options: { label: string; bumps: Bump[]; note: string }[] }

const OPEN: OpenCase[] = [
  {
    id: 'hero', boxId: HERO_ID, title: 'CSLU7734521: declared empty, crane 27,400 kg',
    question: 'CBP exam result: which source was right?',
    options: [
      { label: 'Crane + VGM correct', note: 'COSCO declaration counted wrong', bumps: [{ key: 'crane_scale', right: true }, { key: 'vgm', right: true }, { key: 'carrier:COSU', right: false }, { key: 'carrier_declaration', right: false }] },
      { label: 'Carrier correct · empty', note: 'Crane and VGM counted wrong', bumps: [{ key: 'crane_scale', right: false }, { key: 'vgm', right: false }, { key: 'carrier:COSU', right: true }, { key: 'carrier_declaration', right: true }] },
    ],
  },
  {
    id: 'haz', boxId: 'sim-0007', title: 'EXFU hazmat tank: crane +6% vs VGM',
    question: 'Gate-scale re-weigh came back. Which source was right?',
    options: [
      { label: 'Crane correct · VGM low', note: 'VGM counted wrong', bumps: [{ key: 'crane_scale', right: true }, { key: 'gate_scale', right: true }, { key: 'vgm', right: false }] },
      { label: 'VGM correct · crane drift', note: 'Crane scale counted wrong', bumps: [{ key: 'crane_scale', right: false }, { key: 'gate_scale', right: true }, { key: 'vgm', right: true }] },
    ],
  },
  {
    id: 'ms', boxId: 'sim-0013', title: 'TCNU discharge milestone retracted by COSCO',
    question: 'Terminal confirmed its own discharge time.',
    options: [
      { label: 'Terminal event correct', note: 'Shipping-line milestone counted wrong', bumps: [{ key: 'terminal_event', right: true }, { key: 'shipping_line_event', right: false }] },
    ],
  },
]

const SHOWN: SourceKey[] = ['crane_scale', 'gate_scale', 'reefer_telemetry', 'customs', 'tos', 'terminal_event', 'ais', 'vgm', 'terminal_availability', 'facility_deadline', 'line_deadline', 'shipping_line_event', 'carrier_declaration']

function applyBumps(rel: Reliability, bumps: Bump[]): Reliability {
  const next: Reliability = { sources: { ...rel.sources }, carriers: { ...rel.carriers }, invalidated: { ...rel.invalidated } }
  for (const b of bumps) {
    if (b.key.startsWith('carrier:')) {
      const scac = b.key.slice(8)
      const r = next.carriers[scac]
      next.carriers[scac] = { right: r.right + (b.right ? 1 : 0), total: r.total + 1 }
    } else {
      const k = b.key as SourceKey
      const r = next.sources[k]
      next.sources[k] = { right: r.right + (b.right ? 1 : 0), total: r.total + 1 }
    }
  }
  return next
}

const pctOf = (r: { right: number; total: number }) => (r.right / r.total) * 100

export function Learning() {
  const app = useApp()
  const [done, setDone] = useState<Record<string, string>>({})
  const [before] = useState(app.rel)
  const todayInvalidated = BOXES.flatMap((b) => b.events).filter((e) => e.invalidated_at)
  const invBySource = todayInvalidated.reduce<Record<string, number>>((m, e) => ({ ...m, [e.data_source]: (m[e.data_source] ?? 0) + 1 }), {})

  const record = (c: OpenCase, o: OpenCase['options'][number]) => {
    app.setRel(applyBumps(app.rel, o.bumps))
    setDone((d) => ({ ...d, [c.id]: o.label }))
    app.addLog({ kind: 'learn', boxId: c.boxId, text: `Outcome recorded for ${c.title.split(':')[0]}: ${o.label}. Reliability updated (${o.note}).` })
  }

  return (
    <div>
      <ScreenHeader
        title="Learning log"


      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CircleCheck} tone="good" label="Caught early" value={WEEKLY.caughtBeforeGate} sub={`of ${WEEKLY.conflicts} conflicts · simulated`} />
        <Kpi icon={OctagonX} tone="info" label="Lane closures avoided" value={WEEKLY.laneClosuresAvoided} sub="one box handled instead" />
        <Kpi icon={PiggyBank} tone="good" label="Charges avoided" value={`~${usd(WEEKLY.chargesAvoided)}`} sub="sample rates · simulated" />
        <Kpi icon={Gauge} label="Resolution time" value={`${WEEKLY.avgResolveHours}h`} sub="flag → confirmed" />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Record outcomes" >
          <ul className="space-y-3">
            {OPEN.map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-panel-2/50 p-3">
                <button onClick={() => app.go('box', c.boxId)} className="text-left text-[13.5px] font-semibold text-ink hover:underline">{c.title}</button>
                <p className="mt-0.5 text-[12.5px] text-ink-2">{c.question}</p>
                {done[c.id] ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-ink"><CircleCheck size={14} className="text-good" aria-hidden /> {done[c.id]}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.options.map((o) => <Btn key={o.label} size="sm" onClick={() => record(c, o)}>{o.label}</Btn>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel collapsible title="Source reliability"  right={<Scale size={15} className="text-muted" aria-hidden />}>
          <table className="w-full text-[12.5px]">
            <tbody>
              {Object.entries(app.rel.carriers).filter(([k]) => k === 'COSU' || k === 'MAEU' || k === 'MSCU').map(([k, r]) => (
                <RelRow key={k} label={`${k === 'COSU' ? 'COSCO' : k === 'MAEU' ? 'Maersk' : 'MSC'} declared weights`} r={r} prev={before.carriers[k]} />
              ))}
              {SHOWN.map((k) => (
                <RelRow key={k} label={SOURCE_LABEL[k]} r={app.rel.sources[k]} prev={before.sources[k]}
                  extra={k === 'shipping_line_event' ? `${(app.rel.invalidated.shipping_line ?? 0) + (invBySource.shipping_line ?? 0)} invalidated events` : k === 'ais' ? `${app.rel.invalidated.ais ?? 0} invalidated` : undefined} />
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="mb-4" collapsible title="Resolved cases"  right={<SimTag />} bodyClass="p-0">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12.5px]">
            <thead className="text-[10.5px] tracking-wider text-muted uppercase">
              <tr className="border-b border-line">{['Date', 'Container', 'Conflict', 'Right', 'Wrong', 'Caught', 'Time to resolve', 'Action', 'Cost avoided'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {HISTORY.map((h) => (
                <tr key={h.number} className="border-b border-line/70">
                  <td className="px-3 py-2 font-mono whitespace-nowrap text-ink-2">{fmtYmd(h.date)}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-ink">{h.number}</td>
                  <td className="px-3 py-2 text-ink">{h.conflict}</td>
                  <td className="px-3 py-2 text-ink"><CircleCheck size={12} className="mr-1 inline -translate-y-px text-good" aria-hidden />{h.right}</td>
                  <td className={cx('px-3 py-2', h.wrong.includes('invalidated') ? 'text-crit' : 'text-ink-2')}>{h.wrong}</td>
                  <td className="px-3 py-2 text-ink-2">{h.caughtAt}</td>
                  <td className="px-3 py-2 font-mono text-ink-2">{h.timeToResolve}</td>
                  <td className="px-3 py-2 text-ink-2">{h.action}</td>
                  <td className="px-3 py-2 font-mono text-ink">{h.avoided ? usdFull(h.avoided) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Decision log"  right={<ClipboardList size={15} className="text-muted" aria-hidden />}>
        <ol className="space-y-1.5">
          {app.log.map((l, i) => (
            <li key={i} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 text-[12.5px]">
              <span className="font-mono text-muted">{fmtTime(l.at)}</span>
              <span className="text-ink"><span className="text-muted">{l.who}: </span>{l.text}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}

function RelRow({ label, r, prev, extra }: { label: string; r: { right: number; total: number }; prev: { right: number; total: number }; extra?: string }) {
  const p = pctOf(r)
  const changed = r.total !== prev.total
  const delta = p - pctOf(prev)
  return (
    <tr className={cx('border-b border-line/60', changed && 'flash-in')}>
      <td className="py-1.5 pr-2 text-ink-2">{label}{extra && <span className="block text-[11px] text-dim">{extra}</span>}</td>
      <td className="w-[40%] py-1.5 pr-2">
        <span className="block h-1.5 rounded-full bg-line-2"><span className="block h-1.5 rounded-full" style={{ width: `${p}%`, background: p >= 95 ? 'var(--color-good)' : p >= 88 ? 'var(--color-info)' : 'var(--color-warn)' }} /></span>
      </td>
      <td className="py-1.5 text-right font-mono whitespace-nowrap text-ink">
        {p.toFixed(1)}%
        {changed && <span className={cx('ml-1 text-[11px]', delta < 0 ? 'text-crit' : 'text-good')}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}</span>}
        <span className="ml-1 text-[11px] text-dim">n={r.total}</span>
      </td>
    </tr>
  )
}
