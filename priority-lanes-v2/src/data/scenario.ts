// Scenario data. The 4 real containers come from the live Terminal49 snapshot (2026-10-17);
// their post-arrival state, and every other box, is SIMULATED in the same field format.

import type { Box, Category, CargoKind, Declarations, EquipmentType, Fee, Gate, HistoryItem, Hold, Importer, Sensors, T49Event } from '../engine/types.ts'
import { HOUR, MIN, deadlineAt, la } from '../engine/time.ts'
import { NOW } from '../engine/context.ts'
import snapshot from './terminal49-snapshot.json' with { type: 'json' }

export const SNAPSHOT = snapshot

// ---------------------------------------------------------------- helpers

const CHAR_VAL: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  let v = 10
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (v % 11 === 0) v++
    m[ch] = v++
  }
  return m
})()
/** ISO 6346 check digit, so simulated container numbers are well-formed. */
export function checkDigit(s10: string) {
  let sum = 0
  for (let i = 0; i < 10; i++) sum += (/[A-Z]/.test(s10[i]) ? CHAR_VAL[s10[i]] : +s10[i]) * 2 ** i
  return (sum % 11) % 10
}
const cn = (prefix: string, serial: string) => `${prefix}${serial}${checkDigit(prefix + serial)}`

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z')
const today = (hhmm: string) => iso(la('2026-10-29', hhmm))
const fri = (hhmm: string) => iso(la('2026-10-30', hhmm))
export function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const laDate = (t: number) => new Date(t - 7 * HOUR).toISOString().slice(0, 10)

const VESSELS = {
  EVER_LAUREL: { name: 'EVER LAUREL', voyage: '1241E', arrived: '2026-10-28T13:00:00Z', port: 'Tianjinxingang', code: 'CNTXG', loaded: '2026-10-01T19:42:00Z', departed: '2026-10-01T21:31:12Z', freeDays: 5 },
  CORAL: { name: 'CORAL MERIDIAN', voyage: '0218E', arrived: '2026-10-26T20:00:00Z', port: 'Yantian', code: 'CNYTN', loaded: '2026-10-09T08:10:00Z', departed: '2026-10-09T14:25:00Z', freeDays: 3 },
  ASTRID: { name: 'ASTRID BAY', voyage: '077E', arrived: '2026-10-24T15:00:00Z', port: 'Busan', code: 'KRPUS', loaded: '2026-10-11T03:30:00Z', departed: '2026-10-11T09:05:00Z', freeDays: 5 },
} as const
type VesselKey = keyof typeof VESSELS

const CARRIERS: Record<string, string> = { COSU: 'COSCO', EGLV: 'Evergreen', ONEY: 'ONE', MAEU: 'Maersk', MSCU: 'MSC', HLCU: 'Hapag-Lloyd', CMDU: 'CMA CGM' }

function stdEvents(v: VesselKey, discharged: string): T49Event[] {
  const x = VESSELS[v]
  return [
    { event: 'container.transport.vessel_loaded', timestamp: x.loaded, data_source: 'shipping_line', invalidated_at: null, location_name: x.port, location_code: x.code, voyage_number: x.voyage },
    { event: 'container.transport.vessel_departed', timestamp: x.departed, data_source: 'ais', invalidated_at: null, location_name: x.port, location_code: x.code, voyage_number: x.voyage },
    { event: 'container.transport.vessel_arrived', timestamp: x.arrived, data_source: 'ais', invalidated_at: null, location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: x.voyage },
    { event: 'container.transport.vessel_discharged', timestamp: discharged, data_source: 'terminal', invalidated_at: null, location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: x.voyage },
  ]
}

/** Fees as Terminal49 would post them: 0 = not yet posted (not "free"); `total` overlaps line items. */
function feesFor(deadlineYmd: string | null): { fees: Fee[]; total: number } {
  if (!deadlineYmd) return { fees: [], total: 0 }
  const daysPast = Math.max(0, Math.floor((NOW - deadlineAt(deadlineYmd)) / (24 * HOUR)) + (NOW > deadlineAt(deadlineYmd) ? 1 : 0))
  if (!daysPast) return { fees: [{ type: 'demurrage', amount: 0, currency_code: 'USD' }], total: 0 }
  const dem = Math.min(daysPast, 4) * 150 + Math.max(0, daysPast - 4) * 300
  const dwell = daysPast * 75
  const total = dem + dwell
  return {
    fees: [
      { type: 'demurrage', amount: dem, currency_code: 'USD' },
      { type: 'extended_dwell_time', amount: dwell, currency_code: 'USD' },
      { type: 'total', amount: total, currency_code: 'USD' },
    ],
    total,
  }
}

/** Terminal49's own urgency, simulated post-arrival (values beyond "unknown" aren't confirmed). */
function t49Urgency(pickupLfd: string | null) {
  if (!pickupLfd) return 'unknown'
  const h = (deadlineAt(pickupLfd) - NOW) / HOUR
  return h < 0 ? 'overdue' : h < 24 ? 'high' : h < 72 ? 'medium' : 'low'
}

interface Seed {
  id: string
  number: string
  real?: boolean
  cargo: string
  kind: CargoKind
  story?: string
  bl?: string
  scac: string
  vessel: VesselKey
  discharged: string
  type: EquipmentType
  len: 20 | 40
  height?: 'standard' | 'high_cube'
  eqLbs?: number | null
  available?: boolean
  status?: Box['status']
  checkedAt?: string
  holds?: Hold[]
  line: string | null
  facility: string | null
  rail?: string | null
  appt?: string | null
  t49Urgency?: string
  events?: T49Event[]
  decl: Partial<Declarations>
  sensors: Partial<Sensors>
  importer: Partial<Importer>
  gate?: Partial<Gate>
  history?: HistoryItem[]
}

function box(s: Seed): Box {
  const v = VESSELS[s.vessel]
  const holds = s.holds ?? []
  const active = holds.some((h) => h.status === 'hold' || h.status === 'pending')
  const available = s.available ?? !active
  const earliest = [s.line, s.facility, s.rail].filter((x): x is string => !!x).sort()[0] ?? null
  const fees = feesFor(earliest)
  const unifiedSel = s.line ? 'line' : s.facility ? 'facility' : s.rail ? 'rail' : null
  const unified = s.line ?? s.facility ?? s.rail ?? null
  return {
    id: s.id,
    number: s.number,
    real: !!s.real,
    cargo: s.cargo,
    kind: s.kind,
    story: s.story,
    bill_of_lading: s.bl ?? `SIM-${(5500000 + Math.abs(hash(s.id)) % 499999).toString()}`,
    shipping_line_scac: s.scac,
    shipping_line_name: CARRIERS[s.scac] ?? s.scac,
    pod_vessel_name: v.name,
    voyage_number: v.voyage,
    pod_terminal_name: 'APM Terminals',
    status: s.status ?? (available ? 'available' : 'not_available'),
    equipment_type: s.type,
    equipment_length_ft: s.len,
    equipment_height: s.height ?? (s.len === 20 ? 'standard' : 'high_cube'),
    equipment_weight_lbs: s.eqLbs ?? null,
    available_for_pickup: available,
    availability_known: true,
    pod_arrived_at: v.arrived,
    pod_discharged_at: s.discharged,
    terminal_checked_at: s.checkedAt ?? iso(NOW - (8 + (Math.abs(hash(s.id)) % 40)) * MIN),
    holds_at_pod_terminal: holds,
    fees_at_pod_terminal: fees.fees,
    fees_total_amount: fees.total,
    import_deadlines_pod_line_current: s.line,
    import_deadlines_pod_facility_current: s.facility,
    pickup_lfd_rail: s.rail ?? null,
    import_deadlines_pod_unified_current_value: unified,
    import_deadlines_pod_unified_current_selection: unifiedSel,
    pickup_lfd: unified,
    pickup_appointment_at: s.appt ?? null,
    urgency: s.t49Urgency ?? t49Urgency(unified),
    urgency_simulated: true,
    events: s.events ?? stdEvents(s.vessel, s.discharged),
    declarations: {
      carrier_declared_status: 'full',
      commodity_text: null,
      vgm_weight_kg: null,
      vgm_submitted_at: iso(new Date(v.loaded).getTime() - 30 * HOUR),
      reefer_setpoint_c: null,
      hazmat_class: null,
      seal_number_declared: null,
      declared_at: iso(new Date(v.loaded).getTime() - 52 * HOUR),
      ...s.decl,
    },
    sensors: {
      crane_weight_kg: null,
      crane_weight_at: s.discharged,
      gate_scale_weight_kg: null,
      gate_scale_at: null,
      reefer_current_c: null,
      reefer_trend_c_per_hr: null,
      reefer_power_on: s.type === 'reefer' ? true : null,
      reefer_alarm: null,
      reefer_reading_at: s.type === 'reefer' ? iso(NOW - 12 * MIN) : null,
      yard_position: null,
      dig_moves: 0,
      seal_number_observed: null,
      tos_updated_at: iso(NOW - 6 * MIN),
      ...s.sensors,
    },
    importer: { name: null, category: 'general', verified: false, cargo_value_usd: null, ...s.importer },
    gate: { truck_arrived_at: null, walk_up: false, trucker: null, rail_bound: false, rail_cutoff_at: null, rail_destination: null, ...s.gate },
    history: s.history ?? [],
  }
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

// ---------------------------------------------------------------- the 4 real boxes

const REAL = Object.fromEntries(snapshot.containers.map((c) => [c.number, c.id])) as Record<string, string>
const realBase = { real: true, bl: snapshot.shipment.bill_of_lading, scac: 'COSU', vessel: 'EVER_LAUREL' as const, type: 'dry' as const, len: 40 as const }

const realBoxes: Box[] = [
  box({
    ...realBase, id: REAL.OOCU8185051, number: 'OOCU8185051', cargo: 'Pump assemblies', kind: 'industrial',
    story: 'Real box. Releases cleanly; Terminal49’s line and facility deadlines disagree by a day, so we use the earlier one.',
    discharged: '2026-10-28T16:40:00Z', line: '2026-11-02', facility: '2026-11-01', appt: today('14:30'),
    decl: { commodity_text: 'Industrial pump assemblies', vgm_weight_kg: 18200 },
    sensors: { crane_weight_kg: 18450, crane_weight_at: '2026-10-28T16:40:00Z', yard_position: 'B4-07-02-1', dig_moves: 0 },
    importer: { name: 'Hollis Fluid Systems (sim)', category: 'critical_industrial', verified: true },
    gate: { trucker: 'Pacific Link Trucking' },
  }),
  box({
    ...realBase, id: REAL.TRHU5485372, number: 'TRHU5485372', cargo: 'Household goods', kind: 'general',
    story: 'Real box. Freight unpaid: the importer can fix this, so flag it, don’t inspect it.',
    discharged: '2026-10-28T17:05:00Z', line: '2026-11-02', facility: '2026-11-01', appt: today('10:00'),
    holds: [{ name: 'freight', status: 'hold', description: 'FREIGHT CHARGES UNPAID', placed_at: '2026-10-28T17:30:00Z' }],
    decl: { commodity_text: 'Household goods', vgm_weight_kg: 21300 },
    sensors: { crane_weight_kg: 21050, crane_weight_at: '2026-10-28T17:05:00Z', yard_position: 'B4-09-04-3', dig_moves: 2 },
    importer: { name: 'Sunridge Home Imports (sim)', category: 'general' },
    gate: { trucker: 'Basin Freight' },
  }),
  box({
    ...realBase, id: REAL.TGBU4865142, number: 'TGBU4865142', cargo: 'Ceramic tableware', kind: 'general',
    story: 'Real box. General cargo, five days of free time, no appointment: offer tomorrow and keep it out of today’s jam.',
    discharged: '2026-10-28T17:40:00Z', line: '2026-11-03', facility: '2026-11-03',
    decl: { commodity_text: 'Ceramic tableware', vgm_weight_kg: 15400 },
    sensors: { crane_weight_kg: 15650, crane_weight_at: '2026-10-28T17:40:00Z', yard_position: 'B5-02-01-2', dig_moves: 1 },
    importer: { name: 'Marlow Tableware (sim)', category: 'general' },
  }),
  box({
    ...realBase, id: REAL.CSNU6554910, number: 'CSNU6554910', cargo: 'Machine tools', kind: 'industrial',
    story: 'Real box. Terminal49 shows available_for_pickup: true AND an active customs hold, which their docs say can happen. Trust the hold.',
    discharged: '2026-10-28T18:10:00Z', line: '2026-11-02', facility: '2026-11-01', appt: today('09:15'),
    available: true,
    holds: [{ name: 'customs', status: 'hold', description: 'CBP HOLD - EXAM REQUIRED', placed_at: '2026-10-28T22:15:00Z' }],
    decl: { commodity_text: 'CNC machine tool parts', vgm_weight_kg: 19900 },
    sensors: { crane_weight_kg: 20150, crane_weight_at: '2026-10-28T18:10:00Z', yard_position: 'B5-11-03-2', dig_moves: 1 },
    importer: { name: 'Keystone Tooling (sim)', category: 'general' },
    gate: { trucker: 'SoCal Drayage' },
  }),
]

// ---------------------------------------------------------------- the hero box: four stories

export const HERO_ID = 'sim-hero-0001'
const hero: Box = {
  ...box({
    id: HERO_ID, number: 'CSLU7734521', cargo: 'Undeclared (declared empty)', kind: 'unknown', bl: 'SIM-5521980', scac: 'COSU',
    story: 'One box, four stories: the carrier says empty, the scale says 27 t, customs has a hold, and the reefer is warming.',
    vessel: 'EVER_LAUREL', discharged: '2026-10-28T16:05:00Z', type: 'reefer', len: 40, eqLbs: 8600, available: true,
    holds: [{ name: 'customs', status: 'hold', description: 'CBP HOLD - EXAM REQUIRED', placed_at: '2026-10-27T18:40:00Z' }],
    line: '2026-10-31', facility: '2026-10-30', appt: '2026-10-29T16:30:00Z', t49Urgency: 'unknown',
    events: [
      { event: 'container.transport.vessel_loaded', timestamp: '2026-10-01T18:55:00Z', data_source: 'shipping_line', invalidated_at: null, location_name: 'Tianjinxingang', location_code: 'CNTXG', voyage_number: '1241E' },
      { event: 'container.transport.vessel_departed', timestamp: '2026-10-01T21:31:12Z', data_source: 'ais', invalidated_at: null, location_name: 'Tianjinxingang', location_code: 'CNTXG', voyage_number: '1241E' },
      { event: 'container.transport.vessel_arrived', timestamp: '2026-10-28T13:00:00Z', data_source: 'ais', invalidated_at: null, location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: '1241E' },
      { event: 'container.transport.vessel_discharged', timestamp: '2026-10-28T16:05:00Z', data_source: 'terminal', invalidated_at: null, location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: '1241E' },
    ],
    decl: { carrier_declared_status: 'empty', commodity_text: null, vgm_weight_kg: 26900, vgm_submitted_at: '2026-09-30T09:20:00Z', reefer_setpoint_c: -18, declared_at: '2026-09-29T06:00:00Z' },
    sensors: {
      crane_weight_kg: 27400, crane_weight_at: '2026-10-28T16:05:00Z',
      reefer_current_c: -9.5, reefer_trend_c_per_hr: 1.4, reefer_power_on: true, reefer_alarm: 'HIGH_TEMP', reefer_reading_at: today('07:20'),
      yard_position: 'R2-14-03-2', dig_moves: 1, tos_updated_at: today('07:25'),
    },
    importer: { name: null, category: null, verified: false, cargo_value_usd: null },
    gate: { trucker: 'Harbor Dray Co.' },
    history: [
      { at: '2026-10-26T16:12:00Z', kind: 'paperwork', source: 'Priority Lanes · paperwork check', text: 'Declared empty, but booked to run as a freezer at -18°C with a 26,900 kg VGM.' },
      { at: '2026-10-26T16:20:00Z', kind: 'request', source: 'Priority Lanes → COSCO', text: 'Confirmation request sent to COSCO: “Please confirm status and contents for CSLU7734521.”' },
      { at: '2026-10-27T18:40:00Z', kind: 'hold', source: 'CBP via Terminal49 holds_at_pod_terminal', text: 'CBP HOLD - EXAM REQUIRED placed, a day before arrival.' },
      { at: '2026-10-28T16:05:00Z', kind: 'sensor', source: 'Crane scale (terminal)', text: 'Crane weight 27,400 kg at discharge: confirms the VGM, rejects “empty”.' },
      { at: '2026-10-28T16:10:00Z', kind: 'sensor', source: 'Reefer telemetry (terminal)', text: 'Plugged in at 09:10: HIGH_TEMP alarm, running well above its -18°C setpoint.' },
    ],
  }),
}

// ---------------------------------------------------------------- named scenario boxes

const named: Box[] = [
  box({
    id: 'sim-0002', number: cn('MNBU', '305127'), cargo: 'Insulin', kind: 'medical', scac: 'MAEU', vessel: 'CORAL',
    story: 'Medical, verified, deadline today 17:00. Gets the first lane.',
    discharged: '2026-10-27T03:40:00Z', type: 'reefer', len: 40, line: '2026-10-30', facility: '2026-10-29', appt: today('08:00'),
    decl: { commodity_text: 'Insulin (pharmaceutical, 2–8°C)', vgm_weight_kg: 14800, reefer_setpoint_c: 5 },
    sensors: { crane_weight_kg: 14920, crane_weight_at: '2026-10-27T03:40:00Z', reefer_current_c: 5.2, reefer_trend_c_per_hr: 0, yard_position: 'R2-02-01-1', dig_moves: 0 },
    importer: { name: 'Westside Medical Distribution (sim)', category: 'medical', verified: true, cargo_value_usd: 640000 },
    gate: { truck_arrived_at: today('07:05'), trucker: 'Dockside Express' },
  }),
  box({
    id: 'sim-0003', number: cn('TCKU', '301962'), cargo: 'IV fluids', kind: 'medical', scac: 'HLCU', vessel: 'CORAL',
    story: 'Urgent but blocked: medical cargo on a customs hold. Expedite the exam, don’t release.',
    discharged: '2026-10-27T05:10:00Z', type: 'dry', len: 20, line: '2026-10-30', facility: '2026-10-30', appt: today('09:00'),
    holds: [{ name: 'customs', status: 'hold', description: 'CBP HOLD - EXAM REQUIRED', placed_at: '2026-10-26T15:00:00Z' }],
    decl: { commodity_text: 'IV fluids (saline bags)', vgm_weight_kg: 17600 },
    sensors: { crane_weight_kg: 17710, crane_weight_at: '2026-10-27T05:10:00Z', yard_position: 'A2-05-02-2', dig_moves: 1 },
    importer: { name: 'Mercy Supply Partners (sim)', category: 'medical', verified: true },
    gate: { trucker: 'Golden State Cartage' },
  }),
  box({
    id: 'sim-0004', number: cn('SZLU', '884213'), cargo: 'Frozen shrimp', kind: 'frozen', scac: 'MSCU', vessel: 'CORAL',
    story: 'Reefer 3°C warm and creeping up. Release it early and keep watching.',
    discharged: '2026-10-27T06:25:00Z', type: 'reefer', len: 40, line: '2026-10-30', facility: '2026-10-30', appt: today('08:15'),
    decl: { commodity_text: 'Frozen shrimp', vgm_weight_kg: 26100, reefer_setpoint_c: -20 },
    sensors: { crane_weight_kg: 26340, crane_weight_at: '2026-10-27T06:25:00Z', reefer_current_c: -17, reefer_trend_c_per_hr: 0.6, yard_position: 'R2-09-02-1', dig_moves: 1 },
    importer: { name: 'Blue Current Seafood (sim)', category: 'perishable_food', verified: true, cargo_value_usd: 84000 },
    gate: { trucker: 'Bayline Transport' },
  }),
  box({
    id: 'sim-0005', number: cn('EGHU', '920417'), cargo: 'Furniture', kind: 'furniture', scac: 'EGLV', vessel: 'EVER_LAUREL',
    story: 'Five days of free time, no appointment. Slow.',
    discharged: '2026-10-28T18:20:00Z', type: 'dry', len: 40, line: '2026-11-03', facility: '2026-11-03',
    decl: { commodity_text: 'Upholstered furniture', vgm_weight_kg: 9800 },
    sensors: { crane_weight_kg: 9910, crane_weight_at: '2026-10-28T18:20:00Z', yard_position: 'A5-12-04-4', dig_moves: 3 },
    importer: { name: 'Oakline Furniture (sim)', category: 'general' },
  }),
  box({
    id: 'sim-0006', number: cn('CBHU', '771540'), cargo: 'Auto parts', kind: 'industrial', scac: 'COSU', vessel: 'EVER_LAUREL',
    story: 'Rail-bound to Chicago with an 11:00 on-dock cutoff. Reroute it to rail and skip the jammed gate.',
    discharged: '2026-10-28T19:15:00Z', type: 'dry', len: 40, line: '2026-11-02', facility: '2026-11-02', rail: '2026-11-01', appt: today('08:45'),
    decl: { commodity_text: 'Automotive transmission parts', vgm_weight_kg: 22400 },
    sensors: { crane_weight_kg: 22650, crane_weight_at: '2026-10-28T19:15:00Z', yard_position: 'B2-04-01-1', dig_moves: 0 },
    importer: { name: 'Midwest Drive Systems (sim)', category: 'critical_industrial', verified: true },
    gate: { trucker: 'Rapid Port Lines', rail_bound: true, rail_cutoff_at: today('11:00'), rail_destination: 'Chicago (BNSF)' },
  }),
  box({
    id: 'sim-0007', number: cn('EXFU', '402288'), cargo: 'Ethanol (hazmat 3)', kind: 'hazmat', scac: 'COSU', vessel: 'EVER_LAUREL',
    story: 'Hazmat class 3 weighs 6% over its VGM. Outside tolerance, not dangerous yet: confirm and route to the hazmat lane.',
    discharged: '2026-10-28T20:30:00Z', type: 'tank', len: 40, line: '2026-11-02', facility: '2026-11-02', appt: today('10:30'),
    decl: { commodity_text: 'Ethanol solution, UN1170', vgm_weight_kg: 24000, vgm_submitted_at: '2026-10-27T17:05:00Z', hazmat_class: '3' },
    sensors: { crane_weight_kg: 25440, crane_weight_at: '2026-10-28T20:30:00Z', yard_position: 'H1-02-01-1', dig_moves: 0 },
    importer: { name: 'Solvex Chemicals (sim)', category: 'general' },
    gate: { trucker: 'Golden State Cartage' },
  }),
  box({
    id: 'sim-0008', number: cn('EMCU', '615309'), cargo: 'Electronics', kind: 'electronics', scac: 'EGLV', vessel: 'EVER_LAUREL',
    story: 'Says not available, but no hold explains it. Probably data lag: watch and re-check in 30 minutes.',
    discharged: '2026-10-28T23:40:00Z', type: 'dry', len: 40, available: false, checkedAt: '2026-10-29T11:50:00Z', line: '2026-11-02', facility: '2026-11-02', appt: today('11:00'),
    decl: { commodity_text: 'Consumer electronics accessories', vgm_weight_kg: 11200 },
    sensors: { crane_weight_kg: 11310, crane_weight_at: '2026-10-28T23:40:00Z', yard_position: 'B6-03-02-2', dig_moves: 1 },
    importer: { name: 'Brightwave Electronics (sim)', category: 'general' },
    gate: { trucker: 'Pacific Link Trucking' },
  }),
  box({
    id: 'sim-0009', number: cn('MSKU', '508812'), cargo: 'Relief supplies', kind: 'relief', scac: 'MAEU', vessel: 'CORAL',
    story: 'Generators and water, booked for Friday afternoon, right when wind may stop the cranes. Pull it forward.',
    discharged: '2026-10-27T07:50:00Z', type: 'dry', len: 40, line: '2026-10-31', facility: '2026-10-31', appt: fri('14:00'),
    decl: { commodity_text: 'Portable generators, bottled water', vgm_weight_kg: 19300 },
    sensors: { crane_weight_kg: 19420, crane_weight_at: '2026-10-27T07:50:00Z', yard_position: 'A1-06-03-3', dig_moves: 2 },
    importer: { name: 'Coastal Relief Network (sim)', category: 'relief_supplies', verified: true },
    gate: { trucker: 'Dockside Express' },
  }),
  box({
    id: 'sim-0010', number: cn('HLXU', '233071'), cargo: 'Toys', kind: 'toys', scac: 'HLCU', vessel: 'ASTRID',
    story: 'Two days past its deadline and charges are running. Get it out today: that stops the charges, and it’s waited long enough.',
    discharged: '2026-10-24T22:00:00Z', type: 'dry', len: 20, line: '2026-10-27', facility: '2026-10-27',
    decl: { commodity_text: 'Plastic toys', vgm_weight_kg: 8400 },
    sensors: { crane_weight_kg: 8520, crane_weight_at: '2026-10-24T22:00:00Z', yard_position: 'A3-01-01-1', dig_moves: 0 },
    importer: { name: 'Little Harbor Toys (sim)', category: 'general' },
    gate: { truck_arrived_at: today('06:50'), walk_up: true, trucker: 'Basin Freight' },
  }),
  box({
    id: 'sim-0011', number: cn('FCIU', '478205'), cargo: 'General cargo', kind: 'general', scac: 'COSU', vessel: 'EVER_LAUREL',
    story: 'VACIS scan pending: schedule the scan, cancel the noon truck.',
    discharged: '2026-10-28T21:10:00Z', type: 'dry', len: 40, line: '2026-11-02', facility: '2026-11-02', appt: today('12:00'),
    holds: [{ name: 'VACIS', status: 'hold', description: 'VACIS EXAM REQUIRED', placed_at: '2026-10-28T23:00:00Z' }],
    decl: { commodity_text: 'Mixed housewares', vgm_weight_kg: 14300 },
    sensors: { crane_weight_kg: 14410, crane_weight_at: '2026-10-28T21:10:00Z', yard_position: 'B3-08-02-2', dig_moves: 1 },
    importer: { name: 'Northgate Trading (sim)', category: 'general' },
    gate: { trucker: 'SoCal Drayage' },
  }),
  box({
    id: 'sim-0012', number: cn('CXRU', '118734'), cargo: 'Table grapes', kind: 'produce', scac: 'MSCU', vessel: 'CORAL',
    story: 'USDA hold, temperature fine. Book the USDA slot and keep it plugged in.',
    discharged: '2026-10-27T08:30:00Z', type: 'reefer', len: 40, line: '2026-10-30', facility: '2026-10-30', appt: today('09:45'),
    holds: [{ name: 'USDA', status: 'hold', description: 'USDA HOLD - INSPECTION REQUIRED', placed_at: '2026-10-27T15:00:00Z' }],
    decl: { commodity_text: 'Fresh table grapes', vgm_weight_kg: 24800, reefer_setpoint_c: -0.5 },
    sensors: { crane_weight_kg: 24960, crane_weight_at: '2026-10-27T08:30:00Z', reefer_current_c: -0.3, reefer_trend_c_per_hr: 0, yard_position: 'R3-04-02-2', dig_moves: 1 },
    importer: { name: 'Valle Fresh Produce (sim)', category: 'perishable_food', verified: true, cargo_value_usd: 61000 },
    gate: { trucker: 'Bayline Transport' },
  }),
  box({
    id: 'sim-0013', number: cn('TCNU', '390166'), cargo: 'General cargo', kind: 'general', scac: 'COSU', vessel: 'EVER_LAUREL',
    story: 'The carrier reported discharge, then retracted it; the terminal’s time differs. Trust the terminal, lower the carrier’s milestone score.',
    discharged: '2026-10-28T18:42:00Z', type: 'dry', len: 40, line: '2026-11-02', facility: '2026-11-02', appt: today('13:00'),
    events: [
      ...stdEvents('EVER_LAUREL', '2026-10-28T18:42:00Z').slice(0, 3),
      { event: 'container.transport.vessel_discharged', timestamp: '2026-10-28T15:10:00Z', data_source: 'shipping_line', invalidated_at: '2026-10-28T19:02:00Z', location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: '1241E' },
      { event: 'container.transport.vessel_discharged', timestamp: '2026-10-28T18:42:00Z', data_source: 'terminal', invalidated_at: null, location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: '1241E' },
    ],
    decl: { commodity_text: 'Garden tools', vgm_weight_kg: 12600 },
    sensors: { crane_weight_kg: 12540, crane_weight_at: '2026-10-28T18:42:00Z', yard_position: 'B1-10-02-2', dig_moves: 1 },
    importer: { name: 'Fieldstone Supply (sim)', category: 'general' },
    gate: { trucker: 'Rapid Port Lines' },
  }),
  box({
    id: 'sim-0014', number: cn('BMOU', '662409'), cargo: 'Apparel', kind: 'apparel', scac: 'EGLV', vessel: 'EVER_LAUREL',
    story: 'Walk-up truck, no appointment, low urgency. Offer a guaranteed slot after 14:00.',
    discharged: '2026-10-28T19:55:00Z', type: 'dry', len: 40, line: '2026-11-02', facility: '2026-11-02',
    decl: { commodity_text: 'Apparel (cotton knitwear)', vgm_weight_kg: 8900 },
    sensors: { crane_weight_kg: 8980, crane_weight_at: '2026-10-28T19:55:00Z', yard_position: 'A6-03-03-3', dig_moves: 2 },
    importer: { name: 'Thread & Loom Co. (sim)', category: 'general' },
    gate: { truck_arrived_at: today('07:15'), walk_up: true, trucker: 'SoCal Drayage' },
  }),
]

// ---------------------------------------------------------------- ~94 generated boxes

const TRUCKERS = ['Harbor Dray Co.', 'Pacific Link Trucking', 'Basin Freight', 'SoCal Drayage', 'Dockside Express', 'Golden State Cartage', 'Rapid Port Lines', 'Bayline Transport', 'Westport Haulers', 'Seaside Logistics']
const IMPORTERS = ['Harbor Home Goods', 'Pacific Rim Apparel', 'Summit Outdoor', 'Crescent Kitchenware', 'Granite Tile Supply', 'Lumen Lighting', 'Arcadia Footwear', 'Redwood Hardware', 'Metro Office Supply', 'Vista Solar', 'Copperline Electric', 'Juniper Home', 'Atlas Machinery', 'Bright Path Toys', 'Cobalt Cycles', 'Delta Flooring', 'Evergreen Grocers', 'Fairway Sports', 'Silverline Tires', 'Tidewater Textiles']

type Commodity = { text: string; kind: CargoKind; min: number; max: number; industrial?: boolean; setpoint?: number }
const DRY: Commodity[] = [
  { text: 'Furniture', kind: 'furniture', min: 6000, max: 11000 },
  { text: 'Apparel', kind: 'apparel', min: 5000, max: 9000 },
  { text: 'Footwear', kind: 'apparel', min: 6000, max: 10000 },
  { text: 'Kitchenware', kind: 'general', min: 9000, max: 15000 },
  { text: 'Ceramic floor tiles', kind: 'general', min: 18000, max: 24000 },
  { text: 'LED lighting', kind: 'electronics', min: 5000, max: 9000 },
  { text: 'Steel fasteners', kind: 'industrial', min: 18000, max: 25000, industrial: true },
  { text: 'Machinery parts', kind: 'industrial', min: 14000, max: 22000, industrial: true },
  { text: 'Solar panels', kind: 'industrial', min: 10000, max: 16000, industrial: true },
  { text: 'Auto parts', kind: 'industrial', min: 12000, max: 20000, industrial: true },
  { text: 'Toys', kind: 'toys', min: 5000, max: 9000 },
  { text: 'Sporting goods', kind: 'general', min: 6000, max: 11000 },
  { text: 'Bicycles', kind: 'general', min: 5000, max: 8000 },
  { text: 'Tires', kind: 'general', min: 9000, max: 14000 },
  { text: 'Home textiles', kind: 'apparel', min: 6000, max: 10000 },
  { text: 'Office supplies', kind: 'general', min: 8000, max: 14000 },
  { text: 'Plastic resin', kind: 'industrial', min: 20000, max: 25000, industrial: true },
  { text: 'Hand tools', kind: 'general', min: 12000, max: 18000 },
]
const REEFER: Commodity[] = [
  { text: 'Frozen beef', kind: 'frozen', min: 22000, max: 26000, setpoint: -18 },
  { text: 'Frozen chicken', kind: 'frozen', min: 22000, max: 26000, setpoint: -18 },
  { text: 'Frozen fries', kind: 'frozen', min: 20000, max: 24000, setpoint: -20 },
  { text: 'Chilled salmon', kind: 'frozen', min: 18000, max: 22000, setpoint: 0 },
  { text: 'Avocados', kind: 'produce', min: 18000, max: 21000, setpoint: 5 },
  { text: 'Bananas', kind: 'produce', min: 19000, max: 22000, setpoint: 13.3 },
]

const PREFIX: Record<string, string[]> = {
  COSU: ['CSNU', 'CBHU', 'CCLU', 'FCIU', 'TGHU'],
  EGLV: ['EGHU', 'EMCU', 'EISU', 'TGBU'],
  ONEY: ['ONEU', 'NYKU', 'TCLU'],
  MAEU: ['MSKU', 'MRKU', 'MAEU'],
  MSCU: ['MSCU', 'MEDU', 'MSMU'],
  HLCU: ['HLXU', 'HLBU', 'FANU'],
  CMDU: ['CMAU', 'APZU', 'TRHU'],
}
const REEFER_PREFIX = ['SZLU', 'MNBU', 'CXRU', 'TRIU', 'SEGU']

function generate(): Box[] {
  const r = mulberry32(20261029)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const between = (a: number, b: number) => a + (b - a) * r()
  const gauss = () => (r() + r() + r() - 1.5) * 1.15

  // Gate slots: 31 trucks already queued (with the 3 named ones = 34), then appointments.
  type Slot = { kind: 'queue'; walk: boolean } | { kind: 'appt'; at: number } | { kind: 'none' }
  const slots: Slot[] = []
  for (let i = 0; i < 31; i++) slots.push({ kind: 'queue', walk: i < 5 })
  const thu = ['09:20', '10:40', '11:00', '11:05', '11:10', '11:20', '11:30', '11:35', '11:45', '11:50', '12:00', '12:10', '12:15', '12:25', '12:30', '12:40', '12:50', '12:55', '13:05', '13:15', '13:25', '13:30', '13:40', '13:45',
    '14:00', '14:10', '14:20', '14:30', '14:45', '15:00', '15:10', '15:20', '15:30', '15:45', '15:50', '16:00', '16:05', '16:10', '16:20', '16:30', '16:35', '16:40', '16:45', '16:50']
  for (const t of thu) slots.push({ kind: 'appt', at: la('2026-10-29', t) })
  for (const t of ['08:00', '09:30', '10:30', '11:15', '13:00', '14:30', '15:30', '16:30']) slots.push({ kind: 'appt', at: la('2026-10-30', t) })
  while (slots.length < 94) slots.push({ kind: 'none' })
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }

  const out: Box[] = []
  let queueIdx = 0
  for (let i = 0; i < 94; i++) {
    const id = `sim-${String(i + 15).padStart(4, '0')}`
    const vr = r()
    const vessel: VesselKey = vr < 0.64 ? 'EVER_LAUREL' : vr < 0.91 ? 'CORAL' : 'ASTRID'
    const scac = vessel === 'EVER_LAUREL' ? pick(['COSU', 'COSU', 'COSU', 'EGLV', 'EGLV', 'ONEY']) : vessel === 'CORAL' ? pick(['MAEU', 'MSCU', 'HLCU', 'CMDU']) : pick(['ONEY', 'HLCU', 'CMDU'])
    const tr = r()
    const type: EquipmentType = tr < 0.1 ? 'reefer' : tr < 0.12 ? 'tank' : 'dry'
    const len: 20 | 40 = type === 'dry' && r() < 0.22 ? 20 : 40
    const height = len === 40 && (type !== 'dry' || r() < 0.8) ? 'high_cube' : 'standard'
    const com: Commodity = type === 'reefer' ? pick(REEFER) : type === 'tank' ? { text: pick(['Vegetable oil', 'Food-grade glycerin', 'Latex']), kind: 'general', min: 20000, max: 24000 } : pick(DRY)
    const prefix = type === 'reefer' ? pick(REEFER_PREFIX) : type === 'tank' ? 'EXFU' : pick(PREFIX[scac])
    const number = cn(prefix, String(100000 + Math.floor(r() * 899999)))

    const v = VESSELS[vessel]
    const dischargeStart = { EVER_LAUREL: '2026-10-28T14:00:00Z', CORAL: '2026-10-27T01:00:00Z', ASTRID: '2026-10-24T18:00:00Z' }[vessel]
    const discharged = iso(new Date(dischargeStart).getTime() + Math.floor(between(0, vessel === 'EVER_LAUREL' ? 10 : 11) * 60) * MIN)
    const line = addDays(laDate(new Date(discharged).getTime()), v.freeDays)
    const fr = r()
    const facility = fr < 0.035 ? addDays(line, -2) : fr < 0.33 ? addDays(line, -1) : line

    const tare = type === 'reefer' ? 4800 : type === 'tank' ? 3700 : len === 20 ? 2300 : 3900
    const cargoKg = Math.round(between(len === 20 ? com.min * 0.7 : com.min, len === 20 ? com.max * 0.8 : com.max) / 10) * 10
    const vgm = tare + cargoKg
    const crane = Math.round((vgm * (1 + Math.max(-0.035, Math.min(0.035, gauss() * 0.012)))) / 10) * 10

    // ~15% holds
    let holds: Hold[] = []
    const hr = r()
    if (hr < 0.12) {
      const hk = r()
      const placed = iso(new Date(discharged).getTime() + 3 * HOUR)
      if (type === 'reefer' && com.kind === 'produce') holds = [{ name: 'USDA', status: 'hold', description: 'USDA HOLD - INSPECTION REQUIRED', placed_at: placed }]
      else if (hk < 0.36) holds = [{ name: 'customs', status: 'hold', description: 'CBP HOLD - EXAM REQUIRED', placed_at: placed }]
      else if (hk < 0.56) holds = [{ name: 'freight', status: 'hold', description: 'FREIGHT CHARGES UNPAID', placed_at: placed }]
      else if (hk < 0.7) holds = [{ name: 'line', status: 'hold', description: 'LINE RELEASE PENDING', placed_at: placed }]
      else if (hk < 0.82) holds = [{ name: 'VACIS', status: 'hold', description: 'VACIS EXAM REQUIRED', placed_at: placed }]
      else holds = [{ name: 'TMF', status: 'hold', description: 'TMF FEE UNPAID', placed_at: placed }]
    }

    const slot = slots[i]
    const gate: Partial<Gate> = {}
    let appt: string | null = null
    if (slot.kind === 'queue') {
      const arrived = la('2026-10-29', '06:35') + Math.round(queueIdx * 1.7) * MIN
      queueIdx++
      gate.truck_arrived_at = iso(arrived)
      gate.walk_up = slot.walk
      if (!slot.walk) appt = iso(Math.ceil((arrived + 35 * MIN) / (15 * MIN)) * 15 * MIN)
    } else if (slot.kind === 'appt') appt = iso(slot.at)
    if (slot.kind !== 'none') gate.trucker = pick(TRUCKERS)

    const industrial = !!com.industrial && r() < 0.4
    const category: Category = type === 'reefer' ? 'perishable_food' : industrial ? 'critical_industrial' : 'general'
    const s: Partial<Sensors> = {
      crane_weight_kg: crane,
      crane_weight_at: discharged,
      yard_position: `${type === 'reefer' ? pick(['R1', 'R2', 'R3', 'R4']) : type === 'tank' ? 'H1' : pick(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6'])}-${String(1 + Math.floor(r() * 14)).padStart(2, '0')}-${String(1 + Math.floor(r() * 6)).padStart(2, '0')}-${1 + Math.floor(r() * 4)}`,
    }
    s.dig_moves = Math.max(0, +s.yard_position!.slice(-1) - 1 - (r() < 0.4 ? 1 : 0))
    if (type === 'reefer') {
      s.reefer_current_c = Math.round((com.setpoint! + gauss() * 0.5) * 10) / 10
      s.reefer_trend_c_per_hr = Math.round(gauss() * 0.08 * 10) / 10
    }

    out.push(box({
      id, number, cargo: com.text, kind: com.kind, scac, vessel, discharged, type, len, height,
      holds, line, facility, appt,
      decl: { commodity_text: com.text, vgm_weight_kg: vgm, reefer_setpoint_c: com.setpoint ?? null, seal_number_declared: r() < 0.3 ? `${scac.slice(0, 2)}${1000000 + Math.floor(r() * 8999999)}` : null },
      sensors: s,
      importer: { name: `${pick(IMPORTERS)} (sim)`, category, verified: r() < 0.6, cargo_value_usd: type === 'reefer' ? Math.round(between(38, 120)) * 1000 : null },
      gate,
    }))
    const last = out[out.length - 1]
    if (last.declarations.seal_number_declared) last.sensors.seal_number_observed = last.declarations.seal_number_declared
  }

  // Deterministic tweaks so the scenario contains each case the brief asks for.
  const free = (pred: (b: Box) => boolean) => out.find((b) => !b.holds_at_pod_terminal.length && !b.story && pred(b))!
  const tag = (b: Box, story: string) => { b.story = story; return b }

  // Weight conflicts outside tolerance (major → flag, keep moving)
  for (const delta of [0.068, -0.061, 0.079]) {
    const b = tag(free((x) => x.equipment_type === 'dry' && x.pod_vessel_name === 'EVER LAUREL'), `Crane weight ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}% vs VGM: outside tolerance, no safety implication.`)
    b.sensors.crane_weight_kg = Math.round((b.declarations.vgm_weight_kg! * (1 + delta)) / 10) * 10
  }
  // Line vs facility two days apart (major)
  for (let k = 0; k < 2; k++) {
    const b = tag(free((x) => x.import_deadlines_pod_facility_current === x.import_deadlines_pod_line_current && x.pod_vessel_name === 'EVER LAUREL'), 'Line and facility deadlines two days apart: confirm with both.')
    b.import_deadlines_pod_facility_current = addDays(b.import_deadlines_pod_line_current!, -2)
  }
  // Customs hold while available_for_pickup: true (the documented disagreement)
  out.filter((b) => b.holds_at_pod_terminal.some((h) => h.name === 'customs')).slice(0, 2).forEach((b) => { b.available_for_pickup = true; b.story = 'available_for_pickup: true alongside a customs hold. Trust the hold.' })
  // Pending customs reviews
  for (let k = 0; k < 2; k++) {
    const b = tag(free((x) => x.pod_vessel_name === 'EVER LAUREL' && x.equipment_type === 'dry'), 'Customs review pending: re-check before release.')
    b.holds_at_pod_terminal = [{ name: 'customs', status: 'pending', description: 'CBP REVIEW PENDING', placed_at: iso(NOW - 5 * HOUR) }]
    b.available_for_pickup = false
    b.status = 'not_available'
  }
  // Data lag: not available, no hold
  {
    const b = tag(free((x) => x.pod_vessel_name === 'EVER LAUREL'), 'Not available with no hold listed: likely data lag.')
    b.available_for_pickup = false
    b.status = 'not_available'
    b.terminal_checked_at = iso(NOW - 3 * HOUR)
  }
  // Another retracted carrier milestone
  {
    const b = tag(free((x) => x.pod_vessel_name === 'EVER LAUREL' && !!x.pickup_appointment_at), 'Carrier milestone retracted; terminal event differs.')
    const d = b.pod_discharged_at!
    b.events.push({ event: 'container.transport.vessel_discharged', timestamp: iso(new Date(d).getTime() - 3 * HOUR), data_source: 'shipping_line', invalidated_at: iso(new Date(d).getTime() + 30 * MIN), location_name: 'Los Angeles', location_code: 'USLAX', voyage_number: '1241E' })
  }
  // Reefers: one drifting, one 2.6°C warm
  {
    const reefers = out.filter((b) => b.equipment_type === 'reefer' && !b.holds_at_pod_terminal.length && !b.story)
    if (reefers[0]) { tag(reefers[0], 'Reefer drifting +0.5°C/hr: release and re-check.'); reefers[0].sensors.reefer_current_c = reefers[0].declarations.reefer_setpoint_c! + 1.4; reefers[0].sensors.reefer_trend_c_per_hr = 0.5 }
    if (reefers[1]) { tag(reefers[1], 'Reefer 2.6°C above setpoint: release first, watch.'); reefers[1].sensors.reefer_current_c = reefers[1].declarations.reefer_setpoint_c! + 2.6; reefers[1].sensors.reefer_trend_c_per_hr = 0.3 }
  }
  // Make sure the reefer commodities the pre-arrival radar talks about exist on EVER LAUREL.
  for (const [text, setpoint, kind] of [['Bananas', 13.3, 'produce'], ['Frozen chicken', -18, 'frozen']] as const) {
    if (out.some((b) => b.declarations.commodity_text === text && b.pod_vessel_name === 'EVER LAUREL' && !b.story)) continue
    const b = out.find((x) => x.equipment_type === 'reefer' && x.pod_vessel_name === 'EVER LAUREL' && !x.story && !x.holds_at_pod_terminal.length && !['Bananas', 'Frozen chicken'].includes(x.declarations.commodity_text ?? ''))
      ?? out.find((x) => x.equipment_type === 'dry' && x.pod_vessel_name === 'EVER LAUREL' && !x.story && !x.holds_at_pod_terminal.length)!
    b.equipment_type = 'reefer'
    b.equipment_length_ft = 40
    b.equipment_height = 'high_cube'
    b.cargo = text
    b.kind = kind
    b.declarations.commodity_text = text
    b.declarations.reefer_setpoint_c = setpoint
    b.sensors.reefer_current_c = setpoint + 0.2
    b.sensors.reefer_trend_c_per_hr = 0
    b.sensors.reefer_power_on = true
    b.sensors.reefer_reading_at = iso(NOW - 9 * MIN)
    b.sensors.yard_position = `R4-${b.sensors.yard_position!.slice(3)}`
    b.importer.category = 'perishable_food'
    b.importer.cargo_value_usd = 52000
  }
  // Rail-bound boxes with on-dock cutoffs
  {
    const early = out.filter((b) => !b.holds_at_pod_terminal.length && !b.story && b.pickup_appointment_at && !b.gate.truck_arrived_at && new Date(b.pickup_appointment_at).getTime() < la('2026-10-29', '10:45') && b.pod_vessel_name === 'EVER LAUREL')
    const dest = ['Memphis (BNSF)', 'Dallas (UP)']
    early.slice(0, 2).forEach((b, k) => {
      tag(b, `Rail-bound to ${dest[k]}: on-dock rail bypasses the gate.`)
      b.gate.rail_bound = true
      b.gate.rail_cutoff_at = today(k === 0 ? '11:00' : '12:30')
      b.gate.rail_destination = dest[k]
      b.pickup_lfd_rail = addDays(b.import_deadlines_pod_line_current!, -1)
    })
  }
  // Security cases: implausible weight for the commodity, and a seal mismatch.
  {
    const b = tag(free((x) => x.equipment_type === 'dry' && x.equipment_length_ft === 40 && x.pod_vessel_name === 'EVER LAUREL'), 'Paper napkins don’t weigh 28 tonnes.')
    b.cargo = 'Paper napkins'
    b.kind = 'general'
    b.declarations.commodity_text = 'Paper napkins'
    b.declarations.vgm_weight_kg = 27800
    b.sensors.crane_weight_kg = 28120
  }
  {
    const b = tag(free((x) => x.equipment_type === 'dry' && x.pod_vessel_name === 'EVER LAUREL'), 'Seal at discharge doesn’t match the manifest.')
    b.declarations.seal_number_declared = 'CS4471023'
    b.sensors.seal_number_observed = 'EM2290018'
    b.number = cn('CCLU', '206635')
  }
  // Recompute posted fees after the deadline tweaks.
  for (const b of out) {
    const earliest = [b.import_deadlines_pod_line_current, b.import_deadlines_pod_facility_current, b.pickup_lfd_rail].filter((x): x is string => !!x).sort()[0] ?? null
    const f = feesFor(earliest)
    b.fees_at_pod_terminal = f.fees
    b.fees_total_amount = f.total
  }
  return out
}

const generated = generate()

export const BOXES: Box[] = [hero, ...named, ...realBoxes, ...generated]
export const boxById = (id: string) => BOXES.find((b) => b.id === id)

// ---------------------------------------------------------------- pre-arrival radar (paperwork only)

export interface InboundRecord {
  id: string
  number: string
  vessel: string
  eta: string
  scac: string
  equipment_type: EquipmentType
  equipment_length_ft: 20 | 40
  declarations: Declarations
  extra?: { vgm_resubmitted_kg?: number; seal_on_vgm_doc?: string }
  earlyHold?: Hold
  flaggedAt: string
  resolution: { at: string; note: string } | null
  linkedBoxId?: string
  importer: string
}

const decl = (d: Partial<Declarations>): Declarations => ({
  carrier_declared_status: 'full', commodity_text: null, vgm_weight_kg: null, vgm_submitted_at: '2026-09-30T08:00:00Z',
  reefer_setpoint_c: null, hazmat_class: null, seal_number_declared: null, declared_at: '2026-09-29T06:00:00Z', ...d,
})
const EL_ETA = '2026-10-28T13:00:00Z'
const genOf = (pred: (b: Box) => boolean) => generated.find((b) => pred(b) && !b.story) ?? generated[0]

export const INBOUND: InboundRecord[] = (() => {
  const elDry = generated.filter((b) => b.pod_vessel_name === 'EVER LAUREL' && b.equipment_type === 'dry' && !b.story && !b.holds_at_pod_terminal.length)
  const sealBox = generated.find((b) => b.sensors.seal_number_observed === 'EM2290018')!
  const ivBox = named.find((b) => b.id === 'sim-0003')!
  const hazBox = named.find((b) => b.id === 'sim-0007')!
  const reef = (name: string) => genOf((b) => b.equipment_type === 'reefer' && b.declarations.commodity_text === name && b.pod_vessel_name === 'EVER LAUREL')
  return [
    { id: 'in-01', number: hero.number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: 'COSU', equipment_type: 'reefer', equipment_length_ft: 40, importer: 'Not declared',
      declarations: hero.declarations, earlyHold: hero.holds_at_pod_terminal[0], flaggedAt: '2026-10-26T16:12:00Z', resolution: null, linkedBoxId: HERO_ID },
    { id: 'in-02', number: ivBox.number, vessel: 'CORAL MERIDIAN', eta: '2026-10-26T20:00:00Z', scac: 'HLCU', equipment_type: 'dry', equipment_length_ft: 20, importer: 'Mercy Supply Partners (sim)',
      declarations: ivBox.declarations, earlyHold: ivBox.holds_at_pod_terminal[0], flaggedAt: '2026-10-26T15:05:00Z', resolution: null, linkedBoxId: 'sim-0003' },
    { id: 'in-03', number: sealBox.number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: sealBox.shipping_line_scac, equipment_type: 'dry', equipment_length_ft: sealBox.equipment_length_ft, importer: sealBox.importer.name ?? '',
      declarations: sealBox.declarations, extra: { seal_on_vgm_doc: 'CS4471028' }, flaggedAt: '2026-10-26T17:40:00Z', resolution: null, linkedBoxId: sealBox.id },
    { id: 'in-04', number: hazBox.number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: 'COSU', equipment_type: 'tank', equipment_length_ft: 40, importer: 'Solvex Chemicals (sim)',
      declarations: { ...hazBox.declarations, vgm_weight_kg: null }, flaggedAt: '2026-10-26T16:30:00Z', resolution: { at: '2026-10-27T17:05:00Z', note: 'Shipper submitted VGM: 24,000 kg' }, linkedBoxId: 'sim-0007' },
    { id: 'in-05', number: elDry[0].number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: elDry[0].shipping_line_scac, equipment_type: 'dry', equipment_length_ft: elDry[0].equipment_length_ft, importer: elDry[0].importer.name ?? '',
      declarations: decl({ commodity_text: 'Frozen tuna loins', vgm_weight_kg: elDry[0].declarations.vgm_weight_kg }), flaggedAt: '2026-10-26T16:14:00Z', resolution: { at: '2026-10-26T22:30:00Z', note: `Carrier corrected commodity to “${elDry[0].declarations.commodity_text}”` }, linkedBoxId: elDry[0].id },
    { id: 'in-06', number: reef('Bananas').number, vessel: reef('Bananas').pod_vessel_name, eta: reef('Bananas').pod_arrived_at!, scac: reef('Bananas').shipping_line_scac, equipment_type: 'reefer', equipment_length_ft: 40, importer: reef('Bananas').importer.name ?? '',
      declarations: decl({ commodity_text: 'Bananas', vgm_weight_kg: reef('Bananas').declarations.vgm_weight_kg, reefer_setpoint_c: -18 }), flaggedAt: '2026-10-26T16:13:00Z', resolution: { at: '2026-10-26T21:10:00Z', note: 'Setpoint corrected to 13.3°C before arrival' }, linkedBoxId: reef('Bananas').id },
    { id: 'in-07', number: elDry[1].number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: elDry[1].shipping_line_scac, equipment_type: 'dry', equipment_length_ft: 20, importer: elDry[1].importer.name ?? '',
      declarations: decl({ commodity_text: 'Ceramic floor tiles', vgm_weight_kg: 31200 }), flaggedAt: '2026-10-26T16:15:00Z', resolution: { at: '2026-10-27T01:20:00Z', note: 'VGM corrected to 28,100 kg (typo)' } },
    { id: 'in-08', number: elDry[2].number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: elDry[2].shipping_line_scac, equipment_type: 'dry', equipment_length_ft: 40, importer: elDry[2].importer.name ?? '',
      declarations: decl({ commodity_text: 'Apparel (t-shirts)', vgm_weight_kg: 29900 }), flaggedAt: '2026-10-26T16:16:00Z', resolution: { at: '2026-10-26T23:45:00Z', note: 'VGM covered two boxes; corrected to 10,400 kg' } },
    { id: 'in-09', number: elDry[3].number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: elDry[3].shipping_line_scac, equipment_type: 'dry', equipment_length_ft: 40, importer: elDry[3].importer.name ?? '',
      declarations: decl({ commodity_text: 'Lithium-ion batteries', vgm_weight_kg: 14800 }), flaggedAt: '2026-10-26T16:17:00Z', resolution: { at: '2026-10-27T03:10:00Z', note: 'Hazmat class 9 (UN3480) added to the booking' } },
    { id: 'in-10', number: reef('Frozen chicken').number, vessel: reef('Frozen chicken').pod_vessel_name, eta: reef('Frozen chicken').pod_arrived_at!, scac: reef('Frozen chicken').shipping_line_scac, equipment_type: 'reefer', equipment_length_ft: 40, importer: reef('Frozen chicken').importer.name ?? '',
      declarations: decl({ commodity_text: 'Frozen chicken', vgm_weight_kg: reef('Frozen chicken').declarations.vgm_weight_kg, reefer_setpoint_c: null }), flaggedAt: '2026-10-26T16:20:00Z', resolution: { at: '2026-10-26T20:40:00Z', note: 'Setpoint -18°C added' } },
    { id: 'in-11', number: elDry[4].number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: elDry[4].shipping_line_scac, equipment_type: 'dry', equipment_length_ft: 40, importer: elDry[4].importer.name ?? '',
      declarations: decl({ carrier_declared_status: 'empty', commodity_text: 'Auto parts', vgm_weight_kg: 4100 }), flaggedAt: '2026-10-26T16:18:00Z', resolution: { at: '2026-10-26T19:05:00Z', note: 'Carrier corrected status to full' } },
    { id: 'in-12', number: elDry[5].number, vessel: 'EVER LAUREL', eta: EL_ETA, scac: elDry[5].shipping_line_scac, equipment_type: 'dry', equipment_length_ft: 40, importer: elDry[5].importer.name ?? '',
      declarations: decl({ commodity_text: 'Steel fasteners', vgm_weight_kg: 25300 }), extra: { vgm_resubmitted_kg: 23100 }, flaggedAt: '2026-10-26T16:19:00Z', resolution: { at: '2026-10-27T00:15:00Z', note: 'Shipper confirmed the later VGM (23,100 kg)' } },
  ]
})()

// ---------------------------------------------------------------- learning log history (simulated)

export interface ResolvedConflict {
  date: string
  number: string
  conflict: string
  sources: string
  right: string
  wrong: string
  timeToResolve: string
  action: string
  avoided: number
  caughtAt: 'pre-arrival' | 'discharge' | 'gate'
}

export const HISTORY: ResolvedConflict[] = [
  { date: '2026-10-27', number: cn('MSMU', '771204'), conflict: 'VGM 21,400 kg vs crane 24,950 kg', sources: 'VGM vs crane scale', right: 'Crane scale', wrong: 'VGM', timeToResolve: '2h 10m', action: 'Flag / confirm', avoided: 640, caughtAt: 'discharge' },
  { date: '2026-10-27', number: cn('TCLU', '402981'), conflict: 'available_for_pickup: true with TMF hold', sources: 'Terminal availability vs hold list', right: 'Hold list', wrong: 'Terminal availability', timeToResolve: '25m', action: 'Flag (importer paid TMF)', avoided: 180, caughtAt: 'discharge' },
  { date: '2026-10-26', number: cn('CSNU', '518820'), conflict: 'Declared empty, VGM 19,800 kg', sources: 'Carrier vs VGM', right: 'VGM', wrong: 'Carrier declaration (COSU)', timeToResolve: '6h', action: 'Flag (carrier corrected)', avoided: 0, caughtAt: 'pre-arrival' },
  { date: '2026-10-26', number: cn('OOLU', '663105'), conflict: 'Discharge event retracted by carrier', sources: 'shipping_line vs terminal event', right: 'Terminal event', wrong: 'Shipping line event (invalidated)', timeToResolve: '3h 40m', action: 'Watch', avoided: 90, caughtAt: 'discharge' },
  { date: '2026-10-25', number: cn('SZLU', '902455'), conflict: 'Reefer +5.1°C, setpoint -18°C', sources: 'Booking vs telemetry', right: 'Reefer telemetry', wrong: 'Booking setpoint (none)', timeToResolve: '1h 15m', action: 'Release + watch', avoided: 52000, caughtAt: 'discharge' },
  { date: '2026-10-24', number: cn('MSKU', '330918'), conflict: 'Line LFD Oct 27 vs facility Oct 26', sources: 'Line vs facility deadline', right: 'Facility deadline', wrong: 'Unified pick (line)', timeToResolve: '—', action: 'Release a day earlier', avoided: 225, caughtAt: 'discharge' },
  { date: '2026-10-23', number: cn('HLBU', '118204'), conflict: 'Hazmat class 8, crane +11% vs VGM', sources: 'VGM vs crane scale', right: 'Crane scale', wrong: 'VGM', timeToResolve: '4h 30m', action: 'Inspect (re-weighed, re-documented)', avoided: 3400, caughtAt: 'discharge' },
  { date: '2026-10-22', number: cn('EGHU', '774512'), conflict: 'Customs hold missed at gate', sources: 'Truck arrived; hold posted 8 min earlier', right: 'Customs (CBP)', wrong: 'Driver’s appointment', timeToResolve: '15m', action: 'Truck notified before lane', avoided: 270, caughtAt: 'gate' },
  { date: '2026-10-21', number: cn('CMAU', '559019'), conflict: 'Dry box declared “frozen fish”', sources: 'Carrier commodity vs equipment', right: 'Equipment (dry)', wrong: 'Commodity text', timeToResolve: '9h', action: 'Flag (commodity corrected)', avoided: 0, caughtAt: 'pre-arrival' },
  { date: '2026-10-20', number: cn('TGHU', '845530'), conflict: 'Seal mismatch, re-seal record found', sources: 'Manifest vs gate camera', right: 'Carrier re-seal record', wrong: '—', timeToResolve: '1h 50m', action: 'Flag / confirm', avoided: 1100, caughtAt: 'discharge' },
]

export const WEEKLY = { caughtBeforeGate: 41, laneClosuresAvoided: 3, chargesAvoided: 46000, conflicts: 47, avgResolveHours: 2.6 }
