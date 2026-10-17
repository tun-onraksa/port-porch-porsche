import { useMemo, useState } from 'react'
import { ArrowRight, Braces, CircleCheck, Mail, Ship } from 'lucide-react'
import { useApp } from '../state.tsx'
import { HERO_ID, INBOUND, SNAPSHOT } from '../data/scenario.ts'
import type { InboundRecord } from '../data/scenario.ts'
import { paperworkChecks } from '../engine/paperwork.ts'
import type { PaperworkWarning } from '../engine/paperwork.ts'
import { eventLabel } from '../engine/trust.ts'
import { fmtDayTime, fmtTime, fmtWeekday } from '../engine/time.ts'
import { Btn, cx, Kpi, LiveTag, Panel, SeverityBadge, SimTag } from '../ui/primitives.tsx'
import { Modal, ScreenHeader, StageStrip } from '../ui/layout.tsx'
import type { Severity } from '../engine/types.ts'

const SEV_ORDER: Record<Severity, number> = { critical: 0, major: 1, minor: 2 }
const CHECK_AS_OF = Date.parse('2026-10-27T20:00:00Z')

const CARRIER_NAME: Record<string, string> = { COSU: 'COSCO', EGLV: 'Evergreen', ONEY: 'ONE', MAEU: 'Maersk', MSCU: 'MSC', HLCU: 'Hapag-Lloyd', CMDU: 'CMA CGM' }

function draftFor(r: InboundRecord, w: PaperworkWarning[]) {
  const hold = w.some((x) => x.rule === 'Hold before arrival')
  const to = [`${CARRIER_NAME[r.scac] ?? r.scac} (carrier)`]
  if (r.importer && r.importer !== 'Not declared') to.push(`${r.importer} (importer)`)
  if (hold || w.some((x) => x.severity === 'critical')) to.push('CBP Los Angeles (port)')
  const body = [
    `Container ${r.number} · ${r.vessel} · ETA ${fmtWeekday(r.eta)} ${fmtTime(r.eta)} PDT`,
    '',
    'Our paperwork check found:',
    ...w.map((x) => `• ${x.text}`),
    '',
    hold ? 'Please confirm an exam slot at discharge so the box doesn’t wait in the yard.' : 'Please confirm or correct the declaration before discharge.',
    '',
    '— Gate & Yard Planning (simulated message)',
  ].join('\n')
  return { to, subject: `Pre-arrival check: ${r.number}`, body }
}

export function PreArrival() {
  const app = useApp()
  const [showRaw, setShowRaw] = useState(false)
  const [draft, setDraft] = useState<{ r: InboundRecord; w: PaperworkWarning[] } | null>(null)
  const [body, setBody] = useState('')
  const sh = SNAPSHOT.shipment
  const v = SNAPSHOT.shared_container_values

  const records = useMemo(
    () => INBOUND.map((r) => ({ r, w: paperworkChecks(r, CHECK_AS_OF) }))
      .filter((x) => x.w.length)
      .sort((a, b) => (a.r.resolution ? 1 : 0) - (b.r.resolution ? 1 : 0) || SEV_ORDER[maxSev(a.w)] - SEV_ORDER[maxSev(b.w)]),
    [],
  )
  const resolved = records.filter((x) => x.r.resolution).length

  return (
    <div>
      <ScreenHeader
        title="Pre-Arrival Radar"
        kicker={<><span>Screen 3 · days before arrival</span></>}
        sub="Before a ship arrives there is almost nothing to measure. So we check the paperwork: declarations, verified gross mass, reefer setpoints and early holds. This screen never shows a measured weight or a live temperature."
      />
      <StageStrip active="paper" />

      {/* ---------------- live Terminal49 shipment */}
      <Panel
        className="mb-4 border-live/35"
        title={<span className="flex flex-wrap items-center gap-2"><Ship size={16} className="text-live" aria-hidden /> Inbound shipment from Terminal49 <LiveTag /></span>}
        sub={<>Real snapshot taken <span className="font-mono">{SNAPSHOT.snapshot_taken_at}</span>. Shown exactly as Terminal49 returned it.</>}
        right={<Btn size="sm" onClick={() => setShowRaw((x) => !x)}><Braces size={13} aria-hidden /> {showRaw ? 'Hide' : 'View'} raw JSON</Btn>}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['Vessel / voyage', `${sh.pod_vessel_name} · ${sh.voyage_number}`],
            ['Carrier · B/L', `${sh.shipping_line_name} (${sh.shipping_line_scac}) · ${sh.bill_of_lading}`],
            ['Route', `${sh.port_of_lading_name} → ${sh.port_of_discharge_name}`],
            ['ETA (pod_eta_at)', `${fmtWeekday(sh.pod_eta_at)} ${fmtTime(sh.pod_eta_at)} PDT`],
            ['Terminal', `${sh.pod_terminal_name} (${sh.pod_terminal_nickname}, ${sh.pod_terminal_firms_code})`],
            ['pod_ata_at', String(sh.pod_ata_at)],
          ].map(([k, val]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{k}</dt>
              <dd className="mt-0.5 font-mono text-[12.5px] break-words text-ink">{val}</dd>
            </div>
          ))}
        </dl>

        <div className="scroll-thin mt-4 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead className="bg-panel-2 text-[11px] tracking-wider text-muted uppercase">
              <tr>
                {['Container', 'status', 'equipment', 'equipment_weight_lbs', 'seal_number', 'holds', 'fees', 'pickup_lfd', 'available', 'Terminal49 urgency', 'Our check'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {SNAPSHOT.containers.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-mono font-semibold text-ink">{c.number}</div>
                    <div className="font-mono text-[10.5px] text-dim">{c.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-2">{v.status}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap text-ink-2">{v.equipment_length_ft}' {v.equipment_height} {v.equipment_type}</td>
                  <td className="px-3 py-2 font-mono text-dim">{String(v.equipment_weight_lbs)}</td>
                  <td className="px-3 py-2 font-mono text-dim">{String(v.seal_number)}</td>
                  <td className="px-3 py-2 font-mono text-dim">[]</td>
                  <td className="px-3 py-2 font-mono text-dim">[] · ${v.fees_total_amount}</td>
                  <td className="px-3 py-2 font-mono text-dim">{String(v.pickup_lfd)}</td>
                  <td className="px-3 py-2 font-mono text-dim">{String(v.available_for_pickup)} <span className="text-[10.5px]">(known: {String(v.availability_known)})</span></td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-ink">{v.urgency}</span>
                    <div className="text-[11px] text-muted">suppressed: {v.urgency_reason}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-2">Nothing to check yet</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Events (every one carries its data_source)</div>
            <ol className="space-y-1.5">
              {v.events.map((e) => (
                <li key={e.event} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-panel-2 px-3 py-2 text-[12.5px]">
                  <span className="font-mono text-ink-2">{fmtDayTime(e.timestamp)}</span>
                  <span className="font-medium text-ink">{eventLabel(e.event)}</span>
                  <span className="text-muted">{e.location_name}</span>
                  <span className="ml-auto rounded bg-panel-3 px-1.5 py-px font-mono text-[11px] text-ink-2">data_source: {e.data_source}</span>
                  <span className="font-mono text-[11px] text-dim">invalidated_at: {String(e.invalidated_at)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/60 p-3.5 text-[13px] leading-relaxed text-ink-2">
            <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">What the real data tells us</div>
            <ul className="list-disc space-y-1 pl-4 marker:text-dim">
              <li><strong className="text-ink">Almost nothing is checkable before arrival.</strong> Weight, seal, holds, fees and deadlines are empty, and there’s no cargo or temperature field at all.</li>
              <li>Every event names its <span className="font-mono text-ink">data_source</span>, and sources can be retracted (<span className="font-mono text-ink">invalidated_at</span>). That’s the basis for “which source do you trust?”</li>
              <li>Terminal49 already has an <span className="font-mono text-ink">urgency</span> field. It’s suppressed until the terminal is checked. Ours builds on it and is always shown next to it.</li>
              <li><strong className="text-ink">Not a conflict:</strong> a COSCO bill of lading on an Evergreen vessel with OOCU / TRHU / TGBU / CSNU boxes is normal vessel sharing and leasing. We don’t flag it.</li>
            </ul>
          </div>
        </div>
        {showRaw && (
          <pre className="scroll-thin mt-4 max-h-[380px] overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">{JSON.stringify(SNAPSHOT, null, 2)}</pre>
        )}
      </Panel>

      {/* ---------------- simulated paperwork checks */}
      <Panel
        className="mb-4"
        title={<span className="flex flex-wrap items-center gap-2">Paperwork checks on other inbound boxes <SimTag /></span>}
        sub="Mon Oct 26 – Tue Oct 27. Carrier declarations, VGM and booking setpoints arrive by EDI before the ship does. Only paperwork-based warnings appear here."
        bodyClass="p-0"
      >
        <div className="grid grid-cols-2 gap-3 border-b border-line p-4 lg:grid-cols-4">
          <Kpi icon={CircleCheck} tone="good" label="Resolved before arrival" value={`${resolved} of ${records.length}`} sub="carrier or shipper corrected the paperwork" />
          <Kpi icon={Mail} tone="warn" label="Still open at arrival" value={records.length - resolved} sub="carried forward to discharge" />
          <Kpi icon={Ship} label="Physical readings used" value="0" sub="none exist before discharge" />
          <Kpi icon={ArrowRight} tone="info" label="Hero box first flagged" value="Oct 26" sub="2 days before arrival" onClick={() => app.go('box', HERO_ID)} />
        </div>
        <ul>
          {records.map(({ r, w }) => {
            const sev = maxSev(w)
            const hero = r.linkedBoxId === HERO_ID
            const sent = app.notified[r.id]
            return (
              <li key={r.id} className={cx('grid gap-3 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[120px_minmax(0,1fr)_220px]', hero && 'bg-crit/[0.06] shadow-[inset_3px_0_0_var(--color-crit)]', r.resolution && 'opacity-80')}>
                <div className="flex flex-row items-start gap-2 md:flex-col">
                  <SeverityBadge s={sev} />
                  {hero && <span className="rounded bg-crit/20 px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-ink uppercase">Hero box</span>}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-mono text-[14px] font-semibold text-ink">{r.number}</span>
                    <span className="text-[12px] text-muted">{r.vessel} · ETA {fmtWeekday(r.eta)} · {r.equipment_length_ft}' {r.equipment_type} · {CARRIER_NAME[r.scac]}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {w.map((x) => <li key={x.rule} className="text-[13.5px] leading-snug text-ink"><span className="mr-1.5 text-[11px] font-medium text-muted">{x.rule}:</span>{x.text}</li>)}
                  </ul>
                  <div className="mt-1 text-[12px] text-muted">Flagged {fmtWeekday(r.flaggedAt)} {fmtTime(r.flaggedAt)}{hero && ' · COSCO asked to confirm at 09:20, no reply'}</div>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  {r.resolution ? (
                    <span className="inline-flex items-start gap-1.5 text-[12.5px] text-ink-2">
                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-good" aria-hidden />
                      <span><span className="font-medium text-ink">Resolved {fmtWeekday(r.resolution.at)}</span><br />{r.resolution.note}</span>
                    </span>
                  ) : sent ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2"><CircleCheck size={14} className="text-good" aria-hidden /> Notification sent (simulated)</span>
                  ) : (
                    <Btn size="sm" variant="primary" onClick={() => { const d = draftFor(r, w); setBody(d.body); setDraft({ r, w }) }}>
                      <Mail size={13} aria-hidden /> Notify carrier / importer / CBP
                    </Btn>
                  )}
                  {r.linkedBoxId && (
                    <button onClick={() => app.go('box', r.linkedBoxId)} className="inline-flex items-center gap-1 text-[12px] text-info hover:underline">
                      What happened at discharge <ArrowRight size={12} aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
        <p className="text-[13.5px] text-ink-2">Jump ahead: the EVER LAUREL discharges Oct 28. On <strong className="text-ink">Thu Oct 29, 07:30</strong> a power fault takes 4 of 8 gate lanes down.</p>
        <Btn variant="primary" onClick={() => { app.setMode('disruption'); app.go('gate') }}>Go to Gate Command (simulated Oct 29) <ArrowRight size={14} aria-hidden /></Btn>
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title="Draft notification (simulated, nothing is sent)" wide>
        {draft && (() => {
          const d = draftFor(draft.r, draft.w)
          return (
            <div className="space-y-3 text-[13px]">
              <div><span className="text-muted">To: </span><span className="text-ink">{d.to.join(' · ')}</span></div>
              <div><span className="text-muted">Subject: </span><span className="font-mono text-ink">{d.subject}</span></div>
              <label className="block">
                <span className="sr-only">Message</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={11} className="w-full rounded-lg border border-line-2 bg-bg p-3 font-mono text-[12.5px] leading-relaxed text-ink" />
              </label>
              <div className="flex justify-end gap-2">
                <Btn onClick={() => setDraft(null)}>Cancel</Btn>
                <Btn variant="primary" onClick={() => { app.notify(draft.r.id, `Pre-arrival notification for ${draft.r.number} sent to ${d.to.length} parties (simulated).`); setDraft(null) }}>
                  <Mail size={13} aria-hidden /> Send (simulated)
                </Btn>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

function maxSev(w: PaperworkWarning[]): Severity {
  return w.reduce<Severity>((m, x) => (SEV_ORDER[x.severity] < SEV_ORDER[m] ? x.severity : m), 'minor')
}
