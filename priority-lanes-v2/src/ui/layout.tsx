import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Anchor, FileText, Truck, X } from 'lucide-react'
import { cx } from './primitives.tsx'

export function ScreenHeader({ title, kicker, sub, right }: { title: string; kicker?: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-3xl">
        {kicker && <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">{kicker}</div>}
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-ink sm:text-[24px]">{title}</h1>
        {sub && <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

const STAGES = [
  { key: 'paper', icon: FileText, title: 'Days before arrival', what: 'Paperwork only: declarations, VGM, setpoints, early holds', when: 'Oct 26–27' },
  { key: 'discharge', icon: Anchor, title: 'At discharge', what: 'Physical: crane weight, reefer plugged in, holds & deadlines fill in', when: 'Oct 28' },
  { key: 'gate', icon: Truck, title: 'At the gate', what: 'Whatever slipped through, handled with the gentlest action', when: 'Oct 29' },
] as const

/** "When each piece becomes known": the timeline every screen respects. */
export function StageStrip({ active }: { active: 'paper' | 'discharge' | 'gate' }) {
  return (
    <ol className="mb-4 grid gap-2 sm:grid-cols-3" aria-label="When each piece of data becomes known">
      {STAGES.map((s, i) => {
        const on = s.key === active
        return (
          <li key={s.key} className={cx('flex items-start gap-3 rounded-xl border px-3.5 py-2.5', on ? 'border-info/60 bg-info/10' : 'border-line bg-panel')}>
            <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', on ? 'bg-info text-white' : 'bg-panel-3 text-muted')}>
              <s.icon size={15} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                {i + 1}. {s.title}
                <span className="font-mono text-[11px] font-normal text-muted">{s.when}</span>
                {on && <span className="rounded bg-info/25 px-1 text-[10px] font-semibold tracking-wide text-ink uppercase">You are here</span>}
              </span>
              <span className="block text-[12px] leading-snug text-ink-2">{s.what}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('textarea, input, button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={cx('max-h-[90vh] w-full overflow-auto rounded-2xl border border-line-2 bg-panel-2 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-panel-3 hover:text-ink"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
