import { ChevronLeft, ChevronRight, Minus, Play, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../state.tsx'
import { HERO_ID } from '../data/scenario.ts'
import { cx } from './primitives.tsx'

interface Step { t: string; title: string; say: string; point?: string; apply: (a: ReturnType<typeof useApp>) => void }

const STEPS: Step[] = [
  {
    t: '0:00', title: 'The hook',
    say: 'This is Maria, a terminal planner. Today 4 of her 8 gate lanes are down, 34 trucks are waiting, and one box is telling four different stories. The usual move is to hold everything.',
    point: 'We start days earlier, with real data.',
    apply: (a) => { a.setMode('disruption'); a.setView('ops'); a.go('radar') },
  },
  {
    t: '0:20', title: 'Start with real data',
    say: 'This is a live Terminal49 shipment: EVER LAUREL, 4 real COSCO containers, due Oct 28. Before arrival there’s almost nothing to check. No weight, no holds, no deadlines, and Terminal49 even suppresses its own urgency. So we check the paperwork.',
    point: 'Point at the Oct 26 flag: declared empty, but booked as a -18°C freezer with a 27-ton VGM.',
    apply: (a) => { a.setMode('disruption'); a.go('radar') },
  },
  {
    t: '0:50', title: 'Gate day, Oct 29 07:30 (simulated)',
    say: 'Lanes 5–8 are down until 14:00. Every box is ranked by urgency, with Terminal49’s own urgency beside ours, and a recommended action. On the right: the blunt move against the plan.',
    point: 'Point at the lane strip, then at Blunt vs Gentle.',
    apply: (a) => { a.setMode('disruption'); a.setView('ops'); a.go('gate') },
  },
  {
    t: '1:10', title: 'One box, four stories',
    say: 'The carrier says empty. The crane says 27.4 tonnes. Customs has a hold. The reefer is 8.5° warm and rising. Physical readings win, every trusted value says why, and the ladder lands on Inspect: one box, not the gate.',
    point: 'Scroll to the source table, then the “When we knew” timeline.',
    apply: (a) => { a.setMode('disruption'); a.go('box', HERO_ID) },
  },
  {
    t: '1:50', title: 'Which box can’t wait?',
    say: 'Insulin gets Lane 1. Auto parts go to on-dock rail before the 11:00 cutoff. Furniture is slowed. The real box CSNU6554910 says available AND has a customs hold, so we trust the hold.',
    point: 'Click “Approve plan” and watch Blunt vs Gentle update.',
    apply: (a) => { a.setMode('disruption'); a.go('gate') },
  },
  {
    t: '2:20', title: 'Drill: wind stops cranes Friday',
    say: 'Rehearse on today’s boxes with no live actions. Relief supplies booked for Friday afternoon get pulled forward to this morning.',
    point: 'Point at the changed recommendations.',
    apply: (a) => { a.setDrill('wind_cranes_12h'); a.setMode('drill'); a.go('drill') },
  },
  {
    t: '2:40', title: 'Dual use: Security view',
    say: 'Same engine, same data. Operations only sees “Inspection requested”. Security sees the full reasoning: declared empty, 27 tonnes, a running freezer, a CBP hold placed before arrival.',
    apply: (a) => { a.setMode('disruption'); a.setView('security'); a.go('security') },
  },
  {
    t: '2:55', title: 'Close',
    say: 'Find the problem box as early as the data allows, and always choose the gentlest action that works. Built on Terminal49.',
    apply: (a) => { a.setView('ops'); a.go('built') },
  },
]

export function Guide() {
  const app = useApp()
  const [min, setMin] = useState(false)
  const i = app.guide
  if (i === null) return null
  const s = STEPS[i]
  const goto = (n: number) => {
    STEPS[n].apply(app)
    app.setGuide(n)
  }

  if (min) {
    return (
      <button onClick={() => setMin(false)}
        className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full border border-line-2 bg-panel-2 px-3.5 py-2 text-[12.5px] font-medium text-ink shadow-2xl">
        <Play size={13} className="text-info" aria-hidden /> Demo {i + 1}/{STEPS.length} · {s.title}
      </button>
    )
  }

  return (
    <aside aria-label="Guided demo" className="fixed right-3 bottom-3 z-40 w-[min(410px,calc(100vw-1.5rem))] rounded-2xl border border-line-2 bg-panel-2/97 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] backdrop-blur">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="rounded bg-info/20 px-1.5 py-px font-mono text-[11px] font-semibold text-info">{s.t}</span>
        <span className="text-[12px] font-medium text-muted">Guided demo · step {i + 1} of {STEPS.length}</span>
        <div className="ml-auto flex items-center">
          <button onClick={() => setMin(true)} aria-label="Minimise guide" className="rounded p-1 text-muted hover:bg-panel-3 hover:text-ink"><Minus size={15} /></button>
          <button onClick={() => app.setGuide(null)} aria-label="Close guide" className="rounded p-1 text-muted hover:bg-panel-3 hover:text-ink"><X size={15} /></button>
        </div>
      </div>
      <div className="px-4 pt-3 pb-3.5">
        <h3 className="text-[15.5px] font-semibold tracking-tight">{s.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">“{s.say}”</p>
        {s.point && <p className="mt-2 text-[12.5px] leading-snug text-warn">▸ {s.point}</p>}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {STEPS.map((_, n) => (
              <button key={n} tabIndex={-1} onClick={() => goto(n)} className={cx('h-1.5 flex-1 rounded-full', n <= i ? 'bg-info' : 'bg-line-2')} />
            ))}
          </div>
          <button disabled={i === 0} onClick={() => goto(i - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line-2 px-2.5 text-[12.5px] text-ink-2 hover:bg-panel-3 disabled:opacity-30">
            <ChevronLeft size={14} aria-hidden /> Back
          </button>
          {i < STEPS.length - 1 ? (
            <button onClick={() => goto(i + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-info px-3 text-[12.5px] font-semibold text-white hover:bg-[#4b95ec]">
              Next <ChevronRight size={14} aria-hidden />
            </button>
          ) : (
            <button onClick={() => app.setGuide(null)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-good px-3 text-[12.5px] font-semibold text-[#04130a]">Done</button>
          )}
        </div>
      </div>
    </aside>
  )
}
