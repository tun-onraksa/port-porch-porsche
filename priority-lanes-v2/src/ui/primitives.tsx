import type { ReactNode } from 'react'
import {
  Apple, Armchair, Ban, Box as BoxIcon, CircleCheck, CircleQuestionMark, Cpu, Eye, Factory, Fish, Flag, FlaskConical,
  Hand, HeartPulse, Hourglass, Info, LifeBuoy, OctagonAlert, OctagonX, Route, ScanSearch, Shirt, Snowflake, ToyBrick, TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActionKey, CargoKind, Confidence, Hold, Severity, Urgency } from '../engine/types.ts'
import { actionLabel } from '../engine/actions.ts'
import { BAND_LABEL } from '../engine/urgency.ts'
import { fmtDuration } from '../engine/time.ts'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------- layout

export function Panel({ title, sub, right, children, className, bodyClass, id, collapsible = false }: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string; collapsible?: boolean
}) {
 const content=<div className={cx(bodyClass ?? 'p-4')}>{sub&&<p className="panel-note">{sub}</p>}{children}</div>
 if(collapsible)return <details id={id} className={cx('quiet-disclosure',className)}><summary>{title}</summary>{right&&<div className="px-4">{right}</div>}{content}</details>
 return <section id={id} className={cx('quiet-panel rounded-xl border border-line bg-panel',className)}>
  {(title||right)&&<header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>{right&&<div className="flex flex-wrap items-center gap-2">{right}</div>}</header>}
  {content}
 </section>
}

export function Disclosure({title,children}:{title:ReactNode;children:ReactNode}){
 return <details className="quiet-disclosure"><summary>{title}</summary><div className="disclosure-body">{children}</div></details>
}

export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled, title, className, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'quiet' | 'good'; size?: 'sm' | 'md' | 'lg'
  disabled?: boolean; title?: string; className?: string; type?: 'button' | 'submit'
}) {
  const v = {
    primary: 'bg-info text-white hover:bg-[#4b95ec] border-transparent',
    good: 'bg-good text-[#04130a] hover:brightness-110 border-transparent',
    danger: 'bg-transparent text-crit border-crit/50 hover:bg-crit/10',
    ghost: 'bg-panel-2 text-ink border-line-2 hover:bg-panel-3',
    quiet: 'bg-transparent text-ink-2 border-transparent hover:bg-panel-2 hover:text-ink',
  }[variant]
  const s = { sm: 'h-7 px-2.5 text-[12px] gap-1.5', md: 'h-9 px-3.5 text-[13px] gap-2', lg: 'h-11 px-5 text-[15px] gap-2' }[size]
  return (
    <button data-variant={variant} type={type} title={title} disabled={disabled} onClick={onClick}
      className={cx('quiet-button inline-flex shrink-0 items-center justify-center rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40', v, s, className)}>
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label, size = 'md' }: {
  options: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line-2 bg-panel p-0.5">
      {options.map((o) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button key={o.value} role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cx('inline-flex items-center gap-1.5 rounded-md font-medium transition-colors', size === 'sm' ? 'h-7 px-2 text-[12px]' : 'h-8 px-3 text-[13px]',
              on ? 'bg-panel-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]' : 'text-muted hover:text-ink')}>
            {Icon && <Icon size={14} aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- provenance tags

export function SimTag({ children = 'Simulated', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded border border-sim/40 bg-sim/10 px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-sim uppercase', className)}>
      <span aria-hidden className="size-1.5 rounded-[1px] bg-sim" />
      {children}
    </span>
  )
}
export function LiveTag({ children = 'Terminal49 snapshot', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded border border-live/40 bg-live/10 px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-live uppercase', className)}>
      <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-live" />
      {children}
    </span>
  )
}
export function RealTag() {
  return (
    <span title="Real container from the live Terminal49 snapshot (Oct 17). Its post-arrival state is simulated."
      className="inline-flex items-center gap-1 rounded border border-live/40 px-1 py-px text-[10px] font-semibold tracking-wide text-live uppercase">
      Real ID
    </span>
  )
}
export function SampleTag({ children = 'Sample rates' }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded border border-line-2 px-1.5 py-px text-[10.5px] font-medium tracking-wide text-muted uppercase">{children}</span>
}

// ---------------------------------------------------------------- actions, severity, urgency

export const ACTION_ICON: Record<ActionKey, LucideIcon> = {
  release: CircleCheck, watch: Eye, flag: Flag, slow: Hourglass, reroute: Route, inspect: ScanSearch, hold: Hand, close: OctagonX,
}
export const ACTION_COLOR: Record<ActionKey, string> = {
  release: 'var(--color-a-release)', watch: 'var(--color-a-watch)', flag: 'var(--color-a-flag)', slow: 'var(--color-a-slow)',
  reroute: 'var(--color-a-reroute)', inspect: 'var(--color-a-inspect)', hold: 'var(--color-a-hold)', close: 'var(--color-a-close)',
}

export function ActionChip({ k, also = [], size = 'md', label }: { k: ActionKey; also?: ActionKey[]; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const Icon = ACTION_ICON[k]
  const c = ACTION_COLOR[k]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md border font-semibold whitespace-nowrap',
      size === 'sm' ? 'px-1.5 py-0.5 text-[11.5px]' : size === 'lg' ? 'px-3 py-1.5 text-[15px]' : 'px-2 py-0.5 text-[12.5px]')}
      style={{ borderColor: `color-mix(in oklab, ${c} 55%, transparent)`, background: `color-mix(in oklab, ${c} 13%, transparent)` }}>
      <Icon size={size === 'lg' ? 18 : 14} style={{ color: c }} aria-hidden />
      <span className="text-ink">{label ?? actionLabel(k)}</span>
      {also.map((a) => (
        <span key={a} className="inline-flex items-center gap-1 text-ink-2">+ {actionLabel(a)}</span>
      ))}
    </span>
  )
}

export const SEV_META: Record<Severity, { label: string; icon: LucideIcon; color: string }> = {
  critical: { label: 'Critical', icon: OctagonAlert, color: 'var(--color-crit)' },
  major: { label: 'Major', icon: TriangleAlert, color: 'var(--color-warn)' },
  minor: { label: 'Minor', icon: Info, color: 'var(--color-muted)' },
}
export function SeverityBadge({ s, label, size = 'md' }: { s: Severity | null; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  if (!s) return <span className="text-[12px] text-dim">No conflict</span>
  const m = SEV_META[s]
  const Icon = m.icon
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap', size === 'lg' ? 'px-2.5 py-1 text-[14px]' : size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-[12px]')}
      style={{ background: `color-mix(in oklab, ${m.color} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${m.color} 50%, transparent)` }}>
      <Icon size={size === 'lg' ? 16 : 13} style={{ color: m.color }} aria-hidden />
      <span className="text-ink">{label ?? m.label}</span>
    </span>
  )
}

export const BAND_COLOR = { critical: 'var(--color-crit)', high: 'var(--color-serious)', normal: 'var(--color-info)', can_slow: 'var(--color-a-slow)' }
export function UrgencyPill({ u, size = 'md' }: { u: Urgency; size?: 'sm' | 'md' | 'lg' }) {
  const c = BAND_COLOR[u.band]
  return (
    <span className={cx('inline-flex items-center gap-2 whitespace-nowrap', size === 'lg' && 'gap-3')}>
      <span className={cx('grid place-items-center rounded-md font-mono font-semibold text-ink', size === 'lg' ? 'h-12 w-14 text-[26px]' : size === 'sm' ? 'h-6 w-8 text-[12.5px]' : 'h-7 w-9 text-[14px]')}
        style={{ background: `color-mix(in oklab, ${c} 22%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 60%, transparent)` }}>
        {u.score}
      </span>
      <span className={cx('font-medium text-ink-2', size === 'lg' ? 'text-[15px]' : 'text-[12px]')}>
        <span aria-hidden className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: c }} />
        {BAND_LABEL[u.band]}
      </span>
    </span>
  )
}

export function T49Urgency({ value, simulated }: { value: string; simulated: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-2" title={simulated ? 'Terminal49 urgency value: simulated for the post-arrival scenario' : 'Terminal49 urgency field (live)'}>
      {value}
      {simulated && <sup className="text-[9px] text-sim">sim</sup>}
    </span>
  )
}

export function HoldChips({ holds }: { holds: Hold[] }) {
  if (!holds.length) return <span className="text-[12px] text-dim">None</span>
  return (
    <span className="flex flex-wrap gap-1">
      {holds.map((h) => (
        <span key={h.name + h.status} title={h.description}
          className={cx('inline-flex items-center gap-1 rounded px-1.5 py-px font-mono text-[11px] font-medium', h.status === 'hold' ? 'bg-crit/15 text-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-crit)_50%,transparent)]' : 'bg-warn/10 text-ink-2 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-warn)_40%,transparent)]')}>
          <Ban size={11} aria-hidden className={h.status === 'hold' ? 'text-crit' : 'text-warn'} />
          {h.name}
          <span className="text-muted">{h.status}</span>
        </span>
      ))}
    </span>
  )
}

export function Countdown({ hours, note }: { hours: number | null; note?: string | null }) {
  if (hours === null) return <span className="text-[12px] text-dim">—</span>
  const past = hours < 0
  const tone = past ? 'text-crit' : hours < 12 ? 'text-serious' : hours < 48 ? 'text-ink' : 'text-ink-2'
  return (
    <span className={cx('font-mono text-[12.5px] whitespace-nowrap', tone)} title={note ?? undefined}>
      {past ? `${fmtDuration(-hours)} past` : `in ${fmtDuration(hours)}`}
      {note && <span className="ml-1 text-warn" aria-label="adjusted for weather">*</span>}
    </span>
  )
}

export function ReeferCell({ r }: { r: { current: number; dev: number; trend: number; alarm: string | null } | null }) {
  if (!r) return <span className="text-[12px] text-dim">—</span>
  const warm = r.dev > 2
  return (
    <span className="inline-flex max-w-[140px] flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-[12px]">
      <Snowflake size={12} aria-hidden className={warm ? 'text-serious' : 'text-a-watch'} />
      <span className="text-ink">{r.current.toFixed(1)}°</span>
      <span className={warm ? 'text-serious' : 'text-muted'}>{r.dev >= 0 ? '+' : ''}{r.dev.toFixed(1)}</span>
      {r.trend > 0.4 && <span className="text-serious">↑{r.trend.toFixed(1)}/h</span>}
      {r.alarm && <span className="rounded bg-crit/20 px-1 text-[10px] text-ink">{r.alarm}</span>}
    </span>
  )
}

export function ConfidenceBar({ c, compact }: { c: Confidence | null; compact?: boolean }) {
  if (!c) return null
  const p = Math.round(c.value * 100)
  const color = p >= 85 ? 'var(--color-good)' : p >= 65 ? 'var(--color-warn)' : 'var(--color-serious)'
  return (
    <span className="inline-flex items-center gap-2" title={`authority ${c.authority.toFixed(2)} × freshness ${c.freshness.toFixed(2)} (${c.freshnessNote}) × track record ${c.track.toFixed(2)} (${c.trackNote})`}>
      <span className={cx('relative h-1.5 overflow-hidden rounded-full bg-line-2', compact ? 'w-10' : 'w-16')}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, background: color }} />
      </span>
      <span className="font-mono text-[12px] text-ink">{p}%</span>
    </span>
  )
}

export function Kpi({ label, value, sub, icon: Icon, tone, onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: LucideIcon; tone?: 'crit' | 'warn' | 'good' | 'info'; onClick?: () => void
}) {
  const color = tone ? `var(--color-${tone})` : 'var(--color-muted)'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cx('quiet-kpi flex min-w-0 flex-col rounded-xl border border-line bg-panel px-3.5 py-3 text-left', onClick && 'transition-colors hover:border-line-2 hover:bg-panel-2')}>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <Icon size={14} style={{ color }} aria-hidden />
        {label}
      </span>
      <span className="mt-1 font-mono text-[24px] leading-tight font-semibold tracking-tight text-ink">{value}</span>
      {sub && <span className="mt-0.5 text-[12px] leading-snug text-ink-2">{sub}</span>}
    </Tag>
  )
}

const CARGO_ICON: Record<CargoKind, LucideIcon> = {
  medical: HeartPulse, relief: LifeBuoy, frozen: Fish, produce: Apple, industrial: Factory, hazmat: FlaskConical,
  electronics: Cpu, furniture: Armchair, toys: ToyBrick, apparel: Shirt, general: BoxIcon, unknown: CircleQuestionMark,
}
export function CargoIcon({ kind, size = 15, className }: { kind: CargoKind; size?: number; className?: string }) {
  const Icon = CARGO_ICON[kind]
  const tone = kind === 'medical' ? 'text-crit' : kind === 'relief' ? 'text-serious' : kind === 'hazmat' ? 'text-warn' : kind === 'unknown' ? 'text-sim' : 'text-ink-2'
  return <Icon size={size} aria-hidden className={cx(tone, className)} />
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono', className)}>{children}</span>
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-[13px] text-muted">{children}</div>
}
