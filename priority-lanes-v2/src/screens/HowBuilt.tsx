import { ArrowDown, ArrowRight, Check, Database, Radio, Ship, UserCheck, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'
import { useApp } from '../state.tsx'
import { cx, LiveTag, Panel, SimTag } from '../ui/primitives.tsx'
import { ScreenHeader } from '../ui/layout.tsx'

const THEME: [string, string][] = [
  ['A person who decides', 'The terminal planner. Every action needs her approval; modifications need a logged reason.'],
  ['Pre-emptive, not reactionary', 'Paperwork conflicts flagged days ahead (the hero box on Oct 26), physical conflicts at discharge, gate rush forecast, a ready playbook, and drills.'],
  ['Gentlest response that works', 'The 8-step action ladder always picks the lowest step that resolves the issue and shows why the others are insufficient or unnecessary.'],
  ['Cheap enough to use widely', 'No new hardware. Runs on Terminal49 plus data the terminal already has, in a browser. Small terminals can use it.'],
  ['Safe around people', 'Flags weight hazards to crane operators and drivers; never auto-releases or auto-blocks; fewer shutdowns means fewer stranded drivers.'],
  ['Useful on an ordinary day', 'Ordinary-day mode: daily conflict clean-up, deadline warnings, appointment smoothing, reefer watch.'],
  ['Dual-use twist', 'The same mismatch detection that keeps cargo moving flags possible contraband or danger for CBP, on a role-separated Security view.'],
]

function Node({ icon: Icon, title, children, tone }: { icon: typeof Ship; title: string; children: ReactNode; tone: 'live' | 'sim' | 'core' | 'human' }) {
  const border = { live: 'border-live/50', sim: 'border-sim/50', core: 'border-info/60 bg-info/[0.07]', human: 'border-good/50' }[tone]
  return (
    <div className={cx('rounded-xl border bg-panel px-3.5 py-3', border)}>
      <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><Icon size={15} aria-hidden />{title}</div>
      <div className="mt-1 text-[12.5px] leading-snug text-ink-2">{children}</div>
    </div>
  )
}

export function HowBuilt() {
  const app = useApp()
  return (
    <div>
      <ScreenHeader
        title="How it’s built"
        kicker={<span>Feasibility · real vs simulated</span>}
        sub="A decision layer that sits on top of Terminal49 and the terminal’s own software. It doesn’t replace either; it reconciles them, decides, costs the options and acts as early as each piece of data allows."
      />

      <Panel className="mb-4" title="Architecture" bodyClass="p-4">
        <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.1fr)_32px_minmax(0,0.8fr)]">
          <div className="space-y-2">
            <Node icon={Ship} title="Terminal49 API" tone="live">
              <div className="mb-1"><LiveTag>Real</LiveTag></div>
              Shipments, containers, events with <span className="font-mono">data_source</span>, holds, fees, <span className="font-mono">import_deadlines_*</span>, <span className="font-mono">urgency</span>, webhooks. The outside view.
            </Node>
            <Node icon={Database} title="Terminal systems (TOS, scales, reefer plugs)" tone="sim">
              <div className="mb-1"><SimTag /></div>
              Crane and gate weights, reefer telemetry, yard positions, lanes, truck queue. The inside view, via existing feeds (e.g. Navis N4).
            </Node>
            <Node icon={Radio} title="Declarations + importer input" tone="sim">
              <div className="mb-1"><SimTag /></div>
              Carrier EDI (status, commodity, VGM, setpoint, hazmat), early customs holds, and one new field: cargo criticality.
            </Node>
          </div>
          <div className="hidden items-center justify-center text-muted lg:flex"><ArrowRight aria-hidden /></div>
          <div className="flex justify-center text-muted lg:hidden"><ArrowDown aria-hidden /></div>
          <Node icon={Workflow} title="Priority Lanes engine (runs in the browser)" tone="core">
            <ol className="mt-1 space-y-1.5">
              {[
                ['Reconcile', 'one record per box, every source side by side'],
                ['Judge sources', 'authority × freshness × track record'],
                ['Score urgency', '6 explained factors, next to Terminal49’s urgency'],
                ['Recommend', 'gentlest step on the 8-step ladder, with costs'],
                ['Plan the gate', 'lanes, slots, rail, inspection bay; blunt vs gentle'],
                ['Learn', 'which source was right → reliability'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-2"><span className="font-mono text-[11px] text-info">{i + 1}</span><span><strong className="text-ink">{t}</strong>: {d}</span></li>
              ))}
            </ol>
          </Node>
          <div className="hidden items-center justify-center text-muted lg:flex"><ArrowRight aria-hidden /></div>
          <div className="flex justify-center text-muted lg:hidden"><ArrowDown aria-hidden /></div>
          <div className="space-y-2">
            <Node icon={UserCheck} title="Planner approves" tone="human">Approve / Modify / Reject. Nothing happens on its own.</Node>
            <Node icon={Radio} title="Notifications" tone="human">Truckers, importers, carriers, CBP, yard, reefer team: drafted, sent on approval.</Node>
          </div>
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title="What’s real" right={<LiveTag>Real</LiveTag>}>
          <ul className="space-y-1.5 text-[13px] text-ink-2">
            <li>• The Terminal49 snapshot from a live account (2026-10-17 20:03 UTC): shipment, B/L 9509953390, EVER LAUREL 1241E, 4 container IDs and numbers, events and their <span className="font-mono">data_source</span>.</li>
            <li>• Terminal49 field names, hold and fee shapes, deadline versions, the suppressed <span className="font-mono">urgency</span> and its reason.</li>
            <li>• The documented disagreement between <span className="font-mono">available_for_pickup</span> and holds, and Terminal49’s advice to use the earliest deadline.</li>
            <li>• Free developer key covers up to 100 containers.</li>
          </ul>
        </Panel>
        <Panel title="What’s simulated" right={<SimTag />}>
          <ul className="space-y-1.5 text-[13px] text-ink-2">
            <li>• Everything after Oct 17: arrival, discharge, holds, fees, deadlines, the power fault, wind advisory and truck queue.</li>
            <li>• Carrier declarations and VGM, crane/gate weights, reefer telemetry, yard positions, lanes, importer categories, reliability history.</li>
            <li>• The planner persona (Maria Delgado) and all APM Terminals operations shown. Not real.</li>
            <li>• Charge rates, throughput and costs are sample figures. Terminal49 urgency values beyond “unknown” are simulated.</li>
          </ul>
        </Panel>
      </div>

      <Panel className="mb-4" title="Fit to the brief" sub="“Help someone prepare for disaster: pre-emptive rather than reactionary, the gentlest response that still works.”" bodyClass="p-0">
        <table className="w-full text-left text-[13px]">
          <tbody>
            {THEME.map(([k, v]) => (
              <tr key={k} className="border-b border-line/70 align-top last:border-0">
                <th scope="row" className="w-[34%] px-4 py-2.5 font-semibold text-ink"><Check size={13} className="mr-1.5 inline -translate-y-px text-good" aria-hidden />{k}</th>
                <td className="px-4 py-2.5 text-ink-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Production path">
          <ul className="space-y-1.5 text-[13px] text-ink-2">
            <li>• Terminal49 webhooks (<span className="font-mono">container.updated</span>, <span className="font-mono">pickup_lfd.changed</span>, <span className="font-mono">vessel_discharged</span>…) keep the outside view current.</li>
            <li>• Read-only feeds from the TOS and reefer monitoring; runs alongside existing software.</li>
            <li>• No hardware. The engine is plain TypeScript; this demo runs it entirely in the browser.</li>
          </ul>
        </Panel>
        <Panel title="Business model">
          <ul className="space-y-1.5 text-[13px] text-ink-2">
            <li>• Per-terminal subscription.</li>
            <li>• Security module for CBP and port security.</li>
            <li>• Terminal49 as data partner and a natural channel.</li>
          </ul>
        </Panel>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-panel px-5 py-6 text-center">
        <p className="mx-auto max-w-3xl text-[19px] leading-snug font-semibold text-ink">Find the problem box as early as the data allows, and always choose the gentlest action that works.</p>
        <p className="mt-2 text-[13px] text-muted">Built on Terminal49.</p>
        <button onClick={() => app.go('radar')} className="mt-3 text-[13px] text-info hover:underline">Back to the start</button>
      </div>
    </div>
  )
}
