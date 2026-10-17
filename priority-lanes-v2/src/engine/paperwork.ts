// Pre-arrival checks. Before discharge only paperwork exists: declarations, VGM, booking
// setpoints and early holds. No measured weight or live temperature is ever used here.

import type { Declarations, EquipmentType, Hold, Severity } from './types.ts'
import { HOUR, fmtDay, ms } from './time.ts'
import { commodityCeiling } from './trust.ts'
import { kg } from './rates.ts'

export interface PaperworkInput {
  equipment_type: EquipmentType
  equipment_length_ft: 20 | 40
  eta: string
  declarations: Declarations
  extra?: { vgm_resubmitted_kg?: number; seal_on_vgm_doc?: string }
  earlyHold?: Hold
}

export interface PaperworkWarning { severity: Severity; rule: string; text: string }

const MAX_GROSS = { 20: 30480, 40: 32500 }

export function paperworkChecks(p: PaperworkInput, asOf: number): PaperworkWarning[] {
  const d = p.declarations
  const w: PaperworkWarning[] = []
  const empty = d.carrier_declared_status === 'empty'
  const vgm = d.vgm_weight_kg

  if (empty && vgm != null && vgm > 10000 && empty && d.reefer_setpoint_c != null && d.reefer_setpoint_c <= 0) {
    w.push({ severity: 'critical', rule: 'Declared empty vs VGM + setpoint', text: `Declared empty, but booked to run as a freezer at ${d.reefer_setpoint_c}°C with a ${Math.round(vgm / 1000)}-ton verified weight (${kg(vgm)}).` })
  } else {
    if (empty && vgm != null && vgm > 10000) w.push({ severity: 'critical', rule: 'Declared empty vs VGM', text: `Declared empty, but VGM says ${kg(vgm)}.` })
    if (empty && d.reefer_setpoint_c != null && d.reefer_setpoint_c <= 0) w.push({ severity: 'critical', rule: 'Declared empty vs setpoint', text: `Declared empty, but booked to run at ${d.reefer_setpoint_c}°C.` })
  }
  if (empty && d.commodity_text) w.push({ severity: 'major', rule: 'Empty with commodity', text: `Declared empty, but the commodity text says “${d.commodity_text}”.` })
  if (p.equipment_type === 'dry' && d.commodity_text && /frozen|chilled/i.test(d.commodity_text)) w.push({ severity: 'major', rule: 'Dry box, frozen cargo', text: `Dry box declared as “${d.commodity_text}”.` })
  if (d.hazmat_class && vgm == null) w.push({ severity: 'major', rule: 'Hazmat without VGM', text: `Hazmat class ${d.hazmat_class} with no VGM on file: a box can’t be loaded or handled safely without one.` })
  if (!d.hazmat_class && d.commodity_text && /lithium/i.test(d.commodity_text)) w.push({ severity: 'major', rule: 'Undeclared hazmat', text: `“${d.commodity_text}” with no hazmat class (lithium batteries are class 9).` })
  if (p.equipment_type === 'reefer' && d.reefer_setpoint_c == null && !empty) w.push({ severity: 'major', rule: 'Reefer without setpoint', text: `Reefer carrying “${d.commodity_text}” with no setpoint on the booking.` })
  if (d.commodity_text && /banana/i.test(d.commodity_text) && d.reefer_setpoint_c != null && d.reefer_setpoint_c < 10) w.push({ severity: 'major', rule: 'Setpoint vs commodity', text: `Bananas set to ${d.reefer_setpoint_c}°C would freeze them (normal ≈ 13°C).` })
  if (vgm != null && vgm > MAX_GROSS[p.equipment_length_ft]) w.push({ severity: 'critical', rule: 'VGM over max gross', text: `VGM ${kg(vgm)} exceeds the ${kg(MAX_GROSS[p.equipment_length_ft])} max gross for a ${p.equipment_length_ft}' box.` })
  const ceiling = commodityCeiling(d.commodity_text)
  if (ceiling && vgm != null && vgm - 3900 > ceiling.max * 1.8) w.push({ severity: 'major', rule: 'VGM vs commodity', text: `${kg(vgm)} is implausible for “${d.commodity_text}” (a full box rarely tops ${kg(ceiling.max + 3900)}).` })
  if (p.extra?.vgm_resubmitted_kg && vgm != null && Math.abs(p.extra.vgm_resubmitted_kg - vgm) / vgm > 0.05) w.push({ severity: 'major', rule: 'Conflicting VGMs', text: `Two VGMs on file disagree: ${kg(vgm)} and ${kg(p.extra.vgm_resubmitted_kg)}.` })
  if (p.extra?.seal_on_vgm_doc && d.seal_number_declared && p.extra.seal_on_vgm_doc !== d.seal_number_declared) w.push({ severity: 'major', rule: 'Seal numbers differ', text: `Booking seal ${d.seal_number_declared} vs VGM document seal ${p.extra.seal_on_vgm_doc}.` })
  if (p.earlyHold) {
    const placed = p.earlyHold.placed_at ? ms(p.earlyHold.placed_at) : asOf
    const days = (ms(p.eta) - placed) / (24 * HOUR)
    if (days <= 3 && days > 0) {
      const lead = days < 1 ? `${Math.round(days * 24)}h` : `${Math.round(days * 10) / 10} days`
      w.push({ severity: 'major', rule: 'Hold before arrival', text: `${p.earlyHold.name === 'customs' ? 'CBP' : p.earlyHold.name} hold placed ${fmtDay(placed)}, ${lead} before arrival (${p.earlyHold.description}): book the exam slot now.` })
    }
  }
  return w
}
