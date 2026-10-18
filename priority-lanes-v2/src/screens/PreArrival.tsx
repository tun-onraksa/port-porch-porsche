import { TrackPanel } from '../live/TrackPanel.tsx'
import { ArrowRight,CircleCheck,Mail } from 'lucide-react'
import { useMemo,useState } from 'react'
import type { InboundRecord } from '../data/scenario.ts'
import { HERO_ID,INBOUND,SNAPSHOT } from '../data/scenario.ts'
import type { PaperworkWarning } from '../engine/paperwork.ts'
import { paperworkChecks } from '../engine/paperwork.ts'
import { fmtTime,fmtWeekday } from '../engine/time.ts'
import type { Severity } from '../engine/types.ts'
import { useApp } from '../state.tsx'
import { Modal,ScreenHeader } from '../ui/layout.tsx'
import { Btn,cx,Panel,SeverityBadge } from '../ui/primitives.tsx'

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
  const [showResolved,setShowResolved]=useState(false)
  const [draft, setDraft] = useState<{ r: InboundRecord; w: PaperworkWarning[] } | null>(null)
  const [body, setBody] = useState('')
  const sh = SNAPSHOT.shipment

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
        title="Pre-arrival radar"


      />
      <details className="shipment-reference quiet-disclosure">
       <summary><span>EVER LAUREL · 4 recorded containers</span><span>ETA 28 Oct · 06:00 PDT</span></summary>
       <div className="disclosure-body"><p>Terminal49 snapshot · 17 Oct 2026. Los Angeles / APM Terminals; operational scenarios are simulated.</p>
        <dl className="reference-facts"><dt>Vessel</dt><dd>{sh.pod_vessel_name} · {sh.voyage_number}</dd><dt>Route</dt><dd>{sh.port_of_lading_name} → {sh.port_of_discharge_name}</dd><dt>Terminal</dt><dd>{sh.pod_terminal_name}</dd><dt>Containers</dt><dd>{SNAPSHOT.containers.map(c=>c.number).join(', ')}</dd><dt>Availability / fees</dt><dd>Unverified</dd></dl>
        <Btn onClick={()=>setShowRaw(x=>!x)}>{showRaw?'Hide':'View'} source JSON</Btn>
        {showRaw&&<pre className="scroll-thin mt-4 max-h-[380px] overflow-auto text-[12px]">{JSON.stringify(SNAPSHOT,null,2)}</pre>}
       </div>
      </details>
      <TrackPanel />

      {/* ---------------- simulated paperwork checks */}
      <Panel
        className="mb-4"
        title="Paperwork checks"
        right={<Btn onClick={()=>setShowResolved(v=>!v)}>{showResolved?`Open checks (${records.length-resolved})`:`Resolved (${resolved})`}</Btn>}

        bodyClass="p-0"
      >
        <div className="quiet-inline-stats"><span><b>{records.length-resolved}</b> open</span><span><b>{resolved}</b> resolved</span><span>Simulated checks</span></div>
        <ul>
          {records.filter(({r})=>showResolved?!!r.resolution:!r.resolution).map(({ r, w }) => {
            const sev = maxSev(w)
            const hero = r.linkedBoxId === HERO_ID
            const sent = app.notified[r.id]
            return (
              <li key={r.id} className={cx('grid gap-3 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[120px_minmax(0,1fr)_220px]', hero && 'bg-crit/[0.06] shadow-[inset_3px_0_0_var(--color-crit)]', r.resolution && 'opacity-80')}>
                <div className="flex flex-row items-start gap-2 md:flex-col">
                  <SeverityBadge s={sev} />

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
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2"><CircleCheck size={14} className="text-good" aria-hidden /> Recorded · simulated</span>
                  ) : (
                    <Btn size="sm" onClick={() => { const d = draftFor(r, w); setBody(d.body); setDraft({ r, w }) }}>
                      <Mail size={13} aria-hidden /> Draft notification
                    </Btn>
                  )}
                  {r.linkedBoxId && (
                    <button onClick={() => app.go('box', r.linkedBoxId)} className="inline-flex items-center gap-1 text-[12px] text-info hover:underline">
                      Inspect cargo <ArrowRight size={12} aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Modal open={!!draft} onClose={() => setDraft(null)} title="Notification draft · simulated" wide>
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
