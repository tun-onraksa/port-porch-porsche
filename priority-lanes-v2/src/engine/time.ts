// Time helpers. Everything is epoch ms internally; the UI shows Los Angeles wall time,
// which is what the planner (and Terminal49's pod_timezone) uses.

export const TZ = 'America/Los_Angeles'
export const HOUR = 3_600_000
export const MIN = 60_000

export const ms = (iso: string) => Date.parse(iso)

/** LA wall time → epoch ms. DST ends 2026-11-01 02:00, which is all this demo spans. */
export function la(ymd: string, hhmm = '00:00'): number {
  const [h, m] = hhmm.split(':').map(Number)
  const offset = ymd >= '2026-11-01' ? 8 : 7
  return Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), h + offset, m)
}
export const laIso = (ymd: string, hhmm: string) => new Date(la(ymd, hhmm)).toISOString()

/** A last-free-day date ends when the day-shift gate closes. */
export const DEADLINE_CLOCK = '17:00'
export const deadlineAt = (ymd: string) => la(ymd, DEADLINE_CLOCK)

export const hoursBetween = (a: number, b: number) => (b - a) / HOUR

const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(key: string, opts: Intl.DateTimeFormatOptions) {
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts })
    cache.set(key, f)
  }
  return f
}

const toDate = (t: number | string) => new Date(typeof t === 'string' ? ms(t) : t)

/** 07:30 */
export const fmtTime = (t: number | string) =>
  fmt('t', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(toDate(t))
/** Oct 29 */
export const fmtDay = (t: number | string) => fmt('d', { month: 'short', day: 'numeric' }).format(toDate(t))
/** Thu Oct 29 */
export const fmtWeekday = (t: number | string) =>
  fmt('wd', { weekday: 'short', month: 'short', day: 'numeric' }).format(toDate(t))
/** Oct 29, 07:30 */
export const fmtDayTime = (t: number | string) => `${fmtDay(t)}, ${fmtTime(t)}`
/** "Oct 30" from a bare date, no timezone shifting. */
export function fmtYmd(ymd: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[+ymd.slice(5, 7) - 1]} ${+ymd.slice(8, 10)}`
}
/** Local hour 0–23 in LA. */
export const laHour = (t: number) => +fmt('h', { hour: '2-digit', hourCycle: 'h23' }).format(new Date(t))

/** 9h 30m · 2d 4h · 45m */
export function fmtDuration(hours: number) {
  const h = Math.abs(hours)
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) {
    const whole = Math.floor(h)
    const m = Math.round((h - whole) * 60)
    return m === 0 || whole >= 10 ? `${Math.round(h)}h` : `${whole}h ${m}m`
  }
  const d = Math.floor(h / 24)
  const rest = Math.round(h - d * 24)
  return rest ? `${d}d ${rest}h` : `${d}d`
}
