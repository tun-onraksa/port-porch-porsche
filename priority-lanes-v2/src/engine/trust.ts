// "Which source do you trust?"
// Each source is the authority on what it physically measures or legally controls; physical
// measurements beat declarations; fresher beats older; track record adjusts trust.
//   confidence = authority_weight × freshness_factor × track_record_factor

import type { Box, Cell, Confidence, Conflict, TrustedAttr } from './types.ts'
import { HOUR, deadlineAt, fmtDayTime, fmtYmd, ms } from './time.ts'
import { kg, lbsToKg } from './rates.ts'

export const AUTHORITY = {
  crane_scale: 0.95,
  gate_scale: 0.95,
  reefer_telemetry: 0.95,
  customs: 1.0,
  terminal_availability: 0.85,
  vgm: 0.8,
  carrier_declaration: 0.7,
  ais: 0.9,
  tos: 0.95,
  terminal_event: 0.9,
  shipping_line_event: 0.75,
  facility_deadline: 0.85,
  line_deadline: 0.8,
  booking_setpoint: 0.7,
} as const
export type SourceKey = keyof typeof AUTHORITY

export const SOURCE_LABEL: Record<SourceKey, string> = {
  crane_scale: 'Crane scale',
  gate_scale: 'Gate scale',
  reefer_telemetry: 'Reefer telemetry',
  customs: 'Customs (CBP)',
  terminal_availability: 'Terminal availability',
  vgm: 'VGM',
  carrier_declaration: 'Carrier declaration',
  ais: 'AIS',
  tos: 'Terminal TOS',
  terminal_event: 'Terminal event',
  shipping_line_event: 'Shipping line event',
  facility_deadline: 'Terminal (facility) deadline',
  line_deadline: 'Line deadline',
  booking_setpoint: 'Booking setpoint',
}

/** Track record: share of past conflicts where the source turned out right (simulated history). */
export interface Reliability {
  sources: Record<SourceKey, { right: number; total: number }>
  carriers: Record<string, { right: number; total: number }> // declarations, by SCAC
  invalidated: Record<string, number> // events retracted, by data_source
}

export const BASE_RELIABILITY: Reliability = {
  sources: {
    crane_scale: { right: 297, total: 300 },
    gate_scale: { right: 198, total: 200 },
    reefer_telemetry: { right: 194, total: 200 },
    customs: { right: 120, total: 120 },
    terminal_availability: { right: 93, total: 100 },
    vgm: { right: 95, total: 100 },
    carrier_declaration: { right: 88, total: 100 },
    ais: { right: 98, total: 100 },
    tos: { right: 198, total: 200 },
    terminal_event: { right: 99, total: 100 },
    shipping_line_event: { right: 96, total: 100 },
    facility_deadline: { right: 96, total: 100 },
    line_deadline: { right: 94, total: 100 },
    booking_setpoint: { right: 97, total: 100 },
  },
  carriers: {
    COSU: { right: 32, total: 37 }, // "COSCO declared weights correct in 86% of past conflicts"
    MAEU: { right: 41, total: 45 },
    MSCU: { right: 38, total: 43 },
    EGLV: { right: 27, total: 30 },
    ONEY: { right: 22, total: 25 },
    HLCU: { right: 19, total: 21 },
    CMDU: { right: 30, total: 34 },
  },
  invalidated: { shipping_line: 3, ais: 1, terminal: 0 },
}

const clampTrack = (x: number) => Math.min(1, Math.max(0.8, x))
export function trackFactor(rel: Reliability, key: SourceKey, scac?: string): { f: number; note: string } {
  if (key === 'carrier_declaration' && scac && rel.carriers[scac]) {
    const r = rel.carriers[scac]
    const pct = r.right / r.total
    return { f: clampTrack(pct), note: `${scac} declarations right in ${Math.round(pct * 100)}% of ${r.total} past conflicts` }
  }
  const r = rel.sources[key]
  const pct = r.right / r.total
  return { f: clampTrack(pct), note: `${SOURCE_LABEL[key]} right in ${Math.round(pct * 1000) / 10}% of ${r.total} past conflicts` }
}

export function freshness(ageHours: number | null, isStatic: boolean): { f: number; note: string } {
  if (isStatic) return { f: 1, note: 'static: a sealed box’s weight doesn’t go stale' }
  if (ageHours === null) return { f: 0.5, note: 'age unknown' }
  const age = ageHours < 1 ? `${Math.max(1, Math.round(ageHours * 60))} min old` : `${Math.round(ageHours)}h old`
  if (ageHours < 1) return { f: 1, note: `${age} (< 1h)` }
  if (ageHours < 6) return { f: 0.9, note: `${age} (< 6h)` }
  if (ageHours < 24) return { f: 0.75, note: `${age} (< 24h)` }
  return { f: 0.5, note: `${age} (older than 24h)` }
}

export function confidence(
  rel: Reliability,
  key: SourceKey,
  at: string | null,
  now: number,
  opts: { isStatic?: boolean; scac?: string } = {},
): Confidence {
  const fr = freshness(at ? (now - ms(at)) / HOUR : null, !!opts.isStatic)
  const tr = trackFactor(rel, key, opts.scac)
  const authority = AUTHORITY[key]
  return { authority, freshness: fr.f, track: tr.f, freshnessNote: fr.note, trackNote: tr.note, value: authority * fr.f * tr.f }
}

export const pct = (c: Confidence | null) => (c ? Math.round(c.value * 100) : 0)

// ---------------------------------------------------------------- reference data

/** Typical empty (tare) weight, kg. */
export function tareKg(b: Box): number {
  if (b.equipment_type === 'reefer') return b.equipment_length_ft === 20 ? 3000 : 4800
  if (b.equipment_type === 'tank') return 3700
  return b.equipment_length_ft === 20 ? 2300 : b.equipment_height === 'high_cube' ? 3900 : 3750
}
export const maxGrossKg = (b: Box) => (b.equipment_length_ft === 20 ? 30480 : 32500)

/** Rough upper bound of cargo weight for a full box of a light commodity (kg). */
const LIGHT_COMMODITIES: [RegExp, number][] = [
  [/paper napkin|tissue|paper towel/i, 9000],
  [/plush|stuffed toy/i, 6500],
  [/foam|mattress/i, 7000],
  [/apparel|t-shirt|garment/i, 12000],
]
export function commodityCeiling(text: string | null): { max: number; label: string } | null {
  if (!text) return null
  for (const [re, max] of LIGHT_COMMODITIES) if (re.test(text)) return { max, label: text }
  return null
}

// ---------------------------------------------------------------- per-attribute trust

const diffPct = (a: number, b: number) => ((a - b) / b) * 100
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}%`

export function measuredWeight(b: Box): { kg: number; key: 'crane_scale' | 'gate_scale'; at: string | null } | null {
  const s = b.sensors
  if (s.crane_weight_kg != null) return { kg: s.crane_weight_kg, key: 'crane_scale', at: s.crane_weight_at }
  if (s.gate_scale_weight_kg != null) return { kg: s.gate_scale_weight_kg, key: 'gate_scale', at: s.gate_scale_at }
  return null
}

export function trustWeight(b: Box, rel: Reliability, now: number): TrustedAttr {
  const d = b.declarations
  const m = measuredWeight(b)
  const declaredKg = b.equipment_weight_lbs != null ? lbsToKg(b.equipment_weight_lbs) : null
  const cells: TrustedAttr['cells'] = {}

  cells.carrier = [{
    value: d.carrier_declared_status === 'empty' ? 'Declared empty' : 'Declared full',
    sub: d.commodity_text ?? 'no commodity text',
    at: d.declared_at,
    tone: d.carrier_declared_status === 'empty' && m && m.kg > 10000 ? 'rejected' : 'muted',
  }]
  if (d.vgm_weight_kg != null) {
    const dv = m ? diffPct(m.kg, d.vgm_weight_kg) : null
    cells.vgm = [{
      value: kg(d.vgm_weight_kg),
      sub: dv === null ? 'submitted at origin' : Math.abs(dv) <= 5 ? `agrees with scale (${signed(-dv)})` : `scale differs ${signed(dv)}`,
      at: d.vgm_submitted_at,
      tone: dv === null ? undefined : Math.abs(dv) <= 5 ? 'agree' : 'conflict',
    }]
  } else cells.vgm = [{ value: 'No VGM', tone: 'muted' }]
  cells.t49 = [{
    value: b.equipment_weight_lbs != null ? `equipment_weight_lbs ${b.equipment_weight_lbs.toLocaleString('en-US')}` : 'equipment_weight_lbs null',
    sub: declaredKg != null ? `≈ ${kg(declaredKg)} · carrier-declared` : 'Terminal49 has no weight yet',
    tag: b.equipment_weight_lbs != null ? 'shipping_line' : undefined,
    tone: declaredKg != null && m && Math.abs(diffPct(m.kg, declaredKg)) > 5 ? 'rejected' : 'muted',
  }]
  cells.terminal = m
    ? [{ value: kg(m.kg), sub: m.key === 'crane_scale' ? 'crane weight at discharge' : 'gate scale', at: m.at, tone: 'trusted' }]
    : [{ value: 'Not weighed yet', sub: b.pod_discharged_at ? 'weighs at the gate scale' : 'on the ship', tone: 'muted' }]

  let trusted: TrustedAttr['trusted'] = null
  let conflict: Conflict | null = null

  if (m) {
    const c = confidence(rel, m.key, m.at, now, { isStatic: true })
    const parts = [`Trusting ${SOURCE_LABEL[m.key].toLowerCase()} (${kg(m.kg)}): measured ${m.at ? fmtDayTime(m.at) : ''}.`]
    if (d.vgm_weight_kg != null) {
      const dv = diffPct(m.kg, d.vgm_weight_kg)
      parts.push(`VGM said ${kg(d.vgm_weight_kg)} (${Math.abs(dv) <= 5 ? `agrees within ${Math.abs(dv).toFixed(1)}%` : `${signed(dv)} off`}).`)
    }
    if (d.carrier_declared_status === 'empty' && m.kg > 10000) {
      const cd = trackFactor(rel, 'carrier_declaration', b.shipping_line_scac)
      parts.push(`Carrier declared “empty”${declaredKg ? ` / ${b.equipment_weight_lbs?.toLocaleString('en-US')} lbs` : ''}: rejected. ${b.shipping_line_name} declarations were wrong in ${Math.round((1 - cd.f) * 100)}% of past conflicts.`)
    }
    trusted = { value: kg(m.kg), source: SOURCE_LABEL[m.key], confidence: c, reason: parts.join(' ') }

    if (d.carrier_declared_status === 'empty' && m.kg > 10000) {
      const ratio = declaredKg ? m.kg / declaredKg : m.kg / tareKg(b)
      conflict = {
        attr: 'weight',
        severity: 'critical',
        affectsRelease: true,
        summary: `Declared empty, but weighs ${kg(m.kg)} (~${Math.round(ratio)}× declared)`,
        safety: `Handling gear and chassis sized for ${declaredKg ? kg(declaredKg) : 'an empty box'} would be overloaded about ${Math.round(ratio)}×.`,
        security: `Undeclared cargo: ${kg(m.kg - tareKg(b))} above typical tare for a ${b.equipment_length_ft}' ${b.equipment_type}.`,
      }
    } else if (d.vgm_weight_kg != null) {
      const dv = diffPct(m.kg, d.vgm_weight_kg)
      if (Math.abs(dv) > 5) {
        const hazCritical = !!d.hazmat_class && Math.abs(dv) > 10
        conflict = {
          attr: 'weight',
          severity: hazCritical ? 'critical' : 'major',
          affectsRelease: hazCritical,
          summary: `${SOURCE_LABEL[m.key]} ${signed(dv)} vs VGM${d.hazmat_class ? ` on hazmat class ${d.hazmat_class}` : ''}`,
          safety: d.hazmat_class ? `Hazmat box: confirm gross mass before it goes on a chassis.` : undefined,
        }
      }
    }
    if (m.kg > maxGrossKg(b)) {
      conflict = { attr: 'weight', severity: 'critical', affectsRelease: true, summary: `${kg(m.kg)} exceeds max gross for a ${b.equipment_length_ft}' box`, safety: 'Overweight for road and handling equipment.' }
    }
  } else if (d.vgm_weight_kg != null) {
    const c = confidence(rel, 'vgm', d.vgm_submitted_at, now, { isStatic: true })
    trusted = { value: kg(d.vgm_weight_kg), source: 'VGM', confidence: c, reason: 'No physical measurement yet: using the verified gross mass submitted at origin.' }
  }

  return { key: 'weight', label: 'Weight', cells, trusted, conflict }
}

export function trustContents(b: Box, rel: Reliability, now: number): TrustedAttr {
  const d = b.declarations
  const s = b.sensors
  const m = measuredWeight(b)
  const tare = tareKg(b)
  const reeferRunning = b.equipment_type === 'reefer' && s.reefer_power_on && d.reefer_setpoint_c !== null
  const cells: TrustedAttr['cells'] = {}
  const loadedBy = (w: number) => w > tare + 2000

  cells.carrier = [{ value: d.carrier_declared_status === 'empty' ? 'Empty' : 'Full', sub: d.commodity_text ?? 'no commodity text', at: d.declared_at }]
  cells.vgm = d.vgm_weight_kg != null
    ? [{ value: loadedBy(d.vgm_weight_kg) ? 'Implies loaded' : 'Implies empty', sub: kg(d.vgm_weight_kg), at: d.vgm_submitted_at }]
    : [{ value: '—', tone: 'muted' }]
  cells.t49 = [{ value: 'No contents field', sub: 'Terminal49 carries no commodity or cargo description', tone: 'muted' }]
  cells.terminal = m
    ? [{ value: loadedBy(m.kg) ? 'Loaded' : 'Empty', sub: `${kg(m.kg)} vs ~${kg(tare)} tare`, at: m.at, tone: 'trusted' }]
    : [{ value: '—', tone: 'muted' }]
  if (b.equipment_type === 'reefer') {
    cells.reefer = reeferRunning
      ? [{ value: `Running, set to ${d.reefer_setpoint_c}°C`, sub: 'a running reefer is unlikely to be empty', at: s.reefer_reading_at }]
      : [{ value: 'Not plugged in yet', tone: 'muted' }]
  }

  let trusted: TrustedAttr['trusted'] = null
  let conflict: Conflict | null = null
  const declaredEmpty = d.carrier_declared_status === 'empty'

  if (m) {
    const loaded = loadedBy(m.kg)
    const c = confidence(rel, m.key, m.at, now, { isStatic: true })
    const evidence = [`${SOURCE_LABEL[m.key].toLowerCase()} ${kg(m.kg)}`]
    if (reeferRunning) evidence.push(`reefer running, set to ${d.reefer_setpoint_c}°C`)
    if (d.vgm_weight_kg != null && loadedBy(d.vgm_weight_kg) === loaded) evidence.push(`VGM ${kg(d.vgm_weight_kg)}`)
    trusted = {
      value: loaded ? (declaredEmpty ? 'Loaded (not empty)' : `Full: ${d.commodity_text ?? 'commodity not stated'}`) : 'Empty',
      source: `${SOURCE_LABEL[m.key]}${reeferRunning ? ' + reefer state' : ''}`,
      confidence: c,
      reason: `Physical evidence (${evidence.join(', ')}) beats the declaration.`,
    }
    if (declaredEmpty && loaded) {
      conflict = {
        attr: 'contents',
        severity: 'critical',
        affectsRelease: true,
        summary: `Declared empty, but ${reeferRunning ? 'running a freezer and ' : ''}weighs ${kg(m.kg)}`,
        security: `${reeferRunning ? 'A reefer running (set to ' + d.reefer_setpoint_c + '°C) while declared empty, and ' : ''}${kg(m.kg)} measured: cargo is present but undeclared${d.commodity_text ? '' : ' (no commodity text on file)'}.`,
      }
    } else if (!declaredEmpty && !loaded) {
      conflict = { attr: 'contents', severity: 'major', affectsRelease: false, summary: 'Declared full, but weighs as empty', security: 'Declared cargo may be missing.' }
    }
    const ceiling = commodityCeiling(d.commodity_text)
    if (!conflict && ceiling && m.kg - tare > ceiling.max * 1.8) {
      conflict = {
        attr: 'contents',
        severity: 'major',
        affectsRelease: false,
        summary: `${kg(m.kg - tare)} of cargo is implausible for “${ceiling.label}”`,
        security: `A full 40' of ${ceiling.label.toLowerCase()} rarely tops ${kg(ceiling.max)}; this box carries ${((m.kg - tare) / ceiling.max).toFixed(1)}× that.`,
      }
    }
  } else if (declaredEmpty && d.vgm_weight_kg != null && loadedBy(d.vgm_weight_kg)) {
    const c = confidence(rel, 'vgm', d.vgm_submitted_at, now, { isStatic: true })
    trusted = { value: 'Probably loaded', source: 'VGM', confidence: c, reason: 'Paperwork only: VGM implies cargo despite the “empty” declaration.' }
  } else {
    const c = confidence(rel, 'carrier_declaration', d.declared_at, now, { isStatic: true, scac: b.shipping_line_scac })
    trusted = { value: declaredEmpty ? 'Empty' : `Full: ${d.commodity_text ?? '—'}`, source: 'Carrier declaration', confidence: c, reason: 'Only the declaration exists so far.' }
  }

  return { key: 'contents', label: 'Contents', cells, trusted, conflict }
}

export function trustRelease(b: Box, rel: Reliability, now: number, customsDown: boolean): TrustedAttr {
  const holds = b.holds_at_pod_terminal
  const active = holds.filter((h) => h.status === 'hold')
  const pending = holds.filter((h) => h.status === 'pending')
  const customsHolds = holds.filter((h) => h.name === 'customs' || h.name === 'USDA' || h.name === 'VACIS')
  const lineHold = holds.find((h) => h.name === 'freight' || h.name === 'line')
  const cells: TrustedAttr['cells'] = {}

  cells.carrier = [lineHold
    ? { value: lineHold.name === 'freight' ? 'Freight unpaid' : 'Line release pending', sub: lineHold.description, tone: 'conflict' }
    : { value: 'Line released', sub: 'freight paid' }]
  cells.t49 = [
    { value: `available_for_pickup: ${b.available_for_pickup}`, sub: b.availability_known ? `checked ${b.terminal_checked_at ? fmtDayTime(b.terminal_checked_at) : '—'}` : 'availability never checked', tag: 'terminal', tone: b.available_for_pickup && active.length ? 'rejected' : undefined },
    ...holds.map<Cell>((h) => ({ value: `${h.name} · ${h.status}`, sub: h.description, tone: h.status === 'hold' ? 'conflict' : undefined })),
  ]
  cells.terminal = [{ value: `TOS: ${b.status}`, sub: b.sensors.yard_position ? `yard ${b.sensors.yard_position}` : undefined, at: b.sensors.tos_updated_at }]
  cells.customs = customsHolds.length
    ? customsHolds.map<Cell>((h) => ({ value: `${h.name === 'customs' ? 'CBP' : h.name}: ${h.status.toUpperCase()}`, sub: h.description, at: h.placed_at ?? null, tone: h.status === 'hold' ? 'trusted' : undefined }))
    : [{ value: customsDown ? 'CBP feed down' : 'No customs hold', sub: customsDown ? 'last known: clear' : undefined, tone: customsDown ? 'conflict' : undefined }]

  let trusted: TrustedAttr['trusted']
  let conflict: Conflict | null = null
  if (active.length) {
    const top = active.find((h) => h.name === 'customs' || h.name === 'USDA' || h.name === 'VACIS') ?? active[0]
    const key: SourceKey = top.name === 'customs' || top.name === 'USDA' || top.name === 'VACIS' ? 'customs' : 'terminal_availability'
    const c = confidence(rel, key, b.terminal_checked_at, now)
    trusted = {
      value: `Blocked: ${active.map((h) => h.name).join(' + ')} hold`,
      source: key === 'customs' ? `Customs (${top.name === 'customs' ? 'CBP' : top.name})` : 'Hold list',
      confidence: c,
      reason: `A hold with status “hold” always blocks release${b.available_for_pickup ? ', even though available_for_pickup is true' : ''}.`,
    }
    if (b.available_for_pickup) {
      conflict = {
        attr: 'release',
        severity: 'major',
        affectsRelease: true,
        summary: 'available_for_pickup: true while a hold is active',
        security: undefined,
      }
    }
  } else if (pending.length) {
    const c = confidence(rel, 'customs', b.terminal_checked_at, now)
    trusted = { value: `Not yet: ${pending.map((h) => h.name).join(' + ')} pending`, source: 'Hold list', confidence: c, reason: 'A pending hold may still turn into a hold; re-check before release.' }
  } else if (b.available_for_pickup) {
    const c = confidence(rel, 'terminal_availability', b.terminal_checked_at, now)
    trusted = { value: customsDown ? 'Releasable (last known)' : 'Releasable', source: 'Terminal availability', confidence: c, reason: customsDown ? 'Customs feed is down; the box was cleared before the outage, so the last known state stands.' : 'Available, no active holds, freight paid.' }
  } else {
    const c = confidence(rel, 'terminal_availability', b.terminal_checked_at, now)
    trusted = { value: 'Not yet available', source: 'Terminal availability', confidence: c, reason: 'Terminal says not available, but no hold explains it: likely a data lag.' }
    if (b.pod_discharged_at) {
      conflict = { attr: 'release', severity: 'minor', affectsRelease: true, summary: 'Not available, but no hold is listed (likely data lag)' }
    }
  }
  return { key: 'release', label: 'Release status', cells, trusted, conflict }
}

export function trustTemperature(b: Box, rel: Reliability, now: number, extraTrend = 0): TrustedAttr {
  const d = b.declarations
  const s = b.sensors
  const cells: TrustedAttr['cells'] = {}
  if (b.equipment_type !== 'reefer') {
    if (d.commodity_text && /frozen|chilled/i.test(d.commodity_text)) {
      return {
        key: 'temperature', label: 'Temperature', cells: { carrier: [{ value: d.commodity_text, tone: 'conflict' }] },
        trusted: null,
        conflict: { attr: 'temperature', severity: 'major', affectsRelease: false, summary: `Dry box declared as “${d.commodity_text}”` },
      }
    }
    return { key: 'temperature', label: 'Temperature', cells: { reefer: [{ value: 'n/a: dry box', tone: 'muted' }] }, trusted: null, conflict: null }
  }
  cells.carrier = [{ value: d.reefer_setpoint_c != null ? `Setpoint ${d.reefer_setpoint_c}°C` : 'No setpoint', sub: 'from the booking', at: d.declared_at }]
  if (s.reefer_current_c == null || d.reefer_setpoint_c == null) {
    cells.reefer = [{ value: 'No live reading', sub: 'reports once plugged in at the yard', tone: 'muted' }]
    return { key: 'temperature', label: 'Temperature', cells, trusted: null, conflict: null }
  }
  const trend = (s.reefer_trend_c_per_hr ?? 0) + extraTrend
  const dev = s.reefer_current_c - d.reefer_setpoint_c
  cells.reefer = [{
    value: `${s.reefer_current_c.toFixed(1)}°C`,
    sub: `${dev >= 0 ? '+' : ''}${dev.toFixed(1)}° vs setpoint · ${trend >= 0 ? '+' : ''}${trend.toFixed(1)}°C/hr${s.reefer_alarm ? ` · ${s.reefer_alarm}` : ''}${extraTrend ? ' · power lost (drill)' : ''}`,
    at: s.reefer_reading_at,
    tone: dev > 2 ? 'conflict' : 'trusted',
  }]
  const c = confidence(rel, 'reefer_telemetry', s.reefer_reading_at, now)
  const trusted = {
    value: `${s.reefer_current_c.toFixed(1)}°C (${dev >= 0 ? '+' : ''}${dev.toFixed(1)}°, ${trend >= 0 ? 'rising' : 'falling'} ${Math.abs(trend).toFixed(1)}°C/hr)`,
    source: 'Reefer telemetry',
    confidence: c,
    reason: `Live telemetry beats the booking setpoint. Using the trend, not just the reading: ${trend > 0.05 ? `+${(trend * 4).toFixed(1)}° in 4h if nothing changes` : 'stable'}.`,
  }
  let conflict: Conflict | null = null
  if (dev > 8 && trend > 0) {
    conflict = { attr: 'temperature', severity: 'critical', affectsRelease: true, summary: `Reefer ${dev.toFixed(1)}°C above setpoint and rising ${trend.toFixed(1)}°C/hr`, safety: 'Cargo spoiling now; some cargo turns hazardous when it warms.' }
  } else if (dev > 2) {
    conflict = { attr: 'temperature', severity: 'major', affectsRelease: false, summary: `Reefer ${dev.toFixed(1)}°C above setpoint${trend > 0 ? `, rising ${trend.toFixed(1)}°C/hr` : ''}` }
  }
  return { key: 'temperature', label: 'Temperature', cells, trusted, conflict }
}

export function deadlineCandidates(b: Box) {
  const c: { ymd: string; source: 'line' | 'facility' | 'rail' }[] = []
  if (b.import_deadlines_pod_line_current) c.push({ ymd: b.import_deadlines_pod_line_current, source: 'line' })
  if (b.import_deadlines_pod_facility_current) c.push({ ymd: b.import_deadlines_pod_facility_current, source: 'facility' })
  if (b.pickup_lfd_rail) c.push({ ymd: b.pickup_lfd_rail, source: 'rail' })
  return c
}

export function trustDeadline(b: Box, rel: Reliability, now: number): TrustedAttr {
  const cand = deadlineCandidates(b)
  const cells: TrustedAttr['cells'] = {}
  cells.carrier = b.import_deadlines_pod_line_current
    ? [{ value: `Line: ${fmtYmd(b.import_deadlines_pod_line_current)}`, sub: 'import_deadlines_pod_line_current' }]
    : [{ value: 'No line deadline', tone: 'muted' }]
  cells.t49 = [
    b.import_deadlines_pod_facility_current
      ? { value: `Facility: ${fmtYmd(b.import_deadlines_pod_facility_current)}`, sub: 'import_deadlines_pod_facility_current' }
      : { value: 'Facility: null', tone: 'muted' },
    ...(b.pickup_lfd_rail ? [{ value: `Rail: ${fmtYmd(b.pickup_lfd_rail)}`, sub: 'pickup_lfd_rail' } as Cell] : []),
    b.import_deadlines_pod_unified_current_value
      ? { value: `Unified: ${fmtYmd(b.import_deadlines_pod_unified_current_value)} (${b.import_deadlines_pod_unified_current_selection})`, sub: 'Terminal49 unified pick', tone: 'muted' }
      : { value: 'Unified: null', tone: 'muted' },
  ]
  if (!cand.length) {
    return { key: 'deadline', label: 'Deadline (LFD)', cells, trusted: null, conflict: null }
  }
  const earliest = [...cand].sort((a, b2) => a.ymd.localeCompare(b2.ymd))[0]
  const key: SourceKey = earliest.source === 'line' ? 'line_deadline' : 'facility_deadline'
  const c = confidence(rel, key, b.terminal_checked_at, now)
  const unified = b.import_deadlines_pod_unified_current_value
  const parts = [`Earliest of ${cand.map((x) => `${x.source} (${fmtYmd(x.ymd)})`).join(', ')}.`]
  if (unified && unified !== earliest.ymd) {
    parts.push(`Terminal49’s unified pick is ${fmtYmd(unified)} because it follows a fixed line → terminal → rail priority; their docs advise using the earliest yourself, so we do.`)
  } else if (unified) parts.push('Matches Terminal49’s unified deadline.')
  const trusted = { value: `${fmtYmd(earliest.ymd)}, 17:00 (${earliest.source})`, source: SOURCE_LABEL[key], confidence: c, reason: parts.join(' ') }

  let conflict: Conflict | null = null
  const dates = cand.map((x) => deadlineAt(x.ymd))
  const spreadDays = (Math.max(...dates) - Math.min(...dates)) / (24 * HOUR)
  if (spreadDays > 1.01) conflict = { attr: 'deadline', severity: 'major', affectsRelease: false, summary: `Line and facility deadlines ${Math.round(spreadDays)} days apart` }
  else if (spreadDays > 0) conflict = { attr: 'deadline', severity: 'minor', affectsRelease: false, summary: `Line ${fmtYmd(b.import_deadlines_pod_line_current!)} vs facility ${fmtYmd(b.import_deadlines_pod_facility_current!)}: using the earlier` }
  return { key: 'deadline', label: 'Deadline (LFD)', cells, trusted, conflict }
}

const EVENT_LABEL: Record<string, string> = {
  'container.transport.vessel_loaded': 'Loaded on vessel',
  'container.transport.vessel_departed': 'Vessel departed',
  'container.transport.vessel_arrived': 'Vessel arrived',
  'container.transport.estimated.vessel_arrived': 'ETA',
  'container.transport.vessel_discharged': 'Discharged',
}
export const eventLabel = (e: string) => EVENT_LABEL[e] ?? e.replace('container.transport.', '')

export function trustLocation(b: Box, rel: Reliability, now: number): TrustedAttr {
  const s = b.sensors
  const cells: TrustedAttr['cells'] = {}
  const evs = [...b.events].sort((a, c) => ms(a.timestamp) - ms(c.timestamp))
  cells.carrier = evs.filter((e) => e.data_source === 'shipping_line').map<Cell>((e) => ({ value: eventLabel(e.event), at: e.timestamp, tag: 'shipping_line', strike: !!e.invalidated_at, sub: e.invalidated_at ? `invalidated ${fmtDayTime(e.invalidated_at)}` : e.location_name }))
  cells.t49 = evs.filter((e) => e.data_source !== 'shipping_line').map<Cell>((e) => ({ value: eventLabel(e.event), at: e.timestamp, tag: e.data_source, strike: !!e.invalidated_at, sub: e.location_name }))
  cells.terminal = s.yard_position
    ? [{ value: `Yard ${s.yard_position}`, sub: `${s.dig_moves} dig move${s.dig_moves === 1 ? '' : 's'}`, at: s.tos_updated_at, tone: 'trusted' }]
    : [{ value: 'Not in yard', tone: 'muted' }]

  let trusted: TrustedAttr['trusted'] = null
  if (s.yard_position) {
    const c = confidence(rel, 'tos', s.tos_updated_at, now)
    trusted = { value: `In yard ${s.yard_position}`, source: 'Terminal TOS', confidence: c, reason: 'The terminal’s own system is the authority on where the box sits. Invalidated events are ignored.' }
  } else {
    const last = [...evs].reverse().find((e) => !e.invalidated_at)
    if (last) {
      const key: SourceKey = last.data_source === 'terminal' ? 'terminal_event' : last.data_source === 'ais' ? 'ais' : 'shipping_line_event'
      trusted = { value: eventLabel(last.event), source: SOURCE_LABEL[key], confidence: confidence(rel, key, last.timestamp, now), reason: 'Latest valid milestone.' }
    }
  }

  let conflict: Conflict | null = null
  const retracted = evs.find((e) => e.invalidated_at && e.data_source === 'shipping_line')
  if (retracted) {
    const replacement = evs.find((e) => e.event === retracted.event && e.data_source === 'terminal' && !e.invalidated_at)
    conflict = {
      attr: 'location',
      severity: 'minor',
      affectsRelease: false,
      summary: `${b.shipping_line_name} “${eventLabel(retracted.event).toLowerCase()}” retracted${replacement ? `; terminal says ${fmtDayTime(replacement.timestamp)}` : ''}`,
    }
  }
  return { key: 'location', label: 'Location / milestones', cells, trusted, conflict }
}

export function trustSeal(b: Box): TrustedAttr | null {
  const declared = b.declarations.seal_number_declared
  const seen = b.sensors.seal_number_observed
  if (!declared || !seen) return null
  const match = declared === seen
  return {
    key: 'seal',
    label: 'Seal',
    cells: {
      carrier: [{ value: declared, sub: 'manifest seal' }],
      terminal: [{ value: seen, sub: 'gate camera at discharge', at: b.pod_discharged_at, tone: match ? 'agree' : 'conflict' }],
    },
    trusted: { value: match ? `${seen} (matches)` : `${seen} (camera)`, source: 'Gate camera', confidence: null, reason: match ? 'Manifest and camera agree.' : 'Camera read differs from the manifest. A carrier re-seal record would explain it.' },
    conflict: match
      ? null
      : { attr: 'seal', severity: 'major', affectsRelease: false, summary: `Seal ${seen} doesn’t match manifest ${declared}`, security: 'Seal changed between origin and discharge with no re-seal record on file.' },
  }
}
