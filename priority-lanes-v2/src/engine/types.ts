// Field names follow Terminal49's container/shipment API wherever a Terminal49 field exists.
// Anything Terminal49 doesn't carry (declarations, terminal sensors, importer input, gate plan)
// lives in its own clearly named block so it's obvious what is simulated.

export type Status =
  | 'new' | 'on_ship' | 'grounded' | 'available' | 'not_available' | 'awaiting_inland_transfer'
  | 'on_rail' | 'off_dock' | 'picked_up' | 'delivered' | 'empty_returned'

export type HoldName = 'customs' | 'USDA' | 'VACIS' | 'freight' | 'line' | 'TMF' | 'other'
export interface Hold {
  name: HoldName
  status: 'hold' | 'pending'
  description: string
  placed_at?: string // simulated extra: when the hold first appeared
}

export type FeeType = 'demurrage' | 'extended_dwell_time' | 'exam' | 'total' | 'other'
export interface Fee { type: FeeType; amount: number; currency_code: 'USD' }

export type DataSource = 'shipping_line' | 'ais' | 'terminal' | 'rail'
export interface T49Event {
  event: string
  timestamp: string
  data_source: DataSource
  invalidated_at: string | null
  location_name?: string
  location_code?: string
  voyage_number?: string
}

export type Category = 'medical' | 'relief_supplies' | 'perishable_food' | 'critical_industrial' | 'general'
export type EquipmentType = 'dry' | 'reefer' | 'tank'
export type CargoKind =
  | 'medical' | 'relief' | 'frozen' | 'produce' | 'industrial' | 'hazmat' | 'electronics'
  | 'furniture' | 'toys' | 'apparel' | 'general' | 'unknown'

/** Carrier / customs paperwork. Exists before arrival (simulated). */
export interface Declarations {
  carrier_declared_status: 'full' | 'empty'
  commodity_text: string | null
  vgm_weight_kg: number | null
  vgm_submitted_at: string | null
  reefer_setpoint_c: number | null
  hazmat_class: string | null
  seal_number_declared: string | null
  declared_at: string
}

/** Terminal's own systems: TOS, crane/gate scale, reefer plugs, cameras (simulated). */
export interface Sensors {
  crane_weight_kg: number | null
  crane_weight_at: string | null
  gate_scale_weight_kg: number | null
  gate_scale_at: string | null
  reefer_current_c: number | null
  reefer_trend_c_per_hr: number | null
  reefer_power_on: boolean | null
  reefer_alarm: string | null
  reefer_reading_at: string | null
  yard_position: string | null
  dig_moves: number
  seal_number_observed: string | null
  tos_updated_at: string | null
}

/** The only new input Priority Lanes asks for. */
export interface Importer {
  name: string | null
  category: Category | null
  verified: boolean
  cargo_value_usd: number | null
}

/** Today's gate plan for the box (simulated). */
export interface Gate {
  truck_arrived_at: string | null // truck already in the queue
  walk_up: boolean
  trucker: string | null
  rail_bound: boolean
  rail_cutoff_at: string | null // on-dock rail cutoff
  rail_destination: string | null
}

export interface HistoryItem {
  at: string
  kind: 'paperwork' | 'hold' | 'request' | 'sensor' | 'note'
  source: string
  text: string
}

export interface Box {
  id: string
  number: string
  real: boolean // one of the 4 containers from the live Terminal49 snapshot
  cargo: string // short UI label
  kind: CargoKind
  story?: string // what this box demonstrates in the scenario
  bill_of_lading: string
  shipping_line_scac: string
  shipping_line_name: string
  pod_vessel_name: string
  voyage_number: string
  pod_terminal_name: string
  status: Status
  equipment_type: EquipmentType
  equipment_length_ft: 20 | 40
  equipment_height: 'standard' | 'high_cube'
  equipment_weight_lbs: number | null
  available_for_pickup: boolean
  availability_known: boolean
  pod_arrived_at: string | null
  pod_discharged_at: string | null
  terminal_checked_at: string | null
  holds_at_pod_terminal: Hold[]
  fees_at_pod_terminal: Fee[]
  fees_total_amount: number
  import_deadlines_pod_line_current: string | null
  import_deadlines_pod_facility_current: string | null
  pickup_lfd_rail: string | null
  import_deadlines_pod_unified_current_value: string | null
  import_deadlines_pod_unified_current_selection: 'line' | 'facility' | 'rail' | null
  pickup_lfd: string | null
  pickup_appointment_at: string | null
  urgency: string // Terminal49's own urgency field
  urgency_simulated: boolean // true when the Terminal49 urgency value itself is simulated
  events: T49Event[]
  declarations: Declarations
  sensors: Sensors
  importer: Importer
  gate: Gate
  history: HistoryItem[]
}

// ---------------------------------------------------------------- engine output

export type Severity = 'minor' | 'major' | 'critical'
export type AttrKey = 'weight' | 'contents' | 'release' | 'temperature' | 'deadline' | 'location' | 'seal'
export type ColKey = 'carrier' | 'vgm' | 't49' | 'terminal' | 'reefer' | 'customs'

export interface Cell {
  value: string
  sub?: string
  at?: string | null
  tag?: string // e.g. data_source
  strike?: boolean // invalidated event
  tone?: 'trusted' | 'conflict' | 'rejected' | 'muted' | 'agree'
}

export interface Conflict {
  attr: AttrKey
  severity: Severity
  summary: string
  /** Affects whether the box can be released right now. */
  affectsRelease: boolean
  security?: string // security-relevant reasoning (shown in Security view)
  safety?: string
}

export interface Confidence {
  authority: number
  freshness: number
  track: number
  freshnessNote: string
  trackNote: string
  value: number // 0–1
}

export interface TrustedAttr {
  key: AttrKey
  label: string
  cells: Partial<Record<ColKey, Cell[]>>
  trusted: { value: string; source: string; confidence: Confidence | null; reason: string } | null
  conflict: Conflict | null
}

export type UrgencyBand = 'critical' | 'high' | 'normal' | 'can_slow'
export interface UrgencyFactor {
  key: 'criticality' | 'time' | 'condition' | 'cost' | 'downstream' | 'fairness'
  label: string
  points: number
  max: number
  why: string
}
export interface Urgency { score: number; band: UrgencyBand; factors: UrgencyFactor[] }

export type ActionKey = 'release' | 'watch' | 'flag' | 'slow' | 'reroute' | 'inspect' | 'hold' | 'close'
export interface LadderRow {
  step: number
  key: ActionKey
  status: 'insufficient' | 'chosen' | 'not_needed'
  reason: string
  cost: number | null
  costNote: string
}
export interface Task { id: string; text: string; who: string }
export interface Recommendation {
  step: number
  key: ActionKey
  headline: string
  also: ActionKey[] // secondary actions, e.g. Release + Watch
  why: string[]
  releasable: boolean // can a truck take it today
  blocker: string | null
  tasks: Task[]
  ladder: LadderRow[]
  cost: number
  costNote: string
  nextBlunter: { key: ActionKey; cost: number | null; note: string } | null
  slotHint: string | null // offered slot for Slow, cutoff for Reroute, etc.
  offeredSlot: number | null // epoch ms, for Slow / pull-forward
  offerReason: 'slow' | 'weather' | 'deadline' | null
}

export interface SecurityFinding { title: string; detail: string; severity: Severity }

export interface Evaluation {
  box: Box
  attrs: TrustedAttr[]
  conflicts: Conflict[]
  severity: Severity | null
  security: SecurityFinding[]
  available: boolean // trusted release status says it can go
  blocker: string | null
  deadline: {
    ymd: string
    source: 'line' | 'facility' | 'rail'
    at: number
    effectiveAt: number
    effectiveNote: string | null
  } | null
  hoursToDeadline: number | null
  reefer: { setpoint: number; current: number; dev: number; trend: number; alarm: string | null; readingAt: string | null } | null
  dailyCharges: number
  truckArrive: number | null // when the truck reaches the gate today (epoch ms)
  urgency: Urgency
  rec: Recommendation
}
