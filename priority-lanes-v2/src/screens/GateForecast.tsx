import { useMemo, useState } from 'react'
import { CalendarClock, OctagonAlert, Table2, Wind } from 'lucide-react'
import { useApp } from '../state.tsx'
import { FORECAST_START, forecast } from '../engine/forecast.ts'
import type { ForecastHour } from '../engine/forecast.ts'
import { HOUR, fmtTime, fmtWeekday, laHour } from '../engine/time.ts'
import { Btn, cx, Panel, SampleTag, Segmented, SimTag } from '../ui/primitives.tsx'
import { ScreenHeader } from '../ui/layout.tsx'

const W = 1120
const H = 270
const PAD = { l: 44, r: 12, t: 30, b: 34 }
const QH = 92

export function GateForecast() {
  const app = useApp()
  const f = useMemo(() => forecast(app.evals, app.ctx), [app.evals, app.ctx])
  const [which, setWhich] = useState<'before' | 'after'>('before')
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const imp = (h: ForecastHour) => (which === 'before' ? h.imports : h.importsPlanned)
  const total = (h: ForecastHour) => h.background + imp(h) + h.nextVessel
  const max = Math.max(...f.hours.map((h) => Math.max(total(h), h.capacity))) * 1.1
  const maxQ = Math.max(10, ...f.hours.map((h) => Math.max(h.backlog, h.backlogPlanned)))
  const iw = W - PAD.l - PAD.r
  const bw = iw / f.hours.length
  const x = (i: number) => PAD.l + i * bw
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max)
  const xt = (t: number) => PAD.l + ((t - FORECAST_START) / HOUR) * bw
  const end = FORECAST_START + 36 * HOUR
  const ticks = [0, 30, 60, 90, 120].filter((v) => v < max)

  const capPath = f.hours.map((h, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(h.capacity)} L${x(i + 1)},${y(h.capacity)}`).join(' ')
  const windPath = f.hours.map((h, i) => (h.capacityIfWind !== h.capacity ? `M${x(i)},${y(h.capacityIfWind)} L${x(i + 1)},${y(h.capacityIfWind)}` : '')).join(' ')
  const jams = which === 'before' ? f.jams : f.jamsPlanned
  const hv = hover !== null ? f.hours[hover] : null

  return (
    <div>
      <ScreenHeader
        title="Gate Forecast"
        kicker={<><span>Screen 4 · next 36 hours</span><SimTag /><SampleTag>Sample throughput: 15 trucks / lane / hr</SampleTag></>}
        sub="Demand (boxes becoming available, appointments, other gate traffic) against capacity (open lanes × throughput), with known events overlaid. Plan pre-staging, slot shifts and inspection slots before the jam, not during it."
        right={<>
          <Segmented label="Demand" value={which} onChange={setWhich} size="sm" options={[{ value: 'before', label: 'Before plan' }, { value: 'after', label: 'After plan' }]} />
          <Btn size="sm" onClick={() => setTable((t) => !t)}><Table2 size={13} aria-hidden /> {table ? 'Chart' : 'Table'}</Btn>
        </>}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {f.jams.map((j) => (
          <JamCard key={j.start} tone="crit" title={`Predicted jam ${fmtWeekday(j.start)} ${fmtTime(j.start)}–${fmtTime(j.end)}`} body={`Up to ${j.peakGap} trucks waiting before the plan${f.jamsPlanned[0] ? `; ${f.jamsPlanned.reduce((m, x) => Math.max(m, x.peakGap), 0)} with it` : '; cleared with it'}.`} />
        ))}
        {f.windJams.map((j) => (
          <JamCard key={j.start} tone="warn" wind title={`If wind stops cranes: ${fmtWeekday(j.start)} ${fmtTime(j.start)}–${fmtTime(j.end)}`} body={`Yard can’t dig boxes out: up to ${j.peakGap} trucks would back up. Pull time-critical pickups forward now.`} />
        ))}
        {!f.jams.length && !f.windJams.length && <JamCard tone="good" title="No jam predicted" body="Demand stays under capacity for the next 36 hours." />}
      </div>

      <Panel title="Trucks per hour: demand vs capacity" sub={<>Thu Oct 29 07:00 → Fri Oct 30 19:00 · LA time. Hover an hour for the numbers.</>} bodyClass="p-3">
        {table ? <ForecastTable hours={f.hours} which={which} /> : (
          <div className="scroll-thin relative overflow-x-auto">
            <div className="relative min-w-[900px]">
              <svg viewBox={`0 0 ${W} ${H + QH + 26}`} className="block w-full" role="img" aria-label="Hourly gate demand versus capacity for the next 36 hours, with a second panel for trucks waiting">
                {/* events band */}
                {f.events.map((ev, i) => {
                  const x0 = Math.max(PAD.l, xt(ev.start))
                  const x1 = Math.min(W - PAD.r, xt(Math.min(ev.end, end)))
                  if (x1 <= x0) return null
                  const fill = ev.kind === 'outage' ? 'var(--color-crit)' : ev.kind === 'weather' ? 'var(--color-warn)' : ev.kind === 'vessel' ? 'var(--color-s-3)' : 'var(--color-dim)'
                  const row = ev.kind === 'maintenance' ? 1 : 0
                  return (
                    <g key={i}>
                      <rect x={x0} y={4 + row * 12} width={x1 - x0} height={10} rx={3} fill={fill} opacity={ev.kind === 'maintenance' ? 0.35 : 0.8}><title>{ev.label}</title></rect>
                      {x1 - x0 > 70 && row === 0 && <text x={x0 + 5} y={12} fontSize={9} fill="#0b0f17" fontWeight={600}>{ev.label.length > (x1 - x0) / 5.2 ? ev.label.slice(0, Math.floor((x1 - x0) / 5.2)) + '…' : ev.label}</text>}
                    </g>
                  )
                })}
                {/* jam shading */}
                {jams.map((j) => <rect key={j.start} x={xt(j.start)} y={PAD.t} width={xt(j.end) - xt(j.start)} height={H - PAD.t - PAD.b} fill="var(--color-crit)" opacity={0.08} />)}
                {f.windJams.map((j) => <rect key={j.start} x={xt(j.start)} y={PAD.t} width={xt(j.end) - xt(j.start)} height={H - PAD.t - PAD.b} fill="var(--color-warn)" opacity={0.07} />)}
                {/* grid */}
                {ticks.map((v) => (
                  <g key={v}>
                    <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
                    <text x={PAD.l - 6} y={y(v) + 3} fontSize={10} textAnchor="end" fill="var(--color-muted)">{v}</text>
                  </g>
                ))}
                {/* stacked bars, 2px gaps */}
                {f.hours.map((h, i) => {
                  const segs = [
                    { v: h.background, c: 'var(--color-s-other)' },
                    { v: imp(h), c: 'var(--color-s-1)' },
                    { v: h.nextVessel, c: 'var(--color-s-3)' },
                  ].filter((s) => s.v > 0)
                  let acc = 0
                  const bx = x(i) + 2
                  const w = bw - 4
                  return (
                    <g key={h.t} opacity={hover === null || hover === i ? 1 : 0.55}>
                      {segs.map((s, k) => {
                        const y0 = y(acc)
                        acc += s.v
                        const y1 = y(acc)
                        const top = k === segs.length - 1
                        const hgt = Math.max(0, y0 - y1 - (top ? 0 : 2))
                        return <rect key={k} x={bx} y={y1 + (top ? 0 : 2)} width={w} height={hgt} rx={top ? 3 : 0} fill={s.c} />
                      })}
                    </g>
                  )
                })}
                {/* capacity */}
                <path d={capPath} fill="none" stroke="var(--color-ink)" strokeWidth={2} />
                {app.ctx.weather && <path d={windPath} fill="none" stroke="var(--color-warn)" strokeWidth={2} strokeDasharray="5 4" />}
                {/* x axis */}
                {f.hours.map((h, i) => (laHour(h.t) % 3 === 0 ? (
                  <g key={h.t}>
                    <text x={x(i) + bw / 2} y={H - PAD.b + 14} fontSize={10} textAnchor="middle" fill="var(--color-muted)">{fmtTime(h.t)}</text>
                    {laHour(h.t) === 0 && <text x={x(i) + bw / 2} y={H - PAD.b + 27} fontSize={10} textAnchor="middle" fill="var(--color-ink-2)" fontWeight={600}>Fri Oct 30</text>}
                  </g>
                ) : null))}
                <text x={x(0) + 2} y={H - PAD.b + 27} fontSize={10} fill="var(--color-ink-2)" fontWeight={600}>Thu Oct 29</text>
                <text x={8} y={PAD.t + 4} fontSize={10} fill="var(--color-muted)">/hr</text>

                {/* queue panel */}
                <g transform={`translate(0 ${H + 10})`}>
                  <text x={PAD.l} y={QH + 4} fontSize={10} fill="var(--color-muted)">Trucks waiting at the end of each hour (red = jam, 10+)</text>
                  <line x1={PAD.l} x2={W - PAD.r} y1={QH - 10} y2={QH - 10} stroke="var(--color-line-2)" />
                  {f.hours.map((h, i) => {
                    const v = which === 'before' ? h.backlog : h.backlogPlanned
                    const hh = Math.min(QH - 26, ((QH - 26) * v) / maxQ)
                    return v > 0 ? <rect key={h.t} x={x(i) + 2} y={QH - 10 - hh} width={bw - 4} height={hh} rx={2} fill={v >= 10 ? 'var(--color-crit)' : 'var(--color-muted)'} opacity={0.85} /> : null
                  })}
                  {f.hours.map((h, i) => {
                    const v = which === 'before' ? h.backlog : h.backlogPlanned
                    return v >= 10 ? <text key={h.t} x={x(i) + bw / 2} y={QH - 14 - Math.min(QH - 26, ((QH - 26) * v) / maxQ)} fontSize={9} textAnchor="middle" fill="var(--color-ink)">{v}</text> : null
                  })}
                </g>

                {/* hit targets */}
                {f.hours.map((h, i) => (
                  <rect key={h.t} x={x(i)} y={PAD.t} width={bw} height={H + QH - PAD.t} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                ))}
                {hover !== null && <line x1={x(hover) + bw / 2} x2={x(hover) + bw / 2} y1={PAD.t} y2={H + QH} stroke="var(--color-ink-2)" strokeWidth={1} strokeDasharray="2 3" pointerEvents="none" />}
              </svg>
              {hv && hover !== null && (
                <div className="pointer-events-none absolute top-8 z-10 w-[230px] rounded-lg border border-line-2 bg-panel-2 px-3 py-2 text-[12px] shadow-xl"
                  style={{ left: `min(calc(${((x(hover) + bw) / W) * 100}% + 8px), calc(100% - 240px))` }}>
                  <div className="mb-1 font-semibold text-ink">{fmtWeekday(hv.t)} {fmtTime(hv.t)}–{fmtTime(hv.t + HOUR)}</div>
                  <TipRow c="var(--color-ink)" k="Capacity" v={hv.capacity} line />
                  {hv.capacityIfWind !== hv.capacity && <TipRow c="var(--color-warn)" k="Capacity if wind" v={hv.capacityIfWind} line />}
                  <TipRow c="var(--color-s-other)" k="Other gate traffic" v={hv.background} />
                  <TipRow c="var(--color-s-1)" k={`Our import pickups (${which === 'before' ? 'before' : 'after'} plan)`} v={imp(hv)} />
                  {hv.nextVessel > 0 && <TipRow c="var(--color-s-3)" k="NORTHERN LARK pickups" v={hv.nextVessel} />}
                  <div className="mt-1 border-t border-line pt-1"><TipRow c="transparent" k="Trucks waiting (end of hour)" v={which === 'before' ? hv.backlog : hv.backlogPlanned} /></div>
                </div>
              )}
            </div>
            {/* legend */}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[12px] text-ink-2">
              <Legend c="var(--color-s-other)" label="Other gate traffic (exports, empties)" />
              <Legend c="var(--color-s-1)" label="Our import pickups" />
              <Legend c="var(--color-s-3)" label="Next vessel pickups (sample)" />
              <Legend c="var(--color-ink)" label="Capacity (open lanes × 15/hr)" line />
              {app.ctx.weather && <Legend c="var(--color-warn)" label="Capacity if wind stops cranes" line dashed />}
              <span className="inline-flex items-center gap-1.5"><OctagonAlert size={12} className="text-crit" aria-hidden /> Shaded = predicted jam (10+ waiting)</span>
            </div>
          </div>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Recommendations" sub="Computed from the forecast and today’s box-by-box recommendations.">
          <ol className="space-y-2">
            {f.recs.map((r, i) => (
              <li key={r.title} className="flex gap-3 rounded-lg border border-line bg-panel-2/60 px-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-info/20 font-mono text-[12px] text-info">{i + 1}</span>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{r.title}</div>
                  <div className="text-[12.5px] leading-snug text-ink-2">{r.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Events on the timeline" sub="Known in advance, so the playbook is ready before the gate needs it.">
          <ul className="space-y-1.5 text-[13px]">
            {f.events.map((ev) => (
              <li key={ev.label} className="flex items-start gap-2.5">
                {ev.kind === 'weather' ? <Wind size={14} className="mt-0.5 text-warn" aria-hidden /> : ev.kind === 'outage' ? <OctagonAlert size={14} className="mt-0.5 text-crit" aria-hidden /> : <CalendarClock size={14} className="mt-0.5 text-muted" aria-hidden />}
                <span><span className="font-mono text-[12px] text-muted">{fmtWeekday(ev.start)} {fmtTime(ev.start)}–{fmtTime(ev.end)}</span><br /><span className="text-ink">{ev.label}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function JamCard({ title, body, tone, wind }: { title: string; body: string; tone: 'crit' | 'warn' | 'good'; wind?: boolean }) {
  const Icon = wind ? Wind : OctagonAlert
  return (
    <div className={cx('rounded-xl border px-4 py-3', tone === 'crit' ? 'border-crit/50 bg-crit/[0.07]' : tone === 'warn' ? 'border-warn/50 bg-warn/[0.07]' : 'border-good/40 bg-good/[0.06]')}>
      <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><Icon size={15} className={tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : 'text-good'} aria-hidden />{title}</div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{body}</p>
    </div>
  )
}

function TipRow({ c, k, v, line }: { c: string; k: string; v: number; line?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-px">
      <span aria-hidden className={line ? 'h-0.5 w-3' : 'size-2.5 rounded-sm'} style={{ background: c }} />
      <span className="flex-1 text-ink-2">{k}</span>
      <span className="font-mono text-ink">{v}</span>
    </div>
  )
}

function Legend({ c, label, line, dashed }: { c: string; label: string; line?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={line ? 'h-0 w-4 border-t-2' : 'size-2.5 rounded-sm'} style={line ? { borderColor: c, borderStyle: dashed ? 'dashed' : 'solid' } : { background: c }} />
      {label}
    </span>
  )
}

function ForecastTable({ hours, which }: { hours: ForecastHour[]; which: 'before' | 'after' }) {
  return (
    <div className="scroll-thin max-h-[420px] overflow-auto">
      <table className="w-full min-w-[700px] text-left text-[12.5px]">
        <thead className="sticky top-0 bg-panel text-[11px] tracking-wider text-muted uppercase">
          <tr>{['Hour', 'Capacity', 'If wind', 'Other traffic', 'Our pickups', 'Next vessel', 'Waiting', 'Jam'].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="font-mono">
          {hours.map((h) => {
            const jam = which === 'before' ? h.jam : h.jamPlanned
            return (
              <tr key={h.t} className="border-t border-line">
                <td className="px-2 py-1 text-ink-2">{fmtWeekday(h.t).slice(0, 3)} {fmtTime(h.t)}</td>
                <td className="px-2 py-1">{h.capacity}</td>
                <td className="px-2 py-1">{h.capacityIfWind}</td>
                <td className="px-2 py-1">{h.background}</td>
                <td className="px-2 py-1">{which === 'before' ? h.imports : h.importsPlanned}</td>
                <td className="px-2 py-1">{h.nextVessel}</td>
                <td className="px-2 py-1">{which === 'before' ? h.backlog : h.backlogPlanned}</td>
                <td className="px-2 py-1 font-sans">{jam ? <span className="inline-flex items-center gap-1 text-ink"><OctagonAlert size={12} className="text-crit" aria-hidden />Jam</span> : h.jamIfWind ? 'If wind' : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
