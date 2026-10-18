import { Embedded, EMBEDDED } from './Embedded.tsx'
import { BookOpen, ChartColumn, Layers, LayoutDashboard, Lock, Play, Radar, ShieldAlert, Siren, SlidersHorizontal, Workflow } from 'lucide-react'
import { RulebookScreen } from './live/RulebookScreen.tsx' // PortAble kit
import type { LucideIcon } from 'lucide-react'
import { useApp } from './state.tsx'
import type { Screen } from './state.tsx'
import { cx, Segmented } from './ui/primitives.tsx'
import { Guide } from './ui/Guide.tsx'
import { PreArrival } from './screens/PreArrival.tsx'
import { Dashboard } from './screens/Dashboard.tsx'
import { BoxDetail } from './screens/BoxDetail.tsx'
import { GateForecast } from './screens/GateForecast.tsx'
import { Drill } from './screens/Drill.tsx'
import { Security } from './screens/Security.tsx'
import { Learning } from './screens/Learning.tsx'
import { HowBuilt } from './screens/HowBuilt.tsx'
import { DRILLS } from './engine/context.ts'
import { fmtTime, fmtWeekday } from './engine/time.ts'
import { INBOUND } from './data/scenario.ts'

const NAV: { id: Screen; label: string; icon: LucideIcon; sub: string }[] = [
  { id: 'radar', label: 'Pre-Arrival Radar', icon: Radar, sub: 'Days before' },
  { id: 'gate', label: 'Dashboard', icon: LayoutDashboard, sub: 'Today' },
  { id: 'box', label: 'Four Stories', icon: Layers, sub: 'Box detail' },
  { id: 'forecast', label: 'Gate Forecast', icon: ChartColumn, sub: 'Next 36h' },
  { id: 'drill', label: 'Drill Mode', icon: Siren, sub: 'Rehearse' },
  { id: 'security', label: 'Security View', icon: ShieldAlert, sub: 'Dual use' },
  { id: 'learning', label: 'Learning Log', icon: BookOpen, sub: 'After action' },
  { id: 'built', label: 'How it’s built', icon: Workflow, sub: 'Feasibility' },
  { id: 'rulebook', label: 'Rulebook', icon: SlidersHorizontal, sub: 'Your rules' }, // PortAble kit
]

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#111a2b" stroke="#2b3a57" />
      <path d="M8 22h16M8 16h11M8 10h6" stroke="#21b35b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="10" r="2.5" fill="#ec835a" />
    </svg>
  )
}

export default function App() {
  const app = useApp()
  const { screen, go, mode, setMode, view, setView, pending, ctx, drill } = app
  const openInbound = INBOUND.filter((r) => !r.resolution).length
  const isRadar = screen === 'radar'
  const drillMeta = DRILLS.find((d) => d.id === drill)

  if (EMBEDDED) return <Embedded />
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-panel focus:px-3 focus:py-2">Skip to content</a>

      {/* provenance banner */}
      {mode === 'drill' ? (
        <div className="drill-stripes border-b border-warn/40 px-4 py-1.5 text-center text-[12.5px] font-semibold tracking-wide text-ink" role="status">
          <Siren size={13} className="mr-1.5 inline -translate-y-px text-warn" aria-hidden />
          DRILL: no live actions. Rehearsing “{drillMeta?.title}” on today’s boxes. Approvals are disabled.
        </div>
      ) : (
        <div className="sim-stripes border-b border-sim/30 px-4 py-1.5 text-center text-[12px] leading-snug text-ink" role="note">
          <strong className="font-semibold tracking-wide text-sim uppercase">Simulated scenario</strong>
          <span className="text-ink-2"> · Real: one live Terminal49 shipment (4 containers, snapshot Oct 17). Everything after Oct 17 (arrival, holds, sensors, outages, the planner) is simulated and is <strong className="text-ink">not</strong> real APM Terminals operations.</span>
        </div>
      )}

      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 lg:px-5">
          <button onClick={() => go('radar')} className="flex items-center gap-2.5 text-left">
            <Logo />
            <span>
              <span className="block text-[16px] leading-tight font-semibold tracking-tight">Priority Lanes</span>
              <span className="block text-[11.5px] text-muted">Pre-emptive gate decisions</span>
            </span>
          </button>
          <div className="hidden h-8 w-px bg-line md:block" />
          <div className="hidden min-w-0 text-[12.5px] leading-tight md:block">
            <div className="font-medium text-ink">APMT · W185 · Los Angeles <span className="text-muted">(terminal from Terminal49)</span></div>
            <div className="text-muted">
              {isRadar ? <>Live snapshot Sat Oct 17, 20:03 UTC</> : <>{fmtWeekday(ctx.now)} · {fmtTime(app.clock)} PDT · morning shift</>}
              {' · '}Maria Delgado, Gate & Yard Planner <span className="text-sim">(fictional)</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented label="Mode" value={mode} onChange={setMode} size="sm"
              options={[{ value: 'ordinary', label: 'Ordinary day' }, { value: 'disruption', label: 'Disruption' }, { value: 'drill', label: 'Drill' }]} />
            <Segmented label="View" value={view} onChange={setView} size="sm"
              options={[{ value: 'ops', label: 'Operations' }, { value: 'security', label: 'Security', icon: ShieldAlert }]} />
            {app.guide === null && (
              <button onClick={() => { setMode('disruption'); setView('ops'); go('radar'); app.setGuide(0) }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-info px-3 text-[12.5px] font-semibold text-white hover:bg-[#4b95ec]">
                <Play size={13} aria-hidden /> Guided demo
              </button>
            )}
          </div>
        </div>
        {/* mobile nav */}
        <nav aria-label="Screens" className="scroll-thin flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 lg:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cx('flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium', screen === n.id ? 'bg-panel-3 text-ink' : 'text-muted')}>
              <n.icon size={14} aria-hidden /> {n.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex">
        {/* sidebar */}
        <nav aria-label="Screens" className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[220px] shrink-0 flex-col border-r border-line bg-panel/40 px-2.5 py-3 lg:flex">
          {NAV.map((n, i) => {
            const on = screen === n.id
            const locked = n.id === 'security' && view === 'ops'
            const badge = n.id === 'radar' ? `${openInbound} open` : n.id === 'gate' && mode !== 'drill' && pending ? `${pending}` : null
            return (
              <button key={n.id} onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
                className={cx('group mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', on ? 'bg-panel-3 text-ink shadow-[inset_2px_0_0_var(--color-info)]' : 'text-ink-2 hover:bg-panel-2 hover:text-ink')}>
                <span className="w-3 font-mono text-[10.5px] text-dim">{i + 1}</span>
                <n.icon size={16} aria-hidden className={on ? 'text-info' : 'text-muted group-hover:text-ink-2'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-tight font-medium">{n.label}</span>
                  <span className="block text-[11px] text-dim">{n.sub}</span>
                </span>
                {locked && <Lock size={12} className="text-dim" aria-label="Restricted in Operations view" />}
                {badge && <span className="rounded bg-panel-3 px-1.5 font-mono text-[10.5px] text-ink-2">{badge}</span>}
              </button>
            )
          })}
          <div className="mt-auto space-y-2 border-t border-line px-1 pt-3 text-[11px] leading-snug text-muted">
            <div className="flex items-center gap-1.5"><span className="pulse-dot size-1.5 rounded-full bg-live" /> Live = real Terminal49 data</div>
            <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-[1px] bg-sim" /> Simulated = invented, same field format</div>
            <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-full border border-muted" /> Sample = illustrative rates</div>
            <div className="pt-1 text-dim">Built on Terminal49’s container-tracking API.</div>
          </div>
        </nav>

        <main id="main" className="min-w-0 flex-1 px-4 pt-4 pb-40 lg:px-6 lg:pt-5">
          {screen === 'radar' && <PreArrival />}
          {screen === 'gate' && <Dashboard />}
          {screen === 'box' && <BoxDetail />}
          {screen === 'forecast' && <GateForecast />}
          {screen === 'drill' && <Drill />}
          {screen === 'security' && <Security />}
          {screen === 'learning' && <Learning />}
          {screen === 'built' && <HowBuilt />}
          {screen === 'rulebook' && <RulebookScreen />}
        </main>
      </div>
      <Guide />
    </div>
  )
}
