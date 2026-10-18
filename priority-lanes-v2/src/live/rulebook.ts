// PortAble kit: the Rulebook. Makes the engine's own priority rules editable, white-label style.
//
// What a customer can change: how many urgency points each cargo class earns, and the rates the engine
// uses for charges, trucks, gate throughput and spoilage. The engine itself doesn't change: rulebook.ts
// writes into the same RATES and CATEGORY_POINTS objects urgency.ts and simulate.ts already read.
//
// What no rulebook can change (locked): customs and other source holds block release, a person approves
// every action, spoilage risk is always scored, and every change is logged.

import { useSyncExternalStore } from 'react'
import { RATES } from '../engine/rates.ts'
import { CATEGORY_POINTS, CATEGORY_LABEL } from '../engine/urgency.ts'
import type { Category } from '../engine/types.ts'

export type RateKey = 'demurrageEarly' | 'demurrageLate' | 'storage' | 'truckHour' | 'normalTurnHours' | 'abandonAfterHours'
  | 'laneThroughput' | 'spoilageDevC' | 'reschedule' | 'inspectionMove' | 'reeferTech' | 'wastedTrip'

export interface RuleChange { at: number; who: string; label: string; from: string; to: string }
export interface Rulebook {
  id: string
  name: string
  note: string
  illustrative: boolean
  dataSource: string
  categoryPoints: Record<Category, number>
  rates: Record<RateKey, number>
}

export const LOCKED_RULES = [
  'A box under a customs, USDA, VACIS or line hold can never be released. Only the agency lifts a hold.',
  'Priority Lanes suggests; a person approves, modifies or rejects every action.',
  'Condition risk (a warming reefer) is always scored, whatever the weights say.',
  'Every rule change is logged with who made it and when.',
]

export interface FieldDef { key: string; group: string; label: string; unit: string; min: number; max: number; step: number; help?: string }
const CATS: Category[] = ['medical', 'relief_supplies', 'perishable_food', 'critical_industrial', 'general']
export const FIELDS: FieldDef[] = [
  ...CATS.map((c) => ({ key: `cat.${c}`, group: 'Cargo class (urgency points, of 30)', label: CATEGORY_LABEL[c], unit: 'pts', min: 0, max: 30, step: 1 })),
  { key: 'rate.demurrageEarly', group: 'Charges', label: 'Demurrage, days 1–4 past deadline', unit: '$/day', min: 0, max: 2000, step: 5 },
  { key: 'rate.demurrageLate', group: 'Charges', label: 'Demurrage, after day 4', unit: '$/day', min: 0, max: 4000, step: 5 },
  { key: 'rate.storage', group: 'Charges', label: 'Storage, extended dwell', unit: '$/day', min: 0, max: 1000, step: 5 },
  { key: 'rate.truckHour', group: 'Gate and trucks', label: 'Truck waiting charge', unit: '$/h', min: 0, max: 500, step: 5, help: 'Counted for waiting beyond a normal turn.' },
  { key: 'rate.normalTurnHours', group: 'Gate and trucks', label: 'Normal gate turn', unit: 'h', min: 0.25, max: 6, step: 0.25 },
  { key: 'rate.abandonAfterHours', group: 'Gate and trucks', label: 'Drivers leave after', unit: 'h', min: 1, max: 12, step: 0.5 },
  { key: 'rate.laneThroughput', group: 'Gate and trucks', label: 'Gate lane throughput', unit: 'trucks/h', min: 4, max: 40, step: 1 },
  { key: 'rate.wastedTrip', group: 'Gate and trucks', label: 'Wasted truck trip', unit: '$', min: 0, max: 1000, step: 5 },
  { key: 'rate.reschedule', group: 'Gate and trucks', label: 'Rebook an appointment', unit: '$', min: 0, max: 1000, step: 5 },
  { key: 'rate.spoilageDevC', group: 'Perishables and inspection', label: 'Reefer counts as at risk at', unit: '°C over', min: 1, max: 15, step: 0.5, help: 'Lower = protect perishables sooner.' },
  { key: 'rate.reeferTech', group: 'Perishables and inspection', label: 'Reefer technician call-out', unit: '$', min: 0, max: 2000, step: 10 },
  { key: 'rate.inspectionMove', group: 'Perishables and inspection', label: 'Yard move to inspection', unit: '$', min: 0, max: 2000, step: 5 },
]

const pick = <K extends string>(o: Record<string, number>, keys: K[]) => Object.fromEntries(keys.map((k) => [k, o[k]])) as Record<K, number>
const RATE_KEYS: RateKey[] = ['demurrageEarly', 'demurrageLate', 'storage', 'truckHour', 'normalTurnHours', 'abandonAfterHours', 'laneThroughput', 'spoilageDevC', 'reschedule', 'inspectionMove', 'reeferTech', 'wastedTrip']

// The engine's numbers as shipped become the default rulebook, so nothing changes until someone edits.
const DEFAULT_CATS = { ...CATEGORY_POINTS }
const DEFAULT_RATES = pick(RATES as unknown as Record<string, number>, RATE_KEYS)

export const PRESETS: Record<string, Rulebook> = {
  default: { id: 'default', name: 'APMT Los Angeles (default)', illustrative: false, dataSource: 'Terminal49',
    note: 'Priority Lanes as shipped: its cargo-class points and sample rates. Every other preset starts from here.',
    categoryPoints: { ...DEFAULT_CATS }, rates: { ...DEFAULT_RATES } },
  lifeline: { id: 'lifeline', name: 'Lifeline first (crisis)', illustrative: false, dataSource: 'Terminal49',
    note: 'A crisis policy agreed in advance with emergency managers: relief supplies and perishable food rank with medical, general cargo can slow, and reefers count as at risk sooner. Point values are a policy choice.',
    categoryPoints: { medical: 30, relief_supplies: 30, perishable_food: 27, critical_industrial: 10, general: 0 },
    rates: { ...DEFAULT_RATES, spoilageDevC: 4 } },
  commercial: { id: 'commercial', name: 'Commercial terminal', illustrative: true, dataSource: 'Terminal49',
    note: 'Illustrative. A terminal whose contracts weigh charges more than cargo class: class points flatten and charges rise, so cost and deadlines drive the order.',
    categoryPoints: { medical: 18, relief_supplies: 14, perishable_food: 18, critical_industrial: 16, general: 10 },
    rates: { ...DEFAULT_RATES, demurrageEarly: 250, demurrageLate: 450, truckHour: 120 } },
  tianjin: { id: 'tianjin', name: 'Tianjin (illustrative)', illustrative: true, dataSource: 'Port community system (adapter needed)',
    note: 'Illustrative placeholders, not sourced: the same engine under a different tariff and gate. Replace with the terminal’s own numbers.',
    categoryPoints: { ...DEFAULT_CATS }, rates: { ...DEFAULT_RATES, demurrageEarly: 90, demurrageLate: 180, storage: 40, truckHour: 40, laneThroughput: 18 } },
  rotterdam: { id: 'rotterdam', name: 'Rotterdam (illustrative)', illustrative: true, dataSource: 'Port community system (adapter needed)',
    note: 'Illustrative placeholders, not sourced. Replace with the terminal’s own tariff.',
    categoryPoints: { ...DEFAULT_CATS }, rates: { ...DEFAULT_RATES, demurrageEarly: 140, demurrageLate: 280, storage: 60, truckHour: 80, laneThroughput: 14 } },
}

// ---------------------------------------------------------------- store

let current: Rulebook = clone(PRESETS.default)
let changelog: RuleChange[] = []
let version = 0
const listeners = new Set<() => void>()

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) }
function push(rb: Rulebook) {
  Object.assign(CATEGORY_POINTS, rb.categoryPoints)
  Object.assign(RATES, rb.rates)
  version++
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** React hook: re-renders when the rulebook changes. Add the version to any memo that runs the engine. */
export const useRulebookVersion = () => useSyncExternalStore(subscribe, () => version)
export const getRulebook = () => current
export const getChangelog = () => changelog

export function valueOf(rb: Rulebook, key: string): number {
  const [kind, k] = key.split('.')
  return kind === 'cat' ? rb.categoryPoints[k as Category] : rb.rates[k as RateKey]
}

/** Change one field. Returns an error message instead of applying an invalid value. */
export function setField(key: string, raw: number | string, who: string): string | null {
  const f = FIELDS.find((x) => x.key === key)
  if (!f) return `Unknown setting: ${key}`
  const v = Number(raw)
  if (!Number.isFinite(v) || v < f.min || v > f.max) return `${f.label} must be between ${f.min} and ${f.max} ${f.unit}.`
  const from = valueOf(current, key)
  if (from === v) return null
  const next = clone(current)
  const [kind, k] = key.split('.')
  if (kind === 'cat') next.categoryPoints[k as Category] = v
  else next.rates[k as RateKey] = v
  next.name = current.name.endsWith(' · edited') ? current.name : `${current.name} · edited`
  changelog = [...changelog, { at: Date.now(), who, label: f.label, from: `${from} ${f.unit}`, to: `${v} ${f.unit}` }]
  current = next
  push(current)
  return null
}

export function selectPreset(id: string, who: string) {
  const p = PRESETS[id]
  if (!p) return
  changelog = [...changelog, { at: Date.now(), who, label: 'Preset', from: current.name, to: p.name }]
  current = clone(p)
  push(current)
}

/** Load a rulebook a customer pasted as JSON. Unknown keys are ignored; out-of-range values are refused. */
export function loadRulebook(json: string, who: string): { ok: boolean; message: string } {
  let raw: Partial<Rulebook> & { locked?: unknown }
  try { raw = JSON.parse(json) } catch { return { ok: false, message: 'That isn’t valid JSON.' } }
  const next: Rulebook = { ...clone(PRESETS.default), id: raw.id || 'custom', name: raw.name || 'Custom rulebook', note: raw.note || 'Loaded from JSON.', illustrative: !!raw.illustrative, dataSource: raw.dataSource || 'Terminal49' }
  const errors: string[] = []
  for (const f of FIELDS) {
    const [kind, k] = f.key.split('.')
    const v = kind === 'cat' ? raw.categoryPoints?.[k as Category] : raw.rates?.[k as RateKey]
    if (v === undefined) continue
    if (typeof v !== 'number' || v < f.min || v > f.max) { errors.push(`${f.label} must be between ${f.min} and ${f.max} ${f.unit}.`); continue }
    if (kind === 'cat') next.categoryPoints[k as Category] = v
    else next.rates[k as RateKey] = v
  }
  if (errors.length) return { ok: false, message: errors.join(' ') }
  changelog = [...changelog, { at: Date.now(), who, label: 'Loaded rulebook', from: current.name, to: next.name }]
  current = next
  push(current)
  const lockedNote = raw.locked !== undefined ? ' Locked rules in the file were ignored: they can’t be changed.' : ''
  return { ok: true, message: 'Loaded.' + lockedNote }
}

export function exportRulebook(): string {
  return JSON.stringify({ ...current, locked: LOCKED_RULES }, null, 2)
}

/** Run `fn` as if `rb` were active, then put the current rulebook back. Used to compare rankings. */
export function withRulebook<T>(rb: Rulebook, fn: () => T): T {
  const saved = { cats: { ...CATEGORY_POINTS }, rates: pick(RATES as unknown as Record<string, number>, RATE_KEYS) }
  Object.assign(CATEGORY_POINTS, rb.categoryPoints)
  Object.assign(RATES, rb.rates)
  try { return fn() } finally {
    Object.assign(CATEGORY_POINTS, saved.cats)
    Object.assign(RATES, saved.rates)
  }
}
