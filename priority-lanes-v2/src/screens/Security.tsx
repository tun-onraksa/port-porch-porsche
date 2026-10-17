import { ArrowRight, Eye, Lock, Send, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useApp } from '../state.tsx'
import type { Evaluation } from '../engine/types.ts'
import { measuredWeight, tareKg } from '../engine/trust.ts'
import { kg, lbsToKg } from '../engine/rates.ts'
import { fmtDay } from '../engine/time.ts'
import { ActionChip, Btn, CargoIcon, cx, Panel, SeverityBadge, SimTag } from '../ui/primitives.tsx'
import { ScreenHeader } from '../ui/layout.tsx'

export function Security() {
  const app = useApp()
  const cases = app.evals
    .filter((e) => e.security.length)
    .sort((a, b) => (a.severity === 'critical' ? -1 : 0) - (b.severity === 'critical' ? -1 : 0))

  if (app.view === 'ops') {
    return (
      <div>
        <ScreenHeader title="Security View" kicker={<><span>Screen 6 · dual use</span><SimTag /></>} />
        <Panel>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 place-items-center rounded-xl bg-panel-3"><Lock size={22} className="text-muted" aria-hidden /></span>
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold">Restricted to the Security role</h2>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">Operations sees these boxes only as <strong className="text-ink">“Inspection requested”</strong>. The reasoning (declared vs measured weight, reefers running while declared empty, commodity plausibility, seal mismatches) is shared with CBP and terminal security, not with the whole gate.</p>
            </div>
            <Btn variant="primary" onClick={() => app.setView('security')}><ShieldAlert size={14} aria-hidden /> Switch to Security view (demo)</Btn>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">What Operations sees</div>
            <ul className="flex flex-wrap gap-2">
              {cases.map((e) => (
                <li key={e.box.id} className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[12.5px]">
                  <span className="font-mono font-semibold">{e.box.number}</span>
                  <span className="text-muted">{e.severity === 'critical' ? 'Inspection requested' : 'Confirmation requested'}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div>
      <ScreenHeader
        title="Security View"
        kicker={<><span>Screen 6 · dual use</span><SimTag /><span className="inline-flex items-center gap-1 rounded bg-crit/15 px-1.5 text-[11px] font-semibold text-ink"><ShieldAlert size={12} className="text-crit" aria-hidden /> Security role</span></>}
        sub="One system, one dataset. The mismatch detection that keeps cargo moving also targets inspections where they matter: possible contraband, undeclared cargo, and danger to the people handling the box."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Critical mismatches" value={cases.filter((c) => c.severity === 'critical').length} sub="sent to inspection" />
        <Stat label="Watchlist" value={cases.filter((c) => c.severity !== 'critical').length} sub="confirmation requested, escalate if unanswered" />
        <Stat label="Boxes moving normally" value={app.evals.length - cases.length} sub="no security signal, not slowed down" />
      </div>
      <div className="space-y-4">
        {cases.map((e) => <Case key={e.box.id} e={e} />)}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="font-mono text-[24px] font-semibold">{value}</div>
      <div className="text-[12px] text-ink-2">{sub}</div>
    </div>
  )
}

function WeightCompare({ e }: { e: Evaluation }) {
  const b = e.box
  const m = measuredWeight(b)
  const rows = [
    { k: b.declarations.carrier_declared_status === 'empty' ? 'Carrier: “empty”' : 'Carrier declared', v: b.equipment_weight_lbs ? lbsToKg(b.equipment_weight_lbs) : b.declarations.carrier_declared_status === 'empty' ? tareKg(b) : null, c: 'var(--color-dim)' },
    { k: 'VGM (origin)', v: b.declarations.vgm_weight_kg, c: 'var(--color-s-other)' },
    { k: 'Crane scale (measured)', v: m?.kg ?? null, c: 'var(--color-crit)' },
  ].filter((r) => r.v !== null) as { k: string; v: number; c: string }[]
  const max = Math.max(...rows.map((r) => r.v), 1)
  return (
    <div className="space-y-1.5" role="img" aria-label={rows.map((r) => `${r.k}: ${kg(r.v)}`).join('; ')}>
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[150px_minmax(0,1fr)_86px] items-center gap-2 text-[12px]">
          <span className="text-ink-2">{r.k}</span>
          <span className="h-3 rounded-[3px] bg-line"><span className="block h-3 rounded-[3px]" style={{ width: `${(r.v / max) * 100}%`, background: r.c }} /></span>
          <span className="text-right font-mono text-ink">{kg(r.v)}</span>
        </div>
      ))}
    </div>
  )
}

function Case({ e }: { e: Evaluation }) {
  const app = useApp()
  const b = e.box
  const critical = e.severity === 'critical'
  const sharedKey = `sec-${b.id}`
  const shared = app.notified[sharedKey]
  const action = critical
    ? 'CBP exam, expedited. It’s the same box Operations is already sending to the inspection bay, so nothing else at the gate slows down.'
    : e.conflicts.some((c) => c.attr === 'seal')
      ? 'Request the carrier’s re-seal record. Escalate to CBP if there’s none by 12:00. Box keeps its slot meanwhile.'
      : 'Ask the importer to confirm the commodity; CBP notified for targeting. Box keeps moving unless the answer doesn’t fit.'
  return (
    <Panel className={cx(critical && 'border-crit/50')} bodyClass="p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <SeverityBadge s={e.severity} size="lg" />
            <CargoIcon kind={b.kind} size={17} />
            <span className="font-mono text-[18px] font-semibold">{b.number}</span>
            <span className="text-[12.5px] text-muted">{b.pod_vessel_name} · B/L {b.bill_of_lading} · {b.shipping_line_name} · yard {b.sensors.yard_position}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {e.security.map((s) => (
              <li key={s.title} className="rounded-lg border border-line bg-panel-2/60 px-3 py-2">
                <div className="flex items-center gap-2"><SeverityBadge s={s.severity} size="sm" /><span className="text-[13.5px] font-semibold text-ink">{s.title}</span></div>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-line bg-panel-2/40 p-4 lg:border-t-0 lg:border-l">
          <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Declared vs measured</div>
          <WeightCompare e={e} />
          {b.declarations.reefer_setpoint_c !== null && e.reefer && (
            <p className="mt-2 text-[12px] text-ink-2">Reefer set to <span className="font-mono text-ink">{b.declarations.reefer_setpoint_c}°C</span>, running at <span className="font-mono text-ink">{e.reefer.current.toFixed(1)}°C</span>{b.declarations.carrier_declared_status === 'empty' ? ' while declared empty.' : '.'}</p>
          )}
          {b.declarations.seal_number_declared && b.sensors.seal_number_observed && b.declarations.seal_number_declared !== b.sensors.seal_number_observed && (
            <p className="mt-2 text-[12px] text-ink-2">Seal on manifest <span className="font-mono text-ink">{b.declarations.seal_number_declared}</span>, camera read <span className="font-mono text-ink">{b.sensors.seal_number_observed}</span> at discharge {b.pod_discharged_at ? fmtDay(b.pod_discharged_at) : ''}.</p>
          )}
          <div className="mt-3 mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Recommended security action</div>
          <p className="text-[13px] leading-snug text-ink">{action}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {shared ? (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2"><ShieldCheck size={14} className="text-good" aria-hidden /> Shared with CBP targeting (simulated)</span>
            ) : (
              <Btn size="sm" variant="primary" onClick={() => app.notify(sharedKey, `Security: ${b.number} shared with CBP targeting (simulated).`)}><Send size={13} aria-hidden /> Share with CBP targeting</Btn>
            )}
            <Btn size="sm" onClick={() => app.go('box', b.id)}><Eye size={13} aria-hidden /> Full four-stories view <ArrowRight size={12} aria-hidden /></Btn>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
            Operations sees: <ActionChip k={e.rec.key} size="sm" label={critical ? 'Inspection requested' : undefined} />
          </div>
        </div>
      </div>
    </Panel>
  )
}
